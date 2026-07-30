package middleware

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
)

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY MIDDLEWARE - Maximum Protection Level
// ═══════════════════════════════════════════════════════════════════════════

const maxCSRFTokens = 10000

var (
	// CSRF token store (per-session)
	csrfTokens   = make(map[string]time.Time)
	csrfTokensMu sync.RWMutex

	// IP blocking store
	blockedIPs   = make(map[string]time.Time)
	blockedIPsMu sync.RWMutex

	// Rate limiting per user
	userRateLimits   = make(map[string][]time.Time)
	userRateLimitsMu sync.RWMutex

	// Request signing secret
	RequestSigningSecret []byte

	// Audit log
	auditLog   []AuditEntry
	auditLogMu sync.RWMutex
)

type AuditEntry struct {
	Timestamp time.Time `json:"timestamp"`
	UserID    string    `json:"userId"`
	Action    string    `json:"action"`
	IP        string    `json:"ip"`
	UserAgent string    `json:"userAgent"`
	Success   bool      `json:"success"`
	Details   string    `json:"details,omitempty"`
}

// ═══════════════════════════════════════════════════════════════════════════
// CSRF PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

func GenerateCSRFToken(sessionID string) string {
	token := make([]byte, 32)
	rand.Read(token)
	tokenHex := hex.EncodeToString(token)

	csrfTokensMu.Lock()
	if len(csrfTokens) >= maxCSRFTokens {
		for t := range csrfTokens {
			delete(csrfTokens, t)
			break
		}
	}
	csrfTokens[tokenHex] = time.Now().Add(1 * time.Hour)
	csrfTokensMu.Unlock()

	return tokenHex
}

func ValidateCSRFToken(token string) bool {
	csrfTokensMu.RLock()
	expiry, exists := csrfTokens[token]
	csrfTokensMu.RUnlock()

	if !exists {
		return false
	}

	if time.Now().After(expiry) {
		csrfTokensMu.Lock()
		delete(csrfTokens, token)
		csrfTokensMu.Unlock()
		return false
	}

	return true
}

func CSRFProtection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Skip for GET, HEAD, OPTIONS
		method := c.Method()
		if method == "GET" || method == "HEAD" || method == "OPTIONS" {
			return c.Next()
		}

		// Skip for public endpoints
		path := c.Path()
		if strings.HasPrefix(path, "/api/auth/") || path == "/api/captcha/verify" || path == "/api/bot/status" || strings.HasPrefix(path, "/webhook/") {
			return c.Next()
		}

		// Check CSRF token in header or body
		csrfToken := c.Get("X-CSRF-Token")
		if csrfToken == "" {
			// Try to get from request body
			var body map[string]interface{}
			if err := c.BodyParser(&body); err == nil {
				if token, ok := body["csrf_token"].(string); ok {
					csrfToken = token
				}
			}
		}

		if csrfToken == "" || !ValidateCSRFToken(csrfToken) {
			LogAudit(c, "CSRF_VALIDATION_FAILED", false, "Invalid or missing CSRF token")
			return c.Status(403).JSON(fiber.Map{"error": "CSRF token invalid or expired"})
		}

		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// IP BLOCKING & BRUTE FORCE PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

func BlockIP(ip string, duration time.Duration) {
	blockedIPsMu.Lock()
	blockedIPs[ip] = time.Now().Add(duration)
	blockedIPsMu.Unlock()
	log.Printf("BLOCKED IP: %s for %v", ip, duration)
}

func IsIPBlocked(ip string) bool {
	blockedIPsMu.RLock()
	expiry, blocked := blockedIPs[ip]
	blockedIPsMu.RUnlock()

	if !blocked {
		return false
	}

	if time.Now().After(expiry) {
		blockedIPsMu.Lock()
		delete(blockedIPs, ip)
		blockedIPsMu.Unlock()
		return false
	}

	return true
}

func IPBlockMiddleware() fiber.Handler {
	return func(c *fiber.Ctx) error {
		ip := c.IP()
		if IsIPBlocked(ip) {
			return c.Status(429).JSON(fiber.Map{"error": "IP temporarily blocked due to suspicious activity"})
		}
		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PER-USER RATE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

func UserRateLimit(maxRequests int, window time.Duration) fiber.Handler {
	return func(c *fiber.Ctx) error {
		userID := c.Locals("userId").(string)
		if userID == "" {
			userID = c.IP()
		}

		key := userID + ":" + c.Path()
		now := time.Now()

		userRateLimitsMu.Lock()
		entries, exists := userRateLimits[key]
		if !exists {
			entries = make([]time.Time, 0, maxRequests+1)
		}

		cutoff := 0
		for i, t := range entries {
			if now.Sub(t) < window {
				cutoff = i
				break
			}
			cutoff = i + 1
		}
		entries = entries[cutoff:]

		if len(entries) >= maxRequests {
			userRateLimitsMu.Unlock()
			BlockIP(c.IP(), 5*time.Minute)
			LogAudit(c, "RATE_LIMIT_EXCEEDED", false, "")
			return c.Status(429).JSON(fiber.Map{"error": "Rate limit exceeded", "retryAfter": window.Seconds()})
		}

		userRateLimits[key] = append(entries, now)
		userRateLimitsMu.Unlock()

		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// INPUT SANITIZATION
// ═══════════════════════════════════════════════════════════════════════════

func SanitizeInput(input string) string {
	// Remove null bytes
	input = strings.ReplaceAll(input, "\x00", "")

	// Remove control characters (except newlines and tabs)
	sanitized := make([]rune, 0, len(input))
	for _, r := range input {
		if r >= 32 || r == '\n' || r == '\t' {
			sanitized = append(sanitized, r)
		}
	}

	// Escape HTML entities
	result := string(sanitized)
	result = strings.ReplaceAll(result, "&", "&amp;")
	result = strings.ReplaceAll(result, "<", "&lt;")
	result = strings.ReplaceAll(result, ">", "&gt;")
	result = strings.ReplaceAll(result, "\"", "&quot;")
	result = strings.ReplaceAll(result, "'", "&#x27;")

	return result
}

func InputSanitization() fiber.Handler {
	return func(c *fiber.Ctx) error {
		query := c.Queries()
		for key, value := range query {
			query[key] = SanitizeInput(value)
		}

		if c.Method() != "GET" && c.Method() != "HEAD" && c.Method() != "OPTIONS" {
			body := c.Body()
			if len(body) > 0 && len(body) < 1024*1024 {
				sanitized := SanitizeInput(string(body))
				c.Request().SetBody([]byte(sanitized))
			}
		}

		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST SIGNING
// ═══════════════════════════════════════════════════════════════════════════

func InitRequestSigning() {
	secret := make([]byte, 32)
	rand.Read(secret)
	RequestSigningSecret = secret
}

func SignRequest(method, path, body string, timestamp int64) string {
	message := strings.Join([]string{method, path, body, strconv.FormatInt(timestamp, 10)}, "\n")
	mac := hmac.New(sha256.New, RequestSigningSecret)
	mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}

func VerifyRequestSignature(c *fiber.Ctx) error {
	// Skip for non-signed endpoints and public API endpoints
	path := c.Path()
	if !strings.HasPrefix(path, "/api/") || 
		strings.HasPrefix(path, "/api/auth/") ||
		strings.HasPrefix(path, "/api/beta/") ||
		strings.HasPrefix(path, "/api/captcha/") ||
		strings.HasPrefix(path, "/api/bot/") ||
		path == "/api/csrf-token" {
		return c.Next()
	}

	timestamp := c.Get("X-Request-Timestamp")
	signature := c.Get("X-Request-Signature")

	if timestamp == "" || signature == "" {
		// Allow unsigned requests for backward compatibility
		return c.Next()
	}

	// Check timestamp (max 5 minutes old)
	reqTime, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || reqTime <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid timestamp"})
	}
	if time.Now().Unix()-reqTime > 300 {
		return c.Status(401).JSON(fiber.Map{"error": "Request timestamp expired"})
	}

	// Verify signature
	expectedSig := SignRequest(c.Method(), path, string(c.Body()), reqTime)
	if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
		LogAudit(c, "SIGNATURE_VERIFICATION_FAILED", false, "")
		return c.Status(401).JSON(fiber.Map{"error": "Invalid request signature"})
	}

	return c.Next()
}

// ═══════════════════════════════════════════════════════════════════════════
// AUDIT LOGGING
// ═══════════════════════════════════════════════════════════════════════════

func LogAudit(c *fiber.Ctx, action string, success bool, details string) {
	entry := AuditEntry{
		Timestamp: time.Now(),
		Action:    action,
		IP:        c.IP(),
		UserAgent: c.Get("User-Agent"),
		Success:   success,
		Details:   details,
	}

	if userID, ok := c.Locals("userId").(string); ok {
		entry.UserID = userID
	}

	auditLogMu.Lock()
	auditLog = append(auditLog, entry)
	if len(auditLog) > 10000 {
		auditLog = auditLog[len(auditLog)-10000:]
	}
	auditLogMu.Unlock()

	if !success {
		log.Printf("AUDIT: %s from %s (user: %s) - FAILED: %s", action, entry.UserID, entry.IP, details)
	}
}

func GetAuditLog(limit int) []AuditEntry {
	auditLogMu.RLock()
	defer auditLogMu.RUnlock()

	if limit <= 0 || limit > len(auditLog) {
		limit = len(auditLog)
	}

	result := make([]AuditEntry, limit)
	copy(result, auditLog[len(auditLog)-limit:])
	return result
}

// ═══════════════════════════════════════════════════════════════════════════
// SECURITY HEADERS (Enhanced)
// ═══════════════════════════════════════════════════════════════════════════

func SecurityHeaders() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Content Security Policy
		c.Set("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' wss: ws: https:; media-src 'self' data: blob: https:; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'")

		// X-Content-Type-Options
		c.Set("X-Content-Type-Options", "nosniff")

		// X-Frame-Options
		c.Set("X-Frame-Options", "DENY")

		// X-XSS-Protection
		c.Set("X-XSS-Protection", "1; mode=block")

		// Referrer Policy
		c.Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Permissions Policy
		c.Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()")

		// Strict-Transport-Security (HSTS)
		c.Set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")

		// X-Permitted-Cross-Domain-Policies
		c.Set("X-Permitted-Cross-Domain-Policies", "none")

		// X-DNS-Prefetch-Control
		c.Set("X-DNS-Prefetch-Control", "off")

		// X-Download-Options
		c.Set("X-Download-Options", "noopen")

		// Cache-Control for API responses
		if strings.HasPrefix(c.Path(), "/api/") {
			c.Set("Cache-Control", "no-store, no-cache, must-revalidate, private")
			c.Set("Pragma", "no-cache")
		}

		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// REQUEST SIZE LIMITING
// ═══════════════════════════════════════════════════════════════════════════

func RequestSizeLimit(maxSize int64) fiber.Handler {
	return func(c *fiber.Ctx) error {
		contentLength := c.Get("Content-Length")
		if contentLength != "" {
			size, err := strconv.ParseInt(contentLength, 10, 64)
			if err != nil {
				return c.Status(400).JSON(fiber.Map{"error": "Invalid Content-Length header"})
			}
			if size > maxSize {
				return c.Status(413).JSON(fiber.Map{"error": "Request entity too large"})
			}
		}
		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// PATH TRAVERSAL PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

func PathTraversalProtection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		path := c.Path()

		// Check for path traversal attempts
		if strings.Contains(path, "..") || strings.Contains(path, "%2e%2e") || strings.Contains(path, "%2E%2E") {
			LogAudit(c, "PATH_TRAVERSAL_ATTEMPT", false, path)
			return c.Status(400).JSON(fiber.Map{"error": "Invalid path"})
		}

		// Check for null bytes
		if strings.Contains(path, "%00") || strings.Contains(path, "\x00") {
			LogAudit(c, "NULL_BYTE_ATTEMPT", false, path)
			return c.Status(400).JSON(fiber.Map{"error": "Invalid path"})
		}

		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// SQL INJECTION PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

func SQLInjectionProtection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check query parameters for SQL injection patterns
		query := string(c.Request().URI().QueryString())
		sqlPatterns := []string{
			"UNION SELECT", "INSERT INTO", "DELETE FROM", "DROP TABLE",
			"UPDATE SET", "EXEC(", "EXECUTE(", "xp_", "sp_",
			"1=1", "1'='1", "OR 1=1", "AND 1=1",
			"--", "/*", "*/", "CHAR(", "CONCAT(",
		}

		upperQuery := strings.ToUpper(query)
		for _, pattern := range sqlPatterns {
			if strings.Contains(upperQuery, pattern) {
				LogAudit(c, "SQL_INJECTION_ATTEMPT", false, query[:100])
				return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
			}
		}

		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// XSS PROTECTION
// ═══════════════════════════════════════════════════════════════════════════

func XSSProtection() fiber.Handler {
	return func(c *fiber.Ctx) error {
		// Check for XSS patterns in query and body
		inputs := []string{
			string(c.Request().URI().QueryString()),
		}

		xssPatterns := []string{
			"<script", "javascript:", "onerror=", "onload=",
			"onclick=", "onmouseover=", "onfocus=", "onblur=",
			"eval(", "document.cookie", "document.domain",
			"window.location", "window.open", "innerHTML",
			"<iframe", "<object", "<embed", "<applet",
		}

		for _, input := range inputs {
			lowerInput := strings.ToLower(input)
			for _, pattern := range xssPatterns {
				if strings.Contains(lowerInput, pattern) {
					LogAudit(c, "XSS_ATTEMPT", false, input[:100])
					return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
				}
			}
		}

		return c.Next()
	}
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP GOROUTINES
// ═══════════════════════════════════════════════════════════════════════════

func init() {
	// Cleanup expired CSRF tokens every 10 minutes
	go func() {
		for {
			time.Sleep(10 * time.Minute)
			csrfTokensMu.Lock()
			now := time.Now()
			for token, expiry := range csrfTokens {
				if now.After(expiry) {
					delete(csrfTokens, token)
				}
			}
			if len(csrfTokens) > maxCSRFTokens {
				excess := len(csrfTokens) - maxCSRFTokens
				for i := 0; i < excess; i++ {
					var oldestToken string
					var oldestTime time.Time
					first := true
					for t, expiry := range csrfTokens {
						if first || expiry.Before(oldestTime) {
							oldestToken = t
							oldestTime = expiry
							first = false
						}
					}
					delete(csrfTokens, oldestToken)
				}
			}
			csrfTokensMu.Unlock()
		}
	}()

	// Cleanup expired IP blocks every 5 minutes
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			blockedIPsMu.Lock()
			now := time.Now()
			for ip, expiry := range blockedIPs {
				if now.After(expiry) {
					delete(blockedIPs, ip)
				}
			}
			blockedIPsMu.Unlock()
		}
	}()

	// Cleanup expired rate limits every minute
	go func() {
		for {
			time.Sleep(1 * time.Minute)
			userRateLimitsMu.Lock()
			now := time.Now()
			for key, timestamps := range userRateLimits {
				valid := make([]time.Time, 0)
				for _, t := range timestamps {
					if now.Sub(t) < 5*time.Minute {
						valid = append(valid, t)
					}
				}
				if len(valid) == 0 {
					delete(userRateLimits, key)
				} else {
					userRateLimits[key] = valid
				}
			}
			userRateLimitsMu.Unlock()
		}
	}()
}
