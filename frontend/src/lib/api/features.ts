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
    createPayment(data: { type: 'premium' | 'premium_gift'; premiumMonths: number; giftToUserId?: string }): Promise<{ paymentId: string; confirmationUrl: string; amount: number }>;
    getPremiumPrices(): Promise<{ prices: Record<number, number>; currency: string }>;
    // E2E
    uploadKeyBundle(data: E2EKeyBundleData): Promise<{ ok: boolean }>;
    fetchKeyBundle(userId: string): Promise<{ bundles: E2EKeyBundleResponse[] }>;
    consumeOneTimePreKey(userId: string): Promise<{ oneTimePreKey: string }>;
    initE2ESession(data: { chatId: string; encryptedKey: string }): Promise<{ ok: boolean; sessionId: string; existed: boolean }>;
    getE2ESession(chatId: string): Promise<{ sessionId: string; chatId: string; isActive: boolean; createdAt: string }>;
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

  api.getE2ESession = async (chatId) => {
    return api.request<{ sessionId: string; chatId: string; isActive: boolean; createdAt: string }>(`/e2e/session/${chatId}`);
  };
}
