import type { Message } from '../types';
import { ApiClient, getApiBase } from './core';

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

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 300_000);
    const storedToken = api.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/upload`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
        ...(api.csrfToken ? { 'X-CSRF-Token': api.csrfToken } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка загрузки файла' }));
      throw new Error(error.error || `Ошибка загрузки: ${response.status}`);
    }
    const result = await response.json();

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
