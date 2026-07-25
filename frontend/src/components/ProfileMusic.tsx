import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Play, Pause, Music, Loader2, ListMusic } from 'lucide-react';
import { api } from '../lib/api';
import { useMusicPlayerStore, MusicTrack } from '../stores/musicPlayerStore';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import ProfileMusicUploadModal from './ProfileMusicUploadModal';

interface Track {
  id: string;
  name: string;
  url: string;
  duration: number;
  uploadedAt: string;
}

interface ProfileMusicProps {
  userId: string;
  isOwner: boolean;
}

export default function ProfileMusic({ userId, isOwner }: ProfileMusicProps) {
  const { playTrack, currentTrack, isPlaying, pauseTrack, resumeTrack } = useMusicPlayerStore();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadTracks();
  }, [userId]);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const data = await api.get(`/profile-music/${userId}`);
      const tracksList = Array.isArray(data) ? data : (data as any)?.tracks || [];
      setTracks(tracksList);
    } catch (e) {
      console.error('Failed to load profile music:', e);
      setTracks([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (trackId: string) => {
    if (!confirm('Удалить трек из профиля?')) return;
    try {
      await api.delete(`/profile-music/${trackId}`);
      setTracks(prev => prev.filter(t => t.id !== trackId));
    } catch {
      alert('Ошибка удаления');
    }
  };

  const handlePlayTrack = (track: Track) => {
    const playerTrack: MusicTrack = {
      id: track.id,
      url: normalizeMediaUrl(track.url),
      title: track.name,
      duration: track.duration,
    };
    const queue: MusicTrack[] = tracks.map(t => ({
      id: t.id,
      url: normalizeMediaUrl(t.url),
      title: t.name,
      duration: t.duration,
    }));

    if (currentTrack?.id === track.id) {
      isPlaying ? pauseTrack() : resumeTrack();
    } else {
      playTrack(playerTrack, queue);
    }
  };

  const handlePlayAll = () => {
    if (tracks.length === 0) return;
    handlePlayTrack(tracks[0]);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-nexo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Music size={18} className="text-nexo-400" />
          <h3 className="text-sm font-semibold text-white">Музыка профиля</h3>
          <span className="text-xs text-zinc-500">({tracks.length}/10)</span>
        </div>
        <div className="flex items-center gap-2">
          {tracks.length > 1 && (
            <button
              onClick={handlePlayAll}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-nexo-500/20 hover:bg-nexo-500/30 text-nexo-400 text-xs font-medium transition-colors"
            >
              <ListMusic size={12} />
              Все
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => setShowUploadModal(true)}
              disabled={tracks.length >= 10}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 text-xs font-medium transition-colors disabled:opacity-40"
            >
              <Plus size={12} />
              Добавить
            </button>
          )}
        </div>
      </div>

      {/* Tracks */}
      {tracks.length === 0 ? (
        <div className="text-center py-6 text-zinc-500">
          <Music size={28} className="mx-auto mb-2 opacity-40" />
          <p className="text-sm">Нет треков</p>
          {isOwner && <p className="text-xs mt-1 text-zinc-600">Добавьте любимую музыку в профиль</p>}
        </div>
      ) : (
        <div className="space-y-1">
          <AnimatePresence>
            {tracks.map((track, i) => {
              const isCurrentTrack = currentTrack?.id === track.id;
              const isCurrentPlaying = isCurrentTrack && isPlaying;
              return (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors group ${
                    isCurrentTrack
                      ? 'bg-nexo-500/15 border border-nexo-500/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {/* Play button */}
                  <button
                    onClick={() => handlePlayTrack(track)}
                    className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all ${
                      isCurrentTrack
                        ? 'bg-nexo-500 shadow-lg shadow-nexo-500/30'
                        : 'bg-white/10 hover:bg-nexo-500/30'
                    }`}
                  >
                    {isCurrentPlaying ? (
                      <Pause size={14} className="text-white" />
                    ) : (
                      <Play size={14} className={`${isCurrentTrack ? 'text-white' : 'text-zinc-300'} ml-0.5`} />
                    )}
                  </button>

                  {/* Track info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCurrentTrack ? 'text-nexo-300' : 'text-white'}`}>
                      {track.name}
                    </p>
                    <p className="text-xs text-zinc-500">{formatTime(track.duration)}</p>
                  </div>

                  {/* Animated bars when playing */}
                  {isCurrentPlaying && (
                    <div className="flex items-end gap-0.5 h-4 flex-shrink-0">
                      {[1, 2, 3].map(bar => (
                        <div
                          key={bar}
                          className="w-1 bg-nexo-400 rounded-full"
                          style={{
                            height: `${40 + bar * 20}%`,
                            animation: `musicBar${bar} 0.8s ease-in-out infinite alternate`,
                            animationDelay: `${bar * 0.15}s`,
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Delete */}
                  {isOwner && (
                    <button
                      onClick={() => handleDelete(track.id)}
                      className="flex-shrink-0 p-1.5 rounded-lg text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* CSS for music bars animation */}
      <style>{`
        @keyframes musicBar1 { from { height: 30% } to { height: 80% } }
        @keyframes musicBar2 { from { height: 60% } to { height: 30% } }
        @keyframes musicBar3 { from { height: 40% } to { height: 90% } }
      `}</style>

      <ProfileMusicUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploaded={(track) => setTracks(prev => [...prev, track])}
      />
    </div>
  );
}
