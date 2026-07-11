import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Repeat, Repeat1, Shuffle, ChevronDown, ChevronUp, X, Music2,
  ListMusic, Heart,
} from 'lucide-react';
import { useMusicPlayerStore } from '../stores/musicPlayerStore';
import { normalizeMediaUrl } from '../lib/mediaUrl';

export default function MusicPlayer() {
  const {
    currentTrack, isPlaying, currentTime, duration, volume, isMinimized, isVisible,
    repeatMode, shuffleMode, queue,
    pauseTrack, resumeTrack, nextTrack, prevTrack, seekTo, setVolume,
    setCurrentTime, setDuration, setMinimized, closePlayer, setRepeatMode, toggleShuffle,
  } = useMusicPlayerStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [showQueue, setShowQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [liked, setLiked] = useState(false);
  const [coverRotation, setCoverRotation] = useState(0);
  const rotationRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);

  // Animate cover rotation when playing
  useEffect(() => {
    if (isPlaying && !isMinimized) {
      const animate = () => {
        rotationRef.current += 0.3;
        setCoverRotation(rotationRef.current);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
    } else {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, isMinimized]);

  // Create/update audio element
  useEffect(() => {
    if (!currentTrack) return;
    if (!audioRef.current) audioRef.current = new Audio();
    const audio = audioRef.current;
    const url = normalizeMediaUrl(currentTrack.url);
    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    }
    audio.volume = volume;

    const handleTimeUpdate = () => { if (!isDragging) setCurrentTime(audio.currentTime); };
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => nextTrack();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrack?.id]);

  // Play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying, currentTrack?.id]);

  // Volume
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  // Seek
  useEffect(() => {
    if (audioRef.current && isDragging) audioRef.current.currentTime = currentTime;
  }, [currentTime, isDragging]);

  // Cleanup
  useEffect(() => {
    if (!isVisible && audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
  }, [isVisible]);

  if (!isVisible || !currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const formatTime = (s: number) => {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    if (audioRef.current) audioRef.current.currentTime = val;
  };

  const cycleRepeat = () => {
    const modes: Array<'none' | 'one' | 'all'> = ['none', 'all', 'one'];
    const idx = modes.indexOf(repeatMode);
    setRepeatMode(modes[(idx + 1) % modes.length]);
  };

  return (
    <AnimatePresence>
      <motion.div
        key="music-player"
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 20, stiffness: 300 }}
        className="fixed bottom-[80px] sm:bottom-4 left-1/2 -translate-x-1/2 z-[9980] w-full max-w-sm px-3"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="glass-strong rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
          {/* Queue panel */}
          <AnimatePresence>
            {showQueue && !isMinimized && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="max-h-48 overflow-y-auto px-3 py-2 border-b border-white/10">
                  <p className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wider">Очередь</p>
                  {queue.map((track, i) => (
                    <button
                      key={track.id + i}
                      onClick={() => useMusicPlayerStore.getState().playTrack(track, queue)}
                      className={`flex items-center gap-2 w-full py-1.5 px-2 rounded-lg text-left transition-colors ${
                        track.id === currentTrack.id
                          ? 'bg-nexo-500/20 text-nexo-400'
                          : 'hover:bg-white/5 text-zinc-300'
                      }`}
                    >
                      <Music2 size={12} className="flex-shrink-0 opacity-60" />
                      <span className="text-xs truncate flex-1">{track.title}</span>
                      {track.id === currentTrack.id && isPlaying && (
                        <div className="flex items-end gap-0.5 h-3 flex-shrink-0">
                          {[1, 2, 3].map(b => (
                            <div
                              key={b}
                              className="w-0.5 bg-nexo-400 rounded-full"
                              style={{
                                height: `${30 + b * 20}%`,
                                animation: `musicBar${b} 0.8s ease-in-out infinite alternate`,
                                animationDelay: `${b * 0.15}s`,
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Main player */}
          {!isMinimized ? (
            <div className="p-3">
              {/* Track info + controls row */}
              <div className="flex items-center gap-3 mb-3">
                {/* Rotating cover */}
                <div
                  className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden shadow-lg"
                  style={{
                    transform: `rotate(${coverRotation}deg)`,
                    transition: isPlaying ? 'none' : 'transform 0.3s ease',
                  }}
                >
                  {currentTrack.coverUrl ? (
                    <img
                      src={normalizeMediaUrl(currentTrack.coverUrl)}
                      alt=""
                      className="w-full h-full object-cover rounded-xl"
                    />
                  ) : (
                    <div className="w-full h-full rounded-xl bg-gradient-to-br from-nexo-500/40 to-purple-600/40 flex items-center justify-center">
                      <Music2 size={18} className="text-nexo-400" />
                    </div>
                  )}
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{currentTrack.title}</p>
                  {currentTrack.artist && (
                    <p className="text-xs text-zinc-500 truncate">{currentTrack.artist}</p>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setLiked(l => !l)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      liked ? 'text-red-400' : 'text-zinc-500 hover:text-white hover:bg-white/10'
                    }`}
                    title="Нравится"
                  >
                    <Heart size={14} fill={liked ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    onClick={() => setShowQueue(!showQueue)}
                    className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                      showQueue ? 'text-nexo-400 bg-nexo-500/20' : 'text-zinc-500 hover:text-white hover:bg-white/10'
                    }`}
                    title="Очередь"
                  >
                    <ListMusic size={14} />
                  </button>
                  <button
                    onClick={() => setMinimized(true)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                    title="Свернуть"
                  >
                    <ChevronDown size={14} />
                  </button>
                  <button
                    onClick={closePlayer}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Закрыть"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-zinc-500 w-8 text-right tabular-nums">{formatTime(currentTime)}</span>
                <div className="flex-1 relative">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    step={0.1}
                    onMouseDown={() => setIsDragging(true)}
                    onMouseUp={() => setIsDragging(false)}
                    onTouchStart={() => setIsDragging(true)}
                    onTouchEnd={() => setIsDragging(false)}
                    onChange={handleSeek}
                    className="w-full h-1 appearance-none rounded-full cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--color-accent, #6366f1) ${progress}%, rgba(255,255,255,0.1) ${progress}%)`,
                    }}
                  />
                </div>
                <span className="text-[10px] text-zinc-500 w-8 tabular-nums">{formatTime(duration)}</span>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleShuffle}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    shuffleMode ? 'text-nexo-400' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Shuffle size={15} />
                </button>
                <button
                  onClick={prevTrack}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <SkipBack size={18} />
                </button>
                <button
                  onClick={() => isPlaying ? pauseTrack() : resumeTrack()}
                  className="w-12 h-12 rounded-2xl bg-nexo-500 hover:bg-nexo-400 flex items-center justify-center text-white shadow-lg shadow-nexo-500/30 transition-all active:scale-95"
                >
                  {isPlaying ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
                </button>
                <button
                  onClick={nextTrack}
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-zinc-300 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <SkipForward size={18} />
                </button>
                <button
                  onClick={cycleRepeat}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    repeatMode !== 'none' ? 'text-nexo-400' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {repeatMode === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
                </button>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2 mt-2.5">
                <button
                  onClick={() => setVolume(volume > 0 ? 0 : 1)}
                  className="text-zinc-500 hover:text-white transition-colors flex-shrink-0"
                >
                  {volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value))}
                  className="flex-1 h-1 appearance-none rounded-full cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-accent, #6366f1) ${volume * 100}%, rgba(255,255,255,0.1) ${volume * 100}%)`,
                  }}
                />
              </div>
            </div>
          ) : (
            /* Minimized view — TG-style pill */
            <div className="flex items-center gap-2 px-3 py-2">
              {/* Mini rotating cover */}
              <div className="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden">
                {currentTrack.coverUrl ? (
                  <img src={normalizeMediaUrl(currentTrack.coverUrl)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full rounded-lg bg-gradient-to-br from-nexo-500/30 to-purple-600/30 flex items-center justify-center">
                    <Music2 size={14} className="text-nexo-400" />
                  </div>
                )}
              </div>

              {/* Mini progress + title */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">{currentTrack.title}</p>
                <div className="mt-1 h-0.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-nexo-500 transition-all duration-1000"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <button
                onClick={() => isPlaying ? pauseTrack() : resumeTrack()}
                className="w-8 h-8 rounded-lg bg-nexo-500/20 flex items-center justify-center text-nexo-400 hover:bg-nexo-500/30 transition-colors flex-shrink-0"
              >
                {isPlaying ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <button
                onClick={nextTrack}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <SkipForward size={13} />
              </button>
              <button
                onClick={() => setMinimized(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
              >
                <ChevronUp size={14} />
              </button>
              <button
                onClick={closePlayer}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors flex-shrink-0"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      </motion.div>

      {/* CSS for music bars */}
      <style>{`
        @keyframes musicBar1 { from { height: 30% } to { height: 80% } }
        @keyframes musicBar2 { from { height: 60% } to { height: 30% } }
        @keyframes musicBar3 { from { height: 40% } to { height: 90% } }
      `}</style>
    </AnimatePresence>
  );
}
