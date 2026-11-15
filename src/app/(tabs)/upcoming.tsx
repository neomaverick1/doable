import { router } from 'expo-router';
import { useMemo } from 'react';
import { Text, View } from 'react-native';

import { TaskRow } from '@/components/TaskRow';
import { Card, EmptyState, QuickAddBar, Screen, SectionTitle } from '@/components/ui';
import { dayLabel, diffDays, fromISODate, MONTHS, timeToMin } from '@/lib/dates';
import type { Task } from '@/lib/types';
import { useTasks } from '@/state/tasks';
import { space, type } from '@/theme';

interface Section {
  key: string;
  title: string;
  subtitle?: string;
  tasks: Task[];
}

export default function UpcomingScreen() {
  const { tasks, goals, today, toggle } = useTasks();
  const goalTitles = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, g.title])), [goals]);

  const sections = useMemo(() => {
    const open = tasks.filter((t) => !t.done && (!t.due || diffDays(t.due, today) > 0));
    const byDay = new Map<string, Task[]>();
    const later: Task[] = [];
    const someday: Task[] = [];
    for (const t of open) {
      if (!t.due) someday.push(t);
      else if (diffDays(t.due, today) <= 7) byDay.set(t.due, [...(byDay.get(t.due) ?? []), t]);
      else later.push(t);
    }
    const sortDay = (a: Task, b: Task) => (a.time ? timeToMin(a.time) : 9999) - (b.time ? timeToMin(b.time) : 9999);
    const out: Section[] = [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, list]) => {
        const d = fromISODate(day);
        return {
          key: day,
          title: dayLabel(day, today),
          subtitle: `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`,
          tasks: list.sort(sortDay),
        };
      });
    if (later.length) out.push({ key: 'later', title: 'Later', tasks: later.sort((a, b) => a.due!.localeCompare(b.due!)) });
    if (someday.length) out.push({ key: 'someday', title: 'Someday', subtitle: 'No date yet', tasks: someday });
    return out;
  }, [tasks, today]);

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ gap: 2 }}>
          <Text style={type.label}>Next 7 days and beyond</Text>
          <Text style={type.hero}>Upcoming</Text>
        </View>
        {sections.length === 0 ? (
          <EmptyState icon="calendar-outline" title="Nothing planned" message="Tasks with a future date show up here." />
        ) : null}
        {sections.map((s) => (
          <View key={s.key} style={{ gap: space.sm }}>
            <SectionTitle title={s.subtitle ? `${s.title} · ${s.subtitle}` : s.title} />
            <Card style={{ padding: 4 }}>
              {s.tasks.map((t) => (
                <TaskRow
                  key={t.id}
                  task={t}
                  today={today}
                  onToggle={toggle}
                  showDate={s.key === 'later'}
                  goalTitle={t.goalId ? goalTitles[t.goalId] : undefined}
                />
              ))}
            </Card>
          </View>
        ))}
      </Screen>
      <QuickAddBar onPress={() => router.push('/add')} hint={'Add a task… “Pay rent on Dec 1 !”'} />
    </View>
  );
}
