package handlers

import (
	"os"
	"strings"

	"github.com/gofiber/fiber/v2"
)

func GetTurnCredentials(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	turnSecret := os.Getenv("TURN_SECRET")
	turnURL := os.Getenv("TURN_URL")
	stunURLs := os.Getenv("STUN_URLS")

	if turnSecret == "" || turnSecret == "your-turn-secret-here" {
		return c.Status(503).JSON(fiber.Map{"error": "TURN server not configured"})
	}

	// Generate temporary credentials (HMAC-SHA1, valid 24 hours)
	_, credential := GenerateTURNHMAC(turnSecret, userID, 86400)
	ttlStr, _ := GenerateTURNHMAC(turnSecret, userID, 86400)

	// Build ICE servers list
	iceServers := []fiber.Map{}

	// STUN servers
	if stunURLs != "" {
		for _, url := range strings.Split(stunURLs, ",") {
			url = strings.TrimSpace(url)
			if url != "" {
				iceServers = append(iceServers, fiber.Map{
					"urls": url,
				})
			}
		}
	}

	// TURN server
	if turnURL != "" {
		iceServers = append(iceServers, fiber.Map{
			"urls":       turnURL,
			"username":   ttlStr + ":" + userID,
			"credential": credential,
		})
	}

	return c.JSON(fiber.Map{
		"iceServers": iceServers,
		"ttl":        86400,
	})
}
