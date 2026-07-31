import type { Message } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    getMessages(chatId: string, cursor?: string): Promise<Message[]>;
    uploadFile(file: File): Promise<any>;
    // Reactions
    addReaction(messageId: string, emoji: string): Promise<any>;
    removeReaction(messageId: string, emoji: string): Promise<any>;
  }
}

export function installMessages(api: ApiClient): void {
  // ─── Messages ─────────────────────────────────────────────────────
  api.getMessages = async (chatId: string, cursor?: string) => {
    const params = cursor ? `?cursor=${cursor}` : '';
    return api.request<Message[]>(`/messages/chat/${chatId}${params}`);
  };

  api.uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file, file.name);

    const result = await api.request<any>('/upload', {
      method: 'POST',
      body: formData,
      timeout: 300_000,
    });

    if (Array.isArray(result)) return result[0];
    if (result.files && Array.isArray(result.files)) return result.files[0];
    if (result.fileId || result.url) return result;

    console.error('[uploadFile] Unexpected response:', result);
    throw new Error('Неожиданный ответ сервера при загрузке');
  };

  // ─── Reactions ────────────────────────────────────────────────────
  api.addReaction = async (messageId: string, emoji: string) => {
    return api.request(`/reactions/${messageId}`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  };

  api.removeReaction = async (messageId: string, emoji: string) => {
    return api.request(`/reactions/${messageId}/${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    });
  };
}
