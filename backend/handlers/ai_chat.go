package handlers

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/ai"
	"nexo/db"
	"nexo/middleware"
	"nexo/models"
)

// ─── Нексо AI chat ──────────────────────────────────────────────────────
// POST /api/ai/chat — chat with the built-in AI assistant.
// Anti-abuse limits:
//   - Free users: AI_FREE_DAILY_LIMIT (default 30) messages per day
//   - Premium users: AI_PREMIUM_DAILY_LIMIT (default 500) messages per day
//   - Per-user burst rate limit: AI_BURST_LIMIT (default 6) in AI_BURST_WINDOW (60s)
//   - Max prompt length: 2000 runes
//   - Max history messages: 20

const (
	aiKVCountPrefix   = "ai:count:"
	aiKVCooldownPrefix = "ai:cooldown:"
	aiDefaultFree     = 30
	aiDefaultPremium  = 500
	aiMaxPromptRunes  = 2000
	aiMaxHistory      = 20
	aiCooldown        = 10 * time.Second
	aiHistoryLimit    = 100 // messages kept in DB per user
)

func aiEnvInt(key string, def int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return n
		}
	}
	return def
}

type aiChatRequest struct {
	Messages []aiChatMsg `json:"messages"`
	ChatID   string      `json:"chatId"`
}

type aiChatMsg struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// aiUsageForUser returns (usedToday, dailyLimit, isPremium)
func aiUsageForUser(user *models.User) (int, int, bool) {
	isPremium := user.IsPremium
	if user.PremiumUntil != nil && user.PremiumUntil.Before(time.Now()) {
		isPremium = false
	}

	limit := aiEnvInt("AI_FREE_DAILY_LIMIT", aiDefaultFree)
	if isPremium {
		limit = aiEnvInt("AI_PREMIUM_DAILY_LIMIT", aiDefaultPremium)
	}

	key := aiKVCountPrefix + user.ID
	raw, _ := db.KVGet(key)
	used := 0
	if raw != "" {
		used, _ = strconv.Atoi(raw)
	}
	return used, limit, isPremium
}

// aiIncrementUsage bumps the daily counter (TTL 24h).
func aiIncrementUsage(userID string) {
	key := aiKVCountPrefix + userID
	raw, _ := db.KVGet(key)
	used := 0
	if raw != "" {
		used, _ = strconv.Atoi(raw)
	}
	used++
	db.KVPut(key, strconv.Itoa(used), 24*60*60)
}

// aiBurstCheck enforces a short per-user cooldown between requests.
func aiBurstCheck(userID string) bool {
	key := aiKVCooldownPrefix + userID
	raw, err := db.KVGet(key)
	if err == nil && raw != "" {
		if ts, err := strconv.ParseInt(raw, 10, 64); err == nil {
			if time.Since(time.Unix(ts, 0)) < aiCooldown {
				return false
			}
		}
	}
	db.KVPut(key, strconv.FormatInt(time.Now().Unix(), 10), 60)
	return true
}

// aiSaveMessage persists one AI chat message and trims history to aiHistoryLimit.
func aiSaveMessage(userID, role, content string) {
	msg := models.AIMessage{
		ID:      generateID(),
		UserID:  userID,
		Role:    role,
		Content: content,
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		log.Printf("[AI] failed to save %s message for user=%s: %v", role, userID, err)
		return
	}
	// Keep only the last aiHistoryLimit messages per user.
	var count int64
	db.GetDB().Model(&models.AIMessage{}).Where("user_id = ?", userID).Count(&count)
	if count > aiHistoryLimit {
		var oldest []models.AIMessage
		db.GetDB().Where("user_id = ?", userID).
			Order("created_at ASC").
			Limit(int(count - aiHistoryLimit)).
			Find(&oldest)
		for _, o := range oldest {
			db.GetDB().Delete(&models.AIMessage{}, "id = ?", o.ID)
		}
	}
}

// aiGetHistory returns the last aiHistoryLimit messages for a user, oldest first.
func aiGetHistory(userID string) []models.AIMessage {
	var msgs []models.AIMessage
	db.GetDB().Where("user_id = ?", userID).
		Order("created_at ASC").
		Limit(aiHistoryLimit).
		Find(&msgs)
	return msgs
}

// HandleAIHistory is GET /api/ai/history — returns the user's persisted AI chat history.
func HandleAIHistory(c *fiber.Ctx) error {
	userID := middleware.UserIDFromCtx(c)
	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	return c.JSON(fiber.Map{"messages": aiGetHistory(userID)})
}

// HandleAIClearHistory is DELETE /api/ai/history — wipes the user's AI chat history.
func HandleAIClearHistory(c *fiber.Ctx) error {
	userID := middleware.UserIDFromCtx(c)
	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}
	if err := db.GetDB().Where("user_id = ?", userID).Delete(&models.AIMessage{}).Error; err != nil {
		log.Printf("[AI] failed to clear history for user=%s: %v", userID, err)
		return c.Status(500).JSON(fiber.Map{"error": "failed to clear history"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// HandleAIChat is the HTTP handler for POST /api/ai/chat.
func HandleAIChat(c *fiber.Ctx) error {
	userID := middleware.UserIDFromCtx(c)
	if userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "unauthorized"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "user not found"})
	}

	// Parse request
	var req aiChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid request body"})
	}
	if len(req.Messages) == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "messages are required"})
	}

	// Validate messages, take last N
	messages := req.Messages
	if len(messages) > aiMaxHistory {
		messages = messages[len(messages)-aiMaxHistory:]
	}
	totalRunes := 0
	lastUserContent := ""
	for i := range messages {
		content := strings.TrimSpace(messages[i].Content)
		if content == "" {
			return c.Status(400).JSON(fiber.Map{"error": "empty message content"})
		}
		if messages[i].Role != "user" && messages[i].Role != "assistant" && messages[i].Role != "system" {
			return c.Status(400).JSON(fiber.Map{"error": "invalid message role"})
		}
		if len([]rune(content)) > aiMaxPromptRunes {
			messages[i].Content = string([]rune(content)[:aiMaxPromptRunes])
		}
		totalRunes += len([]rune(messages[i].Content))
		if messages[i].Role == "user" {
			lastUserContent = messages[i].Content
		}
	}
	if totalRunes > 4*aiMaxPromptRunes {
		return c.Status(400).JSON(fiber.Map{"error": "message history too large"})
	}
	if lastUserContent == "" {
		return c.Status(400).JSON(fiber.Map{"error": "no user message"})
	}

	// Persist the user's message server-side.
	aiSaveMessage(userID, "user", lastUserContent)

	// Anti-abuse: cooldown between requests
	if !aiBurstCheck(userID) {
		return c.Status(429).JSON(fiber.Map{
			"error":    "Слишком часто. Подождите немного и повторите.",
			"cooldown": true,
		})
	}

	// Anti-abuse: daily quota
	used, limit, isPremium := aiUsageForUser(&user)
	if used >= limit {
		return c.Status(429).JSON(fiber.Map{
			"error":     "Дневной лимит сообщений Нексо AI исчерпан",
			"limit":     limit,
			"used":      used,
			"premium":   isPremium,
			"limitHit":  true,
		})
	}

	// Build prompt: system + conversation history
	system := `Ты — Нексо AI, умный ИИ-ассистент защищённого мессенджера Нексо (Dark Heavens Corporate).
Отвечай на русском языке, если пользователь не попросил иначе.
Будь дружелюбным, полезным и точным. Отвечай кратко и по делу, но полно.
Не выдавай себя за человека. При необходимости можешь использовать Markdown для структурирования ответа.`

	conversation := make([]ai.ChatMessage, 0, len(messages)+1)
	conversation = append(conversation, ai.ChatMessage{Role: "system", Content: system})
	for _, m := range messages {
		conversation = append(conversation, ai.ChatMessage{Role: m.Role, Content: m.Content})
	}

	client := ai.NewLLMClient()
	reply, provider, err := client.Chat(conversation)
	if err != nil {
		log.Printf("[AI] chat error user=%s: %v", userID, err)
		return c.Status(502).JSON(fiber.Map{"error": "AI service temporarily unavailable"})
	}

	aiIncrementUsage(userID)

	// Persist the assistant's reply server-side.
	aiSaveMessage(userID, "assistant", reply)

	remaining := limit - used - 1
	if remaining < 0 {
		remaining = 0
	}

	return c.JSON(fiber.Map{
		"reply":     reply,
		"provider":  provider,
		"used":      used + 1,
		"limit":     limit,
		"remaining": remaining,
		"premium":   isPremium,
	})
}
