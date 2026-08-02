import { create } from 'zustand';
import { api } from '../lib/api';

interface BetaStatus {
  active: boolean;
  started: boolean;
  ended: boolean;
  startTime: string;
  endTime: string;
  daysLeft: number;
  contactTg: string;
  contactTt: string;
  message: string;
  blockedMessage?: string;
}

interface BetaStore {
  status: BetaStatus | null;
  loading: boolean;
  loaded: boolean;
  fetch: () => Promise<void>;
}

export const useBetaStore = create<BetaStore>((set) => ({
  status: null,
  loading: false,
  loaded: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const status: BetaStatus = await api.request<BetaStatus>('/beta/status', { timeout: 5000 });
      set({ status, loaded: true, loading: false });
    } catch {
      // Network failure — fail open (allow access) instead of blocking the app forever
      set({ loaded: true, loading: false });
    }
  },
}));
