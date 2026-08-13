package handlers

import (
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"nexo/logging"
)

const (
	stickerCacheDir     = "./data/sticker_cache"
	stickerRemoteBase   = "https://stickers.darkheavens.ru"
	stickerMaxAge       = 7 * 24 * time.Hour
	stickerCacheMaxSize = 500 * 1024 * 1024 // 500 MB max cache size
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

func enforceStickerCacheSize() {
	entries, err := os.ReadDir(stickerCacheDir)
	if err != nil {
		return
	}

	var totalSize int64
	type fileInfo struct {
		name string
		mod  time.Time
		size int64
	}
	var files []fileInfo

	for _, entry := range entries {
		info, err := entry.Info()
		if err != nil {
			continue
		}
		totalSize += info.Size()
		files = append(files, fileInfo{name: entry.Name(), mod: info.ModTime(), size: info.Size()})
	}

	if totalSize <= stickerCacheMaxSize {
		return
	}

	sort.Slice(files, func(i, j int) bool {
		return files[i].mod.Before(files[j].mod)
	})

	for _, f := range files {
		os.Remove(filepath.Join(stickerCacheDir, f.name))
		totalSize -= f.size
		if totalSize <= stickerCacheMaxSize {
			break
		}
	}
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
		logging.Log.Error("[sticker-proxy]", "name", name, "err", err)
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

	enforceStickerCacheSize()

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

