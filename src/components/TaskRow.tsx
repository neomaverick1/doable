import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { dayLabel, diffDays, formatDuration, formatTime } from '@/lib/dates';
import type { Task } from '@/lib/types';
import { colors, space } from '@/theme';

import { TagChip } from './ui';

export const TaskRow = memo(function TaskRow({
  task,
  today,
  onToggle,
  showDate = false,
  goalTitle,
}: {
  task: Task;
  today: string;
  onToggle: (id: string) => void;
  showDate?: boolean;
  goalTitle?: string;
}) {
  const overdue = !task.done && !!task.due && diffDays(task.due, today) < 0;
  const meta: { icon: React.ComponentProps<typeof Ionicons>['name']; text: string; color?: string }[] = [];
  if (showDate && task.due)
    meta.push({ icon: 'calendar-outline', text: dayLabel(task.due, today), color: overdue ? colors.danger : undefined });
  else if (overdue && task.due)
    meta.push({ icon: 'alert-circle-outline', text: `Overdue · ${dayLabel(task.due, today)}`, color: colors.danger });
  if (task.time) meta.push({ icon: 'time-outline', text: formatTime(task.time) });
  if (task.durationMin) meta.push({ icon: 'hourglass-outline', text: formatDuration(task.durationMin) });
  if (task.repeat) meta.push({ icon: 'repeat', text: '' });

  const toggle = () => {
    if (Platform.OS !== 'web')
      Haptics.impactAsync(task.done ? Haptics.ImpactFeedbackStyle.Light : Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    onToggle(task.id);
  };

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/task/[id]', params: { id: task.id } })}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: '#FBFAF7' }]}
      accessibilityRole="button"
      accessibilityLabel={`${task.title}${task.done ? ', done' : ''}`}
    >
      <Pressable
        onPress={toggle}
        hitSlop={10}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.done }}
        accessibilityLabel={task.done ? 'Mark as not done' : 'Mark as done'}
        style={[styles.check, task.priority === 'high' && !task.done && { borderColor: colors.danger }, task.done && styles.checkDone]}
      >
        {task.done ? <Ionicons name="checkmark" size={16} color={colors.white} /> : null}
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={[styles.title, task.done && styles.titleDone]} numberOfLines={2}>
            {task.title}
          </Text>
          {task.priority === 'high' && !task.done ? <Ionicons name="flag" size={13} color={colors.danger} /> : null}
        </View>
        {meta.length || task.tags.length || goalTitle ? (
          <View style={styles.meta}>
            {meta.map((m, i) => (
              <View key={i} style={styles.metaItem}>
                <Ionicons name={m.icon} size={12} color={m.color ?? colors.muted} />
                {m.text ? <Text style={[styles.metaText, m.color ? { color: m.color } : null]}>{m.text}</Text> : null}
              </View>
            ))}
            {task.tags.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
            {goalTitle ? (
              <View style={styles.metaItem}>
                <Ionicons name="flag-outline" size={12} color={colors.ai} />
                <Text style={[styles.metaText, { color: colors.ai }]} numberOfLines={1}>
                  {goalTitle}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingVertical: 12,
    paddingHorizontal: space.md,
    borderRadius: 14,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#C9C4BA',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkDone: { backgroundColor: colors.done, borderColor: colors.done },
  title: { fontSize: 16, fontWeight: '600', color: colors.ink, flexShrink: 1 },
  titleDone: { color: colors.faint, textDecorationLine: 'line-through', fontWeight: '500' },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12.5, color: colors.muted, fontWeight: '500' },
});
