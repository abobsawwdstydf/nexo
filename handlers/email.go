package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
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
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	code := n.Int64() + 100000
	return fmt.Sprintf("%d", code)
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

	if verification.Code != req.Code {
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
		fmt.Printf("[EMAIL] SMTP not configured, code for %s: %s\n", to, code)
		return
	}

	subject := "Нексо — Код подтверждения"
	body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0e0f12;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#1e1f22;border-radius:16px;padding:40px 36px;border:1px solid rgba(255,255,255,0.03);">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#f2f3f5;font-size:24px;font-weight:800;margin:0;">Нексо</h1>
    <p style="color:#949ba4;font-size:13px;margin-top:4px;">Подтверждение email</p>
  </div>
  <div style="background:#141518;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
    <p style="color:#949ba4;font-size:14px;margin:0 0 16px;">Ваш код подтверждения:</p>
    <div style="font-size:36px;font-weight:800;color:#5865f2;letter-spacing:8px;font-family:monospace;">%s</div>
    <p style="color:#4e5058;font-size:12px;margin-top:12px;">Действует 10 минут</p>
  </div>
  <p style="color:#4e5058;font-size:12px;text-align:center;">Если вы не запрашивали код, просто проигнорируйте это письмо.</p>
</div>
</body>
</html>`, code)

	// Generate unique Message-ID for better deliverability
	messageID := fmt.Sprintf("<%s@nexo.cloudpub.ru>", generateID())
	
	// Build email with proper headers to avoid spam
	msg := fmt.Sprintf("From: %s <%s>\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Message-ID: %s\r\n"+
		"Date: %s\r\n"+
		"Reply-To: %s\r\n"+
		"X-Mailer: NexoMailer/1.0\r\n"+
		"Precedence: bulk\r\n"+
		"List-Unsubscribe: <mailto:nexo.su.support@gmail.com?subject=unsubscribe>\r\n"+
		"Content-Type: text/html; charset=UTF-8\r\n"+
		"Content-Transfer-Encoding: quoted-printable\r\n"+
		"\r\n%s",
		"Нексо", from,
		to,
		subject,
		messageID,
		time.Now().Format(time.RFC1123Z),
		from,
		body)

	auth := smtp.PlainAuth("", username, password, host)
	addr := host + ":" + port

	err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg))
	if err != nil {
		fmt.Printf("[EMAIL] Failed to send to %s: %v\n", to, err)
	} else {
		fmt.Printf("[EMAIL] Verification sent to %s\n", to)
	}
}
