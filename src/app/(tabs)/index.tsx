import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TaskRow } from '@/components/TaskRow';
import { Card, EmptyState, ProgressRing, QuickAddBar, Screen, SectionTitle } from '@/components/ui';
import { diffDays, formatDuration, fromISODate, longDate, timeToMin } from '@/lib/dates';
import type { Task } from '@/lib/types';
import { useSettings } from '@/state/settings';
import { useTasks } from '@/state/tasks';
import { colors, radius, space, type } from '@/theme';

const PRIORITY = { high: 0, normal: 1, low: 2 } as const;

function byTimeThenPriority(a: Task, b: Task) {
  if (a.time && b.time) return timeToMin(a.time) - timeToMin(b.time);
  if (a.time) return -1;
  if (b.time) return 1;
  return PRIORITY[a.priority] - PRIORITY[b.priority] || a.createdAt.localeCompare(b.createdAt);
}

export default function TodayScreen() {
  const { tasks, goals, today, toggle, ready } = useTasks();
  const { aiEnabled } = useSettings();
  const [showDone, setShowDone] = useState(false);

  const goalTitles = useMemo(() => Object.fromEntries(goals.map((g) => [g.id, g.title])), [goals]);
  const { overdue, todays, done, openMinutes } = useMemo(() => {
    const overdue = tasks.filter((t) => !t.done && t.due && diffDays(t.due, today) < 0).sort(byTimeThenPriority);
    const todays = tasks.filter((t) => !t.done && t.due === today).sort(byTimeThenPriority);
    const done = tasks.filter(
      (t) => t.done && t.doneAt && t.due && diffDays(t.due, today) <= 0 && diffDays(t.doneAt.slice(0, 10), today) >= -1,
    );
    const openMinutes = [...overdue, ...todays].reduce((s, t) => s + (t.durationMin ?? 30), 0);
    return { overdue, todays, done, openMinutes };
  }, [tasks, today]);

  const total = overdue.length + todays.length + done.length;
  const open = overdue.length + todays.length;

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ gap: 2 }}>
            <Text style={type.label}>{longDate(fromISODate(today))}</Text>
            <Text style={type.hero}>Today</Text>
          </View>
          <ProgressRing done={done.length} total={total} />
        </View>

        <Pressable
          onPress={() => router.push('/plan')}
          accessibilityRole="button"
          accessibilityLabel="Plan my day"
          style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[colors.ai, colors.aiPink]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ borderRadius: radius.lg, padding: space.lg, gap: 6 }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles" size={18} color={colors.white} />
              <Text style={{ color: colors.white, fontSize: 17, fontWeight: '800' }}>Plan my day</Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </View>
            <Text style={{ color: '#F3EEFF', fontSize: 14, lineHeight: 20 }}>
              {open
                ? `Fit your ${open} open task${open === 1 ? '' : 's'} (about ${formatDuration(openMinutes)}) around what’s already booked.`
                : 'Nothing left for today. Enjoy the free time.'}
            </Text>
          </LinearGradient>
        </Pressable>

        {ready && total === 0 ? (
          <EmptyState icon="sunny-outline" title="A clear day" message={'Add a task below. Try “Call the dentist Friday at 3pm”.'} />
        ) : null}

        {overdue.length ? (
          <View style={{ gap: space.sm }}>
            <SectionTitle title={`Overdue · ${overdue.length}`} tone="danger" />
            <Card style={{ padding: 4 }}>
              {overdue.map((t) => (
                <TaskRow key={t.id} task={t} today={today} onToggle={toggle} goalTitle={t.goalId ? goalTitles[t.goalId] : undefined} />
              ))}
            </Card>
          </View>
        ) : null}

        {todays.length ? (
          <View style={{ gap: space.sm }}>
            <SectionTitle title={`Today · ${todays.length}`} />
            <Card style={{ padding: 4 }}>
              {todays.map((t) => (
                <TaskRow key={t.id} task={t} today={today} onToggle={toggle} goalTitle={t.goalId ? goalTitles[t.goalId] : undefined} />
              ))}
            </Card>
          </View>
        ) : null}

        {done.length ? (
          <View style={{ gap: space.sm }}>
            <SectionTitle
              title={`Done · ${done.length}`}
              right={
                <Pressable onPress={() => setShowDone((v) => !v)} hitSlop={8} accessibilityRole="button">
                  <Text style={{ color: colors.accent, fontWeight: '700' }}>{showDone ? 'Hide' : 'Show'}</Text>
                </Pressable>
              }
            />
            {showDone ? (
              <Card style={{ padding: 4 }}>
                {done.map((t) => (
                  <TaskRow key={t.id} task={t} today={today} onToggle={toggle} />
                ))}
              </Card>
            ) : null}
          </View>
        ) : null}

        {!aiEnabled ? (
          <Pressable onPress={() => router.push('/settings')} accessibilityRole="button">
            <Card
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.aiSoft, borderColor: '#DCD3FF' }}
            >
              <Ionicons name="key-outline" size={20} color={colors.ai} />
              <Text style={[type.small, { flex: 1, color: '#4B3AB5' }]}>
                Works offline as is. Add an OpenAI key in Settings to let AI split sentences into tasks and plan goals.
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.ai} />
            </Card>
          </Pressable>
        ) : null}
      </Screen>
      <QuickAddBar onPress={() => router.push('/add')} hint={'Add a task… “Gym tomorrow 7am for 1h”'} />
    </View>
  );
}
