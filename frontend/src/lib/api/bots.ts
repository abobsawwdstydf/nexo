import type { UserAlias } from '../types';
import { ApiClient } from './core';

export interface BotInfo {
  id: string;
  name: string;
  username: string;
  ownerId: string;
  description: string;
  avatar: string;
  webhookUrl: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  commands?: BotCommandInfo[];
}

export interface BotCommandInfo {
  id: string;
  botId: string;
  command: string;
  description: string;
  response: string;
  handlerUrl: string;
  isActive: boolean;
}

export interface InlineBotResult {
  type?: string;
  id: string;
  title?: string;
  description?: string;
  input_message_content?: {
    message_text?: string;
    parse_mode?: string;
  };
  [key: string]: unknown;
}

export interface InlineBotResponse {
  ok: boolean;
  results: InlineBotResult[];
  inline_query_id: string;
}

export interface InlineBotResultResponse {
  ok: boolean;
  result: InlineBotResult;
}

declare module './core' {
  interface ApiClient {
    botCallback(chatId: string, messageId: string, callbackData: string, chatInstance?: string): Promise<{ ok: boolean }>;
    getUserAliases(): Promise<UserAlias[]>;
    createUserAlias(alias: string): Promise<UserAlias>;
    deleteUserAlias(aliasId: string): Promise<{ ok: boolean }>;
    // ─── Inline-режим ──────────────────────────────────────────────────
    botsInline(botUsername: string, query: string): Promise<InlineBotResponse>;
    botsInlineResult(inlineQueryId: string, resultId: string): Promise<InlineBotResultResponse>;
    // BotFather
    createBot(data: { name: string; description?: string; avatar?: string; webhookUrl?: string }): Promise<BotInfo & { token: string }>;
    getBots(): Promise<BotInfo[]>;
    getBot(botId: string): Promise<BotInfo>;
    updateBot(botId: string, data: { name?: string; description?: string; avatar?: string; webhookUrl?: string; isActive?: boolean }): Promise<BotInfo>;
    deleteBot(botId: string): Promise<{ ok: boolean }>;
    regenerateBotToken(botId: string): Promise<{ token: string }>;
    addBotCommand(botId: string, data: { command: string; description?: string; response?: string; handlerUrl?: string }): Promise<BotCommandInfo>;
    getBotCommands(botId: string): Promise<BotCommandInfo[]>;
    deleteBotCommand(botId: string, cmdId: string): Promise<{ ok: boolean }>;
    installBot(botId: string, chatId: string): Promise<unknown>;
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

  // ─── Inline-режим ────────────────────────────────────────────────────
  api.botsInline = async (botUsername: string, query: string) => {
    return api.request<InlineBotResponse>('/bots/inline', {
      method: 'POST',
      body: JSON.stringify({ botUsername, query }),
    });
  };

  api.botsInlineResult = async (inlineQueryId: string, resultId: string) => {
    return api.request<InlineBotResultResponse>('/bots/inline/result', {
      method: 'POST',
      body: JSON.stringify({ inlineQueryId, resultId }),
    });
  };

  // ─── BotFather ───────────────────────────────────────────────────────
  api.createBot = async (data) => {
    return api.request<BotInfo & { token: string }>('/bots', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.getBots = async () => {
    return api.request<BotInfo[]>('/bots');
  };

  api.getBot = async (botId) => {
    return api.request<BotInfo>(`/bots/${botId}`);
  };

  api.updateBot = async (botId, data) => {
    return api.request<BotInfo>(`/bots/${botId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  api.deleteBot = async (botId) => {
    return api.request<{ ok: boolean }>(`/bots/${botId}`, { method: 'DELETE' });
  };

  api.regenerateBotToken = async (botId) => {
    return api.request<{ token: string }>(`/bots/${botId}/regenerate-token`, { method: 'POST' });
  };

  api.addBotCommand = async (botId, data) => {
    return api.request<BotCommandInfo>(`/bots/${botId}/commands`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  };

  api.getBotCommands = async (botId) => {
    return api.request<BotCommandInfo[]>(`/bots/${botId}/commands`);
  };

  api.deleteBotCommand = async (botId, cmdId) => {
    return api.request<{ ok: boolean }>(`/bots/${botId}/commands/${cmdId}`, { method: 'DELETE' });
  };

  api.installBot = async (botId, chatId) => {
    return api.request(`/bots/${botId}/install`, {
      method: 'POST',
      body: JSON.stringify({ chatId }),
    });
  };
}

