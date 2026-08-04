package ws

import (
	"log"
	"sync"

	"github.com/gofiber/websocket/v2"
)

type Client struct {
	Conn   *websocket.Conn
	UserID string
	Send   chan []byte
}

// HubMetrics tracks connection statistics
type HubMetrics struct {
	TotalConnections   int64
	CurrentConnections int
	TotalMessages      int64
	mu                 sync.RWMutex
}

type Hub struct {
	mu          sync.RWMutex
	clients     map[string]map[*Client]bool
	chatMembers map[string]map[string]bool // chatID -> set of userIDs
	register    chan *Client
	unregister  chan *Client
	stop        chan struct{}
	stopOnce    sync.Once
	Metrics     *HubMetrics
}

var HubInstance *Hub

func NewHub() *Hub {
	return &Hub{
		clients:     make(map[string]map[*Client]bool),
		chatMembers: make(map[string]map[string]bool),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		stop:        make(chan struct{}),
		Metrics:     &HubMetrics{},
	}
}

func (h *Hub) Run() {
	for {
		select {
		case <-h.stop:
			return
		case client := <-h.register:
			h.mu.Lock()
			if h.clients[client.UserID] == nil {
				h.clients[client.UserID] = make(map[*Client]bool)
			}
			h.clients[client.UserID][client] = true
			connCount := h.getUserCountLocked(client.UserID)
			h.Metrics.mu.Lock()
			h.Metrics.TotalConnections++
			h.Metrics.CurrentConnections = h.totalConnectionsLocked()
			h.Metrics.mu.Unlock()
			h.mu.Unlock()
			log.Printf("WS: user %s connected (%d connections)", client.UserID, connCount)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.clients[client.UserID]; ok {
				if _, ok := clients[client]; ok {
					delete(clients, client)
					close(client.Send)
					if len(clients) == 0 {
						delete(h.clients, client.UserID)
						// Remove user from all chat memberships
						for chatID, members := range h.chatMembers {
							delete(members, client.UserID)
							if len(members) == 0 {
								delete(h.chatMembers, chatID)
							}
						}
					}
				}
			}
			h.Metrics.mu.Lock()
			h.Metrics.CurrentConnections = h.totalConnectionsLocked()
			h.Metrics.mu.Unlock()
			h.mu.Unlock()
		}
	}
}

// Stop signals the hub goroutine to exit. Safe to call multiple times.
func (h *Hub) Stop() {
	h.stopOnce.Do(func() {
		close(h.stop)
	})
}

func (h *Hub) RegisterClient(client *Client) {
	select {
	case h.register <- client:
	case <-h.stop:
	}
}

func (h *Hub) UnregisterClient(client *Client) {
	select {
	case h.unregister <- client:
	case <-h.stop:
	}
}

func (h *Hub) SendToUser(userID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if clients, ok := h.clients[userID]; ok {
		for client := range clients {
			select {
			case client.Send <- data:
				h.Metrics.mu.Lock()
				h.Metrics.TotalMessages++
				h.Metrics.mu.Unlock()
			default:
			}
		}
	}
}

func (h *Hub) SendToChat(chatID string, data []byte, excludeUserID string) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	members, ok := h.chatMembers[chatID]
	if !ok {
		return
	}

	for userID := range members {
		if userID == excludeUserID {
			continue
		}
		if clients, ok := h.clients[userID]; ok {
			for client := range clients {
				select {
				case client.Send <- data:
					h.Metrics.mu.Lock()
					h.Metrics.TotalMessages++
					h.Metrics.mu.Unlock()
				default:
				}
			}
		}
	}
}

func (h *Hub) JoinChat(chatID, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.chatMembers[chatID] == nil {
		h.chatMembers[chatID] = make(map[string]bool)
	}
	h.chatMembers[chatID][userID] = true
}

func (h *Hub) LeaveChat(chatID, userID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	members, ok := h.chatMembers[chatID]
	if !ok {
		return
	}
	delete(members, userID)
	if len(members) == 0 {
		delete(h.chatMembers, chatID)
	}
}

func (h *Hub) IsOnline(userID string) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	clients, ok := h.clients[userID]
	return ok && len(clients) > 0
}

// getUserCountLocked returns the number of connections for a user.
// Caller must hold h.mu.
func (h *Hub) getUserCountLocked(userID string) int {
	if clients, ok := h.clients[userID]; ok {
		return len(clients)
	}
	return 0
}

// SendToClient sends data to a single specific client (for RPC responses).
// The lock is held while sending so unregister cannot close the channel
// concurrently (avoids a "send on closed channel" panic).
func (h *Hub) SendToClient(client *Client, data []byte) {
	if client == nil {
		return
	}
	h.mu.RLock()
	defer h.mu.RUnlock()
	if clients, ok := h.clients[client.UserID]; ok {
		if _, exists := clients[client]; exists {
			select {
			case client.Send <- data:
			default:
			}
		}
	}
}

// GetUserClient returns any active client connection for the given user, or nil.
func (h *Hub) GetUserClient(userID string) *Client {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if clients, ok := h.clients[userID]; ok {
		for client := range clients {
			return client
		}
	}
	return nil
}

// totalConnectionsLocked returns total client connections across all users.
// Caller must hold h.mu.
func (h *Hub) totalConnectionsLocked() int {
	count := 0
	for _, clients := range h.clients {
		count += len(clients)
	}
	return count
}
