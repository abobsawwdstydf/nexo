package handlers

import (
	"crypto/rand"
	"fmt"
	"math/big"
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

func init() {
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			captchaMu.Lock()
			now := time.Now()
			for id, entry := range captchaStore {
				if now.After(entry.ExpiresAt) {
					delete(captchaStore, id)
				}
			}
			captchaMu.Unlock()
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

func checkRateLimit(key string, maxRequests int, window time.Duration) bool {
	rateLimitMu.Lock()
	defer rateLimitMu.Unlock()

	now := time.Now()
	entry, exists := rateLimitStore[key]

	if !exists || now.Sub(entry.WindowStart) > window {
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

	a, _ := rand.Int(rand.Reader, big.NewInt(20))
	b, _ := rand.Int(rand.Reader, big.NewInt(20))
	answer := a.Int64() + b.Int64()

	id := generateID()

	captchaMu.Lock()
	captchaStore[id] = &captchaEntry{
		Answer:    fmt.Sprintf("%d", answer),
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

	if entry.Answer != req.Answer {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid answer", "valid": false})
	}

	captchaMu.Lock()
	delete(captchaStore, req.ID)
	captchaMu.Unlock()

	return c.JSON(fiber.Map{"valid": true})
}

// ─── Auth Rate Limiter Middleware ───────────────────────────────────────────

func AuthRateLimit(maxRequests int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		key := "auth:" + ip
		if !checkRateLimit(key, maxRequests, window) {
			return c.Status(429).JSON(fiber.Map{
				"error": "Слишком много попыток. Попробуйте позже.",
			})
		}
		return c.Next()
	}
}
