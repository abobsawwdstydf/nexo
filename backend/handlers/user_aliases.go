package handlers

import (
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

const maxUserAliases = 10
const maxChatAliases = 5
const maxBotAliases = 5

// GetUserAliases returns all aliases for the authenticated user's account
func GetUserAliases(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var aliases []models.UsernameAlias
	db.GetDB().Where("subject_type = ? AND subject_id = ?", "user", userID).
		Order("created_at ASC").Find(&aliases)

	return c.JSON(aliases)
}

// CreateUserAlias creates a new username alias for the current user
func CreateUserAlias(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		Alias string `json:"alias"`
	}
	if err := c.BodyParser(&req); err != nil || req.Alias == "" {
		return c.Status(400).JSON(fiber.Map{"error": "alias is required"})
	}
	req.Alias = strings.TrimSpace(req.Alias)

	// Validate format
	if !usernameRegex.MatchString(req.Alias) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid username format"})
	}

	// Check reserved
	if reserved, reason := isUsernameReserved(req.Alias); reserved {
		return c.Status(409).JSON(fiber.Map{"error": reason})
	}

	// Check if taken by a regular user (non-alias)
	var existing models.User
	if result := db.GetDB().Where("username = ?", req.Alias).First(&existing); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Username already taken"})
	}

	// Check if taken by a bot
	var existingBot models.Bot
	if result := db.GetDB().Where("username = ?", req.Alias).First(&existingBot); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Username already taken"})
	}

	// Check if already exists as alias
	var existingAlias models.UsernameAlias
	if result := db.GetDB().Where("alias = ?", req.Alias).First(&existingAlias); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Username already taken"})
	}

	// Count existing aliases
	var count int64
	db.GetDB().Model(&models.UsernameAlias{}).
		Where("subject_type = ? AND subject_id = ?", "user", userID).Count(&count)

	// Premium check
	var user models.User
	db.GetDB().First(&user, "id = ?", userID)
	if !user.IsPremium {
		return c.Status(403).JSON(fiber.Map{"error": "Premium required for additional usernames"})
	}

	if int(count) >= maxUserAliases {
		return c.Status(400).JSON(fiber.Map{"error": "Maximum aliases reached (" + string(rune('0'+count)) + ")"})
	}

	now := time.Now()
	alias := models.UsernameAlias{
		ID:          generateID(),
		SubjectType: "user",
		SubjectID:   userID,
		Alias:       req.Alias,
		IsValid:     true,
		CreatedAt:   now,
	}

	if err := db.GetDB().Create(&alias).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create alias"})
	}

	return c.Status(201).JSON(alias)
}

// DeleteUserAlias deletes a username alias
func DeleteUserAlias(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	aliasID := c.Params("aliasId")

	result := db.GetDB().Delete(&models.UsernameAlias{}, "id = ? AND subject_type = ? AND subject_id = ?", aliasID, "user", userID)
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Alias not found"})
	}

	return c.JSON(fiber.Map{"ok": true})
}
