import type { Chat } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    getChats(): Promise<Chat[]>;
    createPersonalChat(userId: string): Promise<Chat>;
    createChannel(name: string, username: string, description?: string, avatarUrl?: string): Promise<Chat>;
  }
}

export function installChats(api: ApiClient): void {
  // ─── Chats ────────────────────────────────────────────────────────
  api.getChats = async () => {
    return api.request<Chat[]>('/chats');
  };

  api.createPersonalChat = async (userId: string) => {
    return api.request<Chat>('/chats/personal', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  };

  api.createChannel = async (name: string, username: string, description?: string, avatarUrl?: string) => {
    return api.request<Chat>('/chats/channel', {
      method: 'POST',
      body: JSON.stringify({ name, username, description, avatar: avatarUrl }),
    });
  };
}
