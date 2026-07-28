package handlers

import (
	"nexo/ai"
	"nexo/db"
	"nexo/models"
	"nexo/ws"

	"github.com/gofiber/fiber/v2"
)

// POST /ai/browse - start AI browsing task
func StartAIBrowse(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.AIBrowseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Query == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Query is required"})
	}

	// Create task
	taskID := generateID()
	ai.GlobalTaskManager.CreateTask(taskID, userID, req.ChatID, req.Query, req.Context)

	// Also create DB record
	dbTask := models.AIBrowseTask{
		ID:     taskID,
		UserID: userID,
		ChatID: req.ChatID,
		Query:  req.Query,
		Status: "pending",
	}
	db.GetDB().Create(&dbTask)

	// Start background browsing
	go func() {
		agent := ai.NewAgent()
		defer agent.Close()
		agent.Browse(taskID, req.Query, req.Context)

		// Update DB with result
		t := ai.GlobalTaskManager.GetTask(taskID)
		if t != nil {
			db.GetDB().Model(&models.AIBrowseTask{}).Where("id = ?", taskID).Updates(map[string]interface{}{
				"status":       string(t.Status),
				"result":       t.Result,
				"pages_viewed": t.PagesViewed,
				"error":        t.Error,
			})

			// Send WebSocket notification
			if ws.HubInstance != nil {
				ws.HubInstance.SendToChat(req.ChatID, []byte(`{"type":"ai:browse:complete","taskId":"`+taskID+`","status":"`+string(t.Status)+`"}`), userID)
			}
		}
	}()

	return c.JSON(fiber.Map{
		"taskId": taskID,
		"status": "pending",
	})
}

// GET /ai/browse/status/:id - get task status
func GetAIBrowseStatus(c *fiber.Ctx) error {
	taskID := c.Params("id")

	task := ai.GlobalTaskManager.GetTask(taskID)
	if task == nil {
		// Try DB
		var dbTask models.AIBrowseTask
		if err := db.GetDB().Where("id = ?", taskID).First(&dbTask).Error; err != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Task not found"})
		}
		return c.JSON(fiber.Map{
			"id":          dbTask.ID,
			"status":      dbTask.Status,
			"result":      dbTask.Result,
			"pagesViewed": dbTask.PagesViewed,
			"error":       dbTask.Error,
		})
	}

	return c.JSON(fiber.Map{
		"id":          task.ID,
		"status":      string(task.Status),
		"result":      task.Result,
		"sources":     task.Sources,
		"pagesViewed": task.PagesViewed,
		"error":       task.Error,
	})
}

// GET /ai/browse/history - browse history
func GetAIBrowseHistory(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var tasks []models.AIBrowseTask
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Limit(50).Find(&tasks)

	return c.JSON(fiber.Map{"items": tasks})
}
