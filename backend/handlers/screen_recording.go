package handlers

import (
	"os"
	"path/filepath"
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /screen-recordings
func UploadScreenRecording(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	file, err := c.FormFile("video")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Video file required"})
	}

	// Save file
	filename := generateID() + ".webm"
	recDir := filepath.Join(UploadDir(), "recordings")
	os.MkdirAll(recDir, 0755)
	filepath := recDir + "/" + filename
	if err := c.SaveFile(file, filepath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save recording"})
	}

	recording := models.ScreenRecording{
		ID:        generateID(),
		UserID:    userID,
		ChatID:    c.Query("chatId"),
		URL:       "/uploads/recordings/" + filename,
		Size:      file.Size,
		CreatedAt: time.Now(),
	}
	if err := db.GetDB().Create(&recording).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save recording"})
	}

	return c.Status(201).JSON(recording)
}

// GET /screen-recordings
func GetScreenRecordings(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var recordings []models.ScreenRecording
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&recordings)

	return c.JSON(fiber.Map{"items": recordings})
}
