package middleware

import (
	"fmt"
	"os"
	"strings"
	"sync"
	"crypto/sha256"
	"encoding/hex"
	"crypto/rand"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"nexo/db"
	"nexo/models"
)

var (
	JWTSecret       []byte
	JWTRefreshSecret []byte
)

// SetRefreshCookie sets an HTTP-only, secure cookie for the refresh token.
func SetRefreshCookie(c *fiber.Ctx, refreshToken string) {
	secure := c.Protocol() == "https"
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		Path:     "/api/auth",
		HTTPOnly: true,
		Secure:   secure,
		SameSite: "Strict",
		MaxAge:   30 * 24 * 60 * 60, // 30 days
	})
}

// ClearRefreshCookie clears the refresh token cookie (for logout).
func ClearRefreshCookie(c *fiber.Ctx) {
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/api/auth",
		HTTPOnly: true,
		Secure:   c.Protocol() == "https",
		SameSite: "Strict",
		MaxAge:   -1,
	})
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
	db.GetDB().Create(&entry)

	refreshBlacklistMu.Lock()
	refreshBlacklist[tokenHash] = time.Now().Add(30 * 24 * time.Hour)
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
	rand.Read(b)
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
	jwt.RegisteredClaims
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
	if result := db.GetDB().First(&user, "id = ?", claims.UserID); result.Error == nil && user.IsBanned {
		return c.Status(403).JSON(fiber.Map{
			"error":  "Account is banned",
			"reason": user.BanReason,
		})
	}

	c.Locals("userId", claims.UserID)
	c.Locals("username", claims.Username)
	return c.Next()
}

func OptionalAuth(c *fiber.Ctx) error {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return c.Next()
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
		return c.Next()
	}

	tokenString := parts[1]
	claims := &Claims{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected JWT signing method: %v", token.Header["alg"])
		}
		return JWTSecret, nil
	})
	if err == nil && token.Valid {
		c.Locals("userId", claims.UserID)
		c.Locals("username", claims.Username)
	}

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
