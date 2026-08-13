package handlers

import (
	"encoding/json"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/helpers"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"
)

const maxMessageContentLength = 10000

// validSelfDestructSeconds normalizes a self-destruct timer. Returns 0 when
// unset, or clamps to [3, 7 days]. Negative values are invalid (-1 result).
func validSelfDestructSeconds(sec int) int {
	if sec == 0 {
		return 0
	}
	if sec < 0 {
		return -1
	}
	if sec < 3 {
		return 3
	}
	if sec > 7*24*3600 {
		return 7 * 24 * 3600
	}
	return sec
}

// MessageJSON for safe JSON output
type MessageJSON struct {
	ID               string            `json:"id"`
	ChatID           string            `json:"chatId"`
	SenderID         string            `json:"senderId"`
	Content          string            `json:"content"`
	Type             string            `json:"type"`
	ReplyToID        string            `json:"replyToId"`
	ForwardedFromID  string            `json:"forwardedFromId"`
	ForwardedFrom    *SenderJSON       `json:"forwardedFrom,omitempty"`
	IsEdited         bool              `json:"isEdited"`
	IsDeleted        bool              `json:"isDeleted"`
	IsEncrypted      bool              `json:"isEncrypted"`
	EncryptedContent string            `json:"encryptedContent"`
	EncryptedIV      string            `json:"encryptedIv"`
	CreatedAt        string            `json:"createdAt"`
	SelfDestructTimer int              `json:"selfDestructTimer"`
	SelfDestructAt   string            `json:"selfDestructAt,omitempty"`
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

type cachedBotSender struct {
	sender SenderJSON
	at     time.Time
}

// botSenderCache avoids a DB query per bot message when serializing a list of
// messages from bot chats (N+1). Entries refresh at most once per minute.
var botSenderCache sync.Map // botID -> cachedBotSender

func botSenderJSON(botID string) SenderJSON {
	if v, ok := botSenderCache.Load(botID); ok {
		c := v.(cachedBotSender)
		if time.Since(c.at) < time.Minute {
			return c.sender
		}
	}

	sender := SenderJSON{ID: botID, IsBot: true}
	var bot models.Bot
	if err := db.GetDB().First(&bot, "id = ?", botID).Error; err == nil {
		sender = senderFromBot(bot)
	}
	botSenderCache.Store(botID, cachedBotSender{sender: sender, at: time.Now()})
	return sender
}

func messageToJSON(msg models.Message) string {
	senderJSON := SenderJSON{}
	if msg.Sender.ID == "" && msg.SenderID != "" {
		// Сообщение от бота (нет user-записи)
		senderJSON = botSenderJSON(msg.SenderID)
	} else {
		senderJSON = senderToJSON(msg.Sender)
	}

	var replyMarkup json.RawMessage
	if msg.ReplyMarkup != "" {
		replyMarkup = json.RawMessage(msg.ReplyMarkup)
	}

	var forwardedFrom *SenderJSON
	if msg.ForwardedFromID != "" {
		var fu models.User
		if err := db.GetDB().First(&fu, "id = ?", msg.ForwardedFromID).Error; err == nil {
			fj := senderToJSON(fu)
			forwardedFrom = &fj
		}
	}

	msgJSON := MessageJSON{
		ID:               msg.ID,
		ChatID:           msg.ChatID,
		SenderID:         msg.SenderID,
		Content:          msg.Content,
		Type:             msg.Type,
		ReplyToID:        msg.ReplyToID,
		ForwardedFromID:  msg.ForwardedFromID,
		ForwardedFrom:    forwardedFrom,
		IsEdited:         msg.IsEdited,
		IsDeleted:        msg.IsDeleted,
		IsEncrypted:      msg.IsEncrypted,
		EncryptedContent: msg.EncryptedContent,
		EncryptedIV:      msg.EncryptedIV,
		CreatedAt:        msg.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		SelfDestructTimer: msg.SelfDestructTimer,
		Sender:           senderJSON,
		Media:            msg.Media,
		Reactions:        msg.Reactions,
		ReplyMarkup:      replyMarkup,
	}

	if msg.SelfDestructAt != nil {
		msgJSON.SelfDestructAt = msg.SelfDestructAt.Format("2006-01-02T15:04:05Z07:00")
	}

	data, err := json.Marshal(msgJSON)
	if err != nil {
		logging.Log.Error("[messageToJSON] marshal failed for message", "message_id", msg.ID, "err", err)
		return ""
	}
	return string(data)
}

// isChatMember reports whether userID is a member of chatID.
func isChatMember(chatID, userID string) bool {
	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Count(&count)
	return count > 0
}

// hasBlockedUser reports whether blockerID blocked blockedID.
func hasBlockedUser(blockerID, blockedID string) bool {
	var b models.BlockedUser
	return db.GetDB().
		Where("user_id = ? AND blocked_user_id = ?", blockerID, blockedID).
		First(&b).Error == nil
}

// isPersonalChatBlocked returns true when a 1-on-1 personal chat exists and
// the OTHER member has blocked the sender — messages and calls must not pass.
func isPersonalChatBlocked(chatID, userID string) bool {
	var chat models.Chat
	if err := db.GetDB().Select("type").First(&chat, "id = ?", chatID).Error; err != nil || chat.Type != "personal" {
		return false
	}
	var otherID string
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id != ?", chatID, userID).
		Limit(1).
		Pluck("user_id", &otherID)
	return otherID != "" && hasBlockedUser(otherID, userID)
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

	// Blocked users must not be able to message you in a 1-on-1 chat.
	if isPersonalChatBlocked(chatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "You cannot message this user"})
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

	timer := validSelfDestructSeconds(req.SelfDestructTimer)
	if timer < 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid self-destruct timer"})
	}

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
		SelfDestructTimer: timer,
		CreatedAt:        now,
		UpdatedAt:        now,
	}
	if timer > 0 {
		expiresAt := now.Add(time.Duration(timer) * time.Second)
		msg.SelfDestructAt = &expiresAt
	}

	if err := db.GetDB().Create(&msg).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send message"})
	}

	// Batch update chat member and chat
	if err := db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("last_message_at", now).Error; err != nil {
		logging.Log.Error("[SendMessage] failed to update last_message_at", "chat_id", chatID, "user_id", userID, "err", err)
	}

	if err := db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("updated_at", now).Error; err != nil {
		logging.Log.Error("[SendMessage] failed to update chat", "chat_id", chatID, "err", err)
	}

	// Fetch with preload in single query
	if err := db.GetDB().Preload("Sender").Preload("Media").First(&msg, "id = ?", msg.ID).Error; err != nil {
		logging.Log.Error("failed to preload sent message", "message_id", msg.ID, "err", err)
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

	msg.Sender = sanitizeUser(msg.Sender, "")
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
		logging.Log.Error("[messages] count failed for chat", "chat_id", chatID, "err", err)
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
		logging.Log.Error("[messages] fetch failed for chat", "chat_id", chatID, "err", err)
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
	if err := db.GetDB().Model(&msg).Updates(map[string]interface{}{
		"content":    req.Content,
		"is_edited":  true,
		"edited_at":  now,
		"updated_at": now,
	}).Error; err != nil {
		logging.Log.Error("[EditMessage] update failed for message", "message_id", msgID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to edit message"})
	}

	if err := db.GetDB().Preload("Sender").Preload("Media").First(&msg, "id = ?", msgID).Error; err != nil {
		logging.Log.Error("[EditMessage] failed to reload message after edit", "message_id", msgID, "err", err)
	}

	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(msg.ChatID, mustWSMsg("message:edited", "message", json.RawMessage(msgJSON)), "")

	msg.Sender = sanitizeUser(msg.Sender, "")
	return c.JSON(msg)
}

func DeleteMessage(c *fiber.Ctx) error {
	msgID := c.Params("messageId")
	userID := c.Locals("userId").(string)

	var msg models.Message
	if result := db.GetDB().First(&msg, "id = ?", msgID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	var chat models.Chat
	db.GetDB().First(&chat, "id = ?", msg.ChatID)

	// Comments chat: only the channel owner can delete anything,
	// and the anchor post is not deletable at all.
	if chat.Type == "comments" {
		if msg.Type == "post" {
			return c.Status(400).JSON(fiber.Map{"error": "The post cannot be deleted"})
		}
		if !isChannelOwner(userID, chat.LinkedChatID) {
			return c.Status(403).JSON(fiber.Map{"error": "Only the channel owner can delete messages in comments"})
		}
		return deleteMessageSoft(c, msg)
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

	return deleteMessageSoft(c, msg)
}

// isChannelOwner проверяет, что пользователь — владелец канала (или комментариев к нему).
func isChannelOwner(userID, chatID string) bool {
	if chatID == "" {
		return false
	}
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return false
	}
	return member.Role == "owner"
}

func deleteMessageSoft(c *fiber.Ctx, msg models.Message) error {
	db.GetDB().Model(&msg).Updates(map[string]interface{}{
		"is_deleted": true,
		"content":    "",
		"updated_at": time.Now(),
	})

	ws.HubInstance.SendToChat(msg.ChatID, mustWSMap("message:deleted", map[string]string{
		"messageId": msg.ID,
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
	if !isChatMember(msg.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	// Toggle: if exists, remove; if not, add
	var existing models.Reaction
	if result := db.GetDB().Where("message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, req.Emoji).First(&existing); result.Error == nil {
		if err := db.GetDB().Delete(&existing).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to remove reaction"})
		}
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
	if !isChatMember(msg.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	var existing models.Reaction
	if result := db.GetDB().Where("message_id = ? AND user_id = ? AND emoji = ?", msgID, userID, emoji).First(&existing); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Reaction not found"})
	}

	if err := db.GetDB().Delete(&existing).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to remove reaction"})
	}
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
			logging.Log.Error("[messages] failed to record read receipt", "err", err)
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

	// Verify membership (mirrors the WS handler)
	if !isChatMember(chatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

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
	if err := db.GetDB().Create(&indicator).Error; err != nil {
		logging.Log.Error("[Messages] failed to save typing indicator", "err", err)
	}

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
	hasMedia := c.Query("hasMedia") == "true"
	mediaType := strings.ToLower(strings.TrimSpace(c.Query("mediaType")))
	dateFrom := c.Query("dateFrom")
	dateTo := c.Query("dateTo")
	chatID := strings.TrimSpace(c.Query("chatId"))

	// mediaType whitelist — photo/video/audio/file are the values the uploader
	// writes into media.type; voice/gif are accepted for forward-compat.
	switch mediaType {
	case "", "photo", "video", "audio", "file", "voice", "gif":
	default:
		return c.Status(400).JSON(fiber.Map{"error": "Invalid mediaType"})
	}
	if dateFrom != "" {
		if _, err := time.Parse("2006-01-02", dateFrom); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid dateFrom (expected YYYY-MM-DD)"})
		}
	}
	if dateTo != "" {
		if _, err := time.Parse("2006-01-02", dateTo); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid dateTo (expected YYYY-MM-DD)"})
		}
	}

	var memberChatIDs []string
	if err := db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs).Error; err != nil {
		logging.Log.Error("[SearchMessages] failed to load chat memberships", "user_id", userID, "err", err)
	}

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []models.Message{}, "total": 0, "page": pag.Page, "pageSize": pag.PageSize})
	}

	// Search strategy:
	//  - queries >= 3 runes run through the FTS5 index (messages_fts, synced by
	//    triggers) with per-word prefix matching and unicode case folding;
	//  - shorter queries fall back to the old LIKE scan (FTS5 prefixes are
	//    impractical for 1-2 characters).
	var q *gorm.DB
	if utf8.RuneCountInString(query) < 3 {
		// SECURITY FIX: Escape % and _ LIKE wildcards to prevent pattern injection.
		// The ESCAPE clause is mandatory — without it SQLite treats backslash literally.
		likeQuery := "%" + strings.ReplaceAll(strings.ReplaceAll(query, "%", "\\%"), "_", "\\_") + "%"
		q = db.GetDB().
			Model(&models.Message{}).
			Preload("Sender").
			Preload("Chat").
			Where("chat_id IN ? AND is_deleted = false AND content LIKE ? ESCAPE '\\'", memberChatIDs, likeQuery)
	} else {
		ftsQuery := buildFTSQuery(query)
		q = db.GetDB().
			Model(&models.Message{}).
			Joins("JOIN messages_fts ON messages_fts.rowid = messages.rowid").
			Preload("Sender").
			Preload("Chat").
			Where("messages.chat_id IN ? AND messages.is_deleted = false AND messages_fts MATCH ?", memberChatIDs, ftsQuery)
	}

	if msgType != "" {
		q = q.Where("type = ?", msgType)
	}
	if fromDate != "" {
		q = q.Where("created_at >= ?", fromDate)
	}
	if toDate != "" {
		q = q.Where("created_at <= ?", toDate)
	}
	if dateFrom != "" {
		q = q.Where("created_at >= ?", dateFrom)
	}
	if dateTo != "" {
		q = q.Where("created_at <= ?", dateTo)
	}
	if chatID != "" {
		q = q.Where("chat_id = ?", chatID)
	}
	if hasMedia || mediaType != "" {
		// Attachment filters: EXISTS subquery on the media table, works for both
		// the LIKE branch and the FTS branch (which joins messages_fts).
		if mediaType != "" {
			q = q.Where("EXISTS (SELECT 1 FROM media m WHERE m.message_id = messages.id AND m.type = ?)", mediaType)
		} else {
			q = q.Where("EXISTS (SELECT 1 FROM media m WHERE m.message_id = messages.id)")
		}
	}

	// Order by date only - no raw SQL with user input
	q = q.Order("created_at DESC")

	var total int64
	if err := q.Model(&models.Message{}).Count(&total).Error; err != nil {
		logging.Log.Error("[SearchMessages] count failed", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "search failed"})
	}

	var messages []models.Message
	if err := q.Offset(pag.Offset).Limit(pag.PageSize).Find(&messages).Error; err != nil {
		logging.Log.Error("[SearchMessages] query failed", "user_id", userID, "err", err)
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
		logging.Log.Error("[SearchMessages] failed to save history", "user_id", userID, "err", err)
	}

	// Cap search history at 200 entries per user (unbounded growth otherwise)
	var historyCount int64
	if err := db.GetDB().Model(&models.SearchHistory{}).Where("user_id = ?", userID).Count(&historyCount).Error; err == nil && historyCount > 200 {
		if err := db.GetDB().Exec(
			"DELETE FROM search_histories WHERE user_id = ? AND id NOT IN (SELECT id FROM search_histories WHERE user_id = ? ORDER BY created_at DESC LIMIT 200)",
			userID, userID,
		).Error; err != nil {
			logging.Log.Error("[SearchMessages] failed to trim history", "user_id", userID, "err", err)
		}
	}

	return c.JSON(helpers.NewPaginatedResponse(messages, total, pag))
}

// maxForwardMessages and maxForwardChats bound the multi-forward batch sizes.
const (
	maxForwardMessages = 20
	maxForwardChats    = 20
)

// dedupeIDs removes duplicates (and empty strings) while preserving order.
func dedupeIDs(ids []string) []string {
	seen := make(map[string]struct{}, len(ids))
	out := make([]string, 0, len(ids))
	for _, id := range ids {
		if id == "" {
			continue
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

// ForwardMessages copies messages into one or more target chats. The caller
// must be a member of every source and target chat; personal-chat blocks apply
// (mirroring SendMessage). Encrypted, deleted and non-forwardable messages are
// skipped and reported via "skipped". Media records are copied (same file URLs
// — files are not duplicated on disk), self-destruct timers are NOT copied.
func ForwardMessages(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		MessageIDs []string `json:"messageIds"`
		ChatIDs    []string `json:"chatIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.MessageIDs = dedupeIDs(req.MessageIDs)
	req.ChatIDs = dedupeIDs(req.ChatIDs)
	if len(req.MessageIDs) == 0 || len(req.MessageIDs) > maxForwardMessages {
		return c.Status(400).JSON(fiber.Map{"error": "messageIds must contain 1..20 items"})
	}
	if len(req.ChatIDs) == 0 || len(req.ChatIDs) > maxForwardChats {
		return c.Status(400).JSON(fiber.Map{"error": "chatIds must contain 1..20 items"})
	}

	// Load source messages (deleted are excluded) and verify the caller is a
	// member of every source chat — forwarding is allowed for any message the
	// user can see, not only their own.
	var messages []models.Message
	if err := db.GetDB().Preload("Media").Where("id IN ? AND is_deleted = false", req.MessageIDs).Find(&messages).Error; err != nil {
		logging.Log.Error("[ForwardMessages] failed to load messages", "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load messages"})
	}
	if len(messages) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Messages not found"})
	}
	for _, m := range messages {
		if !isChatMember(m.ChatID, userID) {
			return c.Status(403).JSON(fiber.Map{"error": "Not a member of the source chat"})
		}
	}

	// Validate every target chat up front (membership + personal blocks), so a
	// bad chat fails the whole batch predictably instead of silently dropping it.
	for _, chatID := range req.ChatIDs {
		if !isChatMember(chatID, userID) {
			return c.Status(403).JSON(fiber.Map{"error": "Not a member of the target chat"})
		}
		if isPersonalChatBlocked(chatID, userID) {
			return c.Status(403).JSON(fiber.Map{"error": "You cannot message this user"})
		}
	}

	skipped := 0
	forwarded := make([]fiber.Map, 0, len(req.ChatIDs))
	for _, chatID := range req.ChatIDs {
		now := time.Now()
		copiedIDs := make([]string, 0, len(messages))
		for _, src := range messages {
			// Encrypted content must not leak into other chats; copy nothing.
			if src.IsEncrypted {
				logging.Log.Warn("[ForwardMessages] skip encrypted message", "message_id", src.ID)
				skipped++
				continue
			}
			if !src.CanForward {
				logging.Log.Warn("[ForwardMessages] skip non-forwardable message", "message_id", src.ID)
				skipped++
				continue
			}
			if src.IsDeleted {
				skipped++
				continue
			}

			msg := models.Message{
				ID:              generateID(),
				ChatID:          chatID,
				SenderID:        userID,
				Content:         src.Content,
				Type:            src.Type,
				ForwardedFromID: src.SenderID,
				CreatedAt:       now,
				UpdatedAt:       now,
			}
			if err := db.GetDB().Create(&msg).Error; err != nil {
				logging.Log.Error("[ForwardMessages] failed to create forwarded message", "err", err)
				skipped++
				continue
			}
			for _, md := range src.Media {
				newMedia := models.Media{
					ID:             generateID(),
					MessageID:      msg.ID,
					Type:           md.Type,
					URL:            md.URL,
					Filename:       md.Filename,
					Thumbnail:      md.Thumbnail,
					Size:           md.Size,
					Duration:       md.Duration,
					Width:          md.Width,
					Height:         md.Height,
					Order:          md.Order,
					ConvertedURL:   md.ConvertedURL,
					OriginalFormat: md.OriginalFormat,
				}
				if err := db.GetDB().Create(&newMedia).Error; err != nil {
					logging.Log.Error("[ForwardMessages] failed to copy media", "media_id", md.ID, "err", err)
				}
			}
			copiedIDs = append(copiedIDs, msg.ID)
		}

		if len(copiedIDs) == 0 {
			continue
		}

		// Touch chat and member timestamps (mirrors SendMessage).
		db.GetDB().Model(&models.ChatMember{}).
			Where("chat_id = ? AND user_id = ?", chatID, userID).
			Update("last_message_at", now)
		db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("updated_at", now)

		// One message:new broadcast per copied message (same contract as SendMessage).
		for _, msgID := range copiedIDs {
			var msg models.Message
			if err := db.GetDB().Preload("Sender").Preload("Media").First(&msg, "id = ?", msgID).Error; err != nil {
				logging.Log.Error("[ForwardMessages] failed to reload copied message", "message_id", msgID, "err", err)
				continue
			}
			ws.HubInstance.SendToChat(chatID, mustWSMsg("message:new", "message", json.RawMessage(messageToJSON(msg))), "")
		}

		forwarded = append(forwarded, fiber.Map{"chatId": chatID, "messageIds": copiedIDs})
	}

	return c.JSON(fiber.Map{"ok": true, "forwarded": forwarded, "skipped": skipped})
}
// buildFTSQuery turns a free-text query into an FTS5 MATCH expression with
// per-word prefix matching ("кошка мышка" -> ""кошка"* "мышка"*", AND).
func buildFTSQuery(query string) string {
	words := strings.Fields(query)
	if len(words) > 8 {
		words = words[:8]
	}
	parts := make([]string, 0, len(words))
	for _, w := range words {
		escaped := strings.ReplaceAll(w, `"`, `""`)
		parts = append(parts, `"`+escaped+`"*`)
	}
	return strings.Join(parts, " ")
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

// SetMessageSelfDestruct arms (or disarms with seconds=0) a self-destruct
// timer on an existing message. Only the author may do this.
func SetMessageSelfDestruct(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	messageID := c.Params("id")

	var req struct {
		Seconds int `json:"seconds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	timer := validSelfDestructSeconds(req.Seconds)
	if timer < 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid self-destruct timer"})
	}

	var msg models.Message
	if err := db.GetDB().First(&msg, "id = ?", messageID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}
	if msg.SenderID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Only the author can set a self-destruct timer"})
	}
	if msg.IsDeleted {
		return c.Status(400).JSON(fiber.Map{"error": "Message is already deleted"})
	}

	var expiresAt *time.Time
	if timer > 0 {
		t := time.Now().Add(time.Duration(timer) * time.Second)
		expiresAt = &t
	}
	db.GetDB().Model(&msg).Updates(map[string]interface{}{
		"self_destruct_timer": timer,
		"self_destruct_at":    expiresAt,
	})

	ws.HubInstance.SendToChat(msg.ChatID, mustWSMsg("message:self-destruct",
		"messageId", messageID,
		"chatId", msg.ChatID,
		"seconds", timer,
	), "")

	return c.JSON(fiber.Map{"ok": true, "seconds": timer})
}

func GetSearchSuggestions(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	query := c.Query("q")

	var suggestions []models.SearchHistory
	q := db.GetDB().Where("user_id = ?", userID)

	if query != "" {
		// Escape LIKE wildcards (same as SearchMessages) to prevent pattern injection
		likeQuery := "%" + strings.ReplaceAll(strings.ReplaceAll(query, "%", "\\%"), "_", "\\_") + "%"
		q = q.Where("query LIKE ? ESCAPE '\\'", likeQuery)
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

