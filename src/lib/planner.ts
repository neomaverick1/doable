import { addDays, diffDays, timeToMin } from './dates';
import type { ISODate, Priority, Task, TaskDraft } from './types';

export interface Block {
  taskId: string;
  start: number; // minutes from midnight
  end: number;
  fixed: boolean; // true when the task already had a time
}

export interface DayPlan {
  blocks: Block[];
  /** Tasks that did not fit before the end of the day. */
  overflow: string[];
  freeMinutes: number;
}

export interface PlanOptions {
  today: ISODate;
  dayStart: number; // minutes, e.g. 9 * 60
  dayEnd: number; // minutes, e.g. 18 * 60
  nowMin?: number; // nothing is placed before now
  defaultDuration?: number;
  gap?: number; // breathing room after each flexible task
}

const RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

/**
 * Builds a time-blocked plan for one day.
 * Tasks with a time stay where they are; the rest fill the free gaps, most important first,
 * overdue before due-today, then in the order they were created.
 */
export function planDay(tasks: Task[], opts: PlanOptions): DayPlan {
  const def = opts.defaultDuration ?? 30;
  const gap = opts.gap ?? 5;
  // Today's plan covers what is due today plus anything overdue.
  const open = tasks.filter((t) => !t.done && !!t.due && diffDays(t.due, opts.today) <= 0);

  const fixed: Block[] = open
    .filter((t) => t.time && t.due === opts.today)
    .map((t) => {
      const start = timeToMin(t.time!);
      return { taskId: t.id, start, end: start + (t.durationMin ?? def), fixed: true };
    })
    .sort((a, b) => a.start - b.start);

  const flexible = open
    .filter((t) => !(t.time && t.due === opts.today))
    .sort(
      (a, b) =>
        RANK[a.priority] - RANK[b.priority] ||
        diffDays(a.due!, opts.today) - diffDays(b.due!, opts.today) ||
        a.createdAt.localeCompare(b.createdAt),
    );

  let cursorStart = opts.dayStart;
  if (opts.nowMin !== undefined) cursorStart = Math.max(cursorStart, Math.ceil(opts.nowMin / 15) * 15);

  // Free windows between the fixed blocks.
  const windows: { start: number; end: number }[] = [];
  let cursor = cursorStart;
  for (const b of fixed) {
    const end = Math.min(b.start, opts.dayEnd);
    if (end > cursor) windows.push({ start: cursor, end });
    cursor = Math.max(cursor, b.end);
  }
  if (cursor < opts.dayEnd) windows.push({ start: cursor, end: opts.dayEnd });

  const placed: Block[] = [];
  const overflow: string[] = [];
  for (const t of flexible) {
    const len = t.durationMin ?? def;
    const w = windows.find((win) => win.end - win.start >= len);
    if (!w) {
      overflow.push(t.id);
      continue;
    }
    placed.push({ taskId: t.id, start: w.start, end: w.start + len, fixed: false });
    w.start = Math.min(w.end, w.start + len + gap);
  }

  const freeMinutes = windows.reduce((sum, w) => sum + Math.max(0, w.end - w.start), 0);
  return { blocks: [...fixed, ...placed].sort((a, b) => a.start - b.start), overflow, freeMinutes };
}

const TEMPLATES: { match: RegExp; steps: string[] }[] = [
  {
    match: /\b(website|site|app|launch|landing page|store)\b/i,
    steps: [
      'Write down the goal and who it is for',
      'Sketch the main pages',
      'Write the content and gather photos',
      'Build the first version',
      'Test it on a phone and a laptop',
      'Launch it and share the link',
    ],
  },
  {
    match: /\b(trip|travel|vacation|holiday|flight)\b/i,
    steps: [
      'Pick the dates and a budget',
      'Book the flights',
      'Book where to stay',
      'Plan the days and must-sees',
      'Sort out documents and insurance',
      'Pack',
    ],
  },
  {
    match: /\b(learn|study|exam|course|certification|class)\b/i,
    steps: [
      'List the topics to cover',
      'Gather the study material',
      'Study the first half of the topics',
      'Study the second half',
      'Do a full practice test',
      'Review weak spots',
    ],
  },
  {
    match: /\b(move|moving|apartment|house)\b/i,
    steps: [
      'Set the moving date and budget',
      'Book movers or a van',
      'Declutter and sell what you will not take',
      'Pack room by room',
      'Change your address and utilities',
      'Unpack the essentials',
    ],
  },
  {
    match: /\b(party|birthday|wedding|event|celebration|dinner)\b/i,
    steps: [
      'Set the date, place and budget',
      'Make the guest list',
      'Send the invitations',
      'Plan food and drinks',
      'Buy decorations and supplies',
      'Confirm everything the day before',
    ],
  },
  {
    match: /\b(run|marathon|5k|10k|fitness|gym|weight)\b/i,
    steps: [
      'Set a clear target and date',
      'Plan a weekly routine',
      'Complete week one',
      'Check progress and adjust',
      'Keep the routine going',
      'Do the final test',
    ],
  },
];

/**
 * The offline "quick plan": splits a goal into template steps spread evenly up to the deadline.
 * With an API key the same screen asks the language model instead.
 */
export function quickBreakdown(goal: string, today: ISODate, deadline?: ISODate): TaskDraft[] {
  const steps = TEMPLATES.find((t) => t.match.test(goal))?.steps ?? [
    'Define what done looks like',
    'Break it into milestones',
    'Do the first milestone',
    'Review progress and adjust',
    'Finish the remaining work',
    'Wrap up and celebrate',
  ];
  const end = deadline && diffDays(deadline, today) >= 1 ? deadline : addDays(today, 14);
  const span = Math.max(1, diffDays(end, today));
  return steps.map((title, i) => ({
    title,
    due: addDays(today, Math.max(1, Math.round(((i + 1) * span) / steps.length))),
    priority: i === steps.length - 1 ? 'high' : 'normal',
    tags: [],
  }));
}
