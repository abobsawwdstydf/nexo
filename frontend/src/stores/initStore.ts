import { create } from 'zustand';
import type { Chat, SmartFolder } from '../lib/types';

interface InitData {
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
}

interface InitState extends InitData {
  loaded: boolean;
  setInit: (data: InitData) => void;
  updateChat: (chatId: string, updates: Partial<Chat>) => void;
  removeChat: (chatId: string) => void;
  addChat: (chat: Chat) => void;
  reset: () => void;
}

const defaults: InitData = {
  chats: [],
  settings: {
    notifyAll: true,
    notifyMessages: true,
    notifyCalls: true,
    notifyFriends: true,
    twoFactorEnabled: false,
  },
  smartFolders: [],
  stories: [],
};

export const useInitStore = create<InitState>((set, get) => ({
  ...defaults,
  loaded: false,

  setInit: (data: InitData) => {
    set({
      chats: data.chats ?? [],
      settings: data.settings ?? defaults.settings,
      smartFolders: data.smartFolders ?? [],
      stories: data.stories ?? [],
      loaded: true,
    });
  },

  updateChat: (chatId, updates) => {
    const chats = get().chats.map(c => c.id === chatId ? { ...c, ...updates } : c);
    set({ chats });
  },

  removeChat: (chatId) => {
    set({ chats: get().chats.filter(c => c.id !== chatId) });
  },

  addChat: (chat) => {
    set({ chats: [chat, ...get().chats] });
  },

  reset: () => {
    set({ ...defaults, loaded: false });
  },
}));
