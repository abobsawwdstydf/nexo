package middleware

import (
	"log/slog"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"
)

var logger = slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
	Level: slog.LevelInfo,
}))

// StructuredLogging logs every request as a structured JSON line:
// method, path, status, duration, remote IP. Slows down nothing measurable
// and replaces ad-hoc fmt.Printf lines in hot paths.
func StructuredLogging() fiber.Handler {
	return func(c *fiber.Ctx) error {
		start := time.Now()
		err := c.Next()
		status := c.Response().StatusCode()
		logger.Info("http_request",
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