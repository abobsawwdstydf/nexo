package handlers

import (
	"encoding/json"
	"time"

	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"

	"github.com/gofiber/fiber/v2"
)

// POST /dead-man-switch
func CreateDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		InactivityDays  int      `json:"inactivityDays"`
		MessageTemplate string   `json:"messageTemplate"`
		RecipientIDs    []string `json:"recipientIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.InactivityDays <= 0 {
		req.InactivityDays = 30
	}

	// Convert recipient IDs to JSON string
	recipientJSON := "[]"
	if len(req.RecipientIDs) > 0 {
		b, _ := json.Marshal(req.RecipientIDs)
		recipientJSON = string(b)
	}

	switch_ := models.DeadManSwitch{
		ID:              generateID(),
		UserID:          userID,
		IsEnabled:       true,
		InactivityDays:  req.InactivityDays,
		LastCheckIn:     time.Now(),
		MessageTemplate: req.MessageTemplate,
		RecipientIDs:    recipientJSON,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	if err := db.GetDB().Create(&switch_).Error; err != nil {
		logging.Log.Error("[dms] failed to create switch", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create dead man switch"})
	}

	return c.Status(201).JSON(switch_)
}

// GET /dead-man-switch
func GetDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var switch_ models.DeadManSwitch
	if err := db.GetDB().Where("user_id = ?", userID).First(&switch_).Error; err != nil {
		return c.JSON(fiber.Map{
			"isEnabled":      false,
			"inactivityDays": 30,
		})
	}

	return c.JSON(switch_)
}

// PUT /dead-man-switch
func UpdateDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		IsEnabled       *bool    `json:"isEnabled"`
		InactivityDays  *int     `json:"inactivityDays"`
		MessageTemplate *string  `json:"messageTemplate"`
		RecipientIDs    []string `json:"recipientIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}
	if req.IsEnabled != nil {
		updates["is_enabled"] = *req.IsEnabled
	}
	if req.InactivityDays != nil {
		updates["inactivity_days"] = *req.InactivityDays
	}
	if req.MessageTemplate != nil {
		updates["message_template"] = *req.MessageTemplate
	}
	if req.RecipientIDs != nil {
		b, _ := json.Marshal(req.RecipientIDs)
		updates["recipient_ids"] = string(b)
	}

	if err := db.GetDB().Model(&models.DeadManSwitch{}).Where("user_id = ?", userID).Updates(updates).Error; err != nil {
		logging.Log.Error("[dms] failed to update switch", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update dead man switch"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /dead-man-switch
func DeleteDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	if err := db.GetDB().Where("user_id = ?", userID).Delete(&models.DeadManSwitch{}).Error; err != nil {
		logging.Log.Error("[dms] failed to delete switch", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete dead man switch"})
	}
	return c.JSON(fiber.Map{"success": true})
}

// POST /dead-man-switch/check-in
func DeadManSwitchCheckIn(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	if err := db.GetDB().Model(&models.DeadManSwitch{}).Where("user_id = ?", userID).Update("last_check_in", time.Now()).Error; err != nil {
		logging.Log.Error("[dms] failed to check in", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to check in"})
	}

	return c.JSON(fiber.Map{"success": true})
}

// ─── Background check ───────────────────────────────────────────────────────

// ProcessDeadManSwitches checks enabled, not-yet-triggered switches for
// inactivity and delivers the fallback message to the configured recipients.
// Intended to be called from a background goroutine.
func ProcessDeadManSwitches() {
	database := db.GetDB()
	now := time.Now()

	var switches []models.DeadManSwitch
	if err := database.Where("is_enabled = ? AND is_triggered = ?", true, false).Find(&switches).Error; err != nil {
		logging.Log.Error("[dms] query failed", "err", err)
		return
	}

	for i := range switches {
		s := &switches[i]
		cutoff := s.LastCheckIn.AddDate(0, 0, s.InactivityDays)
		if now.Before(cutoff) {
			continue
		}
		triggerDeadManSwitch(database, s, now)
	}
}

func triggerDeadManSwitch(database *gorm.DB, s *models.DeadManSwitch, now time.Time) {
	var recipients []string
	if err := json.Unmarshal([]byte(s.RecipientIDs), &recipients); err != nil {
		recipients = nil
	}

	template := s.MessageTemplate
	if template == "" {
		template = "⚠️ Владелец этого аккаунта не выходит на связь. Пожалуйста, проверьте, всё ли в порядке."
	}

	for _, recipientID := range recipients {
		if recipientID == "" || recipientID == s.UserID {
			continue
		}
		chatID := findOrCreatePersonalChat(database, s.UserID, recipientID)
		if chatID == "" {
			continue
		}

		msg := models.Message{
			ID:        generateID(),
			ChatID:    chatID,
			SenderID:  s.UserID,
			Content:   template,
			Type:      "text",
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err := database.Create(&msg).Error; err != nil {
			logging.Log.Error("[dms] failed to create message to recipient", "recipient_id", recipientID, "switch_id", s.ID, "err", err)
			continue
		}
		if err := database.Model(&models.Chat{}).Where("id = ?", chatID).Update("updated_at", now).Error; err != nil {
			logging.Log.Error("[dms] failed to bump chat updated_at", "chat_id", chatID, "err", err)
		}

		database.Preload("Sender").First(&msg, "id = ?", msg.ID)
		msgJSON := messageToJSON(msg)
		ws.HubInstance.SendToChat(chatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")
		notifyBotsOfMessage(chatID, msg, msg.Sender)

		if err := database.Create(&models.DeadManSwitchRecipient{
			ID:       generateID(),
			SwitchID: s.ID,
			UserID:   recipientID,
			SentAt:   now,
		}).Error; err != nil {
			logging.Log.Error("[dms] failed to record recipient", "switch_id", s.ID, "err", err)
		}
	}

	// Triggered once — the user can re-arm the switch manually.
	if err := database.Model(s).Updates(map[string]interface{}{
		"is_triggered": true,
		"triggered_at": now,
		"is_enabled":   false,
	}).Error; err != nil {
		logging.Log.Error("[dms] failed to mark switch as triggered", "switch_id", s.ID, "err", err)
	}
}

// findOrCreatePersonalChat returns the existing personal chat between the two
// users or creates one, returning its ID ("" on failure).
func findOrCreatePersonalChat(database *gorm.DB, userA, userB string) string {
	var myChatIDs []string
	if err := database.Model(&models.ChatMember{}).Where("user_id = ?", userA).Pluck("chat_id", &myChatIDs).Error; err != nil {
		return ""
	}
	if len(myChatIDs) > 0 {
		var sharedIDs []string
		if err := database.Model(&models.ChatMember{}).
			Where("chat_id IN ? AND user_id = ?", myChatIDs, userB).
			Pluck("chat_id", &sharedIDs).Error; err != nil {
			return ""
		}
		for _, cid := range sharedIDs {
			var chat models.Chat
			if err := database.First(&chat, "id = ? AND type = ?", cid, "personal").Error; err == nil {
				return chat.ID
			}
		}
	}

	chatID := generateID()
	err := database.Transaction(func(tx *gorm.DB) error {
		chat := models.Chat{
			ID:               chatID,
			Type:             "personal",
			CanMembersPost:   true,
			CanMembersInvite: true,
		}
		if err := tx.Create(&chat).Error; err != nil {
			return err
		}
		for _, uid := range []string{userA, userB} {
			member := models.ChatMember{
				ID:     generateID(),
				ChatID: chatID,
				UserID: uid,
				Role:   "member",
			}
			if err := tx.Create(&member).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		logging.Log.Error("[dms] failed to create personal chat", "err", err)
		return ""
	}

	var created models.Chat
	database.Preload("Members").Preload("Members.User").First(&created, "id = ?", chatID)
	for _, uid := range []string{userA, userB} {
		chatJSON := chatToJSON(created, uid)
		ws.HubInstance.SendToUser(uid, []byte(`{"type":"chat:created","chat":`+chatJSON+`}`))
	}
	return chatID
}

// StartDeadManSwitchLoop runs a background goroutine that checks dead man
// switches every 60 seconds.
func StartDeadManSwitchLoop() {
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				ProcessDeadManSwitches()
			case <-StopCh:
				return
			}
		}
	}()
}

