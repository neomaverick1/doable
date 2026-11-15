// A minimal backend for Doable's AI features.
// The app sends the request without a key; this server adds the key, rate-limits callers
// and only lets the planner's own tool call through. Run: OPENAI_API_KEY=sk-... npm run ai-proxy
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.OPENAI_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MIN || 20);

if (!KEY) {
  console.error('Set OPENAI_API_KEY before starting the proxy.');
  process.exit(1);
}

const recentCalls = new Map(); // client address -> timestamps in the last minute

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.writeHead(204).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });

  const who = req.socket.remoteAddress ?? 'unknown';
  const now = Date.now();
  const calls = (recentCalls.get(who) ?? []).filter((t) => now - t < 60_000);
  if (calls.length >= PER_MINUTE) return send(res, 429, { error: 'Too many requests, try again in a minute.' });
  recentCalls.set(who, [...calls, now]);

  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 20_000) return send(res, 413, { error: 'Request too large' });
  }
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return send(res, 400, { error: 'Invalid JSON' });
  }
  if (payload?.tools?.length !== 1 || payload.tools[0]?.name !== 'create_tasks') return send(res, 400, { error: 'Unsupported request' });

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({ ...payload, store: false }),
    });
    res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
    res.end(await upstream.text());
  } catch {
    send(res, 502, { error: 'Could not reach the AI service' });
  }
}).listen(PORT, () => console.log(`Doable AI proxy listening on http://localhost:${PORT}`));
