package handlers

import (
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
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

func StickerProxy(c *fiber.Ctx) error {
	stickerInit.Do(initStickerCache)

	name := c.Params("name")
	if name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "missing name"})
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

	remoteURL := stickerRemoteBase + "/" + name

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
