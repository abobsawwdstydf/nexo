import { create } from 'zustand';
import type { Chat } from '../lib/types';

interface ChatStore {
  chats: Chat[];
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chats: [],
  activeChat: null,
  setActiveChat: (id) => set({ activeChat: id }),
}));
