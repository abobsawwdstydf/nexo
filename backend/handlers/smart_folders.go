package handlers

import (
	"encoding/json"
	"errors"
	"net"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// sqlEscapeLike escapes SQL LIKE special characters to prevent injection
func sqlEscapeLike(s string) string {
	s = strings.ReplaceAll(s, "\\", "\\\\")
	s = strings.ReplaceAll(s, "%", "\\%")
	s = strings.ReplaceAll(s, "_", "\\_")
	return s
}

// SmartFolderRule represents a single filter rule
type SmartFolderRule struct {
	Type  string `json:"type"`  // unread, mentions, media, keyword, chat_type, muted
	Value string `json:"value"` // optional value (e.g., media type, keyword text)
}

// GetSmartFolders returns all smart folders for the current user
func GetSmartFolders(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var folders []models.SmartFolder
	db.GetDB().Where("user_id = ? AND is_active = ?", userID, true).
		Clauses(clause.OrderBy{
			Columns: []clause.OrderByColumn{
				{Column: clause.Column{Name: "order"}},
				{Column: clause.Column{Name: "created_at"}},
			},
		}).
		Find(&folders)

	return c.JSON(fiber.Map{"items": folders})
}

// CreateSmartFolder creates a new smart folder with filter rules
func CreateSmartFolder(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateSmartFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Name is required"})
	}

	// Validate rules JSON
	if req.Rules != "" {
		var rules []SmartFolderRule
		if err := json.Unmarshal([]byte(req.Rules), &rules); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid rules JSON"})
		}
	}

	// Get max order
	var maxOrder int
	db.GetDB().Model(&models.SmartFolder{}).
		Where("user_id = ?", userID).
		Select("COALESCE(MAX(`order`), 0)").
		Scan(&maxOrder)

	folder := models.SmartFolder{
		ID:       generateID(),
		UserID:   userID,
		Name:     req.Name,
		Icon:     req.Icon,
		Color:    req.Color,
		Order:    maxOrder + 1,
		Rules:    req.Rules,
		IsActive: true,
	}

	if err := db.GetDB().Create(&folder).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create smart folder"})
	}

	return c.Status(201).JSON(folder)
}

// UpdateSmartFolder updates a smart folder
func UpdateSmartFolder(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	folderID := c.Params("id")

	var folder models.SmartFolder
	if result := db.GetDB().Where("id = ? AND user_id = ?", folderID, userID).First(&folder); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Smart folder not found"})
	}

	var req models.CreateSmartFolderRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	// Validate rules JSON
	if req.Rules != "" {
		var rules []SmartFolderRule
		if err := json.Unmarshal([]byte(req.Rules), &rules); err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Invalid rules JSON"})
		}
	}

	updates := map[string]interface{}{}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Icon != "" {
		updates["icon"] = req.Icon
	}
	if req.Color != "" {
		updates["color"] = req.Color
	}
	if req.Rules != "" {
		updates["rules"] = req.Rules
	}

	db.GetDB().Model(&folder).Updates(updates)

	return c.JSON(folder)
}

// DeleteSmartFolder deletes a smart folder
func DeleteSmartFolder(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	folderID := c.Params("id")

	result := db.GetDB().Where("id = ? AND user_id = ?", folderID, userID).Delete(&models.SmartFolder{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Smart folder not found"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ReorderSmartFolders updates the order of smart folders
func ReorderSmartFolders(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		FolderIDs []string `json:"folderIds"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	err := db.GetDB().Transaction(func(tx *gorm.DB) error {
		for i, folderID := range req.FolderIDs {
			if err := tx.Model(&models.SmartFolder{}).
				Where("id = ? AND user_id = ?", folderID, userID).
				Update("`order`", i).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to reorder folders"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// GetSmartFolderChats returns chats matching a smart folder's rules
func GetSmartFolderChats(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	folderID := c.Params("id")

	var folder models.SmartFolder
	if result := db.GetDB().Where("id = ? AND user_id = ?", folderID, userID).First(&folder); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Smart folder not found"})
	}

	// Parse rules
	var rules []SmartFolderRule
	if folder.Rules != "" {
		json.Unmarshal([]byte(folder.Rules), &rules)
	}

	// Get user's chat IDs
	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []models.Chat{}, "total": 0})
	}

	// Build query based on rules
	query := db.GetDB().
		Preload("Members").
		Preload("Members.User").
		Where("id IN ?", memberChatIDs)

	query = applySmartFolderRules(query, rules, userID, memberChatIDs)

	var chats []models.Chat
	query.Order("updated_at DESC").Find(&chats)
	for i := range chats {
		sanitizeChatMembers(chats[i].Members)
	}

	return c.JSON(fiber.Map{"items": chats, "total": len(chats)})
}

// applySmartFolderRules applies filter rules to a GORM query
func applySmartFolderRules(query *gorm.DB, rules []SmartFolderRule, userID string, chatIDs []string) *gorm.DB {
	if len(rules) == 0 {
		return query
	}

	for _, rule := range rules {
		switch rule.Type {
		case "unread":
			// Chats where user has unread messages
			var unreadChatIDs []string
			db.GetDB().Raw(`
				SELECT DISTINCT cm.chat_id FROM chat_members cm
				WHERE cm.user_id = ? AND cm.is_archived = false
				AND EXISTS (
					SELECT 1 FROM messages m
					WHERE m.chat_id = cm.chat_id
					AND m.created_at > COALESCE(cm.last_message_at, '1970-01-01')
					AND m.sender_id != ?
				)
			`, userID, userID).Scan(&unreadChatIDs)
			query = query.Where("id IN ?", unreadChatIDs)

		case "mentions":
			// Chats where user is mentioned
			var mentionChatIDs []string
			username := getUserUsername(userID)
			if username != "" {
				escaped := sqlEscapeLike(username)
				db.GetDB().Raw(`
					SELECT DISTINCT m.chat_id FROM messages m
					WHERE m.content LIKE ? ESCAPE '\'
					AND m.sender_id != ?
					AND m.chat_id IN ?
				`, "%@"+escaped+"%", userID, chatIDs).Scan(&mentionChatIDs)
			}
			query = query.Where("id IN ?", mentionChatIDs)

		case "media":
			// Chats with specific media type
			mediaType := rule.Value
			if mediaType == "" {
				mediaType = "any"
			}
			var mediaChatIDs []string
			if mediaType == "any" {
				db.GetDB().Raw(`
					SELECT DISTINCT m.chat_id FROM messages m
					JOIN media me ON me.message_id = m.id
					WHERE m.chat_id IN ?
				`, chatIDs).Scan(&mediaChatIDs)
			} else {
				db.GetDB().Raw(`
					SELECT DISTINCT m.chat_id FROM messages m
					JOIN media me ON me.message_id = m.id
					WHERE m.chat_id IN ? AND me.type = ?
				`, chatIDs, mediaType).Scan(&mediaChatIDs)
			}
			query = query.Where("id IN ?", mediaChatIDs)

		case "keyword":
			// Chats containing keyword in messages
			keyword := rule.Value
			if keyword != "" {
				var keywordChatIDs []string
				escaped := sqlEscapeLike(keyword)
				db.GetDB().Raw(`
					SELECT DISTINCT m.chat_id FROM messages m
					WHERE m.content LIKE ? ESCAPE '\' AND m.chat_id IN ?
				`, "%"+escaped+"%", chatIDs).Scan(&keywordChatIDs)
				query = query.Where("id IN ?", keywordChatIDs)
			}

		case "chat_type":
			// Filter by chat type
			chatType := rule.Value
			if chatType != "" {
				query = query.Where("type = ?", chatType)
			}

		case "muted":
			// Muted chats
			query = query.Where(`
				EXISTS (
					SELECT 1 FROM chat_members cm
					WHERE cm.chat_id = chats.id
					AND cm.user_id = ? AND cm.is_muted = true
				)
			`, userID)

		case "archived":
			// Archived chats
			query = query.Where(`
				EXISTS (
					SELECT 1 FROM chat_members cm
					WHERE cm.chat_id = chats.id
					AND cm.user_id = ? AND cm.is_archived = true
				)
			`, userID)

		case "pinned":
			// Pinned chats
			query = query.Where(`
				EXISTS (
					SELECT 1 FROM chat_members cm
					WHERE cm.chat_id = chats.id
					AND cm.user_id = ? AND cm.is_pinned = true
				)
			`, userID)
		}
	}

	return query
}

// getUserUsername fetches username by user ID
func getUserUsername(userID string) string {
	var user models.User
	if result := db.GetDB().Select("username").First(&user, "id = ?", userID); result.Error != nil {
		return ""
	}
	return user.Username
}

// ─── Shared Notes (Feature 2) ──────────────────────────────────────────

// GetChatNotes returns all notes for a chat
func GetChatNotes(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("id")

	// Verify membership
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}

	var notes []models.ChatNote
	db.GetDB().Where("chat_id = ?", chatID).
		Preload("User").
		Clauses(clause.OrderBy{
			Columns: []clause.OrderByColumn{
				{Column: clause.Column{Name: "pinned"}, Desc: true},
				{Column: clause.Column{Name: "order"}},
				{Column: clause.Column{Name: "created_at"}, Desc: true},
			},
		}).
		Find(&notes)

	return c.JSON(fiber.Map{"items": notes})
}

// CreateChatNote creates a new note in a chat
func CreateChatNote(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Params("id")

	// Verify membership
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", chatID, userID).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}

	var req models.CreateChatNoteRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Content == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Content is required"})
	}

	note := models.ChatNote{
		ID:      generateID(),
		ChatID:  chatID,
		UserID:  userID,
		Content: req.Content,
	}

	if err := db.GetDB().Create(&note).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create note"})
	}

	db.GetDB().Preload("User").First(&note, "id = ?", note.ID)

	// WS notification
	wsHub := ws.HubInstance
	if wsHub != nil {
		noteJSON, _ := json.Marshal(note)
		wsHub.SendToChat(chatID, []byte(`{"type":"note:created","note":`+string(noteJSON)+`}`), userID)
	}

	return c.Status(201).JSON(note)
}

// UpdateChatNote updates a note
func UpdateChatNote(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	noteID := c.Params("noteId")

	var note models.ChatNote
	if result := db.GetDB().Where("id = ? AND user_id = ?", noteID, userID).First(&note); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Note not found"})
	}

	var req struct {
		Content string `json:"content"`
		Pinned  *bool  `json:"pinned"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updates := map[string]interface{}{}
	if req.Content != "" {
		updates["content"] = req.Content
	}
	if req.Pinned != nil {
		updates["pinned"] = *req.Pinned
	}

	db.GetDB().Model(&note).Updates(updates)
	db.GetDB().Preload("User").First(&note, "id = ?", note.ID)

	return c.JSON(note)
}

// DeleteChatNote deletes a note
func DeleteChatNote(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	noteID := c.Params("noteId")

	result := db.GetDB().Where("id = ? AND user_id = ?", noteID, userID).Delete(&models.ChatNote{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Note not found"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ─── Link Collector (Feature 3) ────────────────────────────────────────

// GetCollectedLinks returns collected links with filtering
func GetCollectedLinks(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Query("chatId")
	domain := c.Query("domain")
	category := c.Query("category")
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("pageSize", "30"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 30
	}
	offset := (page - 1) * pageSize

	// Get user's chat IDs
	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []models.CollectedLink{}, "total": 0})
	}

	query := db.GetDB().Model(&models.CollectedLink{}).
		Where("chat_id IN ?", memberChatIDs)

	if chatID != "" {
		query = query.Where("chat_id = ?", chatID)
	}
	if domain != "" {
		query = query.Where("domain = ?", domain)
	}
	if category != "" {
		query = query.Where("category = ?", category)
	}

	var total int64
	query.Count(&total)

	var links []models.CollectedLink
	query.Preload("Chat").Preload("User").
		Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&links)

	return c.JSON(fiber.Map{
		"items":    links,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"hasMore":  int64(offset+pageSize) < total,
	})
}

// SaveCollectedLink marks a link as saved
func SaveCollectedLink(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	linkID := c.Params("linkId")

	result := db.GetDB().Model(&models.CollectedLink{}).
		Where("id = ? AND user_id = ?", linkID, userID).
		Update("is_saved", true)
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Link not found"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// GetLinkDomains returns unique domains from collected links
func GetLinkDomains(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []string{}})
	}

	var domains []string
	db.GetDB().Model(&models.CollectedLink{}).
		Where("chat_id IN ?", memberChatIDs).
		Distinct("domain").
		Pluck("domain", &domains)

	return c.JSON(fiber.Map{"items": domains})
}

// ─── Voice Rooms (Feature 4) ───────────────────────────────────────────

// GetVoiceRooms returns active voice rooms for user's chats
func GetVoiceRooms(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	if len(memberChatIDs) == 0 {
		return c.JSON(fiber.Map{"items": []models.VoiceRoom{}})
	}

	var rooms []models.VoiceRoom
	db.GetDB().Where("chat_id IN ? AND is_active = ?", memberChatIDs, true).
		Preload("Creator").
		Preload("Participants").
		Preload("Participants.User").
		Order("created_at DESC").
		Find(&rooms)

	return c.JSON(fiber.Map{"items": rooms})
}

// CreateVoiceRoom creates a new voice room
func CreateVoiceRoom(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		ChatID      string `json:"chatId"`
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.ChatID == "" || req.Name == "" {
		return c.Status(400).JSON(fiber.Map{"error": "chatId and name are required"})
	}

	// Verify membership
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", req.ChatID, userID).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member"})
	}

	room := models.VoiceRoom{
		ID:          generateID(),
		ChatID:      req.ChatID,
		Name:        req.Name,
		Description: req.Description,
		CreatorID:   userID,
		IsActive:    true,
		MaxUsers:    50,
	}

	if err := db.GetDB().Create(&room).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create voice room"})
	}

	db.GetDB().Preload("Creator").First(&room, "id = ?", room.ID)

	// WS notification
	wsHub := ws.HubInstance
	if wsHub != nil {
		roomJSON, _ := json.Marshal(room)
		wsHub.SendToChat(req.ChatID, []byte(`{"type":"voiceroom:created","room":`+string(roomJSON)+`}`), userID)
	}

	return c.Status(201).JSON(room)
}

// JoinVoiceRoom joins a voice room
func JoinVoiceRoom(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	roomID := c.Params("roomId")

	var room models.VoiceRoom
	if result := db.GetDB().First(&room, "id = ? AND is_active = ?", roomID, true); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Voice room not found"})
	}

	// Check membership in chat
	var memberCount int64
	db.GetDB().Model(&models.ChatMember{}).
		Where("chat_id = ? AND user_id = ?", room.ChatID, userID).
		Count(&memberCount)
	if memberCount == 0 {
		return c.Status(403).JSON(fiber.Map{"error": "Not a member of this chat"})
	}

	// Check if already in room
	var existingParticipant int64
	db.GetDB().Model(&models.VoiceRoomParticipant{}).
		Where("room_id = ? AND user_id = ?", roomID, userID).
		Count(&existingParticipant)
	if existingParticipant > 0 {
		return c.Status(409).JSON(fiber.Map{"error": "Already in voice room"})
	}

	// Check max users (atomic: count + create in transaction)
	participant := models.VoiceRoomParticipant{
		ID:     generateID(),
		RoomID: roomID,
		UserID: userID,
	}

	err := db.GetDB().Transaction(func(tx *gorm.DB) error {
		var participantCount int64
		if err := tx.Model(&models.VoiceRoomParticipant{}).
			Where("room_id = ?", roomID).
			Count(&participantCount).Error; err != nil {
			return err
		}
		if int(participantCount) >= room.MaxUsers {
			return fiber.NewError(fiber.StatusBadRequest, "Voice room is full")
		}
		return tx.Create(&participant).Error
	})
	if err != nil {
		var fiberErr *fiber.Error
		if errors.As(err, &fiberErr) {
			return c.Status(fiberErr.Code).JSON(fiber.Map{"error": fiberErr.Message})
		}
		return c.Status(500).JSON(fiber.Map{"error": "Failed to join voice room"})
	}

	// WS notification
	wsHub := ws.HubInstance
	if wsHub != nil {
		wsHub.SendToChat(room.ChatID, mustWSMap("voiceroom:user_joined", map[string]string{"roomId": roomID, "userId": userID}), "")
	}

	return c.JSON(fiber.Map{"ok": true, "participant": participant})
}

// LeaveVoiceRoom leaves a voice room
func LeaveVoiceRoom(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	roomID := c.Params("roomId")

	var room models.VoiceRoom
	if result := db.GetDB().First(&room, "id = ?", roomID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Voice room not found"})
	}

	db.GetDB().Where("room_id = ? AND user_id = ?", roomID, userID).Delete(&models.VoiceRoomParticipant{})

	// WS notification
	wsHub := ws.HubInstance
	if wsHub != nil {
		wsHub.SendToChat(room.ChatID, mustWSMap("voiceroom:user_left", map[string]string{"roomId": roomID, "userId": userID}), "")
	}

	return c.JSON(fiber.Map{"ok": true})
}

// UpdateVoiceRoomParticipant updates mute/deaf/speaking state
func UpdateVoiceRoomParticipant(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	roomID := c.Params("roomId")

	var req struct {
		IsMuted    *bool `json:"isMuted"`
		IsDeaf     *bool `json:"isDeaf"`
		IsSpeaking *bool `json:"isSpeaking"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	updates := map[string]interface{}{}
	if req.IsMuted != nil {
		updates["is_muted"] = *req.IsMuted
	}
	if req.IsDeaf != nil {
		updates["is_deaf"] = *req.IsDeaf
	}
	if req.IsSpeaking != nil {
		updates["is_speaking"] = *req.IsSpeaking
	}

	result := db.GetDB().Model(&models.VoiceRoomParticipant{}).
		Where("room_id = ? AND user_id = ?", roomID, userID).
		Updates(updates)
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Not in voice room"})
	}

	// WS notification
	var room models.VoiceRoom
	db.GetDB().First(&room, "id = ?", roomID)
	wsHub := ws.HubInstance
	if wsHub != nil {
		wsHub.SendToChat(room.ChatID, mustWSMap("voiceroom:participant_updated", map[string]string{"roomId": roomID, "userId": userID}), "")
	}

	return c.JSON(fiber.Map{"ok": true})
}

// DeleteVoiceRoom deletes a voice room (creator only)
func DeleteVoiceRoom(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	roomID := c.Params("roomId")

	var room models.VoiceRoom
	if result := db.GetDB().First(&room, "id = ? AND creator_id = ?", roomID, userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Voice room not found or not creator"})
	}

	db.GetDB().Where("room_id = ?", roomID).Delete(&models.VoiceRoomParticipant{})
	db.GetDB().Delete(&room)

	// WS notification
	wsHub := ws.HubInstance
	if wsHub != nil {
		wsHub.SendToChat(room.ChatID, mustWSMsg("voiceroom:deleted", "roomId", roomID), "")
	}

	return c.JSON(fiber.Map{"ok": true})
}

// ─── Anonymous Chats (Feature 5) ───────────────────────────────────────

// anonymous aliases for random matching
var anonymousAliases = []string{
	"Таинственный", "Неизвестный", "Путник", "Странник", "Скиталец",
	"Тень", "Призрак", "Фантом", "Дух", "Полтергейст",
	"Кот", "Лис", "Волк", "Орёл", "Дракон",
	"Рыцарь", "Викинг", "Пират", "Ниндзя", "Самурай",
}

// anonymousMatchMu prevents race conditions when matching anonymous chats
var anonymousMatchMu sync.Mutex

// FindAnonymousMatch finds or creates an anonymous chat match
func FindAnonymousMatch(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateAnonymousChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	anonymousMatchMu.Lock()
	defer anonymousMatchMu.Unlock()

	// Look for existing unmatched chat where this user is user1
	var existing models.AnonymousChat
	if result := db.GetDB().Where("user1_id = ? AND user2_id = '' AND is_connected = false", userID).First(&existing); result.Error == nil {
		return c.JSON(fiber.Map{"chat": existing, "status": "waiting"})
	}

	// Find a waiting chat from another user (double-check still unmatched)
	var waitingChat models.AnonymousChat
	if result := db.GetDB().Where("user1_id != ? AND user2_id = '' AND is_connected = false", userID).First(&waitingChat); result.Error == nil {
		// Re-check to prevent race condition
		var recheck models.AnonymousChat
		if result := db.GetDB().First(&recheck, "id = ? AND user2_id = '' AND is_connected = false", waitingChat.ID); result.Error != nil {
			// Someone else already matched, create new waiting room
			return createWaitingRoom(c, userID, req.Topic)
		}

		// Match found!
		waitingChat.User2ID = userID
		waitingChat.User2Alias = anonymousAliases[time.Now().UnixNano()%int64(len(anonymousAliases))]
		waitingChat.IsConnected = true
		db.GetDB().Save(&waitingChat)

		return c.JSON(fiber.Map{"chat": waitingChat, "status": "matched"})
	}

	return createWaitingRoom(c, userID, req.Topic)
}

func createWaitingRoom(c *fiber.Ctx, userID, topic string) error {
	chat := models.AnonymousChat{
		ID:          generateID(),
		User1ID:     userID,
		User1Alias:  anonymousAliases[time.Now().UnixNano()%int64(len(anonymousAliases))],
		IsConnected: false,
		Topic:       topic,
	}

	if err := db.GetDB().Create(&chat).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create anonymous chat"})
	}

	return c.JSON(fiber.Map{"chat": chat, "status": "waiting"})
}

// RateAnonymousChat rates an anonymous chat partner
func RateAnonymousChat(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.RateAnonymousChatRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var chat models.AnonymousChat
	if result := db.GetDB().Where("id = ? AND (user1_id = ? OR user2_id = ?)",
		req.ChatID, userID, userID).First(&chat); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Anonymous chat not found"})
	}

	// Update rating
	now := time.Now()
	db.GetDB().Model(&chat).Updates(map[string]interface{}{
		"rating":   req.Rating,
		"ended_at": &now,
	})

	return c.JSON(fiber.Map{"ok": true})
}

// GetAnonymousChats returns user's anonymous chats
func GetAnonymousChats(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var chats []models.AnonymousChat
	db.GetDB().Where("user1_id = ? OR user2_id = ?", userID, userID).
		Order("started_at DESC").
		Limit(20).
		Find(&chats)

	return c.JSON(fiber.Map{"items": chats})
}

// ─── Webhooks / Backend Hooks (Feature 10) ─────────────────────────────

// GetWebhookConfigs returns webhook configurations for the user
func GetWebhookConfigs(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var webhooks []models.WebhookConfig
	db.GetDB().Where("user_id = ?", userID).Find(&webhooks)

	return c.JSON(fiber.Map{"items": webhooks})
}

// CreateWebhookConfig creates a new webhook
func CreateWebhookConfig(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req models.CreateWebhookRequest
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.URL == "" {
		return c.Status(400).JSON(fiber.Map{"error": "URL is required"})
	}

	webhook := models.WebhookConfig{
		ID:       generateID(),
		UserID:   userID,
		URL:      req.URL,
		Events:   req.Events,
		Secret:   generateWebhookSecret(),
		IsActive: true,
	}

	if err := db.GetDB().Create(&webhook).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create webhook"})
	}

	return c.Status(201).JSON(webhook)
}

// DeleteWebhookConfig deletes a webhook
func DeleteWebhookConfig(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	webhookID := c.Params("webhookId")

	result := db.GetDB().Where("id = ? AND user_id = ?", webhookID, userID).Delete(&models.WebhookConfig{})
	if result.RowsAffected == 0 {
		return c.Status(404).JSON(fiber.Map{"error": "Webhook not found"})
	}

	return c.JSON(fiber.Map{"ok": true})
}

// isURLSafe validates a URL to prevent SSRF attacks
func isURLSafe(rawURL string) bool {
	u, err := url.Parse(rawURL)
	if err != nil {
		return false
	}
	// Only allow HTTP/HTTPS
	if u.Scheme != "http" && u.Scheme != "https" {
		return false
	}
	host := u.Hostname()
	if host == "" {
		return false
	}
	// Block internal/private addresses
	lowerHost := strings.ToLower(host)
	blockedHosts := []string{
		"localhost", "127.0.0.1", "::1", "0.0.0.0",
		"metadata.google.internal", "169.254.169.254",
		"0.0.0.0", "255.255.255.255",
	}
	for _, bh := range blockedHosts {
		if lowerHost == bh || strings.HasSuffix(lowerHost, "."+bh) {
			return false
		}
	}
	// Block private IP ranges
	if ip := net.ParseIP(host); ip != nil {
		if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
			return false
		}
	} else {
		// Resolve the hostname and reject if ANY resolved address is internal.
		// Mitigates DNS-rebinding and domains pointing at 169.254.169.254,
		// decimal/hex IPs, etc.
		addrs, err := net.LookupIP(host)
		if err == nil {
			for _, a := range addrs {
				if a.IsLoopback() || a.IsPrivate() || a.IsLinkLocalUnicast() || a.IsLinkLocalMulticast() || a.IsUnspecified() {
					return false
				}
			}
		}
	}
	// Block common internal ports
	port := u.Port()
	blockedPorts := []string{"22", "3306", "5432", "6379", "8080", "9200", "27017"}
	for _, bp := range blockedPorts {
		if port == bp {
			return false
		}
	}
	return true
}

func generateWebhookSecret() string {
	return generateID() // Reuse ID generation
}
