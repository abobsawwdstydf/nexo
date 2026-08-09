package handlers

import (
	"log"
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
)

// DevLogin — локальный вход для разработчиков. Роут регистрируется ТОЛЬКО
// когда в окружении задан DEV_LOGIN_KEY (в проде переменная отсутствует,
// поэтому роут в прод вообще не попадает). Создаёт (или поднимает) тестовый
// аккаунт в локальной БД и выдаёт те же JWT-токены, что и обычный вход.
func DevLogin(c *fiber.Ctx) error {
	key := os.Getenv("DEV_LOGIN_KEY")
	if key == "" {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}

	supplied := c.Get("X-Dev-Key")
	if supplied == "" || supplied != key {
		return c.Status(401).JSON(fiber.Map{"error": "Invalid dev key"})
	}

	username := strings.TrimSpace(os.Getenv("DEV_LOGIN_USERNAME"))
	if username == "" {
		username = "nexodev"
	}
	email := strings.ToLower(strings.TrimSpace(os.Getenv("DEV_LOGIN_EMAIL")))
	if email == "" {
		email = "dev@nexo.local"
	}
	displayName := strings.TrimSpace(os.Getenv("DEV_LOGIN_DISPLAY_NAME"))
	if displayName == "" {
		displayName = "Nexo Dev"
	}

	var user models.User
	result := db.GetDB().Where("email = ?", email).First(&user)
	if result.Error != nil {
		user = models.User{
			ID:            generateID(),
			Username:      username,
			DisplayName:   displayName,
			Email:         email,
			EmailVerified: true,
			Bio:           "Локальный аккаунт разработчика",
			IsOnline:      true,
		}
		if err := db.GetDB().Create(&user).Error; err != nil {
			log.Printf("error: dev login failed to create user: %v", err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to create dev user"})
		}
		log.Printf("[DEV] Создан локальный dev-аккаунт: %s (%s)", user.Username, user.ID)
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