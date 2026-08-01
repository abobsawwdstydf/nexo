package handlers

import "nexo/models"

// sanitizeUser обнуляет личные поля пользователя перед выдачей другим
// пользователям: email, ключи E2E, настройки приватности/уведомлений.
// Собственный профиль (init, login) отдаётся целиком.
func sanitizeUser(u models.User) models.User {
	u.Email = ""
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

// sanitizeChatMembers обнуляет личные поля у всех участников чата.
func sanitizeChatMembers(members []models.ChatMember) {
	for i := range members {
		members[i].User = sanitizeUser(members[i].User)
	}
}

// sanitizeMessages обнуляет личные поля отправителей и авторов реакций.
func sanitizeMessages(messages []models.Message) {
	for i := range messages {
		messages[i].Sender = sanitizeUser(messages[i].Sender)
		for j := range messages[i].Reactions {
			messages[i].Reactions[j].User = sanitizeUser(messages[i].Reactions[j].User)
		}
	}
}
