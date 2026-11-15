import { aiCreateTasks, AiError, buildRequest, DEFAULT_MODEL, parseResponse } from '@/lib/ai';

const cfg = { apiKey: 'sk-test', model: DEFAULT_MODEL };
const ctx = { today: '2026-11-15', nowTime: '10:00' };

const okResponse = (tasks: unknown[]) => ({
  output: [
    { type: 'reasoning', id: 'rs_1' },
    { type: 'function_call', name: 'create_tasks', call_id: 'call_1', arguments: JSON.stringify({ tasks }) },
  ],
});

const fakeFetch = (status: number, body: unknown) =>
  jest.fn(async () => ({ status, ok: status >= 200 && status < 300, json: async () => body }) as unknown as Response);

describe('request', () => {
  test('forces the create_tasks tool with a strict schema', () => {
    const { url, init } = buildRequest(cfg, 'quick-add', 'gym tomorrow', ctx);
    const body = JSON.parse(String(init.body));
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(body.tool_choice).toEqual({ type: 'function', name: 'create_tasks' });
    expect(body.tools[0]).toMatchObject({ type: 'function', name: 'create_tasks', strict: true });
    const item = body.tools[0].parameters.properties.tasks.items;
    expect(item.additionalProperties).toBe(false);
    expect(item.required.sort()).toEqual(Object.keys(item.properties).sort());
    expect(body.instructions).toContain('Sunday, 2026-11-15');
  });

  test('a backend proxy URL is used without sending a key', () => {
    const { url, init } = buildRequest({ apiKey: '', model: DEFAULT_MODEL, endpoint: 'https://api.example.com/ai' }, 'breakdown', 'x', ctx);
    expect(url).toBe('https://api.example.com/ai');
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});

describe('response', () => {
  test('validates and cleans every field', () => {
    const tasks = parseResponse(
      okResponse([
        { title: 'buy milk', due_date: '2026-11-16', time: '18:00', duration_minutes: 20, priority: 'high', tags: ['#Home', 'home'] },
        { title: 'Bad fields', due_date: '16/11/2026', time: '7pm', duration_minutes: 9999, priority: 'urgent', tags: [1, 'ok'] },
        { title: '   ', due_date: null, time: null, duration_minutes: null, priority: 'low', tags: [] },
      ]),
    );
    expect(tasks).toEqual([
      { title: 'Buy milk', due: '2026-11-16', time: '18:00', durationMin: 20, priority: 'high', tags: ['home'] },
      { title: 'Bad fields', due: undefined, time: undefined, durationMin: undefined, priority: 'normal', tags: ['ok'] },
    ]);
  });

  test('an answer without the tool call is an error', () => {
    expect(() => parseResponse({ output: [{ type: 'message', content: [] }] })).toThrow(AiError);
  });
});

describe('errors', () => {
  test.each([
    [401, 'auth'],
    [429, 'rate'],
    [500, 'server'],
  ])('HTTP %i becomes %s', async (status, kind) => {
    await expect(aiCreateTasks(cfg, 'quick-add', 'x', ctx, fakeFetch(status, {}))).rejects.toMatchObject({ kind });
  });

  test('network failures are reported clearly', async () => {
    const failing = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(aiCreateTasks(cfg, 'quick-add', 'x', ctx, failing)).rejects.toMatchObject({ kind: 'network' });
  });

  test('success returns the tasks', async () => {
    const tasks = await aiCreateTasks(
      cfg,
      'breakdown',
      'Plan a team offsite',
      ctx,
      fakeFetch(
        200,
        okResponse([{ title: 'Pick a venue', due_date: '2026-11-18', time: null, duration_minutes: 60, priority: 'high', tags: [] }]),
      ),
    );
    expect(tasks[0]).toMatchObject({ title: 'Pick a venue', priority: 'high', durationMin: 60 });
  });

  test('without a key or proxy nothing is sent', async () => {
    const f = fakeFetch(200, {});
    await expect(aiCreateTasks({ apiKey: '', model: DEFAULT_MODEL }, 'quick-add', 'x', ctx, f)).rejects.toMatchObject({ kind: 'auth' });
    expect(f).not.toHaveBeenCalled();
  });
});
