package handlers

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base32"
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
)

// ─── TOTP (RFC 6238), zero dependencies ──────────────────────────────────

func generateTOTPSecret() (string, error) {
	b := make([]byte, 20)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return strings.TrimRight(base32.StdEncoding.EncodeToString(b), "="), nil
}

func totpCompute(secret string, unixTime int64) (string, error) {
	key, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(strings.ToUpper(secret))
	if err != nil {
		return "", err
	}
	counter := unixTime / 30
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(counter))
	mac := hmac.New(sha1.New, key)
	mac.Write(buf)
	sum := mac.Sum(nil)
	offset := sum[len(sum)-1] & 0x0f
	code := ((uint32(sum[offset])&0x7f)<<24 |
		uint32(sum[offset+1])<<16 |
		uint32(sum[offset+2])<<8 |
		uint32(sum[offset+3])) % 1_000_000
	return fmt.Sprintf("%06d", code), nil
}

func totpValidate(secret, code string) bool {
	if secret == "" || code == "" {
		return false
	}
	now := time.Now().Unix()
	for offset := int64(-1); offset <= 1; offset++ {
		expected, err := totpCompute(secret, now+offset*30)
		if err == nil && subtle.ConstantTimeCompare([]byte(expected), []byte(code)) == 1 {
			return true
		}
	}
	return false
}

func totpURI(secret, email string) string {
	return "otpauth://totp/" + url.PathEscape("Нексо:"+email) +
		"?secret=" + secret +
		"&issuer=" + url.QueryEscape("Нексо") +
		"&algorithm=SHA1&digits=6&period=30"
}

// ─── Recovery codes (one-time, stored as sha256 hex) ─────────────────────

const recoveryAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

func generateRecoveryCodes(n int) []string {
	codes := make([]string, 0, n)
	for i := 0; i < n; i++ {
		b := make([]byte, 8)
		if _, err := rand.Read(b); err != nil {
			continue
		}
		code := make([]byte, 8)
		for j := range b {
			code[j] = recoveryAlphabet[int(b[j])%len(recoveryAlphabet)]
		}
		codes = append(codes, string(code))
	}
	return codes
}

func hashRecoveryCodes(codes []string) string {
	hashes := make([]string, 0, len(codes))
	for _, c := range codes {
		s := sha256.Sum256([]byte(c))
		hashes = append(hashes, hex.EncodeToString(s[:]))
	}
	b, _ := json.Marshal(hashes)
	return string(b)
}

// verifyRecoveryCode checks a code and removes it on success (one-time use).
func verifyRecoveryCode(user *models.User, code string) bool {
	var hashes []string
	if json.Unmarshal([]byte(user.TotpRecoveryCodes), &hashes) != nil {
		return false
	}
	s := sha256.Sum256([]byte(code))
	h := hex.EncodeToString(s[:])
	for i, v := range hashes {
		if subtle.ConstantTimeCompare([]byte(v), []byte(h)) == 1 {
			hashes = append(hashes[:i], hashes[i+1:]...)
			b, _ := json.Marshal(hashes)
			db.GetDB().Model(&models.User{}).Where("id = ?", user.ID).Update("totp_recovery_codes", string(b))
			return true
		}
	}
	return false
}

// ─── HTTP handlers ───────────────────────────────────────────────────────

// Setup2FA generates a fresh TOTP secret and returns the otpauth URI.
// The secret is stored immediately but only becomes active after Verify2FA.
func Setup2FA(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	if user.TwoFactorEnabled {
		return c.Status(400).JSON(fiber.Map{"error": "2FA is already enabled"})
	}

	secret, err := generateTOTPSecret()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate secret"})
	}
	if err := db.GetDB().Model(&user).Updates(map[string]interface{}{
		"totp_secret": secret,
	}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save secret"})
	}

	return c.JSON(fiber.Map{
		"secret": secret,
		"uri":    totpURI(secret, user.Email),
	})
}

// Verify2FA activates 2FA after the user proves they hold the secret.
func Verify2FA(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	var req struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil || req.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Code required"})
	}
	if !checkRateLimit("2fa-verify:"+userID, 5, time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Too many attempts"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	if user.TwoFactorEnabled {
		return c.Status(400).JSON(fiber.Map{"error": "2FA is already enabled"})
	}
	if !totpValidate(user.TotpSecret, req.Code) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid code"})
	}

	now := time.Now()
	codes := generateRecoveryCodes(8)
	db.GetDB().Model(&user).Updates(map[string]interface{}{
		"two_factor_enabled": true,
		"totp_enabled_at":    now,
		"totp_recovery_codes": hashRecoveryCodes(codes),
	})

	return c.JSON(fiber.Map{"enabled": true, "recoveryCodes": codes})
}

// Disable2FA requires a valid TOTP or recovery code to turn 2FA off.
func Disable2FA(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	var req struct {
		Code string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil || req.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Code required"})
	}
	if !checkRateLimit("2fa-disable:"+userID, 5, time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Too many attempts"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	if !totpValidate(user.TotpSecret, req.Code) && !verifyRecoveryCode(&user, req.Code) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid code"})
	}

	db.GetDB().Model(&user).Updates(map[string]interface{}{
		"two_factor_enabled":  false,
		"totp_secret":         "",
		"totp_recovery_codes": "",
		"totp_enabled_at":     nil,
	})
	return c.JSON(fiber.Map{"enabled": false})
}

// Login2FA completes the 2FA step of login using the tentative token from
// LoginConfirm. Accepts a TOTP code or a one-time recovery code.
func Login2FA(c *fiber.Ctx) error {
	var req struct {
		TentativeToken string `json:"tentativeToken"`
		Code           string `json:"code"`
	}
	if err := c.BodyParser(&req); err != nil || req.TentativeToken == "" || req.Code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "tentativeToken and code required"})
	}
	if !checkRateLimit("2fa-login:"+req.TentativeToken, 5, time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Too many attempts"})
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(req.TentativeToken, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected JWT signing method: %v", token.Header["alg"])
		}
		return middleware.JWTSecret, nil
	})
	if err != nil || !token.Valid || claims.Stage != "2fa" {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid or expired login session"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", claims.UserID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}
	if !user.TwoFactorEnabled {
		return c.Status(400).JSON(fiber.Map{"error": "2FA is not enabled for this account"})
	}

	ok := totpValidate(user.TotpSecret, req.Code) || verifyRecoveryCode(&user, req.Code)
	if !ok {
		// Per-user brute-force protection: 5 failed TOTP codes per 10 minutes
		if !checkRateLimit("2fa-fail:"+claims.UserID, 5, 10*time.Minute) {
			return c.Status(429).JSON(fiber.Map{
				"error": "Слишком много попыток. Попробуйте позже.",
			})
		}
		return c.Status(400).JSON(fiber.Map{"error": "Invalid code"})
	}

	db.GetDB().Model(&user).Update("is_online", true)

	accessToken, err := middleware.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}
	refreshToken, err := middleware.GenerateRefreshToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	user.IsAdmin = isPlatformAdmin(user.ID)

	return c.JSON(models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}