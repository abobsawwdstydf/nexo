export default {
  async fetch(request) {
    var origin = request.headers.get('Origin') || '';
    var url = new URL(request.url);
    var path = url.pathname;
    var ch = function(h) { return Object.assign(h, corsHeaders(origin)); };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: ch({}) });
    if (request.method !== 'POST') return j2({ error: 'POST only' }, 405, ch);
    var secret = request.headers.get('X-Proxy-Secret');
    if (secret !== SECRET) return j2({ error: 'Unauthorized' }, 401, ch);
    var body = await request.json();
    if (!body.messages && path.indexOf('/chat') === 0) return j2({ error: 'messages required' }, 400, ch);
    var msgs = [{ role: 'system', content: SYS }].concat(body.messages || []);

    if (path === '/chat/auto') {
      var err = '';
      for (var p = 0; p < ORDER.length; p++) {
        try { var r = await call(ORDER[p], msgs, false); var d = await r.json(); return j2({ text: d.choices[0].message.content || '', provider: ORDER[p] }, 200, ch); } catch(e) { err = e.message; }
      }
      return j2({ error: err || 'All failed' }, 503, ch);
    }

    if (path === '/chat/auto/stream') {
      var err = '';
      for (var p = 0; p < ORDER.length; p++) {
        try { var r = await call(ORDER[p], msgs, true); return sse2(r, ORDER[p], ch); } catch(e) { err = e.message; }
      }
      return j2({ error: err || 'All failed' }, 503, ch);
    }

    if (path.indexOf('/chat/prov/') === 0) {
      var pn = path.substring(11);
      var st = url.searchParams.get('stream') === '1';
      if (!PROV[pn]) return j2({ error: 'Unknown: ' + pn }, 400, ch);
      try { var r = await call(pn, msgs, st); if (st) return sse2(r, pn, ch); var d = await r.json(); return j2({ text: d.choices[0].message.content || '', provider: pn }, 200, ch); } catch(e) { return j2({ error: e.message }, 502, ch); }
    }

    if (path === '/chat/prov') return j2({ providers: Object.keys(PROV), order: ORDER }, 200, ch);

    if (path === '/generate-image') {
      var prompt = (body.prompt || '').trim().slice(0, 500);
      if (!prompt) return j2({ error: 'prompt required' }, 400, ch);
      var img = await genImg(prompt);
      if (img) return j2(img, 200, ch);
      var seed = Math.floor(Math.random() * 1000000);
      return j2({ url: 'https://image.pollinations.ai/prompt/' + encodeURIComponent(prompt) + '?width=1024&height=1024&seed=' + seed + '&nologo=true&enhance=true', provider: 'Pollinations.ai' }, 200, ch);
    }
    return j2({ error: 'Not found' }, 404, ch);
  }
};

// SECRET is set via `npx wrangler secret put SECRET`
var SECRET = globalThis.SECRET || '';
var SYS = 'You are Nexo AI. Reply in Russian briefly. Use markdown.';
var ALLOWED_ORIGINS = ['https://nexo.hakerone.ru', 'https://nexo.darkheavens.ru', 'https://msg.hakerone.ru', 'https://msg.darkheavens.ru', 'https://n.hakerone.ru', 'https://n.darkheavens.ru', 'https://neexoobeec.hakerone.ru', 'https://nneexion.darkheavens.ru', 'http://localhost:2273', 'http://localhost:3000', 'http://localhost:3001'];
function corsOrigin(origin) { if (!origin) return false; for (var i = 0; i < ALLOWED_ORIGINS.length; i++) { if (origin.indexOf(ALLOWED_ORIGINS[i]) >= 0) return ALLOWED_ORIGINS[i]; } return false; }
function corsHeaders(origin) { var allowed = corsOrigin(origin); return { 'Access-Control-Allow-Origin': allowed || 'null', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Proxy-Secret' }; }

// API keys are loaded from environment variables in production
// To set them: wrangler secret put CEREBRAS_KEY_1, etc.
// For local dev, use .dev.vars file (not committed)
var KEYS = {
  cerebras: [
    globalThis.CEREBRAS_KEY_1 || '',
    globalThis.CEREBRAS_KEY_2 || '',
    globalThis.CEREBRAS_KEY_3 || '',
    globalThis.CEREBRAS_KEY_4 || ''
  ],
  groq: [
    globalThis.GROQ_KEY_1 || '',
    globalThis.GROQ_KEY_2 || '',
    globalThis.GROQ_KEY_3 || '',
    globalThis.GROQ_KEY_4 || ''
  ],
  sambanova: [
    globalThis.SAMBANOVA_KEY_1 || '',
    globalThis.SAMBANOVA_KEY_2 || '',
    globalThis.SAMBANOVA_KEY_3 || '',
    globalThis.SAMBANOVA_KEY_4 || ''
  ],
  mistral: [
    globalThis.MISTRAL_KEY_1 || ''
  ],
  openrouter: [
    globalThis.OPENROUTER_KEY_1 || '',
    globalThis.OPENROUTER_KEY_2 || '',
    globalThis.OPENROUTER_KEY_3 || '',
    globalThis.OPENROUTER_KEY_4 || ''
  ],
  fal: [
    globalThis.FAL_KEY_1 || '',
    globalThis.FAL_KEY_2 || '',
    globalThis.FAL_KEY_3 || '',
    globalThis.FAL_KEY_4 || ''
  ]
};

var PROV = {
  cerebras: { url: 'https://api.cerebras.ai/v1/chat/completions', model: 'gpt-oss-120b' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', model: 'llama-3.3-70b-versatile' },
  sambanova: { url: 'https://api.sambanova.ai/v1/chat/completions', model: 'Meta-Llama-3.3-70B-Instruct' },
  mistral: { url: 'https://api.mistral.ai/v1/chat/completions', model: 'mistral-small-latest' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', model: 'openai/gpt-oss-120b:free' }
};
var ORDER = ['cerebras', 'groq', 'sambanova', 'mistral', 'openrouter'];
var ki = {};

function getKey(n) { var k = KEYS[n] || []; if (!k.length || !k[0]) return null; var valid = k.filter(x => x); if (!valid.length) return null; var i = (ki[n] || 0) % valid.length; ki[n] = i + 1; return valid[i]; }
function j2(d, s, ch) { return new Response(JSON.stringify(d), { status: s || 200, headers: ch({ 'Content-Type': 'application/json' }) }); }

async function call(name, msgs, stream) {
  var c = PROV[name]; if (!c) throw new Error('No provider: ' + name);
  var key = getKey(name); if (!key) throw new Error('No key for: ' + name);
  var body = { model: c.model, messages: msgs, stream: stream, temperature: 0.7, max_tokens: 2048 };
  if (name === 'cerebras') { body.max_completion_tokens = 2048; delete body.max_tokens; }
  var h = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
  if (name === 'openrouter') { h['HTTP-Referer'] = 'https://nexo.cloudpub.ru'; h['X-Title'] = 'Nexo AI'; }
  var ctrl = new AbortController(); var tid = setTimeout(function() { ctrl.abort(); }, 30000);
  var r = await fetch(c.url, { method: 'POST', headers: h, body: JSON.stringify(body), signal: ctrl.signal });
  clearTimeout(tid);
  if (!r.ok) { var t = ''; try { t = await r.text(); } catch(e) {} throw new Error(name + ' ' + r.status + ': ' + t.slice(0, 200)); }
  return r;
}

function sse2(r, name, ch) {
  var ts = new TransformStream(); var w = ts.writable.getWriter(); var d = new TextDecoder(); var rd = r.body.getReader();
  (async function() {
    try { while (true) { var res = await rd.read(); if (res.done) break; var lines = d.decode(res.value, { stream: true }).split('\n'); for (var k = 0; k < lines.length; k++) { if (lines[k].indexOf('data: ') === 0 && lines[k] !== 'data: [DONE]') { try { var o = JSON.parse(lines[k].substring(6)); if (o.choices && o.choices[0] && o.choices[0].delta && o.choices[0].delta.content) { await w.write(new TextEncoder().encode('data:' + JSON.stringify({ token: o.choices[0].delta.content }) + '\n\n')); } } catch(e) {} } } } await w.write(new TextEncoder().encode('data:' + JSON.stringify({ done: true, provider: name }) + '\n\n'));
    } catch(e) { await w.write(new TextEncoder().encode('data:' + JSON.stringify({ error: 'Stream error' }) + '\n\n')); }
    await w.close();
  })();
  return new Response(ts.readable, { headers: ch({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }) });
}

async function genImg(prompt) {
  for (var i = 0; i < 4; i++) {
    var key = getKey('fal'); if (!key) break;
    try {
      var ctrl = new AbortController(); var tid = setTimeout(function() { ctrl.abort(); }, 60000);
      var r = await fetch('https://fal.run/fal-ai/flux/schnell', { method: 'POST', headers: { 'Authorization': 'Key ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: prompt, image_size: 'landscape_16_9', num_inference_steps: 4, num_images: 1, enable_safety_checker: true }), signal: ctrl.signal });
      clearTimeout(tid);
      if (r.ok) { var d = await r.json(); var imgs = d.images || d.data || []; if (imgs.length > 0) { var u = imgs[0].url || imgs[0]; if (u) return { url: u, provider: 'Fal.ai (Flux Schnell)' }; } }
    } catch(e) {}
  }
  return null;
}
