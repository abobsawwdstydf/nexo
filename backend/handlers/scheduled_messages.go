package handlers

import (
	"nexo/db"
	"nexo/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

// POST /scheduled-messages
func CreateScheduledMessage(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateScheduledMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Content == "" || req.ChatID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Content and chatId required"})
	}

	scheduleAt, err := time.Parse(time.RFC3339, req.ScheduleAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid scheduleAt"})
	}

	msg := models.ScheduledMessage{
		ID:         generateID(),
		UserID:     userID,
		ChatID:     req.ChatID,
		Content:    req.Content,
		Type:       req.Type,
		MediaURL:   req.MediaURL,
		ScheduleAt: scheduleAt,
		Repeat:     req.Repeat,
		CreatedAt:  time.Now(),
	}
	db.GetDB().Create(&msg)

	return c.Status(201).JSON(msg)
}

// GET /scheduled-messages
func GetScheduledMessages(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var msgs []models.ScheduledMessage
	db.GetDB().Where("user_id = ? AND is_sent = false", userID).Order("schedule_at ASC").Find(&msgs)

	return c.JSON(fiber.Map{"items": msgs})
}

// PUT /scheduled-messages/:id
func EditScheduledMessage(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Content    string `json:"content"`
		ScheduleAt string `json:"scheduleAt"`
		Repeat     string `json:"repeat"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.ScheduleAt != "" {
		if t, err := time.Parse(time.RFC3339, req.ScheduleAt); err == nil {
			updates["schedule_at"] = t
		}
	}
	if req.Repeat != "" {
		updates["repeat"] = req.Repeat
	}

	db.GetDB().Model(&models.ScheduledMessage{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates)

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /scheduled-messages/:id
func CancelScheduledMessage(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("id = ? AND user_id = ?", id, userID).Delete(&models.ScheduledMessage{})

	return c.JSON(fiber.Map{"success": true})
}
