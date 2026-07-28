import { create } from 'zustand';

interface ChatStore {
  chats: any[];
  activeChat: string | null;
  setActiveChat: (id: string | null) => void;
}

export const useChatStore = create<ChatStore>((set) => ({
  chats: [],
  activeChat: null,
  setActiveChat: (id) => set({ activeChat: id }),
}));
