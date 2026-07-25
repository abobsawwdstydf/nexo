import type { FriendRequest, FriendWithId, FriendshipStatus } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    getFriends(): Promise<FriendWithId[]>;
    getFriendRequests(): Promise<FriendRequest[]>;
    getOutgoingRequests(): Promise<FriendRequest[]>;
    getFriendshipStatus(userId: string): Promise<FriendshipStatus>;
    sendFriendRequest(friendId: string): Promise<{ status: string }>;
    acceptFriendRequest(friendshipId: string): Promise<{ id: string }>;
    declineFriendRequest(friendshipId: string): Promise<{ success: boolean }>;
    removeFriend(friendshipId: string): Promise<{ success: boolean }>;
    // Bookmarks
    getBookmarks(): Promise<any[]>;
    addBookmark(messageId: string, note?: string): Promise<any>;
    updateBookmark(id: string, note: string): Promise<any>;
    removeBookmark(messageId: string): Promise<any>;
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

  api.getOutgoingRequests = async () => {
    return api.request<FriendRequest[]>('/friends/outgoing');
  };

  api.getFriendshipStatus = async (userId: string) => {
    return api.request<FriendshipStatus>(`/friends/status/${userId}`);
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

  // ─── Bookmarks ────────────────────────────────────────────────────
  api.getBookmarks = async () => {
    return api.request<any[]>('/bookmarks');
  };

  api.addBookmark = async (messageId: string, note?: string) => {
    return api.request<any>('/bookmarks', { method: 'POST', body: JSON.stringify({ messageId, note }) });
  };

  api.updateBookmark = async (id: string, note: string) => {
    return api.request<any>(`/bookmarks/${id}`, { method: 'PUT', body: JSON.stringify({ note }) });
  };

  api.removeBookmark = async (messageId: string) => {
    return api.request<any>(`/bookmarks/${messageId}`, { method: 'DELETE' });
  };
}
