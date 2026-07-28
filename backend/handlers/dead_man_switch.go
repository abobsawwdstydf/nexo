package handlers

import (
	"encoding/json"
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /dead-man-switch
func CreateDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		InactivityDays  int      `json:"inactivityDays"`
		MessageTemplate string   `json:"messageTemplate"`
		RecipientIDs    []string `json:"recipientIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.InactivityDays <= 0 {
		req.InactivityDays = 30
	}

	// Convert recipient IDs to JSON string
	recipientJSON := "[]"
	if len(req.RecipientIDs) > 0 {
		b, _ := json.Marshal(req.RecipientIDs)
		recipientJSON = string(b)
	}

	switch_ := models.DeadManSwitch{
		ID:              generateID(),
		UserID:          userID,
		IsEnabled:       true,
		InactivityDays:  req.InactivityDays,
		LastCheckIn:     time.Now(),
		MessageTemplate: req.MessageTemplate,
		RecipientIDs:    recipientJSON,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	db.GetDB().Create(&switch_)

	return c.Status(201).JSON(switch_)
}

// GET /dead-man-switch
func GetDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var switch_ models.DeadManSwitch
	if err := db.GetDB().Where("user_id = ?", userID).First(&switch_).Error; err != nil {
		return c.JSON(fiber.Map{
			"isEnabled":      false,
			"inactivityDays": 30,
		})
	}

	return c.JSON(switch_)
}

// PUT /dead-man-switch
func UpdateDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		IsEnabled       *bool    `json:"isEnabled"`
		InactivityDays  *int     `json:"inactivityDays"`
		MessageTemplate *string  `json:"messageTemplate"`
		RecipientIDs    []string `json:"recipientIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}
	if req.IsEnabled != nil {
		updates["is_enabled"] = *req.IsEnabled
	}
	if req.InactivityDays != nil {
		updates["inactivity_days"] = *req.InactivityDays
	}
	if req.MessageTemplate != nil {
		updates["message_template"] = *req.MessageTemplate
	}
	if req.RecipientIDs != nil {
		b, _ := json.Marshal(req.RecipientIDs)
		updates["recipient_ids"] = string(b)
	}

	db.GetDB().Model(&models.DeadManSwitch{}).Where("user_id = ?", userID).Updates(updates)

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /dead-man-switch
func DeleteDeadManSwitch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	db.GetDB().Where("user_id = ?", userID).Delete(&models.DeadManSwitch{})
	return c.JSON(fiber.Map{"success": true})
}

// POST /dead-man-switch/check-in
func DeadManSwitchCheckIn(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	db.GetDB().Model(&models.DeadManSwitch{}).Where("user_id = ?", userID).Update("last_check_in", time.Now())

	return c.JSON(fiber.Map{"success": true})
}
