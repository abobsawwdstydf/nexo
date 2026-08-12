package handlers

import (
	"log"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// isPlatformAdmin checks if a user is a platform admin (is_admin field).
// SECURITY: admin status comes only from the is_admin DB field. The old
// email-based shortcut allowed any stranger to register the support address
// and become a full platform admin.
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
	if err := db.GetDB().Model(&models.User{}).Where("id = ?", req.TargetID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to ban user"})
	}

	// Log moderation action
	modLog := models.ModerationLog{
		ID:       generateID(),
		ChatID:   chatID,
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "ban",
		Reason:   req.Reason,
		Duration: req.Duration,
	}
	if err := db.GetDB().Create(&modLog).Error; err != nil {
		log.Printf("[Moderation] failed to log ban: %v", err)
	}

	ws.HubInstance.SendToChat(chatID, mustWSMsg("moderation:ban",
		"targetId", req.TargetID,
		"actorId", userID,
		"reason", req.Reason,
	), "")

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

	// Prevent self-mute
	if req.TargetID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot mute yourself"})
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
	modLog := models.ModerationLog{
		ID:       generateID(),
		ChatID:   chatID,
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "mute",
		Duration: req.Duration,
	}
	if err := db.GetDB().Create(&modLog).Error; err != nil {
		log.Printf("[MODERATION] Failed to log mute: %v", err)
	}

	// Auto-unmute after duration
	if req.Duration > 0 {
		go func() {
			timer := time.NewTimer(time.Duration(req.Duration) * time.Minute)
			defer timer.Stop()
			select {
			case <-timer.C:
				db.GetDB().Model(&models.ChatMember{}).
					Where("chat_id = ? AND user_id = ?", chatID, req.TargetID).
					Update("is_muted", false)
				ws.HubInstance.SendToChat(chatID, mustWSMap("moderation:unmute", map[string]string{
					"targetId": req.TargetID,
				}), "")
			case <-StopCh:
				return
			}
		}()
	}

	ws.HubInstance.SendToChat(chatID, mustWSMsg("moderation:mute",
		"targetId", req.TargetID,
		"actorId", userID,
		"duration", req.Duration,
	), "")

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
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, req.TargetID).Delete(&models.ChatMember{}).Error; err != nil {
		log.Printf("[MODERATION] failed to remove member %s from chat %s: %v", req.TargetID, chatID, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to remove member"})
	}
	if err := db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("subscribers_count",
		gorm.Expr("CASE WHEN subscribers_count > 0 THEN subscribers_count - 1 ELSE 0 END")).Error; err != nil {
		log.Printf("[MODERATION] failed to decrement subscribers for chat %s: %v", chatID, err)
	}

	// Log
	modLog := models.ModerationLog{
		ID:       generateID(),
		ChatID:   chatID,
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "kick",
	}
	if err := db.GetDB().Create(&modLog).Error; err != nil {
		log.Printf("[Moderation] failed to log kick: %v", err)
	}

	ws.HubInstance.SendToChat(chatID, mustWSMap("moderation:kick", map[string]string{
		"targetId": req.TargetID,
		"actorId":  userID,
	}), "")
	ws.HubInstance.SendToUser(req.TargetID, mustWSMap("chat:kicked", map[string]string{
		"chatId": chatID,
	}))

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

	if err := db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).Update("slow_mode_interval", req.Interval).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to set slow mode"})
	}

	ws.HubInstance.SendToChat(chatID, mustWSMsg("moderation:slow_mode",
		"interval", req.Interval,
		"actorId", userID,
	), "")

	return c.JSON(fiber.Map{"ok": true, "interval": req.Interval})
}

// BadgeRequest is the payload for granting/clearing a verification badge.
type BadgeRequest struct {
	TargetID  string `json:"targetId"`
	BadgeType string `json:"badgeType"` // e.g. "verified", "premium", "developer", "moderator"
	BadgeURL  string `json:"badgeUrl"`
}

// SetUserBadge grants a verification badge to a user (admin only).
func SetUserBadge(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req BadgeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.TargetID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "targetId required"})
	}
	if req.BadgeURL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "badgeUrl required"})
	}
	if !isPlatformAdmin(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Only platform admins can grant badges"})
	}

	var target models.User
	if result := db.GetDB().First(&target, "id = ?", req.TargetID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if err := db.GetDB().Model(&models.User{}).Where("id = ?", req.TargetID).Updates(map[string]interface{}{
		"is_verified":         true,
		"verified_badge_type": req.BadgeType,
		"verified_badge_url":  req.BadgeURL,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to grant badge"})
	}

	ws.HubInstance.SendToUser(req.TargetID, mustWSMap("user:badge", map[string]string{
		"badgeType": req.BadgeType,
		"badgeUrl":  req.BadgeURL,
	}))
	// Notify the target's other devices too (was SendToChat(target.ID, ...),
	// which sent to a chat with the user's ID — nothing ever received it).
	ws.HubInstance.SendToUser(req.TargetID, mustWSMsg("user:badge_updated",
		"targetId", req.TargetID,
		"badgeType", req.BadgeType,
	))

	// Log moderation action
	if err := db.GetDB().Create(&models.ModerationLog{
		ID:       generateID(),
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "grant_badge",
		Reason:   req.BadgeType,
	}).Error; err != nil {
		log.Printf("[Moderation] failed to log grant_badge: %v", err)
	}

	return c.JSON(fiber.Map{"ok": true, "action": "grant_badge"})
}

// ClearUserBadge removes a verification badge from a user (admin only).
func ClearUserBadge(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req BadgeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.TargetID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "targetId required"})
	}
	if !isPlatformAdmin(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Only platform admins can clear badges"})
	}

	if result := db.GetDB().First(&models.User{}, "id = ?", req.TargetID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if err := db.GetDB().Model(&models.User{}).Where("id = ?", req.TargetID).Updates(map[string]interface{}{
		"is_verified":         false,
		"verified_badge_type": "",
		"verified_badge_url":  "",
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to clear badge"})
	}

	ws.HubInstance.SendToUser(req.TargetID, mustWSMap("user:badge", map[string]string{
		"badgeType": "",
		"badgeUrl":  "",
	}))

	if err := db.GetDB().Create(&models.ModerationLog{
		ID:       generateID(),
		TargetID: req.TargetID,
		ActorID:  userID,
		Action:   "clear_badge",
	}).Error; err != nil {
		log.Printf("[Moderation] failed to log clear_badge: %v", err)
	}

	return c.JSON(fiber.Map{"ok": true, "action": "clear_badge"})
}

// ReportChat lets any chat member report a chat to the platform moderators.
// Logged into ModerationLog with action "report_chat" so admins can review.
func ReportChat(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Reason string `json:"reason"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if len([]rune(req.Reason)) > 1000 {
		return c.Status(400).JSON(fiber.Map{"error": "Reason too long (max 1000 characters)"})
	}

	// Only chat members can report the chat
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "You are not a member of this chat"})
	}

	if err := db.GetDB().Create(&models.ModerationLog{
		ID:       generateID(),
		ChatID:   chatID,
		TargetID: chatID,
		ActorID:  userID,
		Action:   "report_chat",
		Reason:   req.Reason,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save report"})
	}

	return c.Status(201).JSON(fiber.Map{"ok": true, "action": "report_chat"})
}

// AdminListReports returns recent moderation logs (reports, bans, mutes) for
// the platform admin dashboard. Admin only.
func AdminListReports(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	if !isPlatformAdmin(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Admin only"})
	}

	var logs []models.ModerationLog
	if result := db.GetDB().
		Order("created_at DESC").
		Limit(100).
		Find(&logs); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load moderation logs"})
	}

	// Enrich with actor / target names for display.
	type reportJSON struct {
		ID        string `json:"id"`
		ChatID    string `json:"chatId"`
		TargetID  string `json:"targetId"`
		ActorID   string `json:"actorId"`
		Action    string `json:"action"`
		Reason    string `json:"reason"`
		Duration  int    `json:"duration"`
		CreatedAt string `json:"createdAt"`
		ActorName string `json:"actorName"`
		ChatName  string `json:"chatName"`
	}
	items := make([]reportJSON, 0, len(logs))
	for _, l := range logs {
		item := reportJSON{
			ID:        l.ID,
			ChatID:    l.ChatID,
			TargetID:  l.TargetID,
			ActorID:   l.ActorID,
			Action:    l.Action,
			Reason:    l.Reason,
			Duration:  l.Duration,
			CreatedAt: l.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		}
		var actor models.User
		if err := db.GetDB().Select("display_name, username").First(&actor, "id = ?", l.ActorID).Error; err == nil {
			item.ActorName = actor.DisplayName
			if item.ActorName == "" {
				item.ActorName = actor.Username
			}
		}
		if l.ChatID != "" {
			var chat models.Chat
			if err := db.GetDB().Select("name, username").First(&chat, "id = ?", l.ChatID).Error; err == nil {
				item.ChatName = chat.Name
				if item.ChatName == "" {
					item.ChatName = chat.Username
				}
			}
		}
		items = append(items, item)
	}

	return c.JSON(fiber.Map{"items": items, "total": len(items)})
}
