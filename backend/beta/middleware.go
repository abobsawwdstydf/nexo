package beta

import (
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
)

// EarlyAccessEmail — единственный аккаунт с доступом до официального старта беты
const EarlyAccessEmail = "nexo.su.support@gmail.com"

// StartMessage — сообщение до старта беты (время указано по МСК)
const StartMessage = "Нексо откроется 6 августа в 6:00 (МСК)"

// publicPrefixes — маршруты, необходимые для входа и публичных статусов
var publicPrefixes = []string{
	"/api/auth/",
	"/api/captcha/",
	"/api/beta/",
	"/api/bot/",
	"/api/stickers/",
}

func BetaGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if IsBetaEnded() || BetaEndedManually() {
			return c.Status(403).JSON(fiber.Map{
				"error":   "beta_ended",
				"message": "Бета закончена, ждите официального релиза",
			})
		}

		// До официального старта пропускаем только вход и публичные статусы,
		// а остальной API доступен лишь аккаунту раннего доступа.
		if !IsBetaActive() {
			path := c.Path()
			for _, p := range publicPrefixes {
				if strings.HasPrefix(path, p) {
					return c.Next()
				}
			}
			if earlyAccessAllowed(c) {
				return c.Next()
			}
			return c.Status(403).JSON(fiber.Map{
				"error":   "beta_not_started",
				"message": StartMessage,
			})
		}

		return c.Next()
	}
}

// earlyAccessAllowed проверяет, что JWT принадлежит аккаунту раннего доступа
func earlyAccessAllowed(c *fiber.Ctx) bool {
	authHeader := c.Get("Authorization")
	if authHeader == "" {
		return false
	}

	parts := strings.SplitN(authHeader, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return false
	}

	claims := &middleware.Claims{}
	token, err := jwt.ParseWithClaims(parts[1], claims, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return middleware.JWTSecret, nil
	})
	if err != nil || !token.Valid {
		return false
	}

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", claims.UserID); result.Error != nil {
		return false
	}
	return strings.EqualFold(user.Email, EarlyAccessEmail)
}
