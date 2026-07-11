package handlers

import (
	"encoding/json"
	"log"

	"github.com/gofiber/websocket/v2"
	"github.com/golang-jwt/jwt/v5"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
	"nexo/ws"
)

// activeWSConnections tracks active WebSocket connections per user to prevent duplicate sessions.
var activeWSConnections = make(map[string]int)

func HandleWebSocket(c *websocket.Conn) {
	token := c.Query("token")
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
	activeWSConnections[userID]++
	connCount := activeWSConnections[userID]
	defer func() {
		activeWSConnections[userID]--
		if activeWSConnections[userID] <= 0 {
			delete(activeWSConnections, userID)
		}
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

		// Parse incoming message to route it to the correct chat
		var envelope struct {
			Type   string `json:"type"`
			ChatID string `json:"chatId"`
		}
		if err := json.Unmarshal(msg, &envelope); err == nil && envelope.ChatID != "" {
			// Route to specific chat members
			ws.HubInstance.SendToChat(envelope.ChatID, msg, "")
		} else {
			// Fallback: broadcast to all (for backwards compatibility)
			ws.HubInstance.Broadcast(msg)
		}
	}
}
