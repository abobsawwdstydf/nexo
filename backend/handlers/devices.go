package handlers

import (
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// GET /devices
func GetDevices(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var devices []models.UserSession
	db.GetDB().Where("user_id = ?", userID).Order("last_active DESC").Find(&devices)

	return c.JSON(fiber.Map{"items": devices})
}

// DELETE /devices/:id
func RevokeDevice(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("id = ? AND user_id = ?", id, userID).Delete(&models.UserSession{})

	return c.JSON(fiber.Map{"success": true})
}

// POST /devices/check-in
func DeviceCheckIn(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	deviceID := c.Get("X-Device-ID")
	deviceName := c.Get("X-Device-Name")
	platform := c.Get("X-Platform")
	browser := c.Get("X-Browser")
	ip := c.IP()

	if deviceID == "" {
		deviceID = generateID()
	}

	var session models.UserSession
	result := db.GetDB().Where("user_id = ? AND device_id = ?", userID, deviceID).First(&session)
	if result.Error != nil {
		session = models.UserSession{
			ID:         generateID(),
			UserID:     userID,
			DeviceID:   deviceID,
			DeviceName: deviceName,
			DeviceType: platform,
			Platform:   platform,
			Browser:    browser,
			IPAddress:  ip,
			IsActive:   true,
			LastActive: time.Now(),
			CreatedAt:  time.Now(),
		}
		if err := db.GetDB().Create(&session).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to register device"})
		}
	} else {
		if err := db.GetDB().Model(&session).Updates(map[string]interface{}{
			"last_active": time.Now(),
			"is_active":   true,
			"ip_address":  ip,
		}).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update device"})
		}
	}

	return c.JSON(fiber.Map{"success": true, "deviceId": deviceID})
}
