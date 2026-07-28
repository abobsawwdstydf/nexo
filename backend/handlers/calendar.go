package handlers

import (
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /calendar/events
func CreateCalendarEvent(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateEventRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	startTime, _ := time.Parse(time.RFC3339, req.StartTime)
	endTime, _ := time.Parse(time.RFC3339, req.EndTime)

	event := models.CalendarEvent{
		ID:          generateID(),
		UserID:      userID,
		ChatID:      c.Query("chatId"),
		Title:       req.Title,
		Description: req.Description,
		Location:    req.Location,
		StartTime:   startTime,
		EndTime:     endTime,
		IsAllDay:    req.IsAllDay,
		Reminder:    req.Reminder,
		Recurrence:  req.Recurrence,
		CreatedAt:   time.Now(),
	}
	db.GetDB().Create(&event)

	// Create invites
	for _, inviteID := range req.InviteIDs {
		invite := models.CalendarEventInvite{
			ID:        generateID(),
			EventID:   event.ID,
			UserID:    inviteID,
			Status:    "pending",
			CreatedAt: time.Now(),
		}
		db.GetDB().Create(&invite)
	}

	return c.Status(201).JSON(event)
}

// GET /calendar/events
func GetCalendarEvents(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var events []models.CalendarEvent
	db.GetDB().Where("user_id = ? OR id IN (SELECT event_id FROM calendar_event_invites WHERE user_id = ?)", userID, userID).
		Order("start_time ASC").Find(&events)

	return c.JSON(fiber.Map{"items": events})
}

// PUT /calendar/events/:id
func UpdateCalendarEvent(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		StartTime   string `json:"startTime"`
		EndTime     string `json:"endTime"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	updates := map[string]interface{}{}
	if req.Title != "" {
		updates["title"] = req.Title
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}

	db.GetDB().Model(&models.CalendarEvent{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates)

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /calendar/events/:id
func DeleteCalendarEvent(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("id = ? AND user_id = ?", id, userID).Delete(&models.CalendarEvent{})
	db.GetDB().Where("event_id = ?", id).Delete(&models.CalendarEventInvite{})

	return c.JSON(fiber.Map{"success": true})
}

// POST /calendar/events/:id/rsvp
func RSVPEvent(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Status string `json:"status"` // accepted, declined
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	db.GetDB().Model(&models.CalendarEventInvite{}).Where("event_id = ? AND user_id = ?", id, userID).
		Update("status", req.Status)

	return c.JSON(fiber.Map{"success": true})
}
