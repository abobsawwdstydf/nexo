import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Music, Play, Pause, Volume2, Trash2, Edit3, Check, Image as ImageIcon, Loader2, ListMusic } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useMusicPlayerStore } from '../stores/musicPlayerStore';
import { useToastStore } from '../stores/toastStore';
import BottomSheet from './BottomSheet';

interface Playlist {
  id: string;
  name: string;
  coverUrl?: string;
  createdAt: string;
  tracks: PlaylistTrack[];
}

interface PlaylistTrack {
  id: string;
  url: string;
  filename: string;
  duration: number;
  volume: number;
  order: number;
}

interface MusicPlaylistsModalProps {
  onClose: () => void;
}

export default function MusicPlaylistsModal({ onClose }: MusicPlaylistsModalProps) {
  const { user } = useAuthStore();
  const { playTrack, isPlaying, currentTrack } = useMusicPlayerStore();
  
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    loadPlaylists();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadPlaylists = async () => {
    try {
      setLoading(true);
      const data = await api.get<Playlist[]>('/music-playlists');
      setPlaylists(data || []);
    } catch (e) {
      console.error('Failed to load playlists:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlaylist = async () => {
    if (!playlistName.trim()) return;
    
    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append('name', playlistName.trim());
      if (coverFile) {
        formData.append('cover', coverFile);
      }

      const newPlaylist = await api.post<Playlist>('/music-playlists', formData);
      setPlaylists(prev => [newPlaylist, ...prev]);
      setIsCreating(false);
      setPlaylistName('');
      setCoverFile(null);
      setCoverPreview(null);
    } catch (e) {
      console.error('Failed to create playlist:', e);
      alert('Ошибка создания плейлиста');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePlaylist = async () => {
    if (!selectedPlaylist || !playlistName.trim()) return;
    
    try {
      setIsSaving(true);
      const formData = new FormData();
      formData.append('name', playlistName.trim());
      if (coverFile) {
        formData.append('cover', coverFile);
      }

      const updated = await api.put<Playlist>(`/music-playlists/${selectedPlaylist.id}`, formData);
      setPlaylists(prev => prev.map(p => p.id === updated.id ? updated : p));
      setSelectedPlaylist(updated);
      setIsEditing(false);
      setPlaylistName('');
      setCoverFile(null);
      setCoverPreview(null);
    } catch (e) {
      console.error('Failed to update playlist:', e);
      alert('Ошибка обновления плейлиста');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePlaylist = async (id: string) => {
    if (!confirm('Удалить плейлист?')) return;
    
    try {
      await api.delete(`/music-playlists/${id}`);
      setPlaylists(prev => prev.filter(p => p.id !== id));
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
      }
    } catch (e) {
      console.error('Failed to delete playlist:', e);
      alert('Ошибка удаления плейлиста');
    }
  };

  const handlePlayPlaylist = (playlist: Playlist) => {
    const tracks = playlist.tracks.sort((a, b) => a.order - b.order).map(t => ({
      id: t.id,
      url: t.url,
      title: t.filename,
      duration: t.duration,
    }));
    if (tracks.length > 0) {
      playTrack(tracks[0], tracks);
    }
  };

  const { success: showSuccess, error: showError } = useToastStore();
  const [isUploading, setIsUploading] = useState(false);

  const handleAddTrackToProfile = async (track: PlaylistTrack) => {
    try {
      setIsUploading(true);
      const response = await fetch(track.url);
      if (!response.ok) throw new Error('Failed to fetch audio');
      const blob = await response.blob();
      const file = new File([blob], track.filename || 'track.mp3', { type: blob.type || 'audio/mpeg' });
      const formData = new FormData();
      formData.append('audio', file);
      formData.append('duration', String(track.duration || 0));
      const uploadResponse = await fetch('/api/profile-music', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!uploadResponse.ok) throw new Error('Upload failed');
      showSuccess('Трек добавлен в профиль!');
    } catch (e) {
      console.error('Failed to add track to profile:', e);
      showError('Ошибка добавления трека в профиль');
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddPlaylistToProfile = async (playlist: Playlist) => {
    try {
      setIsUploading(true);
      let added = 0;
      for (const track of playlist.tracks) {
        try {
          const response = await fetch(track.url);
          if (!response.ok) continue;
          const blob = await response.blob();
          const file = new File([blob], track.filename || 'track.mp3', { type: blob.type || 'audio/mpeg' });
          const formData = new FormData();
          formData.append('audio', file);
          formData.append('duration', String(track.duration || 0));
          const uploadResponse = await fetch('/api/profile-music', {
            method: 'POST',
            credentials: 'include',
            body: formData,
          });
          if (uploadResponse.ok) added++;
        } catch (e) {
          console.error('Failed to upload track:', track.filename, e);
        }
      }
      showSuccess(`Добавлено ${added} из ${playlist.tracks.length} треков в профиль!`);
    } catch (e) {
      console.error('Failed to add playlist to profile:', e);
      showError('Ошибка добавления плейлиста в профиль');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <>
      {isMobile ? (
        <BottomSheet isOpen={true} onClose={onClose} showCloseButton={false}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
                <ListMusic size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Плейлисты</h2>
                <p className="text-xs text-zinc-500">Управление музыкальными плейлистами</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={32} className="animate-spin text-nexo-500" />
              </div>
            ) : (
              <>
                <button
                  onClick={() => setIsCreating(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexo-500/10 hover:bg-nexo-500/20 border border-nexo-500/30 text-nexo-400 transition-colors mb-4"
                >
                  <Plus size={18} />
                  <span className="font-medium">Создать плейлист</span>
                </button>

                <div className="grid grid-cols-1 gap-3">
                  {playlists.map(playlist => (
                    <div
                      key={playlist.id}
                      className="group relative bg-surface-tertiary/50 hover:bg-surface-tertiary rounded-xl p-4 transition-all cursor-pointer"
                      onClick={() => setSelectedPlaylist(playlist)}
                    >
                      <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-nexo-500/20 to-purple-600/20">
                        {playlist.coverUrl ? (
                          <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music size={32} className="text-zinc-600" />
                          </div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayPlaylist(playlist);
                          }}
                          className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <div className="w-12 h-12 rounded-full bg-nexo-500 flex items-center justify-center">
                            <Play size={20} className="text-white ml-0.5" />
                          </div>
                        </button>
                      </div>

                      <h3 className="font-semibold text-white text-sm mb-1 truncate">{playlist.name}</h3>
                      <p className="text-xs text-zinc-500">{playlist.tracks.length} треков</p>

                      <div className="flex gap-1 mt-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddPlaylistToProfile(playlist);
                          }}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 hover:text-white transition-colors"
                        >
                          В профиль
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePlaylist(playlist.id);
                          }}
                          className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {playlists.length === 0 && (
                  <div className="text-center py-12">
                    <Music size={48} className="mx-auto text-zinc-600 mb-3" />
                    <p className="text-zinc-500">Нет плейлистов</p>
                    <p className="text-xs text-zinc-600 mt-1">Создайте свой первый плейлист</p>
                  </div>
                )}
              </>
            )}
          </div>
        </BottomSheet>
      ) : (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-[600px] sm:max-w-[calc(100%-32px)] sm:max-h-[80vh] bg-[#1a1a1a] rounded-none sm:rounded-2xl border-0 sm:border sm:border-white/10 shadow-2xl z-50 flex flex-col overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
                  <ListMusic size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Плейлисты</h2>
                  <p className="text-xs text-zinc-500">Управление музыкальными плейлистами</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={32} className="animate-spin text-nexo-500" />
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setIsCreating(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexo-500/10 hover:bg-nexo-500/20 border border-nexo-500/30 text-nexo-400 transition-colors mb-4"
                  >
                    <Plus size={18} />
                    <span className="font-medium">Создать плейлист</span>
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {playlists.map(playlist => (
                      <div
                        key={playlist.id}
                        className="group relative bg-surface-tertiary/50 hover:bg-surface-tertiary rounded-xl p-4 transition-all cursor-pointer"
                        onClick={() => setSelectedPlaylist(playlist)}
                      >
                        <div className="relative w-full aspect-square rounded-lg overflow-hidden mb-3 bg-gradient-to-br from-nexo-500/20 to-purple-600/20">
                          {playlist.coverUrl ? (
                            <img src={playlist.coverUrl} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music size={32} className="text-zinc-600" />
                            </div>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePlayPlaylist(playlist);
                            }}
                            className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <div className="w-12 h-12 rounded-full bg-nexo-500 flex items-center justify-center">
                              <Play size={20} className="text-white ml-0.5" />
                            </div>
                          </button>
                        </div>

                        <h3 className="font-semibold text-white text-sm mb-1 truncate">{playlist.name}</h3>
                        <p className="text-xs text-zinc-500">{playlist.tracks.length} треков</p>

                        <div className="flex gap-1 mt-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddPlaylistToProfile(playlist);
                            }}
                            className="flex-1 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-zinc-400 hover:text-white transition-colors"
                          >
                            В профиль
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlaylist(playlist.id);
                            }}
                            className="px-2 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {playlists.length === 0 && (
                    <div className="text-center py-12">
                      <Music size={48} className="mx-auto text-zinc-600 mb-3" />
                      <p className="text-zinc-500">Нет плейлистов</p>
                      <p className="text-xs text-zinc-600 mt-1">Создайте свой первый плейлист</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Create/Edit Modal */}
      <AnimatePresence>
        {(isCreating || isEditing) && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              onClick={() => {
                setIsCreating(false);
                setIsEditing(false);
                setPlaylistName('');
                setCoverFile(null);
                setCoverPreview(null);
              }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] max-w-[calc(100%-32px)] bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl z-[60] p-5"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-4">
                {isCreating ? 'Создать плейлист' : 'Редактировать плейлист'}
              </h3>

              {/* Cover upload */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Обложка</label>
                <input
                  ref={coverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCoverSelect}
                  className="hidden"
                />
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="w-full aspect-square rounded-xl bg-surface-tertiary hover:bg-surface-hover border-2 border-dashed border-white/10 hover:border-nexo-500/50 transition-colors flex items-center justify-center overflow-hidden"
                >
                  {coverPreview ? (
                    <img src={coverPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center">
                      <ImageIcon size={32} className="mx-auto text-zinc-600 mb-2" />
                      <p className="text-xs text-zinc-500">Выбрать обложку</p>
                    </div>
                  )}
                </button>
              </div>

              {/* Name input */}
              <div className="mb-4">
                <label className="block text-sm text-zinc-400 mb-2">Название</label>
                <input
                  type="text"
                  value={playlistName}
                  onChange={e => setPlaylistName(e.target.value)}
                  placeholder="Мой плейлист"
                  className="w-full px-4 py-2.5 rounded-xl bg-surface-tertiary border border-white/10 text-white placeholder-zinc-600 focus:border-nexo-500 transition-colors"
                  autoFocus
                />
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setIsCreating(false);
                    setIsEditing(false);
                    setPlaylistName('');
                    setCoverFile(null);
                    setCoverPreview(null);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={isCreating ? handleCreatePlaylist : handleUpdatePlaylist}
                  disabled={!playlistName.trim() || isSaving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Сохранение...
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      {isCreating ? 'Создать' : 'Сохранить'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Playlist Details Modal */}
      <AnimatePresence>
        {selectedPlaylist && !isEditing && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              onClick={() => setSelectedPlaylist(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] max-w-[calc(100%-32px)] max-h-[80vh] bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl z-[60] flex flex-col overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <h3 className="text-lg font-bold text-white">{selectedPlaylist.name}</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setPlaylistName(selectedPlaylist.name);
                      setCoverPreview(selectedPlaylist.coverUrl || null);
                      setIsEditing(true);
                    }}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => setSelectedPlaylist(null)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Tracks list */}
              <div className="flex-1 overflow-y-auto p-5">
                {selectedPlaylist.tracks.length === 0 ? (
                  <div className="text-center py-12">
                    <Music size={48} className="mx-auto text-zinc-600 mb-3" />
                    <p className="text-zinc-500">Нет треков</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedPlaylist.tracks.sort((a, b) => a.order - b.order).map((track, idx) => (
                      <div
                        key={track.id}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-surface-tertiary/50 hover:bg-surface-tertiary transition-colors"
                      >
                        <span className="text-sm text-zinc-600 font-mono w-6">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{track.filename}</p>
                          <p className="text-xs text-zinc-500">{formatDuration(track.duration)}</p>
                        </div>
                        <button
                          onClick={() => handleAddTrackToProfile(track)}
                          className="px-3 py-1.5 rounded-lg bg-nexo-500/10 hover:bg-nexo-500/20 text-nexo-400 text-xs transition-colors"
                        >
                          В профиль
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-5 py-4 border-t border-white/5">
                <button
                  onClick={() => handlePlayPlaylist(selectedPlaylist)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors"
                >
                  <Play size={18} />
                  Воспроизвести плейлист
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
