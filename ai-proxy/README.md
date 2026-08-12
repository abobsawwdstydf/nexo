# NEXO AI Proxy — Cloudflare Worker

Бесплатный AI прокси с 6 провайдерами и автоматическим failover. Работает как OpenAI-совместимый шлюз с защитой по секрету.

## Провайдеры

| # | Провайдер | Модель | Статус |
|---|-----------|--------|--------|
| 1 | Workers AI (Cloudflare) | @cf/meta/llama-3.3-70b-instruct-fp8-fast | работает |
| 2 | Cerebras | gpt-oss-120b | ключи в коде |
| 3 | Groq | llama-3.3-70b-versatile | ключи в коде |
| 4 | SambaNova | Meta-Llama-3.3-70B-Instruct | работает |
| 5 | Mistral | mistral-small-latest | ключ не задан |
| 6 | OpenRouter | openai/gpt-oss-120b:free | ключи в коде |

Ключи захардкожены в `KEYS` в `index.js` (кроме Mistral/FAL — берутся из env, см. `.dev.vars.example`).

## Failover порядок

```
workersai → cerebras → groq → sambanova → mistral → openrouter
```

## Аутентификация

Все запросы требуют заголовок:

```
X-Proxy-Secret: <секрет>
```

Либо OpenAI-совместимый вариант: `Authorization: Bearer <секрет>` (работает с официальными OpenAI SDK).

Секрет захардкожен в `getSecret()` в `index.js`. Без него — `401 Unauthorized`.

## API Endpoints

Все эндпоинты — `POST` (кроме `GET /v1/models`). Ошибки приходят в формате `{"error": "..."}` с соответствующим HTTP-кодом.

| Endpoint | Описание | Формат ответа (200) |
|----------|----------|---------------------|
| `POST /v1/chat/completions` | **OpenAI-совместимый чат** (обычный и `"stream":true`) | OpenAI `chat.completion` JSON / OpenAI SSE |
| `GET /v1/models` | Список моделей (OpenAI формат) | `{"object":"list","data":[...]}` |
| `POST /chat/auto` | Автоматический выбор провайдера (failover) | `{"text":"...","provider":"workersai"}` |
| `POST /chat/auto/stream` | SSE стриминг с failover | `data:{"token":"..."}` ... `data:{"done":true,"provider":"..."}` |
| `POST /chat/prov/{name}` | Запрос к конкретному провайдеру | как `/chat/auto` (или SSE при `?stream=1`) |
| `POST /chat/prov` | Список провайдеров (без `messages`) | `{"providers":[...],"order":[...]}` |
| `POST /generate-image` | Генерация изображения | `{"url":"...","provider":"Fal.ai (Flux Schnell)"}` (фолбэк Pollinations) |
| `POST /transcribe` | Голос → текст (Groq Whisper, `Content-Type: audio/*`, сырое тело ≤25MB) | `{"text":"...","provider":"Groq Whisper (...)"}` |

## OpenAI-совместимый API

`POST /v1/chat/completions` принимает стандартный формат OpenAI (`model`, `messages`, `stream`, `temperature`, `max_tokens`) и отдаёт стандартные ответы OpenAI — можно использовать официальные SDK:

```python
from openai import OpenAI

client = OpenAI(
    base_url="https://nexo-ai-proxy.h40664555.workers.dev/v1",
    api_key="<секрет>",
)

resp = client.chat.completions.create(
    model="gpt-oss-120b",  # или любую модель, см. GET /v1/models
    messages=[{"role": "user", "content": "Привет!"}],
)
print(resp.choices[0].message.content)
```

```js
import OpenAI from 'openai';

const client = new OpenAI({
  baseURL: 'https://nexo-ai-proxy.h40664555.workers.dev/v1',
  apiKey: '<секрет>',
});

const stream = await client.chat.completions.create({
  model: 'llama-3.3-70b-versatile',
  messages: [{ role: 'user', content: 'Привет!' }],
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### Роутинг моделей

`model` в запросе определяет провайдера (см. `providerForModel()` в `index.js`):

| model содержит | Провайдер |
|----------------|-----------|
| `gpt-oss` / `cerebras` | Cerebras |
| `meta-llama` / `sambanova` | SambaNova |
| `llama` / `groq` | Groq |
| `mistral` | Mistral |
| `openrouter` / `openai/` | OpenRouter |
| остальное | авто-failover по `ORDER` |

## Интеграция в другие проекты

### Простой чат (curl)

```bash
curl -X POST https://nexo-ai-proxy.h40664555.workers.dev/chat/auto \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Secret: <секрет>" \
  -d '{"messages":[{"role":"user","content":"Привет!"}]}'
```

### JavaScript (fetch)

```js
const res = await fetch('https://nexo-ai-proxy.h40664555.workers.dev/chat/auto', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Proxy-Secret': '<секрет>',
  },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'Привет!' }] }),
});
const data = await res.json();
console.log(data.text, data.provider);
```

### Стриминг (fetch + ReadableStream)

```js
const res = await fetch('https://nexo-ai-proxy.h40664555.workers.dev/chat/auto/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Proxy-Secret': '<секрет>' },
  body: JSON.stringify({ messages: [{ role: 'user', content: 'Привет!' }] }),
});
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buf = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buf += decoder.decode(value, { stream: true });
  for (const line of buf.split('\n')) {
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (payload === '[DONE]') return;
      try {
        const msg = JSON.parse(payload);
        if (msg.token) process.stdout.write(msg.token); // токен
        if (msg.done) break; // msg.provider — кто ответил
      } catch {}
    }
  }
}
```

### Python (requests)

```python
import requests

r = requests.post(
    "https://nexo-ai-proxy.h40664555.workers.dev/chat/auto",
    headers={"Content-Type": "application/json", "X-Proxy-Secret": "<секрет>"},
    json={"messages": [{"role": "user", "content": "Привет!"}]},
)
print(r.json()["text"])
```

### Python (streaming, httpx)

```python
import httpx

with httpx.stream(
    "POST",
    "https://nexo-ai-proxy.h40664555.workers.dev/chat/auto/stream",
    headers={"Content-Type": "application/json", "X-Proxy-Secret": "<секрет>"},
    json={"messages": [{"role": "user", "content": "Привет!"}]},
) as r:
    for line in r.iter_lines():
        if line.startswith("data:"):
            import json
            msg = json.loads(line[5:].strip())
            if msg.get("token"):
                print(msg["token"], end="", flush=True)
            if msg.get("done"):
                print("\n[provider:", msg["provider"], "]")
```

### Генерация изображения

```bash
curl -X POST https://nexo-ai-proxy.h40664555.workers.dev/generate-image \
  -H "Content-Type: application/json" \
  -H "X-Proxy-Secret: <секрет>" \
  -d '{"prompt":"a cat in space, cartoon"}'
```

### Голос → текст (сырое аудио)

```bash
curl -X POST https://nexo-ai-proxy.h40664555.workers.dev/transcribe \
  -H "X-Proxy-Secret: <секрет>" \
  -H "Content-Type: audio/webm" \
  --data-binary @voice.webm
```

### ВАЖНО: CORS

CORS разрешён с любых доменов (воркер отдаёт `Access-Control-Allow-Origin` = ваш origin). Если нужно ограничить домены — верните список `ALLOWED_ORIGINS` в `corsOrigin()` в `index.js`.

### Лимиты

- 40 чат-запросов / 6 генераций в минуту на IP (в памяти, best-effort)
- Тело ≤ 256 КБ, аудио ≤ 25 МБ, до 50 сообщений по 50 000 символов
- Таймаут запроса к провайдеру: 30 сек (чат), 60 сек (изображения/STT)

## Установка и деплой

```bash
cd ai-proxy
npm install -g wrangler   # один раз
wrangler login            # один раз
wrangler deploy
```

## Транскрибация (STT)

Использует первый доступный Groq-ключ (ротация) и модель `whisper-large-v3-turbo`. Язык — русский (`language=ru`).
