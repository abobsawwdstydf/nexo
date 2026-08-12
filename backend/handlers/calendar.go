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

	startTime, err := time.Parse(time.RFC3339, req.StartTime)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid startTime, use RFC3339 format"})
	}
	endTime, err := time.Parse(time.RFC3339, req.EndTime)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid endTime, use RFC3339 format"})
	}
	if !endTime.IsZero() && endTime.Before(startTime) {
		return c.Status(400).JSON(fiber.Map{"error": "endTime must be after startTime"})
	}

	// SECURITY: events may only be attached to chats the user belongs to
	chatID := c.Query("chatId")
	if chatID != "" && !isChatMember(chatID, userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	event := models.CalendarEvent{
		ID:          generateID(),
		UserID:      userID,
		ChatID:      chatID,
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
	if err := db.GetDB().Create(&event).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create event"})
	}

	// Create invites — SECURITY: only friends or members of a shared chat may
	// be invited, otherwise any user could spam event invites to strangers.
	for _, inviteID := range req.InviteIDs {
		if inviteID == userID {
			continue
		}
		var sharedChat int64
		db.GetDB().Model(&models.ChatMember{}).
			Where("user_id = ? AND chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)", inviteID, userID).
			Count(&sharedChat)
		var friendship int64
		db.GetDB().Model(&models.Friendship{}).
			Where("((user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)) AND status = ?",
				userID, inviteID, inviteID, userID, "accepted").
			Count(&friendship)
		if sharedChat == 0 && friendship == 0 {
			return c.Status(403).JSON(fiber.Map{"error": "Cannot invite this user (not a friend and no shared chat)"})
		}

		invite := models.CalendarEventInvite{
			ID:        generateID(),
			EventID:   event.ID,
			UserID:    inviteID,
			Status:    "pending",
			CreatedAt: time.Now(),
		}
		if err := db.GetDB().Create(&invite).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create event invites"})
		}
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

	if req.Status != "accepted" && req.Status != "declined" {
		return c.Status(400).JSON(fiber.Map{"error": "Status must be accepted or declined"})
	}

	result := db.GetDB().Model(&models.CalendarEventInvite{}).
		Where("event_id = ? AND user_id = ?", id, userID).
		Update("status", req.Status)
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update RSVP"})
	}
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Invite not found"})
	}

	return c.JSON(fiber.Map{"success": true})
}
