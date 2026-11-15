import { addDays, diffDays, fromISODate, toISODate } from './dates';
import { firstOccurrence } from './parse';
import { newId, type Goal, type ISODate, type Task, type TaskDraft } from './types';

type Seed = Partial<Task> & Pick<TaskDraft, 'title'>;

/** Realistic sample data, dated relative to today, so the app looks lived-in on first launch. */
export function demoData(today: ISODate): { tasks: Task[]; goals: Goal[] } {
  const d = (n: number) => addDays(today, n);
  const created = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
  const firstOfNextMonth = (() => {
    const t = fromISODate(today);
    return toISODate(new Date(t.getFullYear(), t.getMonth() + 1, 1));
  })();

  const goal: Goal = { id: newId(), title: 'Launch the bakery website', deadline: d(12), createdAt: created(4000), plannedBy: 'quick' };

  const seeds: Seed[] = [
    { title: 'Morning run', due: d(0), time: '07:00', durationMin: 30, tags: ['health'], done: true, doneAt: created(180) },
    { title: 'Reply to client emails', due: d(0), durationMin: 30, priority: 'high', tags: ['work'] },
    { title: 'Team standup', due: d(0), time: '09:30', durationMin: 15, tags: ['work'], repeat: { every: 'weekday' } },
    { title: 'Review the pull request from Maya', due: d(0), durationMin: 45, tags: ['work'] },
    { title: 'Plan next week’s content', due: d(0), durationMin: 60, priority: 'low', tags: ['writing'] },
    { title: 'Pick up groceries', due: d(0), time: '18:00', durationMin: 30, tags: ['home'] },
    { title: 'Call mom', due: d(0), time: '19:30', durationMin: 20 },
    { title: 'Renew the car insurance', due: d(-1), priority: 'high', tags: ['admin'] },
    { title: 'Dentist appointment', due: d(1), time: '15:00', durationMin: 60, tags: ['health'] },
    { title: 'Draft the newsletter', due: d(1), durationMin: 90, tags: ['writing'] },
    { title: 'Water the plants', repeat: { every: 'week', weekdays: [1, 4] }, tags: ['home'] },
    { title: 'Gym', time: '07:00', durationMin: 60, repeat: { every: 'week', weekdays: [1, 3, 5] }, tags: ['health'] },
    { title: 'Book flights for the holidays', due: d(3), tags: ['travel'] },
    { title: 'Pay rent', due: firstOfNextMonth, priority: 'high', tags: ['home'] },
    { title: 'Write down the goal and who it is for', due: d(-3), goalId: goal.id, done: true, doneAt: created(3000) },
    { title: 'Sketch the main pages', due: d(-1), goalId: goal.id, done: true, doneAt: created(1500) },
    { title: 'Write the content and gather photos', due: d(2), durationMin: 120, goalId: goal.id },
    { title: 'Build the first version', due: d(5), durationMin: 180, goalId: goal.id },
    { title: 'Test it on a phone and a laptop', due: d(9), durationMin: 60, goalId: goal.id },
    { title: 'Launch it and share the link', due: d(12), priority: 'high', goalId: goal.id },
    { title: 'Try the new ramen place', tags: ['fun'] },
    { title: 'Read “Deep Work”', tags: ['books'] },
  ];

  const tasks = seeds.map((s, i): Task => {
    const due = s.due ?? (s.repeat ? firstOccurrence(s.repeat, today) : undefined);
    return {
      id: newId() + i,
      priority: 'normal',
      tags: [],
      done: false,
      createdAt: created(5000 - i * 60),
      ...s,
      due,
    };
  });

  return { tasks, goals: [goal] };
}

/** Days until a date, for the goal cards ("in 12 days"). */
export function daysLeft(date: ISODate, today: ISODate): string {
  const n = diffDays(date, today);
  if (n < 0) return `${-n} day${n === -1 ? '' : 's'} late`;
  if (n === 0) return 'due today';
  if (n === 1) return 'due tomorrow';
  return `in ${n} days`;
}
