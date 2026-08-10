import { ApiClient } from './core';

export interface E2EKeyBundleData {
  identityKey: string;
  signedPreKey: string;
  signedKeySig: string;
  oneTimePreKeys: string[];
  deviceId: string;
}

export interface E2EKeyBundleResponse {
  identityKey: string;
  signedPreKey: string;
  signedKeySig: string;
  oneTimePreKeys: string[];
  deviceId: string;
  userId: string;
}

declare module './core' {
  interface ApiClient {
    // Premium
    getPremiumStatus(): Promise<{ isPremium: boolean; premiumUntil: string | null }>;
    createPayment(data: { type: 'premium' | 'premium_gift'; premiumMonths: number; giftToUserId?: string; promoCode?: string }): Promise<{ paymentId: string; confirmationUrl: string; amount: number }>;
    getPremiumPrices(): Promise<{ prices: Record<number, number>; currency: string }>;
    checkPromoCode(code: string, months: number): Promise<{ valid: boolean; error?: string; code?: string; discountPercent?: number; baseAmount?: number; finalAmount?: number }>;
    // E2E
    uploadKeyBundle(data: E2EKeyBundleData): Promise<{ ok: boolean }>;
    fetchKeyBundle(userId: string): Promise<{ bundles: E2EKeyBundleResponse[] }>;
    consumeOneTimePreKey(userId: string): Promise<{ oneTimePreKey: string }>;
    initE2ESession(data: { chatId: string; encryptedKey: string }): Promise<{ ok: boolean; sessionId: string; existed: boolean }>;
  }
}

export function installFeatures(api: ApiClient): void {
  // ─── Premium ──────────────────────────────────────────────────────
  api.getPremiumStatus = async () => {
    return api.request<{ isPremium: boolean; premiumUntil: string | null }>('/premium/status');
  };

  api.createPayment = async (data) => {
    return api.request<{
      paymentId: string;
      confirmationUrl: string;
      amount: number;
    }>('/premium/payment', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.getPremiumPrices = async () => {
    return api.request<{ prices: Record<number, number>; currency: string }>('/premium/prices');
  };

  api.checkPromoCode = async (code, months) => {
    return api.request<{ valid: boolean; error?: string; code?: string; discountPercent?: number; baseAmount?: number; finalAmount?: number }>(
      `/promo/check?code=${encodeURIComponent(code)}&months=${months}`
    );
  };

  // ─── E2E Encryption ──────────────────────────────────────────────
  api.uploadKeyBundle = async (data) => {
    return api.request('/e2e/keybundle', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.fetchKeyBundle = async (userId) => {
    return api.request<{ bundles: Array<{ identityKey: string; signedPreKey: string; signedKeySig: string; oneTimePreKeys: string[]; deviceId: string; userId: string }> }>(`/e2e/keybundle/${userId}`);
  };

  api.consumeOneTimePreKey = async (userId) => {
    return api.request<{ oneTimePreKey: string }>(`/e2e/keybundle/${userId}/consume`, { method: 'POST' });
  };

  api.initE2ESession = async (data) => {
    return api.request<{ ok: boolean; sessionId: string; existed: boolean }>('/e2e/session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };
}
