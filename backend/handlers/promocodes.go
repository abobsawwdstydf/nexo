package handlers

import (
	"errors"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

var (
	errPromoNotFound   = errors.New("промокод не найден")
	errPromoInactive   = errors.New("промокод неактивен")
	errPromoExpired    = errors.New("срок действия промокода истёк")
	errPromoExhausted  = errors.New("промокод уже использован")
	errPromoInvalidPct = errors.New("скидка должна быть от 1 до 99%")
)

const promoDiscountMinAmount = 1

// applyPromoCode validates a promo code and computes the discounted amount.
// It atomically increments the usage counter to prevent overselling.
func applyPromoCode(code string, baseAmount int) (*models.PromoCode, int, error) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return nil, baseAmount, nil
	}

	var promo models.PromoCode
	if err := db.GetDB().Where("code = ?", code).First(&promo).Error; err != nil {
		return nil, baseAmount, errPromoNotFound
	}

	if !promo.Active {
		return nil, baseAmount, errPromoInactive
	}
	if promo.ExpiresAt != nil && promo.ExpiresAt.Before(time.Now()) {
		return nil, baseAmount, errPromoExpired
	}
	if promo.MaxUses > 0 && promo.UsedCount >= promo.MaxUses {
		return nil, baseAmount, errPromoExhausted
	}

	result := db.GetDB().Exec(
		"UPDATE promo_codes SET used_count = used_count + 1, updated_at = ? WHERE id = ? AND active = ? AND (max_uses = 0 OR used_count < max_uses)",
		time.Now(), promo.ID, true)
	if result.Error != nil {
		log.Printf("[PROMO] Failed to increment usage for %s: %v", code, result.Error)
		return nil, baseAmount, errors.New("промокод не применился, попробуйте ещё раз")
	}
	if result.RowsAffected == 0 {
		return nil, baseAmount, errPromoExhausted
	}

	promo.UsedCount++

	discount := baseAmount * promo.DiscountPercent / 100
	finalAmount := baseAmount - discount
	if finalAmount < promoDiscountMinAmount {
		finalAmount = promoDiscountMinAmount
	}

	return &promo, finalAmount, nil
}

// releasePromoCodeUse rolls back a usage count when a payment is canceled.
func releasePromoCodeUse(code string) {
	code = strings.ToUpper(strings.TrimSpace(code))
	if code == "" {
		return
	}
	var promo models.PromoCode
	if err := db.GetDB().Where("code = ?", code).First(&promo).Error; err != nil {
		return
	}
	if promo.UsedCount > 0 {
		db.GetDB().Model(&promo).UpdateColumn("used_count", promo.UsedCount-1)
	}
}

// ─── Admin endpoints ────────────────────────────────────────────────────────

// CheckPromoCode — перевірка промокоду без створення платежу
func CheckPromoCode(c *fiber.Ctx) error {
	code := strings.ToUpper(strings.TrimSpace(c.Query("code")))
	months, err := strconv.Atoi(c.Query("months"))
	if err != nil || (months != 1 && months != 3 && months != 6 && months != 12) {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid months"})
	}

	var promo models.PromoCode
	if err := db.GetDB().Where("code = ?", code).First(&promo).Error; err != nil {
		return c.JSON(fiber.Map{"valid": false, "error": errPromoNotFound.Error()})
	}
	if !promo.Active {
		return c.JSON(fiber.Map{"valid": false, "error": errPromoInactive.Error()})
	}
	if promo.ExpiresAt != nil && promo.ExpiresAt.Before(time.Now()) {
		return c.JSON(fiber.Map{"valid": false, "error": errPromoExpired.Error()})
	}
	if promo.MaxUses > 0 && promo.UsedCount >= promo.MaxUses {
		return c.JSON(fiber.Map{"valid": false, "error": errPromoExhausted.Error()})
	}

	baseAmount := getPremiumPrice(months)
	discount := baseAmount * promo.DiscountPercent / 100
	finalAmount := baseAmount - discount
	if finalAmount < promoDiscountMinAmount {
		finalAmount = promoDiscountMinAmount
	}

	return c.JSON(fiber.Map{
		"valid":           true,
		"code":            promo.Code,
		"discountPercent": promo.DiscountPercent,
		"baseAmount":      baseAmount,
		"finalAmount":     finalAmount,
	})
}

type promoCodeInput struct {
	Code            string `json:"code"`
	DiscountPercent int    `json:"discountPercent"`
	MaxUses         int    `json:"maxUses"`
	Active          *bool  `json:"active"`
	ExpiresAt       string `json:"expiresAt"` // RFC3339 or empty
}

// ListPromoCodes — список промокодів (адмін)
func ListPromoCodes(c *fiber.Ctx) error {
	if !isPlatformAdmin(c.Locals("userId").(string)) {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}
	var codes []models.PromoCode
	db.GetDB().Order("created_at DESC").Find(&codes)
	if codes == nil {
		codes = []models.PromoCode{}
	}
	return c.JSON(fiber.Map{"items": codes, "total": len(codes)})
}

// CreatePromoCode — створити промокод (адмін)
func CreatePromoCode(c *fiber.Ctx) error {
	if !isPlatformAdmin(c.Locals("userId").(string)) {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}
	var req promoCodeInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Код обязателен"})
	}
	if len(code) < 3 || len(code) > 64 {
		return c.Status(400).JSON(fiber.Map{"error": "Код: 3–64 символа"})
	}
	if req.DiscountPercent < 1 || req.DiscountPercent > 99 {
		return c.Status(400).JSON(fiber.Map{"error": errPromoInvalidPct.Error()})
	}

	var existing models.PromoCode
	if err := db.GetDB().Where("code = ?", code).First(&existing).Error; err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Промокод уже существует"})
	}

	var expiresAt *time.Time
	if req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, req.ExpiresAt)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Неверный формат expiresAt (RFC3339)"})
		}
		expiresAt = &t
	}

	active := true
	if req.Active != nil {
		active = *req.Active
	}

	promo := models.PromoCode{
		ID:              generateID(),
		Code:            code,
		DiscountPercent: req.DiscountPercent,
		MaxUses:         req.MaxUses,
		UsedCount:       0,
		Active:          active,
		ExpiresAt:       expiresAt,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}
	if err := db.GetDB().Create(&promo).Error; err != nil {
		log.Printf("[PROMO] Failed to create %s: %v", code, err)
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create promo code"})
	}
	return c.JSON(promo)
}

// UpdatePromoCode — оновити промокод (адмін)
func UpdatePromoCode(c *fiber.Ctx) error {
	if !isPlatformAdmin(c.Locals("userId").(string)) {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}
	var promo models.PromoCode
	if err := db.GetDB().First(&promo, "id = ?", c.Params("id")).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Promo code not found"})
	}

	var req promoCodeInput
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updates := map[string]interface{}{}
	if req.Code != "" {
		code := strings.ToUpper(strings.TrimSpace(req.Code))
		if len(code) < 3 || len(code) > 64 {
			return c.Status(400).JSON(fiber.Map{"error": "Код: 3–64 символа"})
		}
		var clash models.PromoCode
		if err := db.GetDB().Where("code = ? AND id != ?", code, promo.ID).First(&clash).Error; err == nil {
			return c.Status(400).JSON(fiber.Map{"error": "Промокод уже существует"})
		}
		updates["code"] = code
	}
	if req.DiscountPercent > 0 {
		if req.DiscountPercent < 1 || req.DiscountPercent > 99 {
			return c.Status(400).JSON(fiber.Map{"error": errPromoInvalidPct.Error()})
		}
		updates["discount_percent"] = req.DiscountPercent
	}
	if req.MaxUses > 0 {
		updates["max_uses"] = req.MaxUses
	}
	if req.Active != nil {
		updates["active"] = *req.Active
	}
	if req.ExpiresAt != "" {
		t, err := time.Parse(time.RFC3339, req.ExpiresAt)
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Неверный формат expiresAt (RFC3339)"})
		}
		updates["expires_at"] = t
	}

	if len(updates) > 0 {
		updates["updated_at"] = time.Now()
		if err := db.GetDB().Model(&promo).Updates(updates).Error; err != nil {
			log.Printf("[PROMO] Failed to update %s: %v", promo.Code, err)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to update promo code"})
		}
	}

	db.GetDB().First(&promo, "id = ?", promo.ID)
	return c.JSON(promo)
}

// DeletePromoCode — видалити промокод (адмін)
func DeletePromoCode(c *fiber.Ctx) error {
	if !isPlatformAdmin(c.Locals("userId").(string)) {
		return c.Status(403).JSON(fiber.Map{"error": "Forbidden"})
	}
	result := db.GetDB().Delete(&models.PromoCode{}, "id = ?", c.Params("id"))
	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to delete promo code"})
	}
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Promo code not found"})
	}
	return c.JSON(fiber.Map{"ok": true})
}