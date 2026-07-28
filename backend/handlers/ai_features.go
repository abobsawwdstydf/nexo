package handlers

import (
	"nexo/ai"
	"nexo/db"
	"nexo/models"
	"time"

	"github.com/gofiber/fiber/v2"
)

// POST /ai/translate
func TranslateMessage(c *fiber.Ctx) error {
	var req models.TranslateRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Text == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Text is required"})
	}
	if req.TargetLang == "" {
		req.TargetLang = "en"
	}

	agent := ai.NewAgent()
	defer agent.Close()

	translated, sourceLang, err := agent.TranslateMessage(req.Text, req.TargetLang)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Translation failed"})
	}

	// Log translation
	userID := c.Locals("userId").(string)
	log := models.TranslationLog{
		ID:           generateID(),
		UserID:       userID,
		MessageID:    req.MessageID,
		SourceLang:   sourceLang,
		TargetLang:   req.TargetLang,
		OriginalText: req.Text,
		Translated:   translated,
		CreatedAt:    time.Now(),
	}
	db.GetDB().Create(&log)

	return c.JSON(fiber.Map{
		"translated": translated,
		"sourceLang": sourceLang,
		"targetLang": req.TargetLang,
	})
}

// POST /ai/moderate
func ModerateContent(c *fiber.Ctx) error {
	var req struct {
		Text string `json:"text"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Text == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Text is required"})
	}

	agent := ai.NewAgent()
	defer agent.Close()

	verdict, score, reason, err := agent.ModerateContent(req.Text)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Moderation failed"})
	}

	return c.JSON(fiber.Map{
		"verdict": verdict,
		"score":   score,
		"reason":  reason,
	})
}

// GET /ai/moderation/config/:chatId
func GetModerationConfig(c *fiber.Ctx) error {
	chatID := c.Params("chatId")

	var config models.ModerationConfig
	if err := db.GetDB().Where("chat_id = ?", chatID).First(&config).Error; err != nil {
		// Return default config
		return c.JSON(fiber.Map{
			"chatId":         chatID,
			"autoModEnabled": false,
			"spamThreshold":  0.8,
			"toxicThreshold": 0.7,
			"nsfwThreshold":  0.9,
			"action":         "warn",
		})
	}

	return c.JSON(config)
}

// PUT /ai/moderation/config/:chatId
func SetModerationConfig(c *fiber.Ctx) error {
	chatID := c.Params("chatId")
	userID := c.Locals("userId").(string)

	var req struct {
		AutoModEnabled bool    `json:"autoModEnabled"`
		SpamThreshold  float64 `json:"spamThreshold"`
		ToxicThreshold float64 `json:"toxicThreshold"`
		NSFWThreshold  float64 `json:"nsfwThreshold"`
		Action         string  `json:"action"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var config models.ModerationConfig
	result := db.GetDB().Where("chat_id = ?", chatID).First(&config)
	if result.Error != nil {
		config = models.ModerationConfig{
			ID:             generateID(),
			ChatID:         chatID,
			AutoModEnabled: req.AutoModEnabled,
			SpamThreshold:  req.SpamThreshold,
			ToxicThreshold: req.ToxicThreshold,
			NSFWThreshold:  req.NSFWThreshold,
			Action:         req.Action,
		}
		db.GetDB().Create(&config)
	} else {
		db.GetDB().Model(&config).Updates(map[string]interface{}{
			"auto_mod_enabled": req.AutoModEnabled,
			"spam_threshold":   req.SpamThreshold,
			"toxic_threshold":  req.ToxicThreshold,
			"nsfw_threshold":   req.NSFWThreshold,
			"action":           req.Action,
		})
	}

	_ = userID
	return c.JSON(config)
}

// POST /ai/auto-reply/config
func SetAutoReplyConfig(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.AutoReplyConfig
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var existing models.AutoReplyConfig
	result := db.GetDB().Where("user_id = ?", userID).First(&existing)
	if result.Error != nil {
		req.ID = generateID()
		req.UserID = userID
		req.CreatedAt = time.Now()
		req.UpdatedAt = time.Now()
		db.GetDB().Create(&req)
	} else {
		db.GetDB().Model(&existing).Updates(map[string]interface{}{
			"is_enabled":   req.IsEnabled,
			"persona":      req.Persona,
			"max_replies":  req.MaxReplies,
			"reply_delay":  req.ReplyDelay,
			"active_chats": req.ActiveChats,
			"updated_at":   time.Now(),
		})
		existing = req
		existing.ID = existing.ID
	}

	return c.JSON(existing)
}

// GET /ai/auto-reply/config
func GetAutoReplyConfig(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var config models.AutoReplyConfig
	if err := db.GetDB().Where("user_id = ?", userID).First(&config).Error; err != nil {
		return c.JSON(fiber.Map{
			"isEnabled":  false,
			"persona":    "",
			"maxReplies": 10,
			"replyDelay": 30,
		})
	}

	return c.JSON(config)
}

// POST /ai/voice-command
func ProcessVoiceCommand(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	// Parse audio file from form
	file, err := c.FormFile("audio")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Audio file required"})
	}

	// Save audio temporarily
	tempPath := "/tmp/voice_cmd_" + generateID() + ".webm"
	if err := c.SaveFile(file, tempPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save audio"})
	}

	// For now, we'll use a simple text fallback since Whisper requires additional setup
	// In production, integrate with OpenAI Whisper API
	agent := ai.NewAgent()
	defer agent.Close()

	response, err := agent.AnswerQuestion("Voice command received", "Обработай голосовую команду")
	if err != nil {
		response = "Голосовая команда получена"
	}

	// Log command
	log := models.VoiceCommand{
		ID:        generateID(),
		UserID:    userID,
		Command:   "voice",
		Transcript: "voice_command",
		Response:  response,
		Executed:  true,
		CreatedAt: time.Now(),
	}
	db.GetDB().Create(&log)

	return c.JSON(fiber.Map{
		"command":  "voice",
		"response": response,
		"executed": true,
	})
}

// POST /ai/smart-reminder
func CreateSmartReminder(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		ChatID      string `json:"chatId"`
		MessageID   string `json:"messageId"`
		RemindAt    string `json:"remindAt"`
		TriggerText string `json:"triggerText"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	remindAt, err := time.Parse(time.RFC3339, req.RemindAt)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid remindAt format"})
	}

	reminder := models.SmartReminder{
		ID:          generateID(),
		UserID:      userID,
		ChatID:      req.ChatID,
		MessageID:   req.MessageID,
		TriggerText: req.TriggerText,
		RemindAt:    remindAt,
		CreatedBy:   "user",
		CreatedAt:   time.Now(),
	}
	db.GetDB().Create(&reminder)

	return c.Status(201).JSON(reminder)
}

// GET /ai/smart-reminders
func GetSmartReminders(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var reminders []models.SmartReminder
	db.GetDB().Where("user_id = ? AND is_completed = false", userID).Order("remind_at ASC").Find(&reminders)

	return c.JSON(fiber.Map{"items": reminders})
}

// POST /ai/privacy-audit
func RunPrivacyAudit(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if err := db.GetDB().Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	var issues []models.PrivacyAudit

	// Check privacy settings
	if user.WhoCanMessage == "everyone" {
		issues = append(issues, models.PrivacyAudit{
			ID:         generateID(),
			UserID:     userID,
			Category:   "profile",
			Issue:      "Ваш профиль доступен всем пользователям",
			Severity:   "medium",
			Suggestion: "Ограничьте видимость профиля для друзей",
			CreatedAt:  time.Now(),
		})
	}

	if user.ShowLastSeen {
		issues = append(issues, models.PrivacyAudit{
			ID:         generateID(),
			UserID:     userID,
			Category:   "profile",
			Issue:      "Время последнего входа видно всем",
			Severity:   "low",
			Suggestion: "Скрыть время последнего входа от не-друзей",
			CreatedAt:  time.Now(),
		})
	}

	if !user.TwoFactorEnabled {
		issues = append(issues, models.PrivacyAudit{
			ID:         generateID(),
			UserID:     userID,
			Category:   "security",
			Issue:      "Двухфакторная аутентификация не включена",
			Severity:   "high",
			Suggestion: "Включите 2FA для дополнительной защиты аккаунта",
			CreatedAt:  time.Now(),
		})
	}

	// Check for secret chats
	var secretChats int64
	db.GetDB().Model(&models.Chat{}).Where("is_secret = true AND id IN (SELECT chat_id FROM chat_members WHERE user_id = ?)", userID).Count(&secretChats)
	if secretChats == 0 {
		issues = append(issues, models.PrivacyAudit{
			ID:         generateID(),
			UserID:     userID,
			Category:   "messages",
			Issue:      "Нет секретных чатов с E2E шифрованием",
			Severity:   "medium",
			Suggestion: "Создайте секретные чаты для конфиденциальных разговоров",
			CreatedAt:  time.Now(),
		})
	}

	// Save audit results
	for i := range issues {
		db.GetDB().Create(&issues[i])
	}

	return c.JSON(fiber.Map{
		"issues":    issues,
		"score":     calculatePrivacyScore(issues),
		"totalIssues": len(issues),
	})
}

// GET /ai/privacy-audit
func GetPrivacyAuditResults(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var issues []models.PrivacyAudit
	db.GetDB().Where("user_id = ? AND is_fixed = false", userID).Order("created_at DESC").Find(&issues)

	return c.JSON(fiber.Map{"items": issues})
}

func calculatePrivacyScore(issues []models.PrivacyAudit) int {
	score := 100
	for _, issue := range issues {
		switch issue.Severity {
		case "critical":
			score -= 25
		case "high":
			score -= 15
		case "medium":
			score -= 10
		case "low":
			score -= 5
		}
	}
	if score < 0 {
		score = 0
	}
	return score
}
