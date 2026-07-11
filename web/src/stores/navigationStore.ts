import { create } from 'zustand';

interface NavigationState {
  currentView: 'chat' | 'wall' | 'friends' | 'profile' | 'hashtag' | 'ai';
  previousView: NavigationState['currentView'] | null;
  profileUserId: string | null;
  sidebarProfileUserId: string | null;
  hashtagTag: string | null;
  highlightPostId: string | null;
  showAI: boolean;
  showNewChat: boolean;
  showFriends: boolean;
  showChannelProfile: boolean;
  showChannelStudio: boolean;
  activeThreadId: string | null;
  channelProfileId: string | null;
  channelStudioId: string | null;

  navigateTo: (view: NavigationState['currentView']) => void;
  openProfile: (userId: string) => void;
  openSidebarProfile: (userId: string) => void;
  closeSidebarProfile: () => void;
  openHashtag: (tag: string) => void;
  openWallPost: (postId: string) => void;
  openAI: () => void;
  closeAI: () => void;
  openNewChat: () => void;
  closeNewChat: () => void;
  openFriends: () => void;
  closeFriends: () => void;
  openChannelProfile: (channelId: string) => void;
  closeChannelProfile: () => void;
  openChannelStudio: (channelId: string) => void;
  closeChannelStudio: () => void;
  openThread: (threadId: string) => void;
  closeThread: () => void;
  goBack: () => void;
  clearHighlight: () => void;
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: 'chat',
  previousView: null,
  profileUserId: null,
  sidebarProfileUserId: null,
  hashtagTag: null,
  highlightPostId: null,
  showAI: false,
  showNewChat: false,
  showFriends: false,
  showChannelProfile: false,
  showChannelStudio: false,
  activeThreadId: null,
  channelProfileId: null,
  channelStudioId: null,

  navigateTo: (view) =>
    set((state) => ({
      currentView: view,
      previousView: state.currentView,
    })),

  openProfile: (userId) =>
    set((state) => ({
      profileUserId: userId,
      currentView: 'profile',
      previousView: state.currentView,
    })),

  openSidebarProfile: (userId) =>
    set({ sidebarProfileUserId: userId }),

  closeSidebarProfile: () =>
    set({ sidebarProfileUserId: null }),

  openHashtag: (tag) =>
    set((state) => ({
      hashtagTag: tag,
      currentView: 'hashtag',
      previousView: state.currentView,
    })),

  openWallPost: (postId) =>
    set((state) => ({
      highlightPostId: postId,
      currentView: 'wall',
      previousView: state.currentView,
    })),

  openAI: () =>
    set((state) => ({
      showAI: true,
      previousView: state.previousView ?? state.currentView,
    })),

  closeAI: () => set({ showAI: false }),

  openNewChat: () => set({ showNewChat: true }),

  closeNewChat: () => set({ showNewChat: false }),

  openFriends: () =>
    set((state) => ({
      showFriends: true,
      currentView: 'friends',
      previousView: state.currentView,
    })),

  closeFriends: () =>
    set((state) => ({
      showFriends: false,
      currentView: state.previousView ?? 'chat',
      previousView: null,
    })),

  openChannelProfile: (channelId) =>
    set((state) => ({
      channelProfileId: channelId,
      showChannelProfile: true,
      previousView: state.previousView ?? state.currentView,
    })),

  closeChannelProfile: () =>
    set({ showChannelProfile: false, channelProfileId: null }),

  openChannelStudio: (channelId) =>
    set((state) => ({
      channelStudioId: channelId,
      showChannelStudio: true,
      previousView: state.previousView ?? state.currentView,
    })),

  closeChannelStudio: () =>
    set({ showChannelStudio: false, channelStudioId: null }),

  openThread: (threadId) =>
    set((state) => ({
      activeThreadId: threadId,
      previousView: state.previousView ?? state.currentView,
    })),

  closeThread: () =>
    set({ activeThreadId: null }),

  goBack: () =>
    set((state) => {
      const prev = state.previousView ?? 'chat';
      return {
        currentView: prev,
        previousView: null,
      };
    }),

  clearHighlight: () => set({ highlightPostId: null }),
}));
