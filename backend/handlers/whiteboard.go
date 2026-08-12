package handlers

import (
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// POST /whiteboard
func CreateWhiteboard(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		ChatID string `json:"chatId"`
		Name   string `json:"name"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// SECURITY: only chat members may create boards, and only in their own chats
	if req.ChatID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId required"})
	}
	if !isChatMember(req.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	wb := models.Whiteboard{
		ID:        generateID(),
		ChatID:    req.ChatID,
		Name:      req.Name,
		CreatorID: userID,
		Data:      "{}",
		Version:   1,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := db.GetDB().Create(&wb).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create whiteboard"})
	}

	return c.Status(201).JSON(wb)
}

// GET /whiteboard/:id
func GetWhiteboard(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var wb models.Whiteboard
	if err := db.GetDB().Where("id = ?", id).First(&wb).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Whiteboard not found"})
	}

	// SECURITY: only chat members may read a board
	if !isChatMember(wb.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	return c.JSON(wb)
}

// PUT /whiteboard/:id
func UpdateWhiteboard(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Data string `json:"data"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var wb models.Whiteboard
	if err := db.GetDB().Where("id = ?", id).First(&wb).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Whiteboard not found"})
	}

	// SECURITY: only chat members may edit a board
	if !isChatMember(wb.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	db.GetDB().Model(&models.Whiteboard{}).Where("id = ?", id).Updates(map[string]interface{}{
		"data":       req.Data,
		"version":    gorm.Expr("version + 1"),
		"updated_at": time.Now(),
	})

	return c.JSON(fiber.Map{"success": true})
}

// POST /whiteboard/:id/edit
func ApplyWhiteboardEdit(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Operation string `json:"operation"` // JSON operation
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var wb models.Whiteboard
	if err := db.GetDB().Where("id = ?", id).First(&wb).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Whiteboard not found"})
	}

	// SECURITY: only chat members may apply edits
	if !isChatMember(wb.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	edit := models.WhiteboardEdit{
		ID:           generateID(),
		WhiteboardID: id,
		UserID:       userID,
		Operation:    req.Operation,
		Version:      wb.Version + 1,
		CreatedAt:    time.Now(),
	}
	if err := db.GetDB().Create(&edit).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save edit"})
	}

	db.GetDB().Model(&wb).Updates(map[string]interface{}{
		"version":    wb.Version + 1,
		"updated_at": time.Now(),
	})

	return c.JSON(fiber.Map{"success": true, "version": wb.Version + 1})
}

// DELETE /whiteboard/:id
func DeleteWhiteboard(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var wb models.Whiteboard
	if err := db.GetDB().Where("id = ?", id).First(&wb).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Whiteboard not found"})
	}

	// SECURITY: creator (or a chat member with owner role) may delete.
	// At minimum: only members of the board's chat.
	if !isChatMember(wb.ChatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	db.GetDB().Where("id = ? AND creator_id = ?", id, userID).Delete(&models.Whiteboard{})
	db.GetDB().Where("whiteboard_id = ?", id).Delete(&models.WhiteboardEdit{})

	return c.JSON(fiber.Map{"success": true})
}
