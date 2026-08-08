import type { Message, FriendWithId, FriendRequest, MediaItem } from '../types';
import { ApiClient } from './core';
import { wsRequest, getSocket } from '../socket';

export interface PushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

declare module './core' {
  interface ApiClient {
    sendMessageWS(chatId: string, content: string, options?: { type?: string; replyToId?: string; media?: MediaItem[]; gifUrl?: string; isEncrypted?: boolean; encryptedContent?: string; encryptedIv?: string }): Promise<{ messageId: string; createdAt: string }>;
    // WS RPC data fetchers
    fetchMessagesWS(chatId: string, cursor?: string, limit?: number): Promise<{ messages: Message[]; hasMore: boolean }>;
    fetchFriendsWS(): Promise<FriendWithId[]>;
    fetchFriendRequestsWS(): Promise<FriendRequest[]>;
    pushSubscribeWS(subscription: PushSubscriptionJSON): Promise<void>;
    pushUnsubscribeWS(endpoint: string): Promise<void>;
  }
}

export function installRealtime(api: ApiClient): void {
  // ─── WebSocket RPC Methods (real-time, low-latency) ───────────────

  /**
   * Send message via WebSocket.
   * Falls back to HTTP if WS is not connected.
   */
  api.sendMessageWS = async (chatId: string, content: string, options?: { type?: string; replyToId?: string; media?: MediaItem[]; gifUrl?: string; isEncrypted?: boolean; encryptedContent?: string; encryptedIv?: string }): Promise<{ messageId: string; createdAt: string }> => {
    const socket = getSocket();
    if (socket?.connected) {
      return wsRequest('send_message', {
        chatId,
        content,
        type: options?.type,
        replyToId: options?.replyToId,
        media: options?.media,
        gifUrl: options?.gifUrl,
        isEncrypted: options?.isEncrypted,
        encryptedContent: options?.encryptedContent,
        encryptedIv: options?.encryptedIv,
      });
    }
    const result = await api.request<Message>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        content,
        type: options?.type,
        replyToId: options?.replyToId,
        media: options?.media,
        isEncrypted: options?.isEncrypted,
        encryptedContent: options?.encryptedContent,
        encryptedIv: options?.encryptedIv,
      }),
    });
    return { messageId: result.id, createdAt: result.createdAt };
  };

  // ─── WS RPC: fetch_messages ─────────────────────────────────────────────
  api.fetchMessagesWS = async (chatId: string, cursor?: string, limit?: number): Promise<{ messages: Message[]; hasMore: boolean }> => {
    const params: Record<string, unknown> = { chatId };
    if (cursor) params.cursor = cursor;
    if (limit) params.limit = limit;
    return wsRequest('fetch_messages', params);
  };

  // ─── WS RPC: fetch_friends ──────────────────────────────────────────────
  api.fetchFriendsWS = async (): Promise<FriendWithId[]> => {
    const resp = await wsRequest<{ friends: FriendWithId[] }>('fetch_friends', {});
    return resp.friends ?? [];
  };

  // ─── WS RPC: fetch_friend_requests ──────────────────────────────────────
  api.fetchFriendRequestsWS = async (): Promise<FriendRequest[]> => {
    const resp = await wsRequest<{ requests: FriendRequest[] }>('fetch_friend_requests', {});
    return resp.requests ?? [];
  };

  // ─── WS RPC: push_subscribe ─────────────────────────────────────────────
  api.pushSubscribeWS = async (subscription: PushSubscriptionJSON): Promise<void> => {
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

  // ─── WS RPC: push_unsubscribe ───────────────────────────────────────────
  api.pushUnsubscribeWS = async (endpoint: string): Promise<void> => {
    const socket = getSocket();
    if (socket?.connected) {
      await wsRequest('push_unsubscribe', { endpoint });
      return;
    }
    await api.request('/users/push-subscription', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    });
  };
}
