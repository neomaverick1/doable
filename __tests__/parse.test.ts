import { describeRepeat, nextOccurrence, parseTask } from '@/lib/parse';

// Sunday, November 15 2026, 10:00 local time
const REF = new Date(2026, 10, 15, 10, 0);
const p = (s: string) => parseTask(s, REF).draft;

describe('parseTask', () => {
  test('weekday and time', () => {
    expect(p('Call the dentist Friday at 3pm')).toMatchObject({ title: 'Call the dentist', due: '2026-11-20', time: '15:00' });
  });

  test('tomorrow, time, duration and a tag', () => {
    expect(p('Gym tomorrow 7am for 1h #health')).toMatchObject({
      title: 'Gym',
      due: '2026-11-16',
      time: '07:00',
      durationMin: 60,
      tags: ['health'],
    });
  });

  test('lead-in phrase, month date and priority', () => {
    expect(p('remind me to pay rent on Dec 1 !')).toMatchObject({ title: 'Pay rent', due: '2026-12-01', priority: 'high' });
  });

  test('repeat on specific weekdays starts on the next match', () => {
    const d = p('Water the plants every Monday and Thursday');
    expect(d).toMatchObject({ title: 'Water the plants', due: '2026-11-16', repeat: { every: 'week', weekdays: [1, 4] } });
  });

  test('weekday repeat with time and minutes', () => {
    expect(p('Standup every weekday at 9:30 for 15 min #work')).toMatchObject({
      title: 'Standup',
      due: '2026-11-16',
      time: '09:30',
      durationMin: 15,
      tags: ['work'],
      repeat: { every: 'weekday' },
    });
  });

  test('plain task has no date', () => {
    expect(p('Buy milk')).toEqual({
      title: 'Buy milk',
      due: undefined,
      time: undefined,
      durationMin: undefined,
      priority: 'normal',
      tags: [],
      repeat: undefined,
    });
  });

  test('"by" deadline and urgent', () => {
    expect(p('Submit the report by Friday urgent')).toMatchObject({ title: 'Submit the report', due: '2026-11-20', priority: 'high' });
  });

  test('numbers in the title are not dates', () => {
    expect(p('Read 20 pages for 30 min daily')).toMatchObject({
      title: 'Read 20 pages',
      due: '2026-11-15',
      durationMin: 30,
      repeat: { every: 'day' },
    });
  });

  test('time only means today', () => {
    expect(p('Dinner with Sam at 7:30pm')).toMatchObject({ title: 'Dinner with Sam', due: '2026-11-15', time: '19:30' });
  });

  test('relative days, low priority and two tags', () => {
    expect(p('Book flights in 3 days #travel #family low priority')).toMatchObject({
      title: 'Book flights',
      due: '2026-11-18',
      priority: 'low',
      tags: ['travel', 'family'],
    });
  });

  test('a time range sets the duration', () => {
    expect(p('Team sync tomorrow 2-3pm')).toMatchObject({ title: 'Team sync', due: '2026-11-16', time: '14:00', durationMin: 60 });
  });

  test('an hour and dangling words', () => {
    expect(p('Email Anna about the invoice for an hour by')).toMatchObject({ title: 'Email Anna about the invoice', durationMin: 60 });
  });

  test('chips describe what was understood', () => {
    const kinds = parseTask('Gym tomorrow 7am for 1h #health !', REF)
      .chips.map((c) => c.kind)
      .sort();
    expect(kinds).toEqual(['date', 'duration', 'priority', 'tag']);
  });

  test('empty text gets a placeholder title', () => {
    expect(p('tomorrow').title).toBe('New task');
  });
});

describe('repeats', () => {
  test('next occurrence of a weekday rule skips the weekend', () => {
    expect(nextOccurrence({ every: 'weekday' }, '2026-11-20')).toBe('2026-11-23');
  });

  test('monthly repeats clamp to the end of short months', () => {
    expect(nextOccurrence({ every: 'month' }, '2026-01-31')).toBe('2026-02-28');
  });

  test('weekly on chosen days', () => {
    expect(nextOccurrence({ every: 'week', weekdays: [1, 4] }, '2026-11-16')).toBe('2026-11-19');
    expect(describeRepeat({ every: 'week', weekdays: [1, 4] })).toBe('Every Mon, Thu');
  });
});
