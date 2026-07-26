import { create } from 'zustand';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { subscribeToNotifications, unsubscribeFromNotifications } from '../lib/notifications';
import { useChatStore } from './chatStore';
import { useSettingsStore } from './settingsStore';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isPremium: () => boolean;
  sendLoginCode: (email: string) => Promise<{ requiresCode: boolean; expiresAt?: string }>;
  loginConfirm: (email: string, code: string) => Promise<void>;
  register: (data: {
    username: string;
    displayName?: string;
    email: string;
    bio?: string;
    avatar?: File;
  }) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  loginWithToken: (token: string, user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => {
  let savedUser: User | null = null;
  try {
    const savedUserStr = localStorage.getItem('nexo_user');
    if (savedUserStr) {
      savedUser = JSON.parse(savedUserStr);
    }
  } catch (e) {
    console.error('Failed to load user from localStorage:', e);
  }

  /** Common post-login flow: persist tokens, connect socket, subscribe. */
  function completeLogin(result: { csrfToken?: string; user: User; accessToken?: string; refreshToken?: string }) {
    if (result.csrfToken) api.setCsrfToken(result.csrfToken);
    localStorage.setItem('nexo_user', JSON.stringify(result.user));
    if (result.accessToken) {
      localStorage.setItem('nexo_access_token', result.accessToken);
    }
    if (result.refreshToken) {
      localStorage.setItem('nexo_refresh_token', result.refreshToken);
    }
    if (result.accessToken) {
      connectSocket(result.accessToken);
    }
    set({ user: result.user, isLoading: false });
    setTimeout(() => {
      subscribeToNotifications().catch(() => {});
    }, 2000);
  }

  return {
    user: savedUser,
    isLoading: true,
    error: null,

    isPremium: () => {
      const user = get().user;
      if (!user || !user.isPremium || !user.premiumUntil) return false;
      return new Date(user.premiumUntil) > new Date();
    },

    sendLoginCode: async (email) => {
      try {
        set({ error: null });
        const result = await api.sendLoginCode(email);
        return result;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg });
        throw err;
      }
    },

    loginConfirm: async (email, code) => {
      try {
        set({ error: null, isLoading: true, user: null });
        localStorage.removeItem('nexo_access_token');
        localStorage.removeItem('nexo_refresh_token');
        const result = await api.loginConfirm(email, code);
        completeLogin(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg, isLoading: false });
        throw err;
      }
    },

    register: async (data) => {
      try {
        set({ error: null, isLoading: true, user: null });
        localStorage.removeItem('nexo_access_token');
        localStorage.removeItem('nexo_refresh_token');
        const result = await api.register(data);
        completeLogin(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg, isLoading: false });
        throw err;
      }
    },

    logout: () => {
      localStorage.removeItem('nexo_user');
      localStorage.removeItem('nexo_access_token');
      localStorage.removeItem('nexo_refresh_token');
      api.setCsrfToken(null);
      api.logout().catch(() => {});
      disconnectSocket();
      unsubscribeFromNotifications().catch(() => {});
      set({ user: null });
    },

    checkAuth: async () => {
      try {
        const initData = await api.getInit();
        const { user } = initData;
        localStorage.setItem('nexo_user', JSON.stringify(user));
        // Always reconnect WS after successful auth
        const token = localStorage.getItem('nexo_access_token');
        if (token) {
          connectSocket(token);
        }
        set({ user, isLoading: false });

        // Post-success operations — isolated from auth so data errors
        // don't trigger logout (api.request() already handled refresh)
        try {
          useChatStore.getState().setChatsFromInit(initData.chats);
          useSettingsStore.getState().setSettingsFromInit(initData.settings);
        } catch (e) {
          console.error('Failed to load init data:', e);
        }

        setTimeout(() => {
          subscribeToNotifications().catch(() => {});
        }, 2000);
      } catch (err) {
        // api.request() already attempted refresh+retry internally.
        // If we're here, both the original request AND the refresh
        // retry failed — session is genuinely gone.
        localStorage.removeItem('nexo_user');
        localStorage.removeItem('nexo_access_token');
        localStorage.removeItem('nexo_refresh_token');
        set({ user: null, isLoading: false });
      }
    },

    updateUser: (data) => {
      const currentUser = get().user;
      if (currentUser) {
        const updatedUser = { ...currentUser, ...data };
        set({ user: updatedUser });
        try {
          localStorage.setItem('nexo_user', JSON.stringify(updatedUser));
        } catch (e) {
          console.error('Failed to save user to localStorage:', e);
        }
      }
    },

    loginWithToken: (token, user) => {
      localStorage.setItem('nexo_user', JSON.stringify(user));
      if (token) {
        localStorage.setItem('nexo_access_token', token);
        connectSocket(token);
      }
      set({ user });
      setTimeout(() => {
        subscribeToNotifications().catch(() => {});
      }, 2000);
    },
  };
});

api.setOnAuthFailed(() => {
  const { logout } = useAuthStore.getState();
  logout();
});
