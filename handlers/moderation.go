package handlers

import (
	"encoding/json"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// isPlatformAdmin checks if a user is a platform admin (is_admin field).
func isPlatformAdmin(userID string) bool {
	var user models.User
	if result := db.GetDB().Select("is_admin").First(&user, "id = ?", userID); result.Error != nil {
		return false
	}
	return user.IsAdmin
}

func BanUser(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req models.BanUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.TargetID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "targetId required"})
	}

	// Only platform admins can issue global bans
	if !isPlatformAdmin(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Only platform admins can ban users globally"})
	}

	// Prevent self-ban
	if req.TargetID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot ban yourself"})
	}

	// Prevent banning other admins
	var target models.User
	if result := db.GetDB().Select("is_admin").First(&target, "id = ?", req.TargetID); result.Error == nil && target.IsAdmin {
		return c.Status(403).JSON(fiber.Map{"error": "Cannot ban another platform admin"})
	}

	// Ban the user globally
	updates := map[string]interface{}{
		"is_banned":  true,
		"ban_reason": req.Reason,
	}
	db.GetDB().Model(&models.User{}).Where("id = ?", req.TargetID).Updates(updates)

	// Log moderation action
	log := models.ModerationLog{
		ID:       generateID(),
		ChatID:   chatID,
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "ban",
		Reason:   req.Reason,
		Duration: req.Duration,
	}
	db.GetDB().Create(&log)

	// Notify chat
	reasonJSON, _ := json.Marshal(req.Reason)
	ws.HubInstance.SendToChat(chatID, []byte(`{"type":"moderation:ban","targetId":"`+req.TargetID+`","actorId":"`+userID+`","reason":`+string(reasonJSON)+`}`), "")

	return c.JSON(fiber.Map{"ok": true, "action": "ban"})
}

func MuteUser(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req models.MuteUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.TargetID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "targetId required"})
	}

	// Check caller is admin/owner
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}
	if member.Role != "owner" && member.Role != "admin" {
		return c.Status(403).JSON(fiber.Map{"error": "No moderation permissions"})
	}

	// Mute the target in this chat
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, req.TargetID).
		Update("is_muted", true)

	// Log
	log := models.ModerationLog{
		ID:       generateID(),
		ChatID:   chatID,
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "mute",
		Duration: req.Duration,
	}
	db.GetDB().Create(&log)

	// Auto-unmute after duration
	if req.Duration > 0 {
		go func() {
			time.Sleep(time.Duration(req.Duration) * time.Minute)
			db.GetDB().Model(&models.ChatMember{}).
				Where("chat_id = ? AND user_id = ?", chatID, req.TargetID).
				Update("is_muted", false)
			ws.HubInstance.SendToChat(chatID, []byte(`{"type":"moderation:unmute","targetId":"`+req.TargetID+`"}`), "")
		}()
	}

	ws.HubInstance.SendToChat(chatID, []byte(`{"type":"moderation:mute","targetId":"`+req.TargetID+`","actorId":"`+userID+`","duration":`+strconv.Itoa(req.Duration)+`}`), "")

	return c.JSON(fiber.Map{"ok": true, "action": "mute"})
}

func KickUser(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req models.KickUserRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.TargetID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "targetId required"})
	}

	// Check caller is admin/owner
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}
	if member.Role != "owner" && member.Role != "admin" {
		return c.Status(403).JSON(fiber.Map{"error": "No moderation permissions"})
	}

	// Remove from chat
	db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, req.TargetID).Delete(&models.ChatMember{})
	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("subscribers_count",
		db.GetDB().Raw("subscribers_count - 1"))

	// Log
	log := models.ModerationLog{
		ID:       generateID(),
		ChatID:   chatID,
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "kick",
	}
	db.GetDB().Create(&log)

	ws.HubInstance.SendToChat(chatID, []byte(`{"type":"moderation:kick","targetId":"`+req.TargetID+`","actorId":"`+userID+`"}`), "")
	ws.HubInstance.SendToUser(req.TargetID, []byte(`{"type":"chat:kicked","chatId":"`+chatID+`"}`))

	return c.JSON(fiber.Map{"ok": true, "action": "kick"})
}

func SetSlowMode(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req models.SlowModeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Check caller is admin/owner
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}
	if member.Role != "owner" && member.Role != "admin" {
		return c.Status(403).JSON(fiber.Map{"error": "No moderation permissions"})
	}

	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("slow_mode_interval", req.Interval)

	ws.HubInstance.SendToChat(chatID, []byte(`{"type":"moderation:slow_mode","interval":`+strconv.Itoa(req.Interval)+`,"actorId":"`+userID+`"}`), "")

	return c.JSON(fiber.Map{"ok": true, "interval": req.Interval})
}
