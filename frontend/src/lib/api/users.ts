import type { User, UserPresence } from '../types';
import { ApiClient } from './core';

declare module './core' {
  interface ApiClient {
    searchUsers(query: string): Promise<UserPresence[]>;
    getUser(userId: string): Promise<UserProfileResponse>;
    updateProfile(data: Partial<ProfileUpdate>): Promise<User>;
    getPrivacySettings(): Promise<PrivacySettingsResponse>;
    updatePrivacySettings(data: Partial<PrivacySettingsResponse>): Promise<PrivacySettingsResponse>;
  }
}

export interface PrivacySettingsResponse {
  whoCanMessage: string;
  whoCanCall: string;
  whoCanSeeProfile: string;
  showLastSeen: boolean;
  allowGroupInvites: boolean;
}

export interface CommonChatInfo {
  id: string;
  name: string;
  type: string;
}

export interface ProfileUpdate {
  displayName?: string;
  username?: string;
  bio?: string;
  avatar?: string;
  nameColor?: string;
  nameGradient?: string;
  birthday?: string;
  profileMusic?: string;
}

export interface UserProfileResponse {
  user: User;
  friendship: 'none' | 'pending_sent' | 'pending_received' | 'accepted';
  friendshipId?: string;
  blockedByMe: boolean;
  blockedMe: boolean;
  commonChats: CommonChatInfo[];
}

export function installUsers(api: ApiClient): void {
  // ─── Users ────────────────────────────────────────────────────────
  api.searchUsers = async (query: string) => {
    return api.request<UserPresence[]>(`/users/search?q=${encodeURIComponent(query)}`);
  };

  api.getUser = async (userId: string) => {
    return api.request<UserProfileResponse>(`/users/${userId}`);
  };

  api.updateProfile = async (data: Partial<ProfileUpdate>) => {
    return api.put<User>('/users/me', data);
  };

  api.getPrivacySettings = async () => {
    return api.request<PrivacySettingsResponse>('/users/privacy');
  };

  api.updatePrivacySettings = async (data: Partial<PrivacySettingsResponse>) => {
    return api.put<PrivacySettingsResponse>('/users/privacy', data);
  };
}
