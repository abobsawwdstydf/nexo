package db

import (
	"log"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"nexo/models"
)

var DB *gorm.DB

func Init(dsn string) {
	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
		SkipDefaultTransaction:                   true,
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxOpenConns(1) // SQLite не поддерживает конкурентные записи
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	// Включаем WAL mode для лучшей производительности
	DB.Exec("PRAGMA journal_mode=WAL")
	// Включаем foreign keys
	DB.Exec("PRAGMA foreign_keys=ON")
	// Устанавливаем busy timeout
	DB.Exec("PRAGMA busy_timeout=5000")

	err = DB.AutoMigrate(
		&models.User{},
		&models.Chat{},
		&models.ChatMember{},
		&models.Message{},
		&models.Media{},
		&models.Reaction{},
		&models.ReadReceipt{},
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
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	log.Println("Database connected successfully")
}

func GetDB() *gorm.DB {
	return DB
}
