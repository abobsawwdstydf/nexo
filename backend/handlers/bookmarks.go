package handlers

import (
	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /bookmarks
func CreateBookmark(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateBookmarkRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.MessageID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "messageId required"})
	}

	// Get chatId from message
	var msg models.Message
	if err := db.GetDB().Where("id = ?", req.MessageID).First(&msg).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Message not found"})
	}

	bookmark := models.MessageBookmark{
		ID:        generateID(),
		UserID:    userID,
		MessageID: req.MessageID,
		ChatID:    msg.ChatID,
		Note:      req.Note,
		Tags:      req.Tags,
	}
	db.GetDB().Create(&bookmark)

	return c.Status(201).JSON(bookmark)
}

// GET /bookmarks
func GetBookmarks(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var bookmarks []models.MessageBookmark
	db.GetDB().Where("user_id = ?", userID).Preload("Message").Preload("Chat").Order("created_at DESC").Find(&bookmarks)

	return c.JSON(fiber.Map{"items": bookmarks})
}

// PUT /bookmarks/:id
func UpdateBookmark(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Note string `json:"note"`
		Tags string `json:"tags"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{}
	if req.Note != "" {
		updates["note"] = req.Note
	}
	if req.Tags != "" {
		updates["tags"] = req.Tags
	}

	db.GetDB().Model(&models.MessageBookmark{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates)

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /bookmarks/:id
func DeleteBookmark(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("id = ? AND user_id = ?", id, userID).Delete(&models.MessageBookmark{})

	return c.JSON(fiber.Map{"success": true})
}
