package db

import (

	"gorm.io/gorm"
	"nexo/logging"
)

// InitFTS5 creates the full-text search virtual table for messages and keeps
// it in sync with the messages table via triggers.
//
// FTS5 (SQLite built-in, supported by modernc.org/sqlite) gives us indexed
// full-text search with unicode case folding and prefix queries, replacing the
// old linear LIKE scan used by SearchMessages.
func InitFTS5(gormDB *gorm.DB) {
	raw := gormDB.Exec(`CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
		content,
		chat_id UNINDEXED,
		sender_id UNINDEXED,
		content='messages',
		content_rowid='rowid',
		tokenize='unicode61 remove_diacritics 2'
	)`)
	if raw.Error != nil {
		logging.Log.Error("[FTS5] failed to create messages_fts", "err", raw.Error)
		return
	}

	triggers := []string{
		`CREATE TRIGGER IF NOT EXISTS messages_fts_ai AFTER INSERT ON messages BEGIN
			INSERT INTO messages_fts(rowid, content, chat_id, sender_id)
			VALUES (new.rowid, new.content, new.chat_id, new.sender_id);
		END;`,
		`CREATE TRIGGER IF NOT EXISTS messages_fts_ad AFTER DELETE ON messages BEGIN
			INSERT INTO messages_fts(messages_fts, rowid, content, chat_id, sender_id)
			VALUES ('delete', old.rowid, old.content, old.chat_id, old.sender_id);
		END;`,
		`CREATE TRIGGER IF NOT EXISTS messages_fts_au AFTER UPDATE OF content, is_deleted ON messages BEGIN
			INSERT INTO messages_fts(messages_fts, rowid, content, chat_id, sender_id)
			VALUES ('delete', old.rowid, old.content, old.chat_id, old.sender_id);
			INSERT INTO messages_fts(rowid, content, chat_id, sender_id)
			VALUES (new.rowid, new.content, new.chat_id, new.sender_id);
		END;`,
	}
	for _, t := range triggers {
		if err := gormDB.Exec(t).Error; err != nil {
			logging.Log.Error("[FTS5] failed to create trigger", "err", err)
		}
	}

	// One-time backfill: if the FTS table is empty but messages exist (e.g.
	// database created before this feature), rebuild from the source table.
	var ftsCount, msgCount int64
	if err := gormDB.Raw("SELECT COUNT(*) FROM messages_fts").Scan(&ftsCount).Error; err == nil && ftsCount == 0 {
		if err := gormDB.Raw("SELECT COUNT(*) FROM messages").Scan(&msgCount).Error; err == nil && msgCount > 0 {
			if err := gormDB.Exec("INSERT INTO messages_fts(messages_fts) VALUES('rebuild')").Error; err != nil {
				logging.Log.Error("[FTS5] rebuild failed", "err", err)
			} else {
				logging.Log.Info("[FTS5] backfilled messages", "count", msgCount)
			}
		}
	}
}
