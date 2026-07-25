package handlers

import (
	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

func GetPrivacySettings(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{
		"whoCanMessage":     user.WhoCanMessage,
		"whoCanCall":        user.WhoCanCall,
		"whoCanSeeProfile":  user.WhoCanSeeProfile,
		"showLastSeen":      user.ShowLastSeen,
		"allowGroupInvites": user.AllowGroupInvites,
	})
}

func UpdatePrivacySettings(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.PrivacySettingsRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updates := map[string]interface{}{}

	if req.WhoCanMessage != "" {
		if req.WhoCanMessage == "everyone" || req.WhoCanMessage == "friends" || req.WhoCanMessage == "nobody" {
			updates["who_can_message"] = req.WhoCanMessage
		}
	}
	if req.WhoCanCall != "" {
		if req.WhoCanCall == "everyone" || req.WhoCanCall == "friends" || req.WhoCanCall == "nobody" {
			updates["who_can_call"] = req.WhoCanCall
		}
	}
	if req.WhoCanSeeProfile != "" {
		if req.WhoCanSeeProfile == "everyone" || req.WhoCanSeeProfile == "friends" {
			updates["who_can_see_profile"] = req.WhoCanSeeProfile
		}
	}
	if req.ShowLastSeen != nil {
		updates["show_last_seen"] = *req.ShowLastSeen
	}
	if req.AllowGroupInvites != nil {
		updates["allow_group_invites"] = *req.AllowGroupInvites
	}

	if len(updates) > 0 {
		if result := db.GetDB().Model(&models.User{}).Where("id = ?", userID).Updates(updates); result.Error != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update privacy settings"})
		}
	}

	var user models.User
	db.GetDB().First(&user, "id = ?", userID)

	return c.JSON(fiber.Map{
		"whoCanMessage":     user.WhoCanMessage,
		"whoCanCall":        user.WhoCanCall,
		"whoCanSeeProfile":  user.WhoCanSeeProfile,
		"showLastSeen":      user.ShowLastSeen,
		"allowGroupInvites": user.AllowGroupInvites,
	})
}
