package handlers

import (
	"sort"
	"time"

	"github.com/gofiber/fiber/v2"
	"gorm.io/gorm"

	"nexo/db"
	"nexo/middleware"
	"nexo/models"
)

// InitResponse is the combined payload returned by GET /api/init.
type InitResponse struct {
	User         models.User          `json:"user"`
	Chats        []models.Chat        `json:"chats"`
	Settings     UserSettingsJSON     `json:"settings"`
	SmartFolders []models.SmartFolder `json:"smartFolders"`
	Stories      []StoryGroupJSON     `json:"stories"`
	CsrfToken    string               `json:"csrfToken"`
}

type UserSettingsJSON struct {
	NotifyAll        bool `json:"notifyAll"`
	NotifyMessages   bool `json:"notifyMessages"`
	NotifyCalls      bool `json:"notifyCalls"`
	NotifyFriends    bool `json:"notifyFriends"`
	TwoFactorEnabled bool `json:"twoFactorEnabled"`
}

type StoryGroupJSON struct {
	UserID      string      `json:"userId"`
	DisplayName string      `json:"displayName"`
	Avatar      string      `json:"avatar"`
	IsOnline    bool        `json:"isOnline"`
	Stories     []StoryJSON `json:"stories"`
}

type StoryJSON struct {
	ID        string `json:"id"`
	Type      string `json:"type"`
	MediaURL  string `json:"mediaUrl"`
	Content   string `json:"content"`
	BgColor   string `json:"bgColor"`
	CreatedAt string `json:"createdAt"`
	ExpiresAt string `json:"expiresAt"`
}

// GetInit returns all initial data in a single response.
// Replaces 7+ separate requests on app load.
func GetInit(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	// 1. User profile
	var user models.User
	if result := db.GetDB().First(&user, "id = ?", userID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "User not found"})
	}

	// 2. Chats — fetch chat IDs, then load chats with only last message
	var memberChatIDs []string
	db.GetDB().Model(&models.ChatMember{}).
		Where("user_id = ?", userID).
		Pluck("chat_id", &memberChatIDs)

	chats := make([]models.Chat, 0)
	if len(memberChatIDs) > 0 {
		db.GetDB().
			Preload("Members").
			Preload("Members.User").
			Preload("Messages", func(db *gorm.DB) *gorm.DB {
				return db.Order("created_at DESC").Limit(1)
			}).
			Where("id IN ?", memberChatIDs).
			Order("updated_at DESC").
			Limit(50).
			Find(&chats)
		for i := range chats {
			sanitizeChatMembers(chats[i].Members)
		}
	}

	// 3. User settings (already in user model, just format)
	settings := UserSettingsJSON{
		NotifyAll:        user.NotifyAll,
		NotifyMessages:   user.NotifyMessages,
		NotifyCalls:      user.NotifyCalls,
		NotifyFriends:    user.NotifyFriends,
		TwoFactorEnabled: user.TwoFactorEnabled,
	}

	// 4. Smart folders
	var smartFolders []models.SmartFolder
	db.GetDB().Where("user_id = ?", userID).Order(`"order" ASC`).Find(&smartFolders)

	// 5. Stories (only active, non-expired, from friends)
	var stories []models.Story
	db.GetDB().
		Preload("User").
		Where("user_id IN ? AND expires_at > ?", getFriendIDs(userID), time.Now()).
		Order("created_at DESC").
		Find(&stories)

	storyGroups := buildStoryGroups(stories)

	user.IsAdmin = isPlatformAdmin(userID)

	return c.JSON(InitResponse{
		User:         user,
		Chats:        chats,
		Settings:     settings,
		SmartFolders: smartFolders,
		Stories:      storyGroups,
		CsrfToken:    middleware.GenerateCSRFToken(userID),
	})
}

// buildStoryGroups groups raw stories by author, ordered by story count.
func buildStoryGroups(stories []models.Story) []StoryGroupJSON {
	storyMap := make(map[string]*StoryGroupJSON)
	for _, s := range stories {
		group, exists := storyMap[s.UserID]
		if !exists {
			group = &StoryGroupJSON{
				UserID:      s.UserID,
				DisplayName: s.User.DisplayName,
				Avatar:      s.User.Avatar,
				IsOnline:    s.User.IsOnline,
				Stories:     []StoryJSON{},
			}
			storyMap[s.UserID] = group
		}
		group.Stories = append(group.Stories, StoryJSON{
			ID:        s.ID,
			Type:      s.Type,
			MediaURL:  s.MediaURL,
			Content:   s.Content,
			BgColor:   s.BgColor,
			CreatedAt: s.CreatedAt.Format(time.RFC3339),
			ExpiresAt: s.ExpiresAt.Format(time.RFC3339),
		})
	}

	storyGroups := make([]StoryGroupJSON, 0, len(storyMap))
	for _, g := range storyMap {
		storyGroups = append(storyGroups, *g)
	}
	sort.Slice(storyGroups, func(i, j int) bool {
		return len(storyGroups[i].Stories) > len(storyGroups[j].Stories)
	})
	return storyGroups
}
