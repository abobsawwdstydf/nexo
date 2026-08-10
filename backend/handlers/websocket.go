package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/gofiber/websocket/v2"
	"github.com/golang-jwt/jwt/v5"

	"gorm.io/gorm"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
	"nexo/ws"
)

// activeWSConnections tracks active WebSocket connections per user to prevent duplicate sessions.
var (
	activeWSConnections   = make(map[string]int)
	activeWSConnectionsMu sync.Mutex
)

// WebSocket rate limiting � max 30 messages per second per user
const (
	wsRateLimitMax    = 30
	wsRateLimitWindow = time.Second
)

type wsRateEntry struct {
	Count       int
	WindowStart time.Time
}

var (
	wsRateLimit   = make(map[string]*wsRateEntry)
	wsRateLimitMu sync.Mutex
)

func wsCheckRateLimit(userID string) bool {
	return wsCheckTypeRateLimit(userID, wsRateLimitMax, wsRateLimitWindow)
}

// wsCheckTypeRateLimit is a sliding-window limiter for a composite key
// (e.g. "userID|send_message"), used to throttle mutation-heavy WS events
// tighter than the global per-user cap.
func wsCheckTypeRateLimit(key string, max int, window time.Duration) bool {
	wsRateLimitMu.Lock()
	defer wsRateLimitMu.Unlock()

	now := time.Now()
	entry, exists := wsRateLimit[key]

	if !exists || now.Sub(entry.WindowStart) > window {
		// Opportunistic cleanup: drop stale entries to prevent unbounded growth
		if len(wsRateLimit) > 2000 {
			for k, e := range wsRateLimit {
				if now.Sub(e.WindowStart) > window {
					delete(wsRateLimit, k)
				}
			}
		}
		wsRateLimit[key] = &wsRateEntry{Count: 1, WindowStart: now}
		return true
	}

	if entry.Count >= max {
		return false
	}

	entry.Count++
	return true
}

// wsEnvelope is the unified inbound message envelope.
type wsEnvelope struct {
	ID      string          `json:"id,omitempty"`      // RPC request ID (empty = broadcast)
	Type    string          `json:"type"`              // message type
	ChatID  string          `json:"chatId,omitempty"`  // target chat
	Payload json.RawMessage `json:"payload,omitempty"` // type-specific payload
	// Direct fields for backward compatibility with old broadcast format
	MessageID string `json:"messageId,omitempty"`
	Emoji     string `json:"emoji,omitempty"`
	Content   string `json:"content,omitempty"`
	Message   string `json:"message,omitempty"`
}

// wsResponse sends an RPC response back to the requesting client.
func wsResponse(client *ws.Client, reqID string, data interface{}) {
	if reqID == "" {
		return
	}
	resp := map[string]interface{}{
		"id": reqID,
	}
	switch v := data.(type) {
	case *wsDataResponse:
		resp["ok"] = true
		for k, val := range v.Data {
			resp[k] = val
		}
	case error:
		resp["ok"] = false
		resp["error"] = v.Error()
	default:
		resp["ok"] = true
		if m, ok := data.(map[string]interface{}); ok {
			for k, val := range m {
				resp[k] = val
			}
		}
	}
	b, err := json.Marshal(resp)
	if err != nil {
		return
	}
	ws.HubInstance.SendToClient(client, b)
}

// handleTyping processes typing indicators via WS.
func handleTyping(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		ChatID string `json:"chatId"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	} else {
		payload.ChatID = env.ChatID
	}
	if payload.ChatID == "" {
		return errWSMissingField("chatId")
	}

	userID := client.UserID

	// Verify membership
	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).
		Count(&count)
	if count == 0 {
		return errWSNotMember
	}

	// Throttle DB writes: if a fresh indicator exists, just broadcast
	var existing models.TypingIndicator
	now := time.Now()
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).First(&existing).Error; err == nil && existing.ExpiresAt.After(now.Add(3*time.Second)) {
		ws.HubInstance.SendToChat(payload.ChatID, mustWSMap("typing", map[string]string{
			"chatId": payload.ChatID,
			"userId": userID,
		}), userID)
		return nil
	}

	// Upsert typing indicator
	db.GetDB().Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).
		Delete(&models.TypingIndicator{})
	indicator := models.TypingIndicator{
		ID:        generateID(),
		ChatID:    payload.ChatID,
		UserID:    userID,
		ExpiresAt: now.Add(5 * time.Second),
	}
	db.GetDB().Create(&indicator)

	// Broadcast typing event to chat members
	ws.HubInstance.SendToChat(payload.ChatID, mustWSMap("typing", map[string]string{
		"chatId": payload.ChatID,
		"userId": userID,
	}), userID)
	return nil
}

// handleReadReceipt processes read receipts via WS.
func handleReadReceipt(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		ChatID    string `json:"chatId"`
		MessageID string `json:"messageId"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	} else {
		payload.ChatID = env.ChatID
		payload.MessageID = env.MessageID
	}
	if payload.ChatID == "" || payload.MessageID == "" {
		return errWSMissingField("chatId, messageId")
	}

	userID := client.UserID
	if err := recordReadReceipt(db.GetDB(), payload.ChatID, payload.MessageID, userID); err != nil {
		switch err {
		case errReadReceiptNotMember:
			return errWSNotMember
		case errReadReceiptNotFound:
			return errWSInvalidField("messageId (message not found in chat)")
		default:
			return fmt.Errorf("record read receipt: %w", err)
		}
	}

	ws.HubInstance.SendToChat(payload.ChatID, mustWSMap("message:read", map[string]string{
		"messageId": payload.MessageID,
		"userId":    userID,
	}), "")
	return nil
}

// handleReaction processes reactions via WS.
func handleReaction(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		ChatID    string `json:"chatId"`
		MessageID string `json:"messageId"`
		Emoji     string `json:"emoji"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	} else {
		payload.ChatID = env.ChatID
		payload.MessageID = env.MessageID
		payload.Emoji = env.Emoji
	}
	if payload.ChatID == "" || payload.MessageID == "" || payload.Emoji == "" {
		return errWSMissingField("chatId, messageId, emoji")
	}
	if len([]rune(payload.Emoji)) > 8 {
		return errWSInvalidField("emoji (max 8 characters)")
	}

	userID := client.UserID

	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).
		Count(&count)
	if count == 0 {
		return errWSNotMember
	}

	var msg models.Message
	if result := db.GetDB().First(&msg, "id = ?", payload.MessageID); result.Error != nil {
		return errWSNotFound("message")
	}

	// Toggle reaction
	var existing models.Reaction
	if result := db.GetDB().Where("message_id = ? AND user_id = ? AND emoji = ?", payload.MessageID, userID, payload.Emoji).First(&existing); result.Error == nil {
		if err := db.GetDB().Delete(&existing).Error; err != nil {
			return errWSServerError
		}
		ws.HubInstance.SendToChat(payload.ChatID, mustWSMap("message:reaction_removed", map[string]string{
			"messageId": payload.MessageID,
			"userId":    userID,
			"emoji":     payload.Emoji,
		}), "")
		return nil
	}

	reaction := models.Reaction{
		ID:        generateID(),
		MessageID: payload.MessageID,
		UserID:    userID,
		Emoji:     payload.Emoji,
	}
	if err := db.GetDB().Create(&reaction).Error; err != nil {
		return errWSServerError
	}

	ws.HubInstance.SendToChat(payload.ChatID, mustWSMap("message:reaction_added", map[string]string{
		"messageId": payload.MessageID,
		"userId":    userID,
		"emoji":     payload.Emoji,
	}), "")
	return nil
}

// handleOnlineStatus returns online status for a set of user IDs.
func handleOnlineStatus(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		UserIDs []string `json:"userIds"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}
	if len(payload.UserIDs) == 0 {
		return errWSMissingField("userIds")
	}
	if len(payload.UserIDs) > 200 {
		return errWSInvalidField("userIds (max 200)")
	}

	statuses := make(map[string]bool, len(payload.UserIDs))
	for _, uid := range payload.UserIDs {
		statuses[uid] = ws.HubInstance.IsOnline(uid)
	}
	// Return the status map as the response data
	return &wsDataResponse{Data: map[string]interface{}{"statuses": statuses}}
}

// handleUserStatus sets or clears the user's custom status text.
func handleUserStatus(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		Text     string  `json:"text"`
		Emoji    string  `json:"emoji"`
		Duration float64 `json:"duration"` // seconds, 0 = no expiry
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}

	userID := client.UserID
	database := db.GetDB()

	if payload.Text == "" {
		// Clear status
		database.Model(&models.User{}).Where("id = ?", userID).
			Updates(map[string]interface{}{
				"mood_status":     "",
				"mood_expires_at": nil,
			})
		// Broadcast to friends
		ws.HubInstance.SendToChat("__friends:"+userID, mustWSMap("user:status_cleared", map[string]string{
			"userId": userID,
		}), "")
		return nil
	}
	if utf8.RuneCountInString(payload.Text) > 140 {
		return errWSInvalidField("text (max 140 characters)")
	}

	updates := map[string]interface{}{
		"mood_status": payload.Text,
	}
	if payload.Duration > 0 {
		updates["mood_expires_at"] = time.Now().Add(time.Duration(payload.Duration * float64(time.Second)))
	}
	database.Model(&models.User{}).Where("id = ?", userID).Updates(updates)

	// Notify online users about status change
	ws.HubInstance.SendToChat("__friends:"+userID, mustWSMap("user:status_changed", map[string]string{
		"userId": userID,
		"status": payload.Text,
		"emoji":  payload.Emoji,
	}), "")
	return nil
}

// handleChatMembers notifies about chat member changes (join/leave).
func handleChatMembers(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		ChatID string `json:"chatId"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	} else {
		payload.ChatID = env.ChatID
	}
	if payload.ChatID == "" {
		return errWSMissingField("chatId")
	}

	// Verify membership before exposing the member list.
	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", payload.ChatID, client.UserID).
		Count(&count)
	if count == 0 {
		return errWSNotMember
	}

	// Return current members
	var members []models.ChatMember
	db.GetDB().Preload("User").Where("chat_id = ?", payload.ChatID).Find(&members)

	type memberInfo struct {
		UserID            string `json:"userId"`
		Username          string `json:"username"`
		DisplayName       string `json:"displayName"`
		Avatar            string `json:"avatar"`
		Role              string `json:"role"`
		IsVerified        bool   `json:"isVerified"`
		VerifiedBadgeUrl  string `json:"verifiedBadgeUrl"`
		VerifiedBadgeType string `json:"verifiedBadgeType"`
	}
	var result []memberInfo
	for _, m := range members {
		result = append(result, memberInfo{
			UserID:            m.UserID,
			Username:          m.User.Username,
			DisplayName:       m.User.DisplayName,
			Avatar:            m.User.Avatar,
			Role:              m.Role,
			IsVerified:        m.User.IsVerified,
			VerifiedBadgeUrl:  m.User.VerifiedBadgeUrl,
			VerifiedBadgeType: m.User.VerifiedBadgeType,
		})
	}
	return &wsDataResponse{Data: map[string]interface{}{"members": result}}
}

// MediaPayload is the JSON shape of media items sent with a WS message.
type MediaPayload struct {
	ID        string  `json:"id"`
	Type      string  `json:"type"`
	URL       string  `json:"url"`
	Filename  string  `json:"filename"`
	Thumbnail string  `json:"thumbnail"`
	Size      int     `json:"size"`
	Duration  float64 `json:"duration"`
	Width     int     `json:"width"`
	Height    int     `json:"height"`
}

// handleSendMessage sends a message via WS (alternative to HTTP POST).
func handleSendMessage(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		ChatID           string         `json:"chatId"`
		Content          string         `json:"content"`
		Type             string         `json:"type"`
		ReplyTo          string         `json:"replyToId"`
		Media            []MediaPayload `json:"media"`
		GifURL           string         `json:"gifUrl"`
		IsEncrypted      bool           `json:"isEncrypted"`
		EncryptedContent string         `json:"encryptedContent"`
		EncryptedIV      string         `json:"encryptedIv"`
		SelfDestructTimer int           `json:"selfDestructTimer"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}
	if payload.ChatID == "" {
		return errWSMissingField("chatId")
	}
	if payload.Content == "" && payload.Type == "" && payload.GifURL == "" {
		return errWSMissingField("content")
	}
	if len(payload.Media) > 10 {
		return errWSInvalidField("media (max 10 items)")
	}

	// Validate content length (HTTP path enforces this; WS must too)
	payload.Content = strings.TrimSpace(payload.Content)
	if payload.Type == "" {
		payload.Type = "text"
	}
	if payload.Type == "text" && payload.Content == "" && payload.GifURL == "" {
		return errWSMissingField("content")
	}
	if utf8.RuneCountInString(payload.Content) > maxMessageContentLength {
		return &wsError{Code: "too_long", Message: "Message too long (max 10000 characters)"}
	}

	userID := client.UserID

	// Verify membership
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).First(&member); result.Error != nil {
		return errWSNotMember
	}

	// Instant GIF import: download the GIF server-side before creating the
	// message, so recipients get a self-hosted copy and never see hotlinks.
	if payload.GifURL != "" {
		gifMedia, err := ImportGifFromURL(payload.GifURL)
		if err != nil {
			return &wsError{Code: "gif_import_failed", Message: "Could not import GIF from URL"}
		}
		payload.Media = append([]MediaPayload{gifMedia}, payload.Media...)
		if payload.Type == "text" || payload.Type == "" {
			payload.Type = "photo"
		}
	}

	// Slow mode check � via chat's SlowModeInterval (seconds)
	if payload.Type == "" || payload.Type == "text" {
		var chat models.Chat
		if result := db.GetDB().First(&chat, "id = ?", payload.ChatID); result.Error == nil && chat.SlowModeInterval > 0 {
			// Check last message time from this user in this chat
			var lastMsg models.Message
			if result := db.GetDB().Where("chat_id = ? AND sender_id = ?", payload.ChatID, userID).
				Order("created_at DESC").First(&lastMsg); result.Error == nil {
				elapsed := time.Since(lastMsg.CreatedAt).Seconds()
				if elapsed < float64(chat.SlowModeInterval) {
					remaining := float64(chat.SlowModeInterval) - elapsed
					return &wsError{Code: "slow_mode", Message: "Slow mode: wait " + strconv.FormatFloat(remaining, 'f', 0, 64) + "s"}
				}
			}
		}
	}

	msg := models.Message{
		ID:               generateID(),
		ChatID:           payload.ChatID,
		SenderID:         userID,
		Content:          payload.Content,
		Type:             payload.Type,
		ReplyToID:        payload.ReplyTo,
		IsEncrypted:      payload.IsEncrypted,
		EncryptedContent: payload.EncryptedContent,
		EncryptedIV:      payload.EncryptedIV,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}
	timer := validSelfDestructSeconds(payload.SelfDestructTimer)
	if timer < 0 {
		return &wsError{Code: "invalid_field", Message: "Invalid self-destruct timer"}
	}
	msg.SelfDestructTimer = timer
	if timer > 0 {
		expiresAt := time.Now().Add(time.Duration(timer) * time.Second)
		msg.SelfDestructAt = &expiresAt
	}
	if msg.Type == "" {
		msg.Type = "text"
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		return errWSServerError
	}

	// Attach media to message
	if len(payload.Media) > 0 {
		for i, m := range payload.Media {
			mediaRecord := models.Media{
				ID:        m.ID,
				MessageID: msg.ID,
				Type:      m.Type,
				URL:       m.URL,
				Filename:  m.Filename,
				Thumbnail: m.Thumbnail,
				Size:      m.Size,
				Duration:  m.Duration,
				Width:     m.Width,
				Height:    m.Height,
				Order:     i,
			}
			if mediaRecord.ID == "" {
				mediaRecord.ID = generateID()
			}
			if err := db.GetDB().Create(&mediaRecord).Error; err != nil {
				log.Printf("[WS] failed to save media record: %v", err)
			}
		}
	}

	// Update chat's last message time
	now := time.Now()
	db.GetDB().Model(&models.Chat{}).Where("id = ?", payload.ChatID).Update("updated_at", now)
	db.GetDB().Model(&models.ChatMember{}).Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).Update("last_message_at", now)

	// Load relations
	db.GetDB().Preload("Sender").Preload("Media").Preload("Reactions").First(&msg, "id = ?", msg.ID)

	msgJSON := messageToJSON(msg)
	ws.HubInstance.SendToChat(payload.ChatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")

	notifyBotsOfMessage(payload.ChatID, msg, msg.Sender)

	// Web Push to offline members
	senderName := msg.Sender.DisplayName
	if senderName == "" {
		senderName = msg.Sender.Username
	}
	NotifyNewMessagePush(payload.ChatID, userID, senderName, payload.Type, payload.Content)

	return &wsDataResponse{Data: map[string]interface{}{"messageId": msg.ID, "createdAt": msg.CreatedAt.Format("2006-01-02T15:04:05Z07:00")}}
}

// --- WS RPC: fetch_messages -----------------------------------------------
func handleFetchMessages(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		ChatID string `json:"chatId"`
		Cursor string `json:"cursor"`
		Limit  int    `json:"limit"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}
	if payload.ChatID == "" {
		return errWSMissingField("chatId")
	}
	if payload.Limit <= 0 || payload.Limit > 100 {
		payload.Limit = 50
	}

	userID := client.UserID

	// Verify membership
	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).
		Count(&count)
	if count == 0 {
		return errWSNotMember
	}

	var messages []models.Message
	query := db.GetDB().
		Preload("Sender").
		Preload("Media").
		Preload("Reactions").
		Preload("Reactions.User").
		Where("chat_id = ?", payload.ChatID)

	if payload.Cursor != "" {
		// Composite cursor (created_at, id): timestamps have millisecond
		// precision, so filtering on created_at alone skips messages that
		// share the cursor's timestamp. The id tie-breaker matches the
		// secondary ORDER BY so no message is lost at page boundaries.
		query = query.Where(
			"(created_at < (SELECT created_at FROM messages WHERE id = ?)) OR "+
				"(created_at = (SELECT created_at FROM messages WHERE id = ?) AND id < ?)",
			payload.Cursor, payload.Cursor, payload.Cursor,
		)
		query = query.Order("created_at DESC, id DESC")
	} else {
		query = query.Order("created_at DESC")
	}

	query.Limit(payload.Limit + 1).Find(&messages)

	hasMore := len(messages) > payload.Limit
	if hasMore {
		messages = messages[:payload.Limit]
	}
	sanitizeMessages(messages)

	return &wsDataResponse{Data: map[string]interface{}{
		"messages": messages,
		"hasMore":  hasMore,
	}}
}

// --- WS RPC: fetch_friends ------------------------------------------------
func handleFetchFriends(client *ws.Client, env *wsEnvelope) error {
	userID := client.UserID

	var friendships []models.Friendship
	db.GetDB().
		Preload("User").
		Preload("Friend").
		Where("(user_id = ? OR friend_id = ?) AND status = 'accepted'", userID, userID).
		Limit(500).
		Find(&friendships)

	friends := make([]models.User, 0)
	for _, f := range friendships {
		if f.UserID == userID {
			friends = append(friends, sanitizeUser(f.Friend, ""))
		} else {
			friends = append(friends, sanitizeUser(f.User, ""))
		}
	}

	return &wsDataResponse{Data: map[string]interface{}{"friends": friends}}
}

// --- WS RPC: fetch_friend_requests -----------------------------------------
func handleFetchFriendRequests(client *ws.Client, _ *wsEnvelope) error {
	userID := client.UserID

	var friendships []models.Friendship
	db.GetDB().
		Preload("User").
		Where("friend_id = ? AND status = 'pending'", userID).
		Order("created_at DESC").
		Find(&friendships)

	for i := range friendships {
		friendships[i].User = sanitizeUser(friendships[i].User, "")
	}

	return &wsDataResponse{Data: map[string]interface{}{"requests": friendships}}
}

// --- WS RPC: fetch_init -----------------------------------------------------
func handleFetchInit(client *ws.Client, _ *wsEnvelope) error {
	userID := client.UserID

	// 1. User profile
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return errWSNotFound("user")
	}

	// 2. Chats
	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	chats := make([]models.Chat, 0)
	if len(memberChatIDs) > 0 {
		db.GetDB().
			Preload("Members").
			Preload("Members.User").
			Preload("Messages", func(db *gorm.DB) *gorm.DB {
				return db.Order("created_at DESC").Limit(1)
			}).
			Where("id IN ?", memberChatIDs).
			Order("updated_at DESC").
			Limit(50).
			Find(&chats)
		for i := range chats {
			sanitizeChatMembers(chats[i].Members)
		}
	}

	// 3. Settings
	settings := UserSettingsJSON{
		NotifyAll:        user.NotifyAll,
		NotifyMessages:   user.NotifyMessages,
		NotifyCalls:      user.NotifyCalls,
		NotifyFriends:    user.NotifyFriends,
		TwoFactorEnabled: user.TwoFactorEnabled,
	}

	// 4. Smart folders
	smartFolders := make([]models.SmartFolder, 0)
	db.GetDB().Where("user_id = ?", userID).Order(`"order" ASC`).Find(&smartFolders)

	// 5. Stories (only active, non-expired, from friends)
	var stories []models.Story
	db.GetDB().
		Preload("User").
		Where("user_id IN ? AND expires_at > ?", getFriendIDs(userID), time.Now()).
		Order("created_at DESC").
		Limit(100).
		Find(&stories)

	storyGroups := buildStoryGroups(stories)

	return &wsDataResponse{Data: map[string]interface{}{
		"user":         user,
		"chats":        chats,
		"settings":     settings,
		"smartFolders": smartFolders,
		"stories":      storyGroups,
		"csrfToken":    middleware.GenerateCSRFToken(userID),
	}}
}

// --- WS RPC: fetch_notifications -------------------------------------------
func handleFetchNotifications(client *ws.Client, _ *wsEnvelope) error {
	userID := client.UserID

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return errWSNotFound("user")
	}

	return &wsDataResponse{Data: map[string]interface{}{
		"notifyAll":      user.NotifyAll,
		"notifyMessages": user.NotifyMessages,
		"notifyCalls":    user.NotifyCalls,
		"notifyFriends":  user.NotifyFriends,
	}}
}

// --- WS RPC: call signaling -------------------------------------------------
// WebRTC signaling relay: call:offer / call:answer / call:ice-candidate /
// call:end are forwarded to the target user (and a push notification is sent
// for incoming calls so offline devices can ring too).

func handleCallRelay(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		TargetUserID string          `json:"targetUserId"`
		ChatID       string          `json:"chatId"`
		CallType     string          `json:"callType"`
		Offer        json.RawMessage `json:"offer"`
		Answer       json.RawMessage `json:"answer"`
		Candidate    json.RawMessage `json:"candidate"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}
	if payload.TargetUserID == "" {
		return errWSMissingField("targetUserId")
	}
	if payload.TargetUserID == client.UserID {
		return errWSInvalidField("targetUserId")
	}

	from := clientUserInfo(client.UserID)
	out := map[string]interface{}{
		"type":       env.Type,
		"fromUserId": client.UserID,
		"from":       from,
		"chatId":     payload.ChatID,
		"callType":   payload.CallType,
	}
	switch env.Type {
	case "call:offer":
		out["offer"] = payload.Offer
	case "call:answer":
		out["answer"] = payload.Answer
	case "call:ice-candidate":
		out["candidate"] = payload.Candidate
	}

	outBytes, err := json.Marshal(out)
	if err != nil {
		return errWSServerError
	}
	ws.HubInstance.SendToUser(payload.TargetUserID, outBytes)

	// Push notification for incoming calls so offline devices ring too.
	if env.Type == "call:offer" {
		callType := payload.CallType
		if callType == "" {
			callType = "voice"
		}
		callerName, _ := from["displayName"].(string)
		if callerName == "" {
			callerName, _ = from["username"].(string)
		}
		if callerName == "" {
			callerName = "Пользователь"
		}
		title := fmt.Sprintf("Входящий %s звонок", map[string]string{"voice": "голосовой", "video": "видео"}[callType])
		NotifyUser(payload.TargetUserID, title, fmt.Sprintf("%s звонит вам...", callerName), map[string]interface{}{
			"type":       "call",
			"callerId":   client.UserID,
			"callerName": callerName,
			"chatId":     payload.ChatID,
			"callType":   callType,
		}, []int{300, 200, 300, 200, 300, 200, 300})
	}

	return nil
}

func clientUserInfo(userID string) map[string]interface{} {
	var u models.User
	if err := db.GetDB().First(&u, "id = ?", userID).Error; err != nil {
		return map[string]interface{}{"id": userID}
	}
	return map[string]interface{}{
		"id":          u.ID,
		"username":    u.Username,
		"displayName": u.DisplayName,
		"avatar":      u.Avatar,
	}
}

// --- WS RPC: push_subscribe -------------------------------------------------
func handlePushSubscribe(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		Subscription json.RawMessage `json:"subscription"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}
	if len(payload.Subscription) == 0 {
		return errWSMissingField("subscription")
	}

	var sub webpush.Subscription
	if err := json.Unmarshal(payload.Subscription, &sub); err != nil {
		return errWSInvalidField("subscription")
	}
	if sub.Endpoint == "" || sub.Keys.P256dh == "" || sub.Keys.Auth == "" {
		return errWSInvalidField("subscription")
	}

	userAgent := client.Conn.Headers("User-Agent")
	if err := SavePushSubscription(client.UserID, sub, userAgent); err != nil {
		log.Printf("[Push] save error user=%s: %v", client.UserID, err)
		return errWSServerError
	}
	log.Printf("[Push] Subscription saved user=%s endpoint=%s", client.UserID, sub.Endpoint)
	return nil
}

// handlePushUnsubscribe removes a device push subscription.
func handlePushUnsubscribe(client *ws.Client, env *wsEnvelope) error {
	var payload struct {
		Endpoint string `json:"endpoint"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}
	if payload.Endpoint == "" {
		return errWSMissingField("endpoint")
	}
	if err := DeletePushSubscription(client.UserID, payload.Endpoint); err != nil {
		log.Printf("[Push] unsubscribe error user=%s: %v", client.UserID, err)
		return errWSServerError
	}
	log.Printf("[Push] Subscription removed user=%s", client.UserID)
	return nil
}

// Custom error types for WS RPC
type wsError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

func (e *wsError) Error() string { return e.Message }

var (
	errWSNotMember   = &wsError{Code: "not_member", Message: "Not a member of this chat"}
	errWSServerError = &wsError{Code: "server_error", Message: "Internal server error"}
	errWSRateLimited = &wsError{Code: "rate_limited", Message: "Rate limited"}
)

func errWSMissingField(fields string) *wsError {
	return &wsError{Code: "missing_field", Message: "Missing required field: " + fields}
}

func errWSNotFound(resource string) *wsError {
	return &wsError{Code: "not_found", Message: resource + " not found"}
}

func errWSInvalidField(field string) *wsError {
	return &wsError{Code: "invalid_field", Message: "Invalid " + field}
}

// wsDataResponse wraps extra response data (implements error for RPC return).
type wsDataResponse struct {
	Data map[string]interface{}
}

func (e *wsDataResponse) Error() string { return "" }

// wsHandle routes an inbound WS message to the correct handler and sends an RPC response if needed.
func wsHandle(client *ws.Client, env *wsEnvelope, fn func(*ws.Client, *wsEnvelope) error) {
	err := fn(client, env)
	if env.ID == "" {
		return
	}
	if err != nil {
		wsResponse(client, env.ID, err)
	} else {
		wsResponse(client, env.ID, nil)
	}
}

// handleWSMessage routes an inbound WS message to the correct handler.
func handleWSMessage(client *ws.Client, msg []byte) {
	var env wsEnvelope
	if err := json.Unmarshal(msg, &env); err != nil {
		log.Printf("WS parse error: user=%s err=%v", client.UserID, err)
		return
	}

	// Route by type
	// Per-type limits: mutations are the abuse hot path. Tighten the global
	// 30/s cap with event-specific budgets before dispatch.
	if max, ok := map[string]int{"send_message": 10, "reaction": 20, "typing": 20}[env.Type]; ok {
		if !wsCheckTypeRateLimit(client.UserID+"|"+env.Type, max, time.Second) {
			wsResponse(client, env.ID, &wsError{Code: "rate_limited", Message: "Too many requests"})
			return
		}
	}

	switch env.Type {
	case "typing":
		wsHandle(client, &env, handleTyping)
	case "read_receipt", "read-receipt":
		wsHandle(client, &env, handleReadReceipt)
	case "reaction":
		wsHandle(client, &env, handleReaction)
	case "online_status", "online-status":
		wsHandle(client, &env, handleOnlineStatus)
	case "user_status", "user-status":
		wsHandle(client, &env, handleUserStatus)
	case "chat_members", "chat-members":
		wsHandle(client, &env, handleChatMembers)
	case "send_message", "send-message":
		wsHandle(client, &env, handleSendMessage)
	case "fetch_messages", "fetch-messages":
		wsHandle(client, &env, handleFetchMessages)
	case "fetch_friends", "fetch-friends":
		wsHandle(client, &env, handleFetchFriends)
	case "fetch_friend_requests", "fetch-friend-requests":
		wsHandle(client, &env, handleFetchFriendRequests)
	case "fetch_notifications", "fetch-notifications":
		wsHandle(client, &env, handleFetchNotifications)
	case "fetch_init", "fetch-init":
		wsHandle(client, &env, handleFetchInit)
	case "push_subscribe", "push-subscribe":
		wsHandle(client, &env, handlePushSubscribe)
	case "push_unsubscribe", "push-unsubscribe":
		wsHandle(client, &env, handlePushUnsubscribe)
	case "call:offer", "call:answer", "call:ice-candidate", "call:end", "call:ended":
		wsHandle(client, &env, handleCallRelay)
	default:
		if env.ID != "" {
			wsResponse(client, env.ID, &wsError{Code: "unknown_type", Message: "Unknown message type: " + env.Type})
		} else {
			log.Printf("WS unknown type: user=%s type=%s", client.UserID, env.Type)
		}
	}
}

func isOriginAllowed(origin string) bool {
	if origin == "" {
		return true
	}
	// Parse properly so ports are stripped and scheme tricks (e.g. a path or
	// userinfo smuggling an allowed domain) cannot bypass the check.
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := u.Hostname()
	if host == "" {
		return false
	}
	allowedDomains := []string{"darkheavens.ru", "hakerone.ru", "localhost"}
	for _, domain := range allowedDomains {
		if host == domain || strings.HasSuffix(host, "."+domain) {
			return true
		}
	}
	return false
}

func HandleWebSocket(c *websocket.Conn) {
	origin := c.Headers("Origin")
	if !isOriginAllowed(origin) {
		c.Close()
		return
	}

	token := c.Query("token")
	if token == "" {
		protocols := strings.Split(c.Headers("Sec-WebSocket-Protocol"), ",")
		for _, p := range protocols {
			p = strings.TrimSpace(p)
			if p != "" {
				token = p
				break
			}
		}
	}
	if token == "" {
		c.Close()
		return
	}

	claims := &middleware.Claims{}
	t, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected JWT signing method: %v", token.Header["alg"])
		}
		return middleware.JWTSecret, nil
	})
	if err != nil || !t.Valid {
		c.Close()
		return
	}

	userID := claims.UserID

	// Dedup: count connections per user; allow max 3 concurrent
	activeWSConnectionsMu.Lock()
	activeWSConnections[userID]++
	connCount := activeWSConnections[userID]
	activeWSConnectionsMu.Unlock()

	defer func() {
		activeWSConnectionsMu.Lock()
		activeWSConnections[userID]--
		if activeWSConnections[userID] <= 0 {
			delete(activeWSConnections, userID)
		}
		activeWSConnectionsMu.Unlock()
	}()

	if connCount > 3 {
		log.Printf("WS rejected: user=%s already has %d connections", userID, connCount-1)
		c.Close()
		return
	}

	// Join all chats this user is a member of
	var chatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &chatIDs)
	for _, chatID := range chatIDs {
		ws.HubInstance.JoinChat(chatID, userID)
	}

	client := &ws.Client{
		Conn:   c,
		UserID: userID,
		Send:   make(chan []byte, 256),
	}

	ws.HubInstance.RegisterClient(client)

	defer func() {
		ws.HubInstance.UnregisterClient(client)
		// Only leave chats when this was the user's last active connection,
		// otherwise other open tabs would stop receiving live messages.
		// NB: this defer runs before the counter-decrement defer (LIFO), so
		// the count still includes this connection.
		activeWSConnectionsMu.Lock()
		isLastConnection := activeWSConnections[userID] <= 1
		activeWSConnectionsMu.Unlock()
		if isLastConnection {
			for _, chatID := range chatIDs {
				ws.HubInstance.LeaveChat(chatID, userID)
			}
		}
		c.Close()
	}()

	log.Printf("WS client connected: user=%s", userID)

	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("panic in WS writer goroutine (user=%s): %v", userID, r)
			}
		}()
		for message := range client.Send {
			if err := c.WriteMessage(websocket.TextMessage, message); err != nil {
				// Closing the connection unblocks the read loop below,
				// triggering the deferred cleanup in the handler.
				c.Close()
				return
			}
		}
	}()

	for {
		_, msg, err := c.ReadMessage()
		if err != nil {
			log.Printf("WS read error: user=%s err=%v", userID, err)
			break
		}

		// Rate limit: reject if user exceeds max messages per second
		if !wsCheckRateLimit(userID) {
			log.Printf("WS rate limited: user=%s", userID)
			var rateEnv wsEnvelope
			if err := json.Unmarshal(msg, &rateEnv); err == nil {
				wsResponse(client, rateEnv.ID, errWSRateLimited)
			}
			continue
		}

		// Route through the unified RPC handler
		handleWSMessage(client, msg)
	}
}
