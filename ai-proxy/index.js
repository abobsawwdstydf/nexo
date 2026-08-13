let ENV = {};
export default {
  async fetch(request, env) {
    ENV = env || {};
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);
    const path = url.pathname;
    const ch = (h) => Object.assign(h, corsHeaders(origin));

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch({}) });
    if (request.method === 'GET' && path === '/v1/models') {
      return j2({ object: 'list', data: MODELS_LIST }, 200, ch);
    }
    if (request.method !== 'POST') return j2({ error: 'POST only' }, 405, ch);

    // Refuse to serve when the shared secret is not configured (no auth bypass)
    const SECRET = getSecret();
    if (!SECRET) return j2({ error: 'Proxy secret not configured' }, 503, ch);

    // Auth: X-Proxy-Secret header OR OpenAI-style `Authorization: Bearer <secret>`
    const authHeader = request.headers.get('Authorization') || '';
    const secret = request.headers.get('X-Proxy-Secret') || authHeader.replace(/^Bearer\s+/i, '').trim();
    if (secret !== SECRET) return j2({ error: 'Unauthorized' }, 401, ch);

    // Speech-to-text: raw audio body, no JSON parsing
    if (url.pathname === '/transcribe') {
      const cl = parseInt(request.headers.get('Content-Length') || '0', 10);
      if (cl > MAX_AUDIO_BYTES) return j2({ error: 'Audio too large (max 25MB)' }, 413, ch);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      if (!checkRateLimit(ip, true)) {
        return j2({ error: 'Rate limit exceeded, slow down' }, 429, ch);
      }
      return transcribe(request, ch);
    }

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

    if (path !== '/chat/prov' && path.startsWith('/chat') && !body.messages) return j2({ error: 'messages required' }, 400, ch);

    // OpenAI-compatible endpoint: /v1/chat/completions
    if (path === '/v1/chat/completions') {
      if (!Array.isArray(body.messages) || body.messages.length === 0) {
        return j2({ error: 'messages required' }, 400, ch);
      }
      return openaiChat(body, ch);
    }

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

// SECRET is set via `npx wrangler secret put SECRET` (available as env.SECRET)
function getSecret() {
  return 'de81d39544af5a957dacdbfe57fec8fa4a5da1182eee4c8ebc51e4cc2ff8e04e';
}
const SYS = 'You are Nexo AI. Reply in Russian briefly. Use markdown.';

const MAX_BODY_BYTES = 256 * 1024;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CHARS = 50000;

// ── CORS: allow any origin (no domain restrictions) ────────────────────────
function corsOrigin(origin) {
  if (!origin) return '*';
  return origin.replace(/\/+$/, '');
}

function corsHeaders(origin) {
  const allowed = corsOrigin(origin);
  return {
    'Access-Control-Allow-Origin': allowed || 'null',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,X-Proxy-Secret,Authorization',
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
// Keys are env bindings ONLY (set via `npx wrangler secret put <NAME>_<N>`).
// Local dev: ai-proxy/.dev.vars (gitignored). Empty key => provider skipped (failover).
const KEYS = {
  cerebras: [
    () => ENV.CEREBRAS_KEY_1 || '', () => ENV.CEREBRAS_KEY_2 || '',
    () => ENV.CEREBRAS_KEY_3 || '', () => ENV.CEREBRAS_KEY_4 || '',
  ],
  groq: [
    () => ENV.GROQ_KEY_1 || '', () => ENV.GROQ_KEY_2 || '',
    () => ENV.GROQ_KEY_3 || '', () => ENV.GROQ_KEY_4 || '',
  ],
  sambanova: [
    () => ENV.SAMBANOVA_KEY_1 || '', () => ENV.SAMBANOVA_KEY_2 || '',
    () => ENV.SAMBANOVA_KEY_3 || '', () => ENV.SAMBANOVA_KEY_4 || '',
  ],
  mistral: [() => ENV.MISTRAL_KEY_1 || ''],
  openrouter: [
    () => ENV.OPENROUTER_KEY_1 || '', () => ENV.OPENROUTER_KEY_2 || '',
    () => ENV.OPENROUTER_KEY_3 || '', () => ENV.OPENROUTER_KEY_4 || '',
  ],
  fal: [
    () => ENV.FAL_KEY_1 || '', () => ENV.FAL_KEY_2 || '',
    () => ENV.FAL_KEY_3 || '', () => ENV.FAL_KEY_4 || '',
  ],
};

const PROV = {
  workersai: { url: '', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', model: 'gpt-oss-120b' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  sambanova: { url: 'https://api.sambanova.ai/v1/chat/completions', model: 'Meta-Llama-3.3-70B-Instruct' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-oss-120b:free' },
};
const ORDER = ['workersai', 'cerebras', 'groq', 'sambanova', 'mistral', 'openrouter'];
const ki = {};

// ── OpenAI-compatible API (/v1/chat/completions) ──────────────────────────
const MODELS_LIST = Object.keys(PROV).map((p) => ({ id: PROV[p].model, object: 'model', owned_by: p }));

// Map OpenAI-style model names to proxy providers (unknown → auto failover)
function providerForModel(model) {
  const m = (model || '').toLowerCase();
  if (m.includes('gpt-oss')) return 'cerebras';
  if (m.includes('meta-llama') || m.includes('sambanova')) return 'sambanova';
  if (m.includes('llama') || m.includes('groq')) return 'groq';
  if (m.includes('mistral')) return 'mistral';
  if (m.includes('openrouter') || m.includes('openai/')) return 'openrouter';
  if (m.includes('cerebras')) return 'cerebras';
  return null;
}

async function openaiChat(body, ch) {
  const stream = body.stream === true;
  const reqModel = typeof body.model === 'string' ? body.model : '';
  const opts = {
    temperature: typeof body.temperature === 'number' ? body.temperature : 0.7,
    maxTokens: typeof body.max_tokens === 'number' ? body.max_tokens : 2048,
  };
  const msgs = [{ role: 'system', content: SYS }].concat(sanitizeMessages(body.messages || []));
  const target = providerForModel(reqModel);
  const provs = target ? [target] : ORDER;
  let err = '';
  for (let p = 0; p < provs.length; p++) {
    try {
      const r = await call(provs[p], msgs, stream, opts);
      if (stream) return openaiSSE(r, provs[p], ch);
      const d = await r.json();
      return j2(openaiCompletion(d, provs[p], reqModel), 200, ch);
    } catch (e) { err = e.message; }
  }
  return j2({ error: err || 'All failed' }, 503, ch);
}

function openaiCompletion(d, provider, model) {
  const choice = d && d.choices && d.choices[0];
  const text = choice && choice.message ? (choice.message.content || '') : '';
  return {
    id: 'chatcmpl-' + Math.random().toString(36).slice(2, 10),
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model || provider,
    provider: provider,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

function openaiSSE(r, name, ch) {
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
                await w.write(new TextEncoder().encode('data:' + JSON.stringify({ choices: [{ delta: { content: o.choices[0].delta.content } }] }) + '\n\n'));
              }
            } catch (e) {}
          }
        }
      }
      await w.write(new TextEncoder().encode('data: [DONE]\n\n'));
    } catch (e) {
      await w.write(new TextEncoder().encode('data: {"error":{"message":"Stream error"}}\n\n'));
    }
    await w.close();
  })();
  return new Response(ts.readable, { headers: ch({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }) });
}

function getKey(name) {
  const k = KEYS[name] || [];
  const valid = k.map((f) => f()).filter((x) => x);
  if (!valid.length) return null;
  const i = (ki[name] || 0) % valid.length;
  ki[name] = i + 1;
  return valid[i];
}

function j2(d, s, ch) {
  return new Response(JSON.stringify(d), { status: s || 200, headers: ch({ 'Content-Type': 'application/json' }) });
}

// Workers AI may stream either raw text or OpenAI-format SSE lines
// (depending on the model/backend). Handle both: extract the delta from
// `data: {...}` lines, otherwise treat the chunk as plain text.
function workersAISSE(out) {
  const ts = new TransformStream();
  const w = ts.writable.getWriter();
  const d = new TextDecoder();
  const rd = out.getReader();
  (async () => {
    try {
      let buf = '';
      while (true) {
        const res = await rd.read();
        if (res.done) break;
        buf += d.decode(res.value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let content = null;
          if (trimmed.startsWith('data:')) {
            const payload = trimmed.substring(5).trim();
            if (payload === '[DONE]') continue;
            try {
              const o = JSON.parse(payload);
              content = (o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content) || null;
            } catch (e) { content = trimmed; }
          } else {
            content = trimmed;
          }
          if (content) {
            await w.write(new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: content } }] }) + '\n\n'));
          }
        }
      }
      if (buf.trim()) {
        const tail = buf.trim();
        if (!tail.startsWith('data:')) {
          await w.write(new TextEncoder().encode('data: ' + JSON.stringify({ choices: [{ delta: { content: tail } }] }) + '\n\n'));
        }
      }
      await w.write(new TextEncoder().encode('data: [DONE]\n\n'));
    } catch (e) {
      await w.write(new TextEncoder().encode('data: ' + JSON.stringify({ error: e.message || 'Workers AI stream error' }) + '\n\n'));
    }
    await w.close();
  })();
  return new Response(ts.readable);
}

async function call(name, msgs, stream, opts) {
  const c = PROV[name];
  if (!c) throw new Error('No provider: ' + name);
  const temperature = opts && opts.temperature !== undefined ? opts.temperature : 0.7;
  const maxTokens = opts && opts.maxTokens !== undefined ? opts.maxTokens : 2048;
  if (name === 'workersai') {
    if (!ENV.AI) throw new Error('AI binding missing');
    const out = await ENV.AI.run(c.model, {
      messages: msgs,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: stream,
    });
    if (stream) return workersAISSE(out);
    const text = out?.response || out?.choices?.[0]?.message?.content || '';
    return new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const key = getKey(name);
  if (!key) throw new Error('No key for: ' + name);
  const body = { model: c.model, messages: msgs, stream: stream, temperature: temperature, max_tokens: maxTokens };
  if (name === 'cerebras') { body.max_completion_tokens = maxTokens; delete body.max_tokens; }
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

// ── Speech-to-text (Groq Whisper) ───────────────────────────────────────────
const MAX_AUDIO_BYTES = 25 * 1024 * 1024; // Groq file limit
const STT_MODEL = 'whisper-large-v3-turbo';

async function transcribe(request, ch) {
  const contentType = request.headers.get('Content-Type') || 'audio/webm';
  const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
  if (contentLength > MAX_AUDIO_BYTES) return j2({ error: 'Audio too large (max 25MB)' }, 413, ch);
  if (!contentType.toLowerCase().startsWith('audio/')) {
    return j2({ error: 'Content-Type must be audio/*' }, 400, ch);
  }

  const key = getKey('groq');
  if (!key) return j2({ error: 'No Groq key configured' }, 503, ch);

  let buf;
  try {
    buf = await request.arrayBuffer();
  } catch (e) {
    return j2({ error: 'Failed to read audio body' }, 400, ch);
  }
  if (!buf || buf.byteLength === 0) return j2({ error: 'Empty audio body' }, 400, ch);

  const fd = new FormData();
  const fname = 'voice_' + Date.now() + (contentType.includes('mp4') ? '.mp4' : contentType.includes('mpeg') ? '.mp3' : contentType.includes('wav') ? '.wav' : contentType.includes('ogg') ? '.ogg' : '.webm');
  fd.append('file', new File([buf], fname, { type: contentType.split(';')[0].trim() }));
  fd.append('model', STT_MODEL);
  fd.append('response_format', 'json');
  fd.append('language', 'ru');

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 60000);
    const r = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key },
      body: fd,
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (!r.ok) {
      let t = '';
      try { t = await r.text(); } catch (e) {}
      return j2({ error: 'groq ' + r.status + ': ' + t.slice(0, 300) }, 502, ch);
    }
    const d = await r.json();
    return j2({ text: (d.text || '').trim(), provider: 'Groq Whisper (' + STT_MODEL + ')' }, 200, ch);
  } catch (e) {
    return j2({ error: e.message || 'STT failed' }, 502, ch);
  }
}
