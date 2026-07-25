import { create } from 'zustand';

export interface MusicTrack {
  id: string;
  url: string;
  title: string;
  artist?: string;
  duration?: number;
  coverUrl?: string;
  chatId?: string;
  messageId?: string;
}

// Singleton Audio element — persists across React unmounts
let _audio: HTMLAudioElement | null = null;
let _updateInterval: ReturnType<typeof setInterval> | null = null;

function getAudio(): HTMLAudioElement {
  if (!_audio) {
    _audio = new Audio();
    _audio.preload = 'auto';
  }
  return _audio;
}

interface MusicPlayerState {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMinimized: boolean;
  isVisible: boolean;
  repeatMode: 'none' | 'one' | 'all';
  shuffleMode: boolean;

  playTrack: (track: MusicTrack, queue?: MusicTrack[]) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  togglePlay: () => void;
  nextTrack: () => void;
  prevTrack: () => void;
  seekTo: (time: number) => void;
  setVolume: (volume: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setMinimized: (minimized: boolean) => void;
  closePlayer: () => void;
  setRepeatMode: (mode: 'none' | 'one' | 'all') => void;
  toggleShuffle: () => void;
  addToQueue: (track: MusicTrack) => void;
}

function startUpdateLoop() {
  if (_updateInterval) return;
  _updateInterval = setInterval(() => {
    const audio = _audio;
    if (audio && !audio.paused) {
      useMusicPlayerStore.setState({
        currentTime: audio.currentTime,
        duration: audio.duration || 0,
      });
    }
  }, 250);
}

function stopUpdateLoop() {
  if (_updateInterval) {
    clearInterval(_updateInterval);
    _updateInterval = null;
  }
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 1,
  isMinimized: false,
  isVisible: false,
  repeatMode: 'none',
  shuffleMode: false,

  playTrack: (track, queue) => {
    const audio = getAudio();
    audio.src = track.url;
    audio.volume = get().volume;
    audio.play().catch(() => {});

    // Update MediaSession metadata for system media controls
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist || '',
        artwork: track.coverUrl ? [{ src: track.coverUrl, sizes: '512x512', type: 'image/png' }] : [],
      });
    }

    set({
      currentTrack: track,
      queue: queue || [track],
      isPlaying: true,
      isVisible: true,
      currentTime: 0,
    });
    startUpdateLoop();
  },

  pauseTrack: () => {
    getAudio().pause();
    set({ isPlaying: false });
    stopUpdateLoop();
  },

  resumeTrack: () => {
    const audio = getAudio();
    if (audio.src) {
      audio.play().catch(() => {});
      set({ isPlaying: true });
      startUpdateLoop();
    }
  },

  togglePlay: () => {
    const { isPlaying, currentTrack } = get();
    if (!currentTrack) return;
    const audio = getAudio();
    if (isPlaying) {
      audio.pause();
      set({ isPlaying: false });
      stopUpdateLoop();
    } else {
      audio.play().catch(() => {});
      set({ isPlaying: true });
      startUpdateLoop();
    }
  },

  nextTrack: () => {
    const { queue, currentTrack, repeatMode, shuffleMode } = get();
    if (!currentTrack || queue.length === 0) return;
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    if (repeatMode === 'one') {
      const audio = getAudio();
      audio.currentTime = 0;
      audio.play().catch(() => {});
      set({ currentTime: 0, isPlaying: true });
      return;
    }
    let nextIdx: number;
    if (shuffleMode) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = idx + 1;
      if (nextIdx >= queue.length) {
        if (repeatMode === 'all') nextIdx = 0;
        else {
          getAudio().pause();
          set({ isPlaying: false });
          stopUpdateLoop();
          return;
        }
      }
    }
    const nextTrack = queue[nextIdx];
    const audio = getAudio();
    audio.src = nextTrack.url;
    audio.volume = get().volume;
    audio.play().catch(() => {});
    set({ currentTrack: nextTrack, currentTime: 0, isPlaying: true });
  },

  prevTrack: () => {
    const { queue, currentTrack, currentTime } = get();
    if (!currentTrack || queue.length === 0) return;
    const audio = getAudio();
    if (currentTime > 3) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
      set({ currentTime: 0, isPlaying: true });
      return;
    }
    const idx = queue.findIndex(t => t.id === currentTrack.id);
    const prevIdx = idx > 0 ? idx - 1 : queue.length - 1;
    const prevTrack = queue[prevIdx];
    audio.src = prevTrack.url;
    audio.volume = get().volume;
    audio.play().catch(() => {});
    set({ currentTrack: prevTrack, currentTime: 0, isPlaying: true });
  },

  seekTo: (time) => {
    getAudio().currentTime = time;
    set({ currentTime: time });
  },

  setVolume: (volume) => {
    getAudio().volume = volume;
    set({ volume });
  },

  setCurrentTime: (currentTime) => set({ currentTime }),
  setDuration: (duration) => set({ duration }),
  setMinimized: (isMinimized) => set({ isMinimized }),

  closePlayer: () => {
    const audio = getAudio();
    audio.pause();
    audio.src = '';
    stopUpdateLoop();
    set({ isVisible: false, isPlaying: false, currentTrack: null, currentTime: 0, duration: 0 });
  },

  setRepeatMode: (repeatMode) => set({ repeatMode }),
  toggleShuffle: () => set(s => ({ shuffleMode: !s.shuffleMode })),
  addToQueue: (track) => set(s => ({ queue: [...s.queue, track] })),
}));

// Setup Audio event listeners (once, outside React)
(function initAudioListeners() {
  const audio = getAudio();

  audio.addEventListener('ended', () => {
    const { repeatMode } = useMusicPlayerStore.getState();
    if (repeatMode === 'one') {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } else {
      useMusicPlayerStore.getState().nextTrack();
    }
  });

  audio.addEventListener('error', () => {
    useMusicPlayerStore.setState({ isPlaying: false });
    stopUpdateLoop();
  });

  // MediaSession action handlers
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', () => {
      useMusicPlayerStore.getState().resumeTrack();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      useMusicPlayerStore.getState().pauseTrack();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      useMusicPlayerStore.getState().prevTrack();
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      useMusicPlayerStore.getState().nextTrack();
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime != null) {
        useMusicPlayerStore.getState().seekTo(details.seekTime);
      }
    });
  }
})();
