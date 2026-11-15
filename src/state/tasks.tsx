import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { toISODate, minToTime } from '@/lib/dates';
import { demoData } from '@/lib/demo';
import { cancelReminder, ensureReminderPermission, reminderDate, remindersSupported, scheduleReminder } from '@/lib/notifications';
import { nextOccurrence } from '@/lib/parse';
import type { Block } from '@/lib/planner';
import { newId, type Goal, type ISODate, type Task, type TaskDraft } from '@/lib/types';

import { useSettings } from './settings';
import { useToday } from './useToday';

interface State {
  tasks: Task[];
  goals: Goal[];
  ready: boolean;
}

type Action =
  | { type: 'load'; tasks: Task[]; goals: Goal[] }
  | { type: 'add'; tasks: Task[] }
  | { type: 'update'; id: string; patch: Partial<Task> }
  | { type: 'updateMany'; patches: Record<string, Partial<Task>> }
  | { type: 'remove'; id: string }
  | { type: 'addGoal'; goal: Goal; tasks: Task[] }
  | { type: 'removeGoal'; id: string };

function reducer(state: State, a: Action): State {
  switch (a.type) {
    case 'load':
      return { tasks: a.tasks, goals: a.goals, ready: true };
    case 'add':
      return { ...state, tasks: [...state.tasks, ...a.tasks] };
    case 'update':
      return { ...state, tasks: state.tasks.map((t) => (t.id === a.id ? { ...t, ...a.patch } : t)) };
    case 'updateMany':
      return { ...state, tasks: state.tasks.map((t) => (a.patches[t.id] ? { ...t, ...a.patches[t.id] } : t)) };
    case 'remove':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== a.id) };
    case 'addGoal':
      return { ...state, goals: [...state.goals, a.goal], tasks: [...state.tasks, ...a.tasks] };
    case 'removeGoal':
      return { ...state, goals: state.goals.filter((g) => g.id !== a.id), tasks: state.tasks.filter((t) => t.goalId !== a.id) };
  }
}

const DATA_KEY = 'doable:data:v1';
const REMINDERS_KEY = 'doable:reminders:v1';

interface TasksValue extends State {
  today: ISODate;
  addDrafts: (drafts: TaskDraft[], extra?: Partial<Task>) => Task[];
  toggle: (id: string) => void;
  update: (id: string, patch: Partial<Task>) => void;
  remove: (id: string) => void;
  addGoal: (title: string, deadline: ISODate | undefined, steps: TaskDraft[], plannedBy: Goal['plannedBy']) => void;
  removeGoal: (id: string) => void;
  applyPlan: (blocks: Block[]) => void;
  moveToTomorrow: (ids: string[]) => void;
  resetDemo: () => void;
  clearAll: () => void;
}

const Ctx = createContext<TasksValue | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { tasks: [], goals: [], ready: false });
  const { settings, ready: settingsReady } = useSettings();
  const today = useToday();

  // Load saved data, or seed the demo on first launch.
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(DATA_KEY).catch(() => null);
      if (raw) {
        try {
          const saved = JSON.parse(raw) as { tasks: Task[]; goals: Goal[] };
          dispatch({ type: 'load', tasks: saved.tasks ?? [], goals: saved.goals ?? [] });
          return;
        } catch {
          // fall through to demo data
        }
      }
      const demo = demoData(toISODate(new Date()));
      dispatch({ type: 'load', ...demo });
    })();
  }, []);

  // Persist every change.
  useEffect(() => {
    if (!state.ready) return;
    AsyncStorage.setItem(DATA_KEY, JSON.stringify({ tasks: state.tasks, goals: state.goals })).catch(() => undefined);
  }, [state]);

  // Keep device reminders in step with the tasks.
  const reminders = useRef<Record<string, { id: string; key: string }> | null>(null);
  useEffect(() => {
    if (!state.ready || !settingsReady || !remindersSupported) return;
    let cancelled = false;
    (async () => {
      if (!reminders.current) {
        const raw = await AsyncStorage.getItem(REMINDERS_KEY).catch(() => null);
        reminders.current = raw ? JSON.parse(raw) : {};
      }
      const map = reminders.current!;
      const wanted = new Map<string, Task>();
      if (settings.reminders) for (const t of state.tasks) if (reminderDate(t)) wanted.set(t.id, t);
      if (wanted.size && !(await ensureReminderPermission())) wanted.clear();
      for (const [taskId, r] of Object.entries(map)) {
        const t = wanted.get(taskId);
        if (!t || r.key !== `${t.due}T${t.time}|${t.title}`) {
          await cancelReminder(r.id);
          delete map[taskId];
        }
      }
      for (const [taskId, t] of wanted) {
        if (cancelled) return;
        if (map[taskId]) continue;
        const id = await scheduleReminder(t);
        if (id) map[taskId] = { id, key: `${t.due}T${t.time}|${t.title}` };
      }
      await AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(map)).catch(() => undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [state.tasks, state.ready, settings.reminders, settingsReady]);

  const tasksRef = useRef(state.tasks);
  useEffect(() => {
    tasksRef.current = state.tasks;
  }, [state.tasks]);

  const addDrafts = useCallback((drafts: TaskDraft[], extra?: Partial<Task>) => {
    const now = new Date().toISOString();
    const tasks = drafts.map((d, i): Task => ({ ...d, id: newId() + i, done: false, createdAt: now, ...extra }));
    dispatch({ type: 'add', tasks });
    return tasks;
  }, []);

  const toggle = useCallback((id: string) => {
    const t = tasksRef.current.find((x) => x.id === id);
    if (!t) return;
    if (!t.done && t.repeat) {
      // Completing a repeating task schedules its next occurrence.
      const next: Task = {
        ...t,
        id: newId(),
        done: false,
        doneAt: undefined,
        createdAt: new Date().toISOString(),
        due: nextOccurrence(t.repeat, t.due ?? toISODate(new Date())),
      };
      dispatch({ type: 'update', id, patch: { done: true, doneAt: new Date().toISOString(), repeat: undefined } });
      dispatch({ type: 'add', tasks: [next] });
      return;
    }
    dispatch({ type: 'update', id, patch: { done: !t.done, doneAt: t.done ? undefined : new Date().toISOString() } });
  }, []);

  const update = useCallback((id: string, patch: Partial<Task>) => dispatch({ type: 'update', id, patch }), []);
  const remove = useCallback((id: string) => dispatch({ type: 'remove', id }), []);

  const addGoal = useCallback((title: string, deadline: ISODate | undefined, steps: TaskDraft[], plannedBy: Goal['plannedBy']) => {
    const goal: Goal = { id: newId(), title, deadline, createdAt: new Date().toISOString(), plannedBy };
    const now = new Date().toISOString();
    const tasks = steps.map((d, i): Task => ({ ...d, id: newId() + i, done: false, createdAt: now, goalId: goal.id }));
    dispatch({ type: 'addGoal', goal, tasks });
  }, []);

  const removeGoal = useCallback((id: string) => dispatch({ type: 'removeGoal', id }), []);

  const applyPlan = useCallback((blocks: Block[]) => {
    const patches: Record<string, Partial<Task>> = {};
    for (const b of blocks)
      if (!b.fixed) patches[b.taskId] = { time: minToTime(b.start), durationMin: b.end - b.start, due: toISODate(new Date()) };
    dispatch({ type: 'updateMany', patches });
  }, []);

  const moveToTomorrow = useCallback((ids: string[]) => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const patches: Record<string, Partial<Task>> = {};
    for (const id of ids) patches[id] = { due: toISODate(d), time: undefined };
    dispatch({ type: 'updateMany', patches });
  }, []);

  const resetDemo = useCallback(() => dispatch({ type: 'load', ...demoData(toISODate(new Date())) }), []);
  const clearAll = useCallback(() => dispatch({ type: 'load', tasks: [], goals: [] }), []);

  const value = useMemo<TasksValue>(
    () => ({ ...state, today, addDrafts, toggle, update, remove, addGoal, removeGoal, applyPlan, moveToTomorrow, resetDemo, clearAll }),
    [state, today, addDrafts, toggle, update, remove, addGoal, removeGoal, applyPlan, moveToTomorrow, resetDemo, clearAll],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTasks(): TasksValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTasks must be used inside TasksProvider');
  return v;
}
