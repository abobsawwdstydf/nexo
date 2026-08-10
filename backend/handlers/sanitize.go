package handlers

import (
	"nexo/db"
	"nexo/models"
)

// sanitizeUser обнуляет личные поля пользователя перед выдачей другим
// пользователям: ключи E2E, настройки приватности/уведомлений.
// Email показывается только если владелец разрешил (whoCanSeeProfile):
// everyone — всем, friends — только друзьям, nobody — никому,
// а также самому владельцу профиля.
func sanitizeUser(u models.User, viewerID string) models.User {
	showEmail := u.WhoCanSeeProfile == "everyone" || viewerID == u.ID ||
		(u.WhoCanSeeProfile == "friends" && viewerID != "" && areFriends(viewerID, u.ID))
	if !showEmail {
		u.Email = ""
	}
	u.EmailVerified = false
	u.IdentityKey = ""
	u.SignedPreKey = ""
	u.OneTimePreKeys = ""
	u.NotifyAll = false
	u.NotifyMessages = false
	u.NotifyCalls = false
	u.NotifyFriends = false
	u.TwoFactorEnabled = false
	u.DNDUntil = nil
	u.DNDMessage = ""
	u.WhoCanMessage = ""
	u.WhoCanCall = ""
	u.WhoCanSeeProfile = ""
	u.ShowLastSeen = false
	u.AllowGroupInvites = false
	u.BanReason = ""
	u.PremiumUntil = nil
	return u
}

// areFriends проверяет, что между двумя пользователями принятая дружба.
func areFriends(userID, otherID string) bool {
	var f models.Friendship
	result := db.GetDB().
		Where("(user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)",
			userID, otherID, otherID, userID).
		First(&f)
	return result.Error == nil && f.Status == "accepted"
}

// sanitizeChatMembers обнуляет личные поля у всех участников чата.
func sanitizeChatMembers(members []models.ChatMember) {
	for i := range members {
		members[i].User = sanitizeUser(members[i].User, "")
	}
}

// sanitizeMessages обнуляет личные поля отправителей и авторов реакций.
func sanitizeMessages(messages []models.Message) {
	for i := range messages {
		messages[i].Sender = sanitizeUser(messages[i].Sender, "")
		for j := range messages[i].Reactions {
			messages[i].Reactions[j].User = sanitizeUser(messages[i].Reactions[j].User, "")
		}
	}
}