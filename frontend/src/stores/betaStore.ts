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

// Локальный фолбэк: если сервер недоступен, считаем статус на клиенте.
// Бета: с 10 августа 06:00 МСК (03:00 UTC) до 17 августа 06:00 МСК = 7 дней.
const BETA_START = Date.parse('2026-08-10T03:00:00Z');
const BETA_END = Date.parse('2026-08-17T03:00:00Z');

function localStatus(): BetaStatus {
  const now = Date.now();
  const active = now >= BETA_START && now < BETA_END;
  const started = now >= BETA_START;
  const ended = now >= BETA_END;
  const daysLeft = active ? Math.max(1, Math.ceil((BETA_END - now) / 86_400_000)) : 0;
  return {
    active,
    started,
    ended,
    startTime: new Date(BETA_START).toISOString(),
    endTime: new Date(BETA_END).toISOString(),
    daysLeft,
    contactTg: '@haker_one',
    contactTt: '@nexo.su',
    message:
      'Это бета-версия. Если вы нашли баг, пишите мне в тг @haker_one или в тиктоке @nexo.su',
    blockedMessage: started ? undefined : 'Нексо откроется 10 августа в 6:00 (МСК)',
  };
}

export const useBetaStore = create<BetaStore>((set) => ({
  status: null,
  loading: false,
  loaded: false,
  fetch: async () => {
    set({ loading: true });
    try {
      const status: BetaStatus = await api.request<BetaStatus>('/beta/status', { timeout: 4000 });
      // Сервер — источник истины, но если он не знает о бете (старая версия),
      // дополняем клиентским расчётом.
      const merged = status && typeof status.active === 'boolean'
        ? { ...status, blockedMessage: status.blockedMessage ?? localStatus().blockedMessage }
        : localStatus();
      set({ status: merged, loaded: true, loading: false });
    } catch {
      // Сеть недоступна — считаем статус локально, чтобы плашка беты
      // была видна всегда, даже офлайн.
      set({ status: localStatus(), loaded: true, loading: false });
    }
  },
}));

export { localStatus };