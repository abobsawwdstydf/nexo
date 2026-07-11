# NEXO Messenger — Comprehensive Implementation Plan

> **Generated**: 2026-07-07
> **Project Root**: `E:\проекты пеепе шнейне втфаааа\Нексо\Нексо`
> **Stack**: Node.js + Express + Socket.IO + Prisma + PostgreSQL | React 19 + Vite 6 + TailwindCSS 4 + Zustand

---

## Table of Contents

1. [Phase 1: Infrastructure](#phase-1-infrastructure)
2. [Phase 2: Media Conversion](#phase-2-media-conversion)
3. [Phase 3: Security Hardening](#phase-3-security-hardening)
4. [Phase 4: Bot API & Search Enhancement](#phase-4-bot-api--search-enhancement)

---

## Phase 1: Infrastructure

> **Goal**: Activate Redis fully, add TURN server for WebRTC, install ffmpeg for video processing.
> **Dependencies**: None — this phase is a prerequisite for Phases 2-4.
> **Estimated Complexity**: Medium

### 1.1 Activate Redis for Socket Rate Limiting

**Current State**: `src/socket/middleware/rateLimiter.ts` uses `Map<string, {...}>` (in-memory only). Redis is used for auth tokens/sessions via `src/lib/redis.ts` already.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/socket/middleware/rateLimiter.ts` | **MODIFY** | Replace in-memory `rateLimitMap` / `callRateLimitMap` with Redis-backed `store` from `src/lib/redis.ts`. Use atomic `INCR` + `EXPIRE` pattern. Keep in-memory as fallback when Redis is unavailable. |

**Implementation Details**:
```typescript
// In rateLimiter.ts — replace Map with Redis store
import { store } from '../lib/redis';

const RATE_LIMIT_KEY = (userId: string) => `nexo:socket_ratelimit:${userId}`;
const CALL_RATE_LIMIT_KEY = (userId: string) => `nexo:socket_call_ratelimit:${userId}`;

export async function checkRateLimit(userId: string): Promise<boolean> {
  const key = RATE_LIMIT_KEY(userId);
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, 1); // 1 second window
  return count <= RATE_LIMIT_MAX;
}
```

**New npm packages**: None.

**Complexity**: Simple  
**Estimated time**: 1-2 hours

---

### 1.2 Add TURN Server Configuration for WebRTC

**Current State**: `config.ts` has `turnUrl`, `turnSecret`, `stunUrls` fields but `.env` has NO `TURN_URL` or `TURN_SECRET` set. WebRTC calls will not work behind NATs.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `.env` | **MODIFY** | Add `TURN_URL`, `TURN_SECRET`, `STUN_URLS` for coturn. |
| `docker-compose.yml` | **MODIFY** | Add `coturn` service with configuration. |
| `src/config.ts` | **NO CHANGE** | Already reads `TURN_URL`, `TURN_SECRET`, `STUN_URLS` from env. |
| `src/socket/handlers/calls.ts` | **REVIEW** | Ensure TURN credentials are passed to clients via ICE server config. |

**TURN Docker Configuration** (add to docker-compose.yml):
```yaml
coturn:
  image: coturn/coturn
  container_name: nexo-coturn
  restart: unless-stopped
  ports:
    - "3478:3478"
    - "3478:3478/udp"
    - "5349:5349"
  volumes:
    - ./coturn/turnserver.conf:/etc/coturn/turnserver.conf
```

**Complexity**: Medium  
**Estimated time**: 2-3 hours

---

### 1.3 Install ffmpeg for Video Processing

**Current State**: No ffmpeg in `package.json` or `docker-compose.yml`. `sharp` (libvips) handles images only. Video files are stored as-is with no transcoding.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `docker-compose.yml` | **MODIFY** | Add `ffmpeg` installation to a build stage, or create a separate worker container. |
| `package.json` | **MODIFY** | Add `fluent-ffmpeg` for programmatic ffmpeg control. |
| `src/lib/videoProcessor.ts` | **CREATE** | New service wrapping ffmpeg operations (probe, transcode, thumbnail). |
| `src/config.ts` | **MODIFY** | Add `ffmpegPath` config field. |

**Implementation Approach**: Use `fluent-ffmpeg` npm package which wraps system ffmpeg. For Docker deployments, add ffmpeg to the container image. For local dev, require ffmpeg installed on PATH.

**New npm packages**:
- `fluent-ffmpeg` (^2.1.3) — programmatic ffmpeg wrapper
- `@types/fluent-ffmpeg` (devDependency)

**Complexity**: Medium  
**Estimated time**: 2-3 hours

---

## Phase 2: Media Conversion

> **Goal**: Auto-convert images (PNG->AVIF, GIF->WebP) and videos (->AV1/VP9) on upload. Serve downloads in original format.
> **Dependencies**: Phase 1.3 (ffmpeg installation) for video conversion. Image conversion uses `sharp` (already installed).
> **Estimated Complexity**: Complex

### 2.1 Database Schema Update

**Current State**: `LocalFile` model has `originalName`, `mimeType`, `totalSize` but no fields for tracking converted versions or original format.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | **MODIFY** | Add fields to `LocalFile` model. |

**Schema Changes** (add to `LocalFile` model):
```prisma
model LocalFile {
  // ... existing fields ...
  originalFormat    String?   // Original MIME type before conversion (e.g., "image/png")
  convertedFormat   String?   // Converted MIME type (e.g., "image/avif")
  convertedPath     String?   // Path to converted file on disk
  conversionStatus  String?   @default("none") // "none", "pending", "completed", "failed"
  conversionError   String?   // Error message if conversion failed
  originalWidth     Int?      // Original image/video width
  originalHeight    Int?      // Original image/video height
}
```

**Migration**: `npx prisma migrate dev --name add-media-conversion-fields`

**Complexity**: Simple  
**Estimated time**: 30 minutes

---

### 2.2 Image Conversion Service

**Current State**: `sharp` v0.34.5 is installed. Supports AVIF output. GIF->WebP animated requires sharp with libvips (already included).

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/lib/mediaConverter.ts` | **CREATE** | Central conversion service for images. |
| `src/lib/localStorage.ts` | **MODIFY** | Call conversion after `uploadFile()`. |
| `src/routes/files.ts` | **MODIFY** | On download, detect `originalFormat` and reverse-convert if needed. |

**Image Conversion Rules**:

| Input Format | Output Format | Method | Config |
|-------------|---------------|--------|--------|
| `image/png` | `image/avif` | `sharp(buffer).avif(...)` | Lossless or near-lossless, quality 85 |
| `image/gif` | `image/webp` | `sharp(buffer, { animated: true }).webp(...)` | Animated WebP, quality 80 |
| `image/jpeg` | No conversion | Serve as-is | -- |
| `image/webp` | No conversion | Serve as-is | -- |

**Implementation for `src/lib/mediaConverter.ts`**:
```typescript
import sharp from 'sharp';

interface ConversionResult {
  buffer: Buffer;
  mimeType: string;
  width: number;
  height: number;
}

export async function convertImage(
  inputBuffer: Buffer, 
  inputMimeType: string
): Promise<ConversionResult | null> {
  switch (inputMimeType) {
    case 'image/png':
      return convertPngToAvif(inputBuffer);
    case 'image/gif':
      return convertGifToAnimatedWebP(inputBuffer);
    default:
      return null; // No conversion needed
  }
}

async function convertPngToAvif(buffer: Buffer): Promise<ConversionResult> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const avifBuffer = await image
    .avif({ quality: 85, lossless: true, effort: 6 })
    .toBuffer();
  return {
    buffer: avifBuffer,
    mimeType: 'image/avif',
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}

async function convertGifToAnimatedWebP(buffer: Buffer): Promise<ConversionResult> {
  const image = sharp(buffer, { animated: true });
  const metadata = await image.metadata();
  const webpBuffer = await image
    .webp({ quality: 80, effort: 6 })
    .toBuffer();
  return {
    buffer: webpBuffer,
    mimeType: 'image/webp',
    width: metadata.width || 0,
    height: metadata.height || 0,
  };
}
```

**Download Reverse-Conversion** (in `src/routes/files.ts`):
- When `localFile.originalFormat` differs from stored format, convert back to original on-the-fly
- Cache converted buffers in memory (LRU) or on disk for repeat downloads
- Add `?format=original` query param to force original format download

**New npm packages**: None (sharp already handles AVIF and WebP).

**Complexity**: Complex  
**Estimated time**: 4-6 hours

---

### 2.3 Video Conversion Service

**Current State**: Videos are stored raw. No ffmpeg. After Phase 1.3, ffmpeg will be available.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/lib/videoProcessor.ts` | **CREATE** | ffmpeg wrapper for probe, transcode, thumbnail. |
| `src/lib/mediaConverter.ts` | **MODIFY** | Add video conversion functions that call `videoProcessor`. |
| `src/routes/messages.ts` | **MODIFY** | In upload handler, enqueue video files for async conversion. |
| `src/routes/files.ts` | **MODIFY** | Serve original format on download (same as images). |

**Video Conversion Rules**:

| Input | Priority Output | Fallback | Container | Codec |
|-------|----------------|----------|-----------|-------|
| Any video | AV1 in MP4 | VP9 in WebM | `.mp4` / `.webm` | libsvtav1 / libvpx-vp9 |

**Implementation** (`src/lib/videoProcessor.ts`):
```typescript
import ffmpeg from 'fluent-ffmpeg';

export interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  codec: string;
  bitrate: number;
}

export async function probeVideo(inputPath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(inputPath, (err, metadata) => {
      if (err) return reject(err);
      const video = metadata.streams.find(s => s.codec_type === 'video');
      resolve({
        duration: metadata.format.duration || 0,
        width: video?.width || 0,
        height: video?.height || 0,
        codec: video?.codec_name || 'unknown',
        bitrate: metadata.format.bit_rate ? parseInt(String(metadata.format.bit_rate)) : 0,
      });
    });
  });
}

export async function transcodeToAv1(
  inputPath: string, outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libsvtav1')
      .outputOptions(['-crf', '30', '-preset', '6', '-movflags', '+faststart', '-an'])
      .format('mp4')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function transcodeToVp9Fallback(
  inputPath: string, outputPath: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .videoCodec('libvpx-vp9')
      .outputOptions(['-crf', '30', '-b:v', '0', '-deadline', 'realtime'])
      .format('webm')
      .output(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

export async function extractThumbnail(
  inputPath: string, outputPath: string, timeSeconds: number = 1
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({ timestamps: [timeSeconds], filename: outputPath, size: '320x240' })
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}
```

**Async Processing Queue**: Videos should be converted asynchronously to avoid blocking the upload response. Use a simple in-memory queue with concurrency limit, or leverage Redis-backed Bull queue.

**New npm packages**:
- `fluent-ffmpeg` (^2.1.3)
- `@types/fluent-ffmpeg` (devDependency)

**Complexity**: Complex  
**Estimated time**: 6-8 hours

---

### 2.4 Static Asset Conversion

**Current State**: Static files (logo, stickers, animated emojis) are served from `public/` directory as-is.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `scripts/convert-static-assets.ts` | **CREATE** | One-time script to convert existing static assets. |
| `web/public/` | **MODIFY** | Replace PNG/GIF with AVIF/WebP versions after conversion. |

**Static Conversion Rules**:

| Asset Type | Current | Target | Notes |
|-----------|---------|--------|-------|
| Logo (`logo.png`) | PNG | AVIF | Lossless |
| Stickers (`*.png`) | PNG | AVIF | Lossless or near-lossless |
| Animated emojis (`*.gif`) | GIF | WebP | Animated WebP |
| Static emojis (`*.png`) | PNG | AVIF | Lossless |

**Note**: Client-side must support `<picture>` elements with AVIF/WebP fallbacks, or use Content Negotiation on the server to serve the best format the client supports. Check `Accept` header.

**Complexity**: Medium  
**Estimated time**: 2-3 hours

---

## Phase 3: Security Hardening

> **Goal**: Complete moderation handlers, enforce ban checks on HTTP, harden report routes, expand privacy settings.
> **Dependencies**: None (can be done in parallel with Phase 2).
> **Estimated Complexity**: Complex

### 3.1 Complete Moderation Socket Handlers

**Current State**: `src/socket/handlers/moderation.ts` is a no-op stub (10 lines, empty function).

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/socket/handlers/moderation.ts` | **MODIFY** | Implement ban_user, mute_user, kick_user, slow_mode handlers. |

**Implementation Plan**:

```typescript
// moderation.ts — full implementation
import { Server } from 'socket.io';
import { AuthSocket } from '../shared';
import { prisma } from '../db';
import { store } from '../lib/redis';

interface ModerationEvent {
  chatId: string;
  targetUserId: string;
  duration?: number; // minutes, null = permanent
  reason?: string;
}

export function setupModerationHandlers(io: Server, socket: AuthSocket) {
  const userId = socket.userId!;

  // BAN USER
  socket.on('ban_user', async (data: ModerationEvent) => {
    try {
      // 1. Verify sender is admin/owner of chat
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: data.chatId, userId } },
      });
      if (!member || !['owner', 'admin'].includes(member.role)) {
        socket.emit('error', { message: 'No moderation permissions' });
        return;
      }

      // 2. Ban target user
      const expiresAt = data.duration
        ? new Date(Date.now() + data.duration * 60 * 1000)
        : null;

      await prisma.user.update({
        where: { id: data.targetUserId },
        data: {
          isBanned: true,
          banReason: data.reason || 'Moderation ban',
          banExpiresAt: expiresAt,
          bannedAt: new Date(),
          bannedBy: userId,
        },
      });

      // 3. Create UserBan record
      await prisma.userBan.create({
        data: {
          userId: data.targetUserId,
          reason: data.reason || 'Moderation ban',
          expiresAt,
          bannedBy: userId,
        },
      });

      // 4. Cache ban in Redis for HTTP enforcement
      await store.set(
        `nexo:ban_check:${data.targetUserId}`,
        'banned',
        data.duration ? data.duration * 60 : 86400
      );

      // 5. Notify chat
      io.to(data.chatId).emit('moderation_action', {
        action: 'ban',
        targetUserId: data.targetUserId,
        byUserId: userId,
        reason: data.reason,
      });
    } catch (error) {
      console.error('Ban user error:', error);
      socket.emit('error', { message: 'Ban error' });
    }
  });

  // MUTE USER
  socket.on('mute_user', async (data: ModerationEvent) => {
    try {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: data.chatId, userId } },
      });
      if (!member || !['owner', 'admin'].includes(member.role)) {
        socket.emit('error', { message: 'No moderation permissions' });
        return;
      }

      const durationSec = data.duration ? data.duration * 60 : 3600;
      await store.set(
        `nexo:mute:${data.chatId}:${data.targetUserId}`,
        JSON.stringify({ mutedBy: userId }),
        durationSec
      );

      io.to(data.chatId).emit('moderation_action', {
        action: 'mute',
        targetUserId: data.targetUserId,
        byUserId: userId,
        duration: durationSec,
      });
    } catch (error) {
      console.error('Mute user error:', error);
      socket.emit('error', { message: 'Mute error' });
    }
  });

  // KICK USER
  socket.on('kick_user', async (data: ModerationEvent) => {
    try {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: data.chatId, userId } },
      });
      if (!member || !['owner', 'admin'].includes(member.role)) {
        socket.emit('error', { message: 'No moderation permissions' });
        return;
      }

      await prisma.chatMember.delete({
        where: { chatId_userId: { chatId: data.chatId, userId: data.targetUserId } },
      });

      await prisma.chat.update({
        where: { id: data.chatId },
        data: { subscribersCount: { decrement: 1 } },
      });

      io.to(data.chatId).emit('moderation_action', {
        action: 'kick',
        targetUserId: data.targetUserId,
        byUserId: userId,
      });
    } catch (error) {
      console.error('Kick user error:', error);
      socket.emit('error', { message: 'Kick error' });
    }
  });

  // SLOW MODE
  socket.on('slow_mode', async (data: { chatId: string; interval: number }) => {
    try {
      const member = await prisma.chatMember.findUnique({
        where: { chatId_userId: { chatId: data.chatId, userId } },
      });
      if (!member || !['owner', 'admin'].includes(member.role)) {
        socket.emit('error', { message: 'No moderation permissions' });
        return;
      }

      await prisma.chat.update({
        where: { id: data.chatId },
        data: { slowModeInterval: data.interval },
      });

      io.to(data.chatId).emit('moderation_action', {
        action: 'slow_mode',
        interval: data.interval,
        byUserId: userId,
      });
    } catch (error) {
      console.error('Slow mode error:', error);
      socket.emit('error', { message: 'Slow mode error' });
    }
  });
}
```

**New npm packages**: None.

**Complexity**: Complex  
**Estimated time**: 4-6 hours

---

### 3.2 Enforce Ban Checks on HTTP API

**Current State**: `src/middleware/auth.ts` verifies JWT tokens but does NOT check `isBanned`. Banned users can still make HTTP requests. Socket connections DO check bans (in `src/socket/index.ts` lines 58-79).

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/middleware/auth.ts` | **MODIFY** | Add ban check in `authenticateToken` after JWT verification. |

**Implementation** (insert after `decoded.userId` is set, before `next()`):
```typescript
// Check Redis cache first (fast path)
const banCacheKey = `nexo:ban_check:${decoded.userId}`;
const cachedBan = await store.get(banCacheKey);
if (cachedBan === 'banned') {
  res.status(403).json({ error: 'Account is banned' });
  return;
}

// If not cached, check DB (slow path) and cache result
const user = await prisma.user.findUnique({
  where: { id: decoded.userId },
  select: { isBanned: true, banExpiresAt: true },
});

if (user?.isBanned) {
  if (user.banExpiresAt && user.banExpiresAt < new Date()) {
    // Ban expired — auto-unban
    await prisma.user.update({
      where: { id: decoded.userId },
      data: { isBanned: false, banReason: null, banExpiresAt: null },
    });
  } else {
    // Cache ban status for 60 seconds
    await store.set(banCacheKey, 'banned', 60);
    res.status(403).json({
      error: 'Account is banned',
      reason: 'Your account has been banned by a moderator',
      banExpiresAt: user.banExpiresAt,
    });
    return;
  }
} else {
  // Cache "not banned" for 60 seconds to avoid repeated DB hits
  await store.set(banCacheKey, 'ok', 60);
}
```

**New npm packages**: None.

**Complexity**: Medium  
**Estimated time**: 2-3 hours

---

### 3.3 Add Admin Auth to Report Routes

**Current State**: `src/routes/reports.ts` has no admin check on GET `/` (list reports) or POST `/:reportId/action` (process report). Any authenticated user can view/process all reports.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/routes/reports.ts` | **MODIFY** | Add admin check middleware to admin-only endpoints. |

**Implementation**:
```typescript
import { isUserAdmin } from '../middleware/auth';

async function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.isAdmin) return next(); // Admin token auth

  const admin = await isUserAdmin(req.userId!);
  if (!admin) {
    return res.status(403).json({ error: 'Admin permissions required' });
  }
  next();
}

// Apply to admin-only routes:
router.get('/', authenticateToken, requireAdmin, async (req, res) => { ... });
router.post('/:reportId/action', authenticateToken, requireAdmin, async (req, res) => { ... });
router.get('/stats', authenticateToken, requireAdmin, async (req, res) => { ... });
```

**New npm packages**: None.

**Complexity**: Simple  
**Estimated time**: 1-2 hours

---

### 3.4 Expand Privacy Settings

**Current State**: `UserPrivacySettings` has only 5 boolean fields: `hideOnline`, `hideTyping`, `hideReadReceipts`, `allowForwarding`, `allowScreenshots`.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | **MODIFY** | Add privacy fields to `UserPrivacySettings`. |
| `src/routes/privacy.ts` | **MODIFY** | Add new privacy settings. |
| `web/src/components/PrivacySettings.tsx` | **MODIFY** | Add UI for new settings. |

**New Privacy Fields** (add to `UserPrivacySettings` model):
```prisma
model UserPrivacySettings {
  // ... existing fields ...
  whoCanMessage       String    @default("everyone")  // "everyone", "friends", "nobody"
  whoCanCall          String    @default("everyone")  // "everyone", "friends", "nobody"
  whoCanSeeProfile    String    @default("everyone")  // "everyone", "friends"
  showLastSeen        Boolean   @default(true)
  showAvatar          Boolean   @default(true)
  allowGroupInvites   Boolean   @default(true)
  allowVoiceMessages  Boolean   @default(true)
}
```

**Enforcement Points**: These settings must be checked in:
- `src/routes/messages.ts` — before sending message (whoCanMessage)
- `src/routes/chats.ts` — before creating group or inviting (whoCanMessage)
- `src/socket/handlers/calls.ts` — before initiating call (whoCanCall)
- `src/routes/users.ts` — when viewing profile (whoCanSeeProfile, showLastSeen, showAvatar)

**New npm packages**: None.

**Complexity**: Medium  
**Estimated time**: 3-4 hours

---

### 3.5 Move All Secrets to Environment Variables

**Current State**: `.env` contains Firebase service account key saved at project root (`nexo-25d8c-firebase-adminsdk-fbsvc-de9941df1b.json`). AI proxy secret exists but some values may be hardcoded elsewhere.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `.env` | **MODIFY** | Add missing env vars: `FIREBASE_SERVICE_ACCOUNT_PATH`, `ADMIN_CHECK_IP`. |
| `src/config.ts` | **MODIFY** | Add all missing env vars to config object. |
| `.gitignore` | **MODIFY** | Ensure Firebase JSON is not committed. |
| `src/index.ts` | **REVIEW** | Verify no hardcoded secrets. |

**New .env Variables**:
```env
# WebRTC
TURN_URL=turn:your-turn-server.com:3478
TURN_SECRET=your-turn-secret
STUN_URLS=stun:stun.l.google.com:19302

# Firebase
FIREBASE_SERVICE_ACCOUNT_PATH=./nexo-firebase-adminsdk.json

# Admin
ADMIN_CHECK_IP=your-admin-ip
```

**Complexity**: Simple  
**Estimated time**: 1 hour

---

## Phase 4: Bot API & Search Enhancement

> **Goal**: Implement full Bot API with webhooks, commands, and enhance message search with PostgreSQL full-text search optimization.
> **Dependencies**: None (can be done in parallel with other phases).
> **Estimated Complexity**: Complex

### 4.1 Implement Bot API

**Current State**: `src/routes/botApi.ts` is EMPTY (0 lines). Prisma schema already has `Plugin`, `PluginInstallation`, `PluginBotCommand` models.

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/routes/botApi.ts` | **REWRITE** | Full Bot API implementation. |
| `prisma/schema.prisma` | **MODIFY** | Add `Bot` model for dedicated bot registration (separate from Plugin). |
| `src/services/botService.ts` | **CREATE** | Bot management service. |
| `src/middleware/botAuth.ts` | **CREATE** | Bot token authentication middleware. |
| `src/socket/handlers/messages.ts` | **MODIFY** | Handle bot-triggered messages. |
| `web/src/pages/BotManagePage.tsx` | **CREATE** | Bot management dashboard page. |

**New Bot Schema**:
```prisma
model Bot {
  id            String   @id @default(uuid())
  name          String
  username      String   @unique  // @botname
  token         String   @unique  // Bot API token
  ownerId       String
  description   String?
  avatar        String?
  webhookUrl    String?  // For receiving updates via webhook
  isActive      Boolean  @default(true)
  botType       String   @default("webhook") // "webhook", "polling"
  commands      BotCommand[]
  installations BotInstallation[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@index([ownerId])
  @@index([username])
}

model BotCommand {
  id          String   @id @default(uuid())
  botId       String
  command     String   // e.g., "/start", "/help"
  description String?
  response    String   // Static response or template
  handlerUrl  String?  // Webhook URL for dynamic responses
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  bot Bot @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@unique([botId, command])
  @@index([botId])
}

model BotInstallation {
  id          String   @id @default(uuid())
  botId       String
  chatId      String
  installedBy String
  isActive    Boolean  @default(true)
  config      String   @default("{}")
  installedAt DateTime @default(now())

  bot Bot @relation(fields: [botId], references: [id], onDelete: Cascade)

  @@unique([botId, chatId])
  @@index([botId])
  @@index([chatId])
}
```

**Bot API Endpoints**:
```
POST   /api/bot-api/bots                    — Create new bot
GET    /api/bot-api/bots                    — List user's bots
GET    /api/bot-api/bots/:botId             — Get bot details
PUT    /api/bot-api/bots/:botId             — Update bot
DELETE /api/bot-api/bots/:botId             — Delete bot
POST   /api/bot-api/bots/:botId/regenerate-token — Regenerate token

POST   /api/bot-api/bots/:botId/commands    — Add command
GET    /api/bot-api/bots/:botId/commands    — List commands
DELETE /api/bot-api/bots/:botId/commands/:cmd — Remove command

POST   /api/bot-api/bots/:botId/install     — Install bot to chat
DELETE /api/bot-api/bots/:botId/uninstall   — Uninstall bot from chat

// Bot-to-server communication (authenticated with bot token):
GET    /api/bot-api/getMe                   — Get bot info
POST   /api/bot-api/sendMessage             — Send message to chat
POST   /api/bot-api/editMessage             — Edit message
DELETE /api/bot-api/deleteMessage           — Delete message
GET    /api/bot-api/getUpdates              — Long polling for updates
POST   /api/bot-api/setWebhook              — Set webhook URL
DELETE /api/bot-api/deleteWebhook           — Remove webhook
```

**Webhook Flow**:
1. Bot sends `POST /api/bot-api/setWebhook` with URL
2. When bot receives a message/command, NEXO sends `POST <webhookUrl>` with update payload
3. Bot responds via `POST /api/bot-api/sendMessage`

**Message Handling** (in `src/socket/handlers/messages.ts`):
```typescript
// After saving message, check if it starts with a bot command
if (message.content?.startsWith('/')) {
  const [command, ...args] = message.content.split(' ');
  const installations = await prisma.botInstallation.findMany({
    where: { chatId: message.chatId, isActive: true },
    include: { bot: { include: { commands: true } } },
  });

  for (const installation of installations) {
    const matchingCmd = installation.bot.commands.find(
      c => c.command === command.toLowerCase() && c.isActive
    );
    if (matchingCmd) {
      if (matchingCmd.handlerUrl) {
        // Forward to bot's webhook
        await axios.post(matchingCmd.handlerUrl, {
          message, command, args,
          chat: message.chat,
        });
      } else if (matchingCmd.response) {
        // Send static response
        // ... send message as bot
      }
    }
  }
}
```

**New npm packages**: None (axios already installed).

**Complexity**: Complex  
**Estimated time**: 8-10 hours

---

### 4.2 Enhance Message Search

**Current State**: `src/routes/search.ts` uses PostgreSQL FTS with `MessageFTS` table and LIKE fallback. `src/routes/searchEnhanced.ts` adds highlighting and more filters. Both use Prisma's `$queryRaw` for FTS.

**Issues Found**:
1. FTS query construction could be vulnerable to edge cases
2. No search result caching
3. No relevance scoring beyond default FTS rank
4. Search history not stored

**Changes**:

| File | Action | Description |
|------|--------|-------------|
| `src/routes/search.ts` | **MODIFY** | Improve FTS query, add caching. |
| `src/routes/searchEnhanced.ts` | **MODIFY** | Add search history, suggestions. |
| `prisma/schema.prisma` | **MODIFY** | Add `SearchHistory` model. |
| `src/lib/searchCache.ts` | **CREATE** | Redis-backed search result cache. |

**Search History Schema**:
```prisma
model SearchHistory {
  id          String   @id @default(uuid())
  userId      String
  query       String
  type        String?  // "messages", "media", "users", "chats"
  resultCount Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([userId])
  @@index([userId, createdAt])
}
```

**Search Cache** (`src/lib/searchCache.ts`):
```typescript
import { store } from './redis';

const SEARCH_CACHE_TTL = 300; // 5 minutes

export async function getCachedSearch(
  userId: string,
  query: string,
  type: string
): Promise<any | null> {
  const key = `nexo:search:${userId}:${type}:${Buffer.from(query).toString('base64').slice(0, 64)}`;
  const cached = await store.get(key);
  return cached ? JSON.parse(cached) : null;
}

export async function setCachedSearch(
  userId: string,
  query: string,
  type: string,
  results: any
): Promise<void> {
  const key = `nexo:search:${userId}:${type}:${Buffer.from(query).toString('base64').slice(0, 64)}`;
  await store.set(key, JSON.stringify(results), SEARCH_CACHE_TTL);
}
```

**New Search Features**:
- Search across media file names (via `MediaIndex` model)
- Search by sender username
- Search result suggestions based on popular searches
- "Did you mean?" fuzzy matching
- Search within specific date ranges (already partially implemented)
- Search history with recent queries

**New npm packages**: None.

**Complexity**: Medium  
**Estimated time**: 4-5 hours

---

### 4.3 Redis-Backed Socket Rate Limiting (Per-Event)

This extends Phase 1.1 with per-event-type rate limiting:

| Event Type | Window | Max Requests | Notes |
|-----------|--------|-------------|-------|
| `send_message` | 1s | 5 | Prevent message spam |
| `typing_start` | 10s | 3 | Typing indicator |
| `call_*` | 5s | 3 | Call actions |
| `moderation_*` | 1s | 2 | Moderation actions |
| `presence_update` | 30s | 1 | Status updates |

**Implementation**: Extend `src/socket/middleware/rateLimiter.ts` with per-event-type limiters, all backed by Redis.

---

## Implementation Order & Dependencies

```
Phase 1 (Infrastructure)
  1.1 Redis Rate Limiting ----------+
  1.2 TURN Server -----------------+-- Can be parallelized
  1.3 ffmpeg Installation ----------+
                                     |
Phase 2 (Media Conversion) ----------+
  2.1 Schema Update ----------------+-- Must come first in Phase 2
  2.2 Image Conversion -------------+-- Depends on 2.1
  2.3 Video Conversion -------------+-- Depends on 1.3 + 2.1
  2.4 Static Assets ----------------+-- Depends on 2.2

Phase 3 (Security) -----------------+-- Can start immediately
  3.1 Moderation Handlers ----------+-- Independent
  3.2 Ban Enforcement ---------------+-- Independent
  3.3 Report Admin Auth -------------+-- Independent
  3.4 Privacy Expansion -------------+-- Independent
  3.5 Secret Env Vars ---------------+-- Independent

Phase 4 (Bot API & Search) ----------+-- Can start immediately
  4.1 Bot API ----------------------+-- Independent
  4.2 Search Enhancement ------------+-- Independent
  4.3 Redis Socket Rate Limits ------+-- Depends on 1.1
```

---

## Testing Checkpoints

### After Phase 1:
- [ ] Redis rate limiting works under load (test with `artillery`)
- [ ] TURN server provides ICE candidates (test with WebRTC peer connection)
- [ ] ffmpeg probe/transcode works on sample videos

### After Phase 2:
- [ ] PNG upload -> stored as AVIF, download returns PNG
- [ ] GIF upload -> stored as WebP, download returns GIF
- [ ] Video upload -> transcodes to AV1/VP9, download returns original
- [ ] Static sticker files served as AVIF/WebP with Accept header fallback
- [ ] Large files (50MB+) convert without timeout

### After Phase 3:
- [ ] Banned users cannot access any HTTP endpoint
- [ ] Moderation ban/mute/kick/slow_mode work via socket
- [ ] Reports require admin auth
- [ ] Privacy settings enforced (e.g., "friends only" messaging blocks strangers)

### After Phase 4:
- [ ] Bot created -> commands registered -> bot receives messages -> responds
- [ ] Webhook bot receives updates at configured URL
- [ ] Search returns relevant results with highlighting
- [ ] Search cache reduces DB queries on repeat searches

---

## Summary: All Files to Create/Modify

### New Files (8):
1. `src/lib/mediaConverter.ts` — Image conversion service
2. `src/lib/videoProcessor.ts` — Video processing service
3. `src/lib/searchCache.ts` — Search result caching
4. `src/services/botService.ts` — Bot management service
5. `src/middleware/botAuth.ts` — Bot token authentication
6. `scripts/convert-static-assets.ts` — Static asset conversion script
7. `coturn/turnserver.conf` — TURN server configuration
8. `web/src/pages/BotManagePage.tsx` — Bot management dashboard

### Modified Files (16):
1. `prisma/schema.prisma` — Add conversion fields, Bot/Privacy/SearchHistory models
2. `src/socket/middleware/rateLimiter.ts` — Redis-backed rate limiting
3. `src/socket/handlers/moderation.ts` — Full moderation implementation
4. `src/middleware/auth.ts` — Ban enforcement
5. `src/routes/reports.ts` — Admin auth middleware
6. `src/routes/auth.ts` — Auth endpoints
7. `src/routes/files.ts` — Conversion-aware download
8. `src/routes/messages.ts` — Conversion enqueue on upload
9. `src/routes/botApi.ts` — Full Bot API
10. `src/routes/privacy.ts` — Expanded privacy settings
11. `src/routes/search.ts` — Improved FTS + caching
12. `src/routes/searchEnhanced.ts` — Search history
13. `src/config.ts` — New env vars
14. `docker-compose.yml` — coturn service
15. `.env` — New environment variables
16. `package.json` — New dependencies

### New npm Packages (2):
1. `fluent-ffmpeg` — Video processing
2. `@types/fluent-ffmpeg` (dev) — Type definitions

### Estimated Total Time:
- Phase 1: 5-8 hours
- Phase 2: 12-17 hours
- Phase 3: 17-23 hours
- Phase 4: 12-15 hours
- **Grand Total: 46-63 hours**
