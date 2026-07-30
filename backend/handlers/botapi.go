package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm/clause"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// ─── Bot CRUD ──────────────────────────────────────────────────────────────

func CreateBot(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateBotRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if len(req.Name) < 2 || len(req.Name) > 64 {
		return c.Status(400).JSON(fiber.Map{"error": "Bot name must be 2-64 characters"})
	}

	// Generate username from name
	botUsername := strings.ToLower(strings.ReplaceAll(req.Name, " ", "_"))
	botUsername = strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '_' {
			return r
		}
		return -1
	}, botUsername)

	// Check uniqueness
	var existing models.Bot
	if result := db.GetDB().Where("username = ?", botUsername).First(&existing); result.Error == nil {
		botUsername += "_" + generateID()[:6]
	}

	bot := models.Bot{
		ID:          generateID(),
		Name:        req.Name,
		Username:    botUsername,
		Token:       generateID() + generateID(), // 64 char token
		OwnerID:     userID,
		Description: req.Description,
		Avatar:      req.Avatar,
		WebhookURL:  req.WebhookURL,
		IsActive:    true,
	}

	if err := db.GetDB().Create(&bot).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create bot"})
	}

	// Return with token (only time it's shown)
	type BotWithToken struct {
		models.Bot
		Token string `json:"token"`
	}
	return c.Status(201).JSON(BotWithToken{Bot: bot, Token: bot.Token})
}

func GetBots(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var bots []models.Bot
	db.GetDB().Where("owner_id = ?", userID).Find(&bots)

	return c.JSON(bots)
}

func GetBot(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	var bot models.Bot
	if result := db.GetDB().Preload("Commands").Where("id = ? AND owner_id = ?", botID, userID).First(&bot); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	return c.JSON(bot)
}

func UpdateBot(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	var req models.UpdateBotRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var bot models.Bot
	if result := db.GetDB().Where("id = ? AND owner_id = ?", botID, userID).First(&bot); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		if len(req.Name) < 2 || len(req.Name) > 64 {
			return c.Status(400).JSON(fiber.Map{"error": "Bot name must be 2-64 characters"})
		}
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.WebhookURL != "" {
		updates["webhook_url"] = req.WebhookURL
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if len(updates) > 0 {
		if result := db.GetDB().Model(&bot).Updates(updates); result.Error != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update bot"})
		}
	}

	db.GetDB().Preload("Commands").First(&bot, "id = ?", botID)
	return c.JSON(bot)
}

func DeleteBot(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	var bot models.Bot
	if result := db.GetDB().Where("id = ? AND owner_id = ?", botID, userID).First(&bot); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	db.GetDB().Where("bot_id = ?", botID).Delete(&models.BotCommand{})
	db.GetDB().Where("bot_id = ?", botID).Delete(&models.BotInstallation{})
	if result := db.GetDB().Delete(&bot); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete bot"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func RegenerateBotToken(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	var bot models.Bot
	if result := db.GetDB().Where("id = ? AND owner_id = ?", botID, userID).First(&bot); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	newToken := generateID() + generateID()
	if result := db.GetDB().Model(&bot).Update("token", newToken); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to regenerate token"})
	}

	return c.JSON(fiber.Map{"token": newToken})
}

// ─── Bot Commands ──────────────────────────────────────────────────────────

func AddBotCommand(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	var bot models.Bot
	if result := db.GetDB().Where("id = ? AND owner_id = ?", botID, userID).First(&bot); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	var req models.AddBotCommandRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if !strings.HasPrefix(req.Command, "/") {
		req.Command = "/" + req.Command
	}

	// Check uniqueness per bot
	var existing models.BotCommand
	if result := db.GetDB().Where("bot_id = ? AND command = ?", botID, req.Command).First(&existing); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Command already exists"})
	}

	cmd := models.BotCommand{
		ID:          generateID(),
		BotID:       botID,
		Command:     req.Command,
		Description: req.Description,
		Response:    req.Response,
		HandlerURL:  req.HandlerURL,
		IsActive:    true,
	}

	if err := db.GetDB().Create(&cmd).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create command"})
	}

	return c.Status(201).JSON(cmd)
}

func GetBotCommands(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	var bot models.Bot
	if result := db.GetDB().Where("id = ? AND owner_id = ?", botID, userID).First(&bot); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	var commands []models.BotCommand
	if result := db.GetDB().Where("bot_id = ?", botID).
		Clauses(clause.OrderBy{Columns: []clause.OrderByColumn{
			{Column: clause.Column{Name: "order"}},
		}}).
		Find(&commands); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load commands"})
	}

	return c.JSON(commands)
}

func DeleteBotCommand(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")
	cmdID := c.Params("cmdId")

	var bot models.Bot
	if result := db.GetDB().Where("id = ? AND owner_id = ?", botID, userID).First(&bot); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	if result := db.GetDB().Where("id = ? AND bot_id = ?", cmdID, botID).Delete(&models.BotCommand{}); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete command"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ─── Bot Install/Uninstall ────────────────────────────────────────────────

func InstallBot(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	var req struct {
		ChatID string `json:"chatId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var bot models.Bot
	if result := db.GetDB().First(&bot, "id = ?", botID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Bot not found"})
	}

	// Check user is member of chat
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", req.ChatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	// Check not already installed
	var existing models.BotInstallation
	if result := db.GetDB().Where("bot_id = ? AND chat_id = ?", botID, req.ChatID).First(&existing); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Bot already installed"})
	}

	installation := models.BotInstallation{
		ID:          generateID(),
		BotID:       botID,
		ChatID:      req.ChatID,
		InstalledBy: userID,
		IsActive:    true,
	}

	if err := db.GetDB().Create(&installation).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to install bot"})
	}

	// Send system message
	msg := models.Message{
		ID:      generateID(),
		ChatID:  req.ChatID,
		SenderID: bot.ID,
		Content: fmt.Sprintf("Бот %s добавлен в чат", bot.Name),
		Type:    "system",
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		// Log but don't fail the install - message is non-critical
		log.Printf("WARNING: Failed to create bot install message: %v", err)
	}
	wsMsg, _ := json.Marshal(map[string]interface{}{
		"type": "message:new",
		"message": map[string]interface{}{
			"id":        msg.ID,
			"chatId":    req.ChatID,
			"content":   bot.Name + " добавлен в чат",
			"type":      "system",
			"createdAt": time.Now().Format("2006-01-02T15:04:05Z07:00"),
		},
	})
	ws.HubInstance.SendToChat(req.ChatID, wsMsg, "")

	return c.Status(201).JSON(installation)
}

func UninstallBot(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	botID := c.Params("botId")

	// Verify bot ownership
	var bot models.Bot
	if result := db.GetDB().First(&bot, "id = ? AND owner_id = ?", botID, userID); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Bot not found or not owned by you"})
	}

	var req struct {
		ChatID string `json:"chatId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if result := db.GetDB().Where("bot_id = ? AND chat_id = ?", botID, req.ChatID).Delete(&models.BotInstallation{}); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to uninstall bot"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ─── Bot Messaging (authenticated with bot token) ─────────────────────────

func BotSendMessage(c *fiber.Ctx) error {
	botID := c.Locals("botId").(string)

	var req models.BotSendMessageRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Check bot is installed in chat
	var installation models.BotInstallation
	if result := db.GetDB().Where("bot_id = ? AND chat_id = ? AND is_active = ?", botID, req.ChatID, true).First(&installation); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Bot not installed in this chat"})
	}

	var bot models.Bot
	db.GetDB().First(&bot, "id = ?", botID)

	if req.Type == "" {
		req.Type = "text"
	}

	msg := models.Message{
		ID:       generateID(),
		ChatID:   req.ChatID,
		SenderID: botID,
		Content:  req.Content,
		Type:     req.Type,
	}
	if err := db.GetDB().Create(&msg).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send message"})
	}

	// Send via WS with bot info
	msgJSON, _ := json.Marshal(map[string]interface{}{
		"id":       msg.ID,
		"chatId":   msg.ChatID,
		"senderId": msg.SenderID,
		"content":  msg.Content,
		"type":     msg.Type,
		"sender": map[string]interface{}{
			"id":          bot.ID,
			"username":    bot.Username,
			"displayName": bot.Name,
			"avatar":      bot.Avatar,
		},
		"createdAt": msg.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	})
	ws.HubInstance.SendToChat(req.ChatID, mustWSMsg("message:new", "message", json.RawMessage(msgJSON)), "")

	return c.Status(201).JSON(msg)
}

func BotGetUpdates(c *fiber.Ctx) error {
	botID := c.Locals("botId").(string)

	// Get all chats where bot is installed
	var installations []models.BotInstallation
	db.GetDB().Where("bot_id = ? AND is_active = ?", botID, true).Find(&installations)

	if len(installations) == 0 {
		return c.JSON([]interface{}{})
	}

	chatIDs := make([]string, len(installations))
	for i, inst := range installations {
		chatIDs[i] = inst.ChatID
	}

	// Support pagination via offset parameter
	offset, _ := strconv.Atoi(c.Query("offset", "0"))
	if offset < 0 {
		offset = 0
	}
	limit := 100

	// Get recent messages from those chats (last 5 minutes)
	since := time.Now().Add(-5 * time.Minute)
	var messages []models.Message
	db.GetDB().
		Preload("Sender").
		Where("chat_id IN ? AND created_at > ? AND sender_id != ?", chatIDs, since, botID).
		Order("created_at ASC").
		Offset(offset).Limit(limit).
		Find(&messages)

	return c.JSON(messages)
}

func SetBotWebhook(c *fiber.Ctx) error {
	botID := c.Locals("botId").(string)

	var req models.SetWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.URL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "URL required"})
	}

	if result := db.GetDB().Model(&models.Bot{}).Where("id = ?", botID).Update("webhook_url", req.URL); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to set webhook"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func DeleteBotWebhook(c *fiber.Ctx) error {
	botID := c.Locals("botId").(string)
	if result := db.GetDB().Model(&models.Bot{}).Where("id = ?", botID).Update("webhook_url", ""); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete webhook"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

// ─── Helper: HMAC credentials for TURN ────────────────────────────────────

func GenerateTURNHMAC(secret, username string, ttl int) (string, string) {
	deadline := time.Now().Unix() + int64(ttl)
	user := fmt.Sprintf("%d:%s", deadline, username)
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(user))
	credential := hex.EncodeToString(mac.Sum(nil))
	return strconv.FormatInt(deadline, 10), credential
}
