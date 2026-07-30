import { create } from 'zustand';
import type { Chat } from '../lib/types';

interface ChatStore {
  chats: Chat[];
  chatsMap: Record<string, Chat>;
  activeChat: string | null;
  loading: boolean;
  error: string | null;
  lastFetchAt: number | null;
  setActiveChat: (id: string | null) => void;
  setChats: (chats: Chat[]) => void;
  addOrUpdateChat: (chat: Chat) => void;
  removeChat: (id: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  getChat: (id: string) => Chat | undefined;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  chats: [],
  chatsMap: {},
  activeChat: null,
  loading: false,
  error: null,
  lastFetchAt: null,
  setActiveChat: (id) => set({ activeChat: id }),
  setChats: (chats) => {
    const chatsMap: Record<string, Chat> = {};
    for (const chat of chats) {
      chatsMap[chat.id] = chat;
    }
    set({ chats, chatsMap, lastFetchAt: Date.now() });
  },
  addOrUpdateChat: (chat) => {
    const state = get();
    const existing = state.chats.findIndex(c => c.id === chat.id);
    let newChats: Chat[];
    if (existing >= 0) {
      newChats = [...state.chats];
      newChats[existing] = chat;
    } else {
      newChats = [chat, ...state.chats];
    }
    set({
      chats: newChats,
      chatsMap: { ...state.chatsMap, [chat.id]: chat },
    });
  },
  removeChat: (id) => {
    const state = get();
    const { [id]: _, ...rest } = state.chatsMap;
    set({
      chats: state.chats.filter(c => c.id !== id),
      chatsMap: rest,
    });
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  getChat: (id) => get().chatsMap[id],
}));
