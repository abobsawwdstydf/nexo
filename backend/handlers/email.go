package handlers

import (
	"crypto/subtle"
	"encoding/base64"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/beta"
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

	// До старта беты отправка кодов закрыта, кроме аккаунта раннего доступа
	if !BetaAccessAllowed(req.Email) {
		return c.Status(403).JSON(fiber.Map{"error": "beta_not_started", "message": beta.StartMessage})
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

	// SECURITY: brute-force protection — 6-digit codes are brute-forceable
	// from distributed IPs, so cap failed attempts per email.
	if !checkEmailConfirmBruteForce(req.Email) {
		return c.Status(429).JSON(fiber.Map{"error": "Too many attempts. Try again in 15 minutes."})
	}

	// До старта беты подтверждение закрыто, кроме аккаунта раннего доступа
	if !BetaAccessAllowed(req.Email) {
		return c.Status(403).JSON(fiber.Map{"error": "beta_not_started", "message": beta.StartMessage})
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

	resetEmailConfirmAttempts(req.Email)
	db.GetDB().Model(&verification).Update("status", "confirmed")

	return c.JSON(fiber.Map{
		"success": true,
		"email":   req.Email,
		"message": "Email verified successfully",
	})
}

// ─── Email code brute-force protection ────────────────────────────────────

type emailConfirmAttempt struct {
	Count       int
	LockedUntil time.Time
	LastSeen    time.Time
}

var (
	emailConfirmAttempts   = make(map[string]*emailConfirmAttempt)
	emailConfirmAttemptsMu sync.Mutex
)

func checkEmailConfirmBruteForce(email string) bool {
	emailConfirmAttemptsMu.Lock()
	defer emailConfirmAttemptsMu.Unlock()
	now := time.Now()

	// Opportunistic cleanup: drop stale entries to prevent unbounded growth
	if len(emailConfirmAttempts) > 5000 {
		for k, e := range emailConfirmAttempts {
			if now.Sub(e.LastSeen) > time.Hour || (!e.LockedUntil.IsZero() && now.After(e.LockedUntil)) {
				delete(emailConfirmAttempts, k)
			}
		}
	}

	entry, exists := emailConfirmAttempts[email]
	if !exists {
		emailConfirmAttempts[email] = &emailConfirmAttempt{Count: 1, LastSeen: now}
		return true
	}
	entry.LastSeen = now
	if !entry.LockedUntil.IsZero() && now.Before(entry.LockedUntil) {
		return false
	}
	if entry.Count >= 5 {
		entry.LockedUntil = now.Add(15 * time.Minute)
		entry.Count = 0
		return false
	}
	entry.Count++
	return true
}

func resetEmailConfirmAttempts(email string) {
	emailConfirmAttemptsMu.Lock()
	defer emailConfirmAttemptsMu.Unlock()
	delete(emailConfirmAttempts, email)
}

func sendVerificationEmail(to, code string) {
	host, port, username, password, from := getSMTPConfig()
	if username == "" || password == "" {
		// Код НЕ пишем в логи: это одноразовый секрет, утекающий в логи = утечка.
		log.Printf("[EMAIL] SMTP not configured, verification email to %s skipped", to)
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
