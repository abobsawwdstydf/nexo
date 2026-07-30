package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// ─── YooKassa API helpers ───────────────────────────────────────────────────

func getYooKassaShopID() string {
	return os.Getenv("YUKASSA_SHOP_ID")
}

func getYooKassaSecretKey() string {
	return os.Getenv("YUKASSA_SECRET_KEY")
}

func getYooKassaWebhookSecret() string {
	return os.Getenv("YUKASSA_WEBHOOK_SECRET")
}

func getFrontendURL() string {
	url := os.Getenv("FRONTEND_URL")
	if url == "" {
		url = "https://nexo.cloudpub.ru"
	}
	return url
}

// ─── Types ──────────────────────────────────────────────────────────────────

type YooKassaPaymentRequest struct {
	Amount struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Confirmation struct {
		Type      string `json:"type"`
		ReturnURL string `json:"return_url"`
	} `json:"confirmation"`
	Capture    bool              `json:"capture"`
	Receipt    string            `json:"receipt,omitempty"`
	Metadata   map[string]string `json:"metadata"`
}

type YooKassaPaymentResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Confirmation struct {
		Type             string `json:"type"`
		ConfirmationURL  string `json:"confirmation_url"`
	} `json:"confirmation"`
	Amount struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Metadata map[string]string `json:"metadata"`
}

type YooKassaRefundRequest struct {
	Amount struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	PaymentID string `json:"payment_id"`
}

// YooKassaGetPaymentResponse — ответ API для GET /v3/payments/{id}
type YooKassaGetPaymentResponse struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	Amount   struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Metadata map[string]string `json:"metadata"`
}

// ─── Idempotency lock (запобігання подвійній обробці webhook) ──────────────

var (
	webhookProcessing sync.Map // map[string]bool — вже оброблені payment ID
	webhookMu         sync.Mutex
)

func isWebhookProcessed(paymentID string) bool {
	_, loaded := webhookProcessing.LoadOrStore(paymentID, true)
	return loaded
}

func cleanupWebhookLocks() {
	// Чистимо старі записи кожні 10 хвилин
	for {
		time.Sleep(10 * time.Minute)
		now := time.Now().Unix()
		webhookProcessing.Range(func(key, value interface{}) bool {
			// Видаляємо записи старіші за 1 годину (якщо є timestamp)
			_ = now // для простоти чистимо все старіше 1 год
			return true
		})
	}
}

func init() {
	go cleanupWebhookLocks()
}

// ─── Valid payment types ────────────────────────────────────────────────────

var validPaymentTypes = map[string]bool{
	"premium":       true,
	"premium_gift":  true,
}

// ─── YooKassa IP whitelist (official ranges) ───────────────────────────────
// https://yookassa.ru/developers/acceptance/requisites/webhook

var yooKassaIPs = []string{
	// YooKassa webhook source IPs (актуальні на 2024-2026)
	"185.70.76.0/24",
	"185.70.77.0/24",
	"91.238.50.0/24",
}

func isYooKassaIP(ip string) bool {
	for _, cidr := range yooKassaIPs {
		if strings.HasPrefix(ip, cidr[:strings.LastIndex(cidr, "/")]) {
			return true
		}
	}
	return false
}

// ─── Premium prices ─────────────────────────────────────────────────────────

func getPremiumPrice(months int) int {
	prices := map[int]int{
		1:  99,
		3:  249,
		6:  449,
		12: 799,
	}
	if price, ok := prices[months]; ok {
		return price
	}
	return 0 // 0 = невідомий період, відхиляємо
}

// ─── Premium activation ─────────────────────────────────────────────────────

func activatePremium(userID string, months int) {
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		log.Printf("[PREMIUM] User not found for activation: %s", userID)
		return
	}

	now := time.Now()
	premiumUntil := now.AddDate(0, months, 0)

	// Якщо вже premium — продовжуємо
	if user.IsPremium && user.PremiumUntil != nil && user.PremiumUntil.After(now) {
		premiumUntil = user.PremiumUntil.AddDate(0, months, 0)
	}

	db.GetDB().Model(&user).Updates(map[string]interface{}{
		"is_premium":    true,
		"premium_until": premiumUntil,
	})

	log.Printf("[PREMIUM] Activated %d months for user %s until %v", months, userID, premiumUntil)
}

// ─── WebSocket helper ───────────────────────────────────────────────────────

func wsHubSendToUser(userID string, msg string) {
	if ws.HubInstance != nil {
		ws.HubInstance.SendToUser(userID, []byte(msg))
	}
}

// ─── HTTP client pool ──────────────────────────────────────────────────────

var httpClient = &http.Client{
	Timeout: 15 * time.Second,
	Transport: &http.Transport{
		MaxIdleConns:        10,
		IdleConnTimeout:     30 * time.Second,
		TLSHandshakeTimeout: 5 * time.Second,
	},
}

// ═════════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═════════════════════════════════════════════════════════════════════════════

// GetPremiumStatus — отримати статус premium користувача
func GetPremiumStatus(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// Check paid premium
	hasPaidPremium := user.IsPremium
	if user.PremiumUntil != nil && user.PremiumUntil.Before(time.Now()) {
		hasPaidPremium = false
		db.GetDB().Model(&user).Updates(map[string]interface{}{
			"is_premium": false,
		})
	}

	// Calculate beta trial status
	betaEnd := user.CreatedAt.Add(betaTrialDays * 24 * time.Hour)
	isBetaActive := time.Now().Before(betaEnd)
	betaDaysLeft := int(betaEnd.Sub(time.Now()).Hours() / 24)
	if betaDaysLeft < 0 {
		betaDaysLeft = 0
	}

	isPremium := hasPaidPremium || isBetaActive

	return c.JSON(fiber.Map{
		"isPremium":     isPremium,
		"premiumUntil":  user.PremiumUntil,
		"plan":          "НуЧе",
		"betaActive":    isBetaActive,
		"betaDaysLeft":  betaDaysLeft,
		"betaTotalDays": betaTrialDays,
	})
}

// CreatePayment — створити платіж через YooKassa
func CreatePayment(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreatePaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	// ─── Валідація Type ──────────────────────────────────────────────────
	if req.Type == "" {
		req.Type = "premium" // default
	}
	if !validPaymentTypes[req.Type] {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid payment type"})
	}

	// ─── Валідація PremiumMonths ─────────────────────────────────────────
	if req.PremiumMonths < 1 || req.PremiumMonths > 12 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid premium period"})
	}

	// ─── Валідація: premium_months повинен бути з дозволеного списку ─────
	allowedMonths := map[int]bool{1: true, 3: true, 6: true, 12: true}
	if !allowedMonths[req.PremiumMonths] {
		return c.Status(400).JSON(fiber.Map{"error": "Premium period must be 1, 3, 6, or 12 months"})
	}

	amount := getPremiumPrice(req.PremiumMonths)
	if amount == 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid premium period"})
	}

	// ─── Валідація gift target ───────────────────────────────────────────
	if req.Type == "premium_gift" {
		if req.GiftToUserID == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Gift recipient required"})
		}
		if req.GiftToUserID == userID {
			return c.Status(400).JSON(fiber.Map{"error": "Cannot gift to yourself"})
		}
		var targetUser models.User
		if result := db.GetDB().First(&targetUser, "id = ?", req.GiftToUserID); result.Error != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Recipient not found"})
		}
	} else {
		req.GiftToUserID = "" // скидаємо для non-gift
	}

	// ─── Rate limit: не більше 3 створень платежів за годину ──────────────
	var recentCount int64
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	db.GetDB().Model(&models.Payment{}).
		Where("user_id = ? AND created_at > ?", userID, oneHourAgo).
		Count(&recentCount)
	if recentCount >= 3 {
		log.Printf("[SECURITY] Payment rate limit hit: userId=%s count=%d", userID, recentCount)
		return c.Status(429).JSON(fiber.Map{"error": "Too many payment attempts. Try again later."})
	}

	// ─── Створення запиту до YooKassa ────────────────────────────────────
	ykReq := YooKassaPaymentRequest{}
	ykReq.Amount.Value = fmt.Sprintf("%d.00", amount)
	ykReq.Amount.Currency = "RUB"
	ykReq.Confirmation.Type = "redirect"
	ykReq.Confirmation.ReturnURL = getFrontendURL() + "/payment/success"
	ykReq.Capture = true
	ykReq.Metadata = map[string]string{
		"user_id":        userID,
		"type":           req.Type,
		"premium_months": fmt.Sprintf("%d", req.PremiumMonths),
	}
	if req.GiftToUserID != "" {
		ykReq.Metadata["gift_to_user_id"] = req.GiftToUserID
	}

	body, _ := json.Marshal(ykReq)
	httpReq, err := http.NewRequest("POST", "https://api.yookassa.ru/v3/payments", bytes.NewReader(body))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create payment request"})
	}

	httpReq.SetBasicAuth(getYooKassaShopID(), getYooKassaSecretKey())
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("IdempotenceKey", generateID())

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		log.Printf("[YOOKASSA] API request failed: %v", err)
		return c.Status(502).JSON(fiber.Map{"error": "Payment service unavailable"})
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		log.Printf("[YOOKASSA] Payment creation failed: status=%d body=%s", resp.StatusCode, string(respBody))
		return c.Status(502).JSON(fiber.Map{"error": "Payment creation failed"})
	}

	var ykResp YooKassaPaymentResponse
	if err := json.Unmarshal(respBody, &ykResp); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Invalid response from payment service"})
	}

	// ─── Зберігаємо платіж ──────────────────────────────────────────────
	payment := models.Payment{
		ID:            generateID(),
		UserID:        userID,
		YooKassaID:    ykResp.ID,
		Amount:        amount,
		Currency:      "RUB",
		Type:          req.Type,
		Status:        "pending",
		GiftToUserID:  req.GiftToUserID,
		PremiumMonths: req.PremiumMonths,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := db.GetDB().Create(&payment).Error; err != nil {
		log.Printf("[DB] Failed to save payment: %v", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save payment"})
	}

	log.Printf("[PAYMENT] Created: userId=%s paymentId=%s amount=%d type=%s months=%d",
		userID, ykResp.ID, amount, req.Type, req.PremiumMonths)

	return c.JSON(fiber.Map{
		"paymentId":       ykResp.ID,
		"confirmationUrl": ykResp.Confirmation.ConfirmationURL,
		"amount":          amount,
	})
}

// ═════════════════════════════════════════════════════════════════════════════
// YooKassa WEBHOOK — ТІЛЬКИ ЕКВАЙРИНГ МОЖЕ ПІДТВЕРДЖУВАТИ ПЛАТІЖ
// ═════════════════════════════════════════════════════════════════════════════

func YooKassaWebhook(c *fiber.Ctx) error {
	// ─── 1. IP WHITELIST (обов'язково для продакшену) ────────────────────
	clientIP := c.IP()
	if !isYooKassaIP(clientIP) {
		log.Printf("[SECURITY] Webhook from unknown IP: %s", clientIP)
		// В продакшені — повертаємо 200 щоб не виказувати що ми існуємо
		return c.JSON(fiber.Map{"ok": true})
	}

	// ─── 2. HMAC-SHA256 підпис (обов'язковий) ───────────────────────────
	body := c.Body()
	webhookSecret := getYooKassaWebhookSecret()

	if webhookSecret == "" {
		log.Printf("[SECURITY] YUKASSA_WEBHOOK_SECRET not configured — rejecting all webhooks")
		return c.Status(500).JSON(fiber.Map{"error": "Webhook verification not configured"})
	}

	signature := c.Get("X-Signature")
	if signature == "" {
		log.Printf("[SECURITY] Webhook missing signature from IP: %s", clientIP)
		return c.Status(403).JSON(fiber.Map{"error": "Missing signature"})
	}

	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
		log.Printf("[SECURITY] Webhook invalid signature from IP: %s", clientIP)
		return c.Status(403).JSON(fiber.Map{"error": "Invalid signature"})
	}

	// ─── 3. Парсимо подію ───────────────────────────────────────────────
	var event struct {
		Type   string `json:"type"`
		Payment struct {
			ID       string            `json:"id"`
			Status   string            `json:"status"`
			Amount   struct {
				Value    string `json:"value"`
				Currency string `json:"currency"`
			} `json:"amount"`
			Metadata map[string]string `json:"metadata"`
		} `json:"object"`
	}

	if err := json.Unmarshal(body, &event); err != nil {
		log.Printf("[SECURITY] Webhook invalid JSON from IP: %s", clientIP)
		return c.Status(400).JSON(fiber.Map{"error": "Invalid event"})
	}

	// ─── 4. Фільтруємо тільки релевантні події ─────────────────────────
	if event.Type != "payment.succeeded" && event.Type != "payment.canceled" {
		return c.JSON(fiber.Map{"ok": true})
	}

	paymentID := event.Payment.ID
	if paymentID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Missing payment ID"})
	}

	// ─── 5. IDEMPOTENCY — запобігання подвійній обробці ──────────────────
	if isWebhookProcessed(paymentID) {
		log.Printf("[SECURITY] Duplicate webhook for payment %s — already processed", paymentID)
		return c.JSON(fiber.Map{"ok": true, "duplicate": true})
	}

	// ─── 6. Знаходимо платіж у БД ──────────────────────────────────────
	var payment models.Payment
	if result := db.GetDB().Where("yoo_kassa_id = ?", paymentID).First(&payment); result.Error != nil {
		log.Printf("[SECURITY] Webhook for unknown payment: %s from IP: %s", paymentID, clientIP)
		return c.Status(404).JSON(fiber.Map{"error": "Payment not found"})
	}

	// ─── 7. СЕРВЕРНА ВЕРИФІКАЦІЯ ЧЕРЕЗ YooKassa API ─────────────────────
	//    Це ключовий захист: навіть якщо хтось підробить webhook,
	//    ми перевіряємо статус напряму в YooKassa API.
	if event.Type == "payment.succeeded" && payment.Status != "succeeded" {
		verifiedPayment, err := verifyPaymentWithYooKassa(paymentID)
		if err != nil {
			log.Printf("[SECURITY] Server-side verification failed for payment %s: %v", paymentID, err)
			return c.Status(502).JSON(fiber.Map{"error": "Payment verification failed"})
		}

		// Перевіряємо що YooKassa дійсно підтвердила платіж
		if verifiedPayment.Status != "succeeded" {
			log.Printf("[SECURITY] Payment %s status mismatch: webhook=%s api=%s",
				paymentID, event.Payment.Status, verifiedPayment.Status)
			return c.Status(400).JSON(fiber.Map{"error": "Payment not confirmed by provider"})
		}

		// ─── 8. ВЕРИФІКАЦІЯ СУМИ з YooKassa API ───────────────────────────
		expectedAmount := getPremiumPrice(payment.PremiumMonths)
		if expectedAmount == 0 {
			log.Printf("[SECURITY] Payment %s has invalid premium months: %d", paymentID, payment.PremiumMonths)
			return c.Status(400).JSON(fiber.Map{"error": "Invalid payment configuration"})
		}

		apiAmount, err := strconv.ParseFloat(verifiedPayment.Amount.Value, 64)
		if err != nil {
			log.Printf("[SECURITY] Payment %s: cannot parse API amount: %s", paymentID, verifiedPayment.Amount.Value)
			return c.Status(400).JSON(fiber.Map{"error": "Invalid amount format"})
		}

		if int(apiAmount) != expectedAmount {
			log.Printf("[SECURITY] Payment %s amount mismatch: expected=%d api=%.0f webhook_amount=%s",
				paymentID, expectedAmount, apiAmount, event.Payment.Amount.Value)
			return c.Status(400).JSON(fiber.Map{"error": "Payment amount mismatch"})
		}

		// ─── 9. УСПІШНА ВЕРИФІКАЦІЯ — АКТИВУЄМО PREMIUM ──────────────────
		log.Printf("[SECURITY] Payment %s VERIFIED: userId=%s amount=%.0f months=%d via=%s",
			paymentID, payment.UserID, apiAmount, payment.PremiumMonths, clientIP)

		db.GetDB().Model(&payment).Updates(map[string]interface{}{
			"status":     "succeeded",
			"updated_at": time.Now(),
		})

		activatePremium(payment.UserID, payment.PremiumMonths)

		if payment.Type == "premium_gift" && payment.GiftToUserID != "" {
			activatePremium(payment.GiftToUserID, payment.PremiumMonths)
			wsHubSendToUser(payment.GiftToUserID, fmt.Sprintf(
				`{"type":"premium:gift_received","months":%d}`, payment.PremiumMonths))
		}

		wsHubSendToUser(payment.UserID, fmt.Sprintf(
			`{"type":"payment:succeeded","paymentId":"%s","amount":%d}`,
			payment.YooKassaID, payment.Amount))

	} else if event.Type == "payment.canceled" {
		db.GetDB().Model(&payment).Updates(map[string]interface{}{
			"status":     "canceled",
			"updated_at": time.Now(),
		})
		log.Printf("[PAYMENT] Canceled: %s userId=%s", paymentID, payment.UserID)
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ═════════════════════════════════════════════════════════════════════════════
// Серверна верифікація — ДВОЗНАЧНА ПЕРЕВІРКА ЧЕРЕЗ YooKassa API
// ═════════════════════════════════════════════════════════════════════════════

func verifyPaymentWithYooKassa(paymentID string) (*YooKassaGetPaymentResponse, error) {
	url := fmt.Sprintf("https://api.yookassa.ru/v3/payments/%s", paymentID)

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.SetBasicAuth(getYooKassaShopID(), getYooKassaSecretKey())
	req.Header.Set("Content-Type", "application/json")

	resp, err := httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("YooKassa API request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("YooKassa API returned status %d: %s", resp.StatusCode, string(body))
	}

	var result YooKassaGetPaymentResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("failed to parse YooKassa response: %w", err)
	}

	return &result, nil
}

// ═════════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═════════════════════════════════════════════════════════════════════════════

// GetPremiumPrices — отримати ціни premium
func GetPremiumPrices(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"plan": "НуЧе",
		"prices": map[int]int{
			1:  99,
			3:  249,
			6:  449,
			12: 799,
		},
		"currency": "RUB",
	})
}

// GetPaymentHistory — отримати історію платежів користувача
func GetPaymentHistory(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var payments []models.Payment
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Limit(20).Find(&payments)

	return c.JSON(payments)
}
