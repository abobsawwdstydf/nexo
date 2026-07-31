import type { FriendRequest, FriendWithId } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    getFriends(): Promise<FriendWithId[]>;
    getFriendRequests(): Promise<FriendRequest[]>;
    sendFriendRequest(friendId: string): Promise<{ status: string }>;
    acceptFriendRequest(friendshipId: string): Promise<{ id: string }>;
    declineFriendRequest(friendshipId: string): Promise<{ success: boolean }>;
    removeFriend(friendshipId: string): Promise<{ success: boolean }>;
  }
}

export function installSocial(api: ApiClient): void {
  // ─── Friends ──────────────────────────────────────────────────────
  api.getFriends = async () => {
    return api.request<FriendWithId[]>('/friends');
  };

  api.getFriendRequests = async () => {
    return api.request<FriendRequest[]>('/friends/requests');
  };

  api.sendFriendRequest = async (friendId: string) => {
    return api.request<{ status: string }>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    });
  };

  api.acceptFriendRequest = async (friendshipId: string) => {
    return api.request<{ id: string }>(`/friends/${friendshipId}/accept`, { method: 'POST' });
  };

  api.declineFriendRequest = async (friendshipId: string) => {
    return api.request<{ success: boolean }>(`/friends/${friendshipId}/decline`, { method: 'POST' });
  };

  api.removeFriend = async (friendshipId: string) => {
    return api.request<{ success: boolean }>(`/friends/${friendshipId}`, { method: 'DELETE' });
  };
}
