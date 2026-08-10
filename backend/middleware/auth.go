package middleware

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
)

var (
	JWTSecret       []byte
	JWTRefreshSecret []byte
)

// ValidateAccessTokenString parses and validates an access token without
// touching the request context (used by token-gated routes like /uploads).
func ValidateAccessTokenString(tokenString string) bool {
	if tokenString == "" {
		return false
	}
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected JWT signing method: %v", token.Header["alg"])
		}
		return JWTSecret, nil
	})
	if err != nil || !token.Valid {
		return false
	}

	// Ban check
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", claims.UserID); result.Error != nil {
		if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			log.Printf("error: upload token ban check failed for user %s: %v", claims.UserID, result.Error)
		}
		return false
	}
	return !user.IsBanned
}

// Refresh token blacklist
var (
	refreshBlacklist   = make(map[string]time.Time)
	refreshBlacklistMu sync.RWMutex
)
// BlacklistRefreshToken adds a refresh token to the blacklist
func BlacklistRefreshToken(token string) {
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	entry := models.RefreshTokenBlacklist{
		ID:        generateBlacklistID(),
		TokenHash: tokenHash,
		ExpiresAt: time.Now().Add(30 * 24 * time.Hour),
	}
	if err := db.GetDB().Create(&entry).Error; err != nil {
		// If the DB write fails the in-memory blacklist still protects us,
		// but the old refresh token would survive a restart — log it.
		log.Printf("error: failed to persist refresh-token blacklist entry: %v", err)
	}

	refreshBlacklistMu.Lock()
	refreshBlacklist[tokenHash] = time.Now().Add(30 * 24 * time.Hour)
	refreshBlacklistMu.Unlock()
}

// cleanupRefreshBlacklist drops expired in-memory blacklist entries so the map
// does not grow unbounded. Called periodically from security.go's cleanup loop.
func cleanupRefreshBlacklist() {
	now := time.Now()
	refreshBlacklistMu.Lock()
	for tokenHash, expiry := range refreshBlacklist {
		if !now.Before(expiry) {
			delete(refreshBlacklist, tokenHash)
		}
	}
	refreshBlacklistMu.Unlock()
}


// IsTokenBlacklisted checks if a refresh token is blacklisted
func IsTokenBlacklisted(token string) bool {
	hash := sha256.Sum256([]byte(token))
	tokenHash := hex.EncodeToString(hash[:])

	refreshBlacklistMu.RLock()
	expiry, exists := refreshBlacklist[tokenHash]
	refreshBlacklistMu.RUnlock()
	if exists && time.Now().Before(expiry) {
		return true
	}

	var entry models.RefreshTokenBlacklist
	if result := db.GetDB().Where("token_hash = ? AND expires_at > ?", tokenHash, time.Now()).First(&entry); result.Error == nil {
		return true
	}

	return false
}



func generateBlacklistID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		log.Printf("warn: rand.Read failed in generateBlacklistID: %v", err)
		h := sha256.Sum256([]byte(strconv.FormatInt(time.Now().UnixNano(), 10)))
		return hex.EncodeToString(h[:16])
	}
	return hex.EncodeToString(b)
}

// UserIDFromCtx safely extracts the authenticated user ID from the context.
// Returns empty string if no user is authenticated.
func UserIDFromCtx(c *fiber.Ctx) string {
	if v, ok := c.Locals("userId").(string); ok {
		return v
	}
	return ""
}

// UsernameFromCtx safely extracts the username from the context.
func UsernameFromCtx(c *fiber.Ctx) string {
	if v, ok := c.Locals("username").(string); ok {
		return v
	}
	return ""
}

func InitJWT() error {
	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		return fmt.Errorf("JWT_SECRET environment variable is not set")
	}
	JWTSecret = []byte(secret)

	refreshSecret := os.Getenv("JWT_REFRESH_SECRET")
	if refreshSecret == "" {
		return fmt.Errorf("JWT_REFRESH_SECRET environment variable is not set")
	}
	JWTRefreshSecret = []byte(refreshSecret)
	return nil
}

type Claims struct {
	UserID   string `json:"userId"`
	Username string `json:"username"`
	Stage    string `json:"stage,omitempty"` // "2fa" for tentative login tokens
	jwt.RegisteredClaims
}

// Generate2FAToken issues a short-lived token that only proves the email-code
// step of login succeeded. The holder must still pass TOTP to get real tokens.
func Generate2FAToken(userID, username string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		Stage:    "2fa",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(10 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "nexo",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

func GenerateAccessToken(userID, username string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(15 * time.Minute)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "nexo",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTSecret)
}

func GenerateRefreshToken(userID, username string) (string, error) {
	claims := Claims{
		UserID:   userID,
		Username: username,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			Issuer:    "nexo",
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(JWTRefreshSecret)
}

func AuthenticateToken(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Status(401).JSON(fiber.Map{"error": "No authorization header"})
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid authorization format"})
	}

	tokenString := parts[1]
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected JWT signing method: %v", token.Header["alg"])
		}
		return JWTSecret, nil
	})
	if err != nil || !token.Valid {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid or expired token"})
	}

	// Ban check
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", claims.UserID); result.Error != nil {
		// Log real DB errors instead of silently skipping the ban check; a
		// missing row (deleted account) is not an error worth reporting.
		if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
			log.Printf("error: ban check failed for user %s: %v", claims.UserID, result.Error)
		}
	} else if user.IsBanned {
		return c.Status(403).JSON(fiber.Map{
			"error":  "Account is banned",
			"reason": user.BanReason,
		})
	}

	c.Locals("userId", claims.UserID)
	c.Locals("username", claims.Username)
	return c.Next()
}

// BotAuthenticateToken validates bot token from X-Bot-Token header
func BotAuthenticateToken(c *fiber.Ctx) error {
	botToken := c.Get("X-Bot-Token")
	if botToken == "" {
		return c.Status(401).JSON(fiber.Map{"error": "No bot token"})
	}

	var bot models.Bot
	if result := db.GetDB().Where("token = ? AND is_active = ?", botToken, true).First(&bot); result.Error != nil {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid bot token"})
	}

	c.Locals("botId", bot.ID)
	c.Locals("botOwnerId", bot.OwnerID)
	return c.Next()
}
