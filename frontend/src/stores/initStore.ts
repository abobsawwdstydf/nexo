import { create } from 'zustand';
import type { Chat, SmartFolder, StoryGroup, Story } from '../lib/types';

export interface DndSettings {
  enabled: boolean;
  start: string;
  end: string;
  timezoneOffsetMin?: number;
}

export interface AppSettings {
  notifyAll: boolean;
  notifyMessages: boolean;
  notifyCalls: boolean;
  notifyFriends: boolean;
  twoFactorEnabled: boolean;
  dnd: DndSettings;
  mutedChatIds: string[];
}

interface InitData {
  chats: Chat[];
  settings: Partial<AppSettings>;
  smartFolders: SmartFolder[];
  stories: StoryGroup[];
}

interface InitState extends InitData {
  loaded: boolean;
  setInit: (data: InitData) => void;
  addChat: (chat: Chat) => void;
  setStories: (stories: StoryGroup[]) => void;
  updateSettings: (patch: Partial<AppSettings>) => void;
  setChatMuted: (chatId: string, muted: boolean) => void;
}

const defaultSettings: AppSettings = {
  notifyAll: true,
  notifyMessages: true,
  notifyCalls: true,
  notifyFriends: true,
  twoFactorEnabled: false,
  dnd: { enabled: false, start: '22:00', end: '08:00', timezoneOffsetMin: 0 },
  mutedChatIds: [],
};

const defaults: InitData = {
  chats: [],
  settings: defaultSettings,
  smartFolders: [],
  stories: [],
};

export const useInitStore = create<InitState>((set, get) => ({
  ...defaults,
  loaded: false,

  setInit: (data: InitData) => {
    set({
      chats: data.chats ?? [],
      settings: mergeSettings(data.settings, defaultSettings),
      smartFolders: data.smartFolders ?? [],
      stories: normalizeStoryGroups(data.stories),
      loaded: true,
    });
  },

  updateSettings: (patch) => {
    set({ settings: { ...get().settings, ...patch } });
  },

  setChatMuted: (chatId, muted) => {
    const mutedChatIds = get().settings.mutedChatIds ?? [];
    const next = muted
      ? (mutedChatIds.includes(chatId) ? mutedChatIds : [...mutedChatIds, chatId])
      : mutedChatIds.filter(id => id !== chatId);
    set({ settings: { ...get().settings, mutedChatIds: next } });
  },

  addChat: (chat) => {
    if (get().chats.some(c => c.id === chat.id)) return;
    set({ chats: [chat, ...get().chats] });
  },

  setStories: (stories) => {
    set({ stories });
  },
}));

function mergeSettings(raw: Partial<AppSettings> | undefined, fallback: AppSettings): AppSettings {
  if (!raw) return fallback;
  return {
    notifyAll: raw.notifyAll ?? fallback.notifyAll,
    notifyMessages: raw.notifyMessages ?? fallback.notifyMessages,
    notifyCalls: raw.notifyCalls ?? fallback.notifyCalls,
    notifyFriends: raw.notifyFriends ?? fallback.notifyFriends,
    twoFactorEnabled: raw.twoFactorEnabled ?? fallback.twoFactorEnabled,
    dnd: { ...fallback.dnd, ...(raw.dnd ?? {}) },
    mutedChatIds: Array.isArray(raw.mutedChatIds) ? raw.mutedChatIds : [],
  };
}

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
