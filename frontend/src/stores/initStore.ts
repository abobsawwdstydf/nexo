import { create } from 'zustand';
import type { Chat, SmartFolder, StoryGroup, Story } from '../lib/types';

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
  stories: StoryGroup[];
}

interface InitState extends InitData {
  loaded: boolean;
  setInit: (data: InitData) => void;
  addChat: (chat: Chat) => void;
  setStories: (stories: StoryGroup[]) => void;
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
      stories: normalizeStoryGroups(data.stories),
      loaded: true,
    });
  },

  addChat: (chat) => {
    if (get().chats.some(c => c.id === chat.id)) return;
    set({ chats: [chat, ...get().chats] });
  },

  setStories: (stories) => {
    set({ stories });
  },
}));

/**
 * The backend /init and WS fetch_init return story groups as
 * {userId, displayName, avatar, isOnline, stories[]} while the frontend
 * renders {user: UserBasic, stories, hasUnviewed}. Normalize once here so
 * StoriesBar/Viewer never crash on missing `group.user`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeStoryGroups(raw: unknown): StoryGroup[] {
  if (!Array.isArray(raw)) return [];
  return raw
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((g: any) => {
      const user = g.user;
      return {
        user: user
          ? { id: user.id, username: user.username ?? '', displayName: user.displayName ?? '', avatar: user.avatar ?? null }
          : { id: g.userId ?? '', username: g.username ?? '', displayName: g.displayName ?? '', avatar: g.avatar ?? null },
        stories: normalizeStories(g.stories),
        hasUnviewed: !!g.hasUnviewed,
      };
    })
    .filter((g: StoryGroup) => g.user.id && g.stories.length > 0);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeStories(raw: unknown): Story[] {
  if (!Array.isArray(raw)) return [];
  return raw
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((s: any): Story => ({
      id: s.id ?? '',
      type: s.type ?? 'text',
      mediaUrl: s.mediaUrl ?? null,
      content: s.content ?? null,
      bgColor: s.bgColor ?? null,
      createdAt: s.createdAt ?? new Date().toISOString(),
      expiresAt: s.expiresAt ?? '',
      viewCount: s.viewCount ?? 0,
      viewed: !!s.viewed,
    }))
    .filter((s: Story) => s.id);
}
