import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ChatNotificationSettings {
  enabled: boolean;
  sound: boolean;
  vibration: boolean;
  preview: boolean;
}

interface NotificationState {
  defaultSettings: ChatNotificationSettings;
  chatSettings: Record<string, ChatNotificationSettings>;
  getChatSettings: (chatId: string) => ChatNotificationSettings;
  setChatSettings: (chatId: string, settings: Partial<ChatNotificationSettings>) => void;
  resetChatSettings: (chatId: string) => void;
  setDefaultSettings: (settings: Partial<ChatNotificationSettings>) => void;
  isMutedChat: (chatId: string) => boolean;
  shouldNotify: (chatId: string) => boolean;
}

const DEFAULT_SETTINGS: ChatNotificationSettings = {
  enabled: true,
  sound: true,
  vibration: true,
  preview: true,
};

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      defaultSettings: DEFAULT_SETTINGS,
      chatSettings: {},

      getChatSettings: (chatId: string) => {
        return get().chatSettings[chatId] || get().defaultSettings;
      },

      setChatSettings: (chatId, settings) => {
        set((state) => ({
          chatSettings: {
            ...state.chatSettings,
            [chatId]: {
              ...(state.chatSettings[chatId] || state.defaultSettings),
              ...settings,
            },
          },
        }));
      },

      resetChatSettings: (chatId) => {
        set((state) => {
          const { [chatId]: _, ...rest } = state.chatSettings;
          return { chatSettings: rest };
        });
      },

      setDefaultSettings: (settings) => {
        set((state) => ({
          defaultSettings: { ...state.defaultSettings, ...settings },
        }));
      },

      isMutedChat: (chatId) => {
        const s = get().chatSettings[chatId];
        return s ? !s.enabled : !get().defaultSettings.enabled;
      },

      shouldNotify: (chatId) => {
        const s = get().getChatSettings(chatId);
        return s.enabled && s.sound;
      },
    }),
    { name: 'nexo_notifications' }
  )
);
