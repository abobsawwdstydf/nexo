import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronDown,
  Volume2,
  VolumeX,
  Shuffle,
  Repeat,
  Repeat1,
  Heart,
  Share2,
  ListMusic,
  Maximize2,
} from 'lucide-react';
import { normalizeMediaUrl } from '../../lib/mediaUrl';

interface Track {
  id: string;
  title: string;
  artist: string;
  albumArt?: string;
  duration: number;
  url: string;
}

interface TelegramMusicPlayerProps {
  track: Track | null;
  isPlaying: boolean;
  progress: number;
  volume: number;
  isShuffled: boolean;
  repeatMode: 'none' | 'one' | 'all';
  onPlayPause: () => void;
  onSkipNext: () => void;
  onSkipPrev: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onShuffleToggle: () => void;
  onRepeatToggle: () => void;
  onLike?: (trackId: string) => void;
  isLiked?: boolean;
  className?: string;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Mini player (bottom bar)
function TelegramMiniPlayer({
  track,
  isPlaying,
  progress,
  onPlayPause,
  onExpand,
}: {
  track: Track;
  isPlaying: boolean;
  progress: number;
  onPlayPause: () => void;
  onExpand: () => void;
}) {
  return (
    <motion.div
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 80, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed bottom-[72px] left-2 right-2 z-50 sm:bottom-2 sm:left-auto sm:right-4 sm:w-[360px]"
    >
      <div
        onClick={onExpand}
        className="relative rounded-2xl liquid-glass border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.6)] overflow-hidden cursor-pointer"
      >
        {/* Progress bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06]">
          <motion.div
            className="h-full bg-[var(--color-accent)]"
            style={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
          />
        </div>

        <div className="flex items-center gap-3 px-3 py-2.5">
          {/* Album art */}
          <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-white/[0.06]">
            {track.albumArt ? (
              <img
                src={normalizeMediaUrl(track.albumArt)}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ListMusic size={16} className="text-white/30" />
              </div>
            )}
          </div>

          {/* Track info */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-white truncate">{track.title}</p>
            <p className="text-[11px] text-white/40 truncate">{track.artist}</p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={(e) => {
                e.stopPropagation();
                onPlayPause();
              }}
              className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
            >
              {isPlaying ? (
                <Pause size={18} className="text-white" fill="white" />
              ) : (
                <Play size={18} className="text-white ml-0.5" fill="white" />
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Full screen player
function TelegramFullScreenPlayer({
  track,
  isPlaying,
  progress,
  volume,
  isShuffled,
  repeatMode,
  onPlayPause,
  onSkipNext,
  onSkipPrev,
  onSeek,
  onVolumeChange,
  onShuffleToggle,
  onRepeatToggle,
  onLike,
  isLiked,
  onMinimize,
}: TelegramMusicPlayerProps & { onMinimize: () => void }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);

  if (!track) return null;

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = x / rect.width;
      onSeek(percent * track.duration);
    },
    [onSeek, track.duration]
  );

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-[70] flex flex-col"
    >
      {/* Background */}
      <div className="absolute inset-0">
        {track.albumArt ? (
          <>
            <img
              src={normalizeMediaUrl(track.albumArt)}
              alt=""
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-[60px] opacity-30"
            />
            <div className="absolute inset-0 bg-black/60" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#0a0a14]" />
        )}
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full px-6 pt-12 pb-8">
        {/* Top: Minimize + Title */}
        <div className="flex items-center justify-between mb-6">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onMinimize}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"
          >
            <ChevronDown size={24} className="text-white/70" />
          </motion.button>
          <div className="text-center">
            <p className="text-[11px] text-white/40 uppercase tracking-wider font-medium">
              Из плейлиста
            </p>
          </div>
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10"
          >
            <ListMusic size={20} className="text-white/70" />
          </motion.button>
        </div>

        {/* Album art */}
        <div className="flex-1 flex items-center justify-center mb-8">
          <motion.div
            animate={isPlaying ? { rotate: 360 } : { rotate: 0 }}
            transition={isPlaying ? { duration: 20, repeat: Infinity, ease: 'linear' } : { duration: 0.5 }}
            className="w-[280px] h-[280px] sm:w-[320px] sm:h-[320px] rounded-full overflow-hidden shadow-2xl shadow-black/50 border-4 border-white/[0.06]"
          >
            {track.albumArt ? (
              <img
                src={normalizeMediaUrl(track.albumArt)}
                alt={track.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-white/[0.06] flex items-center justify-center">
                <ListMusic size={48} className="text-white/20" />
              </div>
            )}
          </motion.div>
        </div>

        {/* Track info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0 mr-4">
            <h3 className="text-[18px] font-bold text-white truncate">{track.title}</h3>
            <p className="text-[14px] text-white/50 truncate">{track.artist}</p>
          </div>
          {onLike && (
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={() => onLike(track.id)}
              className="flex-shrink-0"
            >
              <Heart
                size={22}
                className={isLiked ? 'text-[var(--color-accent)] fill-[var(--color-accent)]' : 'text-white/40'}
              />
            </motion.button>
          )}
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div
            ref={progressBarRef}
            onClick={handleProgressClick}
            className="relative h-[4px] bg-white/[0.1] rounded-full cursor-pointer group"
          >
            <motion.div
              className="absolute top-0 left-0 h-full bg-white rounded-full"
              style={{ width: `${progress}%` }}
            />
            <motion.div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `${progress}%`, transform: `translate(-50%, -50%)` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[11px] text-white/30 tabular-nums">
              {formatTime((progress / 100) * track.duration)}
            </span>
            <span className="text-[11px] text-white/30 tabular-nums">
              {formatTime(track.duration)}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6 mb-6">
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onShuffleToggle}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              isShuffled ? 'text-[var(--color-accent)]' : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Shuffle size={20} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onSkipPrev}
            className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <SkipBack size={24} className="text-white" fill="white" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onPlayPause}
            className="w-[64px] h-[64px] rounded-full bg-white flex items-center justify-center shadow-lg"
          >
            {isPlaying ? (
              <Pause size={28} className="text-black" fill="black" />
            ) : (
              <Play size={28} className="text-black ml-1" fill="black" />
            )}
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onSkipNext}
            className="w-12 h-12 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          >
            <SkipForward size={24} className="text-white" fill="white" />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onRepeatToggle}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
              repeatMode !== 'none' ? 'text-[var(--color-accent)]' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {repeatMode === 'one' ? <Repeat1 size={20} /> : <Repeat size={20} />}
          </motion.button>
        </div>

        {/* Volume */}
        <div className="flex items-center gap-3 px-2">
          <VolumeX size={14} className="text-white/30 flex-shrink-0" />
          <div className="flex-1 relative h-[3px] bg-white/[0.1] rounded-full cursor-pointer">
            <div
              className="absolute top-0 left-0 h-full bg-white/60 rounded-full"
              style={{ width: `${volume}%` }}
            />
          </div>
          <Volume2 size={14} className="text-white/30 flex-shrink-0" />
        </div>
      </div>
    </motion.div>
  );
}

export { TelegramMiniPlayer, TelegramFullScreenPlayer };
export default memo(TelegramFullScreenPlayer);
