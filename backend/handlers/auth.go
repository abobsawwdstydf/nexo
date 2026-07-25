package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"fmt"
	"net/smtp"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
)

var (
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
)

// Brute-force protection for login attempts
type loginAttempt struct {
	Count     int
	LockedUntil time.Time
}

var (
	loginAttempts   = make(map[string]*loginAttempt)
	loginAttemptsMu sync.Mutex
)

const (
	maxLoginAttempts    = 5
	lockoutDuration     = 15 * time.Minute
)

func checkLoginBruteForce(email string) bool {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	now := time.Now()
	entry, exists := loginAttempts[email]
	if !exists {
		loginAttempts[email] = &loginAttempt{Count: 1, LockedUntil: time.Time{}}
		return true
	}
	if !entry.LockedUntil.IsZero() && now.Before(entry.LockedUntil) {
		return false
	}
	if entry.Count >= maxLoginAttempts {
		entry.LockedUntil = now.Add(lockoutDuration)
		entry.Count = 0
		return false
	}
	entry.Count++
	return true
}

func resetLoginAttempts(email string) {
	loginAttemptsMu.Lock()
	defer loginAttemptsMu.Unlock()
	delete(loginAttempts, email)
}

func init() {
	// Cleanup expired lockouts every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			loginAttemptsMu.Lock()
			now := time.Now()
			for email, entry := range loginAttempts {
				if !entry.LockedUntil.IsZero() && now.After(entry.LockedUntil) {
					delete(loginAttempts, email)
				}
			}
			loginAttemptsMu.Unlock()
		}
	}()
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func Register(c *fiber.Ctx) error {
	// Per-IP registration rate limit: max 5 registrations per 15 minutes
	ip := c.IP()
	if !checkRateLimit("register:"+ip, 5, 15*time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Too many registration attempts. Try again later."})
	}

	var req models.RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	req.Username = strings.TrimSpace(req.Username)
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))

	// Validate username format
	if !usernameRegex.MatchString(req.Username) {
		return c.Status(400).JSON(fiber.Map{"error": "Username must be 3-32 characters, letters, numbers, and underscores only"})
	}

	// Email is required for registration
	if req.Email == "" || !emailRegex.MatchString(req.Email) {
		return c.Status(400).JSON(fiber.Map{"error": "Valid email is required for registration"})
	}

	// Check email availability in real-time
	var emailExists models.User
	if result := db.GetDB().Where("email = ?", req.Email).First(&emailExists); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Email already registered", "available": false})
	}

	// Validate display name length
	if utf8.RuneCountInString(req.DisplayName) > 128 {
		return c.Status(400).JSON(fiber.Map{"error": "Display name too long (max 128 characters)"})
	}

	var existing models.User
	if result := db.GetDB().Where("username = ?", req.Username).First(&existing); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Username already taken"})
	}

	if result := db.GetDB().Where("email = ?", req.Email).First(&existing); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "Email already registered"})
	}

	user := models.User{
		ID:            generateID(),
		Username:      req.Username,
		DisplayName:   req.DisplayName,
		Email:         req.Email,
		Bio:           req.Bio,
		IsOnline:      true,
		EmailVerified: false,
	}

	if err := db.GetDB().Create(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create user"})
	}

	// Mark email as verified since user already confirmed it during registration step 4
	db.GetDB().Model(&user).Update("email_verified", true)

	// Auto-login: generate tokens directly, no post-registration OTP needed
	accessToken, err := middleware.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}
	refreshToken, err := middleware.GenerateRefreshToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}

	return c.Status(201).JSON(models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
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

	// Brute-force protection: check if too many failed attempts
	if !checkLoginBruteForce(req.Email) {
		return c.Status(429).JSON(fiber.Map{
			"error": "Слишком много неудачных попыток. Попробуйте через 15 минут.",
		})
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

	// SECURITY FIX: Constant-time comparison to prevent timing attacks on verification codes
	if len(verification.Code) != len(req.Code) || subtle.ConstantTimeCompare([]byte(verification.Code), []byte(req.Code)) != 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid code"})
	}

	// Code correct — reset brute-force counter
	resetLoginAttempts(req.Email)
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
	body := fmt.Sprintf("Нексо — Код входа\n\nВаш код: %s\n\nДействует 10 минут.", code)

	messageID := fmt.Sprintf("<%s@nexo.hakerone.ru>", generateID())

	// Simple plain-text email — no multipart, no bulk headers.
	// Precedence: bulk, List-Unsubscribe, Auto-Submitted = spam triggers.
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
		fmt.Printf("[EMAIL] Failed to send login code to %s: %v\n", to, err)
	} else {
		fmt.Printf("[EMAIL] Login code sent to %s\n", to)
	}
}

// ─── Login via email code only (no password) ─────────────────────────────

func SendLoginCode(c *fiber.Ctx) error {
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
		return c.Status(404).JSON(fiber.Map{"error": "Аккаунт не найден. Зарегистрируйтесь."})
	}

	if user.IsBanned {
		return c.Status(403).JSON(fiber.Map{"error": "Аккаунт заблокирован", "reason": user.BanReason})
	}

	// Rate limit: max 3 codes per email per 15 minutes
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

	go sendLoginCodeEmail(req.Email, code)

	return c.JSON(models.LoginCodeResponse{
		RequiresCode: true,
		ExpiresAt:    verification.ExpiresAt.Format(time.RFC3339),
	})
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

	return c.JSON(fiber.Map{"user": user})
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

// CheckEmailAvailability checks if an email is already registered
func CheckEmailAvailability(c *fiber.Ctx) error {
	email := strings.TrimSpace(strings.ToLower(c.Query("email")))
	if email == "" || !emailRegex.MatchString(email) {
		return c.JSON(fiber.Map{"available": false, "error": "Invalid email"})
	}

	var existing models.User
	if result := db.GetDB().Where("email = ?", email).First(&existing); result.Error == nil {
		return c.JSON(fiber.Map{"available": false, "message": "Этот email уже зарегистрирован"})
	}

	return c.JSON(fiber.Map{"available": true})
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
