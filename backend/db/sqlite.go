package db

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	sqlite "github.com/Tryanks/gorm-sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"nexo/models"
)

// InitLocal initializes a local SQLite database
func InitLocal(dsn string) {
	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
		SkipDefaultTransaction:                   true,
	})
	if err != nil {
		log.Fatalf("Failed to connect to local database: %v", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Fatalf("Failed to get sql.DB: %v", err)
	}
	
	// Optimize SQLite for local use
	sqlDB.SetMaxOpenConns(1)
	sqlDB.SetMaxIdleConns(1)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	// Enable WAL mode for better concurrent performance
	_, err = sqlDB.Exec("PRAGMA journal_mode=WAL")
	if err != nil {
		log.Printf("Warning: Could not set WAL mode: %v", err)
	}

	// Crash safety: FULL sync ensures every write is flushed to disk before returning.
	// Slower, but data survives power loss. NORMAL loses ~500ms of writes on crash.
	_, err = sqlDB.Exec("PRAGMA synchronous=FULL")
	if err != nil {
		log.Printf("Warning: Could not set synchronous=FULL: %v", err)
	}

	// Busy timeout: wait up to 5s before returning "database is locked"
	_, err = sqlDB.Exec("PRAGMA busy_timeout=5000")
	if err != nil {
		log.Printf("Warning: Could not set busy_timeout: %v", err)
	}

	// Enable foreign keys
	_, err = sqlDB.Exec("PRAGMA foreign_keys=ON")
	if err != nil {
		log.Printf("Warning: Could not enable foreign keys: %v", err)
	}

	// Start periodic backup goroutine (WAL checkpoint + VACUUM backup every 5 min)
	go periodicBackup(sqlDB, dsn)

	// AutoMigrate all models
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
		log.Fatalf("Failed to migrate database: %v", err)
	}

	log.Printf("Local SQLite database: %s", dsn)
}

// periodicBackup creates a backup of the SQLite database every 5 minutes
// and forces a WAL checkpoint to minimize data loss on power failure.
func periodicBackup(sqlDB *sql.DB, dsn string) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		// Force WAL checkpoint — flushes WAL to main DB file
		if _, err := sqlDB.Exec("PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
			log.Printf("[BACKUP] WAL checkpoint error: %v", err)
		}

		// Create a safe backup copy
		backupPath := dsn + ".backup"
		if _, err := sqlDB.Exec(fmt.Sprintf("VACUUM INTO '%s'", backupPath)); err != nil {
			log.Printf("[BACKUP] VACUUM INTO error: %v", err)
		} else {
			log.Printf("[BACKUP] Database backed up to %s", backupPath)
		}
	}
}

// LocalKV is a simple file-based key-value store
type LocalKV struct {
	dir string
}

var KVStore *LocalKV

// InitLocalKV initializes a local file-based KV store
func InitLocalKV() {
	dir := "./data/kv"
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Fatalf("Failed to create KV directory: %v", err)
	}
	KVStore = &LocalKV{dir: dir}
	log.Println("Local KV store: initialized")
}

// KVGet retrieves a value from local KV store
func KVGet(key string) (string, error) {
	if KVStore == nil {
		return "", fmt.Errorf("kv not initialized")
	}
	return KVStore.Get(key)
}

// KVPut stores a value in local KV store
func KVPut(key string, value string, ttlSeconds int) error {
	if KVStore == nil {
		return fmt.Errorf("kv not initialized")
	}
	return KVStore.Put(key, value, ttlSeconds)
}

// KVDelete removes a key from local KV store
func KVDelete(key string) error {
	if KVStore == nil {
		return fmt.Errorf("kv not initialized")
	}
	return KVStore.Delete(key)
}

// Get retrieves a value from local KV store
func (kv *LocalKV) Get(key string) (string, error) {
	data, err := os.ReadFile(kv.filePath(key))
	if os.IsNotExist(err) {
		return "", nil // key not found
	}
	if err != nil {
		return "", fmt.Errorf("kv get failed: %w", err)
	}

	// Check expiration via metadata file
	meta, err := os.ReadFile(kv.filePath(key) + ".meta")
	if err == nil {
		var expiry time.Time
		if _, err := fmt.Sscanf(string(meta), "%s", &expiry); err == nil {
			if time.Now().After(expiry) {
				kv.Delete(key)
				return "", nil
			}
		}
	}

	return string(data), nil
}

// Put stores a value in local KV store
func (kv *LocalKV) Put(key string, value string, ttlSeconds int) error {
	if err := os.WriteFile(kv.filePath(key), []byte(value), 0644); err != nil {
		return fmt.Errorf("kv put failed: %w", err)
	}

	// Store expiration metadata
	if ttlSeconds > 0 {
		expiry := time.Now().Add(time.Duration(ttlSeconds) * time.Second)
		if err := os.WriteFile(kv.filePath(key)+".meta", []byte(expiry.Format(time.RFC3339)), 0644); err != nil {
			return fmt.Errorf("kv put meta failed: %w", err)
		}
	} else {
		// Remove meta file if no TTL
		os.Remove(kv.filePath(key) + ".meta")
	}

	return nil
}

// Delete removes a key from local KV store
func (kv *LocalKV) Delete(key string) error {
	os.Remove(kv.filePath(key))
	os.Remove(kv.filePath(key) + ".meta")
	return nil
}

func (kv *LocalKV) filePath(key string) string {
	// Sanitize key for filesystem — replace forbidden chars with underscore
	sanitized := strings.NewReplacer(
		"/", "_",
		"\\", "_",
		":", "_",
		"*", "_",
		"?", "_",
		"\"", "_",
		"<", "_",
		">", "_",
		"|", "_",
	).Replace(key)
	return kv.dir + "/" + sanitized
}
