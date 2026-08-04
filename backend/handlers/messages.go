package handlers

import (
	"encoding/json"
	"log"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/helpers"
	"nexo/models"
	"nexo/ws"
)

const maxMessageContentLength = 10000

// MessageJSON for safe JSON output
type MessageJSON struct {
	ID               string            `json:"id"`
	ChatID           string            `json:"chatId"`
	SenderID         string            `json:"senderId"`
	Content          string            `json:"content"`
	Type             string            `json:"type"`
	ReplyToID        string            `json:"replyToId"`
	ForwardedFromID  string            `json:"forwardedFromId"`
	IsEdited         bool              `json:"isEdited"`
	IsDeleted        bool              `json:"isDeleted"`
	IsEncrypted      bool              `json:"isEncrypted"`
	EncryptedContent string            `json:"encryptedContent"`
	EncryptedIV      string            `json:"encryptedIv"`
	CreatedAt        string            `json:"createdAt"`
	Sender           SenderJSON        `json:"sender"`
	ReplyTo          *MessageJSON      `json:"replyTo,omitempty"`
	Media            []models.Media    `json:"media"`
	Reactions        []models.Reaction `json:"reactions"`
	ReplyMarkup      json.RawMessage   `json:"replyMarkup,omitempty"`
}

type SenderJSON struct {
	ID                string `json:"id"`
	Username          string `json:"username"`
	DisplayName       string `json:"displayName"`
	Avatar            string `json:"avatar"`
	IsVerified        bool   `json:"isVerified"`
	VerifiedBadgeUrl  string `json:"verifiedBadgeUrl"`
	VerifiedBadgeType string `json:"verifiedBadgeType"`
	IsBot             bool   `json:"isBot,omitempty"`
}

func senderToJSON(u models.User) SenderJSON {
	return SenderJSON{
		ID:                u.ID,
		Username:          u.Username,
		DisplayName:       u.DisplayName,
		Avatar:            u.Avatar,
		IsVerified:        u.IsVerified,
		VerifiedBadgeUrl:  u.VerifiedBadgeUrl,
		VerifiedBadgeType: u.VerifiedBadgeType,
	}
}

func senderFromBot(b models.Bot) SenderJSON {
	return SenderJSON{
		ID:          b.ID,
		Username:    b.Username,
		DisplayName: b.Name,
		Avatar:      b.Avatar,
		IsBot:       true,
	}
}

func messageToJSON(msg models.Message) string {
	senderJSON := SenderJSON{}
	if msg.Sender.ID == "" && msg.SenderID != "" {
		// Сообщение от бота (нет user-записи)
		var bot models.Bot
		if err := db.GetDB().First(&bot, "id = ?", msg.SenderID).Error; err == nil {
			senderJSON = senderFromBot(bot)
		} else {
			senderJSON = SenderJSON{ID: msg.SenderID, IsBot: true}
		}
	} else {
		senderJSON = senderToJSON(msg.Sender)
	}

	var replyMarkup json.RawMessage
	if msg.ReplyMarkup != "" {
		replyMarkup = json.RawMessage(msg.ReplyMarkup)
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
		EncryptedIV:      msg.EncryptedIV,
		CreatedAt:        msg.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Sender:           senderJSON,
		Media:            msg.Media,
		Reactions:        msg.Reactions,
		ReplyMarkup:      replyMarkup,
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
		EncryptedIV:      req.EncryptedIV,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := db.GetDB().Create(&msg).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send message"})
	}

	// Batch update chat member and chat
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("last_message_at", now)

	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("updated_at", now)

	// Fetch with preload in single query
	if err := db.GetDB().Preload("Sender").Preload("Media").First(&msg, "id = ?", msg.ID).Error; err != nil {
		log.Printf("failed to preload sent message %s: %v", msg.ID, err)
	}

	msgJSON := messageToJSON(msg)

	ws.HubInstance.SendToChat(chatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")

	notifyBotsOfMessage(chatID, msg, msg.Sender)

	// Web Push to offline members (skip sender; NotifyUser skips online users)
	senderName := msg.Sender.DisplayName
	if senderName == "" {
		senderName = msg.Sender.Username
	}
	NotifyNewMessagePush(chatID, userID, senderName, req.Type, req.Content)

	msg.Sender = sanitizeUser(msg.Sender)
	return c.Status(201).JSON(msg)
}

func GetMessages(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	p := helpers.ParsePagination(c, 50, 100)

	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	var messages []models.Message
	var total int64

	// Sequential queries: SQLite serializes writes/reads anyway, and parallel
	// goroutines only add connection contention and lock retries.
	if err := db.GetDB().Model(&models.Message{}).Where("chat_id = ?", chatID).Count(&total).Error; err != nil {
		log.Printf("[messages] count failed for chat %s: %v", chatID, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load messages"})
	}

	if err := db.GetDB().
		Preload("Sender").
		Preload("Media").
		Preload("Reactions").
		Preload("Reactions.User").
		Where("chat_id = ?", chatID).
		Order("created_at DESC").
		Offset(p.Offset).Limit(p.PageSize).
		Find(&messages).Error; err != nil {
		log.Printf("[messages] fetch failed for chat %s: %v", chatID, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load messages"})
	}

	sanitizeMessages(messages)
	return c.JSON(helpers.NewPaginatedResponse(messages, total, p))
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
	ws.HubInstance.SendToChat(msg.ChatID, mustWSMsg("message:edited", "message", json.RawMessage(msgJSON)), "")

	msg.Sender = sanitizeUser(msg.Sender)
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

	ws.HubInstance.SendToChat(msg.ChatID, mustWSMap("message:deleted", map[string]string{
		"messageId": msgID,
		"chatId":    msg.ChatID,
	}), "")

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

	// Only chat members may react to messages.
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", msg.ChatID, userID).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	// Toggle: if exists, remove; if not, add
	var existing models.Reaction
	if result := db.GetDB().Where("message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, req.Emoji).First(&existing); result.Error == nil {
		db.GetDB().Delete(&existing)
		ws.HubInstance.SendToChat(msg.ChatID, mustWSMap("message:reaction_removed", map[string]string{
			"messageId": msgID,
			"userId":    userID,
			"emoji":     req.Emoji,
		}), "")
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

	ws.HubInstance.SendToChat(msg.ChatID, mustWSMap("message:reaction_added", map[string]string{
		"messageId": msgID,
		"userId":    userID,
		"emoji":     req.Emoji,
	}), "")

	return c.JSON(fiber.Map{"ok": true, "action": "added"})
}

func RemoveReaction(c *fiber.Ctx) error {
	msgID := c.Params("messageId")
	emoji := c.Params("emoji")
	userID := c.Locals("userId").(string)

	var msg models.Message
	if result := db.GetDB().First(&msg, "id = ?", msgID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	// Only chat members may remove reactions.
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", msg.ChatID, userID).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	var existing models.Reaction
	if result := db.GetDB().Where("message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, emoji).First(&existing); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Reaction not found"})
	}

	db.GetDB().Delete(&existing)
	ws.HubInstance.SendToChat(msg.ChatID, mustWSMap("message:reaction_removed", map[string]string{
		"messageId": msgID,
		"userId":    userID,
		"emoji":     emoji,
	}), "")

	return c.JSON(fiber.Map{"ok": true, "action": "removed"})
}

func ReadMessages(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		MessageID string `json:"messageId"`
	}
	if err := c.BodyParser(&req); err != nil || req.MessageID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if err := recordReadReceipt(db.GetDB(), chatID, req.MessageID, userID); err != nil {
		switch err {
		case errReadReceiptNotMember:
			return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
		case errReadReceiptNotFound:
			return c.Status(404).JSON(fiber.Map{"error": "Message not found in this chat"})
		default:
			log.Printf("[messages] failed to record read receipt: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save read receipt"})
		}
	}

	ws.HubInstance.SendToChat(chatID, mustWSMap("message:read", map[string]string{
		"messageId": req.MessageID,
		"userId":    userID,
	}), "")

	return c.JSON(fiber.Map{"ok": true})
}

func Typing(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	// Throttle DB writes: if a fresh indicator already exists, just broadcast
	var existing models.TypingIndicator
	now := time.Now()
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&existing).Error; err == nil && existing.ExpiresAt.After(now.Add(3*time.Second)) {
		ws.HubInstance.SendToChat(chatID, mustWSMap("typing", map[string]string{
			"chatId": chatID,
			"userId": userID,
		}), userID)
		return c.JSON(fiber.Map{"ok": true})
	}

	db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).Delete(&models.TypingIndicator{})

	indicator := models.TypingIndicator{
		ID:        generateID(),
		ChatID:    chatID,
		UserID:    userID,
		ExpiresAt: now.Add(5 * time.Second),
	}
	db.GetDB().Create(&indicator)

	ws.HubInstance.SendToChat(chatID, mustWSMap("typing", map[string]string{
		"chatId": chatID,
		"userId": userID,
	}), userID)

	return c.JSON(fiber.Map{"ok": true})
}

func SearchMessages(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	query := strings.TrimSpace(c.Query("q"))
	if len(query) < 2 {
		return c.Status(400).JSON(fiber.Map{"error": "Query must be at least 2 characters"})
	}
	if utf8.RuneCountInString(query) > 100 {
		query = string([]rune(query)[:100])
	}

	pag := helpers.ParsePagination(c, 20, 50)

	// Optional filters
	fromDate := c.Query("from")
	toDate := c.Query("to")
	msgType := c.Query("type")

	var memberChatIDs []string
	if err := db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs).Error; err != nil {
		log.Printf("[SearchMessages] failed to load chat memberships for user=%s: %v", userID, err)
	}

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []models.Message{}, "total": 0, "page": pag.Page, "pageSize": pag.PageSize})
	}

	// SECURITY FIX: Escape % and _ LIKE wildcards to prevent pattern injection.
	// The ESCAPE clause is mandatory — without it SQLite treats backslash literally.
	likeQuery := "%" + strings.ReplaceAll(strings.ReplaceAll(query, "%", "\\%"), "_", "\\_") + "%"
	q := db.GetDB().
		Preload("Sender").
		Preload("Chat").
		Where("chat_id IN ? AND is_deleted = false AND content LIKE ? ESCAPE '\\'", memberChatIDs, likeQuery)

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
	if err := q.Model(&models.Message{}).Count(&total).Error; err != nil {
		log.Printf("[SearchMessages] count failed for user=%s: %v", userID, err)
		return c.Status(500).JSON(fiber.Map{"error": "search failed"})
	}

	var messages []models.Message
	if err := q.Offset(pag.Offset).Limit(pag.PageSize).Find(&messages).Error; err != nil {
		log.Printf("[SearchMessages] query failed for user=%s: %v", userID, err)
		return c.Status(500).JSON(fiber.Map{"error": "search failed"})
	}
	sanitizeMessages(messages)

	// Save search history
	history := models.SearchHistory{
		ID:          generateID(),
		UserID:      userID,
		Query:       query,
		Type:        msgType,
		ResultCount: int(total),
	}
	if err := db.GetDB().Create(&history).Error; err != nil {
		log.Printf("[SearchMessages] failed to save history for user=%s: %v", userID, err)
	}

	// Cap search history at 200 entries per user (unbounded growth otherwise)
	var historyCount int64
	if err := db.GetDB().Model(&models.SearchHistory{}).Where("user_id = ?", userID).Count(&historyCount).Error; err == nil && historyCount > 200 {
		if err := db.GetDB().Exec(
			"DELETE FROM search_histories WHERE id IN (SELECT id FROM search_histories WHERE user_id = ? ORDER BY created_at DESC LIMIT -1 OFFSET 200)",
			userID,
		).Error; err != nil {
			log.Printf("[SearchMessages] failed to trim history for user=%s: %v", userID, err)
		}
	}

	return c.JSON(helpers.NewPaginatedResponse(messages, total, pag))
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

// mustWSMap builds a safe JSON WebSocket message with a type and string fields
func mustWSMap(typeStr string, fields map[string]string) []byte {
	msg := map[string]string{"type": typeStr}
	for k, v := range fields {
		msg[k] = v
	}
	data, _ := json.Marshal(msg)
	return data
}

// mustWSMsg builds a safe JSON WebSocket message with a type and mixed fields
func mustWSMsg(typeStr string, kv ...interface{}) []byte {
	msg := map[string]interface{}{"type": typeStr}
	for i := 0; i+1 < len(kv); i += 2 {
		if key, ok := kv[i].(string); ok {
			msg[key] = kv[i+1]
		}
	}
	data, _ := json.Marshal(msg)
	return data
}
