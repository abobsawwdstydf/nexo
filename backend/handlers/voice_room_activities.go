package handlers

import (
	"net/url"
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /voice-rooms/:roomId/activity
func StartVoiceRoomActivity(c *fiber.Ctx) error {
	roomID := c.Params("roomId")
	userID := c.Locals("userId").(string)

	var req struct {
		Type  string `json:"type"` // watch_party, game, music
		URL   string `json:"url"`
		Title string `json:"title"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.URL != "" {
		parsedURL, err := url.Parse(req.URL)
		if err != nil || parsedURL.Scheme != "https" {
			return c.Status(400).JSON(fiber.Map{"error": "URL must use HTTPS"})
		}
	}

	// Stop existing activity
	db.GetDB().Model(&models.VoiceRoomActivity{}).Where("room_id = ? AND is_active = true", roomID).Update("is_active", false)

	activity := models.VoiceRoomActivity{
		ID:        generateID(),
		RoomID:    roomID,
		Type:      req.Type,
		URL:       req.URL,
		Title:     req.Title,
		IsActive:  true,
		StartedBy: userID,
		CreatedAt: time.Now(),
	}
	if err := db.GetDB().Create(&activity).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to start activity"})
	}

	return c.Status(201).JSON(activity)
}

// DELETE /voice-rooms/:roomId/activity
func StopVoiceRoomActivity(c *fiber.Ctx) error {
	roomID := c.Params("roomId")

	db.GetDB().Model(&models.VoiceRoomActivity{}).Where("room_id = ? AND is_active = true", roomID).Update("is_active", false)

	return c.JSON(fiber.Map{"success": true})
}

// GET /voice-rooms/:roomId/activity
func GetVoiceRoomActivity(c *fiber.Ctx) error {
	roomID := c.Params("roomId")

	var activity models.VoiceRoomActivity
	if err := db.GetDB().Where("room_id = ? AND is_active = true", roomID).First(&activity).Error; err != nil {
		return c.JSON(fiber.Map{"active": false})
	}

	return c.JSON(activity)
}
