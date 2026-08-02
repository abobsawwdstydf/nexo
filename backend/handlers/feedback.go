package handlers

import (
	"encoding/json"
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

const (
	feedbackChatUsername = "nexo_feedback"
	feedbackChatName     = "Нексо — обратная связь"
	feedbackChatAvatar   = "/logo.png"
	feedbackChatDesc     = "Жалобы, предложения и вопросы. Сообщите нам о проблеме — мы ответим здесь."
)

// GetOrCreateFeedbackChat returns the system feedback chat, creating it and
// adding the caller as a member on first access.
func GetOrCreateFeedbackChat(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var chat models.Chat
	result := db.GetDB().Where("username = ?", feedbackChatUsername).First(&chat)
	if result.Error != nil {
		chat = models.Chat{
			ID:             generateID(),
			Type:           "system",
			Username:       feedbackChatUsername,
			Name:           feedbackChatName,
			Avatar:         feedbackChatAvatar,
			Description:    feedbackChatDesc,
			IsVerified:     true,
			CanMembersPost: true,
		}
		if err := db.GetDB().Create(&chat).Error; err != nil {
			log.Printf("[feedback] failed to create feedback chat: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create feedback chat"})
		}
	}

	// Ensure caller is a member (idempotent)
	var existingMember models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chat.ID, userID).First(&existingMember); result.Error != nil {
		member := models.ChatMember{
			ID:     generateID(),
			ChatID: chat.ID,
			UserID: userID,
			Role:   "member",
		}
		if err := db.GetDB().Create(&member).Error; err != nil {
			log.Printf("[feedback] failed to add member %s: %v", userID, err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to join feedback chat"})
		}
	}

	db.GetDB().
		Preload("Members", func(db *gorm.DB) *gorm.DB {
			return db.Preload("User")
		}).
		First(&chat, "id = ?", chat.ID)
	sanitizeChatMembers(chat.Members)

	return c.JSON(chat)
}

// FeedbackTicketJSON is one feedback thread/chat shown in the admin dashboard.
type FeedbackTicketJSON struct {
	ChatID      string       `json:"chatId"`
	Name        string       `json:"name"`
	Avatar      string       `json:"avatar"`
	Members     int          `json:"members"`
	MessageCount int64       `json:"messageCount"`
	LastMessage *MessageJSON `json:"lastMessage,omitempty"`
	LastAt      string       `json:"lastAt"`
}

// AdminListFeedback returns all system feedback chats with message stats.
func AdminListFeedback(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	if !isPlatformAdmin(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Admin only"})
	}

	var chats []models.Chat
	db.GetDB().Where("username = ?", feedbackChatUsername).Find(&chats)

	tickets := make([]FeedbackTicketJSON, 0, len(chats))
	for _, ch := range chats {
		var count int64
		db.GetDB().Model(&models.Message{}).Where("chat_id = ?", ch.ID).Count(&count)

		var last models.Message
		hasLast := db.GetDB().
			Preload("Sender").
			Where("chat_id = ?", ch.ID).
			Order("created_at DESC").
			First(&last).Error == nil

		ticket := FeedbackTicketJSON{
			ChatID:       ch.ID,
			Name:         ch.Name,
			Avatar:       ch.Avatar,
			MessageCount: count,
			LastAt:       ch.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		if hasLast {
			last.Sender = sanitizeUser(last.Sender)
			var lastJSON MessageJSON
			if err := json.Unmarshal([]byte(messageToJSON(last)), &lastJSON); err == nil {
				ticket.LastMessage = &lastJSON
			}
		}
		tickets = append(tickets, ticket)
	}

	return c.JSON(fiber.Map{"items": tickets, "total": len(tickets)})
}

// AdminReplyFeedback lets a platform admin post a message into the feedback
// chat. The sender is the admin's own account.
func AdminReplyFeedback(c *fiber.Ctx) error {
	chatID := c.Params("chatId")
	adminID := c.Locals("userId").(string)
	if !isPlatformAdmin(adminID) {
		return c.Status(403).JSON(fiber.Map{"error": "Admin only"})
	}

	var req struct {
		Content string `json:"content"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Content = strings.TrimSpace(req.Content)
	if req.Content == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Content cannot be empty"})
	}
	if len(req.Content) > maxMessageContentLength {
		return c.Status(400).JSON(fiber.Map{"error": "Message too long"})
	}

	var chat models.Chat
	if result := db.GetDB().First(&chat, "id = ?", chatID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Chat not found"})
	}
	if chat.Username != feedbackChatUsername {
		return c.Status(400).JSON(fiber.Map{"error": "Not a feedback chat"})
	}

	now := time.Now()
	msg := models.Message{
		ID:        generateID(),
		ChatID:    chatID,
		SenderID:  adminID,
		Content:   req.Content,
		Type:      "text",
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		log.Printf("[feedback] failed to create reply: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send reply"})
	}

	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("updated_at", now)

	if err := db.GetDB().Preload("Sender").Preload("Media").First(&msg, "id = ?", msg.ID).Error; err != nil {
		log.Printf("[feedback] failed to preload reply %s: %v", msg.ID, err)
	}

	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(chatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")

	msg.Sender = sanitizeUser(msg.Sender)
	return c.Status(201).JSON(msg)
}
