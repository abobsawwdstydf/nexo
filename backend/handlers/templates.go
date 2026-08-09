package handlers

import (
	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /templates
func CreateTemplate(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Name == "" || req.Content == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name and content required"})
	}

	template := models.MessageTemplate{
		ID:       generateID(),
		UserID:   userID,
		Name:     req.Name,
		Content:  req.Content,
		Shortcut: req.Shortcut,
		Category: req.Category,
	}
	if err := db.GetDB().Create(&template).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save template"})
	}

	return c.Status(201).JSON(template)
}

// GET /templates
func GetTemplates(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var templates []models.MessageTemplate
	db.GetDB().Where("user_id = ?", userID).Order("usage_count DESC").Find(&templates)

	return c.JSON(fiber.Map{"items": templates})
}

// PUT /templates/:id
func UpdateTemplate(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req models.CreateTemplateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	db.GetDB().Model(&models.MessageTemplate{}).Where("id = ? AND user_id = ?", id, userID).Updates(map[string]interface{}{
		"name":     req.Name,
		"content":  req.Content,
		"shortcut": req.Shortcut,
		"category": req.Category,
	})

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /templates/:id
func DeleteTemplate(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("id = ? AND user_id = ?", id, userID).Delete(&models.MessageTemplate{})

	return c.JSON(fiber.Map{"success": true})
}
