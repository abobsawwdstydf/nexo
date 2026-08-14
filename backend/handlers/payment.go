package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/netip"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"
)

const maxYooKassaResponseBytes int64 = 2 * 1024 * 1024

// premiumPlanName identifies the premium tier returned to clients.
const premiumPlanName = "nexo_premium"

func readLimitedBody(body io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, fmt.Errorf("response exceeds %d bytes", limit)
	}
	return data, nil
}

// webhookEntry stores a payment ID with its processing timestamp
type webhookEntry struct {
	PaymentID string
	CreatedAt time.Time
}

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
	Capture  bool            `json:"capture"`
	Receipt  json.RawMessage `json:"receipt,omitempty"`
	Metadata map[string]string `json:"metadata"`
}

type YooKassaPaymentResponse struct {
	ID           string `json:"id"`
	Status       string `json:"status"`
	Confirmation struct {
		Type            string `json:"type"`
		ConfirmationURL string `json:"confirmation_url"`
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
	ID     string `json:"id"`
	Status string `json:"status"`
	Amount struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Metadata map[string]string `json:"metadata"`
}

// ─── Fiscal receipt (54-ФЗ) ────────────────────────────────────────────────

type yooKassaReceipt struct {
	Customer      yooKassaReceiptCustomer  `json:"customer"`
	Items         []yooKassaReceiptItem    `json:"items"`
	Settlements   []yooKassaReceiptSettle  `json:"settlements"`
	TaxSystemCode int                      `json:"tax_system_code"`
}

type yooKassaReceiptCustomer struct {
	Email string `json:"email,omitempty"`
	Phone string `json:"phone,omitempty"`
}

type yooKassaReceiptItem struct {
	Description string              `json:"description"`
	Quantity    string              `json:"quantity"`
	Amount      yooKassaMoneyAmount `json:"amount"`
	VatCode     int                 `json:"vat_code"`
}

type yooKassaReceiptSettle struct {
	Type   string             `json:"type"`
	Amount yooKassaMoneyAmount `json:"amount"`
}

type yooKassaMoneyAmount struct {
	Value    string `json:"value"`
	Currency string `json:"currency"`
}

// buildReceipt constructs a fiscal receipt. ИНН организации (226911329166)
// задаётся в кабинете ЮKassa; сюда передаётся customer + items.
func buildReceipt(user models.User, amount int, months int) (string, error) {
	email := user.Email
	if email == "" {
		return "", errors.New("no customer email for receipt")
	}
	monthsLabel := map[int]string{1: "1 мес.", 3: "3 мес.", 6: "6 мес.", 12: "12 мес."}
	label, ok := monthsLabel[months]
	if !ok {
		label = fmt.Sprintf("%d мес.", months)
	}

	value := fmt.Sprintf("%d.00", amount)
	receipt := yooKassaReceipt{
		Customer:      yooKassaReceiptCustomer{Email: email},
		TaxSystemCode: 1,
		Items: []yooKassaReceiptItem{
			{
				Description: "Нексо Премиум — " + label,
				Quantity:    "1.000",
				Amount:      yooKassaMoneyAmount{Value: value, Currency: "RUB"},
				VatCode:     1,
			},
		},
		Settlements: []yooKassaReceiptSettle{
			{Type: "prepayment", Amount: yooKassaMoneyAmount{Value: value, Currency: "RUB"}},
		},
	}
	raw, err := json.Marshal(receipt)
	if err != nil {
		return "", err
	}
	return string(raw), nil
}

// ─── Idempotency lock (запобігання подвійній обробці webhook) ──────────────

var (
	webhookProcessing sync.Map // map[string]*webhookEntry — вже оброблені payment ID
)

func isWebhookProcessed(paymentID string) bool {
	now := time.Now()
	_, loaded := webhookProcessing.LoadOrStore(paymentID, &webhookEntry{
		PaymentID: paymentID,
		CreatedAt: now,
	})
	return loaded
}

// clearWebhookProcessing releases the idempotency lock so a failed/partial
// webhook can be retried by the provider instead of being dropped as a
// "duplicate" for up to an hour.
func clearWebhookProcessing(paymentID string) {
	webhookProcessing.Delete(paymentID)
}

func cleanupWebhookLocks() {
	ticker := time.NewTicker(10 * time.Minute)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			cutoff := time.Now().Add(-1 * time.Hour)
			webhookProcessing.Range(func(key, value interface{}) bool {
				entry, ok := value.(*webhookEntry)
				if ok && entry.CreatedAt.Before(cutoff) {
					webhookProcessing.Delete(key)
				}
				return true
			})
		case <-StopCh:
			return
		}
	}
}

// StartWebhookLockCleanup starts the periodic sweep that removes stale
// webhook idempotency locks. It stops when StopCh closes on shutdown.
func StartWebhookLockCleanup() {
	go cleanupWebhookLocks()
	logging.Log.Info("Webhook lock cleanup: started (10 min tick)")
}

// ─── Valid payment types ────────────────────────────────────────────────────

var validPaymentTypes = map[string]bool{
	"premium":      true,
	"premium_gift": true,
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
	addr, err := netip.ParseAddr(ip)
	if err != nil {
		return false
	}
	for _, cidr := range yooKassaIPs {
		prefix, err := netip.ParsePrefix(cidr)
		if err != nil {
			continue
		}
		if prefix.Contains(addr) {
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
		logging.Log.Error("[PREMIUM] User not found for activation", "user_id", userID)
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

	logging.Log.Info("[PREMIUM] Premium activated", "months", months, "user_id", userID, "until", premiumUntil)
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

	hasPremium := user.IsPremium
	if user.PremiumUntil != nil && user.PremiumUntil.Before(time.Now()) {
		hasPremium = false
		db.GetDB().Model(&user).Updates(map[string]interface{}{
			"is_premium": false,
		})
	}

	return c.JSON(fiber.Map{
		"isPremium":    hasPremium,
		"premiumUntil": user.PremiumUntil,
		"plan":         premiumPlanName,
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

	// ─── Rate limit: не більше 3 створень платежів за годину ──────────────
	// (перевіряється ДО застосування промокода, щоб не спалювати слоти)
	var recentCount int64
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	db.GetDB().Model(&models.Payment{}).
		Where("user_id = ? AND created_at > ?", userID, oneHourAgo).
		Count(&recentCount)
	if recentCount >= 3 {
		logging.Log.Warn("[SECURITY] Payment rate limit hit", "user_id", userID, "count", recentCount)
		return c.Status(429).JSON(fiber.Map{"error": "Too many payment attempts. Try again later."})
	}

	// ─── Промокод ──────────────────────────────────────────────────────
	var promo *models.PromoCode
	if req.PromoCode != "" {
		applied, finalAmount, promoErr := applyPromoCode(req.PromoCode, amount)
		if promoErr != nil {
			return c.Status(400).JSON(fiber.Map{"error": promoErr.Error()})
		}
		promo = applied
		amount = finalAmount
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

	// ─── Створення запиту до YooKassa ────────────────────────────────────
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

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
	if promo != nil {
		ykReq.Metadata["promo_code"] = promo.Code
	}

	// ─── Фіскальний чек (54-ФЗ) ──────────────────────────────────────────
	receiptJSON, receiptErr := buildReceipt(user, amount, req.PremiumMonths)
	if receiptErr == nil {
		ykReq.Receipt = json.RawMessage(receiptJSON)
	} else {
		logging.Log.Warn("[YOOKASSA] Receipt skipped", "err", receiptErr)
	}

	body, err := json.Marshal(ykReq)
	if err != nil {
		logging.Log.Error("[YOOKASSA] Failed to marshal payment request", "err", err)
		if promo != nil {
			releasePromoCodeUse(promo.Code)
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create payment request"})
	}
	httpReq, err := http.NewRequest("POST", "https://api.yookassa.ru/v3/payments", bytes.NewReader(body))
	if err != nil {
		if promo != nil {
			releasePromoCodeUse(promo.Code)
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create payment request"})
	}

	httpReq.SetBasicAuth(getYooKassaShopID(), getYooKassaSecretKey())
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("IdempotenceKey", generateID())

	resp, err := httpClient.Do(httpReq)
	if err != nil {
		logging.Log.Error("[YOOKASSA] API request failed", "err", err)
		if promo != nil {
			releasePromoCodeUse(promo.Code)
		}
		return c.Status(502).JSON(fiber.Map{"error": "Payment service unavailable"})
	}
	defer resp.Body.Close()

	respBody, err := readLimitedBody(resp.Body, maxYooKassaResponseBytes)
	if err != nil {
		logging.Log.Error("[YOOKASSA] Failed to read response", "err", err)
		return c.Status(502).JSON(fiber.Map{"error": "Payment service unavailable"})
	}

	if resp.StatusCode != 200 {
		logging.Log.Error("[YOOKASSA] Payment creation failed", "status", resp.StatusCode, "body", string(respBody))
		if promo != nil {
			releasePromoCodeUse(promo.Code)
		}
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
	if promo != nil {
		payment.PromoCode = promo.Code
	}

	if err := db.GetDB().Create(&payment).Error; err != nil {
		logging.Log.Error("[DB] Failed to save payment", "err", err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save payment"})
	}

	logging.Log.Info("[PAYMENT] Created", "user_id", userID, "payment_id", ykResp.ID, "amount", amount, "type", req.Type, "months", req.PremiumMonths)
		

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
		logging.Log.Warn("[SECURITY] Webhook from unknown IP", "ip", clientIP)
		// В продакшені — повертаємо 200 щоб не виказувати що ми існуємо
		return c.JSON(fiber.Map{"ok": true})
	}

	// ─── 2. HMAC-SHA256 підпис (обов'язковий) ───────────────────────────
	body := c.Body()
	webhookSecret := getYooKassaWebhookSecret()

	if webhookSecret == "" {
		logging.Log.Error("[SECURITY] YUKASSA_WEBHOOK_SECRET not configured — rejecting all webhooks")
		// Return 200 so YooKassa does not retry indefinitely; IP whitelist
		// above already restricted who can reach this handler.
		return c.JSON(fiber.Map{"ok": true})
	}

	signature := c.Get("X-Signature")
	if signature == "" {
		logging.Log.Warn("[SECURITY] Webhook missing signature", "ip", clientIP)
		return c.Status(403).JSON(fiber.Map{"error": "Missing signature"})
	}

	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	expectedSig := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
		logging.Log.Warn("[SECURITY] Webhook invalid signature", "ip", clientIP)
		return c.Status(403).JSON(fiber.Map{"error": "Invalid signature"})
	}

	// ─── 3. Парсимо подію ───────────────────────────────────────────────
	var event struct {
		Type    string `json:"type"`
		Payment struct {
			ID     string `json:"id"`
			Status string `json:"status"`
			Amount struct {
				Value    string `json:"value"`
				Currency string `json:"currency"`
			} `json:"amount"`
			Metadata map[string]string `json:"metadata"`
		} `json:"object"`
	}

	if err := json.Unmarshal(body, &event); err != nil {
		logging.Log.Warn("[SECURITY] Webhook invalid JSON", "ip", clientIP)
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
		logging.Log.Info("[SECURITY] Duplicate webhook — already processed", "payment_id", paymentID)
		return c.JSON(fiber.Map{"ok": true, "duplicate": true})
	}

	// ─── 6. Знаходимо платіж у БД ──────────────────────────────────────
	var payment models.Payment
	if result := db.GetDB().Where("yoo_kassa_id = ?", paymentID).First(&payment); result.Error != nil {
		logging.Log.Warn("[SECURITY] Webhook for unknown payment", "payment_id", paymentID, "ip", clientIP)
		return c.Status(404).JSON(fiber.Map{"error": "Payment not found"})
	}

	// ─── 7. СЕРВЕРНА ВЕРИФІКАЦІЯ ЧЕРЕЗ YooKassa API ─────────────────────
	//    Це ключовий захист: навіть якщо хтось підробить webhook,
	//    ми перевіряємо статус напряму в YooKassa API.
	if event.Type == "payment.succeeded" && payment.Status != "succeeded" {
		verifiedPayment, err := verifyPaymentWithYooKassa(paymentID)
		if err != nil {
			logging.Log.Error("[SECURITY] Server-side verification failed", "payment_id", paymentID, "err", err)
			clearWebhookProcessing(paymentID)
			return c.Status(502).JSON(fiber.Map{"error": "Payment verification failed"})
		}

		// Перевіряємо що YooKassa дійсно підтвердила платіж
		if verifiedPayment.Status != "succeeded" {
			logging.Log.Error("[SECURITY] Payment status mismatch", "payment_id", paymentID, "webhook_status", event.Payment.Status, "api_status", verifiedPayment.Status)
				
			clearWebhookProcessing(paymentID)
			return c.Status(400).JSON(fiber.Map{"error": "Payment not confirmed by provider"})
		}

		// ─── 8. ВЕРИФІКАЦІЯ СУМИ з YooKassa API ───────────────────────────
		expectedAmount := payment.Amount
		if expectedAmount <= 0 {
			logging.Log.Error("[SECURITY] Payment has invalid amount", "payment_id", paymentID, "amount", payment.Amount)
			clearWebhookProcessing(paymentID)
			return c.Status(400).JSON(fiber.Map{"error": "Invalid payment configuration"})
		}

		apiAmount, err := strconv.ParseFloat(verifiedPayment.Amount.Value, 64)
		if err != nil {
			logging.Log.Error("[SECURITY] cannot parse API amount", "payment_id", paymentID, "api_amount", verifiedPayment.Amount.Value)
			clearWebhookProcessing(paymentID)
			return c.Status(400).JSON(fiber.Map{"error": "Invalid amount format"})
		}

		if int(apiAmount) != expectedAmount {
			logging.Log.Error("[SECURITY] Payment amount mismatch", "payment_id", paymentID, "expected", expectedAmount, "api_amount", apiAmount, "webhook_amount", event.Payment.Amount.Value)
				
			clearWebhookProcessing(paymentID)
			return c.Status(400).JSON(fiber.Map{"error": "Payment amount mismatch"})
		}

		// ─── 9. УСПІШНА ВЕРИФІКАЦІЯ — АКТИВУЄМО PREMIUM ──────────────────
		logging.Log.Info("[SECURITY] Payment VERIFIED", "payment_id", paymentID, "user_id", payment.UserID, "amount", apiAmount, "months", payment.PremiumMonths, "via", clientIP)
			

		if err := db.GetDB().Model(&payment).Updates(map[string]interface{}{
			"status":     "succeeded",
			"updated_at": time.Now(),
		}).Error; err != nil {
			logging.Log.Error("[PAYMENT] Failed to mark payment as succeeded", "payment_id", paymentID, "err", err)
		}

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
		if err := db.GetDB().Model(&payment).Updates(map[string]interface{}{
			"status":     "canceled",
			"updated_at": time.Now(),
		}).Error; err != nil {
			logging.Log.Error("[PAYMENT] Failed to mark payment as canceled", "payment_id", paymentID, "err", err)
		}
		if payment.PromoCode != "" {
			releasePromoCodeUse(payment.PromoCode)
		}
		logging.Log.Info("[PAYMENT] Canceled", "payment_id", paymentID, "user_id", payment.UserID)
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

	body, err := readLimitedBody(resp.Body, maxYooKassaResponseBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to read YooKassa response: %w", err)
	}

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
		"plan": premiumPlanName,
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

