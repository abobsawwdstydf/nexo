package handlers

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// ─── Mood Status ────────────────────────────────────────────────────────

func SetMoodStatus(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.SetMoodRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	database := db.GetDB()

	// If mood is empty string → clear mood
	if req.MoodStatus == "" {
		database.Model(&models.User{}).Where("id = ?", userID).
			Updates(map[string]interface{}{
				"mood_status":     "",
				"mood_expires_at": nil,
			})
		return c.JSON(fiber.Map{"moodStatus": "", "moodExpiresAt": nil})
	}

	database.Model(&models.User{}).Where("id = ?", userID).
		Update("mood_status", req.MoodStatus)

	var user models.User
	database.Where("id = ?", userID).First(&user)

	return c.JSON(fiber.Map{
		"moodStatus":    user.MoodStatus,
		"moodExpiresAt": user.MoodExpiresAt,
	})
}

func GetMoodStatus(c *fiber.Ctx) error {
	targetID := c.Params("userId")
	if targetID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "userId is required"})
	}

	var user models.User
	database := db.GetDB()
	if err := database.Where("id = ?", targetID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// If mood has expiry and it's past → return empty
	if user.MoodExpiresAt != nil && user.MoodExpiresAt.Before(time.Now()) {
		return c.JSON(fiber.Map{"moodStatus": "", "moodExpiresAt": nil})
	}

	return c.JSON(fiber.Map{
		"moodStatus":    user.MoodStatus,
		"moodExpiresAt": user.MoodExpiresAt,
	})
}

// ─── DND (Do Not Disturb) ──────────────────────────────────────────────

func SetDND(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		Until   string `json:"until"`   // ISO 8601 or empty to disable
		Message string `json:"message"` // auto-reply text
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	database := db.GetDB()

	if req.Until == "" {
		// Disable DND
		database.Model(&models.User{}).Where("id = ?", userID).
			Updates(map[string]interface{}{
				"dnd_until":   nil,
				"dnd_message": "",
			})
		return c.JSON(fiber.Map{"dndUntil": nil, "dndMessage": ""})
	}

	until, err := time.Parse(time.RFC3339, req.Until)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid date format, use RFC3339"})
	}

	database.Model(&models.User{}).Where("id = ?", userID).
		Updates(map[string]interface{}{
			"dnd_until":   until,
			"dnd_message": req.Message,
		})

	return c.JSON(fiber.Map{"dndUntil": until, "dndMessage": req.Message})
}

// CheckDND is a helper used by message send logic — not a route handler.
// Returns true + auto-reply message if DND is active.
func CheckDND(userID string) (bool, string) {
	var user models.User
	database := db.GetDB()
	if err := database.Where("id = ?", userID).First(&user).Error; err != nil {
		return false, ""
	}

	if user.DNDUntil != nil && user.DNDUntil.After(time.Now()) {
		msg := user.DNDMessage
		if msg == "" {
			msg = "Пользователь сейчас не беспокоит. Сообщение доставлено."
		}
		return true, msg
	}

	// DND expired → clean it up
	if user.DNDUntil != nil && user.DNDUntil.Before(time.Now()) {
		database.Model(&models.User{}).Where("id = ?", userID).
			Updates(map[string]interface{}{
				"dnd_until":   nil,
				"dnd_message": "",
			})
	}

	return false, ""
}

// ─── Chat Snooze ────────────────────────────────────────────────────────

func SetChatSnooze(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("id")

	var req models.SnoozeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Minutes <= 0 || req.Minutes > 43200 { // max 30 days
		return c.Status(400).JSON(fiber.Map{"error": "Minutes must be between 1 and 43200"})
	}

	database := db.GetDB()
	expiresAt := time.Now().Add(time.Duration(req.Minutes) * time.Minute)

	// Upsert: check existing snooze
	var existing models.ChatSnooze
	result := database.Where("user_id = ? AND chat_id = ?", userID, chatID).First(&existing)

	if result.Error == nil {
		// Update existing
		database.Model(&existing).Update("expires_at", expiresAt)
		existing.ExpiresAt = &expiresAt
		return c.JSON(existing)
	}

	// Create new
	snooze := models.ChatSnooze{
		ID:        generateID(),
		ChatID:    chatID,
		UserID:    userID,
		ExpiresAt: &expiresAt,
		CreatedAt: time.Now(),
	}
	database.Create(&snooze)

	return c.Status(201).JSON(snooze)
}

func RemoveChatSnooze(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("id")

	database := db.GetDB()
	database.Where("user_id = ? AND chat_id = ?", userID, chatID).Delete(&models.ChatSnooze{})

	return c.JSON(fiber.Map{"ok": true})
}

// IsChatSnoozed is a helper — not a route handler.
func IsChatSnoozed(userID, chatID string) (bool, time.Time) {
	var snooze models.ChatSnooze
	database := db.GetDB()

	if err := database.Where("user_id = ? AND chat_id = ?", userID, chatID).First(&snooze).Error; err != nil {
		return false, time.Time{}
	}

	if snooze.ExpiresAt != nil && snooze.ExpiresAt.After(time.Now()) {
		return true, *snooze.ExpiresAt
	}

	// Expired → clean up
	database.Delete(&snooze)
	return false, time.Time{}
}

// ─── Chat Reminders ─────────────────────────────────────────────────────

func CreateReminder(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateReminderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.MessageID == "" || req.RemindAt == "" {
		return c.Status(400).JSON(fiber.Map{"error": "messageId and remindAt are required"})
	}

	remindAt, err := time.Parse(time.RFC3339, req.RemindAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid date format"})
	}

	if remindAt.Before(time.Now()) {
		return c.Status(400).JSON(fiber.Map{"error": "Remind time must be in the future"})
	}

	database := db.GetDB()

	// Find the message to get chat_id
	var message models.Message
	if err := database.Where("id = ?", req.MessageID).First(&message).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	reminder := models.ChatReminder{
		ID:        generateID(),
		UserID:    userID,
		ChatID:    message.ChatID,
		MessageID: req.MessageID,
		RemindAt:  remindAt,
		IsSent:    false,
		CreatedAt: time.Now(),
	}
	database.Create(&reminder)

	return c.Status(201).JSON(reminder)
}

func GetReminders(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	var reminders []models.ChatReminder
	database := db.GetDB()
	database.Where("user_id = ? AND is_sent = ?", userID, false).
		Order("remind_at ASC").
		Offset(offset).Limit(limit).
		Find(&reminders)

	return c.JSON(reminders)
}

func CancelReminder(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	reminderID := c.Params("id")

	database := db.GetDB()
	result := database.Where("id = ? AND user_id = ?", reminderID, userID).
		Delete(&models.ChatReminder{})

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Reminder not found"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// CheckReminders is meant to be called from a background goroutine.
func CheckReminders() {
	database := db.GetDB()
	now := time.Now()

	var reminders []models.ChatReminder
	database.Where("is_sent = ? AND remind_at <= ?", false, now).Find(&reminders)

	for _, reminder := range reminders {
		// Send WebSocket notification to user
		notification, _ := json.Marshal(fiber.Map{
			"type":      "reminder",
			"chatId":    reminder.ChatID,
			"messageId": reminder.MessageID,
			"remindAt":  reminder.RemindAt,
			"createdAt": reminder.CreatedAt,
		})
		ws.HubInstance.SendToUser(reminder.UserID, notification)

		// Mark as sent
		database.Model(&reminder).Update("is_sent", true)
	}
}

// StartReminderLoop starts a background goroutine that checks reminders every 30 seconds.
func StartReminderLoop() {
	go func() {
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				CheckReminders()
			case <-StopCh:
				return
			}
		}
	}()
}

// ─── Contact Color Tags ─────────────────────────────────────────────────

func CreateContactTag(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateContactTagRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.TargetID == "" || req.Label == "" || req.Color == "" {
		return c.Status(400).JSON(fiber.Map{"error": "targetId, label, and color are required"})
	}

	database := db.GetDB()

	// Verify target user exists
	var target models.User
	if err := database.Where("id = ?", req.TargetID).First(&target).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Target user not found"})
	}

	tag := models.ContactTag{
		ID:        generateID(),
		UserID:    userID,
		TargetID:  req.TargetID,
		Label:     req.Label,
		Color:     req.Color,
		CreatedAt: time.Now(),
	}
	database.Create(&tag)

	return c.Status(201).JSON(tag)
}

func GetContactTags(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 100
	}
	offset := (page - 1) * limit

	var tags []models.ContactTag
	database := db.GetDB()
	database.Preload("Target").Where("user_id = ?", userID).
		Offset(offset).Limit(limit).
		Find(&tags)

	return c.JSON(tags)
}

func DeleteContactTag(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	tagID := c.Params("id")

	database := db.GetDB()
	result := database.Where("id = ? AND user_id = ?", tagID, userID).
		Delete(&models.ContactTag{})

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Tag not found"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ─── Public Interest Rooms ──────────────────────────────────────────────

func CreatePublicRoom(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreatePublicRoomRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ChatID == "" || req.Name == "" || req.Category == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId, name, and category are required"})
	}

	database := db.GetDB()

	// Verify the chat exists and user is admin
	var member models.ChatMember
	if err := database.Where("chat_id = ? AND user_id = ? AND role = ?", req.ChatID, userID, "admin").First(&member).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "You must be an admin of this chat"})
	}

	// Check not already public
	var existing models.PublicRoom
	if err := database.Where("chat_id = ?", req.ChatID).First(&existing).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Chat is already a public room"})
	}

	// Count current members
	var memberCount int64
	database.Model(&models.ChatMember{}).Where("chat_id = ?", req.ChatID).Count(&memberCount)

	room := models.PublicRoom{
		ID:           generateID(),
		ChatID:       req.ChatID,
		Name:         req.Name,
		Description:  req.Description,
		Category:     req.Category,
		Icon:         req.Icon,
		MembersCount: int(memberCount),
		IsFeatured:   false,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
	}
	database.Create(&room)

	database.Preload("Chat").Where("id = ?", room.ID).First(&room)
	return c.Status(201).JSON(room)
}

func GetPublicRooms(c *fiber.Ctx) error {
	database := db.GetDB()
	category := c.Query("category")

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 200 {
		limit = 50
	}
	offset := (page - 1) * limit

	var rooms []models.PublicRoom
	query := database.Preload("Chat")

	if category != "" {
		query = query.Where("category = ?", category)
	}

	query.Order("members_count DESC").Offset(offset).Limit(limit).Find(&rooms)

	return c.JSON(rooms)
}

func JoinPublicRoom(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	roomID := c.Params("id")

	database := db.GetDB()

	var room models.PublicRoom
	if err := database.Where("id = ?", roomID).First(&room).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Public room not found"})
	}

	// Check not already member
	var existingMember models.ChatMember
	if err := database.Where("chat_id = ? AND user_id = ?", room.ChatID, userID).First(&existingMember).Error; err == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Already a member"})
	}

	// Add as member
	member := models.ChatMember{
		ID:       generateID(),
		ChatID:   room.ChatID,
		UserID:   userID,
		Role:     "member",
		JoinedAt: time.Now(),
	}
	database.Create(&member)

	// Increment count
	database.Model(&room).Update("members_count", room.MembersCount+1)

	return c.JSON(fiber.Map{"ok": true, "chatId": room.ChatID})
}

func LeavePublicRoom(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	roomID := c.Params("id")

	database := db.GetDB()

	var room models.PublicRoom
	if err := database.Where("id = ?", roomID).First(&room).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Public room not found"})
	}

	result := database.Where("chat_id = ? AND user_id = ?", room.ChatID, userID).
		Delete(&models.ChatMember{})

	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "You are not a member"})
	}

	// Decrement count (but not below 0)
	newCount := room.MembersCount - 1
	if newCount < 0 {
		newCount = 0
	}
	database.Model(&room).Update("members_count", newCount)

	return c.JSON(fiber.Map{"ok": true})
}

// ─── Screenshot Detection ───────────────────────────────────────────────

func NotifyScreenshot(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.ScreenshotNotifyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ChatID == "" || req.MessageID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId and messageId are required"})
	}

	database := db.GetDB()

	// Log the screenshot
	log := models.ScreenshotLog{
		ID:        generateID(),
		ChatID:    req.ChatID,
		UserID:    userID,
		MessageID: req.MessageID,
		CreatedAt: time.Now(),
	}
	database.Create(&log)

	// Notify all chat members via WebSocket
	notification, _ := json.Marshal(fiber.Map{
		"type":      "screenshot_detected",
		"userId":    userID,
		"messageId": req.MessageID,
		"chatId":    req.ChatID,
	})
	ws.HubInstance.SendToChat(req.ChatID, notification, userID)

	return c.Status(201).JSON(fiber.Map{"ok": true})
}

// ─── Self-Destruct on Read ──────────────────────────────────────────────

func MarkMessageRead(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	messageID := c.Params("id")

	database := db.GetDB()

	var message models.Message
	if err := database.Where("id = ?", messageID).First(&message).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	// If message has self-destruct timer → track read and schedule deletion
	if message.SelfDestructTimer > 0 {
		// Check not already tracked
		var existing models.SelfDestructRead
		if err := database.Where("message_id = ? AND user_id = ?", messageID, userID).First(&existing).Error; err != nil {
			// Create read record
			readRecord := models.SelfDestructRead{
				ID:        generateID(),
				MessageID: messageID,
				UserID:    userID,
				ReadAt:    time.Now(),
			}
			database.Create(&readRecord)

			// Schedule deletion after timer
			go func(msgID string, timerSec int) {
				timer := time.NewTimer(time.Duration(timerSec) * time.Second)
				defer timer.Stop()
				select {
				case <-timer.C:
					database.Delete(&models.Message{}, "id = ?", msgID)
				case <-StopCh:
					return
				}
			}(messageID, message.SelfDestructTimer)
		}
	}

	return c.JSON(fiber.Map{"ok": true})
}
