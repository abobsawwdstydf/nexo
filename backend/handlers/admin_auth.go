package handlers

import (
	"crypto/subtle"
	"fmt"
	"net/smtp"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"nexo/db"
	"nexo/logging"
	"nexo/middleware"
	"nexo/models"
)

// ─── Отдельный вход в админ-панель по email + коду ─────────────────────────
//
// Не зависит от сессии мессенджера: POST /api/auth/admin/request-code шлёт
// 6-значный код на почту администратора, POST /api/auth/admin/verify
// обменивает его на обычные JWT (доступ к /api/admin/* проверяет is_admin).
// Регистрируются как публичные роуты (до auth-группы), код живёт в той же
// таблице EmailVerification, что и код входа.

// AdminRequestCode — отправить код входа в админ-панель.
func AdminRequestCode(c *fiber.Ctx) error {
	var req models.LoginSendCodeRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	if req.Email == "" || !emailRegex.MatchString(req.Email) {
		return c.Status(400).JSON(fiber.Map{"error": "Введите корректный email"})
	}

	var user models.User
	if result := db.GetDB().Where("email = ?", req.Email).First(&user); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Аккаунт не найден"})
	}

	if !isPlatformAdmin(user.ID) {
		return c.Status(403).JSON(fiber.Map{"error": "Доступ только для администраторов"})
	}

	if user.IsBanned {
		return c.Status(403).JSON(fiber.Map{"error": "Аккаунт заблокирован", "reason": user.BanReason})
	}

	// Rate limit: максимум 3 кода на email за 15 минут.
	var recentCount int64
	db.GetDB().Model(&models.EmailVerification{}).
		Where("email = ? AND created_at > ?", req.Email, time.Now().Add(-15*time.Minute)).
		Count(&recentCount)
	if recentCount >= 3 {
		return c.Status(429).JSON(fiber.Map{"error": "Слишком много запросов. Попробуйте через 15 минут."})
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

	go sendAdminCodeEmail(req.Email, code)

	return c.JSON(models.LoginCodeResponse{
		RequiresCode: true,
		ExpiresAt:    verification.ExpiresAt.Format(time.RFC3339),
	})
}

// AdminVerifyCode — подтвердить код и получить JWT администратора.
func AdminVerifyCode(c *fiber.Ctx) error {
	var req models.LoginConfirmRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	// Per-IP brute-force protection (как у обычного входа)
	if !checkRateLimit("admin-login-ip:"+clientIP(c), 20, 10*time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Слишком много попыток. Попробуйте позже."})
	}

	if !checkLoginBruteForce("admin:" + req.Email) {
		return c.Status(429).JSON(fiber.Map{"error": "Слишком много неудачных попыток. Попробуйте через 15 минут."})
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

	// Constant-time сравнение против timing-атак
	if len(verification.Code) != len(req.Code) || subtle.ConstantTimeCompare([]byte(verification.Code), []byte(req.Code)) != 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid code"})
	}

	resetLoginAttempts("admin:" + req.Email)
	db.GetDB().Model(&verification).Update("status", "confirmed")

	var user models.User
	if result := db.GetDB().Where("email = ?", req.Email).First(&user); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if !isPlatformAdmin(user.ID) {
		return c.Status(403).JSON(fiber.Map{"error": "Доступ только для администраторов"})
	}

	// TOTP 2FA gate — тот же флоу, что у обычного входа
	if user.TwoFactorEnabled {
		tentativeToken, err := middleware.Generate2FAToken(user.ID, user.Username)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to generate session token"})
		}
		return c.Status(202).JSON(fiber.Map{
			"requiresTwoFactor": true,
			"tentativeToken":    tentativeToken,
			"email":             user.Email,
		})
	}

	db.GetDB().Model(&user).Update("is_online", true)

	accessToken, err := middleware.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}
	refreshToken, err := middleware.GenerateRefreshToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}

	user.IsAdmin = true

	return c.JSON(models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}

func sendAdminCodeEmail(to, code string) {
	host, port, username, password, from := getSMTPConfig()
	if username == "" || password == "" {
		logging.Log.Warn("[EMAIL] SMTP not configured, admin code cannot be delivered to", "to", to)
		return
	}

	subject := "Нексо — Код администратора"
	body := fmt.Sprintf("Нексо — Вход в админ-панель\n\nВаш код: %s\n\nДействует 10 минут. Если вы не запрашивали код — проигнорируйте это письмо.", code)

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

	if err := smtp.SendMail(addr, auth, from, []string{to}, []byte(msg)); err != nil {
		logging.Log.Error("[EMAIL] Failed to send admin code", "to", to, "err", err)
	} else {
		logging.Log.Info("[EMAIL] Admin code sent", "to", to)
	}
}
