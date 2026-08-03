import { create } from 'zustand';
import { api } from '../lib/api';
import { connectSocket, disconnectSocket, wsRequest, waitForSocketConnected } from '../lib/socket';
import { subscribeToNotifications, unsubscribeFromNotifications } from '../lib/notifications';
import { useInitStore } from './initStore';
import type { User } from '../lib/types';

/** Shape of the /init payload returned by getInit / fetch_init. */
type InitPayload = Awaited<ReturnType<typeof api.getInit>>;

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
    scheduleNotificationSubscribe();
  }

  /** Apply an init payload: persist user, seed init store, connect socket, subscribe. */
  function finishInit(initData: InitPayload, accessToken: string | null) {
    const { user, chats, settings, smartFolders, stories, csrfToken } = initData;
    if (csrfToken) api.setCsrfToken(csrfToken);
    localStorage.setItem('nexo_user', JSON.stringify(user));
    useInitStore.getState().setInit({ chats, settings, smartFolders, stories });
    if (accessToken) {
      connectSocket(accessToken);
    }
    set({ user, isLoading: false });
    scheduleNotificationSubscribe();
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
      const token = localStorage.getItem('nexo_access_token');
      if (!token) {
        set({ isLoading: false });
        return;
      }

      // Try WS first (minimizes HTTP requests)
      try {
        connectSocket(token);
        await waitForSocketConnected(3000);
        const initData = await wsRequest<InitPayload>('fetch_init');
        if (initData.user) {
          finishInit(initData, null);
          return;
        }
      } catch (wsErr) {
        console.warn('[Auth] WS init failed, falling back to HTTP:', wsErr);
      }

      // HTTP fallback
      try {
        const initData = await api.getInit();
        finishInit(initData, token);
      } catch (err) {
        // Expired access token (or transient backend hiccup): try refreshing
        // once before giving up. This keeps users logged in across deploys
        // and page reloads instead of silently wiping the session.
        console.warn('[Auth] HTTP init failed, attempting refresh:', err);
        try {
          const refreshed = await api.doRefresh();
          if (refreshed) {
            const newToken = localStorage.getItem('nexo_access_token');
            const initData = await api.getInit();
            finishInit(initData, newToken);
            return;
          }
        } catch (refreshErr) {
          console.warn('[Auth] Refresh also failed:', refreshErr);
        }

        // Only wipe the session when the refresh token is truly invalid.
        localStorage.removeItem('nexo_user');
        localStorage.removeItem('nexo_access_token');
        localStorage.removeItem('nexo_refresh_token');
        api.setCsrfToken(null);
        disconnectSocket();
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
      scheduleNotificationSubscribe();
    },
  };
});

/** Debounce notification subscription so it never blocks the login/init flow. */
function scheduleNotificationSubscribe() {
  setTimeout(() => {
    subscribeToNotifications().catch(() => {});
  }, 2000);
}

api.setOnAuthFailed(() => {
  const { logout } = useAuthStore.getState();
  logout();
});
