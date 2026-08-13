package handlers

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"

	"nexo/models"
	"nexo/logging"
)

// The server is run from backend/, while public uploads live at the project
// root and are served by main.go at /uploads. Override with UPLOAD_DIR for
// deployments where the working directory differs (e.g. systemd services).
func UploadDir() string {
	if d := os.Getenv("UPLOAD_DIR"); d != "" {
		return d
	}
	return "../uploads"
}

func UploadFile(c *fiber.Ctx) error {
	if id, ok := c.Locals("userId").(string); !ok || id == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	file, err := c.FormFile("file")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "No file provided"})
	}

	// Validate file size (50MB max)
	if file.Size > 50*1024*1024 {
		return c.Status(400).JSON(fiber.Map{"error": "File too large (max 50MB)"})
	}

	// Validate MIME type. Do not trust a browser supplied Content-Type alone:
	// it is used only to disambiguate the WebM container (audio or video).
	allowedTypes := map[string]bool{
		"image/png": true, "image/jpeg": true, "image/gif": true, "image/webp": true,
		"video/mp4": true, "video/webm": true, "video/quicktime": true,
		"audio/mpeg": true, "audio/ogg": true, "audio/wav": true, "audio/webm": true,
		"application/pdf": true,
	}

	src, err := file.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open file"})
	}
	defer src.Close()

	// Read first 512 bytes for content type detection
	buf := make([]byte, 512)
	n, err := src.Read(buf)
	if err != nil && n == 0 {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to read file header"})
	}
	contentType := detectContentType(buf[:n], file.Filename, file.Header.Get("Content-Type"))

	if !allowedTypes[contentType] {
		return c.Status(400).JSON(fiber.Map{"error": "File type not allowed: " + contentType})
	}

	// SECURITY: Cross-check file extension vs detected content-type
	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != "" {
		if !isExtensionCompatible(ext, contentType) {
			return c.Status(400).JSON(fiber.Map{"error": "File extension does not match content"})
		}
	}

	// Generate unique filename — sanitize original name, strip path components
	if ext == "" {
		ext = mimeToExt(contentType)
	}
	filename := generateID() + ext
	savePath := filepath.Join(UploadDir(), filename)

	// Save file
	if err := c.SaveFile(file, savePath); err != nil {
		logging.Log.Error("[UPLOAD] Failed to save file", "path", savePath, "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save file"})
	}

	// Get file info
	info, _ := os.Stat(savePath)
	size := 0
	if info != nil {
		size = int(info.Size())
	}

	originalFormat := contentType
	mediaType := "file"
	if strings.HasPrefix(contentType, "image/") {
		mediaType = "image"
	} else if strings.HasPrefix(contentType, "video/") {
		mediaType = "video"
	} else if strings.HasPrefix(contentType, "audio/") {
		mediaType = "audio"
	}

	media := models.Media{
		ID:             generateID(),
		Type:           mediaType,
		URL:            "/uploads/" + filename,
		Filename:       url.PathEscape(file.Filename),
		Size:           size,
		OriginalFormat: originalFormat,
	}

	return c.Status(201).JSON(media)
}

func detectContentType(data []byte, filename, claimedType string) string {
	// Check magic bytes
	if len(data) >= 8 {
		// PNG
		if data[0] == 0x89 && data[1] == 0x50 && data[2] == 0x4E && data[3] == 0x47 {
			return "image/png"
		}
		// JPEG
		if data[0] == 0xFF && data[1] == 0xD8 {
			return "image/jpeg"
		}
		// GIF
		if data[0] == 'G' && data[1] == 'I' && data[2] == 'F' {
			return "image/gif"
		}
		// WebP (RIFF header is 12 bytes; guard separately to avoid a short-slice panic)
		if len(data) >= 12 &&
			data[0] == 'R' && data[1] == 'I' && data[2] == 'F' && data[3] == 'F' && data[8] == 'W' && data[9] == 'E' && data[10] == 'B' && data[11] == 'P' {
			return "image/webp"
		}
		// PDF
		if data[0] == '%' && data[1] == 'P' && data[2] == 'D' && data[3] == 'F' {
			return "application/pdf"
		}
		// WebM is an EBML container. The container can hold either voice
		// (audio) or a video note, so only accept that hint after the signature
		// itself has been verified.
		if data[0] == 0x1A && data[1] == 0x45 && data[2] == 0xDF && data[3] == 0xA3 {
			if strings.EqualFold(strings.TrimSpace(strings.Split(claimedType, ";")[0]), "audio/webm") {
				return "audio/webm"
			}
			return "video/webm"
		}
	}

	// Fallback to extension
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		// WebM без EBML-заголовка = E2E-зашифрованные голосовые/кружки
		// (шифртекст не имеет магических байтов). Принимаем их, если клиент
		// честно заявляет webm-тип; мусор под видом webm отклоняем.
		claimed := strings.ToLower(strings.TrimSpace(strings.Split(claimedType, ";")[0]))
		if claimed == "audio/webm" || claimed == "video/webm" {
			return claimed
		}
		return ""
	case ".mov":
		return "video/quicktime"
	case ".mp3":
		return "audio/mpeg"
	case ".ogg":
		return "audio/ogg"
	case ".wav":
		return "audio/wav"
	case ".pdf":
		return "application/pdf"
	}

	return "application/octet-stream"
}

func isExtensionCompatible(ext, contentType string) bool {
	if ext == ".webm" {
		return contentType == "video/webm" || contentType == "audio/webm"
	}
	expectedMime := extToMime(ext)
	return expectedMime == "" || expectedMime == contentType
}

// isSafeCloudExtension reports whether the extension yields a Content-Type
// that cannot execute script when served from the app origin. Everything
// unknown/scriptable (.svg, .html, .xml, .php, ...) is rejected.
func isSafeCloudExtension(ext string) bool {
	switch strings.ToLower(ext) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp",
		".mp4", ".webm", ".mov", ".mp3", ".ogg", ".wav",
		".pdf", ".txt", ".md", ".json", ".csv",
		".zip", ".rar", ".7z", ".tar", ".gz", ".doc", ".docx",
		".xls", ".xlsx", ".ppt", ".pptx":
		return true
	}
	return false
}

func extToMime(ext string) string {
	switch ext {
	case ".png":
		return "image/png"
	case ".jpg", ".jpeg":
		return "image/jpeg"
	case ".gif":
		return "image/gif"
	case ".webp":
		return "image/webp"
	case ".mp4":
		return "video/mp4"
	case ".webm":
		return "video/webm"
	case ".mov":
		return "video/quicktime"
	case ".mp3":
		return "audio/mpeg"
	case ".ogg":
		return "audio/ogg"
	case ".wav":
		return "audio/wav"
	case ".pdf":
		return "application/pdf"
	}
	return ""
}

func mimeToExt(mime string) string {
	switch mime {
	case "image/png":
		return ".png"
	case "image/jpeg":
		return ".jpg"
	case "image/gif":
		return ".gif"
	case "image/webp":
		return ".webp"
	case "video/mp4":
		return ".mp4"
	case "video/webm":
		return ".webm"
	case "audio/webm":
		return ".webm"
	case "audio/mpeg":
		return ".mp3"
	case "audio/ogg":
		return ".ogg"
	case "audio/wav":
		return ".wav"
	case "application/pdf":
		return ".pdf"
	}
	return ".bin"
}

