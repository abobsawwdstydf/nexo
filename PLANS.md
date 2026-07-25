# NEXO Messenger — Project Status & Future Plans

> **Updated**: 2026-07-24
> **Project Root**: `E:\проекты пеепе шнейне втфаааа\Нексо\Нексо`
> **Stack**: Go (Fiber) + SQLite + WebSocket | React 19 + Vite + TypeScript + Zustand

---

## Current Architecture

### Backend (`backend/`)

| Component | Technology | Location |
|-----------|-----------|----------|
| HTTP Framework | Fiber v2 | `main.go` |
| Database | SQLite (mattn/go-sqlite3) | `db/sqlite.go` |
| WebSocket | gorilla/websocket | `websocket/websocket.go` |
| Auth | JWT + Refresh tokens | `auth/jwt.go` |
| E2E Encryption | RSA + AES | `crypto/e2e.go` |
| Email Verification | SMTP | `handlers/email.go` |
| Payments | YooKassa | `handlers/payment.go` |
| Bot API | REST + webhooks | `handlers/botapi.go` |
| Stories | Media + expiry | `handlers/stories.go` |
| Captcha | Math-based | `handlers/captcha.go` |
| Moderation | Ban/mute/kick | `handlers/moderation.go` |
| Wall (feed) | Post system | `handlers/wall.go` |
| Smart Folders | Auto-categorize | `smart_folders.go` |

### Frontend (`frontend/`)

| Component | Technology | Location |
|-----------|-----------|----------|
| Framework | React 19 + TypeScript | `src/App.tsx` |
| State | Zustand (11 stores) | `src/stores/` |
| Routing | React Router v6 | lazy loading |
| Styling | TailwindCSS | |
| PWA | vite-plugin-pwa | `src/lib/pwa.ts` |
| i18n | Custom Zustand store | `src/lib/i18n.ts` |
| Encryption | Salted XOR | `src/lib/storageEncryption.ts` |
| WebSocket | Custom client | `src/lib/socket.ts` |
| API Client | Custom + refresh/retry | `src/lib/api.ts` |

---

## Completed Fixes (2026-07-24)

### Backend — Security & Error Handling (10 fixes)

1. `main.go` — Removed duplicate `Static` route
2. `main.go` — CORS config hardened (restricted origins, removed all methods/headers)
3. `db/sqlite.go` — Added SQL injection guard for backup `filePath`
4. `db/sqlite.go` — Improved backup error handling
5. `handlers/moderation.go` — Fixed variable shadowing of `log`
6. `handlers/websocket.go` — `wsResponse` type switch for safe JSON output
7. `handlers/email.go` — Timing-safe comparison via `subtle.ConstantTimeCompare`
8. `handlers/botapi.go` — JSON injection via `fmt.Sprintf` replaced with `json.Marshal`
9. `handlers/botapi.go` — Added error handling for 7 DB operations
10. `handlers/stories.go` — Capped `expiresIn` to 72 hours
11. `handlers/captcha.go` — Added `maxCaptchaEntries = 100000` size limit
12. `handlers/privacy.go` — Added `Updates()` error checking
13. `handlers/e2e.go` — Added 4 missing `json.Marshal/Unmarshal` error checks

### Frontend — Security & Quality (5 fixes)

1. `chatStore.ts:219` — Error no longer wipes all messages (`set({ messages: {} })` → `set({ isLoadingMessages: false })`)
2. `chatStore.ts` — Added missing `scrollToMessage` to interface
3. `storageEncryption.ts` — Complete rewrite: salted XOR with derived key + per-value random salt (was plaintext XOR). Backward-compatible migration from old format.
4. `voicePlayerStore.ts` — Audio memory leak fixed: `removeAttribute('src')` + `load()` fully releases media resources
5. `pwa.ts` — Blocking `confirm()` replaced with `CustomEvent('pwa-update-available')` + `applyPendingUpdate()` for non-blocking UI
6. `chatStore.ts` — 4 redundant empty `catch {}` blocks removed (inner error handling in `saveEncrypted`)

### Verification

- ✅ `go build ./...` — clean (EXIT:0)
- ✅ `npx tsc --noEmit` — clean (EXIT:0)

---

## Known Remaining Issues

### Low Priority (backend)

| Issue | Location | Description |
|-------|----------|-------------|
| Race condition | `smart_folders.go:86` | `count >= 50` check not atomic |
| No graceful shutdown | `payment.go` | `webhookRateLimit` goroutine has no context cancellation |
| Dead code | `oauth2.go` | Empty file |

### Low Priority (frontend)

| Issue | Location | Description |
|-------|----------|-------------|
| `escapeJSON` in messages | `handlers/messages.go:20-27` | Hand-rolled JSON escaping — should use `json.Marshal` |
| Amount validation | `handlers/payment.go` | Minor — YooKassa amount check exists but edge cases possible |

---

## Future Work (Not Yet Started)

### Phase 1: Infrastructure

- [ ] **Redis integration** — Currently using in-memory maps for rate limiting. Redis would enable multi-instance deployments.
- [ ] **TURN server** — WebRTC calls behind NATs need TURN. Config fields exist but no server configured.
- [ ] **ffmpeg integration** — Video files stored raw, no transcoding.
- [ ] **Structured logging** — Replace `fmt.Println` with structured logger (zerolog/slog).
- [ ] **Graceful shutdown** — HTTP and WS servers should drain connections on SIGTERM.

### Phase 2: Media

- [ ] **Image conversion** — PNG→AVIF, GIF→WebP on upload (currently raw storage).
- [ ] **Video conversion** — AV1/VP9 transcoding via ffmpeg.
- [ ] **Thumbnail generation** — Auto-generate video/image thumbnails.
- [ ] **Static asset optimization** — Logo, stickers, emojis in modern formats.

### Phase 3: Features

- [ ] **Push notifications** — Web Push with VAPID (backend implementation pending).
- [ ] **Message reactions** — Emoji reactions on messages.
- [ ] **Message threads** — Reply threading for group chats.
- [ ] **Pinned messages** — Pin important messages in chats.
- [ ] **Scheduled messages** — Send at a later time.
- [ ] **Chat folders** — User-created chat categories (similar to Telegram).
- [ ] **Voice/video calls** — WebRTC peer connections.
- [ ] **Screen sharing** — WebRTC screen capture.

### Phase 4: Security

- [ ] **Rate limiting hardening** — Per-endpoint rate limits, not just WebSocket.
- [ ] **Admin panel** — Web dashboard for moderation, user management, analytics.
- [ ] **Audit logging** — Track all moderation actions with timestamps.
- [ ] **2FA** — Two-factor authentication for accounts.
- [ ] **Session management** — Device list, remote logout.

### Phase 5: Bot API Enhancements

- [ ] **Inline mode** — Bots respond to @mentions inline.
- [ ] **Callback queries** — Interactive button callbacks.
- [ ] **File handling** — Bot upload/download APIs.
- [ ] **Group management** — Bot admin capabilities.

---

## Estimated Effort

| Phase | Priority | Estimated Hours |
|-------|----------|----------------|
| Phase 1: Infrastructure | High | 15-20h |
| Phase 2: Media | Medium | 20-25h |
| Phase 3: Features | High | 30-40h |
| Phase 4: Security | Medium | 10-15h |
| Phase 5: Bot API | Low | 15-20h |
| **Total** | | **90-120h** |
