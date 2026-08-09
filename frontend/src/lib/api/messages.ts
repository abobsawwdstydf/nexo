import type { Message, UploadedMedia } from '../types';
import { ApiClient } from './core';

export interface ReactionResult {
  ok: boolean;
  action: 'added' | 'removed';
}

declare module './core' {
  interface ApiClient {
    getMessages(chatId: string, cursor?: string): Promise<Message[]>;
    uploadFile(file: File): Promise<UploadedMedia>;
    // Reactions
    addReaction(messageId: string, emoji: string): Promise<ReactionResult>;
    removeReaction(messageId: string, emoji: string): Promise<ReactionResult>;
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

    type UploadResponse = Partial<UploadedMedia> & { files?: UploadedMedia[] };

    const result = await api.request<UploadedMedia[] | UploadResponse>('/upload', {
      method: 'POST',
      body: formData,
      timeout: 300_000,
    });

    if (Array.isArray(result)) {
      const first = result[0];
      if (first) return first;
      console.error('[uploadFile] Empty upload response:', result);
      throw new Error('Пустой ответ сервера при загрузке');
    }
    if (result.files && result.files.length) return result.files[0];
    if (result.fileId || result.url) return result;

    console.error('[uploadFile] Unexpected response:', result);
    throw new Error('Неожиданный ответ сервера при загрузке');
  };

  // ─── Reactions ────────────────────────────────────────────────────
  api.addReaction = async (messageId: string, emoji: string) => {
    return api.request<ReactionResult>(`/reactions/${messageId}`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    });
  };

  api.removeReaction = async (messageId: string, emoji: string) => {
    return api.request<ReactionResult>(`/reactions/${messageId}/${encodeURIComponent(emoji)}`, {
      method: 'DELETE',
    });
  };
}
