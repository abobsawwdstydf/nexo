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

	// Build ICE servers list
	iceServers := []fiber.Map{}

	// STUN servers: from env, or safe public defaults
	stunList := stunURLs
	if stunList == "" {
		stunList = "stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302"
	}
	for _, url := range strings.Split(stunList, ",") {
		url = strings.TrimSpace(url)
		if url != "" {
			iceServers = append(iceServers, fiber.Map{
				"urls": url,
			})
		}
	}

	// TURN server: only when a real secret + URL are configured
	turnOK := turnSecret != "" && turnSecret != "your-turn-secret-here" &&
		turnURL != "" && !strings.Contains(turnURL, "your-server-ip")
	if turnOK {
		// Generate one short-lived credential pair. The username passed to coturn
		// must be exactly the value used to calculate its HMAC.
		username, credential := GenerateTURNHMAC(turnSecret, userID, 3600)

		iceServers = append(iceServers, fiber.Map{
			"urls":       turnURL,
			"username":   username + ":" + userID,
			"credential": credential,
		})
	}

	return c.JSON(fiber.Map{
		"iceServers": iceServers,
		"ttl":        3600,
	})
}
