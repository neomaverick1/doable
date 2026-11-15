import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { Button, Card, Screen } from '@/components/ui';
import { aiCreateTasks, AiError, DEFAULT_MODEL } from '@/lib/ai';
import { minToTime, formatTime } from '@/lib/dates';
import { remindersSupported } from '@/lib/notifications';
import { useSettings } from '@/state/settings';
import { useTasks } from '@/state/tasks';
import { colors, radius, space, type } from '@/theme';

export default function SettingsScreen() {
  const { settings, update } = useSettings();
  const { resetDemo, clearAll } = useTasks();

  const step = (field: 'dayStart' | 'dayEnd', delta: number) => {
    const v = Math.min(23 * 60, Math.max(5 * 60, settings[field] + delta));
    if (field === 'dayStart' && v >= settings.dayEnd - 60) return;
    if (field === 'dayEnd' && v <= settings.dayStart + 60) return;
    update({ [field]: v });
  };

  return (
    <Screen bottomInset={48}>
      <View style={{ gap: 2 }}>
        <Text style={type.label}>Doable 1.0</Text>
        <Text style={type.hero}>Settings</Text>
      </View>

      <AiCard key={`${settings.apiKey}|${settings.model}|${settings.endpoint}`} />

      <Card style={{ gap: space.md }}>
        <Text style={type.h2}>Planning</Text>
        <Stepper
          label="Day starts"
          value={formatTime(minToTime(settings.dayStart))}
          onMinus={() => step('dayStart', -30)}
          onPlus={() => step('dayStart', 30)}
        />
        <Stepper
          label="Day ends"
          value={formatTime(minToTime(settings.dayEnd))}
          onMinus={() => step('dayEnd', -30)}
          onPlus={() => step('dayEnd', 30)}
        />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={type.body}>Reminders</Text>
            <Text style={type.small}>
              {remindersSupported ? 'A notification when a timed task starts.' : 'Available in the iPhone and Android apps.'}
            </Text>
          </View>
          <Switch
            value={settings.reminders && remindersSupported}
            disabled={!remindersSupported}
            onValueChange={(v) => update({ reminders: v })}
            trackColor={{ true: colors.accent, false: '#DDD8CE' }}
            thumbColor={colors.white}
          />
        </View>
      </Card>

      <Card style={{ gap: space.sm }}>
        <Text style={type.h2}>Data</Text>
        <Text style={type.small}>Everything is saved on this device.</Text>
        <Button label="Load the sample data again" icon="refresh" variant="secondary" onPress={resetDemo} />
        <Button label="Start empty" icon="trash-outline" variant="danger" onPress={clearAll} />
      </Card>
    </Screen>
  );
}

function AiCard() {
  const { settings, update, aiEnabled, aiConfig } = useSettings();
  const { today } = useTasks();
  const [key, setKey] = useState(settings.apiKey);
  const [model, setModel] = useState(settings.model);
  const [endpoint, setEndpoint] = useState(settings.endpoint);
  const [showKey, setShowKey] = useState(false);
  const [test, setTest] = useState<{ state: 'idle' | 'running' | 'ok' | 'error'; message?: string }>({ state: 'idle' });

  const dirty = key !== settings.apiKey || model !== settings.model || endpoint !== settings.endpoint;

  const save = async () => {
    await update({ apiKey: key.trim(), model: model.trim() || DEFAULT_MODEL, endpoint: endpoint.trim() });
    setTest({ state: 'idle' });
  };

  const runTest = async () => {
    setTest({ state: 'running' });
    const started = Date.now();
    try {
      const tasks = await aiCreateTasks(aiConfig, 'quick-add', 'water the plants tomorrow at 8am', { today, nowTime: '12:00' });
      setTest({
        state: 'ok',
        message: `Working. The model answered in ${((Date.now() - started) / 1000).toFixed(1)} s with “${tasks[0].title}”.`,
      });
    } catch (e) {
      setTest({ state: 'error', message: e instanceof AiError ? e.message : 'Something went wrong.' });
    }
  };

  return (
    <Card style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Ionicons name="sparkles" size={18} color={colors.ai} />
        <Text style={[type.h2, { flex: 1 }]}>AI assistant</Text>
        <View style={[styles.pill, { backgroundColor: aiEnabled ? colors.doneSoft : '#F1EEE8' }]}>
          <View style={[styles.dot, { backgroundColor: aiEnabled ? colors.done : colors.faint }]} />
          <Text style={{ fontSize: 12, fontWeight: '800', color: aiEnabled ? colors.done : colors.muted }}>{aiEnabled ? 'On' : 'Off'}</Text>
        </View>
      </View>
      <Text style={type.small}>
        Doable understands dates on its own. With an OpenAI API key it can also split a sentence into several tasks and turn goals into
        dated plans.
      </Text>

      <Text style={type.label}>OpenAI API key</Text>
      <View style={styles.inputRow}>
        <TextInput
          value={key}
          onChangeText={setKey}
          placeholder="sk-…"
          placeholderTextColor={colors.faint}
          secureTextEntry={!showKey}
          autoCapitalize="none"
          autoCorrect={false}
          style={styles.input}
          accessibilityLabel="OpenAI API key"
        />
        <Pressable
          onPress={() => setShowKey((v) => !v)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={showKey ? 'Hide key' : 'Show key'}
        >
          <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.muted} />
        </Pressable>
      </View>

      <Text style={type.label}>Model</Text>
      <TextInput
        value={model}
        onChangeText={setModel}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, styles.box]}
        accessibilityLabel="Model"
      />

      <Text style={type.label}>Your backend (optional)</Text>
      <TextInput
        value={endpoint}
        onChangeText={setEndpoint}
        placeholder="https://api.yourapp.com/ai"
        placeholderTextColor={colors.faint}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, styles.box]}
        accessibilityLabel="Backend URL"
      />
      <Text style={type.small}>
        {Platform.OS === 'web'
          ? 'The key is kept in this browser only.'
          : 'The key is kept in the phone’s secure storage (Keychain / Keystore).'}{' '}
        In a production app the key lives on your server: point this at a backend like server/ai-proxy.mjs and leave the key empty.
      </Text>

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Save" icon="checkmark" onPress={save} disabled={!dirty} style={{ flex: 1 }} />
        <Button
          label="Test"
          icon="flash-outline"
          variant="secondary"
          onPress={runTest}
          loading={test.state === 'running'}
          disabled={!aiEnabled || dirty}
          style={{ flex: 1 }}
        />
      </View>
      {test.state === 'ok' || test.state === 'error' ? (
        <View style={[styles.note, { backgroundColor: test.state === 'ok' ? colors.doneSoft : colors.dangerSoft }]}>
          <Ionicons
            name={test.state === 'ok' ? 'checkmark-circle' : 'alert-circle'}
            size={18}
            color={test.state === 'ok' ? colors.done : colors.danger}
          />
          <Text style={[type.small, { flex: 1, color: test.state === 'ok' ? '#0B6B55' : colors.danger }]}>{test.message}</Text>
        </View>
      ) : null}
    </Card>
  );
}

function Stepper({ label, value, onMinus, onPlus }: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={[type.body, { flex: 1 }]}>{label}</Text>
      <Pressable onPress={onMinus} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} earlier`}>
        <Ionicons name="remove" size={18} color={colors.ink} />
      </Pressable>
      <Text style={{ width: 84, textAlign: 'center', fontWeight: '700', color: colors.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Pressable onPress={onPlus} style={styles.stepBtn} accessibilityRole="button" accessibilityLabel={`${label} later`}>
        <Ionicons name="add" size={18} color={colors.ink} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: '#FCFBF8',
  },
  input: { flex: 1, minHeight: 46, fontSize: 15, color: colors.ink },
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    backgroundColor: '#FCFBF8',
    flex: 0,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.md },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
