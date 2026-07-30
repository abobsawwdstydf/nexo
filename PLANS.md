# NEXO Messenger — Project Status & Future Plans

> **Updated**: 2026-07-30
> **Компания**: Dark Heavens Corporate
> **Сайт**: https://www.darkheavens.ru
> **Stack**: Go (Fiber) + SQLite + WebSocket | React 19 + Vite + TypeScript + Zustand
> **Статус**: Production (бета 14 дней)
> **Backend**: https://neexxoo.hakerone.ru
> **Frontend**: nexo.hakerone.ru, msg.darkheavens.ru, n.hakerone.ru и др.

---

## 🚀 Production Configuration

### Домены фронтенда
| Домен | Тип |
|-------|-----|
| nexo.hakerone.ru | Основной |
| nexo.darkheavens.ru | Зеркало |
| msg.hakerone.ru | Мессенджер |
| msg.darkheavens.ru | Мессенджер |
| n.hakerone.ru | Короткий |
| n.darkheavens.ru | Короткий |
| нексо.hakerone.ru | Кириллица |
| нексо.darkheavens.ru | Кириллица |

### Бэкенд
- **Публичный API:** https://neexxoo.hakerone.ru
- **Сервер:** 192.168.0.64 (SSH)
- **Деплой:** Автоматический из GitHub

### AI Proxy
- https://nexo-ai-proxy.h40664555.workers.dev (через Cloudflare)

---

## 🛡️ Безопасность (Production)

### Critical (исправлено)
| # | Уязвимость | Файл |
|---|-----------|------|
| 1 | Path traversal в vault | `handlers/vault.go` |
| 2 | Хардкодный AI_PROXY_SECRET | `ai/config.go` |
| 3 | Chrome --disable-web-security | `ai/browser.go` |
| 4 | BodyParser ошибки игнорируются | `handlers/incognito.go` |

### High (исправлено)
| # | Уязвимость | Файл |
|---|-----------|------|
| 5 | Chat themes XSS | `handlers/chat_themes.go` |
| 6 | Calendar time.Parse без проверки | `handlers/calendar.go` |
| 7 | Premium badge — только расширение | `handlers/premium_badge.go` |
| 8 | Export без подтверждения | `handlers/account.go` |
| 9 | AI Browse JSON-конкатенация | `handlers/ai_browse.go` |
| 10 | Cloud storage path traversal | `handlers/cloud_storage.go` |

### Medium (исправлено)
| # | Уязвимость | Файл |
|---|-----------|------|
| 11 | Voice room URL без валидации | `handlers/voice_room_activities.go` |
| 12 | Sticker proxy без лимита | `handlers/stickers_proxy.go` |
| 13 | Photo album cover URL | `handlers/photo_albums.go` |
| 14 | CSRF tokens без лимита | `middleware/security.go` |
| 15 | AI proxy без HTTPS | `ai/llm.go` |
| 16 | JWT в WebSocket query | `handlers/websocket.go` |

---

## 💎 Liquid Glass Design

Применён Liquid Glass визуальный стиль:
- `liquid-glass-subtle/medium/strong` — градиенты + blur
- `glass-ambient` — анимированное сияние
- `glass-card-enhanced` — карточки с глубокими тенями
- `glass-input` — фокус с glow
- `bubble-sent/received` — пузырьки в стиле Liquid Glass
- Framer Motion — 8 новых анимаций (glassEnter, stagger, textReveal, ripple)
- Micro-интеракции: hover, scale, glow на всех элементах

---

## 🎯 Бета-доступ (14 дней бесплатно)

- Все пользователи получают premium-функции на 14 дней с момента регистрации
- `isPremium()` в `cloud_storage.go` — проверяет `CreatedAt + 14 дней`
- `GetPremiumStatus` в `payment.go` — показывает `betaDaysLeft`
- После 14 дней — требуется оплата через YooKassa

---

## Current Architecture

### Backend (`backend/`)

| Component | Technology | Location |
|-----------|-----------|----------|
| HTTP Framework | Fiber v2 | `backend/main.go` |
| Database | SQLite (mattn/go-sqlite3) | `db/sqlite.go` |
| WebSocket | gorilla/websocket | `handlers/websocket.go` |
| Auth | JWT + Refresh tokens | `middleware/auth.go` |
| E2E Encryption | RSA + AES | `handlers/e2e.go` |
| Email Verification | SMTP | `handlers/email.go` |
| Payments | YooKassa | `handlers/payment.go` |
| Bot API | REST + webhooks | `handlers/botapi.go` |
| Stories | Media + expiry | `handlers/stories.go` |
| Captcha | Math-based | `handlers/captcha.go` |
| Moderation | Ban/mute/kick | `handlers/moderation.go` |

### Frontend (`frontend/`)

| Component | Technology | Location |
|-----------|-----------|----------|
| Framework | React 19 + TypeScript | `src/App.tsx` |
| State | Zustand | `src/stores/` |
| Styling | TailwindCSS v4 | `src/index.css` |
| PWA | vite-plugin-pwa | `src/lib/pwa.ts` |
| i18n | Custom Zustand | `src/lib/i18n.ts` |
| WebSocket | Custom client | `src/lib/socket.ts` |
| API Client | Custom | `src/lib/api/` |

---

## Known Remaining Issues

### Low Priority (backend)

| Issue | Location | Description |
|-------|----------|-------------|
| Race condition | `smart_folders.go:86` | `count >= 50` check not atomic |
| No graceful shutdown | `payment.go` | `webhookRateLimit` goroutine has no context cancellation |

### Low Priority (frontend)

| Issue | Location | Description |
|-------|----------|-------------|
| `escapeJSON` in messages | `handlers/messages.go:20-27` | Hand-rolled JSON escaping |

---

## Future Work

### Phase 1: Infrastructure
- [ ] **TURN server** — WebRTC calls behind NATs
- [ ] **ffmpeg integration** — Video transcoding
- [ ] **Structured logging** — Replace `fmt.Println` with zerolog/slog

### Phase 2: Media
- [ ] **Image conversion** — PNG→AVIF, GIF→WebP
- [ ] **Thumbnail generation** — Auto-generate video/image thumbnails

### Phase 3: Features
- [ ] **Push notifications** — Web Push with VAPID
- [ ] **Admin panel** — Web dashboard for moderation, analytics
- [ ] **2FA** — Two-factor authentication
- [ ] **Session management** — Device list, remote logout

### Phase 4: Bot API
- [ ] **Inline mode** — Bots respond to @mentions
- [ ] **File handling** — Bot upload/download APIs
