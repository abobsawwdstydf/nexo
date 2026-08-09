package handlers

import (
	"log"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
)

// User-created sticker & emoji packs. Sticker files are stored on the file
// server (../uploads/stickers/<packID>/<file>) and served at /uploads/...,
// while official Nexo stickers stay in the frontend bundle.

const (
	maxUserPacks       = 20
	maxStickersPerPack = 100
	maxStickerSize     = 5 * 1024 * 1024 // 5 MB per image
)

func userStickerPackDir(packID string) string {
	return filepath.Join(UploadDir(), "stickers", packID)
}

func CreateUserStickerPack(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Type        string `json:"type"` // sticker | emoji
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	name := strings.TrimSpace(req.Name)
	if name == "" || len([]rune(name)) > 40 {
		return c.Status(400).JSON(fiber.Map{"error": "Pack name is required (max 40 chars)"})
	}
	if len([]rune(req.Description)) > 200 {
		return c.Status(400).JSON(fiber.Map{"error": "Description too long (max 200 chars)"})
	}

	packType := strings.TrimSpace(req.Type)
	if packType == "" {
		packType = "sticker"
	}
	if packType != "sticker" && packType != "emoji" {
		return c.Status(400).JSON(fiber.Map{"error": "Pack type must be 'sticker' or 'emoji'"})
	}

	// Anti-abuse: limit number of packs per user
	var packCount int64
	if err := db.GetDB().Model(&models.StickerPack{}).Where("creator_id = ?", userID).Count(&packCount).Error; err == nil && packCount >= maxUserPacks {
		return c.Status(429).JSON(fiber.Map{"error": "Pack limit reached (max 20)"})
	}

	pack := models.StickerPack{
		ID:          generateID(),
		Name:        name,
		Description: req.Description,
		CreatorID:   userID,
		Type:        packType,
		IsPublic:    false,
	}
	if err := db.GetDB().Create(&pack).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create pack"})
	}

	// Create the on-disk folder for this pack
	os.MkdirAll(userStickerPackDir(pack.ID), 0755)

	return c.Status(201).JSON(pack)
}

func GetMyStickerPacks(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var packs []models.StickerPack
	if err := db.GetDB().
		Where("creator_id = ?", userID).
		Order("created_at DESC").
		Preload("Stickers", func(db *gorm.DB) *gorm.DB { return db.Order("`order` ASC") }).
		Find(&packs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load packs"})
	}

	return c.JSON(packs)
}

// GetUserStickerPacks — public list of a user's packs (used by the receiver
// side to render foreign user stickers).
func GetUserStickerPacks(c *fiber.Ctx) error {
	userID := c.Params("userId")
	if userID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing userId"})
	}

	var packs []models.StickerPack
	if err := db.GetDB().
		Where("creator_id = ?", userID).
		Order("created_at ASC").
		Preload("Stickers", func(db *gorm.DB) *gorm.DB { return db.Order("`order` ASC") }).
		Find(&packs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load packs"})
	}

	return c.JSON(packs)
}

func UploadUserSticker(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	packID := c.Params("packId")

	// Verify ownership
	var pack models.StickerPack
	if err := db.GetDB().Where("id = ?", packID).First(&pack).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pack not found"})
	}
	if pack.CreatorID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your pack"})
	}

	// Anti-abuse: limit stickers per pack
	var stickerCount int64
	if err := db.GetDB().Model(&models.Sticker{}).Where("pack_id = ?", packID).Count(&stickerCount).Error; err == nil && stickerCount >= maxStickersPerPack {
		return c.Status(429).JSON(fiber.Map{"error": "Sticker limit reached (max 100)"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file provided"})
	}
	if file.Size > maxStickerSize {
		return c.Status(400).JSON(fiber.Map{"error": "Sticker too large (max 5MB)"})
	}

	// Images only — same magic-byte validation as chat uploads
	allowedTypes := map[string]bool{
		"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true,
	}
	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open file"})
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, err := src.Read(buf)
	if err != nil && n == 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read file header"})
	}
	contentType := detectContentType(buf[:n], file.Filename, file.Header.Get("Content-Type"))
	if !allowedTypes[contentType] {
		return c.Status(400).JSON(fiber.Map{"error": "Only images are allowed (PNG, JPEG, GIF, WebP)"})
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" || !isExtensionCompatible(ext, contentType) {
		ext = mimeToExt(contentType)
	}
	filename := generateID() + ext

	dir := userStickerPackDir(packID)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to prepare storage"})
	}
	savePath := filepath.Join(dir, filename)
	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save file"})
	}

	info, _ := os.Stat(savePath)
	size := 0
	if info != nil {
		size = int(info.Size())
	}

	// Determine emoji label (optional, from form field)
	emoji := strings.TrimSpace(c.FormValue("emoji"))
	if emoji == "" {
		emoji = "🆕"
	}
	if len([]rune(emoji)) > 8 {
		emoji = "🆕"
	}

	// Next order value
	var maxOrder int
	db.GetDB().Model(&models.Sticker{}).Where("pack_id = ?", packID).Select("COALESCE(MAX(`order`), -1) + 1").Scan(&maxOrder)

	sticker := models.Sticker{
		ID:       generateID(),
		PackID:   packID,
		Emoji:    emoji,
		FileURL:  "/uploads/stickers/" + packID + "/" + filename,
		FileSize: size,
		Order:    maxOrder,
	}
	if err := db.GetDB().Create(&sticker).Error; err != nil {
		os.Remove(savePath)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save sticker"})
	}

	return c.Status(201).JSON(sticker)
}

func DeleteUserSticker(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	stickerID := c.Params("stickerId")

	var sticker models.Sticker
	if err := db.GetDB().Where("id = ?", stickerID).First(&sticker).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sticker not found"})
	}

	// Ownership via pack
	var pack models.StickerPack
	if err := db.GetDB().Where("id = ?", sticker.PackID).First(&pack).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pack not found"})
	}
	if pack.CreatorID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your sticker"})
	}

	// Remove file from disk (best effort)
	if fileName := filepath.Base(sticker.FileURL); fileName != "." && fileName != "" {
		os.Remove(filepath.Join(userStickerPackDir(pack.ID), fileName))
	}

	if err := db.GetDB().Delete(&models.Sticker{}, "id = ?", stickerID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete sticker"})
	}
	return c.JSON(fiber.Map{"ok": true})
}

func DeleteUserStickerPack(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	packID := c.Params("packId")

	var pack models.StickerPack
	if err := db.GetDB().Where("id = ?", packID).First(&pack).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Pack not found"})
	}
	if pack.CreatorID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your pack"})
	}

	// Remove all stickers + files
	var stickers []models.Sticker
	db.GetDB().Where("pack_id = ?", packID).Find(&stickers)
	for _, s := range stickers {
		if fileName := filepath.Base(s.FileURL); fileName != "." && fileName != "" {
			os.Remove(filepath.Join(userStickerPackDir(packID), fileName))
		}
	}
	os.RemoveAll(userStickerPackDir(packID))

	if err := db.GetDB().Delete(&models.Sticker{}, "pack_id = ?", packID).Error; err != nil {
		log.Printf("[Stickers] failed to delete pack stickers: %v", err)
	}
	if err := db.GetDB().Delete(&models.StickerPack{}, "id = ?", packID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete sticker pack"})
	}
	return c.JSON(fiber.Map{"ok": true})
}
