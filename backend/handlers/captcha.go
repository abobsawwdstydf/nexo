package handlers

import (
	"os"
	"crypto/rand"
	"crypto/subtle"
	"fmt"
	"math/big"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ─── CAPTCHA Store ──────────────────────────────────────────────────────────

type captchaEntry struct {
	Answer    string
	ExpiresAt time.Time
}

var (
	captchaStore = make(map[string]*captchaEntry)
	captchaMu    sync.RWMutex
)

const maxCaptchaEntries = 100000

func init() {
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				captchaMu.Lock()
				now := time.Now()
				for id, entry := range captchaStore {
					if now.After(entry.ExpiresAt) {
						delete(captchaStore, id)
					}
				}
				captchaMu.Unlock()
			case <-StopCh:
				return
			}
		}
	}()
}

// ─── Rate Limiting Store ────────────────────────────────────────────────────

type rateLimitEntry struct {
	Count       int
	WindowStart time.Time
}

var (
	rateLimitStore = make(map[string]*rateLimitEntry)
	rateLimitMu    sync.RWMutex
)

const maxRateLimitEntries = 100000

func checkRateLimit(key string, maxRequests int, window time.Duration) bool {
	rateLimitMu.Lock()
	defer rateLimitMu.Unlock()

	now := time.Now()

	// SECURITY: Evict expired entries if store is too large (memory protection)
	if len(rateLimitStore) > maxRateLimitEntries {
		for k, entry := range rateLimitStore {
			if now.Sub(entry.WindowStart) > window {
				delete(rateLimitStore, k)
			}
		}
	}

	entry, exists := rateLimitStore[key]

	if !exists || now.Sub(entry.WindowStart) > window {
		// Bounded memory: if the store is still full after the sweep, evict the
		// oldest entry — refusing here would turn an attacker's key-flood into
		// a global DoS (every rate-limited endpoint would start returning 429).
		if len(rateLimitStore) >= maxRateLimitEntries {
			var oldestKey string
			var oldestTime time.Time
			first := true
			for k, e := range rateLimitStore {
				if first || e.WindowStart.Before(oldestTime) {
					oldestKey, oldestTime, first = k, e.WindowStart, false
				}
			}
			if oldestKey != "" {
				delete(rateLimitStore, oldestKey)
			}
		}
		rateLimitStore[key] = &rateLimitEntry{
			Count:       1,
			WindowStart: now,
		}
		return true
	}

	if entry.Count >= maxRequests {
		return false
	}

	entry.Count++
	return true
}

// ─── CAPTCHA Handlers ───────────────────────────────────────────────────────

type captchaChallenge struct {
	ID        string `json:"id"`
	Question  string `json:"question"`
	ExpiresAt string `json:"expiresAt"`
}

func GenerateCaptcha(c *fiber.Ctx) error {
	ip := c.IP()
	if !checkRateLimit("captcha:"+ip, 10, time.Minute) {
		return c.Status(429).JSON(fiber.Map{"error": "Too many requests"})
	}

	a, err := rand.Int(rand.Reader, big.NewInt(20))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Server error"})
	}
	b, err := rand.Int(rand.Reader, big.NewInt(20))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Server error"})
	}
	answer := a.Int64() + b.Int64()

	id := generateID()

	captchaMu.Lock()
	if len(captchaStore) >= maxCaptchaEntries {
		captchaMu.Unlock()
		return c.Status(503).JSON(fiber.Map{"error": "Server busy"})
	}
	captchaStore[id] = &captchaEntry{
		Answer:    strconv.FormatInt(answer, 10),
		ExpiresAt: time.Now().Add(5 * time.Minute),
	}
	captchaMu.Unlock()

	return c.JSON(captchaChallenge{
		ID:        id,
		Question:  fmt.Sprintf("%d + %d = ?", a.Int64(), b.Int64()),
		ExpiresAt: time.Now().Add(5 * time.Minute).Format(time.RFC3339),
	})
}

type captchaVerifyRequest struct {
	ID     string `json:"id"`
	Answer string `json:"answer"`
}

func VerifyCaptcha(c *fiber.Ctx) error {
	var req captchaVerifyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.ID == "" || req.Answer == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing captcha id or answer"})
	}

	captchaMu.RLock()
	entry, exists := captchaStore[req.ID]
	captchaMu.RUnlock()

	if !exists {
		return c.Status(400).JSON(fiber.Map{"error": "CAPTCHA not found or expired"})
	}

	if time.Now().After(entry.ExpiresAt) {
		captchaMu.Lock()
		delete(captchaStore, req.ID)
		captchaMu.Unlock()
		return c.Status(400).JSON(fiber.Map{"error": "CAPTCHA expired"})
	}

	// SECURITY FIX: Constant-time comparison to prevent timing attacks on captcha answers
	if subtle.ConstantTimeCompare([]byte(entry.Answer), []byte(req.Answer)) != 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid answer", "valid": false})
	}

	captchaMu.Lock()
	delete(captchaStore, req.ID)
	captchaMu.Unlock()

	return c.JSON(fiber.Map{"valid": true})
}


// clientIP возвращает IP клиента с учётом CLIENT_IP_HEADER: за Cloudflare
// реальный адрес лежит в прокси-заголовке (cf-connecting-ip и т.п.), иначе
// все пользователи попадают в один bucket общего edge-IP. Тот же механизм,
// что у глобального лимитера в main.go.
func clientIP(c *fiber.Ctx) string {
	if h := os.Getenv("CLIENT_IP_HEADER"); h != "" {
		if v := c.Get(h); v != "" {
			return v
		}
	}
	return c.IP()
}

// ─── Auth Rate Limiter Middleware ───────────────────────────────────────────

func AuthRateLimit(maxRequests int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		key := "auth:" + clientIP(c)
		if !checkRateLimit(key, maxRequests, window) {
			return c.Status(429).JSON(fiber.Map{
				"error": "Слишком много попыток. Попробуйте позже.",
			})
		}
		return c.Next()
	}
}
