import type { UserPresence } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    searchUsers(query: string): Promise<UserPresence[]>;
  }
}

export function installUsers(api: ApiClient): void {
  // ─── Users ────────────────────────────────────────────────────────
  api.searchUsers = async (query: string) => {
    return api.request<UserPresence[]>(`/users/search?q=${encodeURIComponent(query)}`);
  };
}
