import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    // GIFs
    searchGifs(query: string, limit?: number): Promise<any[]>;
    getTrendingGifs(limit?: number): Promise<any[]>;
  }
}

export function installAI(api: ApiClient): void {
  // ─── GIFs ─────────────────────────────────────────────────────────
  api.searchGifs = async (query: string, limit = 20) => {
    return api.request<any[]>(`/stickers/gifs/search?q=${encodeURIComponent(query)}&limit=${limit}`);
  };

  api.getTrendingGifs = async (limit = 30) => {
    return api.request<any[]>(`/stickers/gifs/trending?limit=${limit}`);
  };
}
