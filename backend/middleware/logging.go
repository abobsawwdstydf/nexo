package middleware

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/logging"
)

// StructuredLogging logs every request as a structured JSON line:
// method, path, status, duration, remote IP. Slows down nothing measurable
// and replaces ad-hoc fmt.Printf lines in hot paths.
func StructuredLogging() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		status := c.Response().StatusCode()
		logging.Log.Info("http_request",
			"method", c.Method(),
			"path", c.Path(),
			"status", status,
			"duration_ms", time.Since(start).Milliseconds(),
			"ip", c.IP(),
			"user_id", c.Locals("userId"),
		)
		return err
	}
}
