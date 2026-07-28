# NEXO AI Proxy — Cloudflare Worker

Бесплатный AI прокси с 5 провайдерами и автоматическим failover.

## Провайдеры

| # | Провайдер | Модель | Скорость | Лимиты |
|---|-----------|--------|----------|--------|
| 1 | Cerebras | gpt-oss-120b | ⚡⚡⚡⚡⚡ | 1M токенов/день |
| 2 | Groq | llama-3.3-70b-versatile | ⚡⚡⚡⚡ | 30 RPM, 1000 req/день |
| 3 | SambaNova | Meta-Llama-3.3-70B-Instruct | ⚡⚡⚡⚡ | 20 RPM, 200K токенов/день |
| 4 | Mistral | mistral-small-latest | ⚡⚡⚡ | Бесплатный tier |
| 5 | OpenRouter | openai/gpt-oss-120b:free | ⚡⚡⚡ | 20 RPM, 50 req/день |

## Failover порядок

```
cerebras → groq → sambanova → mistral → openrouter
```

## Получение API ключей

### 1. Cerebras (уже есть)
Ключи уже в `KEYS.cerebras`.

### 2. Groq (уже есть)
Ключи уже в `KEYS.groq`.

### 3. SambaNova (уже есть)
Ключи уже в `KEYS.sambanova`.

### 4. Mistral (нужно получить)
1. Перейти на https://console.mistral.ai
2. Зарегистрироваться через Google/GitHub
3. API Keys → Create new key
4. Замени `REPLACE_WITH_MISTRAL_KEY` в `index.js`

**Модель:** `mistral-small-latest` — быстрый, 32K контекст, лучшая бесплатная модель Mistral.

### 5. OpenRouter (уже есть)
Ключи уже в `KEYS.openrouter`.

## Установка

```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

## API Endpoints

| Endpoint | Описание |
|----------|----------|
| `POST /chat/auto` | Автоматический выбор провайдера (failover) |
| `POST /chat/auto/stream` | SSE стриминг с failover |
| `POST /chat/prov/{name}` | Запрос к конкретному провайдеру |
| `GET /chat/prov` | Список доступных провайдеров |
| `POST /generate-image` | Генерация изображений (Fal.ai / Pollinations) |
