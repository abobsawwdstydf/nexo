package handlers

import (
	"nexo/logging"
	"regexp"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

// ─── Scheduled DND (Do Not Disturb) ────────────────────────────────────────
// User-level daily schedule: notifications (push) are suppressed while the
// user's local time (UTC + timezoneOffsetMin) falls inside [start, end).
// Supports intervals crossing midnight (start > end ⇒ active if t ≥ start or
// t < end).

// DNDSettingsJSON is the serializable shape of the scheduled-DND settings.
type DNDSettingsJSON struct {
	Enabled           bool   `json:"enabled"`
	Start             string `json:"start"`
	End               string `json:"end"`
	TimezoneOffsetMin int    `json:"timezoneOffsetMin"`
}

var dndTimeRegex = regexp.MustCompile(`^([01][0-9]|2[0-3]):[0-5][0-9]$`)

func dndSettingsFromUser(user *models.User) DNDSettingsJSON {
	return DNDSettingsJSON{
		Enabled:           user.DndEnabled,
		Start:             user.DndStart,
		End:               user.DndEnd,
		TimezoneOffsetMin: user.DndTimezoneOffsetMin,
	}
}

// GetDNDSettings returns the current scheduled-DND settings (GET /api/settings/dnd).
func GetDNDSettings(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	return c.JSON(fiber.Map{"ok": true, "dnd": dndSettingsFromUser(&user)})
}

// UpdateDNDSettings saves the scheduled-DND settings (PUT /api/settings/dnd).
// Body: {enabled bool, start?, end? ("HH:MM"), timezoneOffsetMin? (minutes, -840..840)}.
func UpdateDNDSettings(c *fiber.Ctx) error {
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Enabled           *bool   `json:"enabled"`
		Start             *string `json:"start"`
		End               *string `json:"end"`
		TimezoneOffsetMin *int    `json:"timezoneOffsetMin"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var user models.User
	if err := db.GetDB().First(&user, "id = ?", userID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if req.Enabled != nil {
		user.DndEnabled = *req.Enabled
	}
	if req.Start != nil {
		if !dndTimeRegex.MatchString(*req.Start) {
			return c.Status(400).JSON(fiber.Map{"error": "start must be in HH:MM format"})
		}
		user.DndStart = *req.Start
	}
	if req.End != nil {
		if !dndTimeRegex.MatchString(*req.End) {
			return c.Status(400).JSON(fiber.Map{"error": "end must be in HH:MM format"})
		}
		user.DndEnd = *req.End
	}
	if req.TimezoneOffsetMin != nil {
		if *req.TimezoneOffsetMin < -840 || *req.TimezoneOffsetMin > 840 {
			return c.Status(400).JSON(fiber.Map{"error": "timezoneOffsetMin must be between -840 and 840"})
		}
		user.DndTimezoneOffsetMin = *req.TimezoneOffsetMin
	}

	updates := map[string]interface{}{
		"dnd_enabled":            user.DndEnabled,
		"dnd_start":              user.DndStart,
		"dnd_end":                user.DndEnd,
		"dnd_timezone_offset_min": user.DndTimezoneOffsetMin,
	}
	if err := db.GetDB().Model(&models.User{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
		logging.Log.Error("[DND] save error", "user_id", userID, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save settings"})
	}

	return c.JSON(fiber.Map{"ok": true, "dnd": dndSettingsFromUser(&user)})
}

// isDndActive reports whether scheduled DND is active for the user at `now`.
// Local time = now.UTC() + timezoneOffsetMin. Active when local HH:MM falls in
// [start, end); when start > end the window crosses midnight.
func isDndActive(user *models.User, now time.Time) bool {
	if user == nil || !user.DndEnabled {
		return false
	}
	startMin, ok1 := parseHHMM(user.DndStart)
	endMin, ok2 := parseHHMM(user.DndEnd)
	if !ok1 || !ok2 {
		return false
	}

	local := now.UTC().Add(time.Duration(user.DndTimezoneOffsetMin) * time.Minute)
	current := local.Hour()*60 + local.Minute()

	if startMin <= endMin {
		return current >= startMin && current < endMin
	}
	// Window crosses midnight: active before end or from start onward.
	return current >= startMin || current < endMin
}

func parseHHMM(s string) (int, bool) {
	if !dndTimeRegex.MatchString(s) {
		return 0, false
	}
	h, err1 := strconv.Atoi(s[0:2])
	m, err2 := strconv.Atoi(s[3:5])
	if err1 != nil || err2 != nil {
		return 0, false
	}
	return h*60 + m, true
}

// getMutedChatIDs returns the chat IDs where the user has server-side mute
// enabled (ChatMember.isMuted = true) — used by /api/init and fetch_init.
func getMutedChatIDs(userID string) []string {
	var ids []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ? AND is_muted = ?", userID, true).
		Pluck("chat_id", &ids)
	if ids == nil {
		ids = []string{}
	}
	return ids
}
