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

type Hub struct {
	mu          sync.RWMutex
	clients     map[string]map[*Client]bool
	chatMembers map[string]map[string]bool // chatID -> set of userIDs
	broadcast   chan []byte
	register    chan *Client
	unregister  chan *Client
	stop        chan struct{}
}

var HubInstance *Hub

func NewHub() *Hub {
	return &Hub{
		clients:     make(map[string]map[*Client]bool),
		chatMembers: make(map[string]map[string]bool),
		broadcast:   make(chan []byte, 256),
		register:    make(chan *Client),
		unregister:  make(chan *Client),
		stop:        make(chan struct{}),
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
			h.mu.Unlock()
			log.Printf("WS: user %s connected (%d connections)", client.UserID, h.getUserCount(client.UserID))

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
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			for _, clients := range h.clients {
				for client := range clients {
					select {
					case client.Send <- message:
					default:
						close(client.Send)
						delete(clients, client)
					}
				}
			}
			h.mu.Unlock()
		}
	}
}

// Stop signals the hub goroutine to exit
func (h *Hub) Stop() {
	close(h.stop)
}

func (h *Hub) RegisterClient(client *Client) {
	h.register <- client
}

func (h *Hub) UnregisterClient(client *Client) {
	h.unregister <- client
}

func (h *Hub) SendToUser(userID string, data []byte) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if clients, ok := h.clients[userID]; ok {
		for client := range clients {
			select {
			case client.Send <- data:
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

func (h *Hub) GetOnlineUsers() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	users := make([]string, 0, len(h.clients))
	for userID := range h.clients {
		users = append(users, userID)
	}
	return users
}

func (h *Hub) getUserCount(userID string) int {
	if clients, ok := h.clients[userID]; ok {
		return len(clients)
	}
	return 0
}

func (h *Hub) Broadcast(data []byte) {
	h.broadcast <- data
}
