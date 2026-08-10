package handlers

import (
	"log"
	"time"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
)

// StartSelfDestructLoop periodically expires messages that carry a
// self-destruct timer (self_destruct_at). Unlike the per-read timers
// (MarkMessageRead), this covers send-time timers, survives restarts and
// notifies chat members over WebSocket.
func StartSelfDestructLoop() {
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-ticker.C:
				expireDueMessages()
			case <-StopCh:
				return
			}
		}
	}()
	log.Println("Self-destruct loop: started (5s tick)")
}

func expireDueMessages() {
	now := time.Now()

	var due []models.Message
	if err := db.GetDB().
		Where("self_destruct_timer > 0 AND self_destruct_at IS NOT NULL AND self_destruct_at <= ? AND is_deleted = false", now).
		Find(&due).Error; err != nil {
		log.Printf("[self-destruct] query failed: %v", err)
		return
	}

	for _, m := range due {
		if err := db.GetDB().Model(&m).Updates(map[string]interface{}{
			"is_deleted":         true,
			"content":            "",
			"self_destruct_timer": 0,
			"self_destruct_at":   nil,
		}).Error; err != nil {
			log.Printf("[self-destruct] delete failed for message %s: %v", m.ID, err)
			continue
		}
		ws.HubInstance.SendToChat(m.ChatID, mustWSMsg("message:expired",
			"messageId", m.ID,
			"chatId", m.ChatID,
		), "")
		log.Printf("[self-destruct] message %s expired in chat %s", m.ID, m.ChatID)
	}

	// Tidy: clear stale timer columns in batch (belt & braces for any rows
	// marked deleted out-of-band).
	db.GetDB().Model(&models.Message{}).
		Where("is_deleted = true AND self_destruct_timer > 0").
		Updates(map[string]interface{}{"self_destruct_timer": 0, "self_destruct_at": nil})
}