package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ─── GIF proxy (Tenor HTML search, no API key required) ──────────────────

const (
	gifCacheTTL    = 10 * time.Minute
	gifHTTPTimeout = 15 * time.Second
	gifMaxResults  = 50
	gifUA          = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"
)

var (
	gifHTTP           = &http.Client{Timeout: gifHTTPTimeout}
	gifURLRegex       = regexp.MustCompile(`https://media\.tenor\.com/[A-Za-z0-9_-]+/[A-Za-z0-9_\.-]+\.gif`)
	gifCacheMu        sync.Mutex
	gifCache          = map[string]gifCacheEntry{}
	gifTrendingQueries = []string{"funny", "cats", "dogs", "happy", "cool", "love", "dance", "reaction"}
)

type gifCacheEntry struct {
	Items     []gifItem
	ExpiresAt time.Time
}

type gifItem struct {
	ID            string `json:"id"`
	URL           string `json:"url"`
	OriginalURL   string `json:"originalUrl"`
	ThumbnailURL  string `json:"thumbnailUrl"`
	PreviewURL    string `json:"previewUrl"`
}

func gifCacheGet(key string) ([]gifItem, bool) {
	gifCacheMu.Lock()
	defer gifCacheMu.Unlock()
	e, ok := gifCache[key]
	if !ok || time.Now().After(e.ExpiresAt) {
		delete(gifCache, key)
		return nil, false
	}
	return e.Items, true
}

func gifCachePut(key string, items []gifItem) {
	gifCacheMu.Lock()
	defer gifCacheMu.Unlock()
	// Bound cache size: drop expired entries when it grows
	if len(gifCache) > 200 {
		for k, e := range gifCache {
			if time.Now().After(e.ExpiresAt) {
				delete(gifCache, k)
			}
		}
	}
	gifCache[key] = gifCacheEntry{Items: items, ExpiresAt: time.Now().Add(gifCacheTTL)}
}

// fetchTenorGifs scrapes direct media.tenor.com URLs from Tenor search HTML.
// Returns a stable, deduplicated list of gif items.
func fetchTenorGifs(query string, limit int) []gifItem {
	if limit <= 0 || limit > gifMaxResults {
		limit = gifMaxResults
	}

	searchURL := "https://tenor.com/search/" + url.PathEscape(query) + "-gifs"
	req, err := http.NewRequest("GET", searchURL, nil)
	if err != nil {
		return nil
	}
	req.Header.Set("User-Agent", gifUA)

	resp, err := gifHTTP.Do(req)
	if err != nil {
		log.Printf("[gifs] tenor request failed q=%q: %v", query, err)
		return nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("[gifs] tenor status %d for q=%q", resp.StatusCode, query)
		return nil
	}

	// Limit body read
	body := make([]byte, 0, 512*1024)
	buf := make([]byte, 64*1024)
	total := 0
	for total < 2*1024*1024 {
		n, readErr := resp.Body.Read(buf)
		if n > 0 {
			body = append(body, buf[:n]...)
			total += n
		}
		if readErr != nil {
			break
		}
	}

	matches := gifURLRegex.FindAll(body, -1)
	seen := map[string]bool{}
	var items []gifItem
	for _, m := range matches {
		s := string(m)
		// Only take preview-size GIFs (AAAAM = ~220px), they load fast
		if !strings.Contains(s, "AAAAM") {
			continue
		}
		if seen[s] {
			continue
		}
		seen[s] = true
		id := strings.TrimPrefix(strings.SplitN(strings.TrimPrefix(s, "https://media.tenor.com/"), "/", 2)[0], "")
		if id == "" {
			id = fmt.Sprintf("g%d", len(items))
		}
		// Original (higher quality) uses AAAAC suffix instead of AAAAM
		original := strings.Replace(s, "AAAAM", "AAAAC", 1)
		items = append(items, gifItem{
			ID:           id,
			URL:          original,
			OriginalURL:  original,
			ThumbnailURL: s,
			PreviewURL:   s,
		})
		if len(items) >= limit {
			break
		}
	}
	return items
}

// GET /stickers/gifs/trending?limit=N
func GifsTrending(c *fiber.Ctx) error {
	limit := c.QueryInt("limit", 24)

	cacheKey := fmt.Sprintf("trending:%d", limit)
	if items, ok := gifCacheGet(cacheKey); ok {
		return c.JSON(items)
	}

	var items []gifItem
	for _, q := range gifTrendingQueries {
		batch := fetchTenorGifs(q, 8)
		items = append(items, batch...)
		if len(items) >= limit {
			break
		}
	}
	if len(items) > limit {
		items = items[:limit]
	}
	if len(items) == 0 {
		return c.Status(502).JSON(fiber.Map{"error": "gif provider unavailable"})
	}

	gifCachePut(cacheKey, items)
	return c.JSON(items)
}

// GET /stickers/gifs/search?q=...&limit=N
func GifsSearch(c *fiber.Ctx) error {
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		return c.Status(400).JSON(fiber.Map{"error": "query is required"})
	}
	limit := c.QueryInt("limit", 24)

	cacheKey := fmt.Sprintf("search:%s:%d", query, limit)
	if items, ok := gifCacheGet(cacheKey); ok {
		return c.JSON(items)
	}

	items := fetchTenorGifs(query, limit)
	if len(items) == 0 {
		return c.Status(502).JSON(fiber.Map{"error": "gif provider unavailable"})
	}

	gifCachePut(cacheKey, items)
	return c.JSON(items)
}

// ─── Internal JSON helpers (unused var guard) ────────────────────────────
var _ = json.Marshal
