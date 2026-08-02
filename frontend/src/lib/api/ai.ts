import { ApiClient } from './core';
import type { GifItem } from '../types';

declare module './core' {
  interface ApiClient {
    // GIFs
    searchGifs(query: string, limit?: number): Promise<GifItem[]>;
    getTrendingGifs(limit?: number): Promise<GifItem[]>;
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
}
