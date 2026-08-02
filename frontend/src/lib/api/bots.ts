import type { ReplyMarkup } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    botCallback(chatId: string, messageId: string, callbackData: string, chatInstance?: string): Promise<any>;
    sendBotCommand(chatId: string, command: string): Promise<any>;
    getUserAliases(): Promise<any[]>;
    createUserAlias(alias: string): Promise<any>;
    deleteUserAlias(aliasId: string): Promise<any>;
  }
}

export function installBots(api: ApiClient): void {
  // Нажатие inline-кнопки бота (callback_data)
  api.botCallback = async (chatId: string, messageId: string, callbackData: string, chatInstance?: string) => {
    return api.request('/bots/callback', {
      method: 'POST',
      body: JSON.stringify({
        chatId,
        messageId,
        callbackData,
        chatInstance: chatInstance || '',
      }),
    });
  };

  api.sendBotCommand = async (chatId: string, command: string) => {
    return api.request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content: command, type: 'text' }),
    });
  };

  api.getUserAliases = async () => {
    return api.request<any[]>('/users/me/aliases');
  };

  api.createUserAlias = async (alias: string) => {
    return api.request<any>('/users/me/aliases', {
      method: 'POST',
      body: JSON.stringify({ alias }),
    });
  };

  api.deleteUserAlias = async (aliasId: string) => {
    return api.request(`/users/me/aliases/${aliasId}`, {
      method: 'DELETE',
    });
  };
}

