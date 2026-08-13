package handlers

import (
	"encoding/json"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"
)

// POST /scheduled-messages
func CreateScheduledMessage(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateScheduledMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Content == "" || req.ChatID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Content and chatId required"})
	}

	scheduleAt, err := time.Parse(time.RFC3339, req.ScheduleAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid scheduleAt"})
	}

	msg := models.ScheduledMessage{
		ID:         generateID(),
		UserID:     userID,
		ChatID:     req.ChatID,
		Content:    req.Content,
		Type:       req.Type,
		MediaURL:   req.MediaURL,
		ScheduleAt: scheduleAt,
		Repeat:     req.Repeat,
		CreatedAt:  time.Now(),
	}
	if req.RepeatEnd != "" {
		if t, err := time.Parse(time.RFC3339, req.RepeatEnd); err == nil {
			msg.RepeatEnd = &t
		}
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		logging.Log.Error("[scheduled] create failed", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to schedule message"})
	}

	return c.Status(201).JSON(msg)
}

// GET /scheduled-messages
func GetScheduledMessages(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var msgs []models.ScheduledMessage
	db.GetDB().Where("user_id = ? AND is_sent = false", userID).Order("schedule_at ASC").Find(&msgs)

	return c.JSON(fiber.Map{"items": msgs})
}

// PUT /scheduled-messages/:id
func EditScheduledMessage(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Content    string `json:"content"`
		ScheduleAt string `json:"scheduleAt"`
		Repeat     string `json:"repeat"`
		RepeatEnd  string `json:"repeatEnd"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.ScheduleAt != "" {
		if t, err := time.Parse(time.RFC3339, req.ScheduleAt); err == nil {
			updates["schedule_at"] = t
		}
	}
	if req.Repeat != "" {
		updates["repeat"] = req.Repeat
	}
	if req.RepeatEnd != "" {
		if t, err := time.Parse(time.RFC3339, req.RepeatEnd); err == nil {
			updates["repeat_end"] = t
		}
	}

	if err := db.GetDB().Model(&models.ScheduledMessage{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates).Error; err != nil {
		logging.Log.Error("[scheduled] edit failed", "id", id, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update message"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /scheduled-messages/:id
func CancelScheduledMessage(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	if err := db.GetDB().Where("id = ? AND user_id = ?", id, userID).Delete(&models.ScheduledMessage{}).Error; err != nil {
		logging.Log.Error("[scheduled] delete failed", "id", id, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to cancel message"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// ─── Background delivery ─────────────────────────────────────────────────────

// ProcessDueScheduledMessages sends all due scheduled messages and is meant to
// be called from a background goroutine.
func ProcessDueScheduledMessages() {
	database := db.GetDB()
	now := time.Now()

	var due []models.ScheduledMessage
	if err := database.Where("is_sent = ? AND schedule_at <= ?", false, now).Find(&due).Error; err != nil {
		logging.Log.Error("[scheduled] query failed", "err", err)
		return
	}

	for i := range due {
		deliverScheduledMessage(database, &due[i], now)
	}
}

func deliverScheduledMessage(database *gorm.DB, sm *models.ScheduledMessage, now time.Time) {
	// Chat must still exist and the sender must be a member.
	var member models.ChatMember
	if result := database.Where("chat_id = ? AND user_id = ?", sm.ChatID, sm.UserID).First(&member); result.Error != nil {
		// No longer deliverable — mark as sent to avoid retry loops.
		database.Model(sm).Update("is_sent", true)
		return
	}

	msg := models.Message{
		ID:        generateID(),
		ChatID:    sm.ChatID,
		SenderID:  sm.UserID,
		Content:   sm.Content,
		Type:      sm.Type,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if msg.Type == "" {
		msg.Type = "text"
	}
	if err := database.Create(&msg).Error; err != nil {
		logging.Log.Error("[scheduled] failed to create message", "scheduled_id", sm.ID, "err", err)
		return // keep scheduled; retry next tick
	}

	if sm.MediaURL != "" {
		database.Create(&models.Media{
			ID:        generateID(),
			MessageID: msg.ID,
			Type:      scheduledMediaType(sm.MediaURL),
			URL:       sm.MediaURL,
			Order:     0,
		})
	}

	database.Model(&models.Chat{}).Where("id = ?", sm.ChatID).Update("updated_at", now)
	database.Model(&models.ChatMember{}).Where("chat_id = ? AND user_id = ?", sm.ChatID, sm.UserID).Update("last_message_at", now)

	database.Preload("Sender").Preload("Media").First(&msg, "id = ?", msg.ID)
	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(sm.ChatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")
	notifyBotsOfMessage(sm.ChatID, msg, msg.Sender)

	senderName := msg.Sender.DisplayName
	if senderName == "" {
		senderName = msg.Sender.Username
	}
	NotifyNewMessagePush(sm.ChatID, sm.UserID, senderName, msg.Type, msg.Content)

	// Repeating messages are rescheduled to the next future occurrence,
	// otherwise marked as sent.
	if next := nextScheduleAt(sm, now); !next.IsZero() {
		database.Model(sm).Update("schedule_at", next)
	} else {
		database.Model(sm).Update("is_sent", true)
	}
}

// nextScheduleAt returns the next future occurrence for a repeating scheduled
// message, advancing past `now` so a message that was overdue while the server
// was down doesn't re-fire on every tick. Returns the zero value when the
// message should be marked as sent (no repeat, or repeat ended).
func nextScheduleAt(sm *models.ScheduledMessage, now time.Time) time.Time {
	var advance func(time.Time) time.Time
	switch sm.Repeat {
	case "daily":
		advance = func(t time.Time) time.Time { return t.AddDate(0, 0, 1) }
	case "weekly":
		advance = func(t time.Time) time.Time { return t.AddDate(0, 0, 7) }
	case "monthly":
		advance = func(t time.Time) time.Time { return t.AddDate(0, 1, 0) }
	default:
		return time.Time{}
	}

	next := advance(sm.ScheduleAt)
	for next.Before(now) {
		if sm.RepeatEnd != nil && next.After(*sm.RepeatEnd) {
			return time.Time{}
		}
		next = advance(next)
	}
	if sm.RepeatEnd != nil && next.After(*sm.RepeatEnd) {
		return time.Time{}
	}
	return next
}

func scheduledMediaType(url string) string {
	lower := strings.ToLower(url)
	switch {
	case strings.Contains(lower, ".png"), strings.Contains(lower, ".jpg"), strings.Contains(lower, ".jpeg"),
		strings.Contains(lower, ".gif"), strings.Contains(lower, ".webp"), strings.Contains(lower, ".bmp"),
		strings.Contains(lower, ".avif"):
		return "image"
	case strings.Contains(lower, ".mp4"), strings.Contains(lower, ".webm"), strings.Contains(lower, ".mov"):
		return "video"
	case strings.Contains(lower, ".mp3"), strings.Contains(lower, ".ogg"), strings.Contains(lower, ".wav"),
		strings.Contains(lower, ".m4a"), strings.Contains(lower, ".opus"):
		return "audio"
	default:
		return "file"
	}
}

// StartScheduledMessagesLoop runs a background goroutine that delivers due
// scheduled messages every 15 seconds.
func StartScheduledMessagesLoop() {
	go func() {
		ticker := time.NewTicker(15 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				ProcessDueScheduledMessages()
			case <-StopCh:
				return
			}
		}
	}()
}

