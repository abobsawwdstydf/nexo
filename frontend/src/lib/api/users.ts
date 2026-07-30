import type { User, UserPresence, UserXP, Chat, Message, Achievement, UserAchievement } from '../types';
import { ApiClient, getApiBase } from './core';

declare module './core' {
  interface ApiClient {
    searchUsers(query: string): Promise<UserPresence[]>;
    searchChannels(query: string): Promise<Chat[]>;
    getUser(id: string): Promise<User>;
    updateProfile(data: { displayName?: string; bio?: string; username?: string }): Promise<User>;
    uploadAvatar(file: File): Promise<User>;
    removeAvatar(): Promise<User>;
    searchMessages(query: string, chatId?: string): Promise<Message[]>;
    updateSettings(data: { hideStoryViews?: boolean }): Promise<User>;
    getUserSettings(): Promise<{
      defaultChatBackground: string | null;
      settingsSyncEnabled: boolean;
      hideStoryViews: boolean;
      ringtone: string | null;
    }>;
    updateUserSettings(settings: {
      defaultChatBackground?: string | null;
      settingsSyncEnabled?: boolean;
      hideStoryViews?: boolean;
      ringtone?: string | null;
    }): Promise<User>;
    getNotificationSettings(): Promise<{
      notifyAll: boolean;
      notifyMessages: boolean;
      notifyCalls: boolean;
      notifyFriends: boolean;
    }>;
    updateNotificationSettings(settings: {
      notifyAll?: boolean;
      notifyMessages?: boolean;
      notifyCalls?: boolean;
      notifyFriends?: boolean;
    }): Promise<any>;
    getDevices(): Promise<Array<{
      id: string;
      deviceName: string;
      browser: string;
      os: string;
      ip: string;
      location: string;
      lastActive: string;
      isCurrent: boolean;
      addedAt: string;
    }>>;
    terminateDevice(deviceId: string): Promise<{ success: boolean }>;
    terminateAllDevices(): Promise<{ success: boolean; count: number }>;
    saveWebPushSubscription(subscription: PushSubscription): Promise<{ success: boolean }>;
    getUserChannels(userId: string): Promise<Chat[]>;
    pinChannel(channelId: string): Promise<User>;
    unpinChannel(): Promise<User>;
    getChannelAnalytics(channelId: string): Promise<{
      subscribers: number;
      totalViews: number;
      posts: number;
      recentPosts: Array<{
        id: string;
        content: string | null;
        createdAt: string;
        viewCount: number;
        reactions: number;
      }>;
      topPosts: Array<{
        id: string;
        content: string | null;
        createdAt: string;
        viewCount: number;
        reactions: number;
      }>;
    }>;
    markPostViewed(messageId: string): Promise<{ viewCount: number }>;
    getUserStatus(userId: string): Promise<Record<string, unknown>>;
    setUserStatus(text: string, emoji?: string, duration?: number): Promise<{ success: boolean }>;
    deleteUserStatus(): Promise<{ success: boolean }>;
    getFriendStatuses(): Promise<Record<string, unknown>>;
    getUserXP(): Promise<{
      userXP: UserXP;
      level: number;
      nextLevelXP: number;
      achievements: Achievement[];
      userAchievements: UserAchievement[];
    }>;
    getLeaderboard(page?: number): Promise<{ items: Array<{ userId: string; totalXP: number; level: number; user: UserPresence }>; page: number }>;
  }
}

export function installUsers(api: ApiClient): void {
  // ─── Users ────────────────────────────────────────────────────────
  api.searchUsers = async (query: string) => {
    return api.request<UserPresence[]>(`/users/search?q=${encodeURIComponent(query)}`);
  };

  api.searchChannels = async (query: string) => {
    return api.request<Chat[]>(`/users/channels/search?q=${encodeURIComponent(query)}`);
  };

  api.getUser = async (id: string) => {
    return api.request<User>(`/users/${id}`);
  };

  api.updateProfile = async (data) => {
    return api.request<User>('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  api.uploadAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append('avatar', file);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    const storedToken = api.getStoredAccessToken();
    const response = await fetch(`${getApiBase()}/users/avatar`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        ...(storedToken ? { 'Authorization': `Bearer ${storedToken}` } : {}),
      },
      body: formData,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error('Ошибка загрузки аватара');
    return response.json() as Promise<User>;
  };

  api.removeAvatar = async () => {
    return api.request<User>('/users/avatar', { method: 'DELETE' });
  };

  api.searchMessages = async (query: string, chatId?: string) => {
    const params = new URLSearchParams({ q: query });
    if (chatId) params.append('chatId', chatId);
    return api.request<Message[]>(`/users/messages/search?${params}`);
  };

  // ─── User Settings ────────────────────────────────────────────────
  api.updateSettings = async (data) => {
    return api.request<User>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  };

  api.getUserSettings = async () => {
    return api.request<{
      defaultChatBackground: string | null;
      settingsSyncEnabled: boolean;
      hideStoryViews: boolean;
      ringtone: string | null;
    }>('/users/settings');
  };

  api.updateUserSettings = async (settings) => {
    return api.request<User>('/users/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  };

  // ─── Notifications ────────────────────────────────────────────────
  api.getNotificationSettings = async () => {
    return api.request<{
      notifyAll: boolean;
      notifyMessages: boolean;
      notifyCalls: boolean;
      notifyFriends: boolean;
    }>('/users/notifications');
  };

  api.updateNotificationSettings = async (settings) => {
    return api.request('/users/notifications', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  };

  // ─── Devices ──────────────────────────────────────────────────────
  api.getDevices = async () => {
    return api.request<Array<{
      id: string;
      deviceName: string;
      browser: string;
      os: string;
      ip: string;
      location: string;
      lastActive: string;
      isCurrent: boolean;
      addedAt: string;
    }>>('/devices');
  };

  api.terminateDevice = async (deviceId: string) => {
    return api.request<{ success: boolean }>(`/devices/${deviceId}`, {
      method: 'DELETE',
    });
  };

  api.terminateAllDevices = async () => {
    return api.request<{ success: boolean; count: number }>('/devices/terminate-all', {
      method: 'POST',
    });
  };

  // ─── Push / Channels ──────────────────────────────────────────────
  api.saveWebPushSubscription = async (subscription: PushSubscription) => {
    return api.request<{ success: boolean }>('/users/push-subscription', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    });
  };

  api.getUserChannels = async (userId: string) => {
    return api.request<Chat[]>(`/users/${userId}/channels`);
  };

  api.pinChannel = async (channelId: string) => {
    return api.request<User>('/users/pin-channel', {
      method: 'PUT',
      body: JSON.stringify({ channelId }),
    });
  };

  api.unpinChannel = async () => {
    return api.request<User>('/users/pin-channel', {
      method: 'DELETE',
    });
  };

  api.getChannelAnalytics = async (channelId: string) => {
    return api.request<{
      subscribers: number;
      totalViews: number;
      posts: number;
      recentPosts: Array<{
        id: string;
        content: string | null;
        createdAt: string;
        viewCount: number;
        reactions: number;
      }>;
      topPosts: Array<{
        id: string;
        content: string | null;
        createdAt: string;
        viewCount: number;
        reactions: number;
      }>;
    }>(`/chats/${channelId}/analytics`);
  };

  api.markPostViewed = async (messageId: string) => {
    return api.request<{ viewCount: number }>(`/messages/${messageId}/view`, {
      method: 'POST',
    });
  };

  // ─── User Status ──────────────────────────────────────────────────
  api.getUserStatus = async (userId: string) => {
    return api.request(`/user-status/${userId}`);
  };

  api.setUserStatus = async (text: string, emoji?: string, duration?: number) => {
    return api.request('/user-status', {
      method: 'POST',
      body: JSON.stringify({ text, emoji, duration }),
    });
  };

  api.deleteUserStatus = async () => {
    return api.request('/user-status', { method: 'DELETE' });
  };

  api.getFriendStatuses = async () => {
    return api.request('/user-status/friends/all');
  };

  // ─── Gamification ─────────────────────────────────────────────────
  api.getUserXP = async () => {
    return api.request<{
      userXP: UserXP;
      level: number;
      nextLevelXP: number;
      achievements: Achievement[];
      userAchievements: UserAchievement[];
    }>('/gamification/xp');
  };

  api.getLeaderboard = async (page?: number) => {
    return api.request<{ items: Array<{ userId: string; totalXP: number; level: number; user: UserPresence }>; page: number }>(
      `/gamification/leaderboard?page=${page || 1}`
    );
  };
}
