package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
)

// ─── Admin Analytics ───────────────────────────────────────────────────────
// GET /api/admin/analytics — общая статистика по платформе (только админ).

const analyticsDays = 30

type analyticsTotals struct {
	TotalUsers     int64 `json:"totalUsers"`
	TotalChats     int64 `json:"totalChats"`
	TotalMessages  int64 `json:"totalMessages"`
	TotalMedia     int64 `json:"totalMedia"`
	MediaSizeBytes int64 `json:"mediaSizeBytes"`
	TotalStories   int64 `json:"totalStories"`
	TotalPayments  int64 `json:"totalPayments"`
	TotalReports   int64 `json:"totalReports"` // moderation_logs (жалобы, баны, муты)
	PremiumUsers   int64 `json:"premiumUsers"`
}

type analyticsDaily struct {
	Date        string `json:"date"` // YYYY-MM-DD
	ActiveUsers int64  `json:"activeUsers"`
	NewUsers    int64  `json:"newUsers"`
	Messages    int64  `json:"messages"`
}

type analyticsTopChat struct {
	ChatID       string `json:"chatId"`
	Name         string `json:"name"`
	MessageCount int64  `json:"messageCount"`
}

type analyticsResponse struct {
	Totals      analyticsTotals    `json:"totals"`
	Daily       []analyticsDaily   `json:"daily"`
	TopChats    []analyticsTopChat `json:"topChats"`
	GeneratedAt string             `json:"generatedAt"`
}

type analyticsDailyRow struct {
	Date        string `gorm:"column:date"`
	ActiveUsers int64  `gorm:"column:active_users"`
	Messages    int64  `gorm:"column:messages"`
}

type analyticsNewUsersRow struct {
	Date     string `gorm:"column:date"`
	NewUsers int64  `gorm:"column:new_users"`
}

// GetAdminAnalytics возвращает счётчики, активность за 30 дней и топ-чаты.
// Паттерн проверки админа — тот же, что в остальных админ-хендлерах.
func GetAdminAnalytics(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	if !isPlatformAdmin(userID) {
		return c.Status(403).JSON(fiber.Map{"error": "Admin only"})
	}

	resp := analyticsResponse{
		Daily:    make([]analyticsDaily, 0, analyticsDays),
		TopChats: make([]analyticsTopChat, 0, 10),
	}

	// ── Totals ──
	if err := db.GetDB().Model(&models.User{}).Count(&resp.Totals.TotalUsers).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.Chat{}).Count(&resp.Totals.TotalChats).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.Message{}).Count(&resp.Totals.TotalMessages).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.Media{}).Count(&resp.Totals.TotalMedia).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.Media{}).
		Select("COALESCE(SUM(size), 0)").Scan(&resp.Totals.MediaSizeBytes).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.Story{}).Count(&resp.Totals.TotalStories).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.Payment{}).Count(&resp.Totals.TotalPayments).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.ModerationLog{}).Count(&resp.Totals.TotalReports).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	if err := db.GetDB().Model(&models.User{}).
		Where("is_premium = ? OR premium_until > ?", true, time.Now()).
		Count(&resp.Totals.PremiumUsers).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}

	// ── Daily series (30 дней, недостающие даты заполняем нулями) ──
	start := time.Now().AddDate(0, 0, -(analyticsDays - 1))
	start = time.Date(start.Year(), start.Month(), start.Day(), 0, 0, 0, 0, start.Location())

	byDate := make(map[string]*analyticsDaily, analyticsDays)
	for i := 0; i < analyticsDays; i++ {
		key := start.AddDate(0, 0, i).Format("2006-01-02")
		byDate[key] = &analyticsDaily{Date: key}
	}

	var msgRows []analyticsDailyRow
	if err := db.GetDB().Raw(
		`SELECT date(created_at) AS date,
		        COUNT(*) AS messages,
		        COUNT(DISTINCT sender_id) AS active_users
		 FROM messages
		 WHERE created_at >= ?
		 GROUP BY date(created_at)`,
		start).Scan(&msgRows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	for _, r := range msgRows {
		if d, ok := byDate[r.Date]; ok {
			d.Messages = r.Messages
			d.ActiveUsers = r.ActiveUsers
		}
	}

	var userRows []analyticsNewUsersRow
	if err := db.GetDB().Raw(
		`SELECT date(created_at) AS date, COUNT(*) AS new_users
		 FROM users
		 WHERE created_at >= ?
		 GROUP BY date(created_at)`,
		start).Scan(&userRows).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}
	for _, r := range userRows {
		if d, ok := byDate[r.Date]; ok {
			d.NewUsers = r.NewUsers
		}
	}

	for i := 0; i < analyticsDays; i++ {
		key := start.AddDate(0, 0, i).Format("2006-01-02")
		resp.Daily = append(resp.Daily, *byDate[key])
	}

	// ── Top-10 чатов по числу сообщений ──
	if err := db.GetDB().Raw(
		`SELECT c.id AS chat_id,
		        COALESCE(NULLIF(c.name, ''), c.username, c.id) AS name,
		        COUNT(m.id) AS message_count
		 FROM chats c
		 LEFT JOIN messages m ON m.chat_id = c.id
		 GROUP BY c.id
		 ORDER BY message_count DESC
		 LIMIT 10`).Scan(&resp.TopChats).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to load analytics"})
	}

	resp.GeneratedAt = time.Now().Format(time.RFC3339)
	return c.JSON(resp)
}