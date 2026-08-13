package handlers

import (
	"encoding/json"
	"errors"
	"sync"
	"time"

	"nexo/db"
	"nexo/models"
	"nexo/ws"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// Sentinel errors for the one-time pre-key consumption transaction.
var (
	errE2ENoBundles = errors.New("no bundles")
	errE2ENoKeys    = errors.New("no one-time pre keys available")
)

// в”Ђв”Ђв”Ђ Feature 7: E2E Key Exchange в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

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

// UploadKeyBundle вЂ” РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ Р·Р°РіСЂСѓР¶Р°РµС‚ СЃРІРѕР№ РїСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡РµРІРѕР№ РЅР°Р±РѕСЂ
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
		// РћР±РЅРѕРІР»СЏРµРј СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёР№
		existing.IdentityKey = req.IdentityKey
		existing.SignedPreKey = req.SignedPreKey
		existing.SignedKeySig = req.SignedKeySig
		existing.OneTimePreKeys = string(keysJSON)
		existing.UploadedAt = time.Now()
		database.Save(&existing)
	} else {
		// РЎРѕР·РґР°С‘Рј РЅРѕРІС‹Р№
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

// FetchKeyBundle вЂ” РїРѕР»СѓС‡РёС‚СЊ РїСѓР±Р»РёС‡РЅС‹Р№ РєР»СЋС‡РµРІРѕР№ РЅР°Р±РѕСЂ РґСЂСѓРіРѕРіРѕ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ
func FetchKeyBundle(c *fiber.Ctx) error {
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
			keys = []string{}
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

// preKeyMu serializes one-time pre-key consumption. The read-modify-write
// (unmarshal в†’ drop first key в†’ save) is not atomic in SQLite without a
// write lock, so two parallel requests could consume the same key twice.
var preKeyMu sync.Mutex

// ConsumeOneTimePreKey вЂ” Р·Р°Р±СЂР°С‚СЊ one-time РїСЂРµРєР»СЋС‡Р°С‚РµР»СЊ (РѕРґРЅРѕСЂР°Р·РѕРІС‹Р№)
func ConsumeOneTimePreKey(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	database := db.GetDB()
	targetUserID := c.Params("userId")

	// Verify requester and target share at least one chat
	var sharedChatCount int64
	if err := database.Model(&models.ChatMember{}).
		Where("user_id = ? AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)", userID, targetUserID).
		Count(&sharedChatCount).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "database error"})
	}
	if sharedChatCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "No shared chat with target user"})
	}

	preKeyMu.Lock()
	defer preKeyMu.Unlock()

	var usedKey string
	var deviceID string
	err := database.Transaction(func(tx *gorm.DB) error {
		var bundle models.E2EKeyBundle
		if err := tx.Where("user_id = ?", targetUserID).First(&bundle).Error; err != nil {
			return errE2ENoBundles
		}

		var keys []string
		if err := json.Unmarshal([]byte(bundle.OneTimePreKeys), &keys); err != nil || len(keys) == 0 {
			return errE2ENoKeys
		}

		usedKey = keys[0]
		deviceID = bundle.DeviceID
		remainingJSON, err := json.Marshal(keys[1:])
		if err != nil {
			return err
		}
		bundle.OneTimePreKeys = string(remainingJSON)
		return tx.Save(&bundle).Error
	})
	if err != nil {
		switch err {
		case errE2ENoBundles:
			return c.Status(404).JSON(fiber.Map{"error": "no bundles"})
		case errE2ENoKeys:
			return c.Status(404).JSON(fiber.Map{"error": "no one-time pre keys available"})
		default:
			return c.Status(500).JSON(fiber.Map{"error": "failed to update keys"})
		}
	}

	// WS СѓРІРµРґРѕРјР»РµРЅРёРµ вЂ” РєР»СЋС‡ РёР·РІР»РµС‡С‘РЅ
	e2eKeyMsg, _ := json.Marshal(fiber.Map{
		"type":     "e2e_key_consumed",
		"byUser":   userID,
		"deviceId": deviceID,
	})
	ws.HubInstance.SendToUser(targetUserID, e2eKeyMsg)

	return c.JSON(fiber.Map{"oneTimePreKey": usedKey})
}

// InitSession вЂ” РёРЅРёС†РёР°Р»РёР·Р°С†РёСЏ E2E СЃРµСЃСЃРёРё
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

	// РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ РІС‹Р·С‹РІР°СЋС‰РёР№ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊ вЂ” СѓС‡Р°СЃС‚РЅРёРє С‡Р°С‚Р°
	var membership models.ChatMember
	if err := database.Where("chat_id = ? AND user_id = ?", req.ChatID, userID).First(&membership).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "You are not a member of this chat"})
	}

	// РџСЂРѕРІРµСЂСЏРµРј С‡С‚Рѕ РѕР±Р° СѓС‡Р°СЃС‚РЅРёРєР° РІ С‡Р°С‚Рµ
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

	// РџСЂРѕРІРµСЂСЏРµРј РЅРµС‚ Р»Рё СѓР¶Рµ Р°РєС‚РёРІРЅРѕР№ СЃРµСЃСЃРёРё
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

	// WS СѓРІРµРґРѕРјР»РµРЅРёРµ вЂ” СЃРµСЃСЃРёСЏ СЃРѕР·РґР°РЅР°
	e2eSessionMsg, _ := json.Marshal(fiber.Map{
		"type":        "e2e_session_started",
		"sessionId":   session.ID,
		"initiatedBy": userID,
	})
	ws.HubInstance.SendToChat(req.ChatID, e2eSessionMsg, userID)

	return c.JSON(fiber.Map{"ok": true, "sessionId": session.ID, "existed": false})
}


// GetSession вЂ” РїРѕР»СѓС‡РёС‚СЊ E2E СЃРµСЃСЃРёСЋ С‡Р°С‚Р° (Р»РёС‡РЅС‹Р№ С‡Р°С‚)
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
		"sessionId": session.ID,
		"chatId":    session.ChatID,
		"isActive":  session.IsActive,
		"createdAt": session.CreatedAt,
	})
}

// DeleteSession вЂ” СѓРґР°Р»РёС‚СЊ E2E СЃРµСЃСЃРёСЋ (Р»РёС‡РЅС‹Р№ С‡Р°С‚, СЃР±СЂРѕСЃ С€РёС„СЂРѕРІР°РЅРёСЏ)
func DeleteSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("chatId")
	database := db.GetDB()

	result := database.Where("chat_id = ? AND (user1_id = ? OR user2_id = ?) AND is_active = ?",
		chatID, userID, userID, true).Delete(&models.E2ESession{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "no active session"})
	}

	// WS СѓРІРµРґРѕРјР»РµРЅРёРµ
	e2eDeleteMsg, _ := json.Marshal(fiber.Map{
		"type":      "e2e_session_deleted",
		"deletedBy": userID,
	})
	ws.HubInstance.SendToChat(chatID, e2eDeleteMsg, "")

	// РћС‚РєР»СЋС‡Р°РµРј E2E С„Р»Р°Рі Сѓ С‡Р°С‚Р°
	database.Model(&models.Chat{}).Where("id = ?", chatID).Update("is_e2e", false)

	return c.JSON(fiber.Map{"ok": true})
}

// в”Ђв”Ђв”Ђ E2E Group Sessions в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

// E2EGroupKeyWrap вЂ” РѕР±С‘СЂРЅСѓС‚С‹Р№ РіСЂСѓРїРїРѕРІРѕР№ РєР»СЋС‡ РґР»СЏ РѕРґРЅРѕРіРѕ СѓС‡Р°СЃС‚РЅРёРєР°
type E2EGroupKeyWrap struct {
	UserID     string `json:"userId"`
	WrappedKey string `json:"wrappedKey"`
}

type E2EGroupSessionRequest struct {
	ChatID      string            `json:"chatId"`
	WrappedKeys []E2EGroupKeyWrap `json:"wrappedKeys"`
}

func isChatMemberOf(userID, chatID string) bool {
	var count int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Count(&count)
	return count > 0
}

// sendGroupSessionUpdate вЂ” WS СЃРѕР±С‹С‚РёРµ e2e_group_session_updated РІ С‡Р°С‚
func sendGroupSessionUpdate(chatID, action, byUser string) {
	msg, _ := json.Marshal(fiber.Map{
		"type":   "e2e_group_session_updated",
		"chatId": chatID,
		"action": action,
		"byUser": byUser,
	})
	ws.HubInstance.SendToChat(chatID, msg, "")
}

func upsertGroupWrappedKeys(tx *gorm.DB, chatID, byUser string, wraps []E2EGroupKeyWrap) error {
	for _, w := range wraps {
		if w.UserID == "" || w.WrappedKey == "" {
			continue
		}
		var existing models.E2EGroupKey
		err := tx.Where("chat_id = ? AND user_id = ?", chatID, w.UserID).First(&existing).Error
		if err == nil {
			existing.WrappedKey = w.WrappedKey
			existing.CreatedBy = byUser
			if err := tx.Save(&existing).Error; err != nil {
				return err
			}
			continue
		}
		if err != gorm.ErrRecordNotFound {
			return err
		}
		key := models.E2EGroupKey{
			ID:         generateID(),
			ChatID:     chatID,
			UserID:     w.UserID,
			WrappedKey: w.WrappedKey,
			CreatedBy:  byUser,
		}
		if err := tx.Create(&key).Error; err != nil {
			return err
		}
	}
	return nil
}

// InitGroupSession вЂ” СЃРѕР·РґР°С‚СЊ РіСЂСѓРїРїРѕРІСѓСЋ E2E-СЃРµСЃСЃРёСЋ: РєР»РёРµРЅС‚ СЃР°Рј РіРµРЅРµСЂРёСЂСѓРµС‚
// РіСЂСѓРїРїРѕРІРѕР№ РєР»СЋС‡, РѕР±РѕСЂР°С‡РёРІР°РµС‚ РµРіРѕ РґР»СЏ РєР°Р¶РґРѕРіРѕ СѓС‡Р°СЃС‚РЅРёРєР° Рё РїСЂРёСЃС‹Р»Р°РµС‚ РѕР±С‘СЂС‚РєРё.
func InitGroupSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req E2EGroupSessionRequest
	if err := c.BodyParser(&req); err != nil || req.ChatID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId and wrappedKeys required"})
	}

	if !isChatMemberOf(userID, req.ChatID) {
		return c.Status(403).JSON(fiber.Map{"error": "You are not a member of this chat"})
	}

	database := db.GetDB()
	err := database.Transaction(func(tx *gorm.DB) error {
		return upsertGroupWrappedKeys(tx, req.ChatID, userID, req.WrappedKeys)
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save group session"})
	}

	sendGroupSessionUpdate(req.ChatID, "created", userID)
	return c.JSON(fiber.Map{"ok": true})
}

// GetGroupSession вЂ” РїРѕР»СѓС‡РёС‚СЊ РѕР±С‘СЂС‚РєРё РіСЂСѓРїРїРѕРІРѕРіРѕ РєР»СЋС‡Р° РґР»СЏ С‡Р°С‚Р°.
// РљР»РёРµРЅС‚ РІС‹Р±РёСЂР°РµС‚ СЃРІРѕСЋ РѕР±С‘СЂС‚РєСѓ (userId = me) Рё СЂР°Р·РІРѕСЂР°С‡РёРІР°РµС‚ РµС‘.
func GetGroupSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("chatId")

	if !isChatMemberOf(userID, chatID) {
		return c.Status(403).JSON(fiber.Map{"error": "You are not a member of this chat"})
	}

	var rows []models.E2EGroupKey
	if err := db.GetDB().Where("chat_id = ?", chatID).Find(&rows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "database error"})
	}

	if len(rows) == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "no group E2E session"})
	}

	wrappedKeys := make([]E2EGroupKeyWrap, 0, len(rows))
	for _, r := range rows {
		wrappedKeys = append(wrappedKeys, E2EGroupKeyWrap{
			UserID:     r.UserID,
			WrappedKey: r.WrappedKey,
		})
	}
	return c.JSON(fiber.Map{"chatId": chatID, "wrappedKeys": wrappedKeys})
}

// RotateGroupSession вЂ” СЂРѕС‚Р°С†РёСЏ РіСЂСѓРїРїРѕРІРѕРіРѕ РєР»СЋС‡Р°: РєР»РёРµРЅС‚ С€Р»С‘С‚ РЅРѕРІС‹Рµ РѕР±С‘СЂС‚РєРё,
// СЃС‚Р°СЂС‹Рµ Р·Р°РјРµРЅСЏСЋС‚СЃСЏ.
func RotateGroupSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("chatId")

	var req E2EGroupSessionRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "bad request"})
	}

	if !isChatMemberOf(userID, chatID) {
		return c.Status(403).JSON(fiber.Map{"error": "You are not a member of this chat"})
	}

	database := db.GetDB()
	err := database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("chat_id = ?", chatID).Delete(&models.E2EGroupKey{}).Error; err != nil {
			return err
		}
		return upsertGroupWrappedKeys(tx, chatID, userID, req.WrappedKeys)
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to rotate group session"})
	}

	sendGroupSessionUpdate(chatID, "rotated", userID)
	return c.JSON(fiber.Map{"ok": true})
}

// DeleteGroupSession вЂ” СѓРґР°Р»РёС‚СЊ РіСЂСѓРїРїРѕРІСѓСЋ E2E-СЃРµСЃСЃРёСЋ (СЃР±СЂРѕСЃ С€РёС„СЂРѕРІР°РЅРёСЏ)
func DeleteGroupSession(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("chatId")

	if !isChatMemberOf(userID, chatID) {
		return c.Status(403).JSON(fiber.Map{"error": "You are not a member of this chat"})
	}

	result := db.GetDB().Where("chat_id = ?", chatID).Delete(&models.E2EGroupKey{})
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete group session"})
	}

	sendGroupSessionUpdate(chatID, "deleted", userID)
	return c.JSON(fiber.Map{"ok": true})
}

