package handlers

import (
	"errors"
	"fmt"
	"testing"

	sqlite "github.com/Tryanks/gorm-sqlite"
	"gorm.io/gorm"

	"nexo/models"
)

func newReadReceiptTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:read-receipts-%s?mode=memory&cache=shared", t.Name())
	database, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open in-memory database: %v", err)
	}
	if err := database.AutoMigrate(&models.ChatMember{}, &models.Message{}, &models.ReadReceipt{}); err != nil {
		t.Fatalf("migrate in-memory database: %v", err)
	}
	return database
}

func seedReadReceiptTest(t *testing.T, database *gorm.DB) {
	t.Helper()
	if err := database.Create(&models.ChatMember{ID: "member-1", ChatID: "chat-1", UserID: "user-1"}).Error; err != nil {
		t.Fatalf("seed member: %v", err)
	}
	if err := database.Create(&models.Message{ID: "message-1", ChatID: "chat-1", SenderID: "user-2", Type: "text"}).Error; err != nil {
		t.Fatalf("seed message: %v", err)
	}
	if err := database.Create(&models.Message{ID: "message-2", ChatID: "chat-2", SenderID: "user-2", Type: "text"}).Error; err != nil {
		t.Fatalf("seed other message: %v", err)
	}
}

func TestRecordReadReceiptRequiresMembership(t *testing.T) {
	database := newReadReceiptTestDB(t)
	seedReadReceiptTest(t, database)

	err := recordReadReceipt(database, "chat-1", "message-1", "outsider")
	if !errors.Is(err, errReadReceiptNotMember) {
		t.Fatalf("got %v, want errReadReceiptNotMember", err)
	}
}

func TestRecordReadReceiptRequiresMessageInChat(t *testing.T) {
	database := newReadReceiptTestDB(t)
	seedReadReceiptTest(t, database)

	err := recordReadReceipt(database, "chat-1", "message-2", "user-1")
	if !errors.Is(err, errReadReceiptNotFound) {
		t.Fatalf("got %v, want errReadReceiptNotFound", err)
	}
}

func TestRecordReadReceiptIsIdempotent(t *testing.T) {
	database := newReadReceiptTestDB(t)
	seedReadReceiptTest(t, database)

	for i := 0; i < 2; i++ {
		if err := recordReadReceipt(database, "chat-1", "message-1", "user-1"); err != nil {
			t.Fatalf("record receipt attempt %d: %v", i+1, err)
		}
	}

	var count int64
	if err := database.Model(&models.ReadReceipt{}).Where("message_id = ? AND user_id = ?", "message-1", "user-1").Count(&count).Error; err != nil {
		t.Fatalf("count receipts: %v", err)
	}
	if count != 1 {
		t.Fatalf("got %d receipts, want 1", count)
	}
}
