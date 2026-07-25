package handlers

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

const badgeStorageDir = "./uploads/badges"

func init() {
	os.MkdirAll(badgeStorageDir, 0755)
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
		oldFile := filepath.Join(badgeStorageDir, filepath.Base(user.PremiumBadgeUrl))
		os.Remove(oldFile)
	}

	// Save new badge
	filename := generateID() + ext
	savePath := filepath.Join(badgeStorageDir, filename)

	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось сохранить файл"})
	}

	badgeURL := "/uploads/badges/" + filename

	db.GetDB().Model(&user).Update("premium_badge_url", badgeURL)

	log.Printf("[BADGE] Uploaded: userId=%s filename=%s", userID, file.Filename)

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
		oldFile := filepath.Join(badgeStorageDir, filepath.Base(user.PremiumBadgeUrl))
		os.Remove(oldFile)
	}

	db.GetDB().Model(&user).Update("premium_badge_url", "")

	log.Printf("[BADGE] Deleted: userId=%s", userID)

	return c.JSON(fiber.Map{"ok": true})
}
