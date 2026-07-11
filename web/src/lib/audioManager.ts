/**
 * Глобальный менеджер аудио — гарантирует что только одно аудио играет одновременно
 * Поддерживает воспроизведение, которое переживает unmount компонента
 */
class AudioManager {
  private currentAudio: HTMLAudioElement | null = null;
  private persistentAudio: HTMLAudioElement | null = null;
  private persistentUrl: string = '';
  private persistentCallbacks: {
    onTimeUpdate?: (progress: number, duration: number) => void;
    onEnded?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onLoaded?: (duration: number) => void;
  } = {};

  play(audio: HTMLAudioElement): Promise<void> {
    // Останавливаем текущее
    if (this.currentAudio && this.currentAudio !== audio) {
      this.currentAudio.pause();
      this.currentAudio.currentTime = 0;
    }

    this.currentAudio = audio;
    return audio.play();
  }

  pause(audio: HTMLAudioElement) {
    if (this.currentAudio === audio) {
      audio.pause();
      this.currentAudio = null;
    }
  }

  isPlaying(audio: HTMLAudioElement): boolean {
    return this.currentAudio === audio && !audio.paused;
  }

  // Persistent audio - survives component unmount
  playPersistent(url: string, callbacks?: {
    onTimeUpdate?: (progress: number, duration: number) => void;
    onEnded?: () => void;
    onPlay?: () => void;
    onPause?: () => void;
    onLoaded?: (duration: number) => void;
  }) {
    if (callbacks) this.persistentCallbacks = callbacks;

    // If same URL and already playing, toggle pause
    if (this.persistentAudio && this.persistentUrl === url) {
      if (this.persistentAudio.paused) {
        this.persistentAudio.play().catch(() => {});
        this.persistentCallbacks.onPlay?.();
      } else {
        this.persistentAudio.pause();
        this.persistentCallbacks.onPause?.();
      }
      return this.persistentAudio;
    }

    // Stop previous persistent audio
    if (this.persistentAudio) {
      this.persistentAudio.pause();
      this.persistentAudio.currentTime = 0;
      this.persistentAudio.src = '';
    }

    // Create new persistent audio element
    const audio = new Audio(url);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';

    audio.addEventListener('loadedmetadata', () => {
      this.persistentCallbacks.onLoaded?.(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      if (audio.duration) {
        this.persistentCallbacks.onTimeUpdate?.(
          (audio.currentTime / audio.duration) * 100,
          audio.duration
        );
      }
    });

    audio.addEventListener('ended', () => {
      this.persistentCallbacks.onEnded?.();
    });

    audio.play().catch(() => {});
    this.persistentAudio = audio;
    this.persistentUrl = url;
    this.currentAudio = audio;
    this.persistentCallbacks.onPlay?.();

    return audio;
  }

  pausePersistent() {
    if (this.persistentAudio) {
      this.persistentAudio.pause();
      this.persistentCallbacks.onPause?.();
    }
  }

  resumePersistent() {
    if (this.persistentAudio) {
      this.persistentAudio.play().catch(() => {});
      this.persistentCallbacks.onPlay?.();
    }
  }

  isPersistentPlaying(): boolean {
    return this.persistentAudio !== null && !this.persistentAudio.paused;
  }

  getPersistentUrl(): string {
    return this.persistentUrl;
  }

  getPersistentAudio(): HTMLAudioElement | null {
    return this.persistentAudio;
  }

  seekPersistent(progress: number) {
    if (this.persistentAudio && this.persistentAudio.duration) {
      this.persistentAudio.currentTime = (progress / 100) * this.persistentAudio.duration;
    }
  }

  closePersistent() {
    if (this.persistentAudio) {
      this.persistentAudio.pause();
      this.persistentAudio.currentTime = 0;
      this.persistentAudio.src = '';
      this.persistentAudio = null;
      this.persistentUrl = '';
      this.persistentCallbacks = {};
    }
    if (this.currentAudio === this.persistentAudio) {
      this.currentAudio = null;
    }
  }

  // Убить всё
  stopAll() {
    if (this.currentAudio) {
      this.currentAudio.pause();
      this.currentAudio = null;
    }
    if (this.persistentAudio) {
      this.persistentAudio.pause();
      this.persistentAudio.src = '';
      this.persistentAudio = null;
      this.persistentUrl = '';
    }
  }
}

export const audioManager = new AudioManager();
