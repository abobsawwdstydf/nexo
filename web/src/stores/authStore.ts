import { create } from 'zustand';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import { subscribeToNotifications } from '../lib/notifications';
import type { User } from '../lib/types';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  error: string | null;
  isPremium: () => boolean;
  login: (email: string, password: string) => Promise<{ requiresCode: boolean; expiresAt?: string }>;
  loginConfirm: (email: string, code: string) => Promise<void>;
  register: (data: {
    username: string;
    displayName?: string;
    password: string;
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

  return {
    user: savedUser,
    isLoading: true,
    error: null,

    isPremium: () => {
      const user = get().user;
      if (!user || !user.isPremium || !user.premiumUntil) return false;
      return new Date(user.premiumUntil) > new Date();
    },

    login: async (email, password) => {
      try {
        set({ error: null });
        const result = await api.login(email, password);
        // Returns { requiresCode: true, expiresAt } — code was sent
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
        const result = await api.loginConfirm(email, code);
        if (result.csrfToken) api.setCsrfToken(result.csrfToken);
        localStorage.setItem('nexo_user', JSON.stringify(result.user));
        if (result.accessToken) {
          localStorage.setItem('nexo_access_token', result.accessToken);
          connectSocket(result.accessToken);
        }
        set({ user: result.user, isLoading: false });

        setTimeout(() => {
          subscribeToNotifications().catch(() => {});
        }, 2000);
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
        const result = await api.register(data);
        if (result.csrfToken) api.setCsrfToken(result.csrfToken);
        localStorage.setItem('nexo_user', JSON.stringify(result.user));
        if (result.accessToken) {
          localStorage.setItem('nexo_access_token', result.accessToken);
          connectSocket(result.accessToken);
        }
        set({ user: result.user, isLoading: false });

        setTimeout(() => {
          subscribeToNotifications().catch(() => {});
        }, 2000);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        set({ error: msg, isLoading: false });
        throw err;
      }
    },

    logout: () => {
      localStorage.removeItem('nexo_user');
      localStorage.removeItem('nexo_access_token');
      api.setCsrfToken(null);
      api.logout().catch(() => {});
      disconnectSocket();
      import('../lib/notifications').then(m => m.unsubscribeFromNotifications().catch(() => {}));
      set({ user: null });
    },

    checkAuth: async () => {
      try {
        const { user, accessToken } = await api.getMe();
        localStorage.setItem('nexo_user', JSON.stringify(user));
        if (accessToken) {
          localStorage.setItem('nexo_access_token', accessToken);
          connectSocket(accessToken);
        }
        set({ user, isLoading: false });

        setTimeout(() => {
          import('../lib/notifications').then(m => m.subscribeToNotifications().catch(() => {}));
        }, 2000);
      } catch (err) {
        localStorage.removeItem('nexo_user');
        localStorage.removeItem('nexo_access_token');
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
        import('../lib/notifications').then(m => m.subscribeToNotifications().catch(() => {}));
      }, 2000);
    },
  };
});

api.setOnAuthFailed(() => {
  const { logout } = useAuthStore.getState();
  logout();
});
