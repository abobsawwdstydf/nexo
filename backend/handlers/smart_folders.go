package handlers

import (
	"encoding/json"
	"errors"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"nexo/ai"
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

// collectLinksFromMessage scans a message for URLs and creates CollectedLink records
func collectLinksFromMessage(messageID, chatID, senderID, content string) {
	// Simple URL extraction
	urls := extractURLs(content)
	if len(urls) == 0 {
		return
	}

	for _, url := range urls {
		domain := extractDomain(url)
		category := categorizeURL(url)

		link := models.CollectedLink{
			ID:       generateID(),
			ChatID:   chatID,
			MessageID: messageID,
			UserID:   senderID,
			URL:      url,
			Domain:   domain,
			Category: category,
		}
		if err := db.GetDB().Create(&link).Error; err != nil {
			log.Printf("WARNING: Failed to collect link %s: %v", url, err)
		}
	}
}

// extractURLs finds all URLs in text
func extractURLs(text string) []string {
	var urls []string
	words := strings.Fields(text)
	for _, word := range words {
		word = strings.Trim(word, ".,!?;:\"'()[]{}")
		if strings.HasPrefix(word, "http://") || strings.HasPrefix(word, "https://") {
			urls = append(urls, word)
		}
	}
	return urls
}

// extractDomain gets domain from URL
func extractDomain(url string) string {
	domain := url
	if idx := strings.Index(domain, "://"); idx != -1 {
		domain = domain[idx+3:]
	}
	if idx := strings.Index(domain, "/"); idx != -1 {
		domain = domain[:idx]
	}
	if idx := strings.Index(domain, "?"); idx != -1 {
		domain = domain[:idx]
	}
	return domain
}

// categorizeURL categorizes a URL based on domain/content
func categorizeURL(url string) string {
	domain := strings.ToLower(extractDomain(url))

	imageHosts := []string{"imgur.com", "i.imgur.com", "pbs.twimg.com", "instagram.com", "photos.google.com"}
	videoHosts := []string{"youtube.com", "youtu.be", "vimeo.com", "tiktok.com", "rutube.ru"}
	docHosts := []string{"docs.google.com", "notion.so", "github.com", "gitlab.com"}

	for _, h := range imageHosts {
		if strings.Contains(domain, h) {
			return "image"
		}
	}
	for _, h := range videoHosts {
		if strings.Contains(domain, h) {
			return "video"
		}
	}
	for _, h := range docHosts {
		if strings.Contains(domain, h) {
			return "document"
		}
	}

	// Check file extensions
	lower := strings.ToLower(url)
	if strings.HasSuffix(lower, ".jpg") || strings.HasSuffix(lower, ".png") ||
		strings.HasSuffix(lower, ".gif") || strings.HasSuffix(lower, ".webp") {
		return "image"
	}
	if strings.HasSuffix(lower, ".mp4") || strings.HasSuffix(lower, ".webm") ||
		strings.HasSuffix(lower, ".avi") || strings.HasSuffix(lower, ".mov") {
		return "video"
	}

	return "link"
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

// ─── Gamification (Feature 6) ──────────────────────────────────────────

// GetUserXP returns XP info for the current user
func GetUserXP(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var userXP models.UserXP
	if result := db.GetDB().Where("user_id = ?", userID).First(&userXP); result.Error != nil {
		// Create XP record
		userXP = models.UserXP{
			ID:     generateID(),
			UserID: userID,
			TotalXP: 0,
			Level:   1,
			Streak:  0,
		}
		db.GetDB().Create(&userXP)
	}

	// Get achievements
	var achievements []models.Achievement
	db.GetDB().Find(&achievements)

	var userAchievements []models.UserAchievement
	db.GetDB().Where("user_id = ?", userID).Find(&userAchievements)

	// Calculate level from XP
	level := calculateLevel(userXP.TotalXP)

	return c.JSON(fiber.Map{
		"userXP":     userXP,
		"level":      level,
		"nextLevelXP": calculateXPForLevel(level + 1),
		"achievements": achievements,
		"userAchievements": userAchievements,
	})
}

// GetUserLeaderboard returns top users by XP
func GetUserLeaderboard(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	pageSize, _ := strconv.Atoi(c.Query("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 50 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	var leaders []models.UserXP
	db.GetDB().Preload("User").
		Order("total_xp DESC").
		Offset(offset).Limit(pageSize).
		Find(&leaders)

	return c.JSON(fiber.Map{"items": leaders, "page": page})
}

// addXP adds XP to a user and checks for achievements
func addXP(userID string, amount int, reason string) {
	var userXP models.UserXP
	if result := db.GetDB().Where("user_id = ?", userID).First(&userXP); result.Error != nil {
		userXP = models.UserXP{
			ID:     generateID(),
			UserID: userID,
		}
		db.GetDB().Create(&userXP)
	}

	// Check daily streak
	now := time.Now()
	lastActive := userXP.LastActive
	if lastActive.Year() == now.Year() && lastActive.Month() == now.Month() && lastActive.Day() == now.Day() {
		// Same day, no streak change
	} else if lastActive.Year() == now.Year() && lastActive.Month() == now.Month() && lastActive.Day() == now.Day()-1 {
		// Yesterday, increment streak
		userXP.Streak++
	} else if lastActive.IsZero() {
		userXP.Streak = 1
	} else {
		// Streak broken
		userXP.Streak = 1
	}

	userXP.TotalXP += amount
	userXP.Level = calculateLevel(userXP.TotalXP)
	userXP.LastActive = now
	db.GetDB().Save(&userXP)

	// Log XP
	xpLog := models.XPLog{
		ID:     generateID(),
		UserID: userID,
		Amount: amount,
		Reason: reason,
	}
	db.GetDB().Create(&xpLog)

	// Check achievements
	checkAchievements(userID, userXP.TotalXP)
}

// calculateLevel calculates level from XP
func calculateLevel(xp int) int {
	level := 1
	xpNeeded := 100
	for xp >= xpNeeded {
		xp -= xpNeeded
		level++
		xpNeeded = int(float64(xpNeeded) * 1.5)
	}
	return level
}

// calculateXPForLevel calculates total XP needed for a level
func calculateXPForLevel(level int) int {
	total := 0
	xpNeeded := 100
	for i := 1; i < level; i++ {
		total += xpNeeded
		xpNeeded = int(float64(xpNeeded) * 1.5)
	}
	return total
}

// checkAchievements checks and unlocks achievements
func checkAchievements(userID string, totalXP int) {
	var achievements []models.Achievement
	db.GetDB().Find(&achievements)

	for _, ach := range achievements {
		var existing models.UserAchievement
		if result := db.GetDB().Where("user_id = ? AND achievement_id = ?", userID, ach.ID).First(&existing); result.Error == nil {
			continue // Already has this achievement
		}

		// Check if earned
		earned := false
		switch ach.Name {
		case "first_message":
			var count int64
			db.GetDB().Model(&models.Message{}).Where("sender_id = ?", userID).Count(&count)
			earned = count >= 1
		case "hundred_messages":
			var count int64
			db.GetDB().Model(&models.Message{}).Where("sender_id = ?", userID).Count(&count)
			earned = count >= 100
		case "level_5":
			earned = calculateLevel(totalXP) >= 5
		case "level_10":
			earned = calculateLevel(totalXP) >= 10
		case "streak_7":
			var userXP models.UserXP
			db.GetDB().Where("user_id = ?", userID).First(&userXP)
			earned = userXP.Streak >= 7
		case "first_friend":
			var count int64
			db.GetDB().Model(&models.Friendship{}).
				Where("(user_id = ? OR friend_id = ?) AND status = ?", userID, userID, "accepted").
				Count(&count)
			earned = count >= 1
		}

		if earned {
			now := time.Now()
			userAch := models.UserAchievement{
				ID:            generateID(),
				UserID:        userID,
				AchievementID: ach.ID,
				Progress:      100,
				UnlockedAt:    &now,
			}
			db.GetDB().Create(&userAch)
		}
	}
}

// ─── AI Commands (Feature 8) ───────────────────────────────────────────

// HandleAICommand processes /нексо-ии commands
func HandleAICommand(userID, chatID, messageID, content string) {
	// Parse command: /нексо-ии [prompt] or /нексо-ии model:[model] [prompt]
	prompt := strings.TrimPrefix(content, "/нексо-ии")
	prompt = strings.TrimPrefix(prompt, "/nexo-ai")
	prompt = strings.TrimSpace(prompt)

	if prompt == "" {
		return
	}

	// Parse optional model
	model := "default"
	if strings.HasPrefix(prompt, "model:") {
		parts := strings.SplitN(prompt, " ", 2)
		if len(parts) == 2 {
			model = strings.TrimPrefix(parts[0], "model:")
			prompt = parts[1]
		}
	}

	startTime := time.Now()

	// Use embedded AI agent
	agent := ai.NewAgent()
	response, _, err := agent.LLM.Simple("Ты — AI-ассистент NEXO мессенджера. Отвечай на русском языке. Будь полезным и информативным.", prompt)
	if err != nil {
		response = "Ошибка AI: " + err.Error()
	}
	agent.Close()

	duration := time.Since(startTime).Milliseconds()

	log := models.AICommandLog{
		ID:         generateID(),
		UserID:     userID,
		ChatID:     chatID,
		MessageID:  messageID,
		Command:    "нексо-ии",
		Prompt:     prompt,
		Response:   response,
		Model:      model,
		TokensUsed: len(prompt) + len(response),
		Duration:   int(duration),
	}
	db.GetDB().Create(&log)

	// Send response as a message
	aiMessage := models.Message{
		ID:        generateID(),
		ChatID:    chatID,
		SenderID:  "ai-assistant",
		Content:   response,
		Type:      "text",
		CreatedAt: time.Now(),
	}
	db.GetDB().Create(&aiMessage)

	// WS notification
	wsHub := ws.HubInstance
	if wsHub != nil {
		msgJSON, _ := json.Marshal(aiMessage)
		wsHub.SendToChat(chatID, []byte(`{"type":"message:new","message":`+string(msgJSON)+`}`), "ai-assistant")
	}
}

// GetAICommandHistory returns AI command history for a chat
func GetAICommandHistory(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)
	chatID := c.Query("chatId")

	var logs []models.AICommandLog
	query := db.GetDB().Where("user_id = ?", userID)
	if chatID != "" {
		query = query.Where("chat_id = ?", chatID)
	}
	query.Order("created_at DESC").Limit(50).Find(&logs)

	return c.JSON(fiber.Map{"items": logs})
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

// triggerWebhooks fires webhooks for an event
func triggerWebhooks(userID string, event string, payload interface{}) {
	var webhooks []models.WebhookConfig
	db.GetDB().Where("user_id = ? AND is_active = ?", userID, true).Find(&webhooks)

	for _, wh := range webhooks {
		// Check if event matches
		if !strings.Contains(wh.Events, event) {
			continue
		}

		// Validate webhook URL to prevent SSRF
		if !isURLSafe(wh.URL) {
			continue
		}

		payloadJSON, err := json.Marshal(payload)
		if err != nil {
			log.Printf("[webhooks] marshal payload for event %s: %v", event, err)
			continue
		}
		delivery := models.WebhookDelivery{
			ID:        generateID(),
			WebhookID: wh.ID,
			Event:     event,
			Payload:   string(payloadJSON),
		}

		// Fire HTTP request (non-blocking)
		go func(url string, delivery models.WebhookDelivery, payloadJSON []byte) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[webhooks] panic delivering to %s: %v", url, r)
				}
			}()
			client := &http.Client{Timeout: 10 * time.Second}
			resp, err := client.Post(url, "application/json",
				strings.NewReader(string(payloadJSON)))
			if err != nil {
				delivery.StatusCode = 0
				delivery.ResponseBody = err.Error()
				delivery.Success = false
			} else {
				delivery.StatusCode = resp.StatusCode
				delivery.Success = resp.StatusCode >= 200 && resp.StatusCode < 300
				body, readErr := io.ReadAll(resp.Body)
				resp.Body.Close()
				if readErr == nil && len(body) > 0 {
					delivery.ResponseBody = string(body)
				}
			}
			if err := db.GetDB().Create(&delivery).Error; err != nil {
				log.Printf("[webhooks] failed to save delivery for %s: %v", url, err)
			}
		}(wh.URL, delivery, payloadJSON)
	}
}

func generateWebhookSecret() string {
	return generateID() // Reuse ID generation
}
