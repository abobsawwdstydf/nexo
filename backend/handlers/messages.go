package handlers

import (
	"encoding/json"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

const maxMessageContentLength = 10000

// MessageJSON for safe JSON output
type MessageJSON struct {
	ID               string          `json:"id"`
	ChatID           string          `json:"chatId"`
	SenderID         string          `json:"senderId"`
	Content          string          `json:"content"`
	Type             string          `json:"type"`
	ReplyToID        string          `json:"replyToId"`
	ForwardedFromID  string          `json:"forwardedFromId"`
	IsEdited         bool            `json:"isEdited"`
	IsDeleted        bool            `json:"isDeleted"`
	IsEncrypted      bool            `json:"isEncrypted"`
	EncryptedContent string          `json:"encryptedContent"`
	CreatedAt        string          `json:"createdAt"`
	Sender           SenderJSON      `json:"sender"`
	ReplyTo          *MessageJSON    `json:"replyTo,omitempty"`
	Media            []models.Media  `json:"media"`
	Reactions        []models.Reaction `json:"reactions"`
}

type SenderJSON struct {
	ID          string `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Avatar      string `json:"avatar"`
}

func messageToJSON(msg models.Message) string {
	senderJSON := SenderJSON{
		ID:          msg.Sender.ID,
		Username:    msg.Sender.Username,
		DisplayName: msg.Sender.DisplayName,
		Avatar:      msg.Sender.Avatar,
	}

	msgJSON := MessageJSON{
		ID:               msg.ID,
		ChatID:           msg.ChatID,
		SenderID:         msg.SenderID,
		Content:          msg.Content,
		Type:             msg.Type,
		ReplyToID:        msg.ReplyToID,
		ForwardedFromID:  msg.ForwardedFromID,
		IsEdited:         msg.IsEdited,
		IsDeleted:        msg.IsDeleted,
		IsEncrypted:      msg.IsEncrypted,
		EncryptedContent: msg.EncryptedContent,
		CreatedAt:        msg.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Sender:           senderJSON,
		Media:            msg.Media,
		Reactions:        msg.Reactions,
	}

	data, _ := json.Marshal(msgJSON)
	return string(data)
}

func SendMessage(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req models.SendMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	if req.Type == "" {
		req.Type = "text"
	}

	// Validate message content
	req.Content = strings.TrimSpace(req.Content)
	if req.Type == "text" && req.Content == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Message content cannot be empty"})
	}
	if utf8.RuneCountInString(req.Content) > maxMessageContentLength {
		return c.Status(400).JSON(fiber.Map{"error": "Message too long (max 10000 characters)"})
	}

	now := time.Now()
	msg := models.Message{
		ID:               generateID(),
		ChatID:           chatID,
		SenderID:         userID,
		Content:          req.Content,
		Type:             req.Type,
		ReplyToID:        req.ReplyToID,
		ForwardedFromID:  req.ForwardedFromID,
		IsEncrypted:      req.IsEncrypted,
		EncryptedContent: req.EncryptedContent,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := db.GetDB().Create(&msg).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send message"})
	}

	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("last_message_at", now)

	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("updated_at", now)

	db.GetDB().Preload("Sender").Preload("Media").First(&msg, "id = ?", msg.ID)

	msgJSON := messageToJSON(msg)

	ws.HubInstance.SendToChat(chatID, []byte(`{"type":"message:new","message":`+msgJSON+`}`), "")

	return c.Status(201).JSON(msg)
}

func GetMessages(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("pageSize", "50"))
	if page < 1 { page = 1 }
	if pageSize < 1 || pageSize > 100 { pageSize = 50 }
	offset := (page - 1) * pageSize

	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	var messages []models.Message
	db.GetDB().
		Preload("Sender").
		Preload("Media").
		Preload("Reactions").
		Preload("Reactions.User").
		Where("chat_id = ?", chatID).
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&messages)

	var total int64
	db.GetDB().Model(&models.Message{}).Where("chat_id = ?", chatID).Count(&total)

	return c.JSON(fiber.Map{
		"items":    messages,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"hasMore":  int64(offset+pageSize) < total,
	})
}

func EditMessage(c *fiber.Ctx) error {
	msgID := c.Params("messageId")
	userID := c.Locals("userId").(string)

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
	if utf8.RuneCountInString(req.Content) > maxMessageContentLength {
		return c.Status(400).JSON(fiber.Map{"error": "Message too long (max 10000 characters)"})
	}

	var msg models.Message
	if result := db.GetDB().First(&msg, "id = ?", msgID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	if msg.SenderID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Can only edit your own messages"})
	}

	now := time.Now()
	db.GetDB().Model(&msg).Updates(map[string]interface{}{
		"content":    req.Content,
		"is_edited":  true,
		"edited_at":  now,
		"updated_at": now,
	})

	db.GetDB().Preload("Sender").Preload("Media").First(&msg, "id = ?", msgID)

	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(msg.ChatID, []byte(`{"type":"message:edited","message":`+msgJSON+`}`), "")

	return c.JSON(msg)
}

func DeleteMessage(c *fiber.Ctx) error {
	msgID := c.Params("messageId")
	userID := c.Locals("userId").(string)

	var msg models.Message
	if result := db.GetDB().First(&msg, "id = ?", msgID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	// Allow owner or chat admin/owner to delete
	if msg.SenderID != userID {
		var callerMember models.ChatMember
		if result := db.GetDB().Where("chat_id = ? AND user_id = ?", msg.ChatID, userID).First(&callerMember); result.Error != nil {
			return c.Status(403).JSON(fiber.Map{"error": "Can only delete your own messages"})
		}
		if callerMember.Role != "admin" && callerMember.Role != "owner" {
			return c.Status(403).JSON(fiber.Map{"error": "Can only delete your own messages"})
		}
	}

	db.GetDB().Model(&msg).Updates(map[string]interface{}{
		"is_deleted": true,
		"content":    "",
		"updated_at": time.Now(),
	})

	ws.HubInstance.SendToChat(msg.ChatID, []byte(`{"type":"message:deleted","messageId":"`+msgID+`","chatId":"`+msg.ChatID+`"}`), "")

	return c.JSON(fiber.Map{"ok": true})
}

func AddReaction(c *fiber.Ctx) error {
	msgID := c.Params("messageId")
	userID := c.Locals("userId").(string)

	var req struct {
		Emoji string `json:"emoji"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Emoji == "" || len([]rune(req.Emoji)) > 8 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid emoji (max 8 characters)"})
	}

	var msg models.Message
	if result := db.GetDB().First(&msg, "id = ?", msgID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	// Toggle: if exists, remove; if not, add
	var existing models.Reaction
	if result := db.GetDB().Where("message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, req.Emoji).First(&existing); result.Error == nil {
		db.GetDB().Delete(&existing)
		ws.HubInstance.SendToChat(msg.ChatID, []byte(`{"type":"message:reaction_removed","messageId":"`+msgID+`","userId":"`+userID+`","emoji":"`+req.Emoji+`"}`), "")
		return c.JSON(fiber.Map{"ok": true, "action": "removed"})
	}

	reaction := models.Reaction{
		ID:        generateID(),
		MessageID: msgID,
		UserID:    userID,
		Emoji:     req.Emoji,
	}
	if err := db.GetDB().Create(&reaction).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to add reaction"})
	}

	ws.HubInstance.SendToChat(msg.ChatID, []byte(`{"type":"message:reaction_added","messageId":"`+msgID+`","userId":"`+userID+`","emoji":"`+req.Emoji+`"}`), "")

	return c.JSON(fiber.Map{"ok": true, "action": "added"})
}

func ReadMessages(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		MessageID string `json:"messageId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	receipt := models.ReadReceipt{
		ID:        generateID(),
		MessageID: req.MessageID,
		UserID:    userID,
	}
	db.GetDB().Create(&receipt)

	ws.HubInstance.SendToChat(chatID, []byte(`{"type":"message:read","messageId":"`+req.MessageID+`","userId":"`+userID+`"}`), "")

	return c.JSON(fiber.Map{"ok": true})
}

func Typing(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).Delete(&models.TypingIndicator{})

	indicator := models.TypingIndicator{
		ID:        generateID(),
		ChatID:    chatID,
		UserID:    userID,
		ExpiresAt: time.Now().Add(5 * time.Second),
	}
	db.GetDB().Create(&indicator)

	ws.HubInstance.SendToChat(chatID, []byte(`{"type":"typing","chatId":"`+chatID+`","userId":"`+userID+`"}`), userID)

	return c.JSON(fiber.Map{"ok": true})
}

func SearchMessages(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	query := c.Query("q")
	if len(query) < 2 {
		return c.Status(400).JSON(fiber.Map{"error": "Query must be at least 2 characters"})
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	// Optional filters
	fromDate := c.Query("from")
	toDate := c.Query("to")
	msgType := c.Query("type")

	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []models.Message{}, "total": 0, "page": page, "pageSize": pageSize})
	}

	// SECURITY FIX: Escape both % and _ LIKE wildcards to prevent data leak
	likeQuery := "%" + strings.ReplaceAll(strings.ReplaceAll(query, "%", "\\%"), "_", "\\_") + "%"
	q := db.GetDB().
		Preload("Sender").
		Preload("Chat").
		Where("chat_id IN ? AND is_deleted = false AND content LIKE ?", memberChatIDs, likeQuery)

	if msgType != "" {
		q = q.Where("type = ?", msgType)
	}
	if fromDate != "" {
		q = q.Where("created_at >= ?", fromDate)
	}
	if toDate != "" {
		q = q.Where("created_at <= ?", toDate)
	}

	// Order by date only - no raw SQL with user input
	q = q.Order("created_at DESC")

	var total int64
	q.Model(&models.Message{}).Count(&total)

	var messages []models.Message
	q.Offset(offset).Limit(pageSize).Find(&messages)

	// Save search history
	history := models.SearchHistory{
		ID:          generateID(),
		UserID:      userID,
		Query:       query,
		Type:        msgType,
		ResultCount: int(total),
	}
	db.GetDB().Create(&history)

	return c.JSON(fiber.Map{
		"items":    messages,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"hasMore":  int64(offset+pageSize) < total,
	})
}

func GetSearchHistory(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var history []models.SearchHistory
	db.GetDB().Where("user_id = ?", userID).
		Order("created_at DESC").
		Limit(20).
		Find(&history)

	return c.JSON(history)
}

func GetSearchSuggestions(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	query := c.Query("q")

	var suggestions []models.SearchHistory
	q := db.GetDB().Where("user_id = ?", userID)

	if query != "" {
		q = q.Where("query LIKE ?", "%"+query+"%")
	}

	q.Select("query, COUNT(*) as result_count").
		Group("query").
		Order("result_count DESC").
		Limit(10).
		Find(&suggestions)

	return c.JSON(suggestions)
}
