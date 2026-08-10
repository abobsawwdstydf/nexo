package handlers

import (
	"crypto/subtle"
	"errors"
	"fmt"
	"log"
	"net/smtp"
	"os"
	"regexp"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"

	"nexo/beta"
	"nexo/db"
	"nexo/helpers"
	"nexo/middleware"
	"nexo/models"
)

var (
	usernameRegex = regexp.MustCompile(`^[a-zA-Zа-яА-ЯёЁ0-9_]{3,32}$`)
	emailRegex    = regexp.MustCompile(`^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$`)
)

// commonChatRow — общий чат (личный или группа) между двумя пользователями.
type commonChatRow struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Type string `json:"type"`
}

// ─── Reserved usernames ─────────────────────────────────────────────────
// blockedForAll — никто не может использовать
var blockedForAll = map[string]bool{
	"i":       true,
	"info":    true,
}

// premiumReserved — только аккаунт nexo.su.support@gmail.com
var premiumReserved = map[string]bool{
	"nexo":      true,
	"nexo.su":   true,
	"haker_one": true,
	"hakerone":  true,
	"нексо":     true,
}

const earlyAccessEmail = "nexo.su.support@gmail.com"

func isUsernameReserved(username string) (bool, string) {
	u := strings.ToLower(username)
	if blockedForAll[u] {
		return true, "Этот username зарезервирован"
	}
	if premiumReserved[u] {
		return true, "Этот username доступен только администрации"
	}
	return false, ""
}


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
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				loginAttemptsMu.Lock()
				now := time.Now()
				for email, entry := range loginAttempts {
					if !entry.LockedUntil.IsZero() && now.After(entry.LockedUntil) {
						delete(loginAttempts, email)
					}
				}
				loginAttemptsMu.Unlock()
			case <-StopCh:
				return
			}
		}
	}()
}

func generateID() string {
	return helpers.GenerateID()
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

	// Check reserved usernames
	if reserved, reason := isUsernameReserved(req.Username); reserved {
		// Premium reserved names can only be used by early access account
		if premiumReserved[strings.ToLower(req.Username)] && !BetaAccessAllowed(req.Email) {
			return c.Status(409).JSON(fiber.Map{"error": reason})
		}
		// Fully blocked names
		if blockedForAll[strings.ToLower(req.Username)] {
			return c.Status(409).JSON(fiber.Map{"error": reason})
		}
	}

	// Email is required for registration
	if req.Email == "" || !emailRegex.MatchString(req.Email) {
		return c.Status(400).JSON(fiber.Map{"error": "Valid email is required for registration"})
	}

	// До старта беты регистрация закрыта, кроме аккаунта раннего доступа
	if !BetaAccessAllowed(req.Email) {
		return c.Status(403).JSON(fiber.Map{"error": "beta_not_started", "message": beta.StartMessage})
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
		IsAdmin:       req.Email == PlatformAdminEmail,
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

	// До старта беты вход закрыт, кроме аккаунта раннего доступа
	if !BetaAccessAllowed(req.Email) {
		return c.Status(403).JSON(fiber.Map{"error": "beta_not_started", "message": beta.StartMessage})
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

	// TOTP 2FA gate: email code confirmed, but the user must still prove the
	// authenticator code. We hand out a short-lived tentative token instead of
	// real tokens; the second step is POST /api/auth/login/totp.
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

	user.IsAdmin = isPlatformAdmin(user.ID)

	return c.JSON(models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}

func sendLoginCodeEmail(to, code string) {
	host, port, username, password, from := getSMTPConfig()
	if username == "" || password == "" {
		// Dev fallback: only reveal the code when explicitly enabled. Logging
		// OTPs by default would leak login codes to anyone with log access.
		if os.Getenv("NEXO_DEV_LOG_CODES") == "true" {
			log.Printf("[EMAIL] SMTP not configured, login code for %s: %s", to, code)
		} else {
			log.Printf("[EMAIL] SMTP not configured, cannot deliver login code to %s", to)
		}
		return
	}

	subject := "Нексо — Код входа"
	body := fmt.Sprintf("Нексо — Код входа\n\nВаш код: %s\n\nДействует 10 минут.", code)

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
		log.Printf("[EMAIL] Failed to send login code to %s: %v", to, err)
	} else {
		log.Printf("[EMAIL] Login code sent to %s", to)
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

	// До старта беты вход закрыт, кроме аккаунта раннего доступа
	if !BetaAccessAllowed(req.Email) {
		return c.Status(403).JSON(fiber.Map{"error": "beta_not_started", "message": beta.StartMessage})
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
		// NOTE: two_factor_enabled is intentionally NOT settable here — it can
		// only be flipped through the verified /api/2fa/* flow (handlers/totp.go).
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
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected JWT signing method: %v", token.Header["alg"])
		}
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

	user.IsAdmin = isPlatformAdmin(userID)

	return c.JSON(fiber.Map{"user": user})
}

func GetUser(c *fiber.Ctx) error {
	viewerID := middleware.UserIDFromCtx(c)
	targetID := c.Params("id")

	// Block invalid IDs that aren't real user IDs
	if targetID == "settings" || targetID == "notifications" || targetID == "search" || targetID == "channels" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid user ID"})
	}

	// Viewing own profile: return the same response shape as any other profile
	if targetID == viewerID {
		var me models.User
		if result := db.GetDB().First(&me, "id = ?", viewerID); result.Error != nil {
			return c.Status(404).JSON(fiber.Map{"error": "User not found"})
		}
		return c.JSON(fiber.Map{
			"user":         sanitizeUser(me, viewerID),
			"friendship":   "none",
			"friendshipId": "",
			"blockedByMe":  false,
			"blockedMe":    false,
			"commonChats":  []commonChatRow{},
		})
	}

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", targetID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	safe := sanitizeUser(user, viewerID)

	// Friendship status between viewer and target
	friendshipStatus := "none"
	friendshipID := ""
	if viewerID != "" {
		var friendship models.Friendship
		result := db.GetDB().
			Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
				viewerID, targetID, targetID, viewerID).
			First(&friendship)
		if result.Error == nil {
			friendshipID = friendship.ID
			if friendship.Status == "accepted" {
				friendshipStatus = "accepted"
			} else if friendship.UserID == viewerID {
				friendshipStatus = "pending_sent"
			} else {
				friendshipStatus = "pending_received"
			}
		} else if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			log.Printf("error: GetUser: friendship query (viewer=%s target=%s): %v", viewerID, targetID, result.Error)
		}
	}

	// Block state (both directions)
	var blockedByMe, blockedMe bool
	if viewerID != "" {
		var b1, b2 models.BlockedUser
		if db.GetDB().Where("user_id = ? AND blocked_user_id = ?", viewerID, targetID).First(&b1).Error == nil {
			blockedByMe = true
		}
		if db.GetDB().Where("user_id = ? AND blocked_user_id = ?", targetID, viewerID).First(&b2).Error == nil {
			blockedMe = true
		}
	}

	// Common chats (personal + group) between viewer and target
	commonChats := make([]commonChatRow, 0)
	if viewerID != "" && !blockedMe {
		if err := db.GetDB().Raw(`
			SELECT cm1.chat_id AS id, c.name AS name, c.type AS type
			FROM chat_members cm1
			JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
			JOIN chats c ON c.id = cm1.chat_id
			WHERE cm1.user_id = ? AND cm2.user_id = ?
			  AND cm1.user_id != cm2.user_id
			  AND c.type IN ('personal','group')
			ORDER BY c.updated_at DESC
			LIMIT 20`,
			viewerID, targetID).Scan(&commonChats).Error; err != nil {
			log.Printf("error: GetUser: common chats query (viewer=%s target=%s): %v", viewerID, targetID, err)
		}
	}

	return c.JSON(fiber.Map{
		"user":         safe,
		"friendship":   friendshipStatus,
		"friendshipId": friendshipID,
		"blockedByMe":  blockedByMe,
		"blockedMe":    blockedMe,
		"commonChats":  commonChats,
	})
}

func UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.UpdateProfileRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updates := map[string]interface{}{}
	if req.DisplayName != nil {
		updates["display_name"] = strings.TrimSpace(*req.DisplayName)
	}
	if req.Bio != nil {
		updates["bio"] = strings.TrimSpace(*req.Bio)
	}
	if req.Avatar != nil {
		updates["avatar"] = *req.Avatar
	}
	if req.NameColor != nil {
		updates["name_color"] = *req.NameColor
	}
	if req.NameGradient != nil {
		updates["name_gradient"] = *req.NameGradient
	}
	if req.Username != nil {
		newUsername := strings.TrimSpace(*req.Username)
		if !usernameRegex.MatchString(newUsername) {
			return c.Status(400).JSON(fiber.Map{"error": "Некорректный никнейм: 3–32 символа (латиница, кириллица, цифры, _)"})
		}
		if reserved, reason := isUsernameReserved(newUsername); reserved {
			return c.Status(400).JSON(fiber.Map{"error": reason})
		}
		var clash models.User
		if err := db.GetDB().Where("username = ? AND id != ?", newUsername, userID).First(&clash).Error; err == nil {
			return c.Status(400).JSON(fiber.Map{"error": "Этот никнейм уже занят"})
		}
		var clashBot models.Bot
		if err := db.GetDB().Where("username = ?", newUsername).First(&clashBot).Error; err == nil {
			return c.Status(400).JSON(fiber.Map{"error": "Этот никнейм уже занят"})
		}
		updates["username"] = newUsername
	}

	if len(updates) > 0 {
		if err := db.GetDB().Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
			log.Printf("error: UpdateProfile: failed to update user %s: %v", userID, err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update profile"})
		}
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		log.Printf("error: UpdateProfile: reload user %s: %v", userID, err)
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
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

// CheckUsername checks if a username is available
func CheckUsername(c *fiber.Ctx) error {
	username := strings.TrimSpace(c.Query("username"))
	if username == "" {
		return c.JSON(fiber.Map{"available": false, "reason": "Username is required"})
	}
	if !usernameRegex.MatchString(username) {
		return c.JSON(fiber.Map{"available": false, "reason": "Invalid username format"})
	}

	// Check reserved usernames
	if reserved, reason := isUsernameReserved(username); reserved {
		return c.JSON(fiber.Map{"available": false, "reason": reason})
	}

	// Check if taken by a user
	var existingUser models.User
	if result := db.GetDB().Where("username = ?", username).First(&existingUser); result.Error == nil {
		return c.JSON(fiber.Map{"available": false, "reason": "Username already taken"})
	}

	// Check if taken by a bot
	var existingBot models.Bot
	if result := db.GetDB().Where("username = ?", username).First(&existingBot); result.Error == nil {
		return c.JSON(fiber.Map{"available": false, "reason": "Username already taken"})
	}

	return c.JSON(fiber.Map{"available": true})
}

func SearchUsers(c *fiber.Ctx) error {
	query := c.Query("q")
	if len(query) < 2 {
		return c.Status(400).JSON(fiber.Map{"error": "Query must be at least 2 characters"})
	}

	// SECURITY FIX: Escape SQL LIKE wildcards to prevent data leak
	escapedQuery := strings.ReplaceAll(query, `\`, `\\`)
	escapedQuery = strings.ReplaceAll(escapedQuery, "%", `\%`)
	escapedQuery = strings.ReplaceAll(escapedQuery, "_", `\_`)

	var users []models.User
	db.GetDB().Where("username LIKE ? ESCAPE '\\' OR display_name LIKE ? ESCAPE '\\'",
		"%"+escapedQuery+"%", "%"+escapedQuery+"%").
		Limit(20).Find(&users)

	if users == nil {
		users = []models.User{}
	}
	return c.JSON(users)
}

func Logout(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	db.GetDB().Model(&models.User{}).Where("id = ?", userID).Update("is_online", false)
	return c.JSON(fiber.Map{"ok": true})
}

// ─── Privacy Settings (delegates to handlers/privacy.go) ───────────────────
