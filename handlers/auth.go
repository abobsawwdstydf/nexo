package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/smtp"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
	"nexo/ws"
)

var (
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
)

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func Register(c *fiber.Ctx) error {
	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Password = strings.TrimSpace(req.Password)

	// Validate username format
	if !usernameRegex.MatchString(req.Username) {
		return c.Status(400).JSON(fiber.Map{"error": "Username must be 3-32 characters, letters, numbers, and underscores only"})
	}

	// Validate password strength
	if len(req.Password) < 8 {
		return c.Status(400).JSON(fiber.Map{"error": "Password must be at least 8 characters"})
	}
	hasLetter := false
	hasNumber := false
	for _, c := range req.Password {
		if c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' {
			hasLetter = true
		}
		if c >= '0' && c <= '9' {
			hasNumber = true
		}
	}
	if !hasLetter || !hasNumber {
		return c.Status(400).JSON(fiber.Map{"error": "Password must contain at least one letter and one number"})
	}

	// Validate email if provided
	if req.Email != "" && !emailRegex.MatchString(req.Email) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid email format"})
	}

	// Validate display name length
	if utf8.RuneCountInString(req.DisplayName) > 128 {
		return c.Status(400).JSON(fiber.Map{"error": "Display name too long (max 128 characters)"})
	}

	var existing models.User
	if result := db.GetDB().Where("username = ?", req.Username).First(&existing); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Username already taken"})
	}

	if req.Email != "" {
		if result := db.GetDB().Where("email = ?", req.Email).First(&existing); result.Error == nil {
			return c.Status(409).JSON(fiber.Map{"error": "Email already registered"})
		}
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	user := models.User{
		ID:          generateID(),
		Username:    req.Username,
		DisplayName: req.DisplayName,
		Email:       req.Email,
		Phone:       req.Phone,
		Password:    string(hashedPassword),
		Bio:         req.Bio,
		Birthday:    req.Birthday,
		IsOnline:    true,
	}

	if err := db.GetDB().Create(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
	}

	accessToken, err := middleware.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}
	refreshToken, err := middleware.GenerateRefreshToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}

	ws.HubInstance.SendToUser(user.ID, []byte(`{"type":"user:online","userId":"`+user.ID+`"}`))

	return c.Status(201).JSON(models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}

// ─── Login via email + password + email code confirmation ─────────────────

func Login(c *fiber.Ctx) error {
	var req models.LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Password = strings.TrimSpace(req.Password)

	if req.Email == "" || !strings.Contains(req.Email, "@") {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid email"})
	}

	var user models.User
	if result := db.GetDB().Where("email = ?", req.Email).First(&user); result.Error != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
	}

	if user.IsBanned {
		return c.Status(403).JSON(fiber.Map{"error": "Account is banned", "reason": user.BanReason})
	}

	// Check main password, fallback to global password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		if user.GlobalPassword == "" {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
		}
		if err2 := bcrypt.CompareHashAndPassword([]byte(user.GlobalPassword), []byte(req.Password)); err2 != nil {
			return c.Status(401).JSON(fiber.Map{"error": "Invalid credentials"})
		}
	}

	// Rate limit: max 3 codes per email per 15 minutes
	var recentCount int64
	db.GetDB().Model(&models.EmailVerification{}).
		Where("email = ? AND created_at > ?", req.Email, time.Now().Add(-15*time.Minute)).
		Count(&recentCount)
	if recentCount >= 3 {
		return c.Status(429).JSON(fiber.Map{"error": "Too many requests. Try again in 15 minutes."})
	}

	// Generate and send login code
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

	go sendLoginCodeEmail(req.Email, code)

	return c.JSON(models.LoginCodeResponse{
		RequiresCode: true,
		ExpiresAt:    verification.ExpiresAt.Format(time.RFC3339),
	})
}

func LoginConfirm(c *fiber.Ctx) error {
	var req models.LoginConfirmRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
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

	var user models.User
	if result := db.GetDB().Where("email = ?", req.Email).First(&user); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
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

	return c.JSON(models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}

func sendLoginCodeEmail(to, code string) {
	host, port, username, password, from := getSMTPConfig()
	if username == "" || password == "" {
		fmt.Printf("[EMAIL] SMTP not configured, login code for %s: %s\n", to, code)
		return
	}

	subject := "Нексо — Код входа"
	body := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0e0f12;font-family:'Inter',Arial,sans-serif;">
<div style="max-width:480px;margin:40px auto;background:#1e1f22;border-radius:16px;padding:40px 36px;border:1px solid rgba(255,255,255,0.03);">
  <div style="text-align:center;margin-bottom:24px;">
    <h1 style="color:#f2f3f5;font-size:24px;font-weight:800;margin:0;">Нексо</h1>
    <p style="color:#949ba4;font-size:13px;margin-top:4px;">Код подтверждения входа</p>
  </div>
  <div style="background:#141518;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px;">
    <p style="color:#949ba4;font-size:14px;margin:0 0 16px;">Ваш код для входа:</p>
    <div style="font-size:36px;font-weight:800;color:#5865f2;letter-spacing:8px;font-family:monospace;">%s</div>
    <p style="color:#4e5058;font-size:12px;margin-top:12px;">Действует 10 минут</p>
  </div>
  <p style="color:#4e5058;font-size:12px;text-align:center;">Если вы не запрашивали код, просто проигнорируйте это письмо.</p>
</div>
</body>
</html>`, code)

	messageID := fmt.Sprintf("<%s@nexo.cloudpub.ru>", generateID())
	msg := fmt.Sprintf("From: %s <%s>\r\n"+
		"To: %s\r\n"+
		"Subject: %s\r\n"+
		"MIME-Version: 1.0\r\n"+
		"Message-ID: %s\r\n"+
		"Date: %s\r\n"+
		"Reply-To: %s\r\n"+
		"X-Mailer: NexoMailer/1.0\r\n"+
		"Precedence: bulk\r\n"+
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
		fmt.Printf("[EMAIL] Failed to send login code to %s: %v\n", to, err)
	} else {
		fmt.Printf("[EMAIL] Login code sent to %s\n", to)
	}
}

// ─── Global Password ──────────────────────────────────────────────────────

func SetGlobalPassword(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.SetGlobalPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if len(req.Password) < 8 {
		return c.Status(400).JSON(fiber.Map{"error": "Global password must be at least 8 characters"})
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to hash password"})
	}

	db.GetDB().Model(&models.User{}).Where("id = ?", userID).Update("global_password", string(hashedPassword))

	return c.JSON(fiber.Map{"success": true, "message": "Global password set successfully"})
}

func RemoveGlobalPassword(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	db.GetDB().Model(&models.User{}).Where("id = ?", userID).Update("global_password", "")

	return c.JSON(fiber.Map{"success": true, "message": "Global password removed"})
}

// ─── User Settings & Notifications ────────────────────────────────────────

func GetUserSettings(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{
		"notifyAll":      user.NotifyAll,
		"notifyMessages": user.NotifyMessages,
		"notifyCalls":    user.NotifyCalls,
		"notifyFriends":  user.NotifyFriends,
		"twoFactorEnabled": user.TwoFactorEnabled,
	})
}

func UpdateUserSettings(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var updates map[string]interface{}
	if err := c.BodyParser(&updates); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	allowed := map[string]bool{
		"notify_all": true, "notify_messages": true,
		"notify_calls": true, "notify_friends": true,
		"two_factor_enabled": true,
	}

	safeUpdates := map[string]interface{}{}
	for k, v := range updates {
		if allowed[k] {
			safeUpdates[k] = v
		}
	}

	if len(safeUpdates) > 0 {
		db.GetDB().Model(&models.User{}).Where("id = ?", userID).Updates(safeUpdates)
	}

	var user models.User
	db.GetDB().First(&user, "id = ?", userID)

	return c.JSON(fiber.Map{
		"notifyAll":      user.NotifyAll,
		"notifyMessages": user.NotifyMessages,
		"notifyCalls":    user.NotifyCalls,
		"notifyFriends":  user.NotifyFriends,
		"twoFactorEnabled": user.TwoFactorEnabled,
	})
}

func GetUserNotifications(c *fiber.Ctx) error {
	return c.JSON([]interface{}{})
}

// ─── Existing handlers ────────────────────────────────────────────────────

func RefreshToken(c *fiber.Ctx) error {
	type RefreshRequest struct {
		RefreshToken string `json:"refreshToken"`
	}
	var req RefreshRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.RefreshToken == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Refresh token required"})
	}

	// Check if already blacklisted (reuse attempt)
	if middleware.IsTokenBlacklisted(req.RefreshToken) {
		return c.Status(401).JSON(fiber.Map{"error": "Refresh token revoked"})
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(req.RefreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		return middleware.JWTRefreshSecret, nil
	})
	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid refresh token"})
	}

	// Blacklist old refresh token (rotation)
	middleware.BlacklistRefreshToken(req.RefreshToken)

	// Issue new pair
	accessToken, err := middleware.GenerateAccessToken(claims.UserID, claims.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate access token"})
	}
	refreshToken, err := middleware.GenerateRefreshToken(claims.UserID, claims.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}

	return c.JSON(fiber.Map{
		"accessToken":  accessToken,
		"refreshToken": refreshToken,
	})
}

func GetProfile(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(user)
}

func GetUser(c *fiber.Ctx) error {
	targetID := c.Params("id")

	// Block invalid IDs that aren't real user IDs
	if targetID == "settings" || targetID == "notifications" || targetID == "search" || targetID == "channels" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", targetID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(user)
}

func UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updates := map[string]interface{}{}
	if req.DisplayName != "" {
		updates["display_name"] = req.DisplayName
	}
	if req.Bio != "" {
		updates["bio"] = req.Bio
	}
	if req.Birthday != "" {
		updates["birthday"] = req.Birthday
	}
	if req.Avatar != "" {
		updates["avatar"] = req.Avatar
	}
	if req.NameColor != "" {
		updates["name_color"] = req.NameColor
	}
	if req.NameGradient != "" {
		updates["name_gradient"] = req.NameGradient
	}

	if len(updates) > 0 {
		db.GetDB().Model(&models.User{}).Where("id = ?", userID).Updates(updates)
	}

	var user models.User
	db.GetDB().First(&user, "id = ?", userID)
	return c.JSON(user)
}

func SearchUsers(c *fiber.Ctx) error {
	query := c.Query("q")
	if len(query) < 2 {
		return c.Status(400).JSON(fiber.Map{"error": "Query must be at least 2 characters"})
	}

	// SECURITY FIX: Escape SQL LIKE wildcards to prevent data leak
	escapedQuery := strings.ReplaceAll(query, "%", "\\%")
	escapedQuery = strings.ReplaceAll(escapedQuery, "_", "\\_")

	var users []models.User
	db.GetDB().Where("username LIKE ? ESCAPE '\\\\' OR display_name LIKE ? ESCAPE '\\\\'",
		"%"+escapedQuery+"%", "%"+escapedQuery+"%").
		Limit(20).Find(&users)

	return c.JSON(users)
}

func Logout(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	db.GetDB().Model(&models.User{}).Where("id = ?", userID).Update("is_online", false)
	return c.JSON(fiber.Map{"ok": true})
}

// ─── Privacy Settings (delegates to handlers/privacy.go) ───────────────────
