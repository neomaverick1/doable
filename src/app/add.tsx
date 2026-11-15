import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, ModalHeader, Screen, TagChip } from '@/components/ui';
import { aiCreateTasks, AiError } from '@/lib/ai';
import { addDays, dayLabel, formatDuration, formatTime, minToTime } from '@/lib/dates';
import { describeRepeat, parseTask } from '@/lib/parse';
import type { TaskDraft } from '@/lib/types';
import { useSettings } from '@/state/settings';
import { useTasks } from '@/state/tasks';
import { useNowMinutes } from '@/state/useToday';
import { colors, radius, space, type } from '@/theme';

const EXAMPLES = [
  'Call the dentist Friday at 3pm',
  'Gym tomorrow 7am for 1h #health',
  'Standup every weekday at 9:30 for 15 min #work',
  'Pay rent on Dec 1 !',
  'Buy milk and eggs tonight, and book a haircut for Saturday morning',
];

type When = 'today' | 'tomorrow' | 'none';

export default function AddScreen() {
  const params = useLocalSearchParams<{ text?: string }>();
  const { addDrafts, today } = useTasks();
  const { aiEnabled, aiConfig } = useSettings();
  const nowMin = useNowMinutes();
  const [text, setText] = useState(params.text ?? '');
  const [useAi, setUseAi] = useState(aiEnabled);
  const [when, setWhen] = useState<When>('today');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiDrafts, setAiDrafts] = useState<TaskDraft[] | null>(null);
  const [inputHeight, setInputHeight] = useState(64);

  const parsed = useMemo(() => {
    if (!text.trim()) return null;
    const ref = new Date(`${today}T${minToTime(nowMin)}:00`);
    return parseTask(text, Number.isNaN(ref.getTime()) ? undefined : ref);
  }, [text, today, nowMin]);

  const draft: TaskDraft | null = parsed
    ? { ...parsed.draft, due: parsed.draft.due ?? (when === 'today' ? today : when === 'tomorrow' ? addDays(today, 1) : undefined) }
    : null;

  const aiOn = aiEnabled && useAi;

  const submit = async () => {
    if (!draft) return;
    setError(null);
    if (!aiOn) {
      addDrafts([draft]);
      router.back();
      return;
    }
    setBusy(true);
    try {
      const drafts = await aiCreateTasks(aiConfig, 'quick-add', text, { today, nowTime: minToTime(nowMin) });
      setAiDrafts(drafts);
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bottomInset={40}>
        <ModalHeader title="New task" onClose={() => router.back()} />

        <Card style={{ gap: space.md }}>
          <TextInput
            value={text}
            onChangeText={(v) => {
              setText(v);
              setAiDrafts(null);
              setError(null);
            }}
            placeholder={'Type it like you’d say it…'}
            placeholderTextColor={colors.faint}
            autoFocus
            multiline
            style={[styles.input, { height: Math.min(160, Math.max(64, inputHeight)) }]}
            onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height + 8)}
            accessibilityLabel="Task"
            onSubmitEditing={submit}
            blurOnSubmit
            returnKeyType="done"
          />
          {aiDrafts ? null : draft ? (
            <View style={{ gap: space.sm }}>
              <Text style={type.label}>Doable understood</Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: colors.ink }}>{draft.title}</Text>
              <View style={styles.chips}>
                {draft.due ? (
                  <Chip
                    icon="calendar-outline"
                    label={dayLabel(draft.due, today)}
                    color={colors.accentDark}
                    background={colors.accentSoft}
                  />
                ) : null}
                {draft.time ? (
                  <Chip icon="time-outline" label={formatTime(draft.time)} color={colors.accentDark} background={colors.accentSoft} />
                ) : null}
                {draft.durationMin ? <Chip icon="hourglass-outline" label={formatDuration(draft.durationMin)} /> : null}
                {draft.repeat ? <Chip icon="repeat" label={describeRepeat(draft.repeat)} /> : null}
                {draft.priority !== 'normal' ? (
                  <Chip
                    icon="flag"
                    label={draft.priority === 'high' ? 'High priority' : 'Low priority'}
                    color={draft.priority === 'high' ? colors.danger : colors.muted}
                  />
                ) : null}
                {draft.tags.map((t) => (
                  <TagChip key={t} tag={t} />
                ))}
              </View>
              {!parsed?.draft.due ? (
                <View style={[styles.chips, { marginTop: 4 }]}>
                  <Text style={[type.small, { marginRight: 4 }]}>No date found:</Text>
                  <Chip label="Today" selected={when === 'today'} onPress={() => setWhen('today')} />
                  <Chip label="Tomorrow" selected={when === 'tomorrow'} onPress={() => setWhen('tomorrow')} />
                  <Chip label="Someday" selected={when === 'none'} onPress={() => setWhen('none')} />
                </View>
              ) : null}
            </View>
          ) : (
            <Text style={type.small}>Dates, times, durations, repeats, #tags and ! for priority are picked up as you type.</Text>
          )}
        </Card>

        {aiEnabled ? (
          <Card style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <View style={[styles.aiIcon]}>
              <Ionicons name="sparkles" size={16} color={colors.ai} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.body}>Understand with AI</Text>
              <Text style={type.small}>Splits several tasks and fills in the details.</Text>
            </View>
            <Switch value={useAi} onValueChange={setUseAi} trackColor={{ true: colors.ai, false: '#DDD8CE' }} thumbColor={colors.white} />
          </Card>
        ) : null}

        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[type.small, { flex: 1, color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {aiDrafts ? (
          <Card style={{ gap: space.md, borderColor: '#D9CFFF' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="sparkles" size={16} color={colors.ai} />
              <Text style={[type.label, { color: colors.ai }]}>
                AI found {aiDrafts.length} task{aiDrafts.length === 1 ? '' : 's'}
              </Text>
            </View>
            {aiDrafts.map((d, i) => (
              <View key={i} style={{ gap: 6 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.ink }}>{d.title}</Text>
                <View style={styles.chips}>
                  {d.due ? (
                    <Chip icon="calendar-outline" label={dayLabel(d.due, today)} />
                  ) : (
                    <Chip icon="calendar-outline" label="No date" />
                  )}
                  {d.time ? <Chip icon="time-outline" label={formatTime(d.time)} /> : null}
                  {d.durationMin ? <Chip icon="hourglass-outline" label={formatDuration(d.durationMin)} /> : null}
                  {d.priority === 'high' ? <Chip icon="flag" label="High" color={colors.danger} /> : null}
                  {d.tags.map((t) => (
                    <TagChip key={t} tag={t} />
                  ))}
                </View>
              </View>
            ))}
            <Button
              label={`Add ${aiDrafts.length} task${aiDrafts.length === 1 ? '' : 's'}`}
              icon="checkmark"
              onPress={() => {
                addDrafts(aiDrafts);
                router.back();
              }}
            />
          </Card>
        ) : (
          <Button
            label={aiOn ? 'Ask AI' : 'Add task'}
            icon={aiOn ? 'sparkles' : 'add'}
            variant={aiOn ? 'ai' : 'primary'}
            onPress={submit}
            loading={busy}
            disabled={!draft}
          />
        )}
        {error && aiOn && draft ? (
          <Button
            label="Add it without AI"
            variant="ghost"
            onPress={() => {
              addDrafts([draft]);
              router.back();
            }}
          />
        ) : null}

        <View style={{ gap: space.sm }}>
          <Text style={type.label}>Try one</Text>
          {EXAMPLES.map((e) => (
            <Pressable
              key={e}
              onPress={() => setText(e)}
              style={({ pressed }) => [styles.example, pressed && { opacity: 0.7 }]}
              accessibilityRole="button"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={16} color={colors.muted} />
              <Text style={[type.body, { flex: 1 }]}>{e}</Text>
            </Pressable>
          ))}
        </View>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
    minHeight: 64,
    textAlignVertical: 'top',
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  aiIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.aiSoft, alignItems: 'center', justifyContent: 'center' },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  example: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
});
