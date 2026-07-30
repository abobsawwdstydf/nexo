import { create } from 'zustand';
import { getApiBase } from '../lib/api/core';

interface BetaStatus {
  active: boolean;
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
      const res = await fetch(`${getApiBase()}/beta/status`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error('Failed to fetch beta status');
      const status: BetaStatus = await res.json();
      set({ status, loaded: true, loading: false });
    } catch {
      set({ loading: false });
    }
  },
}));
