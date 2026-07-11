import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Music, Plus, Trash2, Play, Pause, SkipForward, SkipBack,
  Users, Edit3, Check, Search, Volume2, GripVertical, ListMusic, Upload, Share2
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { getSocket } from '../lib/socket';
import SidePanelWrapper from './SidePanelWrapper';

interface Track {
  id: string;
  title: string;
  artist?: string;
  url: string;
  duration?: number;
  coverUrl?: string;
  addedBy: string;
  order: number;
}

interface Playlist {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  chatId?: string;
  isPublic: boolean;
  coverUrl?: string;
  tracks: Track[];
  members: any[];
  _count?: { tracks: number; members: number };
}

interface CollabPlaylistModalProps {
  chatId?: string;
  onClose: () => void;
  embedded?: boolean;
}

export default function CollabPlaylistModal({ chatId, onClose, embedded }: CollabPlaylistModalProps) {
  const { user } = useAuthStore();
  const { success, error: showError } = useToastStore();

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'playlist' | 'create'>('list');

  // Player state
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Create form
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  // Add track form
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [trackTitle, setTrackTitle] = useState('');
  const [trackArtist, setTrackArtist] = useState('');
  const [trackUrl, setTrackUrl] = useState('');
  const [addingTrack, setAddingTrack] = useState(false);
  const [uploadingTrack, setUploadingTrack] = useState(false);
  const trackFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadPlaylists();
  }, [chatId]);

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
  }, [selectedPlaylist, currentTrackIndex]);

  const loadPlaylists = async () => {
    setLoading(true);
    try {
      const endpoint = chatId ? `/playlists/chat/${chatId}` : '/playlists';
      const data = await api.get<{ playlists: Playlist[] }>(endpoint);
      setPlaylists(data.playlists || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const createPlaylist = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const data = await api.post<{ playlist: Playlist }>('/playlists', {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
        chatId: chatId || undefined,
      });
      setPlaylists(prev => [data.playlist, ...prev]);
      setNewName('');
      setNewDesc('');
      setView('list');
      success('Плейлист создан');
    } catch (e: any) {
      showError(e.message || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const deletePlaylist = async (id: string) => {
    try {
      await api.delete(`/playlists/${id}`);
      setPlaylists(prev => prev.filter(p => p.id !== id));
      if (selectedPlaylist?.id === id) {
        setSelectedPlaylist(null);
        setView('list');
      }
      success('Плейлист удалён');
    } catch (e: any) {
      showError(e.message || 'Ошибка');
    }
  };

  const openPlaylist = async (playlist: Playlist) => {
    try {
      const data = await api.get<{ playlist: Playlist }>(`/playlists/${playlist.id}`);
      setSelectedPlaylist(data.playlist);
      setCurrentTrackIndex(0);
      setIsPlaying(false);
      setView('playlist');
    } catch {
      setSelectedPlaylist(playlist);
      setView('playlist');
    }
  };

  const addTrack = async () => {
    if (!selectedPlaylist || !trackTitle.trim() || !trackUrl.trim()) return;
    setAddingTrack(true);
    try {
      const data = await api.post<{ track: Track }>(`/playlists/${selectedPlaylist.id}/tracks`, {
        title: trackTitle.trim(),
        artist: trackArtist.trim() || undefined,
        url: trackUrl.trim(),
      });
      setSelectedPlaylist(prev => prev ? { ...prev, tracks: [...prev.tracks, data.track] } : prev);
      setTrackTitle('');
      setTrackArtist('');
      setTrackUrl('');
      setShowAddTrack(false);
      success('Трек добавлен');

      // Notify via socket
      const socket = getSocket();
      if (socket) {
        socket.emit('playlist:track_added', { playlistId: selectedPlaylist.id, track: data.track });
      }
    } catch (e: any) {
      showError(e.message || 'Ошибка добавления');
    } finally {
      setAddingTrack(false);
    }
  };

  const handleTrackFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isAudio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|opus)$/i.test(file.name);
    if (!isAudio) { showError('Выберите аудио файл'); return; }
    if (file.size > 50 * 1024 * 1024) { showError('Файл не более 50MB'); return; }
    setUploadingTrack(true);
    try {
      const result = await api.uploadFile(file);
      if (result?.url) {
        setTrackUrl(result.url);
        if (!trackTitle.trim()) {
          // Автозаполнение названия из имени файла
          setTrackTitle(file.name.replace(/\.[^.]+$/, ''));
        }
        success('Файл загружен');
      }
    } catch (e: any) {
      showError(e.message || 'Ошибка загрузки');
    } finally {
      setUploadingTrack(false);
      if (trackFileRef.current) trackFileRef.current.value = '';
    }
  };

  const handleSharePlaylist = async (playlistId: string) => {
    const url = `${window.location.origin}/?playlist=${playlistId}`;
    try {
      await navigator.clipboard.writeText(url);
      success('Ссылка на плейлист скопирована!');
    } catch {
      showError('Не удалось скопировать ссылку');
    }
  };

  const removeTrack = async (trackId: string) => {
    if (!selectedPlaylist) return;
    try {
      await api.delete(`/playlists/${selectedPlaylist.id}/tracks/${trackId}`);
      setSelectedPlaylist(prev => prev ? { ...prev, tracks: prev.tracks.filter(t => t.id !== trackId) } : prev);

      const socket = getSocket();
      if (socket) {
        socket.emit('playlist:track_removed', { playlistId: selectedPlaylist.id, trackId });
      }
    } catch (e: any) {
      showError(e.message || 'Ошибка');
    }
  };

  const playTrack = (index: number) => {
    setCurrentTrackIndex(index);
    setIsPlaying(true);
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = selectedPlaylist?.tracks[index]?.url || '';
        audioRef.current.play().catch(() => {});
      }
    }, 50);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const nextTrack = () => {
    if (!selectedPlaylist) return;
    const next = (currentTrackIndex + 1) % selectedPlaylist.tracks.length;
    playTrack(next);
  };

  const prevTrack = () => {
    if (!selectedPlaylist) return;
    const prev = (currentTrackIndex - 1 + selectedPlaylist.tracks.length) % selectedPlaylist.tracks.length;
    playTrack(prev);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTrack = selectedPlaylist?.tracks[currentTrackIndex];

  return (
    <SidePanelWrapper
      onClose={onClose}
      embedded={embedded}
      title={view === 'list' ? 'Плейлисты' : view === 'create' ? 'Новый плейлист' : selectedPlaylist?.name || 'Плейлист'}
      icon={<Music size={15} className="text-purple-400" />}
      showBack={view !== 'list'}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-4">
          {/* List view */}
          {view === 'list' && (
            <div className="space-y-2">
              <button
                onClick={() => setView('create')}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm font-medium mb-3"
              >
                <Plus className="w-4 h-4" />
                Создать плейлист
              </button>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-12">
                  <ListMusic className="w-12 h-12 text-white/20 mx-auto mb-3" />
                  <p className="text-white/40 mb-4">Нет плейлистов</p>
                  <button
                    onClick={() => setView('create')}
                    className="px-4 py-2 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 transition-colors text-sm"
                  >
                    Создать первый
                  </button>
                </div>
              ) : (
                playlists.map(playlist => (
                  <button
                    key={playlist.id}
                    onClick={() => openPlaylist(playlist)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      {playlist.coverUrl ? (
                        <img src={playlist.coverUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <Music className="w-6 h-6 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{playlist.name}</p>
                      <p className="text-xs text-white/40">
                        {playlist._count?.tracks ?? playlist.tracks.length} треков
                        {playlist.ownerId === user?.id ? ' · Мой' : ' · Совместный'}
                      </p>
                    </div>
                    {playlist.ownerId === user?.id && (
                      <div className="flex gap-1">
                        <button
                          onClick={e => { e.stopPropagation(); handleSharePlaylist(playlist.id); }}
                          className="p-1.5 rounded-lg hover:bg-purple-500/20 transition-colors"
                          title="Поделиться ссылкой"
                        >
                          <Share2 className="w-4 h-4 text-purple-400" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); deletePlaylist(playlist.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                        >
                          <Trash2 className="w-4 h-4 text-white/30 hover:text-red-400" />
                        </button>
                      </div>
                    )}
                  </button>
                ))
              )}
            </div>
          )}

          {/* Create view */}
          {view === 'create' && (
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Название *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Мой плейлист"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                  maxLength={100}
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Описание</label>
                <textarea
                  value={newDesc}
                  onChange={e => setNewDesc(e.target.value)}
                  placeholder="Необязательно"
                  rows={3}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500 resize-none"
                  maxLength={500}
                />
              </div>
              <button
                onClick={createPlaylist}
                disabled={creating || !newName.trim()}
                className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-600 text-white transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {creating ? 'Создание...' : 'Создать плейлист'}
              </button>
            </div>
          )}

          {/* Playlist view */}
          {view === 'playlist' && selectedPlaylist && (
            <div className="flex flex-col h-full">
              {/* Player */}
              {selectedPlaylist.tracks.length > 0 && (
                <div className="p-4 bg-gradient-to-b from-purple-900/20 to-transparent border-b border-white/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                      {currentTrack?.coverUrl ? (
                        <img src={currentTrack.coverUrl} alt="" className="w-full h-full rounded-xl object-cover" />
                      ) : (
                        <Music className="w-6 h-6 text-purple-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">{currentTrack?.title || 'Нет треков'}</p>
                      <p className="text-xs text-white/40 truncate">{currentTrack?.artist || 'Неизвестный исполнитель'}</p>
                    </div>
                  </div>
                  {/* Progress */}
                  <div className="h-1 bg-white/10 rounded-full mb-3 cursor-pointer" onClick={e => {
                    if (!audioRef.current) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const ratio = (e.clientX - rect.left) / rect.width;
                    audioRef.current.currentTime = ratio * (audioRef.current.duration || 0);
                  }}>
                    <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  {/* Controls */}
                  <div className="flex items-center justify-center gap-4">
                    <button onClick={prevTrack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                      <SkipBack className="w-5 h-5 text-white/70" />
                    </button>
                    <button
                      onClick={togglePlay}
                      className="w-10 h-10 rounded-full bg-purple-500 hover:bg-purple-600 flex items-center justify-center transition-colors"
                    >
                      {isPlaying ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-0.5" />}
                    </button>
                    <button onClick={nextTrack} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                      <SkipForward className="w-5 h-5 text-white/70" />
                    </button>
                  </div>
                </div>
              )}

              {/* Track list */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {selectedPlaylist.tracks.map((track, index) => (
                  <div
                    key={track.id}
                    className={`flex items-center gap-3 p-2.5 rounded-xl transition-colors cursor-pointer ${
                      index === currentTrackIndex && isPlaying
                        ? 'bg-purple-500/20 border border-purple-500/30'
                        : 'hover:bg-white/5'
                    }`}
                    onClick={() => playTrack(index)}
                  >
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 text-xs text-white/40">
                      {index === currentTrackIndex && isPlaying ? (
                        <Volume2 className="w-4 h-4 text-purple-400 animate-pulse" />
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{track.title}</p>
                      {track.artist && <p className="text-xs text-white/40 truncate">{track.artist}</p>}
                    </div>
                    {track.duration && (
                      <span className="text-xs text-white/30">{formatDuration(track.duration)}</span>
                    )}
                    {(track.addedBy === user?.id || selectedPlaylist.ownerId === user?.id) && (
                      <button
                        onClick={e => { e.stopPropagation(); removeTrack(track.id); }}
                        className="p-1 rounded-lg hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-white/20 hover:text-red-400" />
                      </button>
                    )}
                  </div>
                ))}

                {selectedPlaylist.tracks.length === 0 && (
                  <div className="text-center py-8">
                    <Music className="w-10 h-10 text-white/20 mx-auto mb-2" />
                    <p className="text-white/30 text-sm">Нет треков</p>
                  </div>
                )}
              </div>

              {/* Add track */}
              <div className="p-4 border-t border-white/10">
                <AnimatePresence>
                  {showAddTrack && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden mb-3 space-y-2"
                    >
                      <input
                        type="text"
                        value={trackTitle}
                        onChange={e => setTrackTitle(e.target.value)}
                        placeholder="Название трека *"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="text"
                        value={trackArtist}
                        onChange={e => setTrackArtist(e.target.value)}
                        placeholder="Исполнитель"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      />
                      <input
                        type="url"
                        value={trackUrl}
                        onChange={e => setTrackUrl(e.target.value)}
                        placeholder="URL аудио (https://...) или загрузите файл"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-purple-500"
                      />
                      {/* Кнопка загрузки файла */}
                      <button
                        onClick={() => trackFileRef.current?.click()}
                        disabled={uploadingTrack}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300 hover:bg-purple-500/20 transition-colors text-sm disabled:opacity-50"
                      >
                        {uploadingTrack ? (
                          <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        {uploadingTrack ? 'Загрузка...' : 'Загрузить файл'}
                      </button>
                      <input ref={trackFileRef} type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.opus" className="hidden" onChange={handleTrackFileUpload} />
                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowAddTrack(false)}
                          className="flex-1 py-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 transition-colors text-sm"
                        >
                          Отмена
                        </button>
                        <button
                          onClick={addTrack}
                          disabled={addingTrack || !trackTitle.trim() || !trackUrl.trim()}
                          className="flex-1 py-2 rounded-xl bg-purple-500 hover:bg-purple-600 text-white transition-colors disabled:opacity-50 text-sm"
                        >
                          {addingTrack ? 'Добавление...' : 'Добавить'}
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {!showAddTrack && (
                  <button
                    onClick={() => setShowAddTrack(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors text-sm text-white/60"
                  >
                    <Plus className="w-4 h-4" />
                    Добавить трек
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Hidden audio element */}
        <audio ref={audioRef} />
      </div>
    </SidePanelWrapper>
  );
}
