package db

import (
	"database/sql"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"

	sqlite "github.com/Tryanks/gorm-sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"nexo/models"
	"nexo/logging"
)

// InitLocal initializes a local SQLite database
func InitLocal(dsn string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dsn), &gorm.Config{
		Logger:                                   logger.Default.LogMode(logger.Warn),
		DisableForeignKeyConstraintWhenMigrating: true,
		SkipDefaultTransaction:                   true,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to local database: %w", err)
	}

	sqlDB, err := DB.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}
	
	// Optimize SQLite for local use
	sqlDB.SetMaxOpenConns(4)
	sqlDB.SetMaxIdleConns(2)
	sqlDB.SetConnMaxLifetime(10 * time.Minute)

	// Enable WAL mode for better concurrent performance
	_, err = sqlDB.Exec("PRAGMA journal_mode=WAL")
	if err != nil {
		logging.Log.Warn("Could not set WAL mode", "err", err)
	}

	// Performance: NORMAL sync is faster and safe enough for most use cases
	_, err = sqlDB.Exec("PRAGMA synchronous=NORMAL")
	if err != nil {
		logging.Log.Warn("Could not set synchronous=NORMAL", "err", err)
	}

	// Busy timeout: wait up to 10s before returning "database is locked"
	_, err = sqlDB.Exec("PRAGMA busy_timeout=10000")
	if err != nil {
		logging.Log.Warn("Could not set busy_timeout", "err", err)
	}

	// Enable foreign keys
	_, err = sqlDB.Exec("PRAGMA foreign_keys=ON")
	if err != nil {
		logging.Log.Warn("Could not enable foreign keys", "err", err)
	}

	// Performance: Increase cache size to 128MB
	_, err = sqlDB.Exec("PRAGMA cache_size=-131072")
	if err != nil {
		logging.Log.Warn("Could not set cache_size", "err", err)
	}

	// Performance: Memory-mapped I/O for faster reads (512MB)
	_, err = sqlDB.Exec("PRAGMA mmap_size=536870912")
	if err != nil {
		logging.Log.Warn("Could not set mmap_size", "err", err)
	}

	// Performance: Optimize page size
	_, err = sqlDB.Exec("PRAGMA page_size=4096")
	if err != nil {
		logging.Log.Warn("Could not set page_size", "err", err)
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
		&models.StoryKeyWrap{},
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
		&models.BotUpdate{},
		&models.BotMessageSeq{},
		&models.BotChatState{},
		&models.InlineQueryResult{},
		&models.UsernameAlias{},
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
		// Incognito Chats
		&models.IncognitoChat{},
		&models.IncognitoMember{},
		// Gamification
		&models.UserXP{},
		&models.Achievement{},
		&models.UserAchievement{},
		&models.XPLog{},
		// E2E Encryption
		&models.E2EKeyBundle{},
		&models.E2ESession{},
		&models.E2EGroupKey{},
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
		// Scheduled Messages
		&models.ScheduledMessage{},
		// Dead Man's Switch
		&models.DeadManSwitch{},
		&models.DeadManSwitchRecipient{},
		// Cloud Files
		&models.CloudFile{},
		// Vault Files
		&models.VaultFile{},
		// AI Browse Tasks
		&models.AIBrowseTask{},
		// Moderation Actions
		&models.ModerationAction{},
		// Whiteboards
		&models.Whiteboard{},
		&models.WhiteboardEdit{},
		// Chat Themes
		&models.ChatTheme{},
		// Calendar
		&models.CalendarEvent{},
		&models.CalendarEventInvite{},
		// Kanban
		&models.KanbanBoard{},
		&models.KanbanColumn{},
		&models.KanbanTask{},
		// Message Bookmarks & Templates
		&models.MessageBookmark{},
		&models.MessageTemplate{},
		// Moderation Config
		&models.ModerationConfig{},
		// Photo Albums
		&models.PhotoAlbum{},
		&models.PhotoAlbumItem{},
		// Privacy Audit
		&models.PrivacyAudit{},
		// Screen Recordings
		&models.ScreenRecording{},
		// Smart Reminders
		&models.SmartReminder{},
		// Translation Log
		&models.TranslationLog{},
		// Voice Commands & Room Activity
		&models.VoiceCommand{},
		&models.VoiceRoomActivity{},
		// Auto-Reply Config
		&models.AutoReplyConfig{},
		// User Sessions
		&models.UserSession{},
		// Contact Tags
		&models.ContactTag{},
		// Public Rooms
		&models.PublicRoom{},
		// Screenshot Detection
		&models.ScreenshotLog{},
		// Refresh Token Blacklist
		&models.RefreshTokenBlacklist{},
		// Web Push subscriptions
		&models.PushSubscription{},
		// CSRF Tokens (persistent)
		&models.CSRFToken{},
		// Security Audit Log (persistent)
		&models.AuditLogEntry{},
		// AI chat history
		&models.AIMessage{},
		// Promo codes
		&models.PromoCode{},
		// Invite links
		&models.InviteLink{},
	)
	if err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	// Add performance indexes
	addIndexes(DB)

	// Full-text search over messages
	InitFTS5(DB)

	logging.Log.Info("Local SQLite database", "dsn", dsn)
	return nil
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
		"CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_histories(user_id)",

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

		// Users - commonly filtered columns
		"CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
		"CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at)",
		"CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)",
		"CREATE INDEX IF NOT EXISTS idx_users_username_email ON users(username, email)",

		// Blocked users
		"CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker ON blocked_users(blocker_id)",
		"CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked ON blocked_users(blocked_id)",

		// Story views & reactions
		"CREATE INDEX IF NOT EXISTS idx_story_views_story_user ON story_views(story_id, user_id)",
		"CREATE INDEX IF NOT EXISTS idx_story_reactions_story_user ON story_reactions(story_id, user_id)",

		// Moderation logs
		"CREATE INDEX IF NOT EXISTS idx_moderation_logs_chat ON moderation_logs(chat_id)",
		"CREATE INDEX IF NOT EXISTS idx_moderation_logs_target ON moderation_logs(target_id)",
		"CREATE INDEX IF NOT EXISTS idx_moderation_logs_created_at ON moderation_logs(created_at)",

		// Payments
		"CREATE INDEX IF NOT EXISTS idx_payments_user_status ON payments(user_id, status)",

		// Call logs
		"CREATE INDEX IF NOT EXISTS idx_call_logs_room ON call_logs(room_id)",

		// Webhook deliveries
		"CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_config ON webhook_deliveries(webhook_config_id)",

		// CSRF tokens
		"CREATE INDEX IF NOT EXISTS idx_csrf_tokens_expires ON csrf_tokens(expires_at)",
		"CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(token)",

		// Audit log
		"CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log_entries(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log_entries(timestamp)",
		"CREATE INDEX IF NOT EXISTS idx_audit_log_success ON audit_log_entries(success)",

		// E2E sessions & key bundles
		"CREATE INDEX IF NOT EXISTS idx_e2e_sessions_chat_created ON e2_e_sessions(chat_id, created_at)",
		"CREATE INDEX IF NOT EXISTS idx_e2e_key_bundles_user_device ON e2_e_key_bundles(user_id, device_id)",

		// Voice room participants
		"CREATE INDEX IF NOT EXISTS idx_voice_room_participants_room_user ON voice_room_participants(room_id, user_id)",

		// Cloud storage
		"CREATE INDEX IF NOT EXISTS idx_cloud_files_user_created ON cloud_files(user_id, created_at)",

		// Vault files
		"CREATE INDEX IF NOT EXISTS idx_vault_files_user ON vault_files(user_id)",

		// AI browse tasks
		"CREATE INDEX IF NOT EXISTS idx_ai_browse_tasks_user_status ON ai_browse_tasks(user_id, status)",

		// Moderation actions
		"CREATE INDEX IF NOT EXISTS idx_moderation_actions_chat_created ON moderation_actions(chat_id, created_at)",

		// Whiteboard edits
		"CREATE INDEX IF NOT EXISTS idx_whiteboard_edits_wb_version ON whiteboard_edits(whiteboard_id, version)",

		// AI chat history
		"CREATE INDEX IF NOT EXISTS idx_ai_messages_user_id ON ai_messages(user_id)",
		"CREATE INDEX IF NOT EXISTS idx_ai_messages_user_created ON ai_messages(user_id, created_at)",
	}
	for _, idx := range indexes {
		db.Exec(idx)
	}
}

// periodicBackup forces a WAL checkpoint every 10 minutes (cheap, prevents
// data loss) and creates a full VACUUM INTO backup every BACKUP_INTERVAL_MINUTES
// (default 6 hours). A full backup every 10 minutes caused heavy disk I/O and
// lock contention on busy databases.
func periodicBackup(sqlDB *sql.DB, dsn string) {
	checkpointTicker := time.NewTicker(10 * time.Minute)
	defer checkpointTicker.Stop()

	backupInterval := 6 * time.Hour
	if env := os.Getenv("BACKUP_INTERVAL_MINUTES"); env != "" {
		if minutes, err := strconv.Atoi(env); err == nil && minutes >= 1 {
			backupInterval = time.Duration(minutes) * time.Minute
		}
	}
	backupTicker := time.NewTicker(backupInterval)
	defer backupTicker.Stop()

	for {
		select {
		case <-checkpointTicker.C:
			// Force WAL checkpoint — flushes WAL to main DB file
			if _, err := sqlDB.Exec("PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
				logging.Log.Error("[BACKUP] WAL checkpoint error", "err", err)
			}
		case <-backupTicker.C:
			// Create a safe backup copy
			backupPath := dsn + ".backup"
			if _, err := sqlDB.Exec(fmt.Sprintf("VACUUM INTO '%s'", backupPath)); err != nil {
				logging.Log.Error("[BACKUP] VACUUM INTO error", "err", err)
			} else {
				logging.Log.Info("[BACKUP] Database backed up", "path", backupPath)
			}
		}
	}
}

// LocalKV is a simple file-based key-value store
type LocalKV struct {
	dir string
}

var KVStore *LocalKV

// InitLocalKV initializes a local file-based KV store
func InitLocalKV() error {
	dir := "./data/kv"
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create KV directory: %w", err)
	}
	KVStore = &LocalKV{dir: dir}
	logging.Log.Info("Local KV store: initialized")
	return nil
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
		expiry, parseErr := time.Parse(time.RFC3339, strings.TrimSpace(string(meta)))
		if parseErr == nil && time.Now().After(expiry) {
			kv.Delete(key)
			return "", nil
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

