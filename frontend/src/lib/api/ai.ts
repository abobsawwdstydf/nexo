import type { AICommandLog } from '../types';
import { ApiClient, getApiBase } from './core';

declare module './core' {
  interface ApiClient {
    getAIContext(messageId: string, chatId: string, question?: string): Promise<{ text: string; context: string }>;
    getAISuggestions(chatId: string, lastMessage: string): Promise<{ suggestions: string[] }>;
    getAIAutocomplete(text: string): Promise<{ completion: string }>;
    checkGrammar(text: string): Promise<{ corrected: string; hasChanges: boolean; original: string }>;
    generateImage(prompt: string): Promise<{ url: string; provider: string }>;
    aiChat(messages: Array<{ role: string; content: string }>): Promise<{ text: string }>;
    getChatSummary(chatId: string, limit?: number): Promise<{ summary: string; messageCount: number }>;
    getAICommandHistory(chatId?: string): Promise<{ items: AICommandLog[] }>;
    // Stickers
    getStickerPacks(limit?: number, offset?: number, search?: string): Promise<{ packs: any[]; total: number; hasMore: boolean }>;
    getMyStickerPacks(): Promise<any[]>;
    getPackStickers(packId: string, limit?: number, offset?: number): Promise<{ stickers: any[]; total: number; hasMore: boolean }>;
    createStickerPack(data: { name: string; description?: string; isPublic?: boolean; isAnimated?: boolean }): Promise<any>;
    addStickerToPack(packId: string, data: { emoji: string; fileUrl: string; isAnimated?: boolean; width?: number; height?: number }): Promise<any>;
    deleteStickerPack(packId: string): Promise<any>;
    searchGifs(query: string, limit?: number): Promise<any[]>;
    getTrendingGifs(limit?: number): Promise<any[]>;
    // Utilities
    getIceServers(): Promise<{ iceServers: RTCIceServer[] }>;
    generateCaptcha(): Promise<{ id: string; question: string; expiresAt: string }>;
    verifyCaptcha(id: string, answer: string): Promise<{ valid: boolean }>;
  }
}

export function installAI(api: ApiClient): void {
  // ─── AI Context / Suggestions ─────────────────────────────────────
  api.getAIContext = async (messageId: string, chatId: string, question?: string) => {
    return api.request<{ text: string; context: string }>('/ai/context', {
      method: 'POST',
      body: JSON.stringify({ messageId, chatId, question }),
    });
  };

  api.getAISuggestions = async (chatId: string, lastMessage: string) => {
    return api.request<{ suggestions: string[] }>('/ai/suggestions', {
      method: 'POST',
      body: JSON.stringify({ chatId, lastMessage }),
    });
  };

  api.getAIAutocomplete = async (text: string) => {
    return api.request<{ completion: string }>('/ai/autocomplete', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  };

  api.checkGrammar = async (text: string) => {
    return api.request<{ corrected: string; hasChanges: boolean; original: string }>('/ai/grammar', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  };

  // ─── AI Image / Chat ──────────────────────────────────────────────
  api.generateImage = async (prompt: string) => {
    return api.request<{ url: string; provider: string }>('/ai/generate-image', {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    });
  };

  api.aiChat = async (messages) => {
    return api.request<{ text: string }>('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ messages }),
    });
  };

  api.getChatSummary = async (chatId: string, limit = 50) => {
    return api.request<{ summary: string; messageCount: number }>('/ai/chat-summary', {
      method: 'POST',
      body: JSON.stringify({ chatId, limit }),
    });
  };

  api.getAICommandHistory = async (chatId?: string) => {
    const query = chatId ? `?chatId=${chatId}` : '';
    return api.request<{ items: AICommandLog[] }>(`/ai/history${query}`);
  };

  // ─── Stickers ─────────────────────────────────────────────────────
  api.getStickerPacks = async (limit = 50, offset = 0, search = '') => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('search', search);
    return api.request<{ packs: any[]; total: number; hasMore: boolean }>(`/stickers/packs?${params}`);
  };

  api.getMyStickerPacks = async () => {
    return api.request<any[]>('/stickers/packs/my');
  };

  api.getPackStickers = async (packId: string, limit = 100, offset = 0) => {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return api.request<{ stickers: any[]; total: number; hasMore: boolean }>(`/stickers/packs/${packId}/stickers?${params}`);
  };

  api.createStickerPack = async (data) => {
    return api.request<any>('/stickers/packs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.addStickerToPack = async (packId: string, data) => {
    return api.request<any>(`/stickers/packs/${packId}/stickers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.deleteStickerPack = async (packId: string) => {
    return api.request<any>(`/stickers/packs/${packId}`, { method: 'DELETE' });
  };

  // ─── GIFs ─────────────────────────────────────────────────────────
  api.searchGifs = async (query: string, limit = 20) => {
    return api.request<any[]>(`/stickers/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  };

  api.getTrendingGifs = async (limit = 30) => {
    return api.request<any[]>(`/stickers/gifs/trending?limit=${limit}`);
  };

  // ─── Utilities ────────────────────────────────────────────────────
  api.getIceServers = async () => {
    return api.request<{ iceServers: RTCIceServer[] }>('/utilities/ice-servers');
  };

  api.generateCaptcha = async () => {
    return api.request<{ id: string; question: string; expiresAt: string }>('/captcha/generate');
  };

  api.verifyCaptcha = async (id: string, answer: string) => {
    return api.request<{ valid: boolean }>('/captcha/verify', {
      method: 'POST',
      body: JSON.stringify({ id, answer }),
    });
  };
}
