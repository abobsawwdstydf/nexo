import type { User, Chat, SmartFolder } from '../types';
import { ApiClient, getApiBase } from './core';

declare module './core' {
  interface ApiClient {
    sendLoginCode(email: string): Promise<{ requiresCode: boolean; expiresAt?: string }>;
    loginConfirm(email: string, code: string): Promise<{ user: User; accessToken?: string; refreshToken?: string; csrfToken?: string }>;
    sendEmailCode(email: string): Promise<{ success: boolean; expiresAt: string }>;
    confirmEmailCode(email: string, code: string): Promise<{ success: boolean; email: string }>;
    register(data: {
      username: string;
      displayName?: string;
      email: string;
      bio?: string;
      avatar?: File;
    }): Promise<{ accessToken?: string; refreshToken?: string; csrfToken?: string; user: User }>;
    checkUsername(username: string): Promise<{ available: boolean; reason?: string }>;
    checkEmail(email: string): Promise<{ available: boolean; message?: string }>;
    getMe(): Promise<{ user: User; accessToken?: string; csrfToken?: string }>;
    getInit(): Promise<{
      user: User;
      chats: Chat[];
      settings: {
        notifyAll: boolean;
        notifyMessages: boolean;
        notifyCalls: boolean;
        notifyFriends: boolean;
        twoFactorEnabled: boolean;
      };
      smartFolders: SmartFolder[];
      stories: any[];
    }>;
    logout(): Promise<{ success: boolean }>;
  }
}

export function installAuth(api: ApiClient): void {
  api.sendLoginCode = async (email: string) => {
    return api.request<{ requiresCode: boolean; expiresAt?: string }>('/auth/login/code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  };

  api.loginConfirm = async (email: string, code: string) => {
    return api.request<{ user: User; accessToken?: string; refreshToken?: string; csrfToken?: string }>('/auth/login/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  };

  api.sendEmailCode = async (email: string) => {
    return api.request<{ success: boolean; expiresAt: string }>('/auth/email/send-code', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  };

  api.confirmEmailCode = async (email: string, code: string) => {
    return api.request<{ success: boolean; email: string }>('/auth/email/confirm', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  };

  api.register = async (data) => {
    const formData = new FormData();
    formData.append('username', data.username);
    if (data.displayName) formData.append('displayName', data.displayName);
    formData.append('email', data.email);
    if (data.bio) formData.append('bio', data.bio);
    if (data.avatar) formData.append('avatar', data.avatar);

    const response = await fetch(`${getApiBase()}/auth/register`, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Ошибка сервера' }));
      throw new Error(error.error || 'Ошибка регистрации');
    }

    const result = await response.json();
    if (result.csrfToken) {
      api.csrfToken = result.csrfToken;
    }
    return result as {
      accessToken?: string;
      refreshToken?: string;
      csrfToken?: string;
      user: User;
    };
  };

  api.checkUsername = async (username: string) => {
    return api.request<{ available: boolean; reason?: string }>(`/auth/check-username?username=${encodeURIComponent(username)}`);
  };

  api.checkEmail = async (email: string) => {
    return api.request<{ available: boolean; message?: string }>(`/auth/check-email?email=${encodeURIComponent(email)}`);
  };

  api.getMe = async () => {
    return api.request<{ user: User; accessToken?: string; csrfToken?: string }>('/users/me');
  };

  api.getInit = async () => {
    return api.request<{
      user: User;
      chats: Chat[];
      settings: {
        notifyAll: boolean;
        notifyMessages: boolean;
        notifyCalls: boolean;
        notifyFriends: boolean;
        twoFactorEnabled: boolean;
      };
      smartFolders: SmartFolder[];
      stories: any[];
    }>('/init');
  };

  api.logout = async () => {
    return api.request<{ success: boolean }>('/auth/logout', { method: 'POST' });
  };
}
