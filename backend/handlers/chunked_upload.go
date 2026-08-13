package handlers

import (
	"io"
	"nexo/logging"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/models"
)

// ─── Chunked upload (resumable large files) ────────────────────────────────
// Files are streamed as ordered 4MB parts into UploadDir()/.chunks/<id>.part.
// Parts must arrive strictly in order (index 0, 1, 2, …) and the total may
// never exceed the declared size. Sessions expire after 30 minutes of
// inactivity (goroutine cleaner) and are tracked in memory (sync.Map) —
// nothing sensitive is persisted. Sessions are bound to the uploading user.

const (
	chunkSize        = 4 * 1024 * 1024 // 4MB per part
	chunkSessionTTL  = 30 * time.Minute
	chunkMaxFileSize = 550 * 1024 * 1024 // 550MB hard cap (BodyLimit 600MB)
)

type chunkSession struct {
	ID        string
	UserID    string
	Filename  string
	Size      int64
	Received  int64
	Ext       string
	CreatedAt time.Time
	Path      string
}

var (
	chunkSessions sync.Map // uploadId -> *chunkSession
)

func chunksDir() string {
	return filepath.Join(UploadDir(), ".chunks")
}

// StartChunkCleaner prunes expired chunk sessions. Run once from main.
// Stops cleanly when handlers.StopCh is closed.
func StartChunkCleaner() {
	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				cutoff := time.Now().Add(-chunkSessionTTL)
				chunkSessions.Range(func(key, value any) bool {
					s := value.(*chunkSession)
					if s.CreatedAt.Before(cutoff) {
						chunkSessions.Delete(key)
						os.Remove(s.Path)
						logging.Log.Info("[CHUNK] session expired", "session_id", s.ID)
					}
					return true
				})
			case <-StopCh:
				return
			}
		}
	}()
}

func currentUser(c *fiber.Ctx) (string, bool) {
	id, ok := c.Locals("userId").(string)
	return id, ok && id != ""
}

// ChunkInit: POST /api/upload/chunk/init {filename, size, type} → {uploadId}
func ChunkInit(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Filename string `json:"filename"`
		Size     int64  `json:"size"`
		Type     string `json:"type"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}
	req.Filename = filepath.Base(strings.ReplaceAll(req.Filename, "\\", "/"))
	if req.Filename == "" || req.Size <= 0 || req.Size > chunkMaxFileSize {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid filename or size"})
	}

	if err := os.MkdirAll(chunksDir(), 0755); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create temp dir"})
	}

	id := generateID()
	s := &chunkSession{
		ID:        id,
		UserID:    userID,
		Filename:  req.Filename,
		Size:      req.Size,
		Ext:       strings.ToLower(filepath.Ext(req.Filename)),
		CreatedAt: time.Now(),
		Path:      filepath.Join(chunksDir(), id+".part"),
	}
	if f, err := os.Create(s.Path); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to init chunk file"})
	} else {
		f.Close()
	}

	chunkSessions.Store(id, s)
	return c.Status(201).JSON(fiber.Map{"uploadId": id})
}

// ChunkUploadPart: POST /api/upload/chunk/:uploadId (multipart: index, data)
// Parts must arrive strictly in order and may not exceed the declared size —
// violations are rejected with 400 before any bytes are written.
func ChunkUploadPart(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	uploadID := c.Params("uploadId")
	if uploadID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing uploadId"})
	}
	v, ok := chunkSessions.Load(uploadID)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "Upload session not found"})
	}
	s := v.(*chunkSession)
	if s.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}

	index, err := strconv.Atoi(c.FormValue("index"))
	if err != nil || index < 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid chunk index"})
	}
	header, err := c.FormFile("data")
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Missing chunk data"})
	}
	if header.Size > chunkSize {
		return c.Status(400).JSON(fiber.Map{"error": "Chunk too large"})
	}

	// Strict ordering: the next part must continue from the current end of
	// the file (index == received/chunkSize). Late/duplicate parts → 400.
	expected := s.Received / chunkSize
	if int64(index) != expected {
		return c.Status(400).JSON(fiber.Map{"error": "Chunk out of order", "expected": expected})
	}
	offset := int64(index) * chunkSize
	if offset+header.Size > s.Size {
		return c.Status(400).JSON(fiber.Map{"error": "Chunk exceeds declared size"})
	}

	src, err := header.Open()
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open chunk"})
	}
	defer src.Close()

	f, err := os.OpenFile(s.Path, os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open part file"})
	}
	defer f.Close()

	if _, err := io.Copy(f, src); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to write chunk"})
	}

	info, err := os.Stat(s.Path)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Stat failed"})
	}
	s.Received = info.Size()
	s.CreatedAt = time.Now() // keep the session alive

	return c.JSON(fiber.Map{"ok": true, "received": s.Received})
}

// ChunkComplete: POST /api/upload/chunk/:uploadId/complete → {media}
func ChunkComplete(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	uploadID := c.Params("uploadId")
	v, ok := chunkSessions.Load(uploadID)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "Upload session not found"})
	}
	s := v.(*chunkSession)
	if s.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}
	if s.Received != s.Size {
		return c.Status(400).JSON(fiber.Map{"error": "Incomplete upload", "received": s.Received, "size": s.Size})
	}

	// Detect content type from the actual bytes (same pipeline as UploadFile).
	f, err := os.Open(s.Path)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to open part file"})
	}
	buf := make([]byte, 512)
	n, _ := io.ReadFull(f, buf)
	f.Close()
	if n == 0 {
		chunkSessions.Delete(uploadID)
		os.Remove(s.Path)
		return c.Status(400).JSON(fiber.Map{"error": "Empty file"})
	}
	contentType := detectContentType(buf[:n], s.Filename, "")
	if !allowedUploadTypes[contentType] {
		chunkSessions.Delete(uploadID)
		os.Remove(s.Path)
		return c.Status(400).JSON(fiber.Map{"error": "File type not allowed: " + contentType})
	}

	// Per-type size limits (images ≤25MB, video ≤500MB, audio ≤100MB, other ≤55MB).
	if s.Size > uploadLimitFor(contentType) {
		chunkSessions.Delete(uploadID)
		os.Remove(s.Path)
		return c.Status(413).JSON(fiber.Map{"error": "File too large for this type"})
	}

	// Cross-check the declared extension vs the detected content type.
	if s.Ext != "" && !isExtensionCompatible(s.Ext, contentType) {
		chunkSessions.Delete(uploadID)
		os.Remove(s.Path)
		return c.Status(400).JSON(fiber.Map{"error": "File extension does not match content"})
	}

	ext := s.Ext
	if ext == "" {
		ext = mimeToExt(contentType)
	}

	id := generateID()
	finalPath := filepath.Join(UploadDir(), id+ext)
	if err := os.Rename(s.Path, finalPath); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to finalize upload"})
	}

	mediaType := "file"
	if strings.HasPrefix(contentType, "image/") {
		mediaType = "image"
	} else if strings.HasPrefix(contentType, "video/") {
		mediaType = "video"
	} else if strings.HasPrefix(contentType, "audio/") {
		mediaType = "audio"
	}

	media := models.Media{
		ID:             id,
		Type:           mediaType,
		URL:            "/uploads/" + id + ext,
		Filename:       url.PathEscape(s.Filename),
		Size:           int(s.Size),
		OriginalFormat: contentType,
	}

	// ffmpeg post-processing (non-fatal).
	if err := ProcessMedia(finalPath, media.ID, &media); err != nil {
		logging.Log.Error("[CHUNK] ProcessMedia failed", "media_id", media.ID, "err", err)
	}

	chunkSessions.Delete(uploadID)
	return c.Status(201).JSON(fiber.Map{"media": media})
}

// ChunkCancel: DELETE /api/upload/chunk/:uploadId
func ChunkCancel(c *fiber.Ctx) error {
	userID, ok := currentUser(c)
	if !ok {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}
	uploadID := c.Params("uploadId")
	v, ok := chunkSessions.Load(uploadID)
	if !ok {
		return c.Status(404).JSON(fiber.Map{"error": "Upload session not found"})
	}
	s := v.(*chunkSession)
	if s.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}
	os.Remove(s.Path)
	chunkSessions.Delete(uploadID)
	return c.JSON(fiber.Map{"ok": true})
}