package handlers

import (
	"time"

	"nexo/db"
	"nexo/models"
	"nexo/ws"
	"nexo/logging"
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
	logging.Log.Info("Self-destruct loop: started (5s tick)")
}

func expireDueMessages() {
	now := time.Now()

	var due []models.Message
	if err := db.GetDB().
		Where("self_destruct_timer > 0 AND self_destruct_at IS NOT NULL AND self_destruct_at <= ? AND is_deleted = false", now).
		Find(&due).Error; err != nil {
		logging.Log.Error("[self-destruct] query failed", "err", err)
		return
	}

	for _, m := range due {
		if err := db.GetDB().Model(&m).Updates(map[string]interface{}{
			"is_deleted":         true,
			"content":            "",
			"self_destruct_timer": 0,
			"self_destruct_at":   nil,
		}).Error; err != nil {
			logging.Log.Error("[self-destruct] delete failed", "message_id", m.ID, "err", err)
			continue
		}
		ws.HubInstance.SendToChat(m.ChatID, mustWSMsg("message:expired",
			"messageId", m.ID,
			"chatId", m.ChatID,
		), "")
		logging.Log.Info("[self-destruct] message expired", "message_id", m.ID, "chat_id", m.ChatID)
	}

	// Tidy: clear stale timer columns in batch (belt & braces for any rows
	// marked deleted out-of-band).
	db.GetDB().Model(&models.Message{}).
		Where("is_deleted = true AND self_destruct_timer > 0").
		Updates(map[string]interface{}{"self_destruct_timer": 0, "self_destruct_at": nil})
}
