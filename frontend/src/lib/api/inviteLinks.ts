import { ApiClient } from './core';

export interface InviteLink {
  id: string;
  chatId: string;
  code: string;
  createdBy: string;
  expiresAt?: string;
  maxUses: number;
  uses: number;
  active: boolean;
  createdAt: string;
}

export interface InviteChatInfo {
  id: string;
  name: string;
  avatar: string;
  type: string;
  customIcon: string;
  customColor: string;
  memberCount: number;
  rules: string;
}

declare module './core' {
  interface ApiClient {
    createInviteLink(chatId: string, opts?: { maxUses?: number; expiresInSeconds?: number }): Promise<InviteLink>;
    getInviteLinks(chatId: string): Promise<InviteLink[]>;
    revokeInviteLink(chatId: string, code: string): Promise<{ ok: boolean }>;
    getInviteInfo(code: string): Promise<{ code: string; chat: InviteChatInfo }>;
    joinInvite(code: string): Promise<{ chatId: string; alreadyMember: boolean }>;
  }
}

export function installInviteLinks(api: ApiClient): void {
  api.createInviteLink = async (chatId, opts) => {
    return api.request<InviteLink>(`/chats/${chatId}/invite-links`, {
      method: 'POST',
      body: JSON.stringify({ maxUses: opts?.maxUses ?? 0, expiresInSeconds: opts?.expiresInSeconds ?? 0 }),
    });
  };

  api.getInviteLinks = async (chatId) => {
    return api.request<InviteLink[]>(`/chats/${chatId}/invite-links`);
  };

  api.revokeInviteLink = async (chatId, code) => {
    return api.request<{ ok: boolean }>(`/chats/${chatId}/invite-links/${code}`, {
      method: 'DELETE',
    });
  };

  api.getInviteInfo = async (code) => {
    return api.request<{ code: string; chat: InviteChatInfo }>(`/invite/${code}`);
  };

  api.joinInvite = async (code) => {
    return api.request<{ chatId: string; alreadyMember: boolean }>(`/invite/${code}/join`, {
      method: 'POST',
    });
  };
}