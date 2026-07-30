package db

import (
	"fmt"
	"log"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"nexo/models"
)

var DB *gorm.DB

func Init(dsn string) error {
	var err error
	DB, err = gorm.Open(D1Open(), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
		SkipDefaultTransaction:                   true,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	err = DB.AutoMigrate(
		// Core
		&models.User{},
		&models.Chat{},
		&models.ChatMember{},
		&models.Message{},
		&models.Media{},
		&models.Reaction{},
		&models.ReadReceipt{},
		// Social
		&models.Story{},
		&models.StoryView{},
		&models.StoryReaction{},
		&models.Friendship{},
		&models.CallLog{},
		&models.TypingIndicator{},
		&models.StickerPack{},
		&models.Sticker{},
		&models.Bookmark{},
		&models.BlockedUser{},
		&models.UserDevice{},
		&models.VerificationRequest{},
		&models.Payment{},
		&models.BotHealthCheck{},
		&models.WallPost{},
		&models.WallPostMedia{},
		&models.WallPostReaction{},
		&models.WallPostComment{},
		&models.EmailVerification{},
		// Bot API
		&models.Bot{},
		&models.BotCommand{},
		&models.BotInstallation{},
		// Search
		&models.SearchHistory{},
		// Moderation
		&models.ModerationLog{},
		// Smart Folders
		&models.SmartFolder{},
		// Shared Notes
		&models.ChatNote{},
		// Link Collector
		&models.CollectedLink{},
		// Voice Rooms
		&models.VoiceRoom{},
		&models.VoiceRoomParticipant{},
		// Anonymous Chats
		&models.AnonymousChat{},
		// Gamification
		&models.UserXP{},
		&models.Achievement{},
		&models.UserAchievement{},
		&models.XPLog{},
		// E2E Encryption
		&models.E2EKeyBundle{},
		&models.E2ESession{},
		// AI Commands
		&models.AICommandLog{},
		// Webhooks
		&models.WebhookConfig{},
		&models.WebhookDelivery{},
		// Self-Destruct
		&models.SelfDestructRead{},
		// Chat Snooze
		&models.ChatSnooze{},
		// Chat Reminders
		&models.ChatReminder{},
		// Contact Tags
		&models.ContactTag{},
		// Public Rooms
		&models.PublicRoom{},
		// Screenshot Detection
		&models.ScreenshotLog{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	// Health check
	if pingErr := sqlDB.Ping(); pingErr != nil {
		log.Printf("WARNING: Database ping failed: %v", pingErr)
	}

	log.Println("Database connected successfully")
	return nil
}

func GetDB() *gorm.DB {
	return DB
}
