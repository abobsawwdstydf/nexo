import { create } from 'zustand';
import { api } from '../lib/api';

export interface UserSettings {
  defaultChatBackground?: string;
  settingsSyncEnabled: boolean;
  hideStoryViews: boolean;
}

export interface ChatBackground {
  id: string;
  chatId: string;
  userId: string;
  backgroundUrl: string;
  createdAt: string;
  updatedAt: string;
}

interface SettingsStore {
  settings: UserSettings | null;
  chatBackgrounds: Map<string, ChatBackground | null>;
  isLoading: boolean;
  error: string | null;

  // Settings methods
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;

  // Chat background methods
  getChatBackground: (chatId: string) => ChatBackground | null | undefined;
  setChatBackground: (chatId: string, backgroundUrl: string) => Promise<void>;
  removeChatBackground: (chatId: string) => Promise<void>;
  loadChatBackgrounds: () => Promise<void>;
  loadChatBackground: (chatId: string) => Promise<void>;

  // Utility
  setError: (error: string | null) => void;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  chatBackgrounds: new Map(),
  isLoading: false,
  error: null,

  loadSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/users/settings');
      set({ settings: response });
    } catch (error) {
      // Игнорируем 401 ошибки (не авторизован)
      if (error instanceof Error && error.message.includes('401')) {
        set({ isLoading: false });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to load settings';
      set({ error: message });
      console.error('Load settings error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  updateSettings: async (updates: Partial<UserSettings>) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put('/users/settings', updates);
      set((state) => ({
        settings: { ...(state.settings || { settingsSyncEnabled: false, hideStoryViews: false }), ...updates },
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      set({ error: message });
      console.error('Update settings error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  getChatBackground: (chatId: string) => {
    return get().chatBackgrounds.get(chatId);
  },

  loadChatBackground: async (chatId: string) => {
    try {
      const response = await api.get(`/chat-backgrounds/${chatId}`);
      set((state) => {
        const newBackgrounds = new Map(state.chatBackgrounds);
        newBackgrounds.set(chatId, response);
        return { chatBackgrounds: newBackgrounds };
      });
    } catch (error) {
      console.error('Load chat background error:', error);
      // Set null if not found (404)
      set((state) => {
        const newBackgrounds = new Map(state.chatBackgrounds);
        newBackgrounds.set(chatId, null);
        return { chatBackgrounds: newBackgrounds };
      });
    }
  },

  loadChatBackgrounds: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/chat-backgrounds');
      const backgroundsMap = new Map<string, ChatBackground>();
      response.forEach((bg: ChatBackground) => {
        backgroundsMap.set(bg.chatId, bg);
      });
      set({ chatBackgrounds: backgroundsMap });
    } catch (error) {
      // Игнорируем 401 ошибки (не авторизован)
      if (error instanceof Error && error.message.includes('401')) {
        set({ isLoading: false });
        return;
      }
      const message = error instanceof Error ? error.message : 'Failed to load chat backgrounds';
      set({ error: message });
      console.error('Load chat backgrounds error:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  setChatBackground: async (chatId: string, backgroundUrl: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/chat-backgrounds/${chatId}`, { backgroundUrl });
      set((state) => {
        const newBackgrounds = new Map(state.chatBackgrounds);
        newBackgrounds.set(chatId, response);
        return { chatBackgrounds: newBackgrounds };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set chat background';
      set({ error: message });
      console.error('Set chat background error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  removeChatBackground: async (chatId: string) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/chat-backgrounds/${chatId}`);
      set((state) => {
        const newBackgrounds = new Map(state.chatBackgrounds);
        newBackgrounds.delete(chatId);
        return { chatBackgrounds: newBackgrounds };
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove chat background';
      set({ error: message });
      console.error('Remove chat background error:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
