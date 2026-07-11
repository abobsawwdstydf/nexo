package handlers

import (
	"time"

	"github.com/gofiber/fiber/v2"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// Stories
func CreateStory(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		Type      string `json:"type"`
		MediaURL  string `json:"mediaUrl"`
		Content   string `json:"content"`
		BgColor   string `json:"bgColor"`
		ExpiresIn int    `json:"expiresIn"` // hours, default 24
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.Type == "" {
		req.Type = "text"
	}
	expiresIn := 24
	if req.ExpiresIn > 0 {
		expiresIn = req.ExpiresIn
	}

	story := models.Story{
		ID:        generateID(),
		UserID:    userID,
		Type:      req.Type,
		MediaURL:  req.MediaURL,
		Content:   req.Content,
		BgColor:   req.BgColor,
		ExpiresAt: time.Now().Add(time.Duration(expiresIn) * time.Hour),
	}

	if err := db.GetDB().Create(&story).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to create story"})
	}

	db.GetDB().Preload("User").First(&story, "id = ?", story.ID)

	return c.Status(201).JSON(story)
}

func GetStories(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var friendships []models.Friendship
	db.GetDB().
		Where("(user_id = ? OR friend_id = ?) AND status = 'accepted'", userID, userID).
		Find(&friendships)
	friendIDs := make([]string, 0)
	for _, f := range friendships {
		if f.UserID == userID {
			friendIDs = append(friendIDs, f.FriendID)
		} else {
			friendIDs = append(friendIDs, f.UserID)
		}
	}

	// Get active (non-expired) stories from friends
	var stories []models.Story
	db.GetDB().
		Preload("User").
		Preload("Views").
		Where("user_id IN ? AND expires_at > ?", friendIDs, time.Now()).
		Order("created_at DESC").
		Find(&stories)

	return c.JSON(stories)
}

func ViewStory(c *fiber.Ctx) error {
	storyID := c.Params("id")
	userID := c.Locals("userId").(string)

	var story models.Story
	if result := db.GetDB().First(&story, "id = ?", storyID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Story not found"})
	}

	var existing models.StoryView
	if result := db.GetDB().Where("story_id = ? AND user_id = ?", storyID, userID).First(&existing); result.Error == nil {
		return c.JSON(fiber.Map{"ok": true})
	}

	view := models.StoryView{
		ID:      generateID(),
		StoryID: storyID,
		UserID:  userID,
	}
	db.GetDB().Create(&view)

	ws.HubInstance.SendToUser(story.UserID, []byte(`{"type":"story:viewed","storyId":"`+storyID+`","viewerId":"`+userID+`"}`))

	return c.JSON(fiber.Map{"ok": true})
}

func AddStoryReaction(c *fiber.Ctx) error {
	storyID := c.Params("id")
	userID := c.Locals("userId").(string)

	var req struct {
		Emoji string `json:"emoji"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	var story models.Story
	if result := db.GetDB().First(&story, "id = ?", storyID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Story not found"})
	}

	reaction := models.StoryReaction{
		ID:      generateID(),
		StoryID: storyID,
		UserID:  userID,
		Emoji:   req.Emoji,
	}
	if err := db.GetDB().Create(&reaction).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to add reaction"})
	}

	ws.HubInstance.SendToUser(story.UserID, []byte(`{"type":"story:reaction","storyId":"`+storyID+`","userId":"`+userID+`","emoji":"`+req.Emoji+`"}`))

	return c.JSON(fiber.Map{"ok": true})
}

func DeleteStory(c *fiber.Ctx) error {
	storyID := c.Params("id")
	userID := c.Locals("userId").(string)

	var story models.Story
	if result := db.GetDB().First(&story, "id = ?", storyID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Story not found"})
	}

	if story.UserID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Can only delete your own stories"})
	}

	db.GetDB().Delete(&story)
	return c.JSON(fiber.Map{"ok": true})
}

// Friends
func SendFriendRequest(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		FriendID string `json:"friendId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	if req.FriendID == userID {
		return c.Status(400).JSON(fiber.Map{"error": "Cannot add yourself as friend"})
	}

	// Check blocked
	var blocked models.BlockedUser
	if result := db.GetDB().Where("(user_id = ? AND blocked_user_id = ?) OR (user_id = ? AND blocked_user_id = ?)",
		userID, req.FriendID, req.FriendID, userID).First(&blocked); result.Error == nil {
		return c.Status(403).JSON(fiber.Map{"error": "Cannot send friend request"})
	}

	// Check if already friends or pending
	var existing models.Friendship
	if result := db.GetDB().Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, req.FriendID, req.FriendID, userID).First(&existing); result.Error == nil {
		if existing.Status == "accepted" {
			return c.Status(409).JSON(fiber.Map{"error": "Already friends"})
		}
		if existing.Status == "pending" {
			return c.Status(409).JSON(fiber.Map{"error": "Friend request already pending"})
		}
	}

	friendship := models.Friendship{
		ID:       generateID(),
		UserID:   userID,
		FriendID: req.FriendID,
		Status:   "pending",
	}
	if err := db.GetDB().Create(&friendship).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to send friend request"})
	}

	ws.HubInstance.SendToUser(req.FriendID, []byte(`{"type":"friend:request","fromUserId":"`+userID+`","friendshipId":"`+friendship.ID+`"}`))

	return c.Status(201).JSON(friendship)
}

func AcceptFriendRequest(c *fiber.Ctx) error {
	friendshipID := c.Params("id")
	userID := c.Locals("userId").(string)

	var friendship models.Friendship
	if result := db.GetDB().First(&friendship, "id = ?", friendshipID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Friend request not found"})
	}

	if friendship.FriendID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your friend request"})
	}

	db.GetDB().Model(&friendship).Update("status", "accepted")

	ws.HubInstance.SendToUser(friendship.UserID, []byte(`{"type":"friend:accepted","byUserId":"`+userID+`","friendshipId":"`+friendshipID+`"}`))

	return c.JSON(fiber.Map{"ok": true})
}

func RejectFriendRequest(c *fiber.Ctx) error {
	friendshipID := c.Params("id")
	userID := c.Locals("userId").(string)

	var friendship models.Friendship
	if result := db.GetDB().First(&friendship, "id = ?", friendshipID); result.Error != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Friend request not found"})
	}

	if friendship.FriendID != userID {
		return c.Status(403).JSON(fiber.Map{"error": "Not your friend request"})
	}

	db.GetDB().Delete(&friendship)
	return c.JSON(fiber.Map{"ok": true})
}

func RemoveFriend(c *fiber.Ctx) error {
	friendID := c.Params("id")
	userID := c.Locals("userId").(string)

	db.GetDB().Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, friendID, friendID, userID).Delete(&models.Friendship{})

	return c.JSON(fiber.Map{"ok": true})
}

func GetFriends(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var friendships []models.Friendship
	db.GetDB().
		Preload("User").
		Preload("Friend").
		Where("(user_id = ? OR friend_id = ?) AND status = 'accepted'", userID, userID).
		Find(&friendships)

	friends := make([]models.User, 0)
	for _, f := range friendships {
		if f.UserID == userID {
			friends = append(friends, f.Friend)
		} else {
			friends = append(friends, f.User)
		}
	}

	return c.JSON(friends)
}

func GetFriendRequests(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var friendships []models.Friendship
	db.GetDB().
		Preload("User").
		Where("friend_id = ? AND status = 'pending'", userID).
		Order("created_at DESC").
		Find(&friendships)

	return c.JSON(friendships)
}

func BlockUser(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		BlockedUserID string `json:"blockedUserId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	blocked := models.BlockedUser{
		ID:            generateID(),
		UserID:        userID,
		BlockedUserID: req.BlockedUserID,
	}
	if err := db.GetDB().Create(&blocked).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Failed to block user"})
	}

	// Remove friendship
	db.GetDB().Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
		userID, req.BlockedUserID, req.BlockedUserID, userID).Delete(&models.Friendship{})

	return c.JSON(fiber.Map{"ok": true})
}

func UnblockUser(c *fiber.Ctx) error {
	userID := c.Locals("userId").(string)

	var req struct {
		BlockedUserID string `json:"blockedUserId"`
	}
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Invalid request body"})
	}

	db.GetDB().Where("user_id = ? AND blocked_user_id = ?", userID, req.BlockedUserID).Delete(&models.BlockedUser{})
	return c.JSON(fiber.Map{"ok": true})
}
