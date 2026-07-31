package handlers

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"

	"nexo/models"
)

var (
	errReadReceiptNotMember = errors.New("not a member of this chat")
	errReadReceiptNotFound  = errors.New("message not found in chat")
)

// recordReadReceipt validates chat membership and message ownership before
// atomically inserting at most one receipt for a message/user pair.
func recordReadReceipt(database *gorm.DB, chatID, messageID, userID string) error {
	var member models.ChatMember
	if err := database.Where("chat_id = ? AND user_id = ?", chatID, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errReadReceiptNotMember
		}
		return err
	}

	var message models.Message
	if err := database.Select("id").Where("id = ? AND chat_id = ?", messageID, chatID).First(&message).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errReadReceiptNotFound
		}
		return err
	}

	receipt := models.ReadReceipt{
		ID:        generateID(),
		MessageID: messageID,
		UserID:    userID,
	}
	return database.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "message_id"}, {Name: "user_id"}},
		DoNothing: true,
	}).Create(&receipt).Error
}
