import type { Chat } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    getChats(): Promise<Chat[]>;
    createChat(data: { type: string; name?: string; username?: string; description?: string; memberIds?: string[]; welcomeMessage?: string }): Promise<Chat>;
    createPersonalChat(userId: string): Promise<Chat>;
    createGroup(name: string, memberIds: string[], username?: string): Promise<Chat>;
    createChannel(name: string, username: string, description?: string): Promise<Chat>;
    addChatMember(chatId: string, userId: string): Promise<{ id: string }>;
    getOrCreateFeedbackChat(): Promise<Chat>;
    openComments(chatId: string, messageId: string): Promise<{ chatId: string; chat: Chat }>;
    adminListFeedback(): Promise<{ items: Array<{ chatId: string; name: string; avatar: string; members: number; messageCount: number; lastMessage: { content: string } | null; lastAt: string }>; total: number }>;
    adminReplyFeedback(chatId: string, content: string): Promise<unknown>;
    setUserBadge(targetId: string, badgeType: string, badgeUrl: string): Promise<{ ok: boolean }>;
    clearUserBadge(targetId: string): Promise<{ ok: boolean }>;
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

  api.createGroup = async (name: string, memberIds: string[], username?: string) => {
    return api.createChat({ type: 'group', name, memberIds, username: username || undefined });
  };

  api.createChannel = async (name: string, username: string, description?: string) => {
    return api.createChat({ type: 'channel', name, username, description: description || undefined });
  };

  api.addChatMember = async (chatId: string, userId: string) => {
    return api.request<{ id: string }>(`/chats/${chatId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  };

  // ─── System Feedback Chat ─────────────────────────────────────────
  api.getOrCreateFeedbackChat = async () => {
    return api.request<Chat>('/feedback/chat', { method: 'POST' });
  };

  api.openComments = async (chatId: string, messageId: string) => {
    return api.request<{ chatId: string; chat: Chat }>(`/chats/${chatId}/comments/${messageId}/open`, { method: 'POST' });
  };

  api.adminListFeedback = async () => {
    return api.request<{ items: Array<{ chatId: string; name: string; avatar: string; members: number; messageCount: number; lastMessage: { content: string } | null; lastAt: string }>; total: number }>('/admin/feedback');
  };

  api.adminReplyFeedback = async (chatId: string, content: string) => {
    return api.request(`/admin/feedback/${chatId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  };

  // ─── Admin Badges ─────────────────────────────────────────────────
  api.setUserBadge = async (targetId: string, badgeType: string, badgeUrl: string) => {
    return api.request<{ ok: boolean }>('/admin/badges', {
      method: 'POST',
      body: JSON.stringify({ targetId, badgeType, badgeUrl }),
    });
  };

  api.clearUserBadge = async (targetId: string) => {
    return api.request<{ ok: boolean }>('/admin/badges', {
      method: 'DELETE',
      body: JSON.stringify({ targetId }),
    });
  };
}
