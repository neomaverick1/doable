import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { DEFAULT_MODEL, type AiConfig } from '@/lib/ai';
import { readApiKey, writeApiKey } from '@/lib/secure';

export interface Settings {
  apiKey: string;
  model: string;
  endpoint: string;
  dayStart: number; // minutes from midnight
  dayEnd: number;
  reminders: boolean;
}

const DEFAULTS: Settings = { apiKey: '', model: DEFAULT_MODEL, endpoint: '', dayStart: 9 * 60, dayEnd: 18 * 60, reminders: true };
const STORAGE_KEY = 'doable:settings:v1';

interface SettingsValue {
  settings: Settings;
  ready: boolean;
  aiEnabled: boolean;
  aiConfig: AiConfig;
  update: (patch: Partial<Settings>) => Promise<void>;
}

const Ctx = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULTS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const [raw, apiKey] = await Promise.all([AsyncStorage.getItem(STORAGE_KEY).catch(() => null), readApiKey()]);
      let saved: Partial<Settings> = {};
      try {
        saved = raw ? JSON.parse(raw) : {};
      } catch {
        saved = {};
      }
      setSettings({ ...DEFAULTS, ...saved, apiKey });
      setReady(true);
    })();
  }, []);

  const latest = useRef<Settings>(DEFAULTS);
  useEffect(() => {
    latest.current = settings;
  }, [settings]);

  const update = useCallback(async (patch: Partial<Settings>) => {
    const next: Settings = { ...latest.current, ...patch };
    latest.current = next;
    setSettings(next);
    if (patch.apiKey !== undefined) await writeApiKey(patch.apiKey);
    const { apiKey: _secret, ...rest } = next;
    void _secret;
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(rest)).catch(() => undefined);
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      ready,
      aiEnabled: !!(settings.apiKey || settings.endpoint),
      aiConfig: { apiKey: settings.apiKey, model: settings.model || DEFAULT_MODEL, endpoint: settings.endpoint || undefined },
      update,
    }),
    [settings, ready, update],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSettings(): SettingsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useSettings must be used inside SettingsProvider');
  return v;
}
