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

	// Performance: NORMAL sync is faster and safe enough for most use cases
	_, err = sqlDB.Exec("PRAGMA synchronous=NORMAL")
	if err != nil {
		log.Printf("Warning: Could not set synchronous=NORMAL: %v", err)
	}

	// Busy timeout: wait up to 3s before returning "database is locked"
	_, err = sqlDB.Exec("PRAGMA busy_timeout=3000")
	if err != nil {
		log.Printf("Warning: Could not set busy_timeout: %v", err)
	}

	// Enable foreign keys
	_, err = sqlDB.Exec("PRAGMA foreign_keys=ON")
	if err != nil {
		log.Printf("Warning: Could not enable foreign keys: %v", err)
	}

	// Performance: Increase cache size to 64MB
	_, err = sqlDB.Exec("PRAGMA cache_size=-65536")
	if err != nil {
		log.Printf("Warning: Could not set cache_size: %v", err)
	}

	// Performance: Memory-mapped I/O for faster reads
	_, err = sqlDB.Exec("PRAGMA mmap_size=268435456")
	if err != nil {
		log.Printf("Warning: Could not set mmap_size: %v", err)
	}

	// Performance: Optimize page size
	_, err = sqlDB.Exec("PRAGMA page_size=4096")
	if err != nil {
		log.Printf("Warning: Could not set page_size: %v", err)
	}

	// Start periodic backup goroutine (WAL checkpoint + VACUUM backup every 10 min)
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

	// Add performance indexes
	addIndexes(DB)

	log.Printf("Local SQLite database: %s", dsn)
}

// addIndexes creates indexes for frequently queried columns
func addIndexes(db *gorm.DB) {
	indexes := []string{
		// Messages - most queried table
		"CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)",
		"CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id)",
		"CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)",
		"CREATE INDEX IF NOT EXISTS idx_messages_chat_created ON messages(chat_id, created_at)",
		"CREATE INDEX IF NOT EXISTS idx_messages_sender_created ON messages(sender_id, created_at)",

		// Chat members
		"CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id)",
		"CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_chat_members_chat_user ON chat_members(chat_id, user_id)",
		"CREATE INDEX IF NOT EXISTS idx_chat_members_chat_user_role ON chat_members(chat_id, user_id, role)",

		// Read receipts
		"CREATE INDEX IF NOT EXISTS idx_read_receipts_message_id ON read_receipts(message_id)",
		"CREATE INDEX IF NOT EXISTS idx_read_receipts_user_id ON read_receipts(user_id)",

		// Reactions
		"CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id)",
		"CREATE INDEX IF NOT EXISTS idx_reactions_msg_user_emoji ON reactions(message_id, user_id, emoji)",

		// Stories
		"CREATE INDEX IF NOT EXISTS idx_stories_user_id ON stories(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_stories_created_at ON stories(created_at)",
		"CREATE INDEX IF NOT EXISTS idx_stories_expires_created ON stories(expires_at, created_at)",

		// Friendships
		"CREATE INDEX IF NOT EXISTS idx_friendships_user_id ON friendships(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_friendships_friend_id ON friendships(friend_id)",

		// Bots
		"CREATE INDEX IF NOT EXISTS idx_bots_owner_id ON bots(owner_id)",
		"CREATE INDEX IF NOT EXISTS idx_bot_installations_chat_id ON bot_installations(chat_id)",

		// Search history
		"CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id)",

		// Webhooks
		"CREATE INDEX IF NOT EXISTS idx_webhook_configs_user_id ON webhook_configs(user_id)",

		// Smart folders
		"CREATE INDEX IF NOT EXISTS idx_smart_folders_user_id ON smart_folders(user_id)",

		// Chat notes
		"CREATE INDEX IF NOT EXISTS idx_chat_notes_chat_id ON chat_notes(chat_id)",

		// Collected links
		"CREATE INDEX IF NOT EXISTS idx_collected_links_user_id ON collected_links(user_id)",

		// Voice rooms
		"CREATE INDEX IF NOT EXISTS idx_voice_room_participants_room_id ON voice_room_participants(room_id)",

		// User devices
		"CREATE INDEX IF NOT EXISTS idx_user_devices_user_id ON user_devices(user_id)",

		// Bookmarks
		"CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_bookmarks_user_created ON bookmarks(user_id, created_at)",

		// Scheduled messages
		"CREATE INDEX IF NOT EXISTS idx_scheduled_messages_user_id ON scheduled_messages(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_scheduled_messages_send_at ON scheduled_messages(send_at)",

		// Email verifications
		"CREATE INDEX IF NOT EXISTS idx_email_verifications_email_status_created ON email_verifications(email, status, created_at)",

		// Typing indicators
		"CREATE INDEX IF NOT EXISTS idx_typing_indicators_chat_user ON typing_indicators(chat_id, user_id)",

		// Chat snoozes
		"CREATE INDEX IF NOT EXISTS idx_chat_snoozes_user_chat ON chat_snoozes(user_id, chat_id)",

		// Chat reminders
		"CREATE INDEX IF NOT EXISTS idx_chat_reminders_sent_remind ON chat_reminders(is_sent, remind_at)",
		"CREATE INDEX IF NOT EXISTS idx_chat_reminders_user_sent_remind ON chat_reminders(user_id, is_sent, remind_at)",

		// Self-destruct reads
		"CREATE INDEX IF NOT EXISTS idx_self_destruct_reads_msg_user ON self_destruct_reads(message_id, user_id)",

		// Incognito members
		"CREATE INDEX IF NOT EXISTS idx_incognito_members_chat_user ON incognito_members(chat_id, user_id)",
	}
	for _, idx := range indexes {
		db.Exec(idx)
	}
}

// periodicBackup creates a backup of the SQLite database every 10 minutes
// and forces a WAL checkpoint to minimize data loss on power failure.
func periodicBackup(sqlDB *sql.DB, dsn string) {
	ticker := time.NewTicker(10 * time.Minute)
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
