import type { ApiClient } from './core';

export interface UserSticker {
  id: string;
  packId: string;
  emoji: string;
  fileUrl: string;
  fileSize: number;
  order: number;
}

export interface UserStickerPack {
  id: string;
  name: string;
  description: string;
  creatorId: string;
  thumbnail: string;
  type: 'sticker' | 'emoji';
  isPublic: boolean;
  createdAt: string;
  stickers: UserSticker[];
}

export function installUserStickers(api: ApiClient): void {
  api.createUserStickerPack = async (name: string, type: 'sticker' | 'emoji', description = '') => {
    return api.post<UserStickerPack>('/sticker-packs', { name, type, description });
  };

  api.getMyStickerPacks = async () => {
    return api.get<UserStickerPack[]>('/sticker-packs');
  };

  api.uploadUserSticker = async (packId: string, file: File, emoji = '') => {
    const form = new FormData();
    form.append('file', file);
    if (emoji) form.append('emoji', emoji);
    return api.post<UserSticker>(`/sticker-packs/${packId}/stickers`, form);
  };

  api.deleteUserSticker = async (stickerId: string) => {
    return api.delete(`/stickers/${stickerId}`);
  };

  api.deleteUserStickerPack = async (packId: string) => {
    return api.delete(`/sticker-packs/${packId}`);
  };
}

declare module './core' {
  interface ApiClient {
    createUserStickerPack(name: string, type: 'sticker' | 'emoji', description?: string): Promise<UserStickerPack>;
    getMyStickerPacks(): Promise<UserStickerPack[]>;
    uploadUserSticker(packId: string, file: File, emoji?: string): Promise<UserSticker>;
    deleteUserSticker(stickerId: string): Promise<{ ok: boolean }>;
    deleteUserStickerPack(packId: string): Promise<{ ok: boolean }>;
  }
}
