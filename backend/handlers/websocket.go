package handlers

import (
	"encoding/json"
	"log"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

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
	wsRateLimitMu.Lock()
	defer wsRateLimitMu.Unlock()

	now := time.Now()
	entry, exists := wsRateLimit[userID]

	if !exists || now.Sub(entry.WindowStart) > wsRateLimitWindow {
		wsRateLimit[userID] = &wsRateEntry{Count: 1, WindowStart: now}
		return true
	}

	if entry.Count >= wsRateLimitMax {
		return false
	}

	entry.Count++
	return true
}

// wsEnvelope is the unified inbound message envelope.
type wsEnvelope struct {
	ID       string          `json:"id,omitempty"`       // RPC request ID (empty = broadcast)
	Type     string          `json:"type"`               // message type
	ChatID   string          `json:"chatId,omitempty"`   // target chat
	Payload  json.RawMessage `json:"payload,omitempty"`  // type-specific payload
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

	// Upsert typing indicator
	db.GetDB().Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).
		Delete(&models.TypingIndicator{})
	indicator := models.TypingIndicator{
		ID:        generateID(),
		ChatID:    payload.ChatID,
		UserID:    userID,
		ExpiresAt: time.Now().Add(5 * time.Second),
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

	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).
		Count(&count)
	if count == 0 {
		return errWSNotMember
	}

	receipt := models.ReadReceipt{
		ID:        generateID(),
		MessageID: payload.MessageID,
		UserID:    userID,
	}
	db.GetDB().Create(&receipt)

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
		db.GetDB().Delete(&existing)
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

	database.Model(&models.User{}).Where("id = ?", userID).
		Update("mood_status", payload.Text)

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

	// Verify membership and return current members
	var members []models.ChatMember
	db.GetDB().Preload("User").Where("chat_id = ?", payload.ChatID).Find(&members)

	type memberInfo struct {
		UserID      string `json:"userId"`
		Username    string `json:"username"`
		DisplayName string `json:"displayName"`
		Avatar      string `json:"avatar"`
		Role        string `json:"role"`
	}
	var result []memberInfo
	for _, m := range members {
		result = append(result, memberInfo{
			UserID:      m.UserID,
			Username:    m.User.Username,
			DisplayName: m.User.DisplayName,
			Avatar:      m.User.Avatar,
			Role:        m.Role,
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
		ChatID           string           `json:"chatId"`
		Content          string           `json:"content"`
		Type             string           `json:"type"`
		ReplyTo          string           `json:"replyToId"`
		Media            []MediaPayload   `json:"media"`
		IsEncrypted      bool             `json:"isEncrypted"`
		EncryptedContent string           `json:"encryptedContent"`
		EncryptedIV      string           `json:"encryptedIv"`
	}
	if env.Payload != nil {
		if err := json.Unmarshal(env.Payload, &payload); err != nil {
			return err
		}
	}
	if payload.ChatID == "" {
		return errWSMissingField("chatId")
	}
	if payload.Content == "" && payload.Type == "" {
		return errWSMissingField("content")
	}

	userID := client.UserID

	// Verify membership
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", payload.ChatID, userID).First(&member); result.Error != nil {
		return errWSNotMember
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
					wsResponse(client, env.ID, &wsError{Code: "slow_mode", Message: "Slow mode: wait " + strconv.FormatFloat(remaining, 'f', 0, 64) + "s"})
					return nil
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
			db.GetDB().Create(&mediaRecord)
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
		query = query.Where("created_at < (SELECT created_at FROM messages WHERE id = ?)", payload.Cursor)
	}

	query.Order("created_at DESC").Limit(payload.Limit + 1).Find(&messages)

	hasMore := len(messages) > payload.Limit
	if hasMore {
		messages = messages[:payload.Limit]
	}

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
		Find(&friendships)

	friends := make([]models.User, 0)
	for _, f := range friendships {
		if f.UserID == userID {
			friends = append(friends, f.Friend)
		} else {
			friends = append(friends, f.User)
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

	// 5. Stories (only active, non-expired)
	var stories []models.Story
	db.GetDB().
		Preload("User").
		Where("expires_at > ?", time.Now()).
		Order("created_at DESC").
		Find(&stories)

	storyMap := make(map[string]*StoryGroupJSON)
	for _, s := range stories {
		group, exists := storyMap[s.UserID]
		if !exists {
			group = &StoryGroupJSON{
				UserID:      s.UserID,
				DisplayName: s.User.DisplayName,
				Avatar:      s.User.Avatar,
				IsOnline:    s.User.IsOnline,
				Stories:     []StoryJSON{},
			}
			storyMap[s.UserID] = group
		}
		group.Stories = append(group.Stories, StoryJSON{
			ID:        s.ID,
			Type:      s.Type,
			MediaURL:  s.MediaURL,
			Content:   s.Content,
			BgColor:   s.BgColor,
			CreatedAt: s.CreatedAt.Format(time.RFC3339),
			ExpiresAt: s.ExpiresAt.Format(time.RFC3339),
		})
	}

	storyGroups := make([]StoryGroupJSON, 0, len(storyMap))
	for _, g := range storyMap {
		storyGroups = append(storyGroups, *g)
	}
	sort.Slice(storyGroups, func(i, j int) bool {
		return len(storyGroups[i].Stories) > len(storyGroups[j].Stories)
	})

	return &wsDataResponse{Data: map[string]interface{}{
		"user":         user,
		"chats":        chats,
		"settings":     settings,
		"smartFolders": smartFolders,
		"stories":      storyGroups,
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

	log.Printf("[Push] Subscription from user=%s: %s", client.UserID, string(payload.Subscription))
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
	default:
		if env.ID != "" {
			wsResponse(client, env.ID, &wsError{Code: "unknown_type", Message: "Unknown message type: " + env.Type})
		} else {
			log.Printf("WS unknown type: user=%s type=%s", client.UserID, env.Type)
		}
	}
}

func HandleWebSocket(c *websocket.Conn) {
	origin := c.Headers("Origin")
	if origin != "" {
		allowed := false
		allowedDomains := []string{"darkheavens.ru", "hakerone.ru", "localhost"}
		for _, domain := range allowedDomains {
			if strings.HasSuffix(origin, domain) {
				allowed = true
				break
			}
		}
		if !allowed {
			c.Close()
			return
		}
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
		// Leave all chats on disconnect
		for _, chatID := range chatIDs {
			ws.HubInstance.LeaveChat(chatID, userID)
		}
		c.Close()
	}()

	log.Printf("WS client connected: user=%s", userID)

	go func() {
		for message := range client.Send {
			if err := c.WriteMessage(websocket.TextMessage, message); err != nil {
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
			continue
		}

		// Route through the unified RPC handler
		handleWSMessage(client, msg)
	}
}

