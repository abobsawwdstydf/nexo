import type { Chat, UserBasic } from '../types';
import { ApiClient, getApiBase } from './core';

declare module './core' {
  interface ApiClient {
    getChats(): Promise<Chat[]>;
    getChat(id: string): Promise<Chat>;
    createPersonalChat(userId: string): Promise<Chat>;
    createGroupChat(name: string, memberIds: string[]): Promise<Chat>;
    createChannel(name: string, username: string, description?: string, avatarUrl?: string): Promise<Chat>;
    getChannelByUsername(username: string): Promise<Chat>;
    joinChannel(username: string): Promise<Chat>;
    updateGroup(chatId: string, data: { name?: string; description?: string }): Promise<Chat>;
    uploadGroupAvatar(chatId: string, file: File): Promise<Chat>;
    removeGroupAvatar(chatId: string): Promise<Chat>;
    addGroupMembers(chatId: string, userIds: string[]): Promise<Chat>;
    removeGroupMember(chatId: string, userId: string): Promise<Chat>;
    clearChat(chatId: string): Promise<{ message: string }>;
    deleteChat(chatId: string): Promise<{ message: string }>;
    togglePinChat(chatId: string): Promise<{ isPinned: boolean }>;
    getOrCreateFavorites(): Promise<Chat>;
    getCallHistory(limit?: number): Promise<Array<{
      id: string;
      callerId: string;
      calleeId: string;
      chatId: string | null;
      type: 'voice' | 'video' | 'group';
      status: 'completed' | 'missed' | 'declined' | 'failed';
      duration: number;
      createdAt: string;
      caller: any;
      callee: any | null;
    }>>;
    createCallLog(data: {
      calleeId: string;
      chatId?: string;
      type?: 'voice' | 'video' | 'group';
      status?: 'completed' | 'missed' | 'declined' | 'failed';
      duration?: number;
    }): Promise<{ message: string }>;
  }
}

export function installChats(api: ApiClient): void {
  // ─── Chats ────────────────────────────────────────────────────────
  api.getChats = async () => {
    return api.request<Chat[]>('/chats');
  };

  api.getChat = async (id: string) => {
    return api.request<Chat>(`/chats/${id}`);
  };

  api.createPersonalChat = async (userId: string) => {
    return api.request<Chat>('/chats/personal', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  };

  api.createGroupChat = async (name: string, memberIds: string[]) => {
    return api.request<Chat>('/chats/group', {
      method: 'POST',
      body: JSON.stringify({ name, memberIds }),
    });
  };

  api.createChannel = async (name: string, username: string, description?: string, avatarUrl?: string) => {
    return api.request<Chat>('/chats/channel', {
      method: 'POST',
      body: JSON.stringify({ name, username, description, avatar: avatarUrl }),
    });
  };

  api.getChannelByUsername = async (username: string) => {
    return api.request<Chat>(`/chats/join/${encodeURIComponent(username)}`);
  };

  api.joinChannel = async (username: string) => {
    return api.request<Chat>(`/chats/join/${encodeURIComponent(username)}`, {
      method: 'POST',
    });
  };

  // ─── Groups ───────────────────────────────────────────────────────
  api.updateGroup = async (chatId: string, data) => {
    return api.request<Chat>(`/chats/${chatId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  api.uploadGroupAvatar = async (chatId: string, file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const storedToken = api.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/chats/${chatId}/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error('Ошибка загрузки аватара');
    return response.json() as Promise<Chat>;
  };

  api.removeGroupAvatar = async (chatId: string) => {
    return api.request<Chat>(`/chats/${chatId}/avatar`, { method: 'DELETE' });
  };

  api.addGroupMembers = async (chatId: string, userIds: string[]) => {
    return api.request<Chat>(`/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userIds }),
    });
  };

  api.removeGroupMember = async (chatId: string, userId: string) => {
    return api.request<Chat>(`/chats/${chatId}/members/${userId}`, {
      method: 'DELETE',
    });
  };

  // ─── Chat Management ──────────────────────────────────────────────
  api.clearChat = async (chatId: string) => {
    return api.request<{ message: string }>(`/chats/${chatId}/clear`, { method: 'POST' });
  };

  api.deleteChat = async (chatId: string) => {
    return api.request<{ message: string }>(`/chats/${chatId}`, { method: 'DELETE' });
  };

  api.togglePinChat = async (chatId: string) => {
    return api.request<{ isPinned: boolean }>(`/chats/${chatId}/pin`, { method: 'POST' });
  };

  api.getOrCreateFavorites = async () => {
    return api.request<Chat>('/chats/favorites', { method: 'POST' });
  };

  // ─── Call History ─────────────────────────────────────────────────
  api.getCallHistory = async (limit?: number) => {
    return api.request<Array<{
      id: string;
      callerId: string;
      calleeId: string;
      chatId: string | null;
      type: 'voice' | 'video' | 'group';
      status: 'completed' | 'missed' | 'declined' | 'failed';
      duration: number;
      createdAt: string;
      caller: UserBasic;
      callee: UserBasic | null;
    }>>(`/call-logs${limit ? `?limit=${limit}` : ''}`);
  };

  api.createCallLog = async (data) => {
    return api.request<{ message: string }>('/call-logs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
}
