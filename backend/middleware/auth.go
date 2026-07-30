package middleware

import (
	"fmt"
	"os"
	"strings"
	"sync"
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

// Refresh token blacklist
var (
	refreshBlacklist   = make(map[string]time.Time)
	refreshBlacklistMu sync.RWMutex
)

func init() {
	// Cleanup expired tokens from blacklist every 10 minutes
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			refreshBlacklistMu.Lock()
			now := time.Now()
			for token, expiry := range refreshBlacklist {
				if now.After(expiry) {
					delete(refreshBlacklist, token)
				}
			}
			refreshBlacklistMu.Unlock()
		}
	}()
}

// BlacklistRefreshToken adds a refresh token to the blacklist
func BlacklistRefreshToken(token string) {
	refreshBlacklistMu.Lock()
	defer refreshBlacklistMu.Unlock()
	// Store with 30-day expiry (max refresh token lifetime)
	refreshBlacklist[token] = time.Now().Add(30 * 24 * time.Hour)
}

// IsTokenBlacklisted checks if a refresh token is blacklisted
func IsTokenBlacklisted(token string) bool {
	refreshBlacklistMu.RLock()
	defer refreshBlacklistMu.RUnlock()
	_, blacklisted := refreshBlacklist[token]
	return blacklisted
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
