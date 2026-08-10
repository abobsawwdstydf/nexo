package handlers

import (
	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
)

// OpenComments открывает (или создаёт) чат комментариев к посту канала.
// Первое сообщение такого чата — сам пост канала (источник дискуссии),
// всё остальное — обычный чат. Удалять сообщения может только владелец канала.
func OpenComments(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("chatId")
	messageID := c.Params("messageId")

	var channel models.Chat
	if result := db.GetDB().First(&channel, "id = ?", chatID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Channel not found"})
	}
	if channel.Type != "channel" {
		return c.Status(400).JSON(fiber.Map{"error": "Comments are only available for channels"})
	}

	var post models.Message
	if result := db.GetDB().First(&post, "id = ? AND chat_id = ?", messageID, chatID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Post not found"})
	}

	// Find existing comments chat for this post
	var existing models.Chat
	err := db.GetDB().Where("type = ? AND linked_chat_id = ? AND linked_message_id = ?",
		"comments", chatID, messageID).First(&existing).Error
	if err == nil {
		ensureChatMember(existing.ID, userID, "member")
		return c.JSON(fiber.Map{"chatId": existing.ID, "chat": existing})
	}
	if err != gorm.ErrRecordNotFound {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to find comments chat"})
	}

	// Create new comments chat
	newChat := models.Chat{
		ID:              generateID(),
		Type:            "comments",
		Name:            "Комментарии · " + channel.Name,
		Avatar:          channel.Avatar,
		Description:     "Комментарии к посту канала",
		LinkedChatID:    chatID,
		LinkedMessageID: messageID,
	}
	if result := db.GetDB().Create(&newChat); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create comments chat"})
	}

	// Owner of the channel becomes owner of the comments chat, viewer joins as member
	channelOwnerID := ""
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND role = ?", chatID, "owner").
		Pluck("user_id", &channelOwnerID)
	if channelOwnerID != "" && channelOwnerID != userID {
		ensureChatMember(newChat.ID, channelOwnerID, "owner")
	}
	ensureChatMember(newChat.ID, userID, "member")

	// Copy the post as the first message (immutable anchor of the discussion)
	postCopy := models.Message{
		ID:       generateID(),
		ChatID:   newChat.ID,
		SenderID: post.SenderID,
		Content:  post.Content,
		Type:     "post",
	}
	if result := db.GetDB().Create(&postCopy); result.Error == nil {
		var media []models.Media
		db.GetDB().Where("message_id = ?", post.ID).Find(&media)
		for i := range media {
			copyMedia := media[i]
			copyMedia.ID = generateID()
			copyMedia.MessageID = postCopy.ID
			db.GetDB().Create(&copyMedia)
		}
		// Copy reactions
		var reactions []models.Reaction
		db.GetDB().Where("message_id = ?", post.ID).Find(&reactions)
		for i := range reactions {
			copyReaction := reactions[i]
			copyReaction.ID = generateID()
			copyReaction.MessageID = postCopy.ID
			db.GetDB().Create(&copyReaction)
		}
	}

	return c.Status(201).JSON(fiber.Map{"chatId": newChat.ID, "chat": newChat})
}

func ensureChatMember(chatID, userID, role string) {
	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).Count(&count)
	if count == 0 {
		db.GetDB().Create(&models.ChatMember{
			ID:     generateID(),
			ChatID: chatID,
			UserID: userID,
			Role:   role,
		})
	}
}