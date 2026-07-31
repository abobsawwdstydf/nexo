export default {
  async fetch(request) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const path = url.pathname;
    const ch = (h) => Object.assign(h, corsHeaders(origin));

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch({}) });
    if (request.method !== 'POST') return j2({ error: 'POST only' }, 405, ch);

    // Refuse to serve when the shared secret is not configured (no auth bypass)
    if (!SECRET) return j2({ error: 'Proxy secret not configured' }, 503, ch);

    const secret = request.headers.get('X-Proxy-Secret');
    if (secret !== SECRET) return j2({ error: 'Unauthorized' }, 401, ch);

    // Per-IP rate limiting (in-memory, best-effort)
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const isImage = path === '/generate-image';
    if (!checkRateLimit(ip, isImage)) {
      return j2({ error: 'Rate limit exceeded, slow down' }, 429, ch);
    }

    // Body size guard (prevents memory abuse via unbounded JSON)
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > MAX_BODY_BYTES) return j2({ error: 'Request too large' }, 413, ch);

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return j2({ error: 'Invalid JSON body' }, 400, ch);
    }

    if (path.startsWith('/chat') && !body.messages) return j2({ error: 'messages required' }, 400, ch);
    const msgs = [{ role: 'system', content: SYS }].concat(sanitizeMessages(body.messages || []));

    if (path === '/chat/auto') {
      let err = '';
      for (let p = 0; p < ORDER.length; p++) {
        try { const r = await call(ORDER[p], msgs, false); const d = await r.json(); return j2({ text: d.choices[0].message.content || '', provider: ORDER[p] }, 200, ch); } catch (e) { err = e.message; }
      }
      return j2({ error: err || 'All failed' }, 503, ch);
    }

    if (path === '/chat/auto/stream') {
      let err = '';
      for (let p = 0; p < ORDER.length; p++) {
        try { const r = await call(ORDER[p], msgs, true); return sse2(r, ORDER[p], ch); } catch (e) { err = e.message; }
      }
      return j2({ error: err || 'All failed' }, 503, ch);
    }

    if (path.startsWith('/chat/prov/')) {
      const pn = path.substring(11);
      const st = url.searchParams.get('stream') === '1';
      if (!PROV[pn]) return j2({ error: 'Unknown: ' + pn }, 400, ch);
      try {
        const r = await call(pn, msgs, st);
        if (st) return sse2(r, pn, ch);
        const d = await r.json();
        return j2({ text: d.choices[0].message.content || '', provider: pn }, 200, ch);
      } catch (e) { return j2({ error: e.message }, 502, ch); }
    }

    if (path === '/chat/prov') return j2({ providers: Object.keys(PROV), order: ORDER }, 200, ch);

    if (path === '/generate-image') {
      const prompt = (body.prompt || '').trim().slice(0, 500);
      if (!prompt) return j2({ error: 'prompt required' }, 400, ch);
      const img = await genImg(prompt);
      if (img) return j2(img, 200, ch);
      const seed = Math.floor(Math.random() * 1000000);
      return j2({ url: 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=1024&height=1024&seed=' + seed + '&nologo=true&enhance=true', provider: 'Pollinations.ai' }, 200, ch);
    }
    return j2({ error: 'Not found' }, 404, ch);
  }
};

// SECRET is set via `npx wrangler secret put SECRET`
const SECRET = globalThis.SECRET || '';
const SYS = 'You are Nexo AI. Reply in Russian briefly. Use markdown.';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 50000;

// ── CORS: exact origin matching (no substring bypass) ──────────────────────
const ALLOWED_ORIGINS = [
  'https://nexo.hakerone.ru', 'https://nexo.darkheavens.ru',
  'https://msg.hakerone.ru', 'https://msg.darkheavens.ru',
  'https://n.hakerone.ru', 'https://n.darkheavens.ru',
  'https://xn--e1akhgo.hakerone.ru', 'https://xn--e1akhgo.darkheavens.ru',
  'https://neexoobeec.hakerone.ru', 'https://nneexion.darkheavens.ru',
  'http://localhost:2273', 'http://localhost:3000', 'http://localhost:3001',
];

function corsOrigin(origin) {
  if (!origin) return null;
  const normalized = origin.replace(/\/+$/, '');
  if (ALLOWED_ORIGINS.includes(normalized)) return normalized;
  return null;
}

function corsHeaders(origin) {
  const allowed = corsOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allowed || 'null',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Proxy-Secret',
  };
}

// ── Per-IP rate limiting ────────────────────────────────────────────────────
const RATE_WINDOW_MS = 60_000;
const RATE_CHAT_MAX = 40;
const RATE_IMAGE_MAX = 6;
const rateBuckets = new Map(); // ip -> { count, windowStart }

function checkRateLimit(ip, isImage) {
  const max = isImage ? RATE_IMAGE_MAX : RATE_CHAT_MAX;
  const now = Date.now();
  const bucket = rateBuckets.get(ip);

  if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
    rateBuckets.set(ip, { count: 1, windowStart: now });
    return true;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

// Opportunistic cleanup so the map does not grow forever
const CLEANUP_EVERY_MS = 5 * 60_000;
let lastCleanup = Date.now();
function maybeCleanupRateBuckets() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_EVERY_MS) return;
  lastCleanup = now;
  for (const [k, b] of rateBuckets) {
    if (now - b.windowStart > RATE_WINDOW_MS) rateBuckets.delete(k);
  }
  if (rateBuckets.size > 10_000) rateBuckets.clear();
}

function sanitizeMessages(messages) {
  maybeCleanupRateBuckets();
  if (!Array.isArray(messages)) return [];
  const out = [];
  for (const m of messages.slice(0, MAX_MESSAGES)) {
    if (!m || typeof m !== 'object') continue;
    const role = m.role === 'user' || m.role === 'assistant' ? m.role : 'user';
    const content = typeof m.content === 'string' ? m.content.slice(0, MAX_MESSAGE_CHARS) : '';
    if (content) out.push({ role, content });
  }
  return out;
}

// ── Providers ───────────────────────────────────────────────────────────────
const KEYS = {
  cerebras: [
    globalThis.CEREBRAS_KEY_1 || '', globalThis.CEREBRAS_KEY_2 || '',
    globalThis.CEREBRAS_KEY_3 || '', globalThis.CEREBRAS_KEY_4 || '',
  ],
  groq: [
    globalThis.GROQ_KEY_1 || '', globalThis.GROQ_KEY_2 || '',
    globalThis.GROQ_KEY_3 || '', globalThis.GROQ_KEY_4 || '',
  ],
  sambanova: [
    globalThis.SAMBANOVA_KEY_1 || '', globalThis.SAMBANOVA_KEY_2 || '',
    globalThis.SAMBANOVA_KEY_3 || '', globalThis.SAMBANOVA_KEY_4 || '',
  ],
  mistral: [globalThis.MISTRAL_KEY_1 || ''],
  openrouter: [
    globalThis.OPENROUTER_KEY_1 || '', globalThis.OPENROUTER_KEY_2 || '',
    globalThis.OPENROUTER_KEY_3 || '', globalThis.OPENROUTER_KEY_4 || '',
  ],
  fal: [
    globalThis.FAL_KEY_1 || '', globalThis.FAL_KEY_2 || '',
    globalThis.FAL_KEY_3 || '', globalThis.FAL_KEY_4 || '',
  ],
};

const PROV = {
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', model: 'gpt-oss-120b' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  sambanova: { url: 'https://api.sambanova.ai/v1/chat/completions', model: 'Meta-Llama-3.3-70B-Instruct' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-oss-120b:free' },
};
const ORDER = ['cerebras', 'groq', 'sambanova', 'mistral', 'openrouter'];
const ki = {};

function getKey(name) {
  const k = KEYS[name] || [];
  const valid = k.filter((x) => x);
  if (!valid.length) return null;
  const i = (ki[name] || 0) % valid.length;
  ki[name] = i + 1;
  return valid[i];
}

function j2(d, s, ch) {
  return new Response(JSON.stringify(d), { status: s || 200, headers: ch({ 'Content-Type': 'application/json' }) });
}

async function call(name, msgs, stream) {
  const c = PROV[name];
  if (!c) throw new Error('No provider: ' + name);
  const key = getKey(name);
  if (!key) throw new Error('No key for: ' + name);
  const body = { model: c.model, messages: msgs, stream: stream, temperature: 0.7, max_tokens: 2048 };
  if (name === 'cerebras') { body.max_completion_tokens = 2048; delete body.max_tokens; }
  const h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
  if (name === 'openrouter') { h['HTTP-Referer'] = 'https://nexo.cloudpub.ru'; h['X-Title'] = 'Nexo AI'; }
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), 30000);
  const r = await fetch(c.url, { method: 'POST', headers: h, body: JSON.stringify(body), signal: ctrl.signal });
  clearTimeout(tid);
  if (!r.ok) {
    let t = '';
    try { t = await r.text(); } catch (e) {}
    throw new Error(name + ' ' + r.status + ': ' + t.slice(0, 200));
  }
  return r;
}

function sse2(r, name, ch) {
  const ts = new TransformStream();
  const w = ts.writable.getWriter();
  const d = new TextDecoder();
  const rd = r.body.getReader();
  (async () => {
    try {
      while (true) {
        const res = await rd.read();
        if (res.done) break;
        const lines = d.decode(res.value, { stream: true }).split('\n');
        for (let k = 0; k < lines.length; k++) {
          if (lines[k].indexOf('data: ') === 0 && lines[k] !== 'data: [DONE]') {
            try {
              const o = JSON.parse(lines[k].substring(6));
              if (o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content) {
                await w.write(new TextEncoder().encode('data:' + JSON.stringify({ token: o.choices[0].delta.content }) + '\n\n'));
              }
            } catch (e) {}
          }
        }
      }
      await w.write(new TextEncoder().encode('data:' + JSON.stringify({ done: true, provider: name }) + '\n\n'));
    } catch (e) {
      await w.write(new TextEncoder().encode('data:' + JSON.stringify({ error: 'Stream error' }) + '\n\n'));
    }
    await w.close();
  })();
  return new Response(ts.readable, { headers: ch({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }) });
}

async function genImg(prompt) {
  for (let i = 0; i < 4; i++) {
    const key = getKey('fal');
    if (!key) break;
    try {
      const ctrl = new AbortController();
      const tid = setTimeout(() => ctrl.abort(), 60000);
      const r = await fetch('https://fal.run/fal-ai/flux/schnell', {
        method: 'POST',
        headers: { 'Authorization': 'Key ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt, image_size: 'landscape_16_9', num_inference_steps: 4, num_images: 1, enable_safety_checker: true }),
        signal: ctrl.signal,
      });
      clearTimeout(tid);
      if (r.ok) {
        const d = await r.json();
        const imgs = d.images || d.data || [];
        if (imgs.length > 0) {
          const u = imgs[0].url || imgs[0];
          if (u) return { url: u, provider: 'Fal.ai (Flux Schnell)' };
        }
      }
    } catch (e) {}
  }
  return null;
}
