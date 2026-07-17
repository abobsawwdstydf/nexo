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
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/golang-jwt/jwt/v5"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
	"nexo/ws"
)

// ─── NewTel CallPassword ID Integration ──────────────────────────────────────

type newTelStartRequest struct {
	CallbackLink    string `json:"callbackLink"`
	ClientNumber    string `json:"clientNumber"`
	Timeout         int    `json:"timeout"`
	UserData        string `json:"userData"`
}

type newTelStartResponse struct {
	Success bool `json:"success"`
	Result  struct {
		CallDetails struct {
			CallID             string `json:"callId"`
			ConfirmationNumber string `json:"confirmationNumber"`
			QRCodeURI          string `json:"qrCodeUri"`
		} `json:"callDetails"`
	} `json:"result"`
}

// generateNewTelToken creates a Bearer token for NewTel API
func generateNewTelToken() string {
	apiKey := os.Getenv("NEWTEL_API_KEY")
	signKey := os.Getenv("NEWTEL_SIGNATURE_KEY")
	if apiKey == "" || signKey == "" {
		return ""
	}

	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	// HMAC-SHA256 of timestamp with signature key
	h := hmac.New(sha256.New, []byte(signKey))
	h.Write([]byte(timestamp))
	signature := hex.EncodeToString(h.Sum(nil))

	// Format: base64(api_key:timestamp:signature)
	token := fmt.Sprintf("%s:%s:%s", apiKey, timestamp, signature)
	return token
}

// initiateNewTelVerification calls NewTel API to start phone verification
func initiateNewTelVerification(phone string, userData string) (*models.PhoneVerification, error) {
	apiURL := os.Getenv("NEWTEL_API_URL")
	if apiURL == "" {
		apiURL = "https://api.new-tel.net"
	}

	callbackBase := os.Getenv("FRONTEND_URL")
	if callbackBase == "" {
		callbackBase = "https://nexo.cloudpub.ru"
	}
	callbackLink := callbackBase + "/api/auth/phone/webhook"

	// Clean phone: remove spaces, dashes, parentheses
	phone = strings.ReplaceAll(phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")
	if !strings.HasPrefix(phone, "+") {
		if strings.HasPrefix(phone, "7") || strings.HasPrefix(phone, "8") {
			phone = "+" + phone
		}
	}
	// Ensure format: +7XXXXXXXXXX
	phone = strings.ReplaceAll(phone, "+", "")

	reqBody := newTelStartRequest{
		CallbackLink: callbackLink,
		ClientNumber: phone,
		Timeout:      120,
		UserData:     userData,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequest("POST", apiURL+"/call-password-id/start-waiting-mode-busy", bytes.NewReader(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	token := generateNewTelToken()
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("newtel request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	log.Printf("[NEWTEL] Response status: %d, body: %s", resp.StatusCode, string(body))

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("newtel api error (status %d): %s", resp.StatusCode, string(body))
	}

	var result newTelStartResponse
	if err := json.Unmarshal(body, &result); err != nil {
		return nil, fmt.Errorf("unmarshal result: %w", err)
	}

	// Extract call details — NewTel may return them nested or at top level
	callID := result.Result.CallDetails.CallID
	confirmNum := result.Result.CallDetails.ConfirmationNumber
	qrURI := result.Result.CallDetails.QRCodeURI

	// Fallback: try flat structure (callDetails at top level)
	if callID == "" && confirmNum == "" {
		var flat struct {
			Success bool `json:"success"`
			CallDetails struct {
				CallID             string `json:"callId"`
				ConfirmationNumber string `json:"confirmationNumber"`
				QRCodeURI          string `json:"qrCodeUri"`
			} `json:"callDetails"`
		}
		if err := json.Unmarshal(body, &flat); err == nil {
			callID = flat.CallDetails.CallID
			confirmNum = flat.CallDetails.ConfirmationNumber
			qrURI = flat.CallDetails.QRCodeURI
		}
	}

	log.Printf("[NEWTEL] Parsed: callId=%s, confirmationNumber=%s, qrCodeUri=%s", callID, confirmNum, qrURI)

	if !result.Success && callID == "" {
		return nil, fmt.Errorf("newtel verification failed")
	}

	// Create PhoneVerification record
	verification := models.PhoneVerification{
		ID:                 generateID(),
		Phone:              "+" + phone,
		CallID:             callID,
		ConfirmationNumber: confirmNum,
		QRCodeURI:          qrURI,
		Status:             "pending",
		UserData:           userData,
		Purpose:            "registration",
		CreatedAt:          time.Now(),
		ExpiresAt:          time.Now().Add(2 * time.Minute),
	}

	if err := db.GetDB().Create(&verification).Error; err != nil {
		return nil, fmt.Errorf("save verification: %w", err)
	}

	return &verification, nil
}

// ─── Handlers ───────────────────────────────────────────────────────────────

// InitiatePhoneVerification starts phone verification via NewTel
func InitiatePhoneVerification(c *fiber.Ctx) error {
	var req models.InitiatePhoneRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	req.Phone = strings.TrimSpace(req.Phone)
	if req.Phone == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Phone number required"})
	}

	// Clean phone
	phone := strings.ReplaceAll(req.Phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")

	// Validate phone format (at least 10 digits)
	digits := strings.ReplaceAll(phone, "+", "")
	if len(digits) < 10 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid phone number"})
	}

	// Check rate limit: max 3 attempts per phone per 15 minutes
	var recentCount int64
	db.GetDB().Model(&models.PhoneVerification{}).
		Where("phone = ? AND created_at > ?", phone, time.Now().Add(-15*time.Minute)).
		Count(&recentCount)
	if recentCount >= 3 {
		return c.Status(429).JSON(fiber.Map{"error": "Too many attempts. Try again in 15 minutes."})
	}

	verification, err := initiateNewTelVerification(phone, "")
	if err != nil {
		log.Printf("[PHONE] Initiation failed for %s: %v", phone, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to initiate phone verification"})
	}

	log.Printf("[PHONE] Sending to frontend: verificationId=%s, confirmationNumber=%s, qrCodeUri=%s", verification.ID, verification.ConfirmationNumber, verification.QRCodeURI)

	return c.JSON(fiber.Map{
		"success":            true,
		"verificationId":     verification.ID,
		"confirmationNumber": verification.ConfirmationNumber,
		"qrCodeUri":          verification.QRCodeURI,
		"expiresAt":          verification.ExpiresAt,
	})
}

// NewTelWebhook receives verification results from NewTel
func NewTelWebhook(c *fiber.Ctx) error {
	body := c.Body()

	log.Printf("[NEWTEL] Webhook received: %s", string(body))

	var webhook struct {
		CallID     string `json:"callId"`
		Status     string `json:"status"` // "confirmed" or "failed"
		ClientNumber string `json:"clientNumber"`
		UserData   string `json:"userData"`
	}

	if err := json.Unmarshal(body, &webhook); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid webhook"})
	}

	// Find verification by callId
	var verification models.PhoneVerification
	if result := db.GetDB().Where("call_id = ?", webhook.CallID).First(&verification); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification not found"})
	}

	// Update status
	now := time.Now()
	if webhook.Status == "confirmed" || webhook.Status == "success" {
		db.GetDB().Model(&verification).Updates(map[string]interface{}{
			"status":       "confirmed",
			"confirmed_at": now,
		})

		// If this is a login verification, auto-login the user
		if verification.Purpose == "login" {
			var user models.User
			if result := db.GetDB().Where("phone = ?", verification.Phone).First(&user); result.Error == nil {
				// Update online status
				db.GetDB().Model(&user).Updates(map[string]interface{}{
					"is_online":  true,
					"last_seen":  now,
				})

				ws.HubInstance.SendToUser(user.ID, []byte(`{"type":"user:online","userId":"`+user.ID+`"}`))

				log.Printf("[PHONE] User %s logged in via phone verification", user.Username)
			}
		}
	} else {
		db.GetDB().Model(&verification).Update("status", "failed")
	}

	return c.JSON(fiber.Map{"ok": true})
}

// CheckPhoneStatus checks if phone verification is confirmed
func CheckPhoneStatus(c *fiber.Ctx) error {
	var req models.PhoneStatusRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var verification models.PhoneVerification
	if result := db.GetDB().First(&verification, "id = ?", req.VerificationID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification not found"})
	}

	if time.Now().After(verification.ExpiresAt) && verification.Status == "pending" {
		db.GetDB().Model(&verification).Update("status", "expired")
		return c.JSON(fiber.Map{
			"status":   "expired",
			"confirmed": false,
		})
	}

	return c.JSON(fiber.Map{
		"status":    verification.Status,
		"confirmed": verification.Status == "confirmed",
	})
}

// InitiatePhoneLogin starts phone-based login via NewTel
func InitiatePhoneLogin(c *fiber.Ctx) error {
	var req models.LoginPhoneRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	req.Phone = strings.TrimSpace(req.Phone)
	if req.Phone == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Phone number required"})
	}

	// Clean phone
	phone := strings.ReplaceAll(req.Phone, " ", "")
	phone = strings.ReplaceAll(phone, "-", "")
	phone = strings.ReplaceAll(phone, "(", "")
	phone = strings.ReplaceAll(phone, ")", "")

	// Check if user exists with this phone
	var user models.User
	if result := db.GetDB().Where("phone = ?", phone).First(&user); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "No account found with this phone number"})
	}

	if user.IsBanned {
		return c.Status(403).JSON(fiber.Map{"error": "Account is banned"})
	}

	// Rate limit
	var recentCount int64
	db.GetDB().Model(&models.PhoneVerification{}).
		Where("phone = ? AND purpose = 'login' AND created_at > ?", phone, time.Now().Add(-15*time.Minute)).
		Count(&recentCount)
	if recentCount >= 5 {
		return c.Status(429).JSON(fiber.Map{"error": "Too many login attempts. Try again later."})
	}

	// Start phone verification for login
	verification, err := initiateNewTelVerification(phone, user.ID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to initiate verification"})
	}

	// Update purpose to login
	db.GetDB().Model(&verification).Update("purpose", "login")

	return c.JSON(fiber.Map{
		"requiresCall":       true,
		"callId":             verification.CallID,
		"confirmationNumber": verification.ConfirmationNumber,
		"qrCodeUri":          verification.QRCodeURI,
		"expiresAt":          verification.ExpiresAt,
	})
}

// LoginPhoneConfirm confirms phone login after webhook
func LoginPhoneConfirm(c *fiber.Ctx) error {
	var req models.LoginPhoneConfirmRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var verification models.PhoneVerification
	if result := db.GetDB().Where("call_id = ? AND status = 'confirmed' AND purpose = 'login'", req.CallID).First(&verification); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Verification not found or not confirmed"})
	}

	// Find user
	var user models.User
	if result := db.GetDB().Where("phone = ?", verification.Phone).First(&user); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	if user.IsBanned {
		return c.Status(403).JSON(fiber.Map{"error": "Account is banned", "reason": user.BanReason})
	}

	// Generate tokens
	accessToken, err := middleware.GenerateAccessToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate token"})
	}

	refreshToken, err := middleware.GenerateRefreshToken(user.ID, user.Username)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to generate refresh token"})
	}

	// Update user online status
	now := time.Now()
	db.GetDB().Model(&user).Updates(map[string]interface{}{
		"is_online":  true,
		"last_seen":  now,
	})

	claims := &middleware.Claims{}
	token, _ := jwt.ParseWithClaims(accessToken, claims, func(token *jwt.Token) (interface{}, error) {
		return middleware.JWTSecret, nil
	})
	if token != nil && token.Valid {
		ws.HubInstance.SendToUser(user.ID, []byte(`{"type":"user:online","userId":"`+user.ID+`"}`))
	}

	// Clean up verification
	db.GetDB().Delete(&verification)

	return c.JSON(models.AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User:         user,
	})
}
