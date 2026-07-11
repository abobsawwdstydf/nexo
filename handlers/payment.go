package handlers

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

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

type YooKassaPaymentRequest struct {
	Amount struct {
		Value    string `json:"value"`
		Currency string `json:"currency"`
	} `json:"amount"`
	Confirmation struct {
		Type      string `json:"type"`
		ReturnURL string `json:"return_url"`
	} `json:"confirmation"`
	Capture    bool   `json:"capture"`
	Receipt    string `json:"receipt,omitempty"`
	Metadata   map[string]string `json:"metadata"`
}

type YooKassaPaymentResponse struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Confirmation struct {
		Type string `json:"type"`
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

func GetPremiumStatus(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	isPremium := user.IsPremium
	if user.PremiumUntil != nil && user.PremiumUntil.Before(time.Now()) {
		isPremium = false
		db.GetDB().Model(&user).Updates(map[string]interface{}{
			"is_premium": false,
		})
	}

	return c.JSON(fiber.Map{
		"isPremium":    isPremium,
		"premiumUntil": user.PremiumUntil,
	})
}

func CreatePayment(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreatePaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.PremiumMonths < 1 || req.PremiumMonths > 12 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid premium period"})
	}

	amount := getPremiumPrice(req.PremiumMonths)

	// Validate gift target if it's a gift
	if req.Type == "premium_gift" && req.GiftToUserID != "" {
		var targetUser models.User
		if result := db.GetDB().First(&targetUser, "id = ?", req.GiftToUserID); result.Error != nil {
			return c.Status(404).JSON(fiber.Map{"error": "Recipient not found"})
		}
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

	body, _ := json.Marshal(ykReq)
	httpReq, err := http.NewRequest("POST", "https://api.yookassa.ru/v3/payments", bytes.NewReader(body))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create payment request"})
	}

	httpReq.SetBasicAuth(getYooKassaShopID(), getYooKassaSecretKey())
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("IdempotenceKey", generateID())

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return c.Status(502).JSON(fiber.Map{"error": "YooKassa API error"})
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	if resp.StatusCode != 200 {
		return c.Status(502).JSON(fiber.Map{"error": "Payment creation failed", "details": string(respBody)})
	}

	var ykResp YooKassaPaymentResponse
	if err := json.Unmarshal(respBody, &ykResp); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Invalid response from YooKassa"})
	}

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
		return c.Status(500).JSON(fiber.Map{"error": "Failed to save payment"})
	}

	return c.JSON(fiber.Map{
		"paymentId":       ykResp.ID,
		"confirmationUrl": ykResp.Confirmation.ConfirmationURL,
		"amount":          amount,
	})
}

func YooKassaWebhook(c *fiber.Ctx) error {
	body := c.Body()

	// Verify webhook signature (HMAC-SHA256)
	webhookSecret := getYooKassaWebhookSecret()
	if webhookSecret != "" {
		signature := c.Get("X-Signature")
		if signature == "" {
			return c.Status(403).JSON(fiber.Map{"error": "Missing signature"})
		}
		mac := hmac.New(sha256.New, []byte(webhookSecret))
		mac.Write(body)
		expectedSig := hex.EncodeToString(mac.Sum(nil))
		if !hmac.Equal([]byte(signature), []byte(expectedSig)) {
			return c.Status(403).JSON(fiber.Map{"error": "Invalid signature"})
		}
	}

	var event struct {
		Type string `json:"type"`
		Payment struct {
			ID       string            `json:"id"`
			Status   string            `json:"status"`
			Metadata map[string]string `json:"metadata"`
		} `json:"object"`
	}

	if err := json.Unmarshal(body, &event); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid event"})
	}

	if event.Type != "payment.succeeded" && event.Type != "payment.canceled" {
		return c.JSON(fiber.Map{"ok": true})
	}

	var payment models.Payment
	if result := db.GetDB().Where("yoo_kassa_id = ?", event.Payment.ID).First(&payment); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Payment not found"})
	}

	if event.Type == "payment.succeeded" && payment.Status != "succeeded" {
		db.GetDB().Model(&payment).Updates(map[string]interface{}{
			"status":     "succeeded",
			"updated_at": time.Now(),
		})

		activatePremium(payment.UserID, payment.PremiumMonths)

		if payment.Type == "premium_gift" && payment.GiftToUserID != "" {
			activatePremium(payment.GiftToUserID, payment.PremiumMonths)

			wsHubSendToUser(payment.GiftToUserID, fmt.Sprintf(`{"type":"premium:gift_received","months":%d}`, payment.PremiumMonths))
		}

		wsHubSendToUser(payment.UserID, fmt.Sprintf(`{"type":"payment:succeeded","paymentId":"%s","amount":%d}`, payment.YooKassaID, payment.Amount))
	} else if event.Type == "payment.canceled" {
		db.GetDB().Model(&payment).Updates(map[string]interface{}{
			"status":     "canceled",
			"updated_at": time.Now(),
		})
	}

	return c.JSON(fiber.Map{"ok": true})
}

func activatePremium(userID string, months int) {
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return
	}

	now := time.Now()
	premiumUntil := now.AddDate(0, months, 0)

	if user.IsPremium && user.PremiumUntil != nil && user.PremiumUntil.After(now) {
		premiumUntil = user.PremiumUntil.AddDate(0, months, 0)
	}

	db.GetDB().Model(&user).Updates(map[string]interface{}{
		"is_premium":    true,
		"premium_until": premiumUntil,
	})
}

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
	return 99
}

func wsHubSendToUser(userID string, msg string) {
	if ws.HubInstance != nil {
		ws.HubInstance.SendToUser(userID, []byte(msg))
	}
}

func GetPremiumPrices(c *fiber.Ctx) error {
	return c.JSON(fiber.Map{
		"prices": map[int]int{
			1:  99,
			3:  249,
			6:  449,
			12: 799,
		},
		"currency": "RUB",
	})
}

func GetPaymentHistory(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var payments []models.Payment
	db.GetDB().Where("user_id = ?", userID).Order("created_at DESC").Limit(20).Find(&payments)

	return c.JSON(payments)
}
