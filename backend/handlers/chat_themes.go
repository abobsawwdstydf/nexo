package handlers

import (
	"regexp"
	"strings"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

var (
	safeColorRe   = regexp.MustCompile(`^#[0-9a-fA-F]{3,8}$`)
	safeURLRe     = regexp.MustCompile(`^https?://[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(/[^\s"<>]*)?$`)
	allowedCSSRe  = regexp.MustCompile(`^[a-zA-Z\s#(),.%0-9-]+$`)
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

	// Sanitize and validate theme values
	bgImage := sanitizeThemeURL(req.BackgroundImage)
	bgColor := sanitizeThemeColor(req.BackgroundColor)
	bubbleColor := sanitizeThemeColor(req.BubbleColor)
	bubbleTextColor := sanitizeThemeColor(req.BubbleTextColor)
	accentColor := sanitizeThemeColor(req.AccentColor)

	var theme models.ChatTheme
	result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&theme)
	if result.Error != nil {
		theme = models.ChatTheme{
			ID:              generateID(),
			ChatID:          chatID,
			UserID:          userID,
			BackgroundImage: bgImage,
			BackgroundColor: bgColor,
			BubbleColor:     bubbleColor,
			BubbleTextColor: bubbleTextColor,
			AccentColor:     accentColor,
		}
		if err := db.GetDB().Create(&theme).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save theme"})
		}
	} else {
		if err := db.GetDB().Model(&theme).Updates(map[string]interface{}{
			"background_image":  bgImage,
			"background_color":  bgColor,
			"bubble_color":      bubbleColor,
			"bubble_text_color": bubbleTextColor,
			"accent_color":      accentColor,
		}).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to save theme"})
		}
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

func sanitizeThemeURL(val string) string {
	val = strings.TrimSpace(val)
	if val == "" {
		return val
	}
	if safeURLRe.MatchString(val) {
		return val
	}
	return ""
}

func sanitizeThemeColor(val string) string {
	val = strings.TrimSpace(val)
	if val == "" {
		return val
	}
	if safeColorRe.MatchString(val) || allowedCSSRe.MatchString(val) {
		return val
	}
	return ""
}
