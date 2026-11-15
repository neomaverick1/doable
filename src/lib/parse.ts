import * as chrono from 'chrono-node';

import { addDays, toISODate, weekday } from './dates';
import type { Priority, Repeat, TaskDraft } from './types';

/** A piece of the sentence the parser understood, shown as a chip under the input. */
export interface ParseChip {
  kind: 'date' | 'time' | 'duration' | 'priority' | 'tag' | 'repeat';
  source: string;
}

export interface ParseResult {
  draft: TaskDraft;
  chips: ParseChip[];
}

const DAY = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';
const DAY_INDEX: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const LEAD_INS =
  /^\s*(?:please\s+)?(?:remind me to|remember to|don'?t forget to|i need to|i have to|i must|need to|have to|todo:?|to-?do:?|task:?)\s+/i;
const DANGLING = /[\s,;:-]+(?:on|at|by|in|for|due|from|to|and|&|every|this|next|before|around|until)?\s*$/i;

/**
 * Turns one sentence ("Gym tomorrow 7am for 1h #health") into a task draft.
 * Works offline: dates and times come from chrono-node, the rest from small, tested patterns.
 */
export function parseTask(input: string, ref: Date = new Date()): ParseResult {
  const chips: ParseChip[] = [];
  let text = ` ${input.replace(/\s+/g, ' ')} `;
  let priority: Priority = 'normal';
  let durationMin: number | undefined;
  let repeat: Repeat | undefined;
  const tags: string[] = [];

  const take = (re: RegExp, kind: ParseChip['kind'], onMatch: (m: RegExpExecArray) => boolean | void) => {
    const m = re.exec(text);
    if (!m) return false;
    if (onMatch(m) === false) return false;
    chips.push({ kind, source: m[0].trim() });
    text = text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length);
    return true;
  };

  // #tags
  for (let guard = 0; guard < 10 && take(/(^|\s)#([A-Za-z0-9][\w-]*)/, 'tag', (m) => void tags.push(m[2].toLowerCase())); guard++);

  // Priority
  take(/(^|\s)!{1,3}(?=\s|$)/, 'priority', () => void (priority = 'high')) ||
    take(/\b(?:urgent|asap|important|high priority|top priority)\b/i, 'priority', () => void (priority = 'high')) ||
    take(/\b(?:low priority|whenever|someday|no rush)\b/i, 'priority', () => void (priority = 'low'));

  // Repeats
  take(/\b(?:every\s*day|daily)\b/i, 'repeat', () => void (repeat = { every: 'day' })) ||
    take(/\b(?:every\s+week\s*day|every\s+weekday|weekdays|every\s+work\s*day)\b/i, 'repeat', () => void (repeat = { every: 'weekday' })) ||
    take(new RegExp(`\\bevery\\s+(${DAY}(?:\\s*(?:,|and|&)\\s*${DAY})*)\\b`, 'i'), 'repeat', (m) => {
      const days = [...m[1].toLowerCase().matchAll(new RegExp(DAY, 'g'))].map((d) => DAY_INDEX[d[1].slice(0, 3)]);
      repeat = { every: 'week', weekdays: [...new Set(days)].sort() };
    }) ||
    take(/\b(?:every\s+week|weekly)\b/i, 'repeat', () => void (repeat = { every: 'week', weekdays: [] })) ||
    take(/\b(?:every\s+month|monthly)\b/i, 'repeat', () => void (repeat = { every: 'month' }));

  // Durations: "for 1h 30m", "for 45 min", "for an hour", "for half an hour"
  take(/\bfor\s+half\s+an\s+hour\b/i, 'duration', () => void (durationMin = 30)) ||
    take(/\bfor\s+(?:an?|one)\s+hour\b/i, 'duration', () => void (durationMin = 60)) ||
    take(
      /\bfor\s+(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)\b(?:\s*(?:and\s*)?(\d+)\s*(?:m|min|mins|minute|minutes)\b)?/i,
      'duration',
      (m) => {
        durationMin = Math.round(parseFloat(m[1]) * 60 + (m[2] ? parseInt(m[2], 10) : 0));
      },
    ) ||
    take(/\bfor\s+(\d+)\s*(?:m|min|mins|minute|minutes)\b/i, 'duration', (m) => void (durationMin = parseInt(m[1], 10)));
  if (durationMin !== undefined) durationMin = Math.min(720, Math.max(5, durationMin));

  // Dates and times
  let due: string | undefined;
  let time: string | undefined;
  const results = chrono.parse(text, ref, { forwardDate: true });
  const hit = results.find((r) => /[a-z]/i.test(r.text) || r.start.isCertain('hour'));
  if (hit) {
    const start = hit.start;
    const when = start.date();
    const hasDay = start.isCertain('day') || start.isCertain('weekday') || start.isCertain('month');
    const hasTime = start.isCertain('hour');
    if (hasDay || hasTime || /\b(today|tonight|tomorrow|week|month)\b/i.test(hit.text)) due = toISODate(when);
    if (hasTime) {
      time = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
      if (hit.end && hit.end.isCertain('hour') && durationMin === undefined) {
        const mins = Math.round((hit.end.date().getTime() - when.getTime()) / 60000);
        if (mins > 0 && mins <= 720) durationMin = mins;
      }
    }
    const before = text.slice(0, hit.index).replace(/\b(?:on|at|by|due|before)\s*$/i, ' ');
    chips.push({ kind: hasTime && !hasDay && !/\b(today|tonight|tomorrow)\b/i.test(hit.text) ? 'time' : 'date', source: hit.text.trim() });
    text = before + ' ' + text.slice(hit.index + hit.text.length);
  }

  // A repeat needs a first occurrence.
  const today = toISODate(ref);
  if (repeat) {
    if (repeat.every === 'week' && repeat.weekdays.length === 0) repeat = { every: 'week', weekdays: [weekday(due ?? today)] };
    if (!due) due = firstOccurrence(repeat, today);
  }

  return {
    draft: { title: cleanTitle(text), due, time, durationMin, priority, tags, repeat },
    chips,
  };
}

/** The first date on or after `from` that matches the repeat rule. */
export function firstOccurrence(repeat: Repeat, from: string): string {
  for (let i = 0; i < 8; i++) {
    const d = addDays(from, i);
    if (matchesRepeat(repeat, d)) return d;
  }
  return from;
}

/** The next date after `after` that matches the repeat rule. */
export function nextOccurrence(repeat: Repeat, after: string): string {
  if (repeat.every === 'month') {
    const [y, m, d] = after.split('-').map(Number);
    const next = new Date(y, m, Math.min(d, daysInMonth(y, m)));
    return toISODate(next);
  }
  for (let i = 1; i <= 8; i++) {
    const d = addDays(after, i);
    if (matchesRepeat(repeat, d)) return d;
  }
  return addDays(after, 7);
}

function matchesRepeat(repeat: Repeat, date: string): boolean {
  const wd = weekday(date);
  switch (repeat.every) {
    case 'day':
    case 'month':
      return true;
    case 'weekday':
      return wd >= 1 && wd <= 5;
    case 'week':
      return repeat.weekdays.includes(wd);
  }
}

function daysInMonth(year: number, monthIndex0: number): number {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

export function cleanTitle(raw: string): string {
  let t = raw
    .replace(/\s+/g, ' ')
    .replace(/\s+([,;:.!?])/g, '$1')
    .trim();
  t = t.replace(LEAD_INS, '');
  for (let i = 0; i < 4; i++) t = t.replace(DANGLING, '').trim();
  t = t.replace(/^[\s,;:.-]+|[\s,;:-]+$/g, '').trim();
  if (!t) return 'New task';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function describeRepeat(repeat: Repeat): string {
  switch (repeat.every) {
    case 'day':
      return 'Every day';
    case 'weekday':
      return 'Every weekday';
    case 'month':
      return 'Every month';
    case 'week': {
      const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      return `Every ${repeat.weekdays.map((d) => names[d]).join(', ')}`;
    }
  }
}
