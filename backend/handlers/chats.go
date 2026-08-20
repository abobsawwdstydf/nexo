package handlers

import (
	"encoding/json"
	"regexp"
	"strconv"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

var chatUsernameRegex = regexp.MustCompile(`^[a-zA-Z0-9_]{3,64}$`)

// JSON output structs for safe marshaling
type ChatMemberJSON struct {
	ID                string `json:"id"`
	UserID            string `json:"userId"`
	Role              string `json:"role"`
	DisplayName       string `json:"displayName"`
	Avatar            string `json:"avatar"`
	IsOnline          bool   `json:"isOnline"`
	IsVerified        bool   `json:"isVerified"`
	VerifiedBadgeUrl  string `json:"verifiedBadgeUrl"`
	VerifiedBadgeType string `json:"verifiedBadgeType"`
}

type ChatJSON struct {
	ID              string          `json:"id"`
	Type            string          `json:"type"`
	Name            string          `json:"name"`
	Avatar          string          `json:"avatar"`
	Description     string          `json:"description"`
	IsVerified      bool            `json:"isVerified"`
	IsSecret        bool            `json:"isSecret"`
	IsE2E           bool            `json:"isE2E"`
	SubscribersCount int           `json:"subscribersCount"`
	CanMembersPost   bool          `json:"canMembersPost"`
	CanMembersInvite bool          `json:"canMembersInvite"`
	SlowModeInterval int           `json:"slowModeInterval"`
	WelcomeMessage   string        `json:"welcomeMessage"`
	Rules            string        `json:"rules"`
	CustomIcon       string        `json:"customIcon"`
	CustomColor      string        `json:"customColor"`
	CustomBackground string        `json:"customBackground"`
	CreatedAt        string        `json:"createdAt"`
	UpdatedAt        string        `json:"updatedAt"`
	Members          []ChatMemberJSON `json:"members"`
}

func chatToJSON(chat models.Chat, viewerID string) string {
	membersJSON := make([]ChatMemberJSON, 0, len(chat.Members))
	for _, m := range chat.Members {
		membersJSON = append(membersJSON, ChatMemberJSON{
			ID:                m.ID,
			UserID:            m.UserID,
			Role:              m.Role,
			DisplayName:       m.User.DisplayName,
			Avatar:            m.User.Avatar,
			IsOnline:          m.User.IsOnline,
			IsVerified:        m.User.IsVerified,
			VerifiedBadgeUrl:  m.User.VerifiedBadgeUrl,
			VerifiedBadgeType: m.User.VerifiedBadgeType,
		})
	}

	name := chat.Name
	if name == "" && chat.Type == "personal" {
		for _, m := range chat.Members {
			if m.UserID != viewerID {
				name = m.User.DisplayName
				if name == "" {
					name = m.User.Username
				}
				break
			}
		}
	}

	chatJSON := ChatJSON{
		ID:               chat.ID,
		Type:             chat.Type,
		Name:             name,
		Avatar:           chat.Avatar,
		Description:      chat.Description,
		IsVerified:       chat.IsVerified,
		IsSecret:         chat.IsSecret,
		IsE2E:            chat.IsE2E,
		SubscribersCount: chat.SubscribersCount,
		CanMembersPost:   chat.CanMembersPost,
		CanMembersInvite: chat.CanMembersInvite,
		SlowModeInterval: chat.SlowModeInterval,
		WelcomeMessage:   chat.WelcomeMessage,
		Rules:            chat.Rules,
		CustomIcon:       chat.CustomIcon,
		CustomColor:      chat.CustomColor,
		CustomBackground: chat.CustomBackground,
		CreatedAt:        chat.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
		UpdatedAt:        chat.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		Members:          membersJSON,
	}

	data, _ := json.Marshal(chatJSON)
	return string(data)
}

func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

func CreateChat(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Type == "" {
		req.Type = "personal"
	}

	// Validate chat type
	if req.Type != "personal" && req.Type != "group" && req.Type != "channel" {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid chat type"})
	}

	// Validate username format if provided
	if req.Username != "" {
		if !chatUsernameRegex.MatchString(req.Username) {
			return c.Status(400).JSON(fiber.Map{"error": "Chat username must be 3-64 characters, letters, numbers, and underscores only"})
		}
		// Check uniqueness
		var existingChat models.Chat
		if result := db.GetDB().Where("username = ?", req.Username).First(&existingChat); result.Error == nil {
			return c.Status(409).JSON(fiber.Map{"error": "Chat username already taken"})
		}
	}

	// Validate name length
	if len(req.Name) > 128 {
		return c.Status(400).JSON(fiber.Map{"error": "Chat name too long (max 128 characters)"})
	}

	// Use transaction for atomicity
	var chat models.Chat
	err := db.GetDB().Transaction(func(tx *gorm.DB) error {
		chat = models.Chat{
			ID:              generateID(),
			Type:            req.Type,
			Name:            req.Name,
			Username:        req.Username,
			Description:     req.Description,
			IsSecret:        req.IsSecret,
			IsE2E:           req.IsE2E,
			WelcomeMessage:  req.WelcomeMessage,
			CanMembersPost:  true,
			CanMembersInvite: true,
		}

		if err := tx.Create(&chat).Error; err != nil {
			return err
		}

		member := models.ChatMember{
			ID:     generateID(),
			ChatID: chat.ID,
			UserID: userID,
			Role:   "admin",
		}
		if err := tx.Create(&member).Error; err != nil {
			return err
		}

		memberIDs := map[string]bool{userID: true}
		for _, mid := range req.MemberIDs {
			if mid == "" || memberIDs[mid] {
				continue
			}
			m := models.ChatMember{
				ID:     generateID(),
				ChatID: chat.ID,
				UserID: mid,
				Role:   "member",
			}
			if err := tx.Create(&m).Error; err != nil {
				return err
			}
			memberIDs[mid] = true
		}
		return nil
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create chat"})
	}

	db.GetDB().Preload("Members").Preload("Members.User").First(&chat, "id = ?", chat.ID)
	sanitizeChatMembers(chat.Members)

	wsHub := ws.HubInstance
	for _, mid := range req.MemberIDs {
		if mid == userID {
			continue
		}
		chatJSON := chatToJSON(chat, mid)
		wsHub.SendToUser(mid, []byte(`{"type":"chat:created","chat":`+chatJSON+`}`))
	}

	return c.Status(201).JSON(chat)
}

func GetChats(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("pageSize", "50"))
	if page < 1 { page = 1 }
	if pageSize < 1 || pageSize > 100 { pageSize = 50 }
	offset := (page - 1) * pageSize

	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []models.Chat{}, "total": 0, "page": page, "pageSize": pageSize})
	}

	var chats []models.Chat
	db.GetDB().
		Preload("Members").
		Preload("Members.User").
		Where("id IN ?", memberChatIDs).
		Order("updated_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&chats)

	var total int64
	db.GetDB().Model(&models.Chat{}).Where("id IN ?", memberChatIDs).Count(&total)

	for i := range chats {
		sanitizeChatMembers(chats[i].Members)
	}

	return c.JSON(fiber.Map{
		"items":    chats,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"hasMore":  int64(offset+pageSize) < total,
	})
}

func GetChat(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var chat models.Chat
	if result := db.GetDB().
		Preload("Members").
		Preload("Members.User").
		First(&chat, "id = ?", chatID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Chat not found"})
	}

	// Check membership
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	sanitizeChatMembers(chat.Members)
	return c.JSON(chat)
}

func AddChatMember(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		UserID string `json:"userId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.UserID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "userId required"})
	}

	// Check caller is admin/owner
	var callerMember models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&callerMember); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}
	if callerMember.Role != "admin" && callerMember.Role != "owner" {
		return c.Status(403).JSON(fiber.Map{"error": "Only admins can add members"})
	}

	var chat models.Chat
	if result := db.GetDB().First(&chat, "id = ?", chatID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Chat not found"})
	}

	var existing models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, req.UserID).First(&existing); result.Error == nil {
		return c.Status(409).JSON(fiber.Map{"error": "User already in chat"})
	}

	member := models.ChatMember{
		ID:     generateID(),
		ChatID: chatID,
		UserID: req.UserID,
		Role:   "member",
	}
	if err := db.GetDB().Create(&member).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to add member"})
	}

	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).
		Update("subscribers_count", gorm.Expr("subscribers_count + 1"))

	// Keep the hub's in-memory membership in sync.
	ws.HubInstance.JoinChat(chatID, req.UserID)

	ws.HubInstance.SendToUser(req.UserID, mustWSMap("chat:member_added", map[string]string{
		"chatId": chatID,
	}))

	return c.JSON(member)
}

func LeaveChat(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	// Check membership
	var member models.ChatMember
	if result := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member); result.Error != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}

	// Check if last member
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).Where("chat_id = ?", chatID).Count(&memberCount)
	if memberCount <= 1 {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot leave chat as last member. Delete the chat instead."})
	}

	db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).Delete(&models.ChatMember{})
	db.GetDB().Model(&models.Chat{}).Where("id = ?", chatID).
		Update("subscribers_count", memberCount-1)

	// Keep the hub's in-memory membership in sync so the leaving user stops
	// receiving live messages immediately (no wait for a reconnect).
	ws.HubInstance.LeaveChat(chatID, userID)

	return c.JSON(fiber.Map{"ok": true})
}

func PinChat(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("is_pinned", true)

	return c.JSON(fiber.Map{"ok": true})
}

func ArchiveChat(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("is_archived", true)

	return c.JSON(fiber.Map{"ok": true})
}

// GetOrCreateFavorites returns the user's personal "Избранное" chat,
// creating it if it doesn't exist yet.
func GetOrCreateFavorites(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	// Find existing favorites chat for this user
	var favChatIDs []string
	db.GetDB().Raw(`
		SELECT cm.chat_id FROM chat_members cm
		JOIN chats ch ON ch.id = cm.chat_id
		WHERE cm.user_id = ? AND ch.type = 'favorites'
		LIMIT 1
	`, userID).Scan(&favChatIDs)

	if len(favChatIDs) > 0 {
		var chat models.Chat
		if err := db.GetDB().
			Preload("Members", func(db *gorm.DB) *gorm.DB {
				return db.Preload("User")
			}).
			First(&chat, "id = ?", favChatIDs[0]).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Failed to load favorites chat"})
		}
		sanitizeChatMembers(chat.Members)
		return c.JSON(chat)
	}

	// Create new favorites chat in a transaction
	var chat models.Chat
	if err := db.GetDB().Transaction(func(tx *gorm.DB) error {
		chat = models.Chat{
			ID:       generateID(),
			Type:     "favorites",
			Name:     "Избранное",
			IsSecret: false,
		}
		if err := tx.Create(&chat).Error; err != nil {
			return err
		}

		member := models.ChatMember{
			ID:     generateID(),
			ChatID: chat.ID,
			UserID: userID,
			Role:   "admin",
		}
		return tx.Create(&member).Error
	}); err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create favorites chat"})
	}

	// Reload with preloaded members
	db.GetDB().
		Preload("Members", func(db *gorm.DB) *gorm.DB {
			return db.Preload("User")
		}).
		First(&chat, "id = ?", chat.ID)
	sanitizeChatMembers(chat.Members)

	return c.Status(201).JSON(chat)
}

// SetChatMute toggles the user's server-side mute for a chat
// (PUT /api/chats/:id/mute, body {muted bool}). Verifies membership, persists
// ChatMember.isMuted (single source of truth — push is suppressed for muted
// chats, see NotifyChatMembersPush in push.go) and broadcasts chat:updated to
// the user's connected devices so the UI stays in sync.
func SetChatMute(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID, ok := c.Locals("userId").(string)
	if !ok || userID == "" {
		return c.Status(401).JSON(fiber.Map{"error": "Unauthorized"})
	}

	var req struct {
		Muted bool `json:"muted"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Verify membership before muting.
	var member models.ChatMember
	if err := db.GetDB().Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member).Error; err != nil {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	if err := db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("is_muted", req.Muted).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update mute status"})
	}

	ws.HubInstance.SendToUser(userID, mustWSMap("chat:updated", map[string]string{
		"chatId": chatID,
		"muted":  boolStr(req.Muted),
	}))

	return c.JSON(fiber.Map{"ok": true, "muted": req.Muted})
}

func MuteChat(c *fiber.Ctx) error {
	chatID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Muted bool `json:"muted"`
	}
	if err := c.BodyParser(&req); err != nil {
		// Default to toggling mute if no body
		req.Muted = true
	}

	result := db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Update("is_muted", req.Muted)

	if result.Error != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to update mute status"})
	}

	return c.JSON(fiber.Map{"ok": true, "muted": req.Muted})
}
