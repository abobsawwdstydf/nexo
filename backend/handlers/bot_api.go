package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// ─── Telegram-совместимый Bot API ──────────────────────────────────────────
// Эндпоинт: /api/bot/:token/:method (как api.telegram.org/bot<token>/<method>)
// Формат ответов: {"ok":true,"result":...} / {"ok":false,"error_code":...,"description":"..."}

func tgOK(c *fiber.Ctx, result interface{}) error {
	return c.JSON(fiber.Map{"ok": true, "result": result})
}

// botParseBody parses the optional JSON body. Empty bodies are valid (Bot API
// allows passing params via the query string), but a malformed body is a 400.
func botParseBody(c *fiber.Ctx, dst interface{}) error {
	if len(c.Body()) == 0 {
		return nil
	}
	return c.BodyParser(dst)
}

func tgErr(c *fiber.Ctx, code int, description string) error {
	return c.Status(code).JSON(fiber.Map{
		"ok":          false,
		"error_code":  code,
		"description": description,
	})
}

func loadBotByToken(token string) (models.Bot, error) {
	var bot models.Bot
	if result := db.GetDB().Where("token = ?", token).First(&bot); result.Error != nil {
		return bot, result.Error
	}
	return bot, nil
}

func tgUserFromUser(u models.User) map[string]interface{} {
	name := u.DisplayName
	if name == "" {
		name = u.Username
	}
	out := map[string]interface{}{
		"id":         u.ID,
		"is_bot":     false,
		"first_name": name,
	}
	if u.Username != "" {
		out["username"] = u.Username
	}
	if u.Avatar != "" {
		out["photo"] = map[string]interface{}{
			"file_id":   u.Avatar,
			"file_size": 0,
			"width":     128,
			"height":    128,
		}
	}
	return out
}

func tgUserFromBot(b models.Bot) map[string]interface{} {
	out := map[string]interface{}{
		"id":                          b.ID,
		"is_bot":                      true,
		"first_name":                  b.Name,
		"can_join_groups":             true,
		"can_read_all_group_messages": false,
		"supports_inline_queries":     false,
	}
	if b.Username != "" {
		out["username"] = b.Username
	}
	return out
}

func tgChatFromChat(chat models.Chat) map[string]interface{} {
	chatType := "group"
	switch chat.Type {
	case "personal", "direct":
		chatType = "private"
	case "channel":
		chatType = "channel"
	}
	out := map[string]interface{}{
		"id":    chat.ID,
		"type":  chatType,
		"title": chat.Name,
	}
	if chat.Username != "" {
		out["username"] = chat.Username
	}
	return out
}

// botMessageID — маппинг нашего строкового message ID на числовой (Bot API)
func botMessageID(botID, chatID, ourMsgID string) int64 {
	var seq models.BotMessageSeq
	if result := db.GetDB().Where("bot_id = ? AND chat_id = ? AND message_id = ?", botID, chatID, ourMsgID).First(&seq); result.Error == nil {
		return int64(seq.ID)
	}
	seq = models.BotMessageSeq{BotID: botID, ChatID: chatID, MessageID: ourMsgID}
	if err := db.GetDB().Create(&seq).Error; err != nil {
		log.Printf("[bot_api] failed to create message seq: %v", err)
		return int64(len(ourMsgID)) // fallback
	}
	return int64(seq.ID)
}

func ourMessageID(botID, chatID string, tgMsgID int64) string {
	var seq models.BotMessageSeq
	if result := db.GetDB().Where("bot_id = ? AND chat_id = ? AND id = ?", botID, chatID, tgMsgID).First(&seq); result.Error != nil {
		return ""
	}
	return seq.MessageID
}

func tgFileFromMedia(m models.Media, botToken string) map[string]interface{} {
	filePath := strings.TrimPrefix(m.URL, "/")
	return map[string]interface{}{
		"file_id":        m.ID,
		"file_unique_id": m.ID,
		"file_size":      m.Size,
		"file_path":      filePath,
	}
}

func tgMessageFromMsg(bot models.Bot, msg models.Message) map[string]interface{} {
	var chat models.Chat
	db.GetDB().First(&chat, "id = ?", msg.ChatID)
	chatObj := tgChatFromChat(chat)

	var sender map[string]interface{}
	if msg.SenderID == bot.ID {
		sender = tgUserFromBot(bot)
	} else {
		var user models.User
		if err := db.GetDB().First(&user, "id = ?", msg.SenderID).Error; err == nil {
			sender = tgUserFromUser(user)
		} else {
			sender = map[string]interface{}{"id": msg.SenderID, "is_bot": false, "first_name": "Пользователь"}
		}
	}

	out := map[string]interface{}{
		"message_id": botMessageID(bot.ID, msg.ChatID, msg.ID),
		"date":       msg.CreatedAt.Unix(),
		"chat":       chatObj,
		"from":       sender,
	}

	switch msg.Type {
	case "text":
		out["text"] = msg.Content
	case "photo", "image":
		out["caption"] = msg.Content
		if len(msg.Media) > 0 {
			out["photo"] = []map[string]interface{}{tgFileFromMedia(msg.Media[0], bot.Token)}
		}
	case "animation", "gif":
		out["caption"] = msg.Content
		if len(msg.Media) > 0 {
			out["animation"] = tgFileFromMedia(msg.Media[0], bot.Token)
		}
	case "video":
		out["caption"] = msg.Content
		if len(msg.Media) > 0 {
			out["video"] = tgFileFromMedia(msg.Media[0], bot.Token)
		}
	case "audio":
		out["caption"] = msg.Content
		if len(msg.Media) > 0 {
			out["audio"] = tgFileFromMedia(msg.Media[0], bot.Token)
		}
	case "voice":
		if len(msg.Media) > 0 {
			out["voice"] = tgFileFromMedia(msg.Media[0], bot.Token)
		}
	case "video_note":
		if len(msg.Media) > 0 {
			out["video_note"] = tgFileFromMedia(msg.Media[0], bot.Token)
		}
	case "sticker":
		if len(msg.Media) > 0 {
			out["sticker"] = map[string]interface{}{
				"file_id":        msg.Media[0].ID,
				"file_unique_id": msg.Media[0].ID,
				"type":           "regular",
				"width":          512,
				"height":         512,
				"is_animated":    false,
				"is_video":       false,
			}
		}
	default: // document и прочее
		out["caption"] = msg.Content
		if len(msg.Media) > 0 {
			doc := tgFileFromMedia(msg.Media[0], bot.Token)
			doc["file_name"] = msg.Media[0].Filename
			doc["mime_type"] = "application/octet-stream"
			out["document"] = doc
		}
	}

	if msg.ReplyMarkup != "" {
		var markup interface{}
		if err := json.Unmarshal([]byte(msg.ReplyMarkup), &markup); err == nil {
			out["reply_markup"] = markup
		}
	}

	return out
}

// createBotUpdate — сохранить апдейт в очередь и доставить на webhook (если задан)
func createBotUpdate(bot models.Bot, payload map[string]interface{}) {
	data, _ := json.Marshal(payload)
	upd := models.BotUpdate{BotID: bot.ID, Payload: string(data), CreatedAt: time.Now()}
	if err := db.GetDB().Create(&upd).Error; err != nil {
		log.Printf("[bot_api] failed to store update for bot %s: %v", bot.ID, err)
		return
	}
	if bot.WebhookURL == "" {
		return
	}
	// Defense-in-depth: never deliver to a private/internal target even if the
	// URL was saved before the SSRF validation existed.
	if !isURLSafe(bot.WebhookURL) {
		return
	}
	payload["update_id"] = upd.ID
	finalData, _ := json.Marshal(payload)
	go func() {
		req, err := http.NewRequest(http.MethodPost, bot.WebhookURL, bytes.NewReader(finalData))
		if err != nil {
			return
		}
		req.Header.Set("Content-Type", "application/json")
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err != nil {
			log.Printf("[bot_api] webhook delivery to %s failed: %v", bot.WebhookURL, err)
			return
		}
		resp.Body.Close()
	}()
}

// sendBotMessageToChat — создать сообщение от имени бота и раздать по WS
func sendBotMessageToChat(bot models.Bot, chatID, content, msgType string, media []models.Media, replyMarkup string) (models.Message, error) {
	now := time.Now()
	msg := models.Message{
		ID:          generateID(),
		ChatID:      chatID,
		SenderID:    bot.ID,
		Content:     content,
		Type:        msgType,
		ReplyMarkup: replyMarkup,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	if msg.Type == "" {
		msg.Type = "text"
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		return msg, err
	}
	for i, m := range media {
		m.ID = generateID()
		m.MessageID = msg.ID
		m.Order = i
		if err := db.GetDB().Create(&m).Error; err != nil {
			log.Printf("[BotAPI] failed to save media: %v", err)
		}
	}
	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("updated_at", now)

	db.GetDB().Preload("Media").First(&msg, "id = ?", msg.ID)
	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(chatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")
	return msg, nil
}

// ─── Диспетчер ─────────────────────────────────────────────────────────────

func BotAPI(c *fiber.Ctx) error {
	token := c.Params("token")
	method := c.Params("method")
	if token == "" || method == "" {
		return tgErr(c, 400, "Bad Request: token and method required")
	}

	bot, err := loadBotByToken(token)
	if err != nil {
		return tgErr(c, 401, "Unauthorized")
	}
	if !bot.IsActive {
		return tgErr(c, 403, "Bot is disabled")
	}

	switch method {
	case "answerInlineQuery":
		return botAnswerInlineQuery(c, bot)
	case "getMe":
		return tgOK(c, tgUserFromBot(bot))
	case "getUpdates":
		return botGetUpdates(c, bot)
	case "setWebhook":
		return botSetWebhook(c, bot)
	case "deleteWebhook":
		return botDeleteWebhook(c, bot)
	case "getWebhookInfo":
		return botGetWebhookInfo(c, bot)
	case "sendMessage":
		return botSendMessage(c, bot)
	case "editMessageText":
		return botEditMessageText(c, bot)
	case "editMessageReplyMarkup":
		return botEditMessageReplyMarkup(c, bot)
	case "deleteMessage":
		return botDeleteMessage(c, bot)
	case "answerCallbackQuery":
		return tgOK(c, true)
	case "sendChatAction":
		return botSendChatAction(c, bot)
	case "getChat":
		return botGetChat(c, bot)
	case "getChatMember":
		return botGetChatMember(c, bot)
	case "getChatAdministrators":
		return botGetChatAdministrators(c, bot)
	case "leaveChat":
		return botLeaveChat(c, bot)
	case "setMyCommands":
		return botSetMyCommands(c, bot)
	case "getMyCommands":
		return botGetMyCommands(c, bot)
	case "deleteMyCommands":
		return botDeleteMyCommands(c, bot)
	case "sendSticker", "sendPhoto", "sendAnimation", "sendAudio", "sendVideo", "sendDocument", "sendVoice", "sendVideoNote":
		return botSendFile(c, bot, method)
	case "getFile":
		return botGetFile(c, bot)
	default:
		return tgErr(c, 404, fmt.Sprintf("Not Found: method %s is not implemented", method))
	}
}

// ─── Methods ───────────────────────────────────────────────────────────────

func botGetUpdates(c *fiber.Ctx, bot models.Bot) error {
	offset, _ := strconv.ParseInt(c.Query("offset", "0"), 10, 64)
	limit, _ := strconv.Atoi(c.Query("limit", "100"))
	if limit <= 0 || limit > 100 {
		limit = 100
	}

	var updates []models.BotUpdate
	q := db.GetDB().Where("bot_id = ?", bot.ID)
	if offset > 0 {
		// Bot API semantics: offset is the id AFTER the last confirmed update.
		q = q.Where("id > ?", offset)
	}
	if result := q.Order("id ASC").Limit(limit).Find(&updates); result.Error != nil {
		return tgErr(c, 500, "Internal server error")
	}

	result := make([]map[string]interface{}, 0, len(updates))
	for _, u := range updates {
		var payload map[string]interface{}
		if err := json.Unmarshal([]byte(u.Payload), &payload); err != nil {
			continue
		}
		payload["update_id"] = u.ID
		result = append(result, payload)
	}

	// At-least-once delivery: only delete updates the client has confirmed by
	// advancing offset past them. Unacked updates survive a bot crash and are
	// redelivered on the next poll.
	if offset > 0 {
		db.GetDB().Where("bot_id = ? AND id <= ?", bot.ID, offset).Delete(&models.BotUpdate{})
	}
	// Bound the queue: drop updates older than a day regardless of ack state.
	db.GetDB().Where("bot_id = ? AND created_at < ?", bot.ID, time.Now().Add(-24*time.Hour)).Delete(&models.BotUpdate{})

	return tgOK(c, result)
}

func botSetWebhook(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		URL                string `json:"url"`
		DropPendingUpdates bool   `json:"drop_pending_updates"`
	}
	if err := c.BodyParser(&req); err != nil || req.URL == "" {
		return tgErr(c, 400, "Bad Request: url is required")
	}
	// Reject private/internal targets to prevent SSRF via webhook delivery.
	if !isURLSafe(req.URL) {
		return tgErr(c, 400, "Bad Request: url is not allowed")
	}
	if err := db.GetDB().Model(&bot).Update("webhook_url", req.URL).Error; err != nil {
		return tgErr(c, 500, "Internal server error")
	}
	if req.DropPendingUpdates {
		db.GetDB().Where("bot_id = ?", bot.ID).Delete(&models.BotUpdate{})
	}
	return tgOK(c, true)
}

func botDeleteWebhook(c *fiber.Ctx, bot models.Bot) error {
	if err := db.GetDB().Model(&bot).Update("webhook_url", "").Error; err != nil {
		return tgErr(c, 500, "Internal server error")
	}
	return tgOK(c, true)
}

func botGetWebhookInfo(c *fiber.Ctx, bot models.Bot) error {
	var pendingCount int64
	db.GetDB().Model(&models.BotUpdate{}).Where("bot_id = ?", bot.ID).Count(&pendingCount)
	return tgOK(c, map[string]interface{}{
		"url":                    bot.WebhookURL,
		"has_custom_certificate": false,
		"pending_update_count":   pendingCount,
		"last_error_message":     "",
		"max_connections":        40,
	})
}

// checkBotInstalled — бот должен быть установлен в чат
func checkBotInstalled(botID, chatID string) (models.Chat, bool) {
	var chat models.Chat
	if err := db.GetDB().First(&chat, "id = ?", chatID).Error; err != nil {
		return chat, false
	}
	var inst models.BotInstallation
	if err := db.GetDB().Where("bot_id = ? AND chat_id = ? AND is_active = ?", botID, chatID, true).First(&inst).Error; err != nil {
		return chat, false
	}
	return chat, true
}

func parseReplyMarkup(c *fiber.Ctx, bot models.Bot, chatID string) (string, error) {
	var body struct {
		ReplyMarkup json.RawMessage `json:"reply_markup"`
	}
	if len(c.Body()) == 0 {
		return "", nil
	}
	if err := json.Unmarshal(c.Body(), &body); err != nil {
		return "", err
	}
	if len(body.ReplyMarkup) == 0 || string(body.ReplyMarkup) == "null" {
		return "", nil
	}
	return parseReplyMarkupJSON(bot, chatID, body.ReplyMarkup)
}

// parseReplyMarkupJSON — общий разбор reply_markup (JSON-объект):
// reply-клавиатура → состояние чата, remove_keyboard → очистка,
// inline-клавиатура → сохраняется в сообщении.
func parseReplyMarkupJSON(bot models.Bot, chatID string, raw json.RawMessage) (string, error) {
	var markup map[string]interface{}
	if err := json.Unmarshal(raw, &markup); err != nil {
		return "", fmt.Errorf("invalid reply_markup")
	}

	stateID := bot.ID + ":" + chatID

	// Reply-клавиатура — состояние чата (не хранится в сообщении)
	if _, ok := markup["keyboard"].([]interface{}); ok {
		data, _ := json.Marshal(raw)
		var state models.BotChatState
		if err := db.GetDB().Where("id = ?", stateID).First(&state).Error; err != nil {
			state = models.BotChatState{ID: stateID, BotID: bot.ID, ChatID: chatID, ReplyMarkup: string(data)}
			if err := db.GetDB().Create(&state).Error; err != nil {
				log.Printf("[BotAPI] failed to save chat state: %v", err)
			}
		} else {
			db.GetDB().Model(&state).Update("reply_markup", string(data))
		}
		return "", nil
	}

	// remove_keyboard / force_reply — очистить клавиатуру
	if _, ok := markup["remove_keyboard"].(bool); ok {
		db.GetDB().Where("id = ?", stateID).Delete(&models.BotChatState{})
		return "", nil
	}

	// Inline-клавиатура — хранится в сообщении
	return string(raw), nil
}
func botSendMessage(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		ChatID       string `json:"chat_id"`
		Text         string `json:"text"`
		ParseMode    string `json:"parse_mode"`
		ReplyTo      int64  `json:"reply_to_message_id"`
		DisableNotif bool   `json:"disable_notification"`
	}
	if err := c.BodyParser(&req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.ChatID == "" {
		return tgErr(c, 400, "Bad Request: chat_id is required")
	}
	if _, ok := checkBotInstalled(bot.ID, req.ChatID); !ok {
		return tgErr(c, 403, "Forbidden: bot is not a member of the chat")
	}
	if req.Text == "" {
		return tgErr(c, 400, "Bad Request: text is required")
	}
	if len(req.Text) > maxMessageContentLength {
		return tgErr(c, 400, "Bad Request: message is too long")
	}

	replyMarkup, err := parseReplyMarkup(c, bot, req.ChatID)
	if err != nil {
		return tgErr(c, 400, "Bad Request: "+err.Error())
	}

	msg, err := sendBotMessageToChat(bot, req.ChatID, req.Text, "text", nil, replyMarkup)
	if err != nil {
		return tgErr(c, 500, "Internal server error")
	}
	return tgOK(c, tgMessageFromMsg(bot, msg))
}

func botEditMessage(c *fiber.Ctx, bot models.Bot, withText bool) error {
	var req struct {
		ChatID      string          `json:"chat_id"`
		MessageID   int64           `json:"message_id"`
		Text        string          `json:"text"`
		ReplyMarkup json.RawMessage `json:"reply_markup"`
	}
	if err := c.BodyParser(&req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.ChatID == "" || req.MessageID <= 0 {
		return tgErr(c, 400, "Bad Request: chat_id and message_id are required")
	}
	ourID := ourMessageID(bot.ID, req.ChatID, req.MessageID)
	if ourID == "" {
		return tgErr(c, 400, "Bad Request: message to edit not found")
	}

	var msg models.Message
	if err := db.GetDB().Preload("Media").First(&msg, "id = ?", ourID).Error; err != nil {
		return tgErr(c, 400, "Bad Request: message to edit not found")
	}
	// Bots may only edit messages they sent themselves.
	if msg.SenderID != bot.ID || msg.ChatID != req.ChatID {
		return tgErr(c, 403, "Forbidden: bots can only edit their own messages")
	}

	updates := map[string]interface{}{"updated_at": time.Now()}
	if withText {
		if req.Text == "" {
			return tgErr(c, 400, "Bad Request: text is required")
		}
		updates["content"] = req.Text
	}
	if len(req.ReplyMarkup) > 0 && string(req.ReplyMarkup) != "null" {
		markup, err := parseReplyMarkup(c, bot, req.ChatID)
		if err != nil {
			return tgErr(c, 400, "Bad Request: "+err.Error())
		}
		updates["reply_markup"] = markup
	}
	db.GetDB().Model(&msg).Updates(updates)

	db.GetDB().Preload("Media").First(&msg, "id = ?", ourID)
	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(msg.ChatID, mustWSMsg("message:edited", "message", json.RawMessage(msgJSON)), "")
	return tgOK(c, tgMessageFromMsg(bot, msg))
}

func botEditMessageText(c *fiber.Ctx, bot models.Bot) error {
	return botEditMessage(c, bot, true)
}

func botEditMessageReplyMarkup(c *fiber.Ctx, bot models.Bot) error {
	return botEditMessage(c, bot, false)
}

func botDeleteMessage(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		ChatID    string `json:"chat_id"`
		MessageID int64  `json:"message_id"`
	}
	if err := c.BodyParser(&req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	ourID := ourMessageID(bot.ID, req.ChatID, req.MessageID)
	if ourID == "" {
		return tgErr(c, 400, "Bad Request: message not found")
	}
	var msg models.Message
	if err := db.GetDB().First(&msg, "id = ?", ourID).Error; err != nil {
		return tgErr(c, 400, "Bad Request: message not found")
	}
	// Bots may only delete messages they sent themselves.
	if msg.SenderID != bot.ID || msg.ChatID != req.ChatID {
		return tgErr(c, 403, "Forbidden: bots can only delete their own messages")
	}
	db.GetDB().Model(&msg).Updates(map[string]interface{}{
		"is_deleted": true,
		"content":    "",
		"updated_at": time.Now(),
	})
	ws.HubInstance.SendToChat(msg.ChatID, mustWSMap("message:deleted", map[string]string{
		"messageId": msg.ID,
		"chatId":    msg.ChatID,
	}), "")
	return tgOK(c, true)
}

func botSendChatAction(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		ChatID string `json:"chat_id"`
		Action string `json:"action"`
	}
	if err := c.BodyParser(&req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.ChatID == "" {
		return tgErr(c, 400, "Bad Request: chat_id is required")
	}
	if _, ok := checkBotInstalled(bot.ID, req.ChatID); !ok {
		return tgErr(c, 403, "Forbidden: bot is not a member of the chat")
	}
	ws.HubInstance.SendToChat(req.ChatID, mustWSMap("typing", map[string]string{
		"chatId": req.ChatID,
		"userId": bot.ID,
	}), "")
	return tgOK(c, true)
}

func botGetChat(c *fiber.Ctx, bot models.Bot) error {
	chatID := c.Query("chat_id")
	if chatID == "" {
		var req struct {
			ChatID string `json:"chat_id"`
		}
		if err := botParseBody(c, &req); err != nil {
			return tgErr(c, 400, "Bad Request: invalid JSON body")
		}
		chatID = req.ChatID
	}
	if chatID == "" {
		return tgErr(c, 400, "Bad Request: chat_id is required")
	}
	chat, ok := checkBotInstalled(bot.ID, chatID)
	if !ok {
		return tgErr(c, 403, "Forbidden: bot is not a member of the chat")
	}
	return tgOK(c, tgChatFromChat(chat))
}

func botGetChatMember(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		ChatID string `json:"chat_id"`
		UserID string `json:"user_id"`
	}
	if err := botParseBody(c, &req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.ChatID == "" {
		req.ChatID = c.Query("chat_id")
	}
	if req.UserID == "" {
		req.UserID = c.Query("user_id")
	}
	if req.ChatID == "" || req.UserID == "" {
		return tgErr(c, 400, "Bad Request: chat_id and user_id are required")
	}
	if _, ok := checkBotInstalled(bot.ID, req.ChatID); !ok {
		return tgErr(c, 403, "Forbidden: bot is not a member of the chat")
	}

	status := "left"
	var member models.ChatMember
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", req.ChatID, req.UserID).First(&member).Error; err == nil {
		switch member.Role {
		case "owner":
			status = "creator"
		case "admin":
			status = "administrator"
		default:
			status = "member"
		}
	}
	var user models.User
	if err := db.GetDB().First(&user, "id = ?", req.UserID).Error; err != nil {
		user = models.User{ID: req.UserID, DisplayName: "Пользователь"}
	}
	return tgOK(c, map[string]interface{}{
		"status": status,
		"user":   tgUserFromUser(user),
	})
}

func botGetChatAdministrators(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		ChatID string `json:"chat_id"`
	}
	if err := botParseBody(c, &req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.ChatID == "" {
		req.ChatID = c.Query("chat_id")
	}
	if req.ChatID == "" {
		return tgErr(c, 400, "Bad Request: chat_id is required")
	}
	if _, ok := checkBotInstalled(bot.ID, req.ChatID); !ok {
		return tgErr(c, 403, "Forbidden: bot is not a member of the chat")
	}

	var members []models.ChatMember
	if err := db.GetDB().Preload("User").
		Where("chat_id = ? AND role IN ?", req.ChatID, []string{"owner", "admin"}).
		Find(&members).Error; err != nil {
		return tgErr(c, 500, "Internal server error")
	}
	result := make([]map[string]interface{}, 0, len(members))
	for _, m := range members {
		status := "administrator"
		if m.Role == "owner" {
			status = "creator"
		}
		result = append(result, map[string]interface{}{
			"status": status,
			"user":   tgUserFromUser(m.User),
		})
	}
	return tgOK(c, result)
}

func botLeaveChat(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		ChatID string `json:"chat_id"`
	}
	if err := botParseBody(c, &req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.ChatID == "" {
		req.ChatID = c.Query("chat_id")
	}
	if req.ChatID == "" {
		return tgErr(c, 400, "Bad Request: chat_id is required")
	}
	db.GetDB().Where("bot_id = ? AND chat_id = ?", bot.ID, req.ChatID).Delete(&models.BotInstallation{})
	db.GetDB().Where("id = ?", bot.ID+":"+req.ChatID).Delete(&models.BotChatState{})
	msg := models.Message{
		ID:        generateID(),
		ChatID:    req.ChatID,
		SenderID:  bot.ID,
		Content:   fmt.Sprintf("Бот %s покинул чат", bot.Name),
		Type:      "system",
		CreatedAt: time.Now(),
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		log.Printf("[BotAPI] failed to save leave message: %v", err)
	}
	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(req.ChatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")
	return tgOK(c, true)
}

func botSetMyCommands(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		Commands []struct {
			Command     string `json:"command"`
			Description string `json:"description"`
		} `json:"commands"`
	}
	if err := c.BodyParser(&req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	db.GetDB().Where("bot_id = ?", bot.ID).Delete(&models.BotCommand{})
	for _, cmd := range req.Commands {
		cmdName := strings.TrimPrefix(strings.ToLower(cmd.Command), "/")
		if cmdName == "" {
			continue
		}
		entry := models.BotCommand{
			ID:          generateID(),
			BotID:       bot.ID,
			Command:     "/" + cmdName,
			Description: cmd.Description,
			IsActive:    true,
		}
		if err := db.GetDB().Create(&entry).Error; err != nil {
			log.Printf("[BotAPI] failed to save command entry: %v", err)
		}
	}
	return tgOK(c, true)
}

func botGetMyCommands(c *fiber.Ctx, bot models.Bot) error {
	var commands []models.BotCommand
	db.GetDB().Where("bot_id = ? AND is_active = ?", bot.ID, true).Find(&commands)
	result := make([]map[string]interface{}, 0, len(commands))
	for _, cmd := range commands {
		result = append(result, map[string]interface{}{
			"command":     strings.TrimPrefix(cmd.Command, "/"),
			"description": cmd.Description,
		})
	}
	return tgOK(c, result)
}

func botDeleteMyCommands(c *fiber.Ctx, bot models.Bot) error {
	if err := db.GetDB().Where("bot_id = ?", bot.ID).Delete(&models.BotCommand{}).Error; err != nil {
		return tgErr(c, 500, "Internal server error")
	}
	return tgOK(c, true)
}

func botSendFile(c *fiber.Ctx, bot models.Bot, method string) error {
	// Multipart upload (Telegram Bot API: файл как form-data, поле "file")
	if strings.HasPrefix(strings.ToLower(c.Get("Content-Type")), "multipart/form-data") {
		return botSendFileMultipart(c, bot, method)
	}
	var req struct {
		ChatID    string `json:"chat_id"`
		Caption   string `json:"caption"`
		FileID    string `json:"file_id"`
		Photo     string `json:"photo"`
		Animation string `json:"animation"`
		Audio     string `json:"audio"`
		Video     string `json:"video"`
		Document  string `json:"document"`
		Voice     string `json:"voice"`
		VideoNote string `json:"video_note"`
		Sticker   string `json:"sticker"`
	}
	if err := c.BodyParser(&req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.ChatID == "" {
		return tgErr(c, 400, "Bad Request: chat_id is required")
	}
	if _, ok := checkBotInstalled(bot.ID, req.ChatID); !ok {
		return tgErr(c, 403, "Forbidden: bot is not a member of the chat")
	}

	fileRef := ""
	switch method {
	case "sendPhoto":
		fileRef = firstNonEmpty(req.Photo, req.FileID)
	case "sendAnimation":
		fileRef = firstNonEmpty(req.Animation, req.FileID)
	case "sendAudio":
		fileRef = firstNonEmpty(req.Audio, req.FileID)
	case "sendVideo":
		fileRef = firstNonEmpty(req.Video, req.FileID)
	case "sendDocument":
		fileRef = firstNonEmpty(req.Document, req.FileID)
	case "sendVoice":
		fileRef = firstNonEmpty(req.Voice, req.FileID)
	case "sendVideoNote":
		fileRef = firstNonEmpty(req.VideoNote, req.FileID)
	case "sendSticker":
		fileRef = firstNonEmpty(req.Sticker, req.FileID)
	}
	if fileRef == "" {
		return tgErr(c, 400, "Bad Request: file_id or URL is required")
	}

	msgType := method
	switch method {
	case "sendPhoto":
		msgType = "photo"
	case "sendAnimation":
		msgType = "animation"
	case "sendVideo":
		msgType = "video"
	case "sendAudio":
		msgType = "audio"
	case "sendVoice":
		msgType = "voice"
	case "sendVideoNote":
		msgType = "video_note"
	case "sendSticker":
		msgType = "sticker"
	case "sendDocument":
		msgType = "document"
	}

	var media models.Media
	if strings.HasPrefix(fileRef, "/") || strings.HasPrefix(fileRef, "http") {
		media = models.Media{
			ID:       generateID(),
			Type:     msgType,
			URL:      fileRef,
			Filename: fileNameFromURL(fileRef),
			Size:     0,
		}
	} else {
		// file_id — берём из существующей медиа-записи
		var existing models.Media
		if err := db.GetDB().First(&existing, "id = ?", fileRef).Error; err != nil {
			return tgErr(c, 400, "Bad Request: file_id not found")
		}
		media = models.Media{
			ID:        generateID(),
			Type:      msgType,
			URL:       existing.URL,
			Filename:  existing.Filename,
			Thumbnail: existing.Thumbnail,
			Size:      existing.Size,
			Duration:  existing.Duration,
			Width:     existing.Width,
			Height:    existing.Height,
		}
	}

	replyMarkup, err := parseReplyMarkup(c, bot, req.ChatID)
	if err != nil {
		return tgErr(c, 400, "Bad Request: "+err.Error())
	}

	msg, err := sendBotMessageToChat(bot, req.ChatID, req.Caption, msgType, []models.Media{media}, replyMarkup)
	if err != nil {
		return tgErr(c, 500, "Internal server error")
	}
	return tgOK(c, tgMessageFromMsg(bot, msg))
}

func botGetFile(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		FileID string `json:"file_id"`
	}
	if err := botParseBody(c, &req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.FileID == "" {
		req.FileID = c.Query("file_id")
	}
	if req.FileID == "" {
		return tgErr(c, 400, "Bad Request: file_id is required")
	}
	var media models.Media
	if err := db.GetDB().First(&media, "id = ?", req.FileID).Error; err != nil {
		return tgErr(c, 400, "Bad Request: file_id not found")
	}

	// Scope access to files the bot can actually see: media must belong to a
	// message in a chat where this bot is installed.
	var msg models.Message
	if err := db.GetDB().First(&msg, "id = ?", media.MessageID).Error; err != nil {
		return tgErr(c, 403, "Forbidden: file is not accessible to this bot")
	}
	var count int64
	db.GetDB().Model(&models.BotInstallation{}).Where("bot_id = ? AND chat_id = ? AND is_active = ?", bot.ID, msg.ChatID, true).Count(&count)
	if count == 0 {
		return tgErr(c, 403, "Forbidden: file is not accessible to this bot")
	}
	return tgOK(c, tgFileFromMedia(media, bot.Token))
}

// BotFile — скачивание файла по file_path: GET /file/:token/* (как api.telegram.org/file/bot<token>/<path>)
func BotFile(c *fiber.Ctx) error {
	token := c.Params("token")
	path := c.Params("*")
	if token == "" || path == "" {
		return c.Status(400).JSON(fiber.Map{"error": "token and path required"})
	}
	if _, err := loadBotByToken(token); err != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	return c.Redirect("/uploads/"+path, http.StatusFound)
}

// ─── Уведомление ботов о новых сообщениях ─────────────────────────────────

// notifyBotsOfMessage — рассылает апдейт "message" всем установленным ботам
func notifyBotsOfMessage(chatID string, msg models.Message, senderUser models.User) {
	var installations []models.BotInstallation
	if err := db.GetDB().Where("chat_id = ? AND is_active = ?", chatID, true).Find(&installations).Error; err != nil {
		return
	}
	if len(installations) == 0 {
		return
	}

	for _, inst := range installations {
		var bot models.Bot
		if err := db.GetDB().First(&bot, "id = ?", inst.BotID).Error; err != nil {
			continue
		}
		// Бот не получает свои собственные сообщения
		if msg.SenderID == bot.ID {
			continue
		}

		tgMsg := tgMessageFromMsg(bot, msg)
		payload := map[string]interface{}{"message": tgMsg}
		createBotUpdate(bot, payload)

		// Команды бота
		if msg.Type == "text" && strings.HasPrefix(msg.Content, "/") {
			cmdName := strings.ToLower(strings.SplitN(msg.Content, " ", 2)[0])
			var command models.BotCommand
			if err := db.GetDB().Where("bot_id = ? AND command = ? AND is_active = ?", bot.ID, cmdName, true).First(&command).Error; err == nil {
				handlerUpdate := map[string]interface{}{
					"message": tgMsg,
					"command": map[string]interface{}{
						"command":     cmdName,
						"description": command.Description,
					},
				}
				if command.Response != "" {
					go func(b models.Bot, chatID, response string) {
						if _, err := sendBotMessageToChat(b, chatID, response, "text", nil, ""); err != nil {
							log.Printf("[bot_api] command response failed for %s: %v", b.ID, err)
						}
					}(bot, chatID, command.Response)
				}
				if command.HandlerURL != "" {
					// SECURITY (SSRF): validate the handler URL before calling it —
					// otherwise a bot owner could point the server at internal
					// endpoints (metadata, admin panels).
					if !isURLSafe(command.HandlerURL) {
						log.Printf("[bot_api] blocked unsafe handler URL for command %s", cmdName)
						continue
					}
					data, _ := json.Marshal(handlerUpdate)
					url := command.HandlerURL
					go func() {
						req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(data))
						if err != nil {
							return
						}
						req.Header.Set("Content-Type", "application/json")
						client := &http.Client{Timeout: 10 * time.Second}
						resp, err := client.Do(req)
						if err != nil {
							log.Printf("[bot_api] command handler %s failed: %v", url, err)
							return
						}
						resp.Body.Close()
					}()
				}
			}
		}
	}
}

// ─── Callback (с фронта, авторизованный JWT) ───────────────────────────────

// BotCallback — нажатие inline-кнопки пользователем
func BotCallback(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	var req struct {
		ChatID       string `json:"chatId"`
		MessageID    string `json:"messageId"`
		CallbackData string `json:"callbackData"`
		ChatInstance string `json:"chatInstance"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.ChatID == "" || req.MessageID == "" || req.CallbackData == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId, messageId and callbackData are required"})
	}

	var msg models.Message
	if err := db.GetDB().First(&msg, "id = ?", req.MessageID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}
	if msg.ChatID != req.ChatID {
		return c.Status(403).JSON(fiber.Map{"error": "Message is not in this chat"})
	}

	// SECURITY: only chat members may press inline buttons
	if !isChatMember(req.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	var bot models.Bot
	if err := db.GetDB().First(&bot, "id = ?", msg.SenderID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sender is not a bot"})
	}

	payload := map[string]interface{}{
		"callback_query": map[string]interface{}{
			"id":            generateID(),
			"from":          tgUserFromUser(user),
			"message":       tgMessageFromMsg(bot, msg),
			"chat_instance": req.ChatInstance,
			"data":          req.CallbackData,
		},
	}
	createBotUpdate(bot, payload)

	return c.JSON(fiber.Map{"ok": true})
}

// ─── Helpers ───────────────────────────────────────────────────────────────

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}

func fileNameFromURL(url string) string {
	trimmed := strings.Trim(url, "/")
	if idx := strings.LastIndex(trimmed, "/"); idx >= 0 {
		trimmed = trimmed[idx+1:]
	}
	if idx := strings.IndexAny(trimmed, "?#"); idx >= 0 {
		trimmed = trimmed[:idx]
	}
	return trimmed
}

// ─── Inline-режим (answerInlineQuery + пользовательские эндпоинты) ─────────

// inlineQueryResultTTL — сколько живут одноразовые результаты inline-запроса
const inlineQueryResultTTL = 10 * time.Minute

// cleanupExpiredInlineResults — удаляет протухшие результаты (TTL 10 минут)
func cleanupExpiredInlineResults() {
	db.GetDB().Where("created_at < ?", time.Now().Add(-inlineQueryResultTTL)).Delete(&models.InlineQueryResult{})
}

// botAnswerInlineQuery — бот отвечает на inline_query: результаты одноразовые,
// хранятся в InlineQueryResult (не попадают в bot_updates/getUpdates).
func botAnswerInlineQuery(c *fiber.Ctx, bot models.Bot) error {
	var req struct {
		InlineQueryID string            `json:"inline_query_id"`
		Results       []json.RawMessage `json:"results"`
		CacheTime     int               `json:"cache_time"`
	}
	if err := botParseBody(c, &req); err != nil {
		return tgErr(c, 400, "Bad Request: invalid JSON body")
	}
	if req.InlineQueryID == "" {
		return tgErr(c, 400, "Bad Request: inline_query_id is required")
	}
	if len(req.Results) > 50 {
		return tgErr(c, 400, "Bad Request: too many results (max 50)")
	}
	data, _ := json.Marshal(req.Results)
	now := time.Now()
	var existing models.InlineQueryResult
	if err := db.GetDB().Where("inline_query_id = ?", req.InlineQueryID).First(&existing).Error; err == nil {
		// повторный ответ на тот же запрос — перезаписываем
		if err := db.GetDB().Model(&existing).Updates(map[string]interface{}{
			"bot_id":     bot.ID,
			"results":    string(data),
			"created_at": now,
		}).Error; err != nil {
			return tgErr(c, 500, "Internal server error")
		}
	} else {
		entry := models.InlineQueryResult{
			InlineQueryID: req.InlineQueryID,
			BotID:         bot.ID,
			Results:       string(data),
			CreatedAt:     now,
		}
		if err := db.GetDB().Create(&entry).Error; err != nil {
			return tgErr(c, 500, "Internal server error")
		}
	}
	cleanupExpiredInlineResults()
	return tgOK(c, map[string]interface{}{"inline_query_id": req.InlineQueryID})
}

// BotInline — пользователь набирает «@bot <query>» в композере (auth):
// создаёт апдейт inline_query, доставляет на webhook и ждёт ответ бота.
func BotInline(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		BotUsername string `json:"botUsername"`
		Query       string `json:"query"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	username := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(req.BotUsername)), "@")
	if username == "" {
		return c.Status(400).JSON(fiber.Map{"error": "botUsername is required"})
	}
	if len(req.Query) > 512 {
		return c.Status(400).JSON(fiber.Map{"error": "query is too long"})
	}

	var bot models.Bot
	if err := db.GetDB().Where("username = ?", username).First(&bot).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}
	if !bot.IsActive {
		return c.Status(403).JSON(fiber.Map{"error": "Bot is disabled"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	inlineQueryID := generateID()
	payload := map[string]interface{}{
		"inline_query": map[string]interface{}{
			"id":     inlineQueryID,
			"from":   tgUserFromUser(user),
			"query":  req.Query,
			"offset": "",
		},
	}
	createBotUpdate(bot, payload)

	// Pre-create результат с query: botAnswerInlineQuery допишет results и
	// сохранит query для chosen_inline_result. Пустые results = бот ещё не ответил.
	pre := models.InlineQueryResult{InlineQueryID: inlineQueryID, Query: req.Query, Results: "", CreatedAt: time.Now()}
	db.GetDB().Create(&pre)

	// Webhook-доставка асинхронная: ждём ответ бота (answerInlineQuery)
	// коротким опросом InlineQueryResult, максимум ~2.5с.
	deadline := time.Now().Add(2500 * time.Millisecond)
	var rec models.InlineQueryResult
	found := false
	for !found && time.Now().Before(deadline) {
		if err := db.GetDB().Where("inline_query_id = ? AND results <> ''", inlineQueryID).First(&rec).Error; err == nil {
			found = true
		} else {
			time.Sleep(120 * time.Millisecond)
		}
	}

	results := make([]json.RawMessage, 0)
	if found && time.Since(rec.CreatedAt) <= inlineQueryResultTTL {
		_ = json.Unmarshal([]byte(rec.Results), &results)
	}
	return c.JSON(fiber.Map{
		"ok":              true,
		"results":         results,
		"inline_query_id": inlineQueryID,
	})
}

// BotInlineResult — пользователь выбрал результат (auth): апдейт
// chosen_inline_result боту + возврат выбранного результата.
func BotInlineResult(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		InlineQueryID string `json:"inlineQueryId"`
		ResultID      string `json:"resultId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.InlineQueryID == "" || req.ResultID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "inlineQueryId and resultId are required"})
	}

	var rec models.InlineQueryResult
	if err := db.GetDB().Where("inline_query_id = ?", req.InlineQueryID).First(&rec).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Inline query not found or expired"})
	}
	if time.Since(rec.CreatedAt) > inlineQueryResultTTL {
		db.GetDB().Delete(&rec)
		return c.Status(404).JSON(fiber.Map{"error": "Inline query not found or expired"})
	}

	var results []map[string]interface{}
	if err := json.Unmarshal([]byte(rec.Results), &results); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load results"})
	}
	var chosen map[string]interface{}
	for _, r := range results {
		if id, _ := r["id"].(string); id == req.ResultID {
			chosen = r
			break
		}
	}
	if chosen == nil {
		return c.Status(404).JSON(fiber.Map{"error": "Result not found"})
	}

	var bot models.Bot
	if err := db.GetDB().First(&bot, "id = ?", rec.BotID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}
	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	from := tgUserFromUser(user)
	payload := map[string]interface{}{
		"chosen_inline_result": map[string]interface{}{
			"result_id": req.ResultID,
			"from":      from,
			"inline_query": map[string]interface{}{
				"id":    req.InlineQueryID,
				"from":  from,
				"query": rec.Query,
			},
		},
	}
	createBotUpdate(bot, payload)

	return c.JSON(fiber.Map{"ok": true, "result": chosen})
}

// botSendFileMultipart — метод send*File с файлом из multipart form-data
// (поле "file", как у Telegram Bot API). Файл валидируется и сохраняется
// тем же пайплайном, что и обычные аплоады (upload.go).
func botSendFileMultipart(c *fiber.Ctx, bot models.Bot, method string) error {
	chatID := c.FormValue("chat_id")
	if chatID == "" {
		return tgErr(c, 400, "Bad Request: chat_id is required")
	}
	if _, ok := checkBotInstalled(bot.ID, chatID); !ok {
		return tgErr(c, 403, "Forbidden: bot is not a member of the chat")
	}

	var fh *multipart.FileHeader
	for _, field := range []string{"file", "photo", "animation", "audio", "video", "document", "voice", "video_note", "sticker"} {
		f, err := c.FormFile(field)
		if err == nil {
			fh = f
			break
		}
	}
	if fh == nil {
		return tgErr(c, 400, "Bad Request: file is required (field \"file\")")
	}

	msgType := fileMethodToMsgType(method)
	media, err := saveBotUploadedFile(c, fh, msgType)
	if err != nil {
		return tgErr(c, 400, "Bad Request: "+err.Error())
	}

	replyMarkup, err := parseReplyMarkupMultipart(c, bot, chatID)
	if err != nil {
		return tgErr(c, 400, "Bad Request: "+err.Error())
	}

	msg, err := sendBotMessageToChat(bot, chatID, c.FormValue("caption"), msgType, []models.Media{media}, replyMarkup)
	if err != nil {
		return tgErr(c, 500, "Internal server error")
	}
	return tgOK(c, tgMessageFromMsg(bot, msg))
}

// saveBotUploadedFile — сохраняет загруженный ботом файл в uploads с полной
// валидацией (размер, magic bytes, расширение) — как в UploadFile.
func saveBotUploadedFile(c *fiber.Ctx, fh *multipart.FileHeader, mediaType string) (models.Media, error) {
	if fh.Size > 50*1024*1024 {
		return models.Media{}, fmt.Errorf("file too large (max 50MB)")
	}
	src, err := fh.Open()
	if err != nil {
		return models.Media{}, fmt.Errorf("failed to open file")
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, err := src.Read(buf)
	if err != nil && n == 0 {
		return models.Media{}, fmt.Errorf("failed to read file header")
	}
	contentType := detectContentType(buf[:n], fh.Filename, fh.Header.Get("Content-Type"))

	allowedTypes := map[string]bool{
		"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true,
		"video/mp4": true, "video/webm": true, "video/quicktime": true,
		"audio/mpeg": true, "audio/ogg": true, "audio/wav": true, "audio/webm": true,
		"application/pdf": true,
	}
	if !allowedTypes[contentType] {
		return models.Media{}, fmt.Errorf("file type not allowed: %s", contentType)
	}

	ext := strings.ToLower(filepath.Ext(fh.Filename))
	if ext != "" {
		if !isExtensionCompatible(ext, contentType) {
			return models.Media{}, fmt.Errorf("file extension does not match content")
		}
	} else {
		ext = mimeToExt(contentType)
	}
	filename := generateID() + ext
	if err := c.SaveFile(fh, filepath.Join(UploadDir(), filename)); err != nil {
		log.Printf("[BotAPI] failed to save uploaded file %s: %v", filename, err)
		return models.Media{}, fmt.Errorf("failed to save file")
	}

	return models.Media{
		ID:             generateID(),
		Type:           mediaType,
		URL:            "/uploads/" + filename,
		Filename:       fh.Filename,
		Size:           int(fh.Size),
		OriginalFormat: contentType,
	}, nil
}

// parseReplyMarkupMultipart — reply_markup как form-поле в multipart-запросе
func parseReplyMarkupMultipart(c *fiber.Ctx, bot models.Bot, chatID string) (string, error) {
	raw := c.FormValue("reply_markup")
	if raw == "" || raw == "null" {
		return "", nil
	}
	return parseReplyMarkupJSON(bot, chatID, json.RawMessage(raw))
}

// fileMethodToMsgType — маппинг метода send*File на тип сообщения/медиа
func fileMethodToMsgType(method string) string {
	switch method {
	case "sendPhoto":
		return "photo"
	case "sendAnimation":
		return "animation"
	case "sendVideo":
		return "video"
	case "sendAudio":
		return "audio"
	case "sendVoice":
		return "voice"
	case "sendVideoNote":
		return "video_note"
	case "sendSticker":
		return "sticker"
	default: // sendDocument и прочее
		return "document"
	}
}
