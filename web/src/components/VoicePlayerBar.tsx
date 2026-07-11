import { useState, useEffect } from 'react';
import { audioManager } from '../lib/audioManager';
import { Play, Pause, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function VoicePlayerBar() {
  const [isVisible, setIsVisible] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [url, setUrl] = useState('');

  useEffect(() => {
    // Poll the audioManager for state changes
    const interval = setInterval(() => {
      const persistentUrl = audioManager.getPersistentUrl();
      const playing = audioManager.isPersistentPlaying();
      const audio = audioManager.getPersistentAudio();

      if (persistentUrl) {
        setUrl(persistentUrl);
        setIsVisible(true);
        setIsPlaying(playing);
        if (audio && audio.duration) {
          setDuration(audio.duration);
          setProgress((audio.currentTime / audio.duration) * 100);
        }
      } else {
        setIsVisible(false);
      }
    }, 250);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const currentTime = duration ? (progress / 100) * duration : 0;

  const handleToggle = () => {
    if (isPlaying) {
      audioManager.pausePersistent();
    } else {
      audioManager.resumePersistent();
    }
  };

  const handleClose = () => {
    audioManager.closePersistent();
    setIsVisible(false);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const pct = (x / rect.width) * 100;
    audioManager.seekPersistent(Math.max(0, Math.min(100, pct)));
  };

  if (!isVisible || !url) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-[9990] bg-surface-secondary/95 backdrop-blur-xl border-b border-border"
      >
        <div className="max-w-2xl mx-auto px-4 py-2 flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={handleToggle}
            className="w-9 h-9 rounded-full bg-nexo-500/20 hover:bg-nexo-500/30 flex items-center justify-center transition-colors flex-shrink-0"
          >
            {isPlaying ? (
              <Pause size={16} className="text-nexo-400" />
            ) : (
              <Play size={16} className="text-nexo-400 ml-0.5" />
            )}
          </button>

          {/* Progress bar */}
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-xs text-zinc-500 font-mono w-10 text-right flex-shrink-0">
              {formatTime(currentTime)}
            </span>
            <div
              className="flex-1 relative h-6 flex items-center group cursor-pointer"
              onClick={handleSeek}
            >
              <div className="w-full h-1 bg-zinc-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-nexo-500 rounded-full transition-[width] duration-100"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <div
                className="absolute w-3 h-3 bg-nexo-400 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ left: `calc(${progress}% - 6px)` }}
              />
            </div>
            <span className="text-xs text-zinc-500 font-mono w-10 flex-shrink-0">
              {formatTime(duration)}
            </span>
          </div>

          {/* Close */}
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors flex-shrink-0"
          >
            <X size={16} />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
