import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Chip, EmptyState, ModalHeader, Screen } from '@/components/ui';
import { formatDuration, formatTime, minToTime } from '@/lib/dates';
import { planDay } from '@/lib/planner';
import { useSettings } from '@/state/settings';
import { useTasks } from '@/state/tasks';
import { useNowMinutes } from '@/state/useToday';
import { colors, radius, space, tagColor, type } from '@/theme';

export default function PlanScreen() {
  const { tasks, today, applyPlan, moveToTomorrow } = useTasks();
  const { settings } = useSettings();
  const nowMin = useNowMinutes();

  const plan = useMemo(
    () => planDay(tasks, { today, dayStart: settings.dayStart, dayEnd: settings.dayEnd, nowMin }),
    [tasks, today, settings.dayStart, settings.dayEnd, nowMin],
  );
  const byId = useMemo(() => Object.fromEntries(tasks.map((t) => [t.id, t])), [tasks]);
  const flexible = plan.blocks.filter((b) => !b.fixed).length;

  return (
    <Screen bottomInset={48}>
      <ModalHeader title="Plan my day" onClose={() => router.back()} />

      <View style={{ gap: 6 }}>
        <Text style={type.title}>Your day</Text>
        <Text style={type.small}>
          Booked tasks stay where they are. Everything else is placed in the free time between {formatTime(minToTime(settings.dayStart))}{' '}
          and {formatTime(minToTime(settings.dayEnd))}, most important first.
        </Text>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
        <Chip icon="list-outline" label={`${plan.blocks.length} blocks`} />
        <Chip icon="sparkles" label={`${flexible} placed for you`} color={colors.ai} background={colors.aiSoft} />
        <Chip
          icon="cafe-outline"
          label={`${formatDuration(Math.max(0, plan.freeMinutes))} free`}
          color={colors.done}
          background={colors.doneSoft}
        />
      </View>

      {plan.blocks.length === 0 ? (
        <EmptyState icon="sunny-outline" title="Nothing to plan" message="Every task for today is done or has no date." />
      ) : null}

      <View>
        {plan.blocks.map((b, i) => {
          const t = byId[b.taskId];
          if (!t) return null;
          const accent = b.fixed ? colors.muted : t.priority === 'high' ? colors.danger : colors.accent;
          return (
            <View key={b.taskId} style={{ flexDirection: 'row', gap: space.md }}>
              <View style={{ width: 64, alignItems: 'flex-end', paddingTop: 12 }}>
                <Text style={styles.time}>{formatTime(minToTime(b.start))}</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <View style={[styles.dot, { backgroundColor: accent }]} />
                {i < plan.blocks.length - 1 ? <View style={styles.line} /> : null}
              </View>
              <View style={[styles.block, { borderLeftColor: accent, minHeight: Math.max(58, Math.min(130, (b.end - b.start) * 1.1)) }]}>
                <Text style={{ fontSize: 15.5, fontWeight: '700', color: colors.ink }} numberOfLines={2}>
                  {t.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <Text style={type.small}>
                    {formatTime(minToTime(b.start))} {'–'} {formatTime(minToTime(b.end))} · {formatDuration(b.end - b.start)}
                  </Text>
                  {b.fixed ? (
                    <View style={[styles.badge, { backgroundColor: '#F1EEE8' }]}>
                      <Ionicons name="lock-closed" size={10} color={colors.muted} />
                      <Text style={[styles.badgeText, { color: colors.muted }]}>Booked</Text>
                    </View>
                  ) : (
                    <View style={[styles.badge, { backgroundColor: colors.aiSoft }]}>
                      <Ionicons name="sparkles" size={10} color={colors.ai} />
                      <Text style={[styles.badgeText, { color: colors.ai }]}>Planned</Text>
                    </View>
                  )}
                  {t.tags.slice(0, 1).map((tag) => (
                    <Text key={tag} style={{ color: tagColor(tag), fontSize: 12, fontWeight: '700' }}>
                      #{tag}
                    </Text>
                  ))}
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {plan.overflow.length ? (
        <Card style={{ gap: space.sm, backgroundColor: colors.warnSoft, borderColor: '#F5DDB3' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="alert-circle-outline" size={18} color={colors.warn} />
            <Text style={[type.h2, { color: '#8A5A0E' }]}>Didn{'’'}t fit today</Text>
          </View>
          {plan.overflow.map((id) => (
            <Text key={id} style={type.body}>
              {'•'} {byId[id]?.title}
            </Text>
          ))}
          <Button label="Move these to tomorrow" variant="secondary" icon="arrow-forward" onPress={() => moveToTomorrow(plan.overflow)} />
        </Card>
      ) : null}

      {flexible ? (
        <Button
          label="Apply this plan"
          icon="checkmark-circle"
          onPress={() => {
            applyPlan(plan.blocks);
            router.back();
          }}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  time: { fontSize: 12.5, fontWeight: '700', color: colors.muted, fontVariant: ['tabular-nums'] },
  dot: { width: 12, height: 12, borderRadius: 6, marginTop: 15, borderWidth: 2, borderColor: colors.bg },
  line: { width: 2, flex: 1, backgroundColor: colors.border, marginVertical: 2 },
  block: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: radius.md,
    padding: space.md,
    marginBottom: space.sm,
    gap: 6,
    borderLeftWidth: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill },
  badgeText: { fontSize: 10.5, fontWeight: '800' },
});
