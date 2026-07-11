import { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Check } from 'lucide-react';
import { normalizeMediaUrl } from '../../lib/mediaUrl';
import { extractWaveform } from '../../lib/utils';
import { audioManager } from '../../lib/audioManager';
import { useChatStore } from '../../stores/chatStore';
import type { MediaItem, Message } from '../../lib/types';

interface AudioPlayerProps {
  voiceMedia?: MediaItem;
  audioMedia?: MediaItem;
  messageId: string;
  chatId: string;
  isMine: boolean;
  userId: string | undefined;
  message: Message;
  onOpenProfileModal?: (audioUrl: string) => void;
}

function formatDuration(sec: number) {
  if (!sec || isNaN(sec) || !isFinite(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AudioPlayer({
  voiceMedia,
  audioMedia,
  messageId,
  chatId,
  isMine,
  userId,
  message,
  onOpenProfileModal,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [waveformBars, setWaveformBars] = useState<number[] | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(() => {
    const saved = localStorage.getItem('nexo_voice_speed');
    return saved ? parseFloat(saved) : 1;
  });
  const [loadError, setLoadError] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const voiceUrl = voiceMedia ? normalizeMediaUrl(voiceMedia.url) : null;
  const audioUrl = audioMedia ? normalizeMediaUrl(audioMedia.url) : null;
  const isVoice = !!voiceMedia;
  const mediaUrl = voiceUrl || audioUrl;

  // Extract waveform for voice messages
  useEffect(() => {
    if (!voiceUrl) return;
    extractWaveform(voiceUrl, 28).then(setWaveformBars);
  }, [voiceUrl]);

  // Sync isPlaying state with persistent audio for voice messages
  useEffect(() => {
    if (!voiceUrl) return;

    if (audioManager.getPersistentUrl() === voiceUrl && audioManager.isPersistentPlaying()) {
      setIsPlaying(true);
    }

    const interval = setInterval(() => {
      const persistentUrl = audioManager.getPersistentUrl();
      const playing = audioManager.isPersistentPlaying();
      if (persistentUrl === voiceUrl) {
        setIsPlaying(playing);
        const audio = audioManager.getPersistentAudio();
        if (audio && audio.duration) {
          setAudioProgress((audio.currentTime / audio.duration) * 100);
          setAudioDuration(audio.duration);
        }
      } else {
        setIsPlaying(false);
      }
    }, 250);

    return () => clearInterval(interval);
  }, [voiceUrl]);

  // Audio element event listeners for non-voice audio
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || isVoice) return;

    const onTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };
    const onLoadedMetadata = () => setAudioDuration(audio.duration);
    const onEnded = () => {
      setIsPlaying(false);
      setAudioProgress(0);
      if (messageId && userId) {
        localStorage.setItem(`voice_listened_${messageId}_${userId}`, 'true');
      }
      // Auto-play next voice message
      const chatMessages = useChatStore.getState().messages[chatId] || [];
      const currentIndex = chatMessages.findIndex(m => m.id === messageId);
      if (currentIndex !== -1) {
        for (let i = currentIndex + 1; i < chatMessages.length; i++) {
          const nextMsg = chatMessages[i];
          const nextMedia = nextMsg.media || [];
          const hasNextVoice = nextMsg.type === 'voice' || nextMedia.some(m => m.type === 'voice');
          if (hasNextVoice) {
            setTimeout(() => {
              const nextAudioEl = document.querySelector(`#voice-${nextMsg.id}`) as HTMLAudioElement;
              if (nextAudioEl) {
                nextAudioEl.playbackRate = playbackSpeed;
                audioManager.play(nextAudioEl).catch(() => {});
              }
            }, 500);
            break;
          }
        }
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [isVoice, chatId, messageId, userId, playbackSpeed]);

  const toggleAudio = useCallback(() => {
    if (isVoice && voiceUrl) {
      const currentUrl = audioManager.getPersistentUrl();
      const wasPlaying = audioManager.isPersistentPlaying();

      if (currentUrl === voiceUrl && wasPlaying) {
        audioManager.pausePersistent();
        setIsPlaying(false);
        return;
      }

      audioManager.playPersistent(voiceUrl, {
        onPlay: () => setIsPlaying(true),
        onPause: () => setIsPlaying(false),
        onTimeUpdate: (prog) => setAudioProgress(prog),
        onLoaded: (dur) => setAudioDuration(dur),
        onEnded: () => {
          setIsPlaying(false);
          setAudioProgress(0);
          if (messageId && userId) {
            localStorage.setItem(`voice_listened_${messageId}_${userId}`, 'true');
          }
        },
      });
      setIsPlaying(true);
      return;
    }

    // Fallback for audio files (non-voice)
    const audio = audioRef.current;
    if (!audio) return;

    if (audioManager.isPlaying(audio)) {
      audioManager.pause(audio);
      setIsPlaying(false);
    } else {
      audio.playbackRate = playbackSpeed;
      audioManager.play(audio).then(() => {
        setIsPlaying(true);
      }).catch(() => setIsPlaying(false));
    }
  }, [isVoice, voiceUrl, messageId, userId, playbackSpeed]);

  const changePlaybackSpeed = useCallback(() => {
    const speeds = [1, 1.5, 2, 2.5, 3];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    localStorage.setItem('nexo_voice_speed', nextSpeed.toString());
    const audio = audioRef.current;
    if (audio) audio.playbackRate = nextSpeed;
  }, [playbackSpeed]);

  // Long press handlers for adding audio to profile
  const handleLongPressStart = useCallback((url: string) => {
    longPressTimerRef.current = setTimeout(() => {
      onOpenProfileModal?.(url);
    }, 500);
  }, [onOpenProfileModal]);

  const handleLongPressEnd = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // ─── Voice message rendering ─────────────────────────────────────────
  if (isVoice) {
    if (!voiceUrl) return null;
    const duration = voiceMedia?.duration || 0;
    const size = voiceMedia?.size || 0;
    const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(0)} KB`;
    const voiceId = `voice-${messageId}`;
    const listenedKey = `voice_listened_${messageId}_${userId}`;
    const isListened = localStorage.getItem(listenedKey) === 'true';

    if (loadError) {
      return (
        <div className="flex items-center gap-3 min-w-[220px] max-w-[320px] w-full">
          <div className="flex-1 text-center py-3 overflow-hidden">
            <p className="text-xs opacity-60 mb-2">Не удалось загрузить</p>
            <button
              onClick={() => { setLoadError(false); setIsPlaying(false); }}
              className={`text-xs px-3 py-1.5 rounded-lg ${
                isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-blue-500/20 hover:bg-blue-500/30'
              } transition-colors`}
            >
              🔄 Повторить
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-1.5 min-w-[180px] max-w-[320px] w-full bg-white/5 rounded-2xl px-2.5 py-2 overflow-hidden">
        <audio
          ref={(el) => {
            if (el) el.playbackRate = playbackSpeed;
            // @ts-ignore
            audioRef.current = el;
          }}
          id={voiceId}
          src={voiceUrl}
          preload="auto"
          onError={() => { setLoadError(true); setIsPlaying(false); }}
        />
        {/* Play button */}
        <button
          onClick={toggleAudio}
          onMouseDown={() => handleLongPressStart(voiceUrl)}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={() => handleLongPressStart(voiceUrl)}
          onTouchEnd={handleLongPressEnd}
          className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all relative ${
            isMine
              ? 'bg-white/25 hover:bg-white/35'
              : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/20'
          }`}
        >
          {isPlaying ? (
            <Pause size={14} className="text-white" />
          ) : (
            <Play size={14} className="text-white ml-0.5" />
          )}
          {isListened && !isPlaying && (
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border border-white/20 flex items-center justify-center shadow-lg shadow-emerald-500/40">
              <Check size={6} className="text-white" strokeWidth={3} />
            </div>
          )}
        </button>

        {/* Waveform + info + speed button */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center gap-2 mb-1">
            <div
              className="flex-1 flex items-end gap-[1px] h-4 cursor-pointer overflow-hidden"
              onClick={(e) => {
                const audio = audioRef.current;
                if (!audio) return;
                if (!audioManager.isPlaying(audio)) {
                  toggleAudio();
                  return;
                }
                if (!audio.duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                audio.currentTime = pct * audio.duration;
                setAudioProgress(pct * 100);
              }}
            >
              {(waveformBars || Array(28).fill(0.5)).map((val, i) => {
                const barHeight = Math.max(3, val * 100);
                const progress = audioProgress / 100;
                const barProgress = i / 28;
                const isActive = barProgress < progress;
                return (
                  <div
                    key={i}
                    className={`flex-1 rounded-full transition-colors duration-100 ${
                      isActive
                        ? isMine ? 'bg-white' : 'bg-blue-300'
                        : isMine ? 'bg-white/30' : 'bg-white/20'
                    }`}
                    style={{ height: `${barHeight}%` }}
                  />
                );
              })}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                const speeds = [1, 1.5, 2, 0.5];
                const currentIndex = speeds.indexOf(playbackSpeed);
                const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
                setPlaybackSpeed(nextSpeed);
                localStorage.setItem('nexo_voice_speed', nextSpeed.toString());
                const audio = audioRef.current;
                if (audio) audio.playbackRate = nextSpeed;
              }}
              className={`text-[9px] px-1 py-0.5 rounded font-bold transition-all flex-shrink-0 active:scale-95 min-w-[20px] ${
                isMine
                  ? 'bg-white/20 hover:bg-white/30 text-white'
                  : 'bg-blue-500/30 hover:bg-blue-500/40 text-blue-200'
              } ${playbackSpeed !== 1 ? 'ring-1 ring-nexo-400/50' : ''}`}
              title="Скорость воспроизведения"
            >
              {playbackSpeed}x
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 overflow-hidden">
            <span className={`text-[9px] flex-shrink-0 ${isMine ? 'text-white/50' : 'text-blue-200/70'}`}>
              {isPlaying
                ? formatDuration(audioRef.current?.currentTime || 0)
                : formatDuration(duration || audioDuration || 0)}
            </span>
            <span className={`text-[7px] flex-shrink-0 ${isMine ? 'text-white/25' : 'text-blue-300/40'}`}>
              {sizeStr}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ─── Audio (mp3 files) rendering ──────────────────────────────────────
  if (!audioUrl) return null;

  return (
    <div className="min-w-[200px] max-w-[280px]">
      <div className="flex items-center gap-2">
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="auto"
          onError={() => {
            console.error('[Audio] Ошибка загрузки:', audioUrl);
            setIsPlaying(false);
            setAudioProgress(0);
          }}
        />
        <button
          onClick={toggleAudio}
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            isMine ? 'bg-white/20 hover:bg-white/30' : 'bg-nexo-500/20 hover:bg-nexo-500/30'
          } transition-colors`}
        >
          {isPlaying ? (
            <Pause size={14} className={isMine ? 'text-white' : 'text-nexo-400'} />
          ) : (
            <Play size={14} className={`${isMine ? 'text-white' : 'text-nexo-400'} ml-0.5`} />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {audioMedia?.filename && (
            <div className={`text-xs truncate mb-1 ${isMine ? 'text-white/70' : 'text-zinc-300'}`}>
              {audioMedia.filename}
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
              <div 
                className={`h-full ${isMine ? 'bg-white/60' : 'bg-nexo-400'} transition-all`}
                style={{ width: `${audioProgress}%` }}
              />
            </div>
            <span className={`text-[10px] ${isMine ? 'text-white/50' : 'text-zinc-500'}`}>
              {isPlaying
                ? formatDuration(audioRef.current?.currentTime || 0)
                : formatDuration(audioDuration || 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
