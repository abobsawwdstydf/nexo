import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Play, Pause, SkipForward, SkipBack, Volume2 } from 'lucide-react';
import { api } from '../lib/api';

interface Track {
  id: string;
  title: string;
  artist?: string;
  url: string;
  duration?: number;
  coverUrl?: string;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  tracks: Track[];
  _count?: { tracks: number };
}

interface PlaylistEmbedPreviewProps {
  playlistId: string;
}

export default function PlaylistEmbedPreview({ playlistId }: PlaylistEmbedPreviewProps) {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadPlaylist();
  }, [playlistId]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
    };
    const handleEnded = () => nextTrack();

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [currentTrackIndex, playlist]);

  const loadPlaylist = async () => {
    setLoading(true);
    try {
      const data = await api.get<{ playlist: Playlist }>(`/playlists/${playlistId}`);
      setPlaylist(data.playlist);
    } catch (err) {
      console.error('Failed to load playlist:', err);
    } finally {
      setLoading(false);
    }
  };

  const playTrack = (index: number) => {
    if (!playlist || !playlist.tracks[index]) return;
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = playlist.tracks[index].url;
        audioRef.current.play().catch(() => setIsPlaying(false));
      }
    }, 50);
  };

  const togglePlay = () => {
    if (!audioRef.current || !playlist?.tracks[currentTrackIndex]) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => setIsPlaying(false));
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    if (!playlist) return;
    const next = (currentTrackIndex + 1) % playlist.tracks.length;
    playTrack(next);
  };

  const prevTrack = () => {
    if (!playlist) return;
    const prev = (currentTrackIndex - 1 + playlist.tracks.length) % playlist.tracks.length;
    playTrack(prev);
  };

  if (loading) {
    return (
      <div className="my-2 p-4 rounded-xl bg-white/5 border border-white/10 animate-pulse">
        <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
        <div className="h-3 bg-white/10 rounded w-1/3" />
      </div>
    );
  }

  if (!playlist) return null;

  const currentTrack = playlist.tracks[currentTrackIndex];
  const trackCount = playlist._count?.tracks ?? playlist.tracks.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="my-2 p-3 rounded-xl bg-gradient-to-br from-purple-900/30 to-purple-800/20 border border-purple-500/30 backdrop-blur-sm"
    >
      {/* Заголовок плейлиста */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
          {playlist.coverUrl ? (
            <img src={playlist.coverUrl} alt="" className="w-full h-full rounded-xl object-cover" />
          ) : (
            <Music className="w-6 h-6 text-purple-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white truncate text-sm">{playlist.name}</p>
          <p className="text-xs text-white/50">
            {trackCount} {trackCount === 1 ? 'трек' : trackCount < 5 ? 'трека' : 'треков'}
          </p>
        </div>
      </div>

      {/* Текущий трек */}
      {playlist.tracks.length > 0 && currentTrack && (
        <>
          <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-white/5">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-white truncate font-medium">{currentTrack.title}</p>
              {currentTrack.artist && (
                <p className="text-xs text-white/40 truncate">{currentTrack.artist}</p>
              )}
            </div>
          </div>

          {/* Прогресс-бар */}
          <div
            className="h-1 bg-white/10 rounded-full mb-2 cursor-pointer"
            onClick={(e) => {
              if (!audioRef.current) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const ratio = (e.clientX - rect.left) / rect.width;
              audioRef.current.currentTime = ratio * (audioRef.current.duration || 0);
            }}
          >
            <div
              className="h-full bg-purple-500 rounded-full transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Управление */}
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={prevTrack}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              disabled={playlist.tracks.length <= 1}
            >
              <SkipBack className="w-4 h-4 text-white/70" />
            </button>
            <button
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-purple-500 hover:bg-purple-600 flex items-center justify-center transition-colors"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 text-white" />
              ) : (
                <Play className="w-4 h-4 text-white ml-0.5" />
              )}
            </button>
            <button
              onClick={nextTrack}
              className="p-1.5 rounded-full hover:bg-white/10 transition-colors"
              disabled={playlist.tracks.length <= 1}
            >
              <SkipForward className="w-4 h-4 text-white/70" />
            </button>
          </div>
        </>
      )}

      {/* Список треков (свернутый) */}
      {playlist.tracks.length > 1 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="max-h-32 overflow-y-auto space-y-1">
            {playlist.tracks.map((track, index) => (
              <button
                key={track.id}
                onClick={() => playTrack(index)}
                className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors text-left ${
                  index === currentTrackIndex && isPlaying
                    ? 'bg-purple-500/20 border border-purple-500/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center flex-shrink-0 text-xs text-white/40">
                  {index === currentTrackIndex && isPlaying ? (
                    <Volume2 className="w-3 h-3 text-purple-400 animate-pulse" />
                  ) : (
                    index + 1
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white truncate">{track.title}</p>
                  {track.artist && (
                    <p className="text-[10px] text-white/30 truncate">{track.artist}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Скрытый аудио элемент */}
      <audio ref={audioRef} />
    </motion.div>
  );
}
