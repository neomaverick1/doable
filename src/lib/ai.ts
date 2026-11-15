import { isISODate, isTime, WEEKDAYS } from './dates';
import type { ISODate, Priority, TaskDraft } from './types';

/**
 * Language-model features use the OpenAI Responses API with function calling:
 * the model must answer by calling `create_tasks`, so the app always gets structured,
 * validated tasks back instead of free text.
 */
export const DEFAULT_MODEL = 'gpt-6-luna';
export const OPENAI_ENDPOINT = 'https://api.openai.com/v1/responses';

export interface AiConfig {
  apiKey: string;
  model: string;
  /** Optional: your own backend that adds the key server side (see server/ai-proxy.mjs). */
  endpoint?: string;
}

export interface AiContext {
  today: ISODate;
  nowTime: string; // HH:mm
  deadline?: ISODate;
}

export type AiMode = 'quick-add' | 'breakdown';

export class AiError extends Error {
  constructor(
    public kind: 'auth' | 'rate' | 'network' | 'server' | 'bad_response' | 'timeout',
    message: string,
  ) {
    super(message);
    this.name = 'AiError';
  }
}

const TASKS_TOOL = {
  type: 'function',
  name: 'create_tasks',
  description: 'Create one or more tasks in the user’s planner.',
  strict: true,
  parameters: {
    type: 'object',
    additionalProperties: false,
    required: ['tasks'],
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'due_date', 'time', 'duration_minutes', 'priority', 'tags'],
          properties: {
            title: { type: 'string', description: 'Short, action-first task title without the date or time.' },
            due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD, or null when no date was given.' },
            time: { type: ['string', 'null'], description: 'HH:MM in 24-hour time, or null.' },
            duration_minutes: { type: ['integer', 'null'], description: 'Expected length in minutes, or null.' },
            priority: { type: 'string', enum: ['low', 'normal', 'high'] },
            tags: { type: 'array', items: { type: 'string' }, description: 'Lowercase single-word tags, no #.' },
          },
        },
      },
    },
  },
} as const;

function instructions(mode: AiMode, ctx: AiContext): string {
  const day = WEEKDAYS[new Date(`${ctx.today}T12:00:00`).getDay()];
  const clock = `Today is ${day}, ${ctx.today}, and the time is ${ctx.nowTime}.`;
  if (mode === 'quick-add') {
    return [
      'You turn what the user types into tasks for their planner.',
      clock,
      'Split separate actions into separate tasks. Resolve relative dates like "tomorrow" or "next Friday" to real dates.',
      'Keep titles short and start them with a verb. Only set a time or duration when the user implies one.',
      'Always answer by calling create_tasks.',
    ].join(' ');
  }
  return [
    'You are a planning assistant. Break the user’s goal into 4 to 8 concrete, doable steps in a sensible order.',
    clock,
    ctx.deadline ? `The goal must be finished by ${ctx.deadline}.` : 'Spread the steps over roughly the next two weeks.',
    'Give every step a due date between tomorrow and the deadline, and an estimated duration. Mark the steps that block others as high priority.',
    'Always answer by calling create_tasks.',
  ].join(' ');
}

export function buildRequest(cfg: AiConfig, mode: AiMode, text: string, ctx: AiContext): { url: string; init: RequestInit } {
  const body = {
    model: cfg.model || DEFAULT_MODEL,
    instructions: instructions(mode, ctx),
    input: text,
    tools: [TASKS_TOOL],
    tool_choice: { type: 'function', name: 'create_tasks' },
    store: false,
  };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers.Authorization = `Bearer ${cfg.apiKey}`;
  return { url: cfg.endpoint || OPENAI_ENDPOINT, init: { method: 'POST', headers, body: JSON.stringify(body) } };
}

/** Pulls the create_tasks call out of a Responses API result and validates every field. */
export function parseResponse(json: unknown): TaskDraft[] {
  const output = (json as { output?: unknown[] })?.output;
  const call = Array.isArray(output)
    ? (output.find(
        (o) => (o as { type?: string; name?: string }).type === 'function_call' && (o as { name?: string }).name === 'create_tasks',
      ) as { arguments?: string } | undefined)
    : undefined;
  if (!call?.arguments) throw new AiError('bad_response', 'The AI answered without creating any tasks. Try rephrasing.');

  let args: { tasks?: unknown[] };
  try {
    args = JSON.parse(call.arguments);
  } catch {
    throw new AiError('bad_response', 'The AI sent back something that could not be read.');
  }
  const tasks = (args.tasks ?? []).map(normalize).filter((t): t is TaskDraft => t !== null);
  if (tasks.length === 0) throw new AiError('bad_response', 'The AI did not find a task in that. Try adding more detail.');
  return tasks.slice(0, 12);
}

function normalize(raw: unknown): TaskDraft | null {
  const r = raw as Record<string, unknown>;
  const title = typeof r?.title === 'string' ? r.title.trim().slice(0, 140) : '';
  if (!title) return null;
  const priority: Priority = r.priority === 'high' || r.priority === 'low' ? r.priority : 'normal';
  const duration =
    typeof r.duration_minutes === 'number' && Number.isFinite(r.duration_minutes) ? Math.round(r.duration_minutes) : undefined;
  return {
    title: title.charAt(0).toUpperCase() + title.slice(1),
    due: isISODate(r.due_date) ? r.due_date : undefined,
    time: isTime(r.time) ? r.time : undefined,
    durationMin: duration && duration >= 5 && duration <= 720 ? duration : undefined,
    priority,
    tags: Array.isArray(r.tags)
      ? [
          ...new Set(
            r.tags
              .filter((t): t is string => typeof t === 'string')
              .map((t) => t.replace(/^#/, '').trim().toLowerCase())
              .filter(Boolean),
          ),
        ].slice(0, 4)
      : [],
  };
}

export async function aiCreateTasks(
  cfg: AiConfig,
  mode: AiMode,
  text: string,
  ctx: AiContext,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 30_000,
): Promise<TaskDraft[]> {
  if (!cfg.apiKey && !cfg.endpoint) throw new AiError('auth', 'Add an OpenAI API key in Settings to use AI.');
  const { url, init } = buildRequest(cfg, mode, text, ctx);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new AiError('timeout', 'The AI took too long to answer. Try again.');
    throw new AiError('network', 'Could not reach the AI service. Check your connection.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) throw new AiError('auth', 'That API key was not accepted. Check it in Settings.');
  if (res.status === 429) throw new AiError('rate', 'The AI service is busy or your quota is used up. Try again in a minute.');
  if (!res.ok) throw new AiError('server', `The AI service returned an error (${res.status}).`);
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new AiError('bad_response', 'The AI service sent back something that could not be read.');
  }
  return parseResponse(json);
}
