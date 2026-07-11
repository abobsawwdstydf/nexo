import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2, VolumeX, Play, Pause } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface VideoNotePlayerProps {
  videoUrl: string;
  duration: number;
  thumbnail?: string | null;
}

export default function VideoNotePlayer({ videoUrl, duration, thumbnail }: VideoNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const thumbVideoRef = useRef<HTMLVideoElement>(null);
  const fullVideoRef = useRef<HTMLVideoElement>(null);
  const progressWrapperRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);

  const circumference = 2 * Math.PI * 48;

  // ── Thumbnail video: muted loop ──
  useEffect(() => {
    const v = thumbVideoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
    const onTime = () => {
      if (v.duration) {
        setProgress((v.currentTime / v.duration) * 100);
        setCurrentTime(v.currentTime);
      }
    };
    v.addEventListener('timeupdate', onTime);
    return () => v.removeEventListener('timeupdate', onTime);
  }, []);

  // ── Fullscreen video ──
  useEffect(() => {
    if (!isFullscreen) return;
    const v = fullVideoRef.current;
    if (!v) return;

    const timer = setTimeout(() => {
      const startPlay = () => {
        v.muted = false;
        setIsMuted(false);
        v.play().catch(() => {
          v.muted = true;
          setIsMuted(true);
          v.play().catch(() => {});
        });
      };
      if (v.readyState >= 2) startPlay();
      else v.addEventListener('loadeddata', startPlay, { once: true });
    }, 100);

    const onTime = () => {
      if (v.duration) {
        setProgress((v.currentTime / v.duration) * 100);
        setCurrentTime(v.currentTime);
      }
    };
    const onEnd = () => {
      setIsPlaying(false);
      setIsFullscreen(false);
      setProgress(0);
      setCurrentTime(0);
    };
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('ended', onEnd);
    return () => {
      clearTimeout(timer);
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('ended', onEnd);
    };
  }, [isFullscreen]);

  // ── Toggle play/pause ──
  const togglePlay = useCallback(() => {
    if (isFullscreen) {
      const v = fullVideoRef.current;
      if (!v) return;
      if (v.paused) { v.play().catch(() => {}); setIsPlaying(true); }
      else { v.pause(); setIsPlaying(false); }
    } else {
      setIsPlaying(true);
      setIsFullscreen(true);
    }
  }, [isFullscreen]);

  // ── Toggle mute ──
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = isFullscreen ? fullVideoRef.current : thumbVideoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }, [isFullscreen]);

  // ── Seek from click/touch on progress ring ──
  const seekFromEvent = useCallback((clientX: number, clientY: number) => {
    const wrapper = progressWrapperRef.current;
    const v = isFullscreen ? fullVideoRef.current : thumbVideoRef.current;
    if (!wrapper || !v || !v.duration) return;

    const rect = wrapper.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);
    angle = (angle + 90 + 360) % 360;
    const pct = angle / 360;
    v.currentTime = pct * v.duration;
    setProgress(pct * 100);
    setCurrentTime(pct * v.duration);
  }, [isFullscreen]);

  // ── Drag handlers ──
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const v = isFullscreen ? fullVideoRef.current : thumbVideoRef.current;
    if (v && !v.paused) v.pause();
    seekFromEvent(e.clientX, e.clientY);
  }, [isFullscreen, seekFromEvent]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    seekFromEvent(e.clientX, e.clientY);
  }, [isDragging, seekFromEvent]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    const v = isFullscreen ? fullVideoRef.current : thumbVideoRef.current;
    if (v && isPlaying) v.play().catch(() => {});
  }, [isDragging, isPlaying]);

  // ── Handle position on circle ──
  const handleAngle = (progress / 100) * 360 - 90;
  const handleRad = handleAngle * (Math.PI / 180);
  const handleX = 50 + 48 * Math.cos(handleRad);
  const handleY = 50 + 48 * Math.sin(handleRad);

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <>
      {/* ── Fullscreen overlay ── */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[9999] flex items-center justify-center"
            onClick={() => {
              fullVideoRef.current?.pause();
              setIsPlaying(false);
              setIsFullscreen(false);
              setProgress(0);
              setCurrentTime(0);
            }}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-[min(90vw,400px)] h-[min(90vw,400px)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Glass rim */}
              <div className="absolute inset-[-6px] rounded-full bg-white/[0.08] backdrop-blur-[6px] border border-white/30 pointer-events-none" />

              {/* Video circle */}
              <div className="relative w-full h-full rounded-full overflow-hidden">
                <video
                  ref={fullVideoRef}
                  src={videoUrl}
                  loop
                  playsInline
                  preload="metadata"
                  poster={thumbnail || undefined}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Progress ring wrapper */}
              <div
                ref={progressWrapperRef}
                className="absolute inset-[-4px] rounded-full z-10 cursor-pointer touch-none"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
              >
                {/* Ring background */}
                <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
                  <circle
                    cx="50" cy="50" r="48" fill="none"
                    stroke="white" strokeWidth="3" strokeLinecap="round"
                    strokeDasharray={`${(progress / 100) * circumference} ${circumference}`}
                  />
                </svg>

                {/* Handle dot */}
                <div
                  className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-opacity"
                  style={{
                    left: `${handleX}%`,
                    top: `${handleY}%`,
                    transform: 'translate(-50%,-50%)',
                    opacity: isDragging ? 1 : 0,
                  }}
                />
              </div>

              {/* Play/Pause overlay */}
              <div
                className="absolute inset-0 rounded-full flex items-center justify-center z-20 pointer-events-none transition-opacity"
                style={{
                  opacity: isPlaying && !isDragging ? 0 : 1,
                  background: 'rgba(0,0,0,0.15)',
                  backdropFilter: 'blur(2px)',
                }}
              >
                <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center shadow-lg pointer-events-auto" onClick={togglePlay}>
                  {isPlaying ? (
                    <Pause size={28} className="text-white" fill="white" />
                  ) : (
                    <Play size={28} className="text-white ml-1" fill="white" />
                  )}
                </div>
              </div>

              {/* Mute button */}
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={toggleMute}
                className="absolute top-4 right-4 p-3 rounded-full bg-black/50 hover:bg-black/70 transition-colors z-30"
              >
                {isMuted ? <VolumeX size={20} className="text-white" /> : <Volume2 size={20} className="text-white" />}
              </motion.button>

              {/* Time display */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-medium z-30">
                {formatTime(currentTime)} / {formatTime(duration || 0)}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Inline thumbnail (200x200 circle) ── */}
      <div
        className="relative w-[200px] h-[200px] cursor-pointer group"
        onClick={togglePlay}
      >
        {/* Glass rim */}
        <div className="absolute inset-[-6px] rounded-full bg-white/[0.08] backdrop-blur-[6px] border border-white/30 pointer-events-none" />

        {/* Video circle */}
        <div className="relative w-full h-full rounded-full overflow-hidden">
          <video
            ref={thumbVideoRef}
            src={videoUrl}
            muted
            loop
            playsInline
            preload="metadata"
            poster={thumbnail || undefined}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Progress ring wrapper */}
        <div
          ref={isFullscreen ? undefined : progressWrapperRef}
          className="absolute inset-[-4px] rounded-full z-10 cursor-pointer touch-none"
          onPointerDown={!isFullscreen ? onPointerDown : undefined}
          onPointerMove={!isFullscreen ? onPointerMove : undefined}
          onPointerUp={!isFullscreen ? onPointerUp : undefined}
        >
          <svg className="w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="48" fill="none"
              stroke="white" strokeWidth="3" strokeLinecap="round"
              strokeDasharray={`${(progress / 100) * circumference} ${circumference}`}
            />
          </svg>
          <div
            className="absolute w-3 h-3 bg-white rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)] transition-opacity"
            style={{
              left: `${handleX}%`,
              top: `${handleY}%`,
              transform: 'translate(-50%,-50%)',
              opacity: isDragging ? 1 : 0,
            }}
          />
        </div>

        {/* Play/Pause overlay */}
        <div
          className="absolute inset-0 rounded-full flex items-center justify-center z-20 transition-opacity pointer-events-none"
          style={{
            opacity: isPlaying && !isDragging ? 0 : 1,
            background: 'rgba(0,0,0,0.15)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div className="w-16 h-16 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center shadow-lg pointer-events-auto" onClick={(e) => { e.stopPropagation(); togglePlay(); }}>
            {isPlaying ? (
              <Pause size={28} className="text-white" fill="white" />
            ) : (
              <Play size={28} className="text-white ml-1" fill="white" />
            )}
          </div>
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/70 backdrop-blur-sm text-white text-xs font-medium z-30">
          {formatTime(duration || 0)}
        </div>
      </div>
    </>
  );
}
