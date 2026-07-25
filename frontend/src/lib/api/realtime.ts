import type { User, Message } from '../types';
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
    sendMessageWS(chatId: string, content: string, options?: { type?: string; replyToId?: string }): Promise<{ messageId: string; createdAt: string }>;
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
  api.sendMessageWS = async (chatId: string, content: string, options?: { type?: string; replyToId?: string }): Promise<{ messageId: string; createdAt: string }> => {
    const socket = getSocket();
    if (socket?.connected) {
      return wsRequest('send_message', { chatId, content, type: options?.type, replyToId: options?.replyToId });
    }
    const result = await api.request<Message>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type: options?.type, replyToId: options?.replyToId }),
    });
    return { messageId: result.id, createdAt: result.createdAt };
  };
}
