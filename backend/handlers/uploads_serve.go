package handlers

import (
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/middleware"
)

// validatePublicHost resolves a host and rejects any private/reserved address
// (loopback, RFC1918, link-local, metadata). Used to prevent SSRF.
func validatePublicHost(host string) error {
	ips, err := net.LookupIP(host)
	if err != nil || len(ips) == 0 {
		return fmt.Errorf("invalid gif url host")
	}
	for _, ip := range ips {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
			ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
			return fmt.Errorf("blocked gif url host")
		}
	}
	return nil
}

// ServeUploadedFile serves files from the uploads directory, gated behind a
// valid access token (Authorization: Bearer or ?token= query param).
// Prevents unauthenticated enumeration/leeching of user uploads.
func ServeUploadedFile(c *fiber.Ctx) error {
	token := c.Query("token")
	if token == "" {
		if authHeader := c.Get("Authorization"); strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}
	}
	if token == "" || !middleware.ValidateAccessTokenString(token) {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	rel, err := url.PathUnescape(c.Params("*"))
	if err != nil || rel == "" || strings.Contains(rel, "..") {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid path"})
	}

	baseDir, err := filepath.Abs(UploadDir())
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Server error"})
	}
	full := filepath.Join(baseDir, filepath.FromSlash(rel))

	// Ensure the resolved path stays inside the uploads root
	target, err := filepath.Abs(full)
	if err != nil || (target != baseDir && !strings.HasPrefix(target, baseDir+string(os.PathSeparator))) {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}

	info, err := os.Stat(target)
	if err != nil || info.IsDir() {
		return c.Status(404).JSON(fiber.Map{"error": "Not found"})
	}

	return c.SendFile(target)
}

// ImportGifFromURL downloads a GIF/video from an external URL and stores it
// in the uploads directory, returning media payload ready for a message.
func ImportGifFromURL(rawURL string) (MediaPayload, error) {
	u, err := url.Parse(rawURL)
	if err != nil || u.Scheme != "https" || u.Host == "" {
		return MediaPayload{}, fmt.Errorf("invalid gif url")
	}

	// SECURITY (SSRF): only public hosts are allowed, and redirects are not
	// followed — otherwise https://evil/ could bounce the server into the
	// internal network (metadata endpoints, admin panels).
	if err := validatePublicHost(u.Hostname()); err != nil {
		return MediaPayload{}, err
	}

	client := &http.Client{
		Timeout: 15 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Get(rawURL)
	if err != nil {
		return MediaPayload{}, fmt.Errorf("gif download failed")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return MediaPayload{}, fmt.Errorf("gif download failed (status %d)", resp.StatusCode)
	}

	const maxGifSize = 15 * 1024 * 1024 // 15MB
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxGifSize+1))
	if err != nil {
		return MediaPayload{}, fmt.Errorf("gif read failed")
	}
	if len(body) > maxGifSize {
		return MediaPayload{}, fmt.Errorf("gif too large (max 15MB)")
	}

	contentType := detectContentType(body, "", resp.Header.Get("Content-Type"))
	allowed := map[string]bool{
		"image/gif": true, "image/webp": true,
		"video/mp4": true, "video/webm": true,
	}
	if !allowed[contentType] {
		return MediaPayload{}, fmt.Errorf("unsupported gif format: %s", contentType)
	}

	filename := generateID() + mimeToExt(contentType)
	savePath := filepath.Join(UploadDir(), filename)
	if err := os.WriteFile(savePath, body, 0644); err != nil {
		return MediaPayload{}, fmt.Errorf("gif save failed")
	}

	mediaType := "file"
	if strings.HasPrefix(contentType, "image/") {
		mediaType = "photo"
	} else if strings.HasPrefix(contentType, "video/") {
		mediaType = "video"
	}

	return MediaPayload{
		ID:       generateID(),
		Type:     mediaType,
		URL:      "/uploads/" + filename,
		Filename: filename,
		Size:     len(body),
	}, nil
}
