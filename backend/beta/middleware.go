package beta

import "github.com/gofiber/fiber/v2"

func BetaGuard() fiber.Handler {
	return func(c *fiber.Ctx) error {
		if IsBetaEnded() || BetaEndedManually() {
			return c.Status(403).JSON(fiber.Map{
				"error":   "beta_ended",
				"message": "Бета закончена, ждите официального релиза",
			})
		}
		return c.Next()
	}
}
