import { create } from 'zustand';

interface VoiceMessage {
  url: string;
  name?: string;
}

interface VoicePlayerState {
  currentMessage: VoiceMessage | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  audioElement: HTMLAudioElement | null;
  play: (message: VoiceMessage) => void;
  pause: () => void;
  resume: () => void;
  toggle: (message: VoiceMessage) => void;
  seek: (time: number) => void;
  close: () => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setAudioElement: (el: HTMLAudioElement | null) => void;
}

export const useVoicePlayerStore = create<VoicePlayerState>((set, get) => ({
  currentMessage: null,
  isPlaying: false,
  progress: 0,
  duration: 0,
  audioElement: null,

  play: (message) => {
    const state = get();
    // If same message, just resume
    if (state.audioElement && state.currentMessage?.url === message.url) {
      state.audioElement.play().catch(() => {});
      set({ isPlaying: true });
      return;
    }

    // Stop current
    if (state.audioElement) {
      state.audioElement.pause();
      state.audioElement.currentTime = 0;
      state.audioElement.src = '';
    }

    // Create new audio element
    const audio = new Audio(message.url);
    audio.crossOrigin = 'anonymous';
    
    audio.addEventListener('loadedmetadata', () => {
      set({ duration: audio.duration });
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        set({ progress: (audio.currentTime / audio.duration) * 100 });
      }
    });

    audio.addEventListener('ended', () => {
      set({ isPlaying: false, progress: 0 });
    });

    audio.addEventListener('error', () => {
      set({ isPlaying: false, currentMessage: null });
    });

    audio.play().catch(() => {});
    set({ currentMessage: message, isPlaying: true, audioElement: audio, progress: 0 });
  },

  pause: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
    }
    set({ isPlaying: false });
  },

  resume: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.play().catch(() => {});
    }
    set({ isPlaying: true });
  },

  toggle: (message) => {
    const state = get();
    if (state.currentMessage?.url === message.url) {
      if (state.isPlaying) {
        state.pause();
      } else {
        state.resume();
      }
    } else {
      state.play(message);
    }
  },

  seek: (time) => {
    const { audioElement, duration } = get();
    if (audioElement && duration) {
      audioElement.currentTime = (time / 100) * duration;
    }
  },

  close: () => {
    const { audioElement } = get();
    if (audioElement) {
      audioElement.pause();
      audioElement.currentTime = 0;
      audioElement.src = '';
    }
    set({ currentMessage: null, isPlaying: false, progress: 0, duration: 0, audioElement: null });
  },

  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setAudioElement: (el) => set({ audioElement: el }),
}));
