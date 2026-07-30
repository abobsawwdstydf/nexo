package handlers

import (
	"crypto/sha256"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"nexo/db"
	"nexo/models"

	"github.com/gofiber/fiber/v2"
)

// POST /vault/upload
func VaultUpload(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "File required"})
	}

	// Save file — sanitize filename to prevent path traversal
	safeFilename := filepath.Base(file.Filename)
	filename := generateID() + "_" + safeFilename
	savePath := filepath.Join("..", "uploads", "vault", filename)
	os.MkdirAll("../uploads/vault", 0755)
	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save file"})
	}

	// Calculate checksum
	f, _ := os.Open(savePath)
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err == nil {
		// checksum calculated
	}

	// Detect MIME type server-side
	mimeType := "application/octet-stream"
	if f, err := os.Open(savePath); err == nil {
		buf := make([]byte, 512)
		if n, _ := f.Read(buf); n > 0 {
			mimeType = http.DetectContentType(buf[:n])
		}
		f.Close()
	}

	vaultFile := models.VaultFile{
		ID:           generateID(),
		UserID:       userID,
		Filename:     safeFilename,
		EncryptedURL: "/uploads/vault/" + filename,
		Size:         file.Size,
		MimeType:     mimeType,
		Checksum:     fmt.Sprintf("%x", h.Sum(nil)),
		CreatedAt:    time.Now(),
	}
	db.GetDB().Create(&vaultFile)

	return c.Status(201).JSON(vaultFile)
}

// GET /vault/files
func VaultList(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var files []models.VaultFile
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&files)

	return c.JSON(fiber.Map{"items": files})
}

// GET /vault/files/:id/download
func VaultDownload(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var file models.VaultFile
	if err := db.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&file).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File not found"})
	}

	return c.JSON(fiber.Map{
		"url":      file.EncryptedURL,
		"filename": file.Filename,
		"size":     file.Size,
		"mimeType": file.MimeType,
	})
}

// DELETE /vault/files/:id
func VaultDelete(c *fiber.Ctx) error {
	id := c.Params("id")
	userID := c.Locals("userId").(string)

	var file models.VaultFile
	if err := db.GetDB().Where("id = ? AND user_id = ?", id, userID).First(&file).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "File not found"})
	}

	// Delete physical file
	os.Remove("." + file.EncryptedURL)
	db.GetDB().Delete(&file)

	return c.JSON(fiber.Map{"success": true})
}

// GET /vault/stats
func VaultStats(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var totalSize int64
	var fileCount int64
	db.GetDB().Model(&models.VaultFile{}).Where("user_id = ?", userID).Count(&fileCount).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	return c.JSON(fiber.Map{
		"totalSize": totalSize,
		"fileCount": fileCount,
		"maxSize":   1024 * 1024 * 1024 * 5, // 5GB
	})
}
