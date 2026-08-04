package handlers

import (
	"crypto/sha256"
	"fmt"
	"io"
	"log"
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

	// Enforce per-file size limit (was unlimited — disk exhaustion risk)
	if file.Size > maxVaultFileSize {
		return c.Status(413).JSON(fiber.Map{"error": "File too large (max 100 MB)"})
	}

	// Enforce per-user storage quota (5 GB)
	var totalSize int64
	db.GetDB().Model(&models.VaultFile{}).Where("user_id = ?", userID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)
	if totalSize+file.Size > maxVaultTotalSize {
		return c.Status(413).JSON(fiber.Map{"error": "Vault storage limit reached (5 GB)"})
	}

	// Save file — sanitize filename to prevent path traversal
	safeFilename := filepath.Base(file.Filename)
	filename := generateID() + "_" + safeFilename
	vaultDir := filepath.Join(UploadDir(), "vault")
	savePath := filepath.Join(vaultDir, filename)
	if err := os.MkdirAll(vaultDir, 0755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create directory"})
	}
	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save file"})
	}

	// Calculate checksum
	var checksum string
	f, err := os.Open(savePath)
	if err == nil {
		h := sha256.New()
		if _, err := io.Copy(h, f); err == nil {
			checksum = fmt.Sprintf("%x", h.Sum(nil))
		}
		f.Close()
	}

	// Detect MIME type server-side
	mimeType := "application/octet-stream"
	if f, err := os.Open(savePath); err == nil {
		buf := make([]byte, 512)
		if n, err := f.Read(buf); err == nil && n > 0 {
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
		Checksum:     checksum,
		CreatedAt:    time.Now(),
	}
	if err := db.GetDB().Create(&vaultFile).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save file record"})
	}

	return c.Status(201).JSON(vaultFile)
}

// GET /vault/files
func VaultList(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var files []models.VaultFile
	if err := db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&files).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to list files"})
	}

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
	if err := os.Remove("." + file.EncryptedURL); err != nil {
		log.Printf("[VAULT] Failed to delete physical file: %v", err)
	}
	if err := db.GetDB().Delete(&file).Error; err != nil {
		log.Printf("[VAULT] Failed to delete file record: %v", err)
	}

	return c.JSON(fiber.Map{"success": true})
}

// GET /vault/stats
func VaultStats(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var totalSize int64
	var fileCount int64
	db.GetDB().Model(&models.VaultFile{}).Where("user_id = ?", userID).Count(&fileCount)
	db.GetDB().Model(&models.VaultFile{}).Where("user_id = ?", userID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	return c.JSON(fiber.Map{
		"totalSize": totalSize,
		"fileCount": fileCount,
		"maxSize":   maxVaultTotalSize,
	})
}

const (
	// maxVaultFileSize — per-file upload limit for the encrypted vault
	maxVaultFileSize = 100 * 1024 * 1024
	// maxVaultTotalSize — per-user storage quota (5 GB)
	maxVaultTotalSize = 5 * 1024 * 1024 * 1024
)
