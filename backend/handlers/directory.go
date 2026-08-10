package handlers

import (
	"encoding/json"
	"strings"
	"unicode/utf8"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// ChannelDirectory lists public channels ordered by subscriber count, with
// optional name/username search. Joining a channel = subscribe via
// POST /channels/:id/subscribe.
func ChannelDirectory(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))

	dbq := db.GetDB().
		Model(&models.Chat{}).
		Where("type = ? AND is_secret = false", "channel")

	if utf8.RuneCountInString(q) >= 2 {
		like := "%" + strings.ReplaceAll(strings.ReplaceAll(q, "%", "\\%"), "_", "\\_") + "%"
		dbq = dbq.Where("(name LIKE ? ESCAPE '\\' OR username LIKE ? ESCAPE '\\')", like, like)
	}

	var channels []models.Chat
	if err := dbq.Order("subscribers_count DESC").Limit(30).Find(&channels).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Directory query failed"})
	}

	items := make([]fiber.Map, 0, len(channels))
	for _, ch := range channels {
		items = append(items, fiber.Map{
			"id":               ch.ID,
			"name":             ch.Name,
			"username":         ch.Username,
			"avatar":           ch.Avatar,
			"description":      ch.Description,
			"subscribersCount": ch.SubscribersCount,
			"isVerified":       ch.IsVerified,
		})
	}

	return c.JSON(fiber.Map{"items": items})
}

// SubscribeToChannel subscribes the caller to a public channel. Mirrors the
// chat:created notification of CreateChat so other devices pick it up.
func SubscribeToChannel(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("id")

	var chat models.Chat
	if err := db.GetDB().Preload("Members.User").First(&chat, "id = ?", chatID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Channel not found"})
	}
	if chat.Type != "channel" || chat.IsSecret {
		return c.Status(400).JSON(fiber.Map{"error": "Not a public channel"})
	}

	var existing models.ChatMember
	if db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&existing).Error == nil {
		return c.JSON(fiber.Map{"chat": json.RawMessage(chatToJSON(chat, userID)), "status": "member"})
	}

	member := models.ChatMember{
		ID:     generateID(),
		ChatID: chatID,
		UserID: userID,
		Role:   "member",
	}
	if err := db.GetDB().Create(&member).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to subscribe"})
	}
	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).
		Update("subscribers_count", chat.SubscribersCount+1)

	db.GetDB().Preload("Members.User").First(&chat, "id = ?", chatID)
	chatJSON := chatToJSON(chat, userID)
	ws.HubInstance.SendToUser(userID, []byte(`{"type":"chat:created","chat":`+chatJSON+`}`))

	return c.Status(201).JSON(fiber.Map{"chat": json.RawMessage(chatJSON), "status": "subscribed"})
}

// InstallStickerPack clones a public pack into the user's own collection
// ("Мои стикеры"). Stickers keep their FileURLs — no re-upload needed.
func InstallStickerPack(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	packID := c.Params("packId")

	var src models.StickerPack
	if err := db.GetDB().Preload("Stickers").First(&src, "id = ?", packID).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Sticker pack not found"})
	}
	if !src.IsPublic {
		return c.Status(403).JSON(fiber.Map{"error": "Pack is not public"})
	}

	var existing int64
	db.GetDB().Model(&models.StickerPack{}).
		Where("creator_id = ? AND name = ?", userID, src.Name).
		Count(&existing)
	if existing > 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Pack with this name already installed"})
	}

	pack := models.StickerPack{
		ID:          generateID(),
		Name:        src.Name,
		Description: src.Description,
		CreatorID:   userID,
		Thumbnail:   src.Thumbnail,
		Type:        src.Type,
		IsPublic:    false,
	}
	if err := db.GetDB().Create(&pack).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to install pack"})
	}

	stickers := make([]models.Sticker, 0, len(src.Stickers))
	for _, s := range src.Stickers {
		stickers = append(stickers, models.Sticker{
			ID:       generateID(),
			PackID:   pack.ID,
			Emoji:    s.Emoji,
			FileURL:  s.FileURL,
			FileSize: s.FileSize,
			Width:    s.Width,
			Height:   s.Height,
			Order:    s.Order,
		})
	}
	if len(stickers) > 0 {
		if err := db.GetDB().Create(&stickers).Error; err != nil {
			db.GetDB().Delete(&models.StickerPack{}, "id = ?", pack.ID)
			return c.Status(500).JSON(fiber.Map{"error": "Failed to copy stickers"})
		}
	}

	return c.Status(201).JSON(fiber.Map{"pack": pack, "stickers": len(stickers)})
}

// StickerDirectory lists public sticker/emoji packs (from any user) with
// their stickers, for the in-app catalog. Returns pack + creator summary.
func StickerDirectory(c *fiber.Ctx) error {
	q := strings.TrimSpace(c.Query("q"))

	dbq := db.GetDB().
		Preload("Stickers", func(g *gorm.DB) *gorm.DB { return g.Order("`order` ASC") }).
		Where("is_public = true")

	if utf8.RuneCountInString(q) >= 2 {
		like := "%" + strings.ReplaceAll(strings.ReplaceAll(q, "%", "\\%"), "_", "\\_") + "%"
		dbq = dbq.Where("name LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\'", like, like)
	}

	var packs []models.StickerPack
	if err := dbq.Order("created_at DESC").Limit(30).Find(&packs).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Directory query failed"})
	}

	// Fetch creators in one pass
	creatorIDs := make([]string, 0, len(packs))
	for _, p := range packs {
		creatorIDs = append(creatorIDs, p.CreatorID)
	}
	var creators []models.User
	db.GetDB().Where("id IN ?", creatorIDs).Find(&creators)
	creatorMap := make(map[string]models.User, len(creators))
	for _, u := range creators {
		creatorMap[u.ID] = u
	}

	items := make([]fiber.Map, 0, len(packs))
	for _, p := range packs {
		stickerItems := make([]fiber.Map, 0, len(p.Stickers))
		for _, s := range p.Stickers {
			stickerItems = append(stickerItems, fiber.Map{
				"id":      s.ID,
				"fileUrl": s.FileURL,
				"emoji":   s.Emoji,
			})
		}
		creator := creatorMap[p.CreatorID]
		item := fiber.Map{
			"packId":      p.ID,
			"name":        p.Name,
			"description": p.Description,
			"type":        p.Type,
			"thumbnail":   p.Thumbnail,
			"stickers":    stickerItems,
			"creator": fiber.Map{
				"id":          p.CreatorID,
				"username":    creator.Username,
				"displayName": creator.DisplayName,
				"avatar":      creator.Avatar,
			},
		}
		if len(p.Stickers) > 0 && p.Thumbnail == "" {
			item["thumbnail"] = p.Stickers[0].FileURL
		}
		items = append(items, item)
	}

	return c.JSON(fiber.Map{"items": items})
}