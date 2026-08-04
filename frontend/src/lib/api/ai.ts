import { ApiClient } from './core';
import type { GifItem } from '../types';

declare module './core' {
  interface ApiClient {
    // GIFs
    searchGifs(query: string, limit?: number): Promise<GifItem[]>;
    getTrendingGifs(limit?: number): Promise<GifItem[]>;
    // Speech-to-text: transcribe a voice blob (WebM/OGG) into text
    transcribeAudio(blob: Blob): Promise<string>;
  }
}

export function installAI(api: ApiClient): void {
  // ─── GIFs ─────────────────────────────────────────────────────────
  api.searchGifs = async (query: string, limit = 20) => {
    return api.request<GifItem[]>(`/stickers/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  };

  api.getTrendingGifs = async (limit = 30) => {
    return api.request<GifItem[]>(`/stickers/gifs/trending?limit=${limit}`);
  };

  // ─── Speech-to-text ───────────────────────────────────────────────
  api.transcribeAudio = async (blob: Blob): Promise<string> => {
    const form = new FormData();
    form.append('audio', blob, 'voice.webm');
    const res = await api.request<{ text?: string; provider?: string }>('/ai/transcribe', {
      method: 'POST',
      body: form,
      timeout: 30_000,
    });
    if (!res || !res.text || !res.text.trim()) {
      throw new Error('empty-transcript');
    }
    return res.text.trim();
  };
}
