import { ApiClient, getApiBase } from './core';


export interface AdminAnalyticsTotals {
  totalUsers: number;
  totalBanned: number;
  onlineNow: number;
  totalVerified: number;
  totalAdmins: number;
  totalChats: number;
  totalGroups: number;
  totalChannels: number;
  totalPersonals: number;
  totalE2E: number;
  totalSecret: number;
  totalMessages: number;
  totalMedia: number;
  mediaSizeBytes: number;
  totalStories: number;
  totalPayments: number;
  totalReports: number;
  premiumUsers: number;
}

export interface AdminAnalyticsDaily {
  date: string;
  activeUsers: number;
  newUsers: number;
  messages: number;
}

export interface AdminAnalyticsTopChat {
  chatId: string;
  name: string;
  messageCount: number;
}

export interface AdminAnalyticsResponse {
  totals: AdminAnalyticsTotals;
  daily: AdminAnalyticsDaily[];
  topChats: AdminAnalyticsTopChat[];
  generatedAt: string;
}
export interface AdminReport {
  id: string;
  chatId: string;
  targetId: string;
  actorId: string;
  action: string;
  reason: string;
  duration: number;
  createdAt: string;
  actorName: string;
  chatName: string;
}

export interface AdminFeedbackTicket {
  chatId: string;
  name: string;
  avatar: string;
  members: number;
  messageCount: number;
  lastMessage?: {
    content: string;
    sender?: { displayName?: string; username?: string };
    createdAt: string;
  } | null;
  lastAt: string;
}

export interface BadgeInput {
  targetId: string;
  badgeType: string;
  badgeUrl: string;
}

export interface AdminPromoCode {
  id: string;
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  active: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

export interface PromoCodeInput {
  code: string;
  discountPercent: number;
  maxUses: number;
  active?: boolean;
  expiresAt?: string;
}

declare module './core' {
  interface ApiClient {
    getAdminReports(): Promise<AdminReport[]>;
    getAdminFeedback(): Promise<AdminFeedbackTicket[]>;
    adminReplyFeedback(chatId: string, content: string): Promise<{ ok: boolean }>;
    adminSetBadge(input: BadgeInput): Promise<{ ok: boolean }>;
    adminClearBadge(targetId: string): Promise<{ ok: boolean }>;
    getAdminPromoCodes(): Promise<AdminPromoCode[]>;
    adminCreatePromoCode(input: PromoCodeInput): Promise<AdminPromoCode>;
    adminUpdatePromoCode(id: string, input: Partial<PromoCodeInput>): Promise<AdminPromoCode>;
    adminDeletePromoCode(id: string): Promise<{ ok: boolean }>;
    getAdminAnalytics(): Promise<AdminAnalyticsResponse>;
  }
}

export function installAdmin(api: ApiClient): void {
  api.getAdminReports = async () => {
    const res = await api.get<{ items: AdminReport[] }>('/admin/reports');
    return res.items ?? [];
  };

  api.getAdminFeedback = async () => {
    const res = await api.get<{ items: AdminFeedbackTicket[] }>('/admin/feedback');
    return res.items ?? [];
  };

  api.adminReplyFeedback = async (chatId: string, content: string) => {
    return api.post<{ ok: boolean }>(`/admin/feedback/${chatId}/reply`, { content });
  };

  api.adminSetBadge = async (input: BadgeInput) => {
    return api.post<{ ok: boolean }>('/admin/badges', input);
  };

  api.adminClearBadge = async (targetId: string) => {
    return api.request<{ ok: boolean }>('/admin/badges', {
      method: 'DELETE',
      body: JSON.stringify({ targetId }),
    });
  };

  api.getAdminPromoCodes = async () => {
    const res = await api.get<{ items: AdminPromoCode[] }>('/admin/promocodes');
    return res.items ?? [];
  };

  api.adminCreatePromoCode = async (input: PromoCodeInput) => {
    return api.post<AdminPromoCode>('/admin/promocodes', input);
  };

  api.adminUpdatePromoCode = async (id: string, input: Partial<PromoCodeInput>) => {
    return api.request<AdminPromoCode>(`/admin/promocodes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });
  };

  api.adminDeletePromoCode = async (id: string) => {
    return api.request<{ ok: boolean }>(`/admin/promocodes/${id}`, { method: 'DELETE' });
  };

  api.getAdminAnalytics = async () => {
    return api.get<AdminAnalyticsResponse>('/admin/analytics');
  };

}

// ═══ Отдельный клиент для админ-панели ────────────────────────────────────
// Хранит токены под собственными ключами localStorage (nexo_admin_*),
// чтобы вход в /admin не пересекался с сессией мессенджера.
export const ADMIN_TOKEN_KEY = 'nexo_admin_token';
export const ADMIN_REFRESH_KEY = 'nexo_admin_refresh_token';

export class AdminApiClient extends ApiClient {
  getStoredAccessToken(): string | null {
    try { return localStorage.getItem(ADMIN_TOKEN_KEY); } catch { return null; }
  }
  getStoredRefreshToken(): string | null {
    try { return localStorage.getItem(ADMIN_REFRESH_KEY); } catch { return null; }
  }
  setStoredRefreshToken(token: string | null): void {
    try {
      if (token) localStorage.setItem(ADMIN_REFRESH_KEY, token);
      else localStorage.removeItem(ADMIN_REFRESH_KEY);
    } catch { /* localStorage not available */ }
  }
  async doRefresh(): Promise<'ok' | 'invalid' | 'network'> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 10_000);
      const body: Record<string, string> = {};
      const refreshToken = this.getStoredRefreshToken();
      if (refreshToken) body.refreshToken = refreshToken;
      const res = await fetch(`${this.getApiBaseForRefresh()}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) return 'invalid';
      const data = await res.json();
      if (data.accessToken) {
        try { localStorage.setItem(ADMIN_TOKEN_KEY, data.accessToken); } catch { /* noop */ }
      }
      if (data.refreshToken) this.setStoredRefreshToken(data.refreshToken);
      if (data.csrfToken) this.csrfToken = data.csrfToken;
      return 'ok';
    } catch {
      return 'network';
    }
  }
  private getApiBaseForRefresh(): string {
    return getApiBase();
  }
}

export const adminApi = new AdminApiClient();
installAdmin(adminApi);
adminApi.setOnAuthFailed(() => {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_KEY);
  } catch { /* noop */ }
  window.location.hash = '#admin';
});

export interface AdminLoginResult {
  accessToken: string;
  refreshToken?: string;
  requiresTwoFactor?: boolean;
  tentativeToken?: string;
}

// Этап 1: запросить код на почту администратора
export async function adminRequestCode(email: string): Promise<{ requiresCode: boolean; expiresAt?: string }> {
  return adminApi.post('/auth/admin/request-code', { email });
}

// Этап 2: обменять код на токены (или получить tentativeToken для 2FA)
export async function adminVerifyCode(email: string, code: string): Promise<AdminLoginResult> {
  return adminApi.post('/auth/admin/verify', { email, code });
}

// Этап 2.5: завершить 2FA, если она включена на аккаунте
export async function adminComplete2FA(tentativeToken: string, code: string): Promise<AdminLoginResult> {
  return adminApi.post('/auth/login/totp', { tentativeToken, code });
}

export function adminLogout(): void {
  try {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(ADMIN_REFRESH_KEY);
  } catch { /* noop */ }
}

// Получает CSRF-токен для мутаций админ-панели (POST/PUT/DELETE).
export async function adminEnsureCsrf(): Promise<void> {
  try {
    const res = await fetch(`${getApiBase()}/csrf-token`, { credentials: 'include' });
    if (!res.ok) return;
    const data = await res.json();
    if (data.token) adminApi.setCsrfToken(data.token);
  } catch { /* fall back to auto-retry in ApiClient */ }
}
