package handlers

import (
	"encoding/json"
	"time"

	"nexo/db"
	"nexo/models"
	"nexo/ws"

	"github.com/gofiber/fiber/v2"
)

// ─── Feature 7: E2E Key Exchange ─────────────────────────────────────

type E2EUploadKeyBundleRequest struct {
	IdentityKey   string   `json:"identityKey"`
	SignedPreKey  string   `json:"signedPreKey"`
	SignedKeySig  string   `json:"signedKeySig"`
	OneTimePreKeys []string `json:"oneTimePreKeys"`
	DeviceID      string   `json:"deviceId"`
}

type E2EFetchKeyBundleResponse struct {
	IdentityKey   string   `json:"identityKey"`
	SignedPreKey  string   `json:"signedPreKey"`
	SignedKeySig  string   `json:"signedKeySig"`
	OneTimePreKeys []string `json:"oneTimePreKeys"`
	DeviceID      string   `json:"deviceId"`
	UserID        string   `json:"userId"`
}

type E2EInitSessionRequest struct {
	ChatID       string `json:"chatId"`
	EncryptedKey string `json:"encryptedKey"`
}

// UploadKeyBundle — пользователь загружает свой публичный ключевой набор
func UploadKeyBundle(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req E2EUploadKeyBundleRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "bad request"})
	}

	if req.IdentityKey == "" || req.SignedPreKey == "" || req.DeviceID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "identityKey, signedPreKey and deviceId required"})
	}

	keysJSON, err := json.Marshal(req.OneTimePreKeys)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid oneTimePreKeys"})
	}

	database := db.GetDB()
	var existing models.E2EKeyBundle
	result := database.Where("user_id = ? AND device_id = ?", userID, req.DeviceID).First(&existing)
	if result.Error == nil {
		// Обновляем существующий
		existing.IdentityKey = req.IdentityKey
		existing.SignedPreKey = req.SignedPreKey
		existing.SignedKeySig = req.SignedKeySig
		existing.OneTimePreKeys = string(keysJSON)
		existing.UploadedAt = time.Now()
		database.Save(&existing)
	} else {
		// Создаём новый
		bundle := models.E2EKeyBundle{
			ID:            generateID(),
			UserID:        userID,
			DeviceID:      req.DeviceID,
			IdentityKey:   req.IdentityKey,
			SignedPreKey:  req.SignedPreKey,
			SignedKeySig:  req.SignedKeySig,
			OneTimePreKeys: string(keysJSON),
			UploadedAt:    time.Now(),
		}
		database.Create(&bundle)
	}

	return c.JSON(fiber.Map{"ok": true})
}

// FetchKeyBundle — получить публичный ключевой набор другого пользователя
func FetchKeyBundle(c *fiber.Ctx) error {
	database := db.GetDB()
	targetUserID := c.Params("userId")

	var bundles []models.E2EKeyBundle
	if err := database.Where("user_id = ?", targetUserID).Find(&bundles).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "database error"})
	}

	if len(bundles) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "no key bundles found"})
	}

	var result []E2EFetchKeyBundleResponse
	for _, b := range bundles {
		var keys []string
		if err := json.Unmarshal([]byte(b.OneTimePreKeys), &keys); err != nil {
			keys = []string{} // malformed key data — return empty list
		}
		result = append(result, E2EFetchKeyBundleResponse{
			IdentityKey:   b.IdentityKey,
			SignedPreKey:  b.SignedPreKey,
			SignedKeySig:  b.SignedKeySig,
			OneTimePreKeys: keys,
			DeviceID:      b.DeviceID,
			UserID:        b.UserID,
		})
	}

	return c.JSON(fiber.Map{"bundles": result})
}

// ConsumeOneTimePreKey — забрать one-time преключатель (одноразовый)
func ConsumeOneTimePreKey(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	database := db.GetDB()
	targetUserID := c.Params("userId")

	// Verify requester and target share at least one chat
	var sharedChatCount int64
	database.Model(&models.ChatMember{}).
		Where("user_id = ? AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)", userID, targetUserID).
		Count(&sharedChatCount)
	if sharedChatCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "No shared chat with target user"})
	}

	var bundle models.E2EKeyBundle
	if err := database.Where("user_id = ?", targetUserID).First(&bundle).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "no bundles"})
	}

	var keys []string
	if err := json.Unmarshal([]byte(bundle.OneTimePreKeys), &keys); err != nil || len(keys) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "no one-time pre keys available"})
	}

	// Забираем первый ключ
	usedKey := keys[0]
	remaining := keys[1:]
	remainingJSON, err := json.Marshal(remaining)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "failed to update keys"})
	}
	bundle.OneTimePreKeys = string(remainingJSON)
	database.Save(&bundle)

	// WS уведомление — ключ извлечён
	e2eKeyMsg, _ := json.Marshal(fiber.Map{
		"type":     "e2e_key_consumed",
		"byUser":   userID,
		"deviceId": bundle.DeviceID,
	})
	ws.HubInstance.SendToUser(targetUserID, e2eKeyMsg)

	return c.JSON(fiber.Map{"oneTimePreKey": usedKey})
}

// InitSession — инициализация E2E сессии
func InitSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req E2EInitSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "bad request"})
	}

	if req.ChatID == "" || req.EncryptedKey == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId and encryptedKey required"})
	}

	database := db.GetDB()

	// Проверяем что оба участника в чате
	var members []models.ChatMember
	database.Where("chat_id = ?", req.ChatID).Find(&members)
	if len(members) < 2 {
		return c.Status(400).JSON(fiber.Map{"error": "need 2 members for E2E session"})
	}

	var otherUserID string
	for _, m := range members {
		if m.UserID != userID {
			otherUserID = m.UserID
			break
		}
	}

	// Проверяем нет ли уже активной сессии
	var existing models.E2ESession
	if err := database.Where("chat_id = ? AND is_active = ?", req.ChatID, true).First(&existing).Error; err == nil {
		// Verify current user is a participant of the existing session
		if existing.User1ID != userID && existing.User2ID != userID {
			return c.Status(403).JSON(fiber.Map{"error": "Not a participant of this E2E session"})
		}
		return c.JSON(fiber.Map{"ok": true, "sessionId": existing.ID, "existed": true})
	}

	session := models.E2ESession{
		ID:           generateID(),
		ChatID:       req.ChatID,
		User1ID:      userID,
		User2ID:      otherUserID,
		SharedSecret: req.EncryptedKey,
		IsActive:     true,
		CreatedAt:    time.Now(),
	}
	database.Create(&session)

	// WS уведомление — сессия создана
	e2eSessionMsg, _ := json.Marshal(fiber.Map{
		"type":        "e2e_session_started",
		"sessionId":   session.ID,
		"initiatedBy": userID,
	})
	ws.HubInstance.SendToChat(req.ChatID, e2eSessionMsg, userID)

	return c.JSON(fiber.Map{"ok": true, "sessionId": session.ID, "existed": false})
}

// GetSession — получить E2E сессию чата
func GetSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("chatId")
	database := db.GetDB()

	var session models.E2ESession
	if err := database.Where("chat_id = ? AND is_active = ? AND (user1_id = ? OR user2_id = ?)",
		chatID, true, userID, userID).First(&session).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "no active E2E session"})
	}

	return c.JSON(fiber.Map{
		"sessionId":   session.ID,
		"chatId":      session.ChatID,
		"isActive":    session.IsActive,
		"createdAt":   session.CreatedAt,
	})
}

// DeleteSession — удалить E2E сессию (сброс шифрования)
func DeleteSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("chatId")
	database := db.GetDB()

	result := database.Where("chat_id = ? AND (user1_id = ? OR user2_id = ?) AND is_active = ?",
		chatID, userID, userID, true).Delete(&models.E2ESession{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "no active session"})
	}

	// WS уведомление
	e2eDeleteMsg, _ := json.Marshal(fiber.Map{
		"type":      "e2e_session_deleted",
		"deletedBy": userID,
	})
	ws.HubInstance.SendToChat(chatID, e2eDeleteMsg, "")

	// Отключаем E2E флаг у чата
	database.Model(&models.Chat{}).Where("id = ?", chatID).Update("is_e2e", false)

	return c.JSON(fiber.Map{"ok": true})
}

// ─── E2E Middleware ──────────────────────────────────────────────────

// E2EMiddleware — помечает контекст если чат зашифрован
func E2EMiddleware(c *fiber.Ctx) error {
	chatID := c.Params("chatId")
	if chatID == "" {
		return c.Next()
	}

	database := db.GetDB()
	var session models.E2ESession
	if err := database.Where("chat_id = ? AND is_active = ?", chatID, true).First(&session).Error; err == nil {
		c.Locals("e2eSessionId", session.ID)
		c.Locals("isE2E", true)
	}

	return c.Next()
}
