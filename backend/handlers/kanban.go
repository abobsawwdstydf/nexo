package handlers

import (
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
)

// POST /kanban
func CreateKanbanBoard(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateKanbanBoardRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	chatID := c.Query("chatId")
	if chatID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId required"})
	}

	board := models.KanbanBoard{
		ID:        generateID(),
		ChatID:    chatID,
		Name:      req.Name,
		CreatorID: userID,
	}
	db.GetDB().Create(&board)

	// Create default columns
	defaultColumns := []models.KanbanColumn{
		{ID: generateID(), BoardID: board.ID, Name: "В работе", Order: 0, Color: "#3b82f6"},
		{ID: generateID(), BoardID: board.ID, Name: "На проверке", Order: 1, Color: "#f59e0b"},
		{ID: generateID(), BoardID: board.ID, Name: "Готово", Order: 2, Color: "#10b981"},
	}
	for i := range defaultColumns {
		db.GetDB().Create(&defaultColumns[i])
	}

	return c.Status(201).JSON(board)
}

// GET /kanban
func GetKanbanBoards(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var boards []models.KanbanBoard
	db.GetDB().Where("chat_id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)", userID).
		Preload("Columns").Preload("Columns.Tasks").Find(&boards)

	return c.JSON(fiber.Map{"items": boards})
}

// GET /kanban/:boardId
func GetKanbanBoard(c *fiber.Ctx) error {
	boardID := c.Params("boardId")

	var board models.KanbanBoard
	if err := db.GetDB().Where("id = ?", boardID).
		Preload("Columns", func(db *gorm.DB) *gorm.DB { return db.Order("`order` ASC") }).
		Preload("Columns.Tasks", func(db *gorm.DB) *gorm.DB { return db.Order("`order` ASC") }).
		First(&board).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Board not found"})
	}

	return c.JSON(board)
}

// POST /kanban/:boardId/tasks
func CreateKanbanTask(c *fiber.Ctx) error {
	boardID := c.Params("boardId")

	var req models.CreateKanbanTaskRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Find first column of the board
	var column models.KanbanColumn
	if err := db.GetDB().Where("board_id = ?", boardID).Order("`order` ASC").First(&column).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No columns in board"})
	}

	deadline, _ := time.Parse(time.RFC3339, req.Deadline)

	task := models.KanbanTask{
		ID:          generateID(),
		ColumnID:    column.ID,
		BoardID:     boardID,
		Title:       req.Title,
		Description: req.Description,
		AssigneeID:  req.AssigneeID,
		Priority:    req.Priority,
		Deadline:    &deadline,
		Labels:      "[]",
	}
	db.GetDB().Create(&task)

	return c.Status(201).JSON(task)
}

// PUT /kanban/tasks/:taskId
func UpdateKanbanTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")

	var req struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		ColumnID    string `json:"columnId"`
		Priority    string `json:"priority"`
		AssigneeID  string `json:"assigneeId"`
		Order       int    `json:"order"`
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
	if req.ColumnID != "" {
		updates["column_id"] = req.ColumnID
	}
	if req.Priority != "" {
		updates["priority"] = req.Priority
	}
	if req.AssigneeID != "" {
		updates["assignee_id"] = req.AssigneeID
	}
	updates["order"] = req.Order

	db.GetDB().Model(&models.KanbanTask{}).Where("id = ?", taskID).Updates(updates)

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /kanban/tasks/:taskId
func DeleteKanbanTask(c *fiber.Ctx) error {
	taskID := c.Params("taskId")
	db.GetDB().Where("id = ?", taskID).Delete(&models.KanbanTask{})
	return c.JSON(fiber.Map{"success": true})
}

// PUT /kanban/:boardId/reorder
func ReorderKanbanBoard(c *fiber.Ctx) error {
	boardID := c.Params("boardId")

	var req struct {
		Tasks []struct {
			ID       string `json:"id"`
			ColumnID string `json:"columnId"`
			Order    int    `json:"order"`
		} `json:"tasks"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	for _, t := range req.Tasks {
		db.GetDB().Model(&models.KanbanTask{}).Where("id = ?", t.ID).Updates(map[string]interface{}{
			"column_id": t.ColumnID,
			"order":     t.Order,
		})
	}

	_ = boardID
	return c.JSON(fiber.Map{"success": true})
}
