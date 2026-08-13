package handlers

import (
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/logging"
)

// Kept in sync with the /uploads static mount in main.go.
func badgeDir() string { return filepath.Join(UploadDir(), "badges") }

func init() {
	if err := os.MkdirAll(badgeDir(), 0755); err != nil {
		logging.Log.Error("[BADGE] Failed to create badge directory", "err", err)
	}
}

// ─── Upload premium badge ─────────────────────────────────────────────

func UploadPremiumBadge(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	if !isPremium(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Требуется подписка Нексо НУче"})
	}

	file, err := c.FormFile("badge")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Файл не указан"})
	}

	// Only images allowed, max 5MB
	if file.Size > 5*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "Файл слишком большой (макс. 5 МБ)"})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".webp": true}
	if !allowedExts[ext] {
		return c.Status(400).JSON(fiber.Map{"error": "Допустимые форматы: PNG, JPG, GIF, WebP"})
	}

	// Delete old badge if exists
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Пользователь не найден"})
	}

	if user.PremiumBadgeUrl != "" {
		oldFile := filepath.Join(badgeDir(), filepath.Base(user.PremiumBadgeUrl))
		if err := os.Remove(oldFile); err != nil {
			logging.Log.Error("[BADGE] Failed to delete old badge", "err", err)
		}
	}

	// Validate MIME type server-side (not just extension)
	f, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open file"})
	}
	buf := make([]byte, 512)
	n, err := f.Read(buf)
	f.Close()
	if err == nil && n > 0 {
		mimeType := http.DetectContentType(buf[:n])
		if !strings.HasPrefix(mimeType, "image/") {
			return c.Status(400).JSON(fiber.Map{"error": "File is not a valid image"})
		}
	}

	// Save new badge
	filename := generateID() + ext
	savePath := filepath.Join(badgeDir(), filename)

	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось сохранить файл"})
	}

	badgeURL := "/uploads/badges/" + filename

	db.GetDB().Model(&user).Update("premium_badge_url", badgeURL)

	logging.Log.Info("[BADGE] Uploaded", "user_id", userID, "filename", file.Filename)

	return c.JSON(fiber.Map{
		"premiumBadgeUrl": badgeURL,
	})
}

// ─── Delete premium badge ─────────────────────────────────────────────

func DeletePremiumBadge(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Пользователь не найден"})
	}

	if user.PremiumBadgeUrl != "" {
		oldFile := filepath.Join(badgeDir(), filepath.Base(user.PremiumBadgeUrl))
		if err := os.Remove(oldFile); err != nil {
			logging.Log.Error("[BADGE] Failed to delete badge file", "err", err)
		}
	}

	db.GetDB().Model(&user).Update("premium_badge_url", "")

	logging.Log.Info("[BADGE] Deleted", "user_id", userID)

	return c.JSON(fiber.Map{"ok": true})
}

