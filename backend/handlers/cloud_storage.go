package handlers

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

// Kept in sync with the /uploads static mount in main.go.
func cloudDir() string { return filepath.Join(UploadDir(), "cloud") }

func init() {
	if err := os.MkdirAll(cloudDir(), 0755); err != nil {
		log.Printf("[CLOUD] Failed to create storage directory: %v", err)
	}
}

// ─── Premium check ─────────────────────────────────────────────────────

func isPremium(userID string) bool {
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return false
	}
	if !user.IsPremium {
		return false
	}
	if user.PremiumUntil != nil && user.PremiumUntil.Before(time.Now()) {
		return false
	}
	return true
}

// ─── Upload file to cloud storage ─────────────────────────────────────

func CloudUpload(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	if !isPremium(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Требуется подписка Нексо НУче"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Файл не указан"})
	}

	// 100MB limit for cloud storage
	if file.Size > 100*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "Файл слишком большой (макс. 100 МБ)"})
	}

	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось открыть файл"})
	}
	defer src.Close()

	// Read first 512 bytes for content type detection
	buf := make([]byte, 512)
	n, err := src.Read(buf)
	if err != nil && n == 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось прочитать файл"})
	}
	contentType := detectContentType(buf[:n], file.Filename, file.Header.Get("Content-Type"))

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext == "" {
		ext = mimeToExt(contentType)
	}

	// Cross-check extension vs detected content type
	if ext != "" {
		if !isExtensionCompatible(ext, contentType) {
			return c.Status(400).JSON(fiber.Map{"error": "Расширение файла не соответствует содержимому"})
		}
	}

	// SECURITY: uploaded files are served by Fiber SendFile, which derives the
	// Content-Type from the file extension on the app origin. Only allow
	// extensions that cannot execute script in the browser — .svg/.html/.xml
	// (stored XSS), .php/.sh etc. are rejected.
	if !isSafeCloudExtension(ext) {
		return c.Status(400).JSON(fiber.Map{"error": "Недопустимый тип файла"})
	}

	// Generate unique filename
	filename := generateID() + ext
	savePath := filepath.Join(cloudDir(), filename)

	if err := c.SaveFile(file, savePath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось сохранить файл"})
	}

	// Determine media type category
	mediaType := "other"
	if strings.HasPrefix(contentType, "image/") {
		mediaType = "image"
	} else if strings.HasPrefix(contentType, "video/") {
		mediaType = "video"
	} else if strings.HasPrefix(contentType, "audio/") {
		mediaType = "audio"
	} else if contentType == "application/pdf" || strings.HasPrefix(contentType, "text/") {
		mediaType = "document"
	}

	cloudFile := models.CloudFile{
		ID:        generateID(),
		UserID:    userID,
		Filename:  filepath.Base(file.Filename),
		URL:       "/uploads/cloud/" + filename,
		Size:      file.Size,
		Type:      mediaType,
		MimeType:  contentType,
		CreatedAt: time.Now(),
	}

	if err := db.GetDB().Create(&cloudFile).Error; err != nil {
		log.Printf("[CLOUD] Failed to save file record: %v", err)
		os.Remove(savePath)
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось сохранить запись"})
	}

	log.Printf("[CLOUD] Uploaded: userId=%s fileId=%s filename=%s size=%d", userID, cloudFile.ID, file.Filename, file.Size)

	return c.Status(201).JSON(cloudFile)
}

// ─── List user's cloud files ──────────────────────────────────────────

func CloudList(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var files []models.CloudFile
	if result := db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Find(&files); result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Не удалось загрузить файлы"})
	}

	// Calculate total size
	var totalSize int64
	for _, f := range files {
		totalSize += f.Size
	}

	return c.JSON(fiber.Map{
		"files":     files,
		"total":     len(files),
		"totalSize": totalSize,
	})
}

// ─── Delete a cloud file ──────────────────────────────────────────────

func CloudDelete(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	fileID := c.Params("fileId")

	var cloudFile models.CloudFile
	if result := db.GetDB().Where("id = ? AND user_id = ?", fileID, userID).First(&cloudFile); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Файл не найден"})
	}

	// Delete physical file
	filename := filepath.Base(cloudFile.URL)
	filePath := filepath.Join(cloudDir(), filename)
	if err := os.Remove(filePath); err != nil {
		log.Printf("[CLOUD] Failed to delete physical file: %v", err)
	}

	// Delete record
	if err := db.GetDB().Delete(&cloudFile).Error; err != nil {
		log.Printf("[CLOUD] Failed to delete file record: %v", err)
	}

	log.Printf("[CLOUD] Deleted: userId=%s fileId=%s", userID, fileID)

	return c.JSON(fiber.Map{"ok": true})
}

// ─── Get storage stats ────────────────────────────────────────────────

func CloudStats(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var totalSize int64
	var fileCount int64
	db.GetDB().Model(&models.CloudFile{}).Where("user_id = ?", userID).Count(&fileCount)
	db.GetDB().Model(&models.CloudFile{}).Where("user_id = ?", userID).Select("COALESCE(SUM(size), 0)").Scan(&totalSize)

	return c.JSON(fiber.Map{
		"totalSize": totalSize,
		"fileCount": fileCount,
		"maxSize":   -1, // unlimited for premium
		"formatted": fmt.Sprintf("%.1f МБ", float64(totalSize)/(1024*1024)),
	})
}
