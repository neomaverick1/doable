import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, EmptyState, ModalHeader, Screen } from '@/components/ui';
import { addDays, dayLabel, formatDuration, formatTime, minToTime, timeToMin } from '@/lib/dates';
import { describeRepeat } from '@/lib/parse';
import type { Priority, Task } from '@/lib/types';
import { useTasks } from '@/state/tasks';
import { colors, radius, space, type } from '@/theme';

const TIMES = ['08:00', '09:00', '12:00', '15:00', '18:00', '20:00'];
const DURATIONS = [15, 30, 45, 60, 90, 120];

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, goals, today, update, remove, toggle } = useTasks();
  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <Screen>
        <ModalHeader title="Task" onClose={() => router.back()} />
        <EmptyState icon="help-circle-outline" title="Task not found" message="It may have been deleted." />
      </Screen>
    );
  }
  return (
    <Editor
      key={task.id}
      task={task}
      today={today}
      goalTitle={goals.find((g) => g.id === task.goalId)?.title}
      update={update}
      remove={remove}
      toggle={toggle}
    />
  );
}

function Editor({
  task,
  today,
  goalTitle,
  update,
  remove,
  toggle,
}: {
  task: Task;
  today: string;
  goalTitle?: string;
  update: (id: string, patch: Partial<Task>) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');
  const [tags, setTags] = useState(task.tags.map((t) => `#${t}`).join(' '));
  const set = (patch: Partial<Task>) => update(task.id, patch);
  const dates: { label: string; value?: string }[] = [
    { label: 'Today', value: today },
    { label: 'Tomorrow', value: addDays(today, 1) },
    { label: 'Next week', value: addDays(today, 7) },
    { label: 'Someday', value: undefined },
  ];

  return (
    <Screen bottomInset={48}>
      <ModalHeader title="Task" onClose={() => router.back()} />

      <Card style={{ gap: space.md }}>
        <TextInput
          value={title}
          onChangeText={setTitle}
          onBlur={() => title.trim() && set({ title: title.trim() })}
          style={styles.title}
          multiline
          accessibilityLabel="Title"
        />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={() => set({ notes: notes.trim() || undefined })}
          placeholder="Notes"
          placeholderTextColor={colors.faint}
          multiline
          style={styles.notes}
          accessibilityLabel="Notes"
        />
        {goalTitle ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name="flag-outline" size={14} color={colors.ai} />
            <Text style={[type.small, { color: colors.ai }]}>Step of {goalTitle}</Text>
          </View>
        ) : null}
      </Card>

      <Card style={{ gap: space.md }}>
        <Row icon="calendar-outline" label="Date" value={task.due ? dayLabel(task.due, today) : 'Someday'} />
        <View style={styles.chips}>
          {dates.map((d) => (
            <Chip
              key={d.label}
              label={d.label}
              selected={task.due === d.value}
              onPress={() => set({ due: d.value, ...(d.value ? {} : { time: undefined }) })}
            />
          ))}
        </View>

        <Row icon="time-outline" label="Time" value={task.time ? formatTime(task.time) : 'Any time'} />
        <View style={styles.chips}>
          <Chip label="Any time" selected={!task.time} onPress={() => set({ time: undefined })} />
          {TIMES.map((t) => (
            <Chip key={t} label={formatTime(t)} selected={task.time === t} onPress={() => set({ time: t, due: task.due ?? today })} />
          ))}
          {task.time ? (
            <>
              <Chip icon="remove" label="15 min" onPress={() => set({ time: minToTime(timeToMin(task.time!) - 15) })} />
              <Chip icon="add" label="15 min" onPress={() => set({ time: minToTime(timeToMin(task.time!) + 15) })} />
            </>
          ) : null}
        </View>

        <Row icon="hourglass-outline" label="Duration" value={task.durationMin ? formatDuration(task.durationMin) : 'Not set'} />
        <View style={styles.chips}>
          {DURATIONS.map((m) => (
            <Chip key={m} label={formatDuration(m)} selected={task.durationMin === m} onPress={() => set({ durationMin: m })} />
          ))}
        </View>

        <Row icon="flag-outline" label="Priority" value={task.priority[0].toUpperCase() + task.priority.slice(1)} />
        <View style={styles.chips}>
          {(['low', 'normal', 'high'] as Priority[]).map((p) => (
            <Chip key={p} label={p[0].toUpperCase() + p.slice(1)} selected={task.priority === p} onPress={() => set({ priority: p })} />
          ))}
        </View>

        <Row icon="pricetag-outline" label="Tags" value="" />
        <TextInput
          value={tags}
          onChangeText={setTags}
          onBlur={() =>
            set({
              tags: [
                ...new Set(
                  tags
                    .split(/[\s,]+/)
                    .map((t) => t.replace(/^#/, '').toLowerCase())
                    .filter(Boolean),
                ),
              ].slice(0, 5),
            })
          }
          placeholder="#work #home"
          placeholderTextColor={colors.faint}
          autoCapitalize="none"
          style={styles.tagInput}
          accessibilityLabel="Tags"
        />

        {task.repeat ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name="repeat" size={16} color={colors.muted} />
            <Text style={[type.body, { flex: 1 }]}>{describeRepeat(task.repeat)}</Text>
            <Chip label="Stop repeating" onPress={() => set({ repeat: undefined })} />
          </View>
        ) : null}
      </Card>

      <Button
        label={task.done ? 'Mark as not done' : 'Mark as done'}
        icon={task.done ? 'arrow-undo' : 'checkmark-circle'}
        onPress={() => {
          toggle(task.id);
          router.back();
        }}
      />
      <Button
        label="Delete task"
        icon="trash-outline"
        variant="danger"
        onPress={() => {
          remove(task.id);
          router.back();
        }}
      />
    </Screen>
  );
}

function Row({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      <Ionicons name={icon} size={17} color={colors.muted} />
      <Text style={[type.body, { flex: 1, fontWeight: '600' }]}>{label}</Text>
      <Text style={[type.body, { color: colors.muted }]}>{value}</Text>
    </View>
  );
}

const web = Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null;
const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '800', color: colors.ink, ...web },
  notes: { fontSize: 15, color: colors.text, minHeight: 44, textAlignVertical: 'top', ...web },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 4 },
  tagInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    minHeight: 44,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: '#FCFBF8',
  },
});
