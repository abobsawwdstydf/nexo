package handlers

import (
	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// GET /chats/:id/theme
func GetChatTheme(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var theme models.ChatTheme
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&theme).Error; err != nil {
		return c.JSON(fiber.Map{
			"backgroundColor": "",
			"bubbleColor":     "",
			"bubbleTextColor": "",
			"accentColor":     "",
			"backgroundImage": "",
		})
	}

	return c.JSON(theme)
}

// POST /chats/:id/theme
func SetChatTheme(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req models.SetChatThemeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var theme models.ChatTheme
	result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&theme)
	if result.Error != nil {
		theme = models.ChatTheme{
			ID:              generateID(),
			ChatID:          chatID,
			UserID:          userID,
			BackgroundImage: req.BackgroundImage,
			BackgroundColor: req.BackgroundColor,
			BubbleColor:     req.BubbleColor,
			BubbleTextColor: req.BubbleTextColor,
			AccentColor:     req.AccentColor,
		}
		db.GetDB().Create(&theme)
	} else {
		db.GetDB().Model(&theme).Updates(map[string]interface{}{
			"background_image": req.BackgroundImage,
			"background_color": req.BackgroundColor,
			"bubble_color":     req.BubbleColor,
			"bubble_text_color": req.BubbleTextColor,
			"accent_color":     req.AccentColor,
		})
	}

	return c.JSON(theme)
}

// DELETE /chats/:id/theme
func DeleteChatTheme(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).Delete(&models.ChatTheme{})

	return c.JSON(fiber.Map{"success": true})
}
