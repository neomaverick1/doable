import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { TaskRow } from '@/components/TaskRow';
import { Button, Card, EmptyState, Screen } from '@/components/ui';
import { dayLabel } from '@/lib/dates';
import { daysLeft } from '@/lib/demo';
import { useTasks } from '@/state/tasks';
import { colors, radius, space, type } from '@/theme';

export default function GoalsScreen() {
  const { goals, tasks, today, toggle, removeGoal } = useTasks();
  const [open, setOpen] = useState<string | null>(null);

  const cards = useMemo(
    () =>
      goals
        .map((g) => {
          const steps = tasks.filter((t) => t.goalId === g.id).sort((a, b) => (a.due ?? '').localeCompare(b.due ?? ''));
          const done = steps.filter((t) => t.done).length;
          return { goal: g, steps, done, next: steps.find((t) => !t.done) };
        })
        .sort((a, b) => (a.goal.deadline ?? '9999').localeCompare(b.goal.deadline ?? '9999')),
    [goals, tasks],
  );

  return (
    <Screen bottomInset={48}>
      <View style={{ gap: 2 }}>
        <Text style={type.label}>Big things, broken down</Text>
        <Text style={type.hero}>Goals</Text>
      </View>

      <Button label="Break down a new goal" icon="sparkles" variant="ai" onPress={() => router.push('/goal/new')} />

      {cards.length === 0 ? (
        <EmptyState
          icon="flag-outline"
          title="No goals yet"
          message="Give Doable a goal and a deadline and it turns it into dated steps."
        />
      ) : null}

      {cards.map(({ goal, steps, done, next }) => {
        const pct = steps.length ? done / steps.length : 0;
        const expanded = open === goal.id;
        return (
          <Card key={goal.id} style={{ gap: space.md }}>
            <Pressable onPress={() => setOpen(expanded ? null : goal.id)} accessibilityRole="button" style={{ gap: space.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.md }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: colors.ink }}>{goal.title}</Text>
                  <Text style={type.small}>
                    {goal.deadline ? `${dayLabel(goal.deadline, today)} · ${daysLeft(goal.deadline, today)}` : 'No deadline'} · {done} of{' '}
                    {steps.length} steps
                  </Text>
                </View>
                <View style={[badge, { backgroundColor: goal.plannedBy === 'ai' ? colors.aiSoft : colors.accentSoft }]}>
                  <Ionicons
                    name={goal.plannedBy === 'ai' ? 'sparkles' : 'flash-outline'}
                    size={12}
                    color={goal.plannedBy === 'ai' ? colors.ai : colors.accentDark}
                  />
                  <Text style={{ fontSize: 11, fontWeight: '800', color: goal.plannedBy === 'ai' ? colors.ai : colors.accentDark }}>
                    {goal.plannedBy === 'ai' ? 'AI plan' : 'Quick plan'}
                  </Text>
                </View>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: '#EFEBE3', overflow: 'hidden' }}>
                <View
                  style={{
                    height: 8,
                    width: `${Math.round(pct * 100)}%`,
                    backgroundColor: pct >= 1 ? colors.done : colors.accent,
                    borderRadius: 4,
                  }}
                />
              </View>
              {next && !expanded ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Ionicons name="arrow-forward-circle" size={16} color={colors.accent} />
                  <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                    Next: {next.title}
                    {next.due ? <Text style={{ color: colors.muted }}> · {dayLabel(next.due, today)}</Text> : null}
                  </Text>
                </View>
              ) : null}
            </Pressable>
            {expanded ? (
              <View style={{ gap: space.sm }}>
                <View style={{ marginHorizontal: -space.md }}>
                  {steps.map((t) => (
                    <TaskRow key={t.id} task={t} today={today} onToggle={toggle} showDate />
                  ))}
                </View>
                <Button label="Delete goal and its steps" variant="danger" icon="trash-outline" onPress={() => removeGoal(goal.id)} />
              </View>
            ) : null}
          </Card>
        );
      })}
    </Screen>
  );
}

const badge = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  gap: 4,
  paddingHorizontal: 8,
  paddingVertical: 4,
  borderRadius: radius.pill,
};
