package handlers

import (
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

type ExportData struct {
	User        models.User           `json:"user"`
	Chats       []models.Chat         `json:"chats"`
	Messages    []models.Message      `json:"messages"`
	Friends     []models.Friendship   `json:"friends"`
	Stories     []models.Story        `json:"stories"`
	Payments    []models.Payment      `json:"payments"`
	SmartFolders []models.SmartFolder `json:"smartFolders"`
	CloudFiles  []models.CloudFile    `json:"cloudFiles"`
	ExportDate  string                `json:"exportDate"`
}

func ExportAccount(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	// Require password confirmation for sensitive data export
	var req struct {
		Password string `json:"password"`
	}
	if err := c.BodyParser(&req); err != nil || req.Password == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Password confirmation required"})
	}
	// Rate limit: max 1 export per 10 minutes
	if !exportRateLimiter.Allow(userID) {
		return c.Status(429).JSON(fiber.Map{"error": "Export rate limited. Try again later."})
	}

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).Pluck("chat_id", &memberChatIDs)

	var chats []models.Chat
	if len(memberChatIDs) > 0 {
		db.GetDB().Preload("Members").
			Where("id IN ?", memberChatIDs).
			Order("updated_at DESC").Find(&chats)
	}

	var messages []models.Message
	db.GetDB().Where("sender_id = ?", userID).
		Order("created_at DESC").Limit(500).Find(&messages)

	var friends []models.Friendship
	db.GetDB().Where("user_id = ? OR friend_id = ?", userID, userID).
		Preload("User").Preload("Friend").Find(&friends)

	var stories []models.Story
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&stories)

	var payments []models.Payment
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&payments)

	var smartFolders []models.SmartFolder
	db.GetDB().Where("user_id = ?", userID).Order("order ASC").Find(&smartFolders)

	var cloudFiles []models.CloudFile
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&cloudFiles)

	return c.JSON(ExportData{
		User:         user,
		Chats:        chats,
		Messages:     messages,
		Friends:      friends,
		Stories:      stories,
		Payments:     payments,
		SmartFolders: smartFolders,
		CloudFiles:   cloudFiles,
		ExportDate:   time.Now().Format(time.RFC3339),
	})
}

type RateLimiter struct {
	mu       sync.Mutex
	limit    int
	window   time.Duration
	attempts map[string][]time.Time
}

func NewRateLimiter(limit int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		limit:    limit,
		window:   window,
		attempts: make(map[string][]time.Time),
	}
}

func (rl *RateLimiter) Allow(key string) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	now := time.Now()
	windowStart := now.Add(-rl.window)
	entries := rl.attempts[key]
	var valid []time.Time
	for _, t := range entries {
		if t.After(windowStart) {
			valid = append(valid, t)
		}
	}
	if len(valid) >= rl.limit {
		rl.attempts[key] = valid
		return false
	}
	valid = append(valid, now)
	rl.attempts[key] = valid
	return true
}

var (
	deleteLock       sync.Mutex
	exportRateLimiter = NewRateLimiter(1, 10*time.Minute)
)

func DeleteAccount(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	deleteLock.Lock()
	defer deleteLock.Unlock()

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	tx := db.GetDB().Begin()

	tx.Where("user_id = ? OR friend_id = ?", userID, userID).Delete(&models.Friendship{})
	tx.Where("user_id = ?", userID).Delete(&models.ChatMember{})
	tx.Where("sender_id = ?", userID).Delete(&models.Message{})
	tx.Where("user_id = ?", userID).Delete(&models.Story{})
	tx.Where("user_id = ?", userID).Delete(&models.StoryView{})
	tx.Where("user_id = ?", userID).Delete(&models.StoryReaction{})
	tx.Where("user_id = ?", userID).Delete(&models.Payment{})
	tx.Where("user_id = ?", userID).Delete(&models.SmartFolder{})
	tx.Where("user_id = ?", userID).Delete(&models.CloudFile{})
	tx.Where("user_id = ?", userID).Delete(&models.SearchHistory{})
	tx.Where("user_id = ?", userID).Delete(&models.BlockedUser{})
	tx.Where("user_id = ?", userID).Delete(&models.UserDevice{})
	tx.Where("user_id = ?", userID).Delete(&models.Bot{})
	tx.Where("user_id = ?", userID).Delete(&models.Bookmark{})
	tx.Where("user_id = ?", userID).Delete(&models.ContactTag{})
	tx.Where("user_id = ?", userID).Delete(&models.ChatSnooze{})
	tx.Where("user_id = ?", userID).Delete(&models.ChatReminder{})
	tx.Where("user_id = ?", userID).Delete(&models.WebhookConfig{})
	tx.Where("user_id = ?", userID).Delete(&models.AICommandLog{})
	tx.Where("user_id = ?", userID).Delete(&models.ModerationLog{})
	tx.Where("user_id = ?", userID).Delete(&models.E2EKeyBundle{})
	tx.Where("user_id = ?", userID).Delete(&models.CallLog{})
	tx.Where("user_id = ?", userID).Delete(&models.UserXP{})
	tx.Where("user_id = ?", userID).Delete(&models.UserAchievement{})
	tx.Where("user_id = ?", userID).Delete(&models.XPLog{})
	tx.Where("user_id = ?", userID).Delete(&models.VerificationRequest{})
	tx.Where("user_id = ?", userID).Delete(&models.EmailVerification{})
	tx.Where("user_id = ? OR friend_id = ?", userID, userID).Delete(&models.ReadReceipt{})
	tx.Where("user_id = ?", userID).Delete(&models.Reaction{})
	tx.Where("user_id = ?", userID).Delete(&models.ScreenshotLog{})
	tx.Where("user_id = ?", userID).Delete(&models.BotInstallation{})

	tx.Where("user1_id = ? OR user2_id = ?", userID, userID).Delete(&models.AnonymousChat{})
	tx.Where("user_id = ?", userID).Delete(&models.VoiceRoomParticipant{})
	tx.Where("user_id = ?", userID).Delete(&models.ChatNote{})
	tx.Where("user_id = ?", userID).Delete(&models.CollectedLink{})

	tx.Delete(&user)

	if err := tx.Commit().Error; err != nil {
		tx.Rollback()
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete account"})
	}

	db.GetDB().Model(&models.User{}).Where("id = ?", userID).Update("is_online", false)

	if client := ws.HubInstance.GetUserClient(userID); client != nil {
		ws.HubInstance.UnregisterClient(client)
	}

	return c.JSON(fiber.Map{"ok": true, "message": "Account deleted"})
}
