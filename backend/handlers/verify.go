package handlers

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
)

func getTelegramBotToken() string {
	return os.Getenv("TELEGRAM_BOT_TOKEN")
}

func getMaxBotToken() string {
	return os.Getenv("MAX_BOT_TOKEN")
}

func getTelegramProxyURL() string {
	url := os.Getenv("TELEGRAM_PROXY_URL")
	if url == "" {
		url = "https://nexo-tg-proxy.h40664555.workers.dev"
	}
	return url
}

func generateCode() string {
	n, _ := rand.Int(rand.Reader, big.NewInt(900000))
	return fmt.Sprintf("%d", n.Int64()+100000)
}

func CheckBotStatus(c *fiber.Ctx) error {
	tgToken := getTelegramBotToken()
	maxToken := getMaxBotToken()

	tgStatus := models.BotProviderStatus{Available: tgToken != ""}
	maxStatus := models.BotProviderStatus{Available: maxToken != ""}

	if tgToken != "" {
		var check models.BotHealthCheck
		if result := db.GetDB().Where("provider = ?", "telegram").First(&check); result.Error == nil {
			tgStatus.Healthy = check.IsHealthy
			tgStatus.Error = check.Error
		}
	}

	if maxToken != "" {
		var check models.BotHealthCheck
		if result := db.GetDB().Where("provider = ?", "max").First(&check); result.Error == nil {
			maxStatus.Healthy = check.IsHealthy
			maxStatus.Error = check.Error
		}
	}

	return c.JSON(models.BotHealthStatus{
		Telegram: &tgStatus,
		Max:      &maxStatus,
	})
}

func RequestVerification(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.VerifyRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	if req.Provider != "telegram" && req.Provider != "max" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid provider"})
	}

	token := ""
	if req.Provider == "telegram" {
		token = getTelegramBotToken()
	} else {
		token = getMaxBotToken()
	}

	if token == "" {
		return c.Status(503).JSON(fiber.Map{
			"error":   "Bot token not configured",
			"message": "Хз когда заработает",
		})
	}

	code := generateCode()

	verification := models.VerificationRequest{
		ID:        generateID(),
		UserID:    userID,
		Provider:  req.Provider,
		Token:     token,
		Code:      code,
		Status:    "pending",
		CreatedAt: time.Now(),
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}

	if err := db.GetDB().Create(&verification).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create verification"})
	}

	var user models.User
	db.GetDB().First(&user, "id = ?", userID)

	if req.Provider == "telegram" {
		go sendTelegramVerification(user.Username, code)
	} else {
		go sendMaxVerification(user.Username, code)
	}

	return c.JSON(fiber.Map{
		"success":  true,
		"provider": req.Provider,
		"message":  fmt.Sprintf("Код отправлен через %s", req.Provider),
		"expiresAt": verification.ExpiresAt,
	})
}

func ConfirmVerification(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.VerifyConfirmRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request"})
	}

	var verification models.VerificationRequest
	if result := db.GetDB().Where("user_id = ? AND provider = ? AND status = ?",
		userID, req.Provider, "pending").Order("created_at DESC").First(&verification); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "No pending verification found"})
	}

	if time.Now().After(verification.ExpiresAt) {
		db.GetDB().Model(&verification).Update("status", "expired")
		return c.Status(410).JSON(fiber.Map{"error": "Verification expired"})
	}

	if subtle.ConstantTimeCompare([]byte(verification.Code), []byte(req.Code)) != 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid code"})
	}

	db.GetDB().Model(&verification).Update("status", "confirmed")
	db.GetDB().Model(&models.User{}).Where("id = ?", userID).Update("is_verified_by_bot", true)

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Аккаунт подтверждён!",
	})
}

func sendTelegramVerification(username string, code string) {
	proxyURL := getTelegramProxyURL()
	token := getTelegramBotToken()

	msg := fmt.Sprintf("🔐 Нексо Мессенджер\n\nКод подтверждения: %s\n\nНикому не сообщайте этот код.", code)

	url := fmt.Sprintf("%s/bot%s/sendMessage", proxyURL, token)
	data, _ := json.Marshal(map[string]interface{}{
		"chat_id": username,
		"text":    msg,
	})
	resp, err := http.Post(url, "application/json", strings.NewReader(string(data)))
	if err != nil {
		updateBotHealth("telegram", false, err.Error())
		return
	}
	defer resp.Body.Close()

	updateBotHealth("telegram", resp.StatusCode == 200, "")
}

func sendMaxVerification(username string, code string) {
	token := getMaxBotToken()
	proxyURL := getTelegramProxyURL()

	msg := fmt.Sprintf("🔐 Нексо Мессенджер\n\nКод подтверждения: %s\n\nНикому не сообщайте этот код.", code)

	url := fmt.Sprintf("%s/bot%s/sendMessage", proxyURL, token)
	data, _ := json.Marshal(map[string]interface{}{
		"chat_id": username,
		"text":    msg,
	})
	resp, err := http.Post(url, "application/json", strings.NewReader(string(data)))
	if err != nil {
		updateBotHealth("max", false, err.Error())
		return
	}
	defer resp.Body.Close()

	updateBotHealth("max", resp.StatusCode == 200, "")
}

func updateBotHealth(provider string, healthy bool, errMsg string) {
	var check models.BotHealthCheck
	result := db.GetDB().Where("provider = ?", provider).First(&check)
	if result.Error == gorm.ErrRecordNotFound {
		check = models.BotHealthCheck{
			ID:        generateID(),
			Provider:  provider,
			IsHealthy: healthy,
			LastCheck: time.Now(),
			Error:     errMsg,
		}
		db.GetDB().Create(&check)
	} else if result.Error == nil {
		db.GetDB().Model(&check).Updates(map[string]interface{}{
			"is_healthy": healthy,
			"last_check": time.Now(),
			"error":      errMsg,
		})
	}
}

func StartHealthChecker() {
	ticker := time.NewTicker(12 * time.Hour)
	go func() {
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				checkTelegramHealth()
				checkMaxHealth()
			case <-StopCh:
				return
			}
		}
	}()

	checkTelegramHealth()
	checkMaxHealth()
}

func checkTelegramHealth() {
	token := getTelegramBotToken()
	if token == "" {
		return
	}

	proxyURL := getTelegramProxyURL()
	url := fmt.Sprintf("%s/bot%s/getMe", proxyURL, token)
	resp, err := http.Get(url)
	if err != nil {
		updateBotHealth("telegram", false, err.Error())
		return
	}
	defer resp.Body.Close()

	updateBotHealth("telegram", resp.StatusCode == 200, "")
}

func checkMaxHealth() {
	token := getMaxBotToken()
	if token == "" {
		return
	}

	proxyURL := getTelegramProxyURL()
	url := fmt.Sprintf("%s/bot%s/getMe", proxyURL, token)
	resp, err := http.Get(url)
	if err != nil {
		updateBotHealth("max", false, err.Error())
		return
	}
	defer resp.Body.Close()

	updateBotHealth("max", resp.StatusCode == 200, "")
}
