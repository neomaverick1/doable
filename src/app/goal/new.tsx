import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Chip, ModalHeader, Screen } from '@/components/ui';
import { aiCreateTasks, AiError } from '@/lib/ai';
import { addDays, dayLabel, formatDuration, minToTime } from '@/lib/dates';
import { quickBreakdown } from '@/lib/planner';
import type { TaskDraft } from '@/lib/types';
import { useSettings } from '@/state/settings';
import { useTasks } from '@/state/tasks';
import { useNowMinutes } from '@/state/useToday';
import { colors, radius, space, type } from '@/theme';

const DEADLINES = [
  { key: '1w', label: '1 week', days: 7 },
  { key: '2w', label: '2 weeks', days: 14 },
  { key: '1m', label: '1 month', days: 30 },
  { key: 'none', label: 'No deadline', days: 0 },
] as const;
const EXAMPLES = ['Launch my bakery website', 'Plan a trip to Japan', 'Pass the AWS Cloud Practitioner exam', 'Run my first 10K'];

type Step = TaskDraft & { keep: boolean };

export default function NewGoalScreen() {
  const { today, addGoal } = useTasks();
  const { aiEnabled, aiConfig } = useSettings();
  const nowMin = useNowMinutes();
  const [goal, setGoal] = useState('');
  const [deadlineKey, setDeadlineKey] = useState<(typeof DEADLINES)[number]['key']>('2w');
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [by, setBy] = useState<'ai' | 'quick'>('quick');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = DEADLINES.find((d) => d.key === deadlineKey)!.days;
  const deadline = days ? addDays(today, days) : undefined;

  const run = async (mode: 'ai' | 'quick') => {
    setError(null);
    if (mode === 'quick') {
      setSteps(quickBreakdown(goal, today, deadline).map((s) => ({ ...s, keep: true })));
      setBy('quick');
      return;
    }
    setBusy(true);
    try {
      const drafts = await aiCreateTasks(aiConfig, 'breakdown', goal.trim(), { today, nowTime: minToTime(nowMin), deadline });
      setSteps(drafts.map((s) => ({ ...s, keep: true })));
      setBy('ai');
    } catch (e) {
      setError(e instanceof AiError ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const kept = steps?.filter((s) => s.keep) ?? [];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen bottomInset={48}>
        <ModalHeader title="New goal" onClose={() => router.back()} />

        <Card style={{ gap: space.md }}>
          <Text style={type.label}>What do you want to get done?</Text>
          <TextInput
            value={goal}
            onChangeText={(v) => {
              setGoal(v);
              setSteps(null);
            }}
            placeholder="Launch my bakery website"
            placeholderTextColor={colors.faint}
            style={styles.input}
            autoFocus
            accessibilityLabel="Goal"
          />
          <Text style={type.label}>By when?</Text>
          <View style={styles.chips}>
            {DEADLINES.map((d) => (
              <Chip
                key={d.key}
                label={d.label}
                selected={deadlineKey === d.key}
                onPress={() => {
                  setDeadlineKey(d.key);
                  setSteps(null);
                }}
              />
            ))}
          </View>
          {deadline ? <Text style={type.small}>Deadline: {dayLabel(deadline, today)}</Text> : null}
        </Card>

        {!steps ? (
          <View style={{ gap: space.sm }}>
            {aiEnabled ? (
              <Button
                label="Break it down with AI"
                icon="sparkles"
                variant="ai"
                onPress={() => run('ai')}
                loading={busy}
                disabled={!goal.trim()}
              />
            ) : null}
            <Button
              label={aiEnabled ? 'Quick plan without AI' : 'Make a quick plan'}
              icon="flash-outline"
              variant={aiEnabled ? 'secondary' : 'primary'}
              onPress={() => run('quick')}
              disabled={!goal.trim() || busy}
            />
            {!aiEnabled ? (
              <Text style={[type.small, { textAlign: 'center' }]}>
                Add an OpenAI key in Settings for plans written for your exact goal.
              </Text>
            ) : null}
          </View>
        ) : null}

        {error ? (
          <View style={styles.error}>
            <Ionicons name="alert-circle" size={18} color={colors.danger} />
            <Text style={[type.small, { flex: 1, color: colors.danger }]}>{error}</Text>
          </View>
        ) : null}

        {steps ? (
          <Card style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name={by === 'ai' ? 'sparkles' : 'flash'} size={15} color={by === 'ai' ? colors.ai : colors.accent} />
              <Text style={[type.label, { color: by === 'ai' ? colors.ai : colors.accentDark }]}>
                {by === 'ai' ? 'AI plan' : 'Quick plan'} · {steps.length} steps
              </Text>
            </View>
            {steps.map((s, i) => (
              <Pressable
                key={i}
                onPress={() => setSteps(steps.map((x, j) => (j === i ? { ...x, keep: !x.keep } : x)))}
                style={styles.step}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: s.keep }}
              >
                <View style={[styles.box, s.keep && styles.boxOn]}>
                  {s.keep ? <Ionicons name="checkmark" size={14} color={colors.white} /> : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={[{ fontSize: 15.5, fontWeight: '600', color: colors.ink }, !s.keep && { color: colors.faint }]}>
                    {s.title}
                  </Text>
                  <Text style={type.small}>
                    {s.due ? dayLabel(s.due, today) : 'No date'}
                    {s.durationMin ? ` · ${formatDuration(s.durationMin)}` : ''}
                    {s.priority === 'high' ? ' · high priority' : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
            <Button
              label={`Add goal with ${kept.length} step${kept.length === 1 ? '' : 's'}`}
              icon="checkmark"
              disabled={!kept.length}
              onPress={() => {
                addGoal(
                  goal.trim(),
                  deadline,
                  kept.map(({ keep: _k, ...d }) => d),
                  by,
                );
                router.back();
              }}
            />
            <Button label="Start over" variant="ghost" onPress={() => setSteps(null)} />
          </Card>
        ) : (
          <View style={{ gap: space.sm }}>
            <Text style={type.label}>Ideas</Text>
            <View style={styles.chips}>
              {EXAMPLES.map((e) => (
                <Chip key={e} label={e} onPress={() => setGoal(e)} />
              ))}
            </View>
          </View>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    fontSize: 19,
    fontWeight: '600',
    color: colors.ink,
    minHeight: 48,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as never } : null),
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  error: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
  },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#C9C4BA', alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
});
