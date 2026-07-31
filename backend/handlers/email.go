package handlers

import (
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

func getSMTPConfig() (host, port, username, password, from string) {
	host = os.Getenv("SMTP_HOST")
	if host == "" {
		host = "smtp.gmail.com"
	}
	port = os.Getenv("SMTP_PORT")
	if port == "" {
		port = "587"
	}
	username = os.Getenv("SMTP_USERNAME")
	password = os.Getenv("SMTP_PASSWORD")
	from = os.Getenv("SMTP_FROM")
	if from == "" {
		from = username
	}
	return
}

func generateEmailCode() string {
	return generateCode()
}

func SendEmailCode(c *fiber.Ctx) error {
	var req models.SendEmailCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid email"})
	}

	// Check if email is already registered — reject before sending code
	var existingUser models.User
	if result := db.GetDB().Where("email = ?", req.Email).First(&existingUser); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Этот email уже зарегистрирован. Войдите в аккаунт."})
	}

	// Check rate limit: max 3 codes per email per 15 minutes
	var recentCount int64
	db.GetDB().Model(&models.EmailVerification{}).
		Where("email = ? AND created_at > ?", req.Email, time.Now().Add(-15*time.Minute)).
		Count(&recentCount)
	if recentCount >= 3 {
		return c.Status(429).JSON(fiber.Map{"error": "Too many requests. Try again in 15 minutes."})
	}

	// Daily limit check: max 490 emails per day across all emails
	var todayCount int64
	db.GetDB().Model(&models.EmailVerification{}).
		Where("created_at > ?", time.Now().Truncate(24*time.Hour)).
		Count(&todayCount)
	if todayCount >= 490 {
		return c.Status(429).JSON(fiber.Map{"error": "Daily email limit reached. Try again tomorrow."})
	}

	code := generateEmailCode()

	verification := models.EmailVerification{
		ID:        generateID(),
		Email:     req.Email,
		Code:      code,
		Status:    "pending",
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(10 * time.Minute),
	}

	if err := db.GetDB().Create(&verification).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create verification"})
	}

	// Send email via Gmail SMTP
	go sendVerificationEmail(req.Email, code)

	return c.JSON(fiber.Map{
		"success":   true,
		"message":   "Verification code sent",
		"expiresAt": verification.ExpiresAt,
	})
}

func ConfirmEmailCode(c *fiber.Ctx) error {
	var req models.ConfirmEmailCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || req.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Email and code required"})
	}

	var verification models.EmailVerification
	if result := db.GetDB().Where("email = ? AND status = ?", req.Email, "pending").
		Order("created_at DESC").First(&verification); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "No pending verification"})
	}

	if time.Now().After(verification.ExpiresAt) {
		db.GetDB().Model(&verification).Update("status", "expired")
		return c.Status(410).JSON(fiber.Map{"error": "Code expired"})
	}

	if subtle.ConstantTimeCompare([]byte(verification.Code), []byte(req.Code)) != 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid code"})
	}

	db.GetDB().Model(&verification).Update("status", "confirmed")

	return c.JSON(fiber.Map{
		"success": true,
		"email":   req.Email,
		"message": "Email verified successfully",
	})
}

func sendVerificationEmail(to, code string) {
	host, port, username, password, from := getSMTPConfig()
	if username == "" || password == "" {
		log.Printf("[EMAIL] SMTP not configured, code for %s: %s", to, code)
		return
	}

	subject := "Нексо — Код подтверждения"
	body := fmt.Sprintf("Нексо — Код подтверждения\n\nВаш код: %s\n\nДействует 10 минут.\nЕсли вы не запрашивали код, просто проигнорируйте это письмо.", code)

	messageID := fmt.Sprintf("<%s@nexo.hakerone.ru>", generateID())

	msg := fmt.Sprintf("From: =?UTF-8?B?%s?= <%s>\r\n"+
		"To: %s\r\n"+
		"Subject: =?UTF-8?B?%s?=\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Message-ID: %s\r\n"+
		"Date: %s\r\n"+
		"Reply-To: %s\r\n"+
		"X-Auto-Response-Suppress: All\r\n"+
		"Content-Type: text/plain; charset=UTF-8\r\n"+
		"\r\n"+
		"%s",
		base64Encode("Нексо"), from,
		to,
		base64Encode(subject),
		messageID,
		time.Now().Format(time.RFC1123Z),
		from,
		body)

	auth := smtp.PlainAuth("", username, password, host)
	addr := host + ":" + port

	err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
	if err != nil {
		log.Printf("[EMAIL] Failed to send to %s: %v", to, err)
	} else {
		log.Printf("[EMAIL] Verification sent to %s", to)
	}
}

func base64Encode(s string) string {
	return base64.StdEncoding.EncodeToString([]byte(s))
}
