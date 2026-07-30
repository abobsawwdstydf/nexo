package middleware

import (
    "github.com/gofiber/fiber/v2"
    "nexo/db"
)

func DBMiddleware() fiber.Handler {
    return func(c *fiber.Ctx) error {
        ctx := db.WithDB(c.Context(), db.GetDB())
        c.SetUserContext(ctx)
        return c.Next()
    }
}
