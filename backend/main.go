package main

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"html"
	"os"
	"os/signal"
	"runtime"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"
	"github.com/joho/godotenv"
	"golang.org/x/net/idna"

	"nexo/ai"
	"nexo/beta"
	"nexo/db"
	"nexo/handlers"
	"nexo/middleware"
	"nexo/ws"
	"nexo/logging"
)

func generateSessionID() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		// Fallback: time-based hash (never blocks critical flows on RNG failure)
		h := sha256.Sum256([]byte(time.Now().UTC().Format(time.RFC3339Nano)))
		return hex.EncodeToString(h[:])
	}
	return hex.EncodeToString(b)
}

// Simple in-process metrics (real counters)
var (
	httpRequestsTotal    atomic.Uint64
	httpRequestsInFlight atomic.Int64
	metricsStartTime     = time.Now()
)

// Build info — задаётся через -ldflags "-X main.buildCommit=..." либо env
// APP_VERSION / GIT_COMMIT / BUILD_TIME. По нему в UI видно, новый ли релиз.
var (
	buildVersion = "dev"
	buildCommit  = "unknown"
	buildTime    = ""
)

func init() {
	if v := os.Getenv("APP_VERSION"); v != "" {
		buildVersion = v
	}
	if c := os.Getenv("GIT_COMMIT"); c != "" {
		buildCommit = c
	}
	if t := os.Getenv("BUILD_TIME"); t != "" {
		buildTime = t
	}
}

	// fatalLog logs a startup error and exits the process.
func fatalLog(msg string, err error) {
	logging.Log.Error(msg, "err", err)
	os.Exit(1)
}

func metricsMiddleware(c *fiber.Ctx) error {
	httpRequestsTotal.Add(1)
	httpRequestsInFlight.Add(1)
	defer httpRequestsInFlight.Add(-1)
	return c.Next()
}

func main() {
	// Load .env file if it exists
	godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	// Initialize local database (SQLite)
	dbPath := os.Getenv("DATABASE_URL")
	if dbPath == "" {
		dbPath = "nexo.db"
	}
	if err := db.InitLocal(dbPath); err != nil {
		fatalLog("Failed to initialize database", err)
	}

	// Initialize local KV store
	if err := db.InitLocalKV(); err != nil {
		fatalLog("Failed to initialize KV store", err)
	}

	if err := middleware.InitJWT(); err != nil {
		fatalLog("Failed to initialize JWT", err)
	}

	// Initialize Web Push (VAPID)
	handlers.InitPush()

	// Initialize beta config
	beta.Init()

	// Initialize AI agent (LLM + Browser)
	ai.InitConfig()
	logging.Log.Info("AI agent: initialized (LLM + browser embedded)")

	// Start bot health checker (checks every 12 hours)
	handlers.StartHealthChecker()

	// Start reminder checker (checks every 30 seconds)
	handlers.StartReminderLoop()

	// Start scheduled messages delivery (checks every 15 seconds)
	handlers.StartScheduledMessagesLoop()

	// Start dead man switch checker (checks every 60 seconds)
	handlers.StartDeadManSwitchLoop()

	// Start self-destruct message expiry (checks every 5 seconds)
	handlers.StartSelfDestructLoop()

	// Start webhook idempotency lock cleanup (checks every 10 minutes)
	handlers.StartWebhookLockCleanup()

	handlers.StartChunkCleaner()

	ws.HubInstance = ws.NewHub()
	go ws.HubInstance.Run()

	app := fiber.New(fiber.Config{
		AppName: "Nexo Messenger",
		// Chat attachments are validated per file in handlers.UploadFile (up to
		// 500MB video). The transport limit must cover the largest allowed file
		// plus multipart overhead, hence 600MB.
		BodyLimit:    600 * 1024 * 1024,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	})

	// Initialize security middleware
	// Derive the request-signing secret from JWT_SECRET so signatures stay
	// valid across restarts (a random per-process secret broke them).
	jwtSecret := os.Getenv("JWT_SECRET")
	secretSum := sha256.Sum256([]byte(jwtSecret))
	middleware.InitRequestSigning(secretSum[:])

	// Middleware
	app.Use(metricsMiddleware)
	app.Use(middleware.StructuredLogging())
	app.Use(recover.New())
	app.Use(compress.New(compress.Config{
		Level: compress.LevelDefault,
	}))
	// CORS — production domains only
	allowedDomains := map[string]bool{
		"nexo.hakerone.ru":           true,
		"nexo.darkheavens.ru":        true,
		"xn--e1akhgo.hakerone.ru":    true,
		"xn--e1akhgo.darkheavens.ru": true,
		"msg.hakerone.ru":            true,
		"msg.darkheavens.ru":         true,
		"nneexion.darkheavens.ru":    true,
		"n.hakerone.ru":              true,
		"n.darkheavens.ru":           true,
		"neexxoo.hakerone.ru":        true,
	}
	// Also load from CORS_ORIGINS env (comma-separated)
	if corsEnv := os.Getenv("CORS_ORIGINS"); corsEnv != "" {
		for _, o := range strings.Split(corsEnv, ",") {
			o = strings.TrimSpace(o)
			o = strings.TrimPrefix(o, "https://")
			o = strings.TrimPrefix(o, "http://")
			if o != "" {
				allowedDomains[o] = true
			}
		}
	}
	app.Use(cors.New(cors.Config{
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization,X-CSRF-Token,X-Request-Timestamp,X-Request-Signature,X-Dev-Key,X-Dev-Login-Key",
		AllowCredentials: true,
		AllowOriginsFunc: func(origin string) bool {
			if origin == "" {
				return false
			}
			trimmed := strings.TrimPrefix(origin, "https://")
			trimmed = strings.TrimPrefix(trimmed, "http://")
			trimmed = strings.TrimSuffix(trimmed, "/")
			// Normalize IDN (Unicode) origins to punycode, e.g. нексо.hakerone.ru -> xn--e1akhgo.hakerone.ru
			if ascii, err := idna.ToASCII(strings.ToLower(trimmed)); err == nil {
				trimmed = ascii
			}
			for domain := range allowedDomains {
				if trimmed == domain {
					return true
				}
			}
			return false
		},
	}))
	// Rate limiter. Behind Cloudflare the remote IP is a shared edge IP, so
	// all users would hit the same bucket. When CLIENT_IP_HEADER is set
	// (e.g. "cf-connecting-ip" or "x-forwarded-for") and the deployment is
	// behind a proxy that overwrites that header, key by it instead.
	limiterConfig := limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
	}
	if clientIPHeader := os.Getenv("CLIENT_IP_HEADER"); clientIPHeader != "" {
		limiterConfig.KeyGenerator = func(c *fiber.Ctx) string {
			if v := c.Get(clientIPHeader); v != "" {
				return v
			}
			return c.IP()
		}
	}
	app.Use(limiter.New(limiterConfig))

	// Security middleware stack
	app.Use(middleware.SecurityHeaders())
	app.Use(middleware.IPBlockMiddleware())
	app.Use(middleware.PathTraversalProtection())
	app.Use(middleware.SQLInjectionProtection())
	app.Use(middleware.XSSProtection())
	app.Use(middleware.InputSanitization())
	app.Use(middleware.RequestSizeLimit(600 * 1024 * 1024))
	app.Use(middleware.VerifyRequestSignature)

	// Ensure uploads directory exists
	os.MkdirAll(handlers.UploadDir(), 0755)

	// Sticker proxy (caches remote stickers to avoid rate limits)
	app.Get("/stickers/proxy/:name", handlers.StickerProxy)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "engine": "go", "version": "2.0.0", "commit": buildCommit})
	})

	// Version info (public) — идентификатор релиза для фронта.
	// В браузере отдаёт страницу с одним лишь номером идентификатора,
	// для API-клиентов (фронтенд) — JSON.
	app.Get("/api/version", func(c *fiber.Ctx) error {
		if strings.Contains(c.Get("Accept", ""), "text/html") {
			c.Set("Content-Type", "text/html; charset=utf-8")
			return c.SendString(fmt.Sprintf(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>Нексо · идентификатор версии</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0f;color:#fff;font-family:system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.box{text-align:center;padding:40px;border-radius:24px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);backdrop-filter:blur(8px)}
.id{font:700 52px/1.1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.08em;color:#7B61FF;word-break:break-all}
.label{margin-top:12px;font-size:12px;text-transform:uppercase;letter-spacing:.18em;color:rgba(255,255,255,.35)}
</style>
</head>
<body><div class="box"><div class="id">%s</div><div class="label">%s</div></div></body>
</html>`, html.EscapeString(buildCommit), html.EscapeString(buildVersion)))
		}
		return c.JSON(fiber.Map{
			"app":       "nexo-backend",
			"version":   buildVersion,
			"commit":    buildCommit,
			"buildTime": buildTime,
		})
	})

	// CSRF token endpoint
	app.Get("/api/csrf-token", func(c *fiber.Ctx) error {
		sessionID := generateSessionID()
		token := middleware.GenerateCSRFToken(sessionID)
		return c.JSON(fiber.Map{"token": token, "sessionId": sessionID})
	})

	// Prometheus-compatible metrics endpoint (real counters)
	app.Get("/metrics", func(c *fiber.Ctx) error {
		c.Type("text/plain; version=0.0.4")
		var ms runtime.MemStats
		runtime.ReadMemStats(&ms)
		return c.SendString(fmt.Sprintf(`# HELP nexo_http_requests_total Total HTTP requests handled
# TYPE nexo_http_requests_total counter
nexo_http_requests_total %d
# HELP nexo_http_requests_in_flight Currently in-flight HTTP requests
# TYPE nexo_http_requests_in_flight gauge
nexo_http_requests_in_flight %d
# HELP nexo_uptime_seconds Server uptime in seconds
# TYPE nexo_uptime_seconds gauge
nexo_uptime_seconds %d
# HELP nexo_memory_alloc_bytes Current heap allocation in bytes
# TYPE nexo_memory_alloc_bytes gauge
nexo_memory_alloc_bytes %d
# HELP nexo_up Server is up
# TYPE nexo_up gauge
nexo_up 1
`, httpRequestsTotal.Load(), httpRequestsInFlight.Load(), int64(time.Since(metricsStartTime).Seconds()), ms.Alloc))
	})

	// Bot health status (public)
	app.Get("/api/bot/status", handlers.CheckBotStatus)

	// Beta status (public)
	app.Get("/api/beta/status", handlers.GetBetaStatus)

	// API routes
	api := app.Group("/api")

	// Beta guard — блокирует все API после окончания беты
	api.Use(beta.BetaGuard())

	// GIF search/trending proxy (Tenor HTML scrape, no API key) — public, BEFORE auth group
	api.Get("/stickers/gifs/trending", handlers.GifsTrending)
	api.Get("/stickers/gifs/search", handlers.GifsSearch)

	// CAPTCHA (public)
	api.Get("/captcha/generate", handlers.GenerateCaptcha)
	api.Post("/captcha/verify", handlers.VerifyCaptcha)

	// Email availability check (public, for registration)
	api.Get("/auth/check-email", handlers.CheckEmailAvailability)
	api.Get("/auth/check-username", handlers.CheckUsername)

	// VAPID public key (public, for push subscriptions)
	api.Get("/vapid-public-key", handlers.GetVapidPublicKey)

	// Bot API (Telegram-совместимый, токен в URL: /api/bot/:token/:method) — public, BEFORE auth group
	api.All("/bot/:token/:method", handlers.BotAPI)
	app.Get("/file/:token/*", handlers.BotFile)

	// Auth (public) — rate limited: 5 attempts per minute per IP
	api.Post("/auth/register", handlers.AuthRateLimit(5, time.Minute), handlers.Register)
	api.Post("/auth/login/code", handlers.AuthRateLimit(5, time.Minute), handlers.SendLoginCode)
	api.Post("/auth/login/confirm", handlers.AuthRateLimit(10, time.Minute), handlers.LoginConfirm)
	api.Post("/auth/refresh", handlers.AuthRateLimit(10, time.Minute), handlers.RefreshToken)
	api.Post("/auth/login/totp", handlers.AuthRateLimit(10, time.Minute), handlers.Login2FA)
	api.Post("/auth/email/send-code", handlers.AuthRateLimit(3, 15*time.Minute), handlers.SendEmailCode)
	api.Post("/auth/email/confirm", handlers.AuthRateLimit(5, time.Minute), handlers.ConfirmEmailCode)

	// Dev-only login — роут существует ТОЛЬКО при DEV_LOGIN_KEY в окружении
	// (в проде переменная не задана, поэтому /api/dev/login туда не попадает)
	if os.Getenv("DEV_LOGIN_KEY") != "" {
		api.Post("/dev/login", handlers.DevLogin)
	}

	// Invite links: public info lookup + protected management/join
	api.Get("/invite/:code", handlers.GetInviteInfo)

	// Protected routes
	auth := api.Group("", middleware.AuthenticateToken, middleware.CSRFProtection())
	auth.Get("/init", handlers.GetInit)
	auth.Get("/users/me", handlers.GetProfile)
	auth.Put("/users/me", handlers.UpdateProfile)
	auth.Post("/auth/logout", handlers.Logout)
	auth.Get("/users/search", handlers.SearchUsers)

	// Settings & Notifications (BEFORE /:id to prevent wildcard conflict)
	auth.Get("/users/settings", handlers.GetUserSettings)
	auth.Put("/users/settings", handlers.UpdateUserSettings)
	auth.Get("/users/notifications", handlers.GetUserNotifications)

	// Directories (must be registered before /users/:id and /sticker-packs/:packId)
	auth.Get("/channels/directory", handlers.ChannelDirectory)
	auth.Post("/channels/:id/subscribe", handlers.SubscribeToChannel)
	auth.Get("/sticker-packs/directory", handlers.StickerDirectory)

	// TOTP 2FA management
	auth.Post("/2fa/setup", handlers.Setup2FA)
	auth.Post("/2fa/verify", handlers.Verify2FA)
	auth.Post("/2fa/disable", handlers.Disable2FA)
	auth.Post("/users/push-subscription", handlers.SavePushSubscriptionHandler)
	auth.Delete("/users/push-subscription", handlers.DeletePushSubscriptionHandler)

	// User by ID (MUST be after /settings, /notifications, /search, /me)
	auth.Get("/users/:id", handlers.GetUser)

	// Account
	auth.Get("/account/export", handlers.ExportAccount)
	auth.Post("/account/export2", handlers.ExportAccountZip)
	auth.Post("/account/import", handlers.ImportAccountZip)
	auth.Delete("/account/delete", handlers.DeleteAccount)

	// Verification
	auth.Post("/verify/request", handlers.RequestVerification)
	auth.Post("/verify/confirm", handlers.ConfirmVerification)

	// Payments & Premium
	auth.Get("/premium/status", handlers.GetPremiumStatus)
	auth.Post("/premium/payment", handlers.CreatePayment)
	auth.Get("/premium/prices", handlers.GetPremiumPrices)
	auth.Get("/premium/history", handlers.GetPaymentHistory)

	// YooKassa webhook (public)
	app.Post("/webhook/yookassa", handlers.YooKassaWebhook)

	// Нексо AI chat (protected)
	auth.Post("/ai/chat", handlers.HandleAIChat)
	auth.Get("/ai/history", handlers.HandleAIHistory)
	auth.Delete("/ai/history", handlers.HandleAIClearHistory)

	auth.Post("/chats", handlers.CreateChat)
	auth.Get("/chats", handlers.GetChats)
	auth.Post("/chats/favorites", handlers.GetOrCreateFavorites) // BEFORE /chats/:id
	auth.Get("/chats/:id", handlers.GetChat)
	auth.Post("/chats/:id/members", handlers.AddChatMember)
	auth.Post("/chats/:id/invite-links", handlers.CreateInviteLink)
	auth.Get("/chats/:id/invite-links", handlers.GetInviteLinks)
	auth.Delete("/chats/:id/invite-links/:code", handlers.RevokeInviteLink)
	auth.Post("/invite/:code/join", handlers.JoinInvite)
	auth.Post("/chats/:id/leave", handlers.LeaveChat)
	auth.Post("/chats/:id/pin", handlers.PinChat)
	auth.Post("/chats/:id/archive", handlers.ArchiveChat)
	auth.Post("/chats/:id/mute", handlers.MuteChat)
	auth.Put("/chats/:id/mute", handlers.SetChatMute) // server-side mute (source of truth)

	auth.Post("/chats/:id/messages", handlers.SendMessage)
	auth.Get("/chats/:id/messages", handlers.GetMessages)
	auth.Post("/chats/:chatId/comments/:messageId/open", handlers.OpenComments)
	auth.Put("/messages/:messageId", handlers.EditMessage)
	auth.Delete("/messages/:messageId", handlers.DeleteMessage)
	auth.Patch("/messages/:messageId/self-destruct", handlers.SetMessageSelfDestruct)
	auth.Post("/messages/:messageId/reactions", handlers.AddReaction)
	auth.Delete("/messages/:messageId/reactions/:emoji", handlers.RemoveReaction)
	auth.Post("/reactions/:messageId", handlers.AddReaction)
	auth.Delete("/reactions/:messageId/:emoji", handlers.RemoveReaction)
	auth.Post("/chats/:id/read", handlers.ReadMessages)
	auth.Post("/chats/:id/typing", handlers.Typing)
	auth.Get("/messages/search", handlers.SearchMessages)

	auth.Post("/stories", handlers.CreateStory)
	auth.Get("/stories", handlers.GetStories)
	auth.Post("/stories/:id/view", handlers.ViewStory)
	auth.Post("/stories/:id/reactions", handlers.AddStoryReaction)
	auth.Delete("/stories/:id", handlers.DeleteStory)

	auth.Post("/friends/request", handlers.SendFriendRequest)
	auth.Post("/friends/request/:id/accept", handlers.AcceptFriendRequest)
	auth.Post("/friends/request/:id/reject", handlers.RejectFriendRequest)
	auth.Delete("/friends/:id", handlers.RemoveFriend)
	auth.Get("/friends", handlers.GetFriends)
	auth.Get("/friends/requests", handlers.GetFriendRequests)

	auth.Post("/users/block", handlers.BlockUser)
	auth.Post("/users/unblock", handlers.UnblockUser)

	// ─── User sticker & emoji packs (files on the file server) ──────────
	auth.Post("/sticker-packs", handlers.CreateUserStickerPack)
	auth.Get("/sticker-packs", handlers.GetMyStickerPacks)
	auth.Post("/sticker-packs/:packId/stickers", handlers.UploadUserSticker)
	auth.Post("/sticker-packs/:packId/install", handlers.InstallStickerPack)
	auth.Delete("/sticker-packs/:packId", handlers.DeleteUserStickerPack)
	auth.Delete("/stickers/:stickerId", handlers.DeleteUserSticker)
	// Public (auth'd) list of another user's packs — used to render received
	// [mysticker:...] / [myemoji:...] tokens. Must stay after /sticker-packs.
	auth.Get("/users/:userId/sticker-packs", handlers.GetUserStickerPacks)

	// ─── New Features ─────────────────────────────────────────────────────

	// File Upload
	auth.Post("/upload", handlers.UploadFile)

// Chunked upload (large files, progress + cancel on the client)
auth.Post("/upload/chunk/init", handlers.ChunkInit)
auth.Post("/upload/chunk/:uploadId", handlers.ChunkUploadPart)
auth.Post("/upload/chunk/:uploadId/complete", handlers.ChunkComplete)
auth.Delete("/upload/chunk/:uploadId", handlers.ChunkCancel)

	// ─── Cloud Storage (Premium) ────────────────────────────────────────
	auth.Post("/cloud/upload", handlers.CloudUpload)
	auth.Get("/cloud/files", handlers.CloudList)
	auth.Delete("/cloud/:fileId", handlers.CloudDelete)
	auth.Get("/cloud/stats", handlers.CloudStats)

	// ─── Premium Badge ─────────────────────────────────────────────────
	auth.Post("/premium-badge", handlers.UploadPremiumBadge)
	auth.Delete("/premium-badge", handlers.DeletePremiumBadge)

	// Privacy Settings
	auth.Get("/users/privacy", handlers.GetPrivacySettings)
	auth.Put("/users/privacy", handlers.UpdatePrivacySettings)

	// TURN Server Credentials
	auth.Get("/turn/credentials", handlers.GetTurnCredentials)

	// Moderation
	auth.Post("/chats/:id/moderation/ban", handlers.BanUser)
	auth.Post("/chats/:id/moderation/mute", handlers.MuteUser)
	auth.Post("/chats/:id/moderation/kick", handlers.KickUser)
	auth.Post("/chats/:id/moderation/slow-mode", handlers.SetSlowMode)
	auth.Post("/chats/:id/report", handlers.ReportChat)

	// ─── Admin Badges ────────────────────────────────────────────────────
	auth.Post("/admin/badges", handlers.SetUserBadge)
	auth.Delete("/admin/badges", handlers.ClearUserBadge)
	auth.Get("/admin/reports", handlers.AdminListReports)

	// ─── System Feedback Chat ────────────────────────────────────────────
	auth.Post("/feedback/chat", handlers.GetOrCreateFeedbackChat)
	auth.Get("/admin/feedback", handlers.AdminListFeedback)
	auth.Post("/admin/feedback/:chatId/reply", handlers.AdminReplyFeedback)

	// ─── Promo codes ─────────────────────────────────────────────────────
	auth.Get("/promo/check", handlers.CheckPromoCode)
	auth.Get("/admin/promocodes", handlers.ListPromoCodes)
	auth.Post("/admin/promocodes", handlers.CreatePromoCode)
	auth.Put("/admin/promocodes/:id", handlers.UpdatePromoCode)
	auth.Delete("/admin/promocodes/:id", handlers.DeletePromoCode)

	// Bot API (user-managed)
	auth.Post("/bots", handlers.CreateBot)
	auth.Get("/bots", handlers.GetBots)
	auth.Get("/bots/:botId", handlers.GetBot)
	auth.Put("/bots/:botId", handlers.UpdateBot)
	auth.Delete("/bots/:botId", handlers.DeleteBot)
	auth.Post("/bots/:botId/regenerate-token", handlers.RegenerateBotToken)
	auth.Post("/bots/:botId/commands", handlers.AddBotCommand)
	auth.Get("/bots/:botId/commands", handlers.GetBotCommands)
	auth.Delete("/bots/:botId/commands/:cmdId", handlers.DeleteBotCommand)
	auth.Post("/bots/:botId/install", handlers.InstallBot)
	auth.Post("/bots/:botId/uninstall", handlers.UninstallBot)

	// Search History & Suggestions
	auth.Get("/search/history", handlers.GetSearchHistory)
	auth.Get("/search/suggestions", handlers.GetSearchSuggestions)

	// Bot Messaging (authenticated with bot token, not user JWT)
	api.Post("/bot/sendMessage", middleware.BotAuthenticateToken, handlers.BotSendMessage)
	api.Get("/bot/getUpdates", middleware.BotAuthenticateToken, handlers.BotGetUpdates)
	api.Post("/bot/setWebhook", middleware.BotAuthenticateToken, handlers.SetBotWebhook)
	api.Delete("/bot/deleteWebhook", middleware.BotAuthenticateToken, handlers.DeleteBotWebhook)

	// Bot API callback (нажатие inline-кнопки, авторизованный)
	auth.Post("/bots/callback", handlers.BotCallback)

	// Bot API inline-режим (композер: @bot <query>)
	auth.Post("/bots/inline", handlers.BotInline)
	auth.Post("/bots/inline/result", handlers.BotInlineResult)

	// Username aliases (premium feature)
	auth.Get("/users/me/aliases", handlers.GetUserAliases)
	auth.Post("/users/me/aliases", handlers.CreateUserAlias)
	auth.Delete("/users/me/aliases/:aliasId", handlers.DeleteUserAlias)

	// ─── Feature 1: Smart Folders ─────────────────────────────────────────
	auth.Get("/smart-folders", handlers.GetSmartFolders)
	auth.Post("/smart-folders", handlers.CreateSmartFolder)
	auth.Put("/smart-folders/:id", handlers.UpdateSmartFolder)
	auth.Delete("/smart-folders/:id", handlers.DeleteSmartFolder)
	auth.Put("/smart-folders/reorder", handlers.ReorderSmartFolders)
	auth.Get("/smart-folders/:id/chats", handlers.GetSmartFolderChats)

	// ─── Feature 2: Shared Notes ─────────────────────────────────────────
	auth.Get("/chats/:id/notes", handlers.GetChatNotes)
	auth.Post("/chats/:id/notes", handlers.CreateChatNote)
	auth.Put("/notes/:noteId", handlers.UpdateChatNote)
	auth.Delete("/notes/:noteId", handlers.DeleteChatNote)

	// ─── Feature 3: Link Collector ───────────────────────────────────────
	auth.Get("/links", handlers.GetCollectedLinks)
	auth.Post("/links/:linkId/save", handlers.SaveCollectedLink)
	auth.Get("/links/domains", handlers.GetLinkDomains)

	// ─── Feature 4: Voice Rooms ──────────────────────────────────────────
	auth.Get("/voice-rooms", handlers.GetVoiceRooms)
	auth.Post("/voice-rooms", handlers.CreateVoiceRoom)
	auth.Post("/voice-rooms/:roomId/join", handlers.JoinVoiceRoom)
	auth.Post("/voice-rooms/:roomId/leave", handlers.LeaveVoiceRoom)
	auth.Put("/voice-rooms/:roomId/participant", handlers.UpdateVoiceRoomParticipant)
	auth.Delete("/voice-rooms/:roomId", handlers.DeleteVoiceRoom)

	// ─── Feature 5: Anonymous Chats ──────────────────────────────────────
	auth.Post("/anonymous/match", handlers.FindAnonymousMatch)
	auth.Post("/anonymous/rate", handlers.RateAnonymousChat)
	auth.Get("/anonymous/chats", handlers.GetAnonymousChats)

	// ─── Feature 6: E2E Encryption ──────────────────────────────────────
	auth.Post("/e2e/keybundle", handlers.UploadKeyBundle)
	auth.Get("/e2e/keybundle/:userId", handlers.FetchKeyBundle)
	auth.Post("/e2e/keybundle/:userId/consume", handlers.ConsumeOneTimePreKey)
	auth.Post("/e2e/session", handlers.InitSession)
	auth.Get("/e2e/session/:chatId", handlers.GetSession)
	auth.Delete("/e2e/session/:chatId", handlers.DeleteSession)
	auth.Post("/e2e/group/session", handlers.InitGroupSession)
	auth.Get("/e2e/group/session/:chatId", handlers.GetGroupSession)
	auth.Post("/e2e/group/session/:chatId/rotate", handlers.RotateGroupSession)
	auth.Delete("/e2e/group/session/:chatId", handlers.DeleteGroupSession)

	// ─── Feature 7: Webhooks ─────────────────────────────────────────────
	auth.Get("/webhooks", handlers.GetWebhookConfigs)
	auth.Post("/webhooks", handlers.CreateWebhookConfig)
	auth.Delete("/webhooks/:webhookId", handlers.DeleteWebhookConfig)

	// ─── Feature: Mood Status ────────────────────────────────────────────
	auth.Post("/mood", handlers.SetMoodStatus)
	auth.Get("/mood/:userId", handlers.GetMoodStatus)

	// ─── Feature: Do Not Disturb ────────────────────────────────────────
	auth.Post("/dnd", handlers.SetDND)
	auth.Get("/settings/dnd", handlers.GetDNDSettings)
	auth.Put("/settings/dnd", handlers.UpdateDNDSettings)

	// ─── Feature: Chat Snooze ───────────────────────────────────────────
	auth.Post("/chats/:id/snooze", handlers.SetChatSnooze)
	auth.Delete("/chats/:id/snooze", handlers.RemoveChatSnooze)

	// ─── Feature: Chat Reminders ────────────────────────────────────────
	auth.Post("/reminders", handlers.CreateReminder)
	auth.Get("/reminders", handlers.GetReminders)
	auth.Delete("/reminders/:id", handlers.CancelReminder)

	// ─── Feature: Contact Color Tags ────────────────────────────────────
	auth.Post("/contact-tags", handlers.CreateContactTag)
	auth.Get("/contact-tags", handlers.GetContactTags)
	auth.Delete("/contact-tags/:id", handlers.DeleteContactTag)

	// ─── Feature: Public Interest Rooms ─────────────────────────────────
	auth.Post("/public-rooms", handlers.CreatePublicRoom)
	auth.Get("/public-rooms", handlers.GetPublicRooms)
	auth.Post("/public-rooms/:id/join", handlers.JoinPublicRoom)
	auth.Post("/public-rooms/:id/leave", handlers.LeavePublicRoom)

	// ─── Feature: Screenshot Detection ──────────────────────────────────
	auth.Post("/screenshot-notify", handlers.NotifyScreenshot)

	// ─── Feature: Self-Destruct on Read ─────────────────────────────────
	auth.Post("/messages/:id/read-destroy", handlers.MarkMessageRead)

	// ─── AI Browsing (Agent Service) ────────────────────────────────────
	auth.Post("/ai/browse", handlers.StartAIBrowse)
	auth.Get("/ai/browse/status/:id", handlers.GetAIBrowseStatus)
	auth.Get("/ai/browse/history", handlers.GetAIBrowseHistory)

	// ─── AI Features ───────────────────────────────────────────────────
	auth.Post("/ai/translate", handlers.TranslateMessage)
	auth.Post("/ai/moderate", handlers.ModerateContent)
	auth.Get("/ai/moderation/config/:chatId", handlers.GetModerationConfig)
	auth.Put("/ai/moderation/config/:chatId", handlers.SetModerationConfig)
	auth.Post("/ai/auto-reply/config", handlers.SetAutoReplyConfig)
	auth.Get("/ai/auto-reply/config", handlers.GetAutoReplyConfig)
	auth.Post("/ai/voice-command", handlers.ProcessVoiceCommand)
	auth.Post("/ai/transcribe", handlers.TranscribeAudio)
	auth.Post("/ai/smart-reminder", handlers.CreateSmartReminder)
	auth.Get("/ai/smart-reminders", handlers.GetSmartReminders)
	auth.Post("/ai/privacy-audit", handlers.RunPrivacyAudit)
	auth.Get("/ai/privacy-audit", handlers.GetPrivacyAuditResults)

	// ─── Scheduled Messages ────────────────────────────────────────────
	auth.Post("/scheduled-messages", handlers.CreateScheduledMessage)
	auth.Get("/scheduled-messages", handlers.GetScheduledMessages)
	auth.Put("/scheduled-messages/:id", handlers.EditScheduledMessage)
	auth.Delete("/scheduled-messages/:id", handlers.CancelScheduledMessage)

	// ─── Chat Themes ──────────────────────────────────────────────────
	auth.Get("/chats/:id/theme", handlers.GetChatTheme)
	auth.Post("/chats/:id/theme", handlers.SetChatTheme)
	auth.Delete("/chats/:id/theme", handlers.DeleteChatTheme)

	// ─── Kanban Boards ────────────────────────────────────────────────
	auth.Post("/kanban", handlers.CreateKanbanBoard)
	auth.Get("/kanban", handlers.GetKanbanBoards)
	auth.Get("/kanban/:boardId", handlers.GetKanbanBoard)
	auth.Post("/kanban/:boardId/tasks", handlers.CreateKanbanTask)
	auth.Put("/kanban/tasks/:taskId", handlers.UpdateKanbanTask)
	auth.Delete("/kanban/tasks/:taskId", handlers.DeleteKanbanTask)
	auth.Put("/kanban/:boardId/reorder", handlers.ReorderKanbanBoard)

	// ─── Message Bookmarks ────────────────────────────────────────────
	auth.Post("/bookmarks", handlers.CreateBookmark)
	auth.Get("/bookmarks", handlers.GetBookmarks)
	auth.Put("/bookmarks/:id", handlers.UpdateBookmark)
	auth.Delete("/bookmarks/:id", handlers.DeleteBookmark)

	// ─── Message Templates ────────────────────────────────────────────
	auth.Post("/templates", handlers.CreateTemplate)
	auth.Get("/templates", handlers.GetTemplates)
	auth.Put("/templates/:id", handlers.UpdateTemplate)
	auth.Delete("/templates/:id", handlers.DeleteTemplate)

	// ─── Calendar Events ──────────────────────────────────────────────
	auth.Post("/calendar/events", handlers.CreateCalendarEvent)
	auth.Get("/calendar/events", handlers.GetCalendarEvents)
	auth.Put("/calendar/events/:id", handlers.UpdateCalendarEvent)
	auth.Delete("/calendar/events/:id", handlers.DeleteCalendarEvent)
	auth.Post("/calendar/events/:id/rsvp", handlers.RSVPEvent)

	// ─── Photo Albums ──────────────────────────────────────────────────
	auth.Post("/albums", handlers.CreatePhotoAlbum)
	auth.Get("/albums", handlers.GetPhotoAlbums)
	auth.Get("/albums/:id", handlers.GetPhotoAlbum)
	auth.Put("/albums/:id", handlers.UpdatePhotoAlbum)
	auth.Delete("/albums/:id", handlers.DeletePhotoAlbum)
	auth.Post("/albums/:id/photos", handlers.AddPhotoToAlbum)

	// ─── Screen Recordings ────────────────────────────────────────────
	auth.Post("/screen-recordings", handlers.UploadScreenRecording)
	auth.Get("/screen-recordings", handlers.GetScreenRecordings)

	// ─── Encrypted Vault ──────────────────────────────────────────────
	auth.Post("/vault/upload", handlers.VaultUpload)
	auth.Get("/vault/files", handlers.VaultList)
	auth.Get("/vault/files/:id/download", handlers.VaultDownload)
	auth.Delete("/vault/files/:id", handlers.VaultDelete)
	auth.Get("/vault/stats", handlers.VaultStats)

	// ─── Incognito Chats ──────────────────────────────────────────────
	auth.Post("/incognito/create", handlers.CreateIncognitoChat)
	auth.Post("/incognito/join", handlers.JoinIncognitoChat)
	auth.Get("/incognito/chats", handlers.GetIncognitoChats)
	auth.Delete("/incognito/:id", handlers.LeaveIncognitoChat)

	// ─── Device Management ────────────────────────────────────────────
	auth.Get("/devices", handlers.GetDevices)
	auth.Delete("/devices/:id", handlers.RevokeDevice)
	auth.Post("/devices/check-in", handlers.DeviceCheckIn)

	// ─── Dead Man's Switch ────────────────────────────────────────────
	auth.Post("/dead-man-switch", handlers.CreateDeadManSwitch)
	auth.Get("/dead-man-switch", handlers.GetDeadManSwitch)
	auth.Put("/dead-man-switch", handlers.UpdateDeadManSwitch)
	auth.Delete("/dead-man-switch", handlers.DeleteDeadManSwitch)
	auth.Post("/dead-man-switch/check-in", handlers.DeadManSwitchCheckIn)

	// ─── Whiteboard ───────────────────────────────────────────────────
	auth.Post("/whiteboard", handlers.CreateWhiteboard)
	auth.Get("/whiteboard/:id", handlers.GetWhiteboard)
	auth.Put("/whiteboard/:id", handlers.UpdateWhiteboard)
	auth.Post("/whiteboard/:id/edit", handlers.ApplyWhiteboardEdit)
	auth.Delete("/whiteboard/:id", handlers.DeleteWhiteboard)

	// ─── Voice Room Activities ────────────────────────────────────────
	auth.Post("/voice-rooms/:roomId/activity", handlers.StartVoiceRoomActivity)
	auth.Delete("/voice-rooms/:roomId/activity", handlers.StopVoiceRoomActivity)
	auth.Get("/voice-rooms/:roomId/activity", handlers.GetVoiceRoomActivity)

	// ─── Security Audit Log ──────────────────────────────────────────
	auth.Get("/security/audit-log", func(c *fiber.Ctx) error {
		limit := 100
		if l := c.Query("limit"); l != "" {
			if n, err := strconv.Atoi(l); err == nil && n > 0 && n <= 500 {
				limit = n
			}
		}
		return c.JSON(fiber.Map{"entries": middleware.GetAuditLog(limit)})
	})

	// WebSocket
	app.Get("/ws/chat", websocket.New(handlers.HandleWebSocket))

	// Serve uploaded files (avatars, cloud storage, badges) — token-gated,
	// so unauthenticated users cannot enumerate or leech uploads
	app.Get("/uploads/*", handlers.ServeUploadedFile)

	// Frontend - serve from frontend/dist (one level up from backend)
	frontendDir := "../frontend/dist"
	if _, err := os.Stat(frontendDir); err == nil {
		// Serve static assets with long cache
		app.Static("/assets", frontendDir+"/assets")

		// Serve other static files (images, sounds, etc.)
		app.Static("/", frontendDir)

		// SPA fallback - serve index.html for all non-API routes
		app.Get("/*", func(c *fiber.Ctx) error {
			path := c.Path()
			// Skip API and WebSocket routes
			if strings.HasPrefix(path, "/api") || strings.HasPrefix(path, "/ws") || strings.HasPrefix(path, "/uploads") {
				return c.Status(404).JSON(fiber.Map{"error": "Not found"})
			}
			return c.SendFile(frontendDir + "/index.html")
		})

		logging.Log.Info("Frontend: serving", "dir", frontendDir)
	} else {
		logging.Log.Info("Frontend: not found (running in API-only mode)", "dir", frontendDir)
	}

	logging.Log.Info("Nexo Messenger starting", "port", port)
	logging.Log.Info("Database: connected")

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		logging.Log.Info("Shutting down server...")
		close(handlers.StopCh)
		ws.HubInstance.Stop()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := app.ShutdownWithContext(ctx); err != nil {
			logging.Log.Error("Server forced to shutdown", "err", err)
		}
	}()

	if err := app.Listen(":" + port); err != nil {
		fatalLog("Failed to start server", err)
	}
	logging.Log.Info("Server stopped gracefully")
}

