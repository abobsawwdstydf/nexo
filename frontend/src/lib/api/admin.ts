import { ApiClient } from './core';

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

declare module './core' {
  interface ApiClient {
    getAdminReports(): Promise<AdminReport[]>;
    getAdminFeedback(): Promise<AdminFeedbackTicket[]>;
    adminReplyFeedback(chatId: string, content: string): Promise<{ ok: boolean }>;
    adminSetBadge(input: BadgeInput): Promise<{ ok: boolean }>;
    adminClearBadge(targetId: string): Promise<{ ok: boolean }>;
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
}