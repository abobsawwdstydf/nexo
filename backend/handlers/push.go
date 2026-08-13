package handlers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"os"
	"strings"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"
)

// --- VAPID setup -----------------------------------------------------------
// VAPID_PRIVATE_KEY / VAPID_PUBLIC_KEY come from the environment (.env).
// The public key must match the one hardcoded in the frontend (notifications.ts).

var vapidPublicKey string
var vapidPrivateKey string
var vapidEmail string
var vapidKeysFile = "vapid_keys.json"

// InitPush loads VAPID keys from the environment (or generates a persistent
// pair locally so push works even without .env VAPID_*). Call once at startup.
func InitPush() {
	initVAPID()
	if vapidPublicKey == "" || vapidPrivateKey == "" {
		logging.Log.Warn("[Push] VAPID keys not configured — push notifications disabled")
	} else {
		logging.Log.Info("[Push] Web Push initialized (VAPID keys loaded)")
	}
}

func initVAPID() {
	vapidPublicKey = os.Getenv("VAPID_PUBLIC_KEY")
	vapidPrivateKey = os.Getenv("VAPID_PRIVATE_KEY")
	vapidEmail = os.Getenv("VAPID_EMAIL")
	if vapidEmail == "" {
		vapidEmail = "admin@darkheavens.ru"
	}

	if vapidPublicKey == "" || vapidPrivateKey == "" {
		// Load previously generated pair (stable across restarts)
		if data, err := os.ReadFile(vapidKeysFile); err == nil {
			var stored struct {
				Public  string `json:"public"`
				Private string `json:"private"`
			}
			if json.Unmarshal(data, &stored) == nil && stored.Public != "" && stored.Private != "" {
				vapidPublicKey, vapidPrivateKey = stored.Public, stored.Private
				logging.Log.Info("[Push] VAPID keys loaded", "file", vapidKeysFile)
				return
			}
		}
		// Generate a fresh pair and persist it
		privateKey, publicKey, err := webpush.GenerateVAPIDKeys()
		if err == nil {
			vapidPublicKey, vapidPrivateKey = publicKey, privateKey
			out, _ := json.Marshal(map[string]string{"public": vapidPublicKey, "private": vapidPrivateKey})
			os.WriteFile(vapidKeysFile, out, 0o600)
			logging.Log.Info("[Push] Generated new VAPID keys", "file", vapidKeysFile)
		}
	}
}

// GetVapidPublicKey returns the VAPID public key so the frontend can always
// subscribe with the exact key the server uses.
func GetVapidPublicKey(c *fiber.Ctx) error {
	if vapidPublicKey == "" {
		return c.Status(404).JSON(fiber.Map{"error": "VAPID not configured"})
	}
	return c.JSON(fiber.Map{"publicKey": vapidPublicKey})
}

// --- Subscription storage --------------------------------------------------

// SavePushSubscription upserts a device subscription for a user.
func SavePushSubscription(userID string, sub webpush.Subscription, userAgent string) error {
	// Delete duplicates with the same endpoint (device re-subscribed)
	db.GetDB().Where("user_id = ? AND endpoint = ?", userID, sub.Endpoint).Delete(&models.PushSubscription{})

	rec := models.PushSubscription{
		ID:        generatePushID(),
		UserID:    userID,
		Endpoint:  truncateRuneSafe(sub.Endpoint, 500),
		P256DH:    truncateRuneSafe(sub.Keys.P256dh, 250),
		Auth:      truncateRuneSafe(sub.Keys.Auth, 250),
		UserAgent: truncateRuneSafe(userAgent, 250),
	}
	return db.GetDB().Create(&rec).Error
}

// DeletePushSubscription removes a subscription by endpoint.
func DeletePushSubscription(userID string, endpoint string) error {
	return db.GetDB().Where("user_id = ? AND endpoint = ?", userID, endpoint).Delete(&models.PushSubscription{}).Error
}

func getSubscriptionsForUser(userID string) []models.PushSubscription {
	var subs []models.PushSubscription
	db.GetDB().Where("user_id = ?", userID).Find(&subs)
	return subs
}

// SavePushSubscriptionHandler is the REST fallback for the WS push_subscribe RPC,
// used when the WebSocket is not connected yet.
func SavePushSubscriptionHandler(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Subscription *webpush.Subscription `json:"subscription"`
	}
	if err := c.BodyParser(&req); err != nil || req.Subscription == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subscription"})
	}
	if req.Subscription.Endpoint == "" || req.Subscription.Keys.P256dh == "" || req.Subscription.Keys.Auth == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid subscription"})
	}

	if err := SavePushSubscription(userID, *req.Subscription, c.Get("User-Agent")); err != nil {
		logging.Log.Error("[Push] REST save error", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save subscription"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// DeletePushSubscriptionHandler is the REST fallback for the WS push_unsubscribe RPC.
func DeletePushSubscriptionHandler(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Endpoint string `json:"endpoint"`
	}
	if err := c.BodyParser(&req); err != nil || req.Endpoint == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Endpoint required"})
	}

	if err := DeletePushSubscription(userID, req.Endpoint); err != nil {
		logging.Log.Error("[Push] REST unsubscribe error", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to remove subscription"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// --- Sending ---------------------------------------------------------------

// NotifyUser sends a Web Push notification to all of the user's devices.
// Respects per-user notification settings, skips users with an active WS
// connection (they get realtime events) and cleans up dead endpoints.
// Returns the number of devices successfully notified.
func NotifyUser(userID string, title string, body string, data map[string]interface{}, vibrate []int) int {
	// Respect per-user notification settings
	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return 0
	}

	// Do Not Disturb: suppress notifications entirely while active.
	if user.DNDUntil != nil && user.DNDUntil.After(time.Now()) {
		return 0
	}

	// Chat snooze: suppress notifications for the snoozed chat.
	if chatID, ok := data["chatId"].(string); ok && chatID != "" {
		if snoozed, _ := IsChatSnoozed(userID, chatID); snoozed {
			return 0
		}
	}

	notifType, _ := data["type"].(string)
	switch notifType {
	case "call", "incoming_call", "call_offer":
		if !user.NotifyCalls {
			return 0
		}
	case "friend_request", "friend:request":
		if !user.NotifyFriends {
			return 0
		}
	default:
		if !user.NotifyMessages {
			return 0
		}
	}

	// Skip users with an active WS connection — they're online and get realtime events.
	if ws.HubInstance.IsOnline(userID) {
		return 0
	}

	subs := getSubscriptionsForUser(userID)
	if len(subs) == 0 {
		return 0
	}

	payload := map[string]interface{}{
		"notification": map[string]interface{}{
			"title": title,
			"body":  body,
			"icon":  "/logo.png",
			"badge": "/logo.png",
			"tag":   data["chatId"],
		},
		"data": data,
	}
	if len(vibrate) > 0 {
		payload["notification"].(map[string]interface{})["vibrate"] = vibrate
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		logging.Log.Error("[Push] marshal error", "err", err)
		return 0
	}

	notified := 0
	for _, sub := range subs {
		s := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256DH,
				Auth:   sub.Auth,
			},
		}
		resp, err := webpush.SendNotification(payloadBytes, s, &webpush.Options{
			Subscriber:      vapidEmail,
			VAPIDPublicKey:  vapidPublicKey,
			VAPIDPrivateKey: vapidPrivateKey,
			TTL:             120,
		})
		if err != nil {
			logging.Log.Error("[Push] send error", "user_id", userID, "err", err)
			// 404/410 = endpoint expired — clean up
			if resp != nil && (resp.StatusCode == 404 || resp.StatusCode == 410) {
				if err := db.GetDB().Delete(&models.PushSubscription{}, "id = ?", sub.ID).Error; err != nil {
					logging.Log.Error("[Push] failed to remove expired subscription", "subscription_id", sub.ID, "err", err)
				}
			}
			continue
		}
		resp.Body.Close()
		db.GetDB().Model(&models.PushSubscription{}).Where("id = ?", sub.ID).
			Update("last_used_at", time.Now())
		notified++
	}

	if notified > 0 {
		logging.Log.Info("[Push] notified", "user_id", userID, "devices", notified)
	}
	return notified
}

// --- Message notifications ---------------------------------------------------

// NotifyNewMessagePush sends a Web Push about a new message to offline chat
// members (except the sender). Shared by the REST and WebSocket send paths.
func NotifyNewMessagePush(chatID, senderID, senderName, msgType, content string) {
	chatType := "personal"
	var chat models.Chat
	if err := db.GetDB().First(&chat, "id = ?", chatID).Error; err == nil && chat.Type != "" {
		chatType = chat.Type
	}

	preview := content
	if preview == "" {
		switch msgType {
		case "image":
			preview = "📷 Фото"
		case "video":
			preview = "🎬 Видео"
		case "audio":
			preview = "🎤 Голосовое сообщение"
		case "file":
			preview = "📎 Файл"
		default:
			preview = "Новое сообщение"
		}
	}

	NotifyChatMembersPush(chatID, senderID, senderName, "", preview, chatType)
}

// NotifyChatMembersPush sends a push notification about a new message to all
// chat members except the sender (and bots).
func NotifyChatMembersPush(chatID string, senderID string, senderName string, chatName string, preview string, chatType string) {
	var members []models.ChatMember
	db.GetDB().Where("chat_id = ?", chatID).Find(&members)

	// Fetch chat name if not provided
	if chatName == "" {
		var chat models.Chat
		if err := db.GetDB().First(&chat, "id = ?", chatID).Error; err == nil {
			chatName = chat.Name
			if chatName == "" && chat.Type == "personal" {
				chatName = "Личный чат"
			}
		}
	}
	if chatName == "" {
		chatName = "Чат"
	}

	// Trim preview for push body
	if len([]rune(preview)) > 80 {
		preview = string([]rune(preview)[:80]) + "…"
	}

	title := senderName
	if chatType == "group" || chatType == "channel" {
		title = senderName + " · " + chatName
	}

	seen := map[string]bool{}
	for _, m := range members {
		if m.UserID == senderID || seen[m.UserID] {
			continue
		}
		seen[m.UserID] = true
		NotifyUser(m.UserID, title, preview, map[string]interface{}{
			"type":   "message",
			"chatId": chatID,
		}, []int{200, 100, 200})
	}
}

// --- Small helpers (keep them local to avoid import cycles) ----------------

func truncateRuneSafe(s string, max int) string {
	if len([]rune(s)) <= max {
		return s
	}
	return string([]rune(s)[:max])
}

func generatePushID() string {
	raw := make([]byte, 16)
	if _, err := rand.Read(raw); err != nil {
		return "push-" + time.Now().Format("20060102150405.000000000")
	}
	id := base64.RawURLEncoding.EncodeToString(raw)
	if strings.HasPrefix(id, "-") {
		id = "0" + id[1:]
	}
	return "push_" + id
}

