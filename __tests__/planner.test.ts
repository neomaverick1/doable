import { planDay, quickBreakdown } from '@/lib/planner';
import type { Task } from '@/lib/types';

const T = '2026-11-15';
let n = 0;
const task = (p: Partial<Task>): Task => ({
  id: p.id ?? `t${++n}`,
  title: p.title ?? 'Task',
  priority: 'normal',
  tags: [],
  done: false,
  createdAt: `2026-11-1${n % 9}T08:00:00Z`,
  due: T,
  ...p,
});

describe('planDay', () => {
  test('fixed tasks keep their time and flexible ones fill the gaps by priority', () => {
    const plan = planDay(
      [
        task({ id: 'meet', time: '10:00', durationMin: 60 }),
        task({ id: 'low', priority: 'low', durationMin: 30 }),
        task({ id: 'high', priority: 'high', durationMin: 45 }),
      ],
      { today: T, dayStart: 9 * 60, dayEnd: 12 * 60, gap: 0 },
    );
    expect(plan.blocks.map((b) => [b.taskId, b.start, b.end])).toEqual([
      ['high', 540, 585],
      ['meet', 600, 660],
      ['low', 660, 690],
    ]);
    expect(plan.overflow).toEqual([]);
  });

  test('tasks that do not fit go to overflow', () => {
    const plan = planDay([task({ id: 'a', durationMin: 120 }), task({ id: 'b', durationMin: 120 })], {
      today: T,
      dayStart: 9 * 60,
      dayEnd: 12 * 60,
    });
    expect(plan.blocks.map((b) => b.taskId)).toEqual(['a']);
    expect(plan.overflow).toEqual(['b']);
  });

  test('nothing is planned in the past, overdue work comes first, done and future tasks are skipped', () => {
    const plan = planDay(
      [
        task({ id: 'today' }),
        task({ id: 'overdue', due: '2026-11-13' }),
        task({ id: 'done', done: true }),
        task({ id: 'future', due: '2026-11-20' }),
      ],
      { today: T, dayStart: 9 * 60, dayEnd: 18 * 60, nowMin: 13 * 60 + 7, gap: 0 },
    );
    expect(plan.blocks.map((b) => [b.taskId, b.start])).toEqual([
      ['overdue', 13 * 60 + 15],
      ['today', 13 * 60 + 45],
    ]);
  });
});

describe('quickBreakdown', () => {
  test('uses a matching template and spreads steps up to the deadline', () => {
    const steps = quickBreakdown('Launch my bakery website', T, '2026-11-27');
    expect(steps).toHaveLength(6);
    expect(steps[0].title).toMatch(/goal/i);
    expect(steps[steps.length - 1].due).toBe('2026-11-27');
    const dues = steps.map((s) => s.due!);
    expect([...dues].sort()).toEqual(dues);
  });

  test('falls back to a generic plan over two weeks', () => {
    const steps = quickBreakdown('Organise the garage', T);
    expect(steps[steps.length - 1].due).toBe('2026-11-29');
  });
});
