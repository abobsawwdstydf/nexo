package handlers

import (
	"crypto/rand"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"
)

// inviteCodeChars — alphabet without lookalike chars (0/O, 1/I/l)
const inviteCodeChars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

func generateInviteCode(length int) string {
	buf := make([]byte, length)
	idx := make([]byte, length)
	if _, err := rand.Read(idx); err != nil {
		return "INVALID"
	}
	for i := 0; i < length; i++ {
		buf[i] = inviteCodeChars[int(idx[i])%len(inviteCodeChars)]
	}
	return string(buf)
}

// canManageInvites reports whether userID may create/revoke invite links for chatID.
func canManageInvites(chatID, userID string) bool {
	var member models.ChatMember
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member).Error; err != nil {
		return false
	}
	if member.Role == "owner" || member.Role == "admin" {
		return true
	}
	var chat models.Chat
	if err := db.GetDB().First(&chat, "id = ?", chatID).Error; err == nil && chat.CanMembersInvite {
		return true
	}
	return false
}

// CreateInviteLink POST /chats/:id/invite-links
func CreateInviteLink(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	if !canManageInvites(chatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "No permission to create invite links"})
	}

	var req struct {
		MaxUses          int `json:"maxUses"`
		ExpiresInSeconds int `json:"expiresInSeconds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	if req.MaxUses < 0 || req.MaxUses > 10000 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid maxUses"})
	}
	if req.ExpiresInSeconds < 0 || req.ExpiresInSeconds > 30*24*3600 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid expiresInSeconds"})
	}

	link := models.InviteLink{
		ID:        generateID(),
		ChatID:    chatID,
		Code:      generateInviteCode(9),
		CreatedBy: userID,
		MaxUses:   req.MaxUses,
		Active:    true,
	}
	if req.ExpiresInSeconds > 0 {
		exp := time.Now().Add(time.Duration(req.ExpiresInSeconds) * time.Second)
		link.ExpiresAt = &exp
	}
	if err := db.GetDB().Create(&link).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create invite link"})
	}
	return c.JSON(link)
}

// GetInviteLinks GET /chats/:id/invite-links
func GetInviteLinks(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	if !canManageInvites(chatID, userID) {
		// Regular members see nothing (privacy), not an error.
		return c.JSON([]models.InviteLink{})
	}

	var links []models.InviteLink
	if err := db.GetDB().Where("chat_id = ?", chatID).Order("created_at DESC").Find(&links).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load invite links"})
	}
	return c.JSON(links)
}

// RevokeInviteLink DELETE /chats/:id/invite-links/:code
func RevokeInviteLink(c *fiber.Ctx) error {
	chatID := c.Params("id")
	code := c.Params("code")
	userID := c.Locals("userId").(string)

	if !canManageInvites(chatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "No permission to revoke invite links"})
	}

	if err := db.GetDB().Model(&models.InviteLink{}).
		Where("chat_id = ? AND code = ?", chatID, code).
		Update("active", false).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to revoke invite link"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// GetInviteInfo GET /invite/:code (public)
func GetInviteInfo(c *fiber.Ctx) error {
	code := strings.TrimSpace(c.Params("code"))
	if code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Code required"})
	}

	var link models.InviteLink
	if err := db.GetDB().Where("code = ?", code).First(&link).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Invite link not found"})
	}
	if !link.Active || (link.ExpiresAt != nil && time.Now().After(*link.ExpiresAt)) || (link.MaxUses > 0 && link.Uses >= link.MaxUses) {
		return c.Status(410).JSON(fiber.Map{"error": "invite_expired", "message": "Ссылка-приглашение недействительна"})
	}

	var chat models.Chat
	if err := db.GetDB().First(&chat, "id = ?", link.ChatID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Chat not found"})
	}

	// chat.JSON leaks members (phones…) — build a safe summary instead.
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).Where("chat_id = ?", chat.ID).Count(&memberCount)

	return c.JSON(fiber.Map{
		"code": link.Code,
		"chat": fiber.Map{
			"id":         chat.ID,
			"name":       chat.Name,
			"avatar":     chat.Avatar,
			"type":       chat.Type,
			"customIcon": chat.CustomIcon,
			"customColor": chat.CustomColor,
			"memberCount": memberCount,
			"rules":       chat.Rules,
		},
	})
}

// JoinInvite POST /invite/:code/join
func JoinInvite(c *fiber.Ctx) error {
	code := strings.TrimSpace(c.Params("code"))
	userID := c.Locals("userId").(string)
	if code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Code required"})
	}

	var link models.InviteLink
	if err := db.GetDB().Where("code = ?", code).First(&link).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Invite link not found"})
	}
	if !link.Active || (link.ExpiresAt != nil && time.Now().After(*link.ExpiresAt)) || (link.MaxUses > 0 && link.Uses >= link.MaxUses) {
		return c.Status(410).JSON(fiber.Map{"error": "invite_expired", "message": "Ссылка-приглашение недействительна"})
	}

	var chat models.Chat
	if err := db.GetDB().First(&chat, "id = ?", link.ChatID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Chat not found"})
	}

	// Already a member → just return the chat ID.
	var existing models.ChatMember
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", link.ChatID, userID).First(&existing).Error; err == nil {
		return c.JSON(fiber.Map{"chatId": chat.ID, "alreadyMember": true})
	}

	member := models.ChatMember{
		ID:     generateID(),
		ChatID: link.ChatID,
		UserID: userID,
		Role:   "member",
	}
if err := db.GetDB().Create(&member).Error; err != nil {
		logging.Log.Error("[invite] failed to add member", "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to join"})
	}

	// Атомарно инкрементируем счётчик и одновременно занимаем слот лимита:
	// UPDATE ... WHERE uses < max_uses защищает от гонки двух параллельных join.
	used := db.GetDB().Model(&models.InviteLink{}).
		Where("id = ? AND (max_uses = 0 OR uses < max_uses)", link.ID).
		Update("uses", gorm.Expr("uses + 1"))
	if used.Error != nil {
		logging.Log.Error("[invite] failed to bump uses", "err", used.Error)
	}
	if used.RowsAffected == 0 {
		// Лимит исчерпан между проверкой и вставкой — откатываем членство.
		db.GetDB().Where("chat_id = ? AND user_id = ?", link.ChatID, userID).Delete(&models.ChatMember{})
		return c.Status(410).JSON(fiber.Map{"error": "invite_expired", "message": "Ссылка-приглашение недействительна"})
	}
	db.GetDB().Model(&models.Chat{}).Where("id = ?", chat.ID).Update("subscribers_count", gorm.Expr("subscribers_count + 1"))
	ws.HubInstance.JoinChat(chat.ID, userID)

	return c.JSON(fiber.Map{"chatId": chat.ID, "alreadyMember": false})
}
