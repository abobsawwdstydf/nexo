import type { Chat } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    getChats(): Promise<Chat[]>;
    createChat(data: { type: string; name?: string; username?: string; memberIds?: string[]; welcomeMessage?: string }): Promise<Chat>;
    createPersonalChat(userId: string): Promise<Chat>;
    createGroup(name: string, memberIds: string[]): Promise<Chat>;
    createChannel(name: string, username: string, description?: string, avatarUrl?: string): Promise<Chat>;
    addChatMember(chatId: string, userId: string): Promise<{ id: string }>;
  }
}

export function installChats(api: ApiClient): void {
  // ─── Chats ────────────────────────────────────────────────────────
  api.getChats = async () => {
    return api.request<Chat[]>('/chats');
  };

  // Generic create — backend only exposes POST /chats (type: personal | group | channel).
  api.createChat = async (data) => {
    return api.request<Chat>('/chats', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.createPersonalChat = async (userId: string) => {
    return api.createChat({ type: 'personal', memberIds: [userId] });
  };

  api.createGroup = async (name: string, memberIds: string[]) => {
    return api.createChat({ type: 'group', name, memberIds });
  };

  api.createChannel = async (name: string, username: string, description?: string, avatarUrl?: string) => {
    return api.createChat({ type: 'channel', name, username });
  };

  api.addChatMember = async (chatId: string, userId: string) => {
    return api.request<{ id: string }>(`/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  };
}
