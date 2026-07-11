package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/joho/godotenv"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/compress"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	"github.com/gofiber/websocket/v2"

	"nexo/db"
	"nexo/handlers"
	"nexo/middleware"
	"nexo/ws"
)

func main() {
	// Load .env file if it exists
	godotenv.Load()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3001"
	}

	dbURL := os.Getenv("DATABASE_URL")
	if dbURL == "" {
		dbURL = "postgresql://nexouser:nexopass@localhost:5432/nexodb"
	}

	db.Init(dbURL)
	middleware.InitJWT()

	// Start bot health checker (checks every 12 hours)
	handlers.StartHealthChecker()

	ws.HubInstance = ws.NewHub()
	go ws.HubInstance.Run()

	app := fiber.New(fiber.Config{
		AppName:      "Nexo Messenger",
		BodyLimit:    50 * 1024 * 1024,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	})

	// Middleware
	app.Use(recover.New())
	app.Use(compress.New(compress.Config{
		Level: compress.LevelBestSpeed,
	}))
	// CORS — whitelist from env
	corsOrigins := os.Getenv("CORS_ORIGINS")
	if corsOrigins == "" {
		corsOrigins = "http://localhost:*"
	}
	app.Use(cors.New(cors.Config{
		AllowOrigins:     corsOrigins,
		AllowMethods:     "GET,POST,PUT,PATCH,DELETE,OPTIONS",
		AllowHeaders:     "Origin,Content-Type,Accept,Authorization",
		AllowCredentials: true,
	}))
	app.Use(limiter.New(limiter.Config{
		Max:        100,
		Expiration: 1 * time.Minute,
	}))

	// Static files - uploads
	uploadsDir := "./uploads"
	os.MkdirAll(uploadsDir, 0755)
	app.Static("/uploads", uploadsDir)

	// Sticker proxy (caches remote stickers to avoid rate limits)
	app.Get("/stickers/proxy/:name", handlers.StickerProxy)

	// Health check
	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{"status": "ok", "engine": "go", "version": "1.0.0"})
	})

	// Bot health status (public)
	app.Get("/api/bot/status", handlers.CheckBotStatus)

	// API routes
	api := app.Group("/api")

	// CAPTCHA (public)
	api.Get("/captcha/generate", handlers.GenerateCaptcha)
	api.Post("/captcha/verify", handlers.VerifyCaptcha)

	// Auth (public) — rate limited: 5 attempts per minute per IP
	api.Post("/auth/register", handlers.AuthRateLimit(5, time.Minute), handlers.Register)
	api.Post("/auth/login", handlers.AuthRateLimit(5, time.Minute), handlers.Login)
	api.Post("/auth/login/confirm", handlers.AuthRateLimit(10, time.Minute), handlers.LoginConfirm)
	api.Post("/auth/refresh", handlers.RefreshToken)
	api.Post("/auth/email/send-code", handlers.AuthRateLimit(3, 15*time.Minute), handlers.SendEmailCode)
	api.Post("/auth/email/confirm", handlers.AuthRateLimit(5, time.Minute), handlers.ConfirmEmailCode)

	// Protected routes
	auth := api.Group("", middleware.AuthenticateToken)
	auth.Get("/users/me", handlers.GetProfile)
	auth.Put("/users/me", handlers.UpdateProfile)
	auth.Post("/auth/logout", handlers.Logout)
	auth.Get("/users/search", handlers.SearchUsers)

	// Settings & Notifications (BEFORE /:id to prevent wildcard conflict)
	auth.Get("/users/settings", handlers.GetUserSettings)
	auth.Put("/users/settings", handlers.UpdateUserSettings)
	auth.Get("/users/notifications", handlers.GetUserNotifications)

	// Global password
	auth.Post("/users/global-password", handlers.SetGlobalPassword)
	auth.Delete("/users/global-password", handlers.RemoveGlobalPassword)

	// User by ID (MUST be after /settings, /notifications, /search, /me)
	auth.Get("/users/:id", handlers.GetUser)

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

	auth.Post("/chats", handlers.CreateChat)
	auth.Get("/chats", handlers.GetChats)
	auth.Get("/chats/:id", handlers.GetChat)
	auth.Post("/chats/:id/members", handlers.AddChatMember)
	auth.Post("/chats/:id/leave", handlers.LeaveChat)
	auth.Post("/chats/:id/pin", handlers.PinChat)
	auth.Post("/chats/:id/archive", handlers.ArchiveChat)
	auth.Post("/chats/:id/mute", handlers.MuteChat)

	auth.Post("/chats/:id/messages", handlers.SendMessage)
	auth.Get("/chats/:id/messages", handlers.GetMessages)
	auth.Put("/messages/:messageId", handlers.EditMessage)
	auth.Delete("/messages/:messageId", handlers.DeleteMessage)
	auth.Post("/messages/:messageId/reactions", handlers.AddReaction)
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

	// ─── New Features ─────────────────────────────────────────────────────

	// File Upload
	auth.Post("/upload", handlers.UploadFile)

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

	// WebSocket
	app.Get("/ws/chat", websocket.New(handlers.HandleWebSocket))

	// Frontend - serve from web/dist
	frontendDir := "./web/dist"
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

		log.Printf("Frontend: serving from %s", frontendDir)
	} else {
		log.Printf("Frontend: not found at %s (running in API-only mode)", frontendDir)
	}

	log.Printf("Nexo Messenger starting on port %s", port)
	log.Println("Database: connected")

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Shutting down server...")
		ws.HubInstance.Stop()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := app.ShutdownWithContext(ctx); err != nil {
			log.Printf("Server forced to shutdown: %v", err)
		}
	}()

	if err := app.Listen(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
	log.Println("Server stopped gracefully")
}
