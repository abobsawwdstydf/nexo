import type { User, Chat, SmartFolder, Message } from '../types';
import { ApiClient } from './core';
import { wsRequest, getSocket } from '../socket';

declare module './core' {
  interface ApiClient {
    sendTyping(chatId: string): Promise<void>;
    sendReadReceipt(chatId: string, messageId: string): Promise<void>;
    toggleReactionWS(chatId: string, messageId: string, emoji: string): Promise<{ action: 'added' | 'removed' }>;
    getOnlineStatuses(userIds: string[]): Promise<Record<string, boolean>>;
    setUserStatusWS(text: string, emoji?: string, duration?: number): Promise<void>;
    getChatMembersWS(chatId: string): Promise<Array<{ userId: string; username: string; displayName: string; avatar: string; role: string }>>;
    sendMessageWS(chatId: string, content: string, options?: { type?: string; replyToId?: string; media?: any[] }): Promise<{ messageId: string; createdAt: string }>;
    // WS RPC data fetchers
    fetchMessagesWS(chatId: string, cursor?: string, limit?: number): Promise<{ messages: any[]; hasMore: boolean }>;
    fetchFriendsWS(): Promise<any[]>;
    fetchFriendRequestsWS(): Promise<any[]>;
    fetchNotificationsWS(): Promise<{ notifyAll: boolean; notifyMessages: boolean; notifyCalls: boolean; notifyFriends: boolean }>;
    fetchInitWS(): Promise<{
      user: User;
      chats: Chat[];
      settings: {
        notifyAll: boolean;
        notifyMessages: boolean;
        notifyCalls: boolean;
        notifyFriends: boolean;
        twoFactorEnabled: boolean;
      };
      smartFolders: SmartFolder[];
      stories: any[];
    }>;
    pushSubscribeWS(subscription: any): Promise<void>;
  }
}

export function installRealtime(api: ApiClient): void {
  // ─── WebSocket RPC Methods (real-time, low-latency) ───────────────

  /**
   * Send typing indicator via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.sendTyping = async (chatId: string): Promise<void> => {
    const socket = getSocket();
    if (socket?.connected) {
      await wsRequest('typing', { chatId });
      return;
    }
    await api.request(`/chats/${chatId}/typing`, { method: 'POST' });
  };

  /**
   * Send read receipt via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.sendReadReceipt = async (chatId: string, messageId: string): Promise<void> => {
    const socket = getSocket();
    if (socket?.connected) {
      await wsRequest('read_receipt', { chatId, messageId });
      return;
    }
    await api.request(`/chats/${chatId}/read`, {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    });
  };

  /**
   * Toggle reaction via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.toggleReactionWS = async (chatId: string, messageId: string, emoji: string): Promise<{ action: 'added' | 'removed' }> => {
    const socket = getSocket();
    if (socket?.connected) {
      const resp = await wsRequest<{ action?: string }>('reaction', { chatId, messageId, emoji });
      return { action: (resp.action as 'added' | 'removed') || 'added' };
    }
    return api.request(`/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  };

  /**
   * Get online status for multiple users via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.getOnlineStatuses = async (userIds: string[]): Promise<Record<string, boolean>> => {
    const socket = getSocket();
    if (socket?.connected) {
      const resp = await wsRequest<{ statuses: Record<string, boolean> }>('online_status', { userIds });
      return resp.statuses;
    }
    const statuses: Record<string, boolean> = {};
    for (const uid of userIds) {
      try {
        const user = await api.request<User>(`/users/${uid}`);
        statuses[uid] = user.isOnline ?? false;
      } catch {
        statuses[uid] = false;
      }
    }
    return statuses;
  };

  /**
   * Set user status via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.setUserStatusWS = async (text: string, emoji?: string, duration?: number): Promise<void> => {
    const socket = getSocket();
    if (socket?.connected) {
      await wsRequest('user_status', { text, emoji, duration });
      return;
    }
    await api.request('/mood', {
      method: 'POST',
      body: JSON.stringify({ moodStatus: text }),
    });
  };

  /**
   * Get chat members via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.getChatMembersWS = async (chatId: string): Promise<Array<{ userId: string; username: string; displayName: string; avatar: string; role: string }>> => {
    const socket = getSocket();
    if (socket?.connected) {
      const resp = await wsRequest<{ members: Array<{ userId: string; username: string; displayName: string; avatar: string; role: string }> }>('chat_members', { chatId });
      return resp.members;
    }
    return [];
  };

  /**
   * Send message via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.sendMessageWS = async (chatId: string, content: string, options?: { type?: string; replyToId?: string; media?: any[] }): Promise<{ messageId: string; createdAt: string }> => {
    const socket = getSocket();
    if (socket?.connected) {
      return wsRequest('send_message', { chatId, content, type: options?.type, replyToId: options?.replyToId, media: options?.media });
    }
    const result = await api.request<Message>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type: options?.type, replyToId: options?.replyToId, media: options?.media }),
    });
    return { messageId: result.id, createdAt: result.createdAt };
  };

  // ─── WS RPC: fetch_messages ─────────────────────────────────────────────
  api.fetchMessagesWS = async (chatId: string, cursor?: string, limit?: number): Promise<{ messages: any[]; hasMore: boolean }> => {
    const params: Record<string, any> = { chatId };
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit;
    return wsRequest('fetch_messages', params);
  };

  // ─── WS RPC: fetch_friends ──────────────────────────────────────────────
  api.fetchFriendsWS = async (): Promise<any[]> => {
    const resp = await wsRequest<{ friends: any[] }>('fetch_friends', {});
    return resp.friends ?? [];
  };

  // ─── WS RPC: fetch_friend_requests ──────────────────────────────────────
  api.fetchFriendRequestsWS = async (): Promise<any[]> => {
    const resp = await wsRequest<{ requests: any[] }>('fetch_friend_requests', {});
    return resp.requests ?? [];
  };

  // ─── WS RPC: fetch_notifications ────────────────────────────────────────
  api.fetchNotificationsWS = async (): Promise<{ notifyAll: boolean; notifyMessages: boolean; notifyCalls: boolean; notifyFriends: boolean }> => {
    return wsRequest('fetch_notifications', {});
  };

  // ─── WS RPC: fetch_init ─────────────────────────────────────────────────
  api.fetchInitWS = async () => {
    return wsRequest('fetch_init', {});
  };

  // ─── WS RPC: push_subscribe ─────────────────────────────────────────────
  api.pushSubscribeWS = async (subscription: any): Promise<void> => {
    const socket = getSocket();
    if (socket?.connected) {
      await wsRequest('push_subscribe', { subscription });
      return;
    }
    await api.request('/users/push-subscription', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  };
}
