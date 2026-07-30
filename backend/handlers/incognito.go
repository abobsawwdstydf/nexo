package handlers

import (
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /incognito/create
func CreateIncognitoChat(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		IsEncrypted bool `json:"isEncrypted"`
		MaxMembers  int  `json:"maxMembers"`
		ExpiresIn   int  `json:"expiresIn"` // minutes
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.MaxMembers <= 0 || req.MaxMembers > 100 {
		req.MaxMembers = 10
	}

	inviteCode := generateShortCode()

	var expiresAt *time.Time
	if req.ExpiresIn > 0 {
		t := time.Now().Add(time.Duration(req.ExpiresIn) * time.Minute)
		expiresAt = &t
	}

	chat := models.IncognitoChat{
		ID:          generateID(),
		CreatorID:   userID,
		InviteCode:  inviteCode,
		IsEncrypted: req.IsEncrypted,
		MaxMembers:  req.MaxMembers,
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now(),
	}
	db.GetDB().Create(&chat)

	// Add creator as member
	member := models.IncognitoMember{
		ID:       generateID(),
		ChatID:   chat.ID,
		UserID:   userID,
		Alias:    generateAlias(),
		JoinedAt: time.Now(),
	}
	db.GetDB().Create(&member)

	return c.Status(201).JSON(chat)
}

// POST /incognito/join
func JoinIncognitoChat(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		InviteCode string `json:"inviteCode"`
	}
	if err := c.BodyParser(&req); err != nil || req.InviteCode == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Invite code required"})
	}

	var chat models.IncognitoChat
	if err := db.GetDB().Where("invite_code = ?", req.InviteCode).First(&chat).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Chat not found"})
	}

	if chat.ExpiresAt != nil && chat.ExpiresAt.Before(time.Now()) {
		return c.Status(410).JSON(fiber.Map{"error": "Chat expired"})
	}

	// Check member count
	var count int64
	db.GetDB().Model(&models.IncognitoMember{}).Where("chat_id = ?", chat.ID).Count(&count)
	if int(count) >= chat.MaxMembers {
		return c.Status(400).JSON(fiber.Map{"error": "Chat is full"})
	}

	// Check if already member
	var existing models.IncognitoMember
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", chat.ID, userID).First(&existing).Error; err == nil {
		return c.JSON(chat) // already a member
	}

	member := models.IncognitoMember{
		ID:       generateID(),
		ChatID:   chat.ID,
		UserID:   userID,
		Alias:    generateAlias(),
		JoinedAt: time.Now(),
	}
	db.GetDB().Create(&member)

	db.GetDB().Model(&chat).Update("message_count", count+1)

	return c.JSON(chat)
}

// GET /incognito/chats
func GetIncognitoChats(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var chats []models.IncognitoChat
	db.GetDB().Where("id IN (SELECT chat_id FROM incognito_members WHERE user_id = ?)", userID).
		Order("created_at DESC").Find(&chats)

	return c.JSON(fiber.Map{"items": chats})
}

// DELETE /incognito/:id
func LeaveIncognitoChat(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("chat_id = ? AND user_id = ?", id, userID).Delete(&models.IncognitoMember{})

	return c.JSON(fiber.Map{"success": true})
}

func generateShortCode() string {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	result := make([]byte, 8)
	for i := range result {
		result[i] = chars[time.Now().UnixNano()%int64(len(chars))]
		time.Sleep(1)
	}
	return string(result)
}

func generateAlias() string {
	adjectives := []string{"Таинственный", "Неизвестный", "Скрытный", "Загадочный", "Странник", "Призрак", "Тень", "Фантом"}
	nouns := []string{"Волк", "Дракон", "Феникс", "Рыцарь", "Маг", "Ворон", "Лис", "Медведь"}
	a := adjectives[time.Now().UnixNano()%int64(len(adjectives))]
	n := nouns[time.Now().UnixNano()%int64(len(nouns))]
	return a + " " + n
}
