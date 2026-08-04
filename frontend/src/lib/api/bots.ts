import type { UserAlias } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    botCallback(chatId: string, messageId: string, callbackData: string, chatInstance?: string): Promise<{ ok: boolean }>;
    getUserAliases(): Promise<UserAlias[]>;
    createUserAlias(alias: string): Promise<UserAlias>;
    deleteUserAlias(aliasId: string): Promise<{ ok: boolean }>;
  }
}

export function installBots(api: ApiClient): void {
  // Нажатие inline-кнопки бота (callback_data)
  api.botCallback = async (chatId: string, messageId: string, callbackData: string, chatInstance?: string) => {
    return api.request<{ ok: boolean }>('/bots/callback', {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        messageId,
        callbackData,
        chatInstance: chatInstance || '',
      }),
    });
  };

  api.getUserAliases = async () => {
    return api.request<UserAlias[]>('/users/me/aliases');
  };

  api.createUserAlias = async (alias: string) => {
    return api.request<UserAlias>('/users/me/aliases', {
      method: 'POST',
      body: JSON.stringify({ alias }),
    });
  };

  api.deleteUserAlias = async (aliasId: string) => {
    return api.request<{ ok: boolean }>(`/users/me/aliases/${aliasId}`, {
      method: 'DELETE',
    });
  };
}

