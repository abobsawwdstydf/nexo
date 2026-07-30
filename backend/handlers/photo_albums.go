package handlers

import (
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /albums
func CreatePhotoAlbum(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	album := models.PhotoAlbum{
		ID:          generateID(),
		UserID:      userID,
		Name:        req.Name,
		Description: req.Description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	db.GetDB().Create(&album)

	return c.Status(201).JSON(album)
}

// GET /albums
func GetPhotoAlbums(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var albums []models.PhotoAlbum
	db.GetDB().Where("user_id = ?", userID).Preload("Photos").Order("created_at DESC").Find(&albums)

	return c.JSON(fiber.Map{"items": albums})
}

// GET /albums/:id
func GetPhotoAlbum(c *fiber.Ctx) error {
	id := c.Params("id")

	var album models.PhotoAlbum
	if err := db.GetDB().Where("id = ?", id).Preload("Photos").First(&album).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Album not found"})
	}

	return c.JSON(album)
}

// PUT /albums/:id
func UpdatePhotoAlbum(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		CoverURL    string `json:"coverUrl"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.CoverURL != "" && !safeURLRe.MatchString(req.CoverURL) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid cover URL"})
	}

	updates := map[string]interface{}{
		"updated_at": time.Now(),
	}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.CoverURL != "" {
		updates["cover_url"] = req.CoverURL
	}

	db.GetDB().Model(&models.PhotoAlbum{}).Where("id = ? AND user_id = ?", id, userID).Updates(updates)

	return c.JSON(fiber.Map{"success": true})
}

// DELETE /albums/:id
func DeletePhotoAlbum(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("id = ? AND user_id = ?", id, userID).Delete(&models.PhotoAlbum{})
	db.GetDB().Where("album_id = ?", id).Delete(&models.PhotoAlbumItem{})

	return c.JSON(fiber.Map{"success": true})
}

// POST /albums/:id/photos
func AddPhotoToAlbum(c *fiber.Ctx) error {
	albumID := c.Params("id")

	var req struct {
		MediaID string `json:"mediaId"`
		Caption string `json:"caption"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// Get max order
	var maxOrder int
	db.GetDB().Model(&models.PhotoAlbumItem{}).Where("album_id = ?", albumID).Select("COALESCE(MAX(\"order\"), 0)").Scan(&maxOrder)

	photo := models.PhotoAlbumItem{
		ID:        generateID(),
		AlbumID:   albumID,
		MediaID:   req.MediaID,
		Caption:   req.Caption,
		Order:     maxOrder + 1,
		CreatedAt: time.Now(),
	}
	db.GetDB().Create(&photo)

	return c.Status(201).JSON(photo)
}
