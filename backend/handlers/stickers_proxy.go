package handlers

import (
	"io"
	"log"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

const (
	stickerCacheDir   = "./data/sticker_cache"
	stickerRemoteBase = "https://stickers.darkheavens.ru"
	stickerMaxAge     = 7 * 24 * time.Hour
)

var (
	stickerHTTP    = &http.Client{Timeout: 15 * time.Second}
	stickerInit    sync.Once
	stickerLoading sync.Map
)

func initStickerCache() {
	os.MkdirAll(stickerCacheDir, 0755)
}

// sanitizeStickerName rejects names containing path separators, null bytes,
// or characters that could enable path traversal or SSRF.
func sanitizeStickerName(name string) error {
	if name == "" {
		return fiber.ErrBadRequest
	}
	// Reject null bytes, path traversal, and shell metacharacters
	if strings.ContainsAny(name, "\x00/\\") {
		return fiber.ErrBadRequest
	}
	// Only allow safe filename characters (alphanumeric, dash, underscore, dot)
	for _, r := range name {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' || r == '.') {
			return fiber.ErrBadRequest
		}
	}
	// Reject hidden files and .. segments
	if strings.HasPrefix(name, ".") || name == ".." {
		return fiber.ErrBadRequest
	}
	return nil
}

func StickerProxy(c *fiber.Ctx) error {
	stickerInit.Do(initStickerCache)

	name := c.Params("name")
	if err := sanitizeStickerName(name); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "invalid sticker name"})
	}

	cachePath := filepath.Join(stickerCacheDir, name)

	if info, err := os.Stat(cachePath); err == nil {
		if time.Since(info.ModTime()) < stickerMaxAge {
			c.Set("Cache-Control", "public, max-age=604800")
			c.Set("X-Cache", "HIT")
			return c.SendFile(cachePath)
		}
	}

	if _, loaded := stickerLoading.LoadOrStore(name, true); loaded {
		time.Sleep(300 * time.Millisecond)
		if _, err := os.Stat(cachePath); err == nil {
			c.Set("Cache-Control", "public, max-age=604800")
			c.Set("X-Cache", "WAIT")
			return c.SendFile(cachePath)
		}
		return c.Status(503).SendString("loading")
	}
	defer stickerLoading.Delete(name)

	// SSRF fix: encode the name so path traversal in the URL is impossible
	remoteURL := stickerRemoteBase + "/" + url.PathEscape(name)

	fetch := func(url string) (*http.Response, error) {
		return stickerHTTP.Get(url)
	}

	resp, err := fetch(remoteURL)
	if err != nil {
		log.Printf("[sticker-proxy] %s: %v", name, err)
		return c.Status(502).SendString("upstream error")
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusTooManyRequests {
		time.Sleep(2 * time.Second)
		resp, err = fetch(remoteURL)
		if err != nil {
			return c.Status(502).SendString("retry failed")
		}
		defer resp.Body.Close()
	}

	if resp.StatusCode != http.StatusOK {
		return c.Status(resp.StatusCode).SendString("upstream error")
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return c.Status(500).SendString("read error")
	}

	os.WriteFile(cachePath, body, 0644)

	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/webp"
	}

	c.Set("Content-Type", ct)
	c.Set("Cache-Control", "public, max-age=604800")
	c.Set("X-Cache", "MISS")
	return c.Send(body)
}
