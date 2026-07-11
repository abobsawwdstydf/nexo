import { useState, useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Film, Upload, Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';

interface VideoShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShare: (url: string, type: 'file' | 'url') => void;
  sharedVideoUrl?: string | null;
  isSharing?: boolean;
  remoteVideoUrl?: string | null;
  currentTime?: number;
  isPlaying?: boolean;
  onTimeUpdate?: (time: number) => void;
  onPlayPause?: (playing: boolean) => void;
  isMine?: boolean;
}

export default function VideoShareModal({
  isOpen,
  onClose,
  onShare,
  sharedVideoUrl,
  isSharing,
  remoteVideoUrl,
  currentTime,
  isPlaying: externalIsPlaying,
  onTimeUpdate,
  onPlayPause,
  isMine,
}: VideoShareModalProps) {
  const [urlInput, setUrlInput] = useState('');
  const [tab, setTab] = useState<'file' | 'url'>('file');
  const [localVideoUrl, setLocalVideoUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTimeLocal, setCurrentTimeLocal] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeUrl = isMine ? (localVideoUrl || sharedVideoUrl) : remoteVideoUrl;

  useEffect(() => {
    if (!isMine && videoRef.current && currentTime !== undefined) {
      const diff = Math.abs(videoRef.current.currentTime - currentTime);
      if (diff > 1) videoRef.current.currentTime = currentTime;
    }
  }, [currentTime, isMine]);

  useEffect(() => {
    if (!isMine && videoRef.current && externalIsPlaying !== undefined) {
      if (externalIsPlaying && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
        setPlaying(true);
      } else if (!externalIsPlaying && !videoRef.current.paused) {
        videoRef.current.pause();
        setPlaying(false);
      }
    }
  }, [externalIsPlaying, isMine]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setLocalVideoUrl(url);
    onShare(url, 'file');
  };

  const handleUrlShare = () => {
    if (!urlInput.trim()) return;
    onShare(urlInput.trim(), 'url');
  };

  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play().catch(() => {});
      setPlaying(true);
      onPlayPause?.(true);
    } else {
      videoRef.current.pause();
      setPlaying(false);
      onPlayPause?.(false);
    }
  }, [onPlayPause]);

  const handleVideoTimeUpdate = useCallback(() => {
    if (!videoRef.current) return;
    const t = videoRef.current.currentTime;
    const d = videoRef.current.duration || 1;
    setCurrentTimeLocal(t);
    setProgress((t / d) * 100);
    if (isMine) {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      syncTimeoutRef.current = setTimeout(() => {
        onTimeUpdate?.(t);
      }, 500);
    }
  }, [isMine, onTimeUpdate]);

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current) return;
    const val = parseFloat(e.target.value);
    const newTime = (val / 100) * (videoRef.current.duration || 0);
    videoRef.current.currentTime = newTime;
    setProgress(val);
    onTimeUpdate?.(newTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    setMuted(val === 0);
  };

  const skip = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, videoRef.current.duration));
    onTimeUpdate?.(videoRef.current.currentTime);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-2xl bg-[#0a0a0f] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Film size={16} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">
                {isMine ? 'Трансляция видео' : 'Совместный просмотр'}
              </h3>
              <p className="text-xs text-zinc-500">
                {isSharing ? '🔴 Идёт трансляция' : isMine ? 'Выберите видео для трансляции' : 'Ожидание видео...'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Video player */}
        {activeUrl ? (
          <div className="relative bg-black">
            <video
              ref={videoRef}
              src={activeUrl}
              className="w-full max-h-[400px] object-contain"
              onTimeUpdate={handleVideoTimeUpdate}
              onLoadedMetadata={() => setDuration(videoRef.current?.duration || 0)}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              muted={muted}
            />
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
              <input
                type="range"
                min={0}
                max={100}
                value={progress}
                onChange={isMine ? handleSeek : undefined}
                disabled={!isMine}
                className="w-full h-1 mb-3 accent-purple-500 cursor-pointer disabled:cursor-default"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isMine && (
                    <>
                      <button onClick={() => skip(-10)} className="text-white/70 hover:text-white transition-colors">
                        <SkipBack size={18} />
                      </button>
                      <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition-colors">
                        {playing ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button onClick={() => skip(10)} className="text-white/70 hover:text-white transition-colors">
                        <SkipForward size={18} />
                      </button>
                    </>
                  )}
                  <span className="text-xs text-white/60 font-mono">
                    {formatTime(currentTimeLocal)} / {formatTime(duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setMuted(m => !m)} className="text-white/70 hover:text-white transition-colors">
                    {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={muted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 accent-purple-500"
                  />
                </div>
              </div>
            </div>
          </div>
        ) : isMine ? (
          <div className="p-6">
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab('file')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'file' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-400 hover:bg-white/5'}`}
              >
                Файл
              </button>
              <button
                onClick={() => setTab('url')}
                className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors ${tab === 'url' ? 'bg-purple-500/20 text-purple-400' : 'text-zinc-400 hover:bg-white/5'}`}
              >
                Ссылка
              </button>
            </div>
            {tab === 'file' ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 rounded-2xl border-2 border-dashed border-white/10 hover:border-purple-500/50 flex flex-col items-center gap-3 text-zinc-400 hover:text-purple-400 transition-colors"
              >
                <Upload size={32} />
                <span className="text-sm">Нажмите чтобы выбрать видео</span>
                <span className="text-xs text-zinc-600">MP4, WebM, MOV</span>
              </button>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://example.com/video.mp4"
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
                  onKeyDown={e => e.key === 'Enter' && handleUrlShare()}
                />
                <button
                  onClick={handleUrlShare}
                  className="px-4 py-3 rounded-xl bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium transition-colors"
                >
                  Транслировать
                </button>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelect} />
          </div>
        ) : (
          <div className="p-12 flex flex-col items-center gap-4 text-zinc-500">
            <Film size={48} className="opacity-30" />
            <p className="text-sm">Ожидание трансляции...</p>
          </div>
        )}

        {isMine && isSharing && (
          <div className="px-5 py-4 border-t border-white/5">
            <button
              onClick={onClose}
              className="w-full py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-medium transition-colors"
            >
              Остановить трансляцию
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
