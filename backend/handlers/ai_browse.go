package handlers

import (
	"encoding/json"
	"unicode/utf8"

	"nexo/ai"
	"nexo/db"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"

	"github.com/gofiber/fiber/v2"
)

// Global concurrency limit for AI browse tasks — each task spawns its own
// headless browser, so unbounded goroutines exhausted CPU/RAM on the server.
var aiBrowseSlots = make(chan struct{}, 5)

// POST /ai/browse - start AI browsing task
func StartAIBrowse(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.AIBrowseRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	req.Query = trimSafely(req.Query, 2000)
	if req.Query == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Query is required"})
	}
	req.Context = trimSafely(req.Context, 10000)

	// Acquire a browser slot (non-blocking) to cap concurrent headless browsers
	select {
	case aiBrowseSlots <- struct{}{}:
	default:
		return c.Status(429).JSON(fiber.Map{"error": "Too many AI browse tasks running, try again later"})
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
	if err := db.GetDB().Create(&dbTask).Error; err != nil {
		logging.Log.Error("[AI] failed to persist browse task", "task_id", taskID, "err", err)
	}

	// Start background browsing
	go func() {
		defer func() {
			if r := recover(); r != nil {
				logging.Log.Error("[AI] panic in browse task", "task_id", taskID, "panic", r)
			}
			<-aiBrowseSlots
		}()
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
				msg, _ := json.Marshal(map[string]string{
					"type":   "ai:browse:complete",
					"taskId": taskID,
					"status": string(t.Status),
				})
				ws.HubInstance.SendToChat(req.ChatID, msg, userID)
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
	userID := c.Locals("userId").(string)

	task := ai.GlobalTaskManager.GetTask(taskID)
	if task == nil {
		// Try DB — scoped to the calling user so tasks cannot be read by ID guessing
		var dbTask models.AIBrowseTask
		if err := db.GetDB().Where("id = ? AND user_id = ?", taskID, userID).First(&dbTask).Error; err != nil {
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

	// Ownership check for in-memory tasks too
	if task.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Task not found"})
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

// trimSafely truncates s to at most maxLen characters (UTF-8 safe)
func trimSafely(s string, maxLen int) string {
	if s == "" || utf8.RuneCountInString(s) <= maxLen {
		return s
	}
	return string([]rune(s)[:maxLen])
}


