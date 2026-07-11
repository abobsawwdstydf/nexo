import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Play, Pause, ThumbsUp, ThumbsDown, Plus, Trash2, Users, Upload, FileAudio } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { getSocket } from '../lib/socket';

interface CollaborativePlaylistModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string;
}

interface Track {
  id: string;
  title: string;
  artist: string;
  url: string;
  duration: number;
  addedBy: {
    id: string;
    username: string;
    displayName: string;
  };
  votes: number;
  userVote?: 'up' | 'down' | null;
}

interface Playlist {
  id: string;
  chatId: string;
  name: string;
  tracks: Track[];
  isPlaying: boolean;
  currentTrackIndex: number;
  listeners: string[];
}

export default function CollaborativePlaylistModal({ isOpen, onClose, chatId }: CollaborativePlaylistModalProps) {
  const { user } = useAuthStore();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAddTrack, setShowAddTrack] = useState(false);
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && chatId) {
      loadPlaylist();
    }
  }, [isOpen, chatId]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket || !chatId) return;

    const handlePlaylistUpdate = (data: Playlist) => {
      if (data.chatId === chatId) {
        setPlaylist(data);
      }
    };

    const handlePlaybackSync = (data: { chatId: string; isPlaying: boolean; currentTime: number; trackIndex: number }) => {
      if (data.chatId === chatId && audioRef.current) {
        if (data.isPlaying) {
          audioRef.current.currentTime = data.currentTime;
          audioRef.current.play();
        } else {
          audioRef.current.pause();
        }
      }
    };

    socket.on('playlist:update', handlePlaylistUpdate);
    socket.on('playlist:sync', handlePlaybackSync);

    return () => {
      socket.off('playlist:update', handlePlaylistUpdate);
      socket.off('playlist:sync', handlePlaybackSync);
    };
  }, [chatId]);

  const loadPlaylist = async () => {
    if (!chatId) return;
    setLoading(true);
    try {
      const response = await api.get(`/collaborative-playlists/${chatId}`);
      setPlaylist(response.data);
    } catch (error) {
      console.error('Error loading playlist:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTrack = async () => {
    if (!chatId) return;
    
    try {
      if (selectedFile) {
        setUploading(true);
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        const response = await api.post(`/collaborative-playlists/${chatId}/tracks/upload`, formData);
        
        setSelectedFile(null);
        setNewTrackUrl('');
        setShowAddTrack(false);
        loadPlaylist();
      } else if (newTrackUrl.trim()) {
        await api.post(`/collaborative-playlists/${chatId}/tracks`, {
          url: newTrackUrl,
        });
        setNewTrackUrl('');
        setShowAddTrack(false);
        loadPlaylist();
      }
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка добавления трека');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setNewTrackUrl(file.name);
    }
  };

  const handleVote = async (trackId: string, vote: 'up' | 'down') => {
    if (!chatId) return;
    try {
      await api.post(`/collaborative-playlists/${chatId}/tracks/${trackId}/vote`, { vote });
      loadPlaylist();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleRemoveTrack = async (trackId: string) => {
    if (!chatId) return;
    try {
      await api.delete(`/collaborative-playlists/${chatId}/tracks/${trackId}`);
      loadPlaylist();
    } catch (error) {
      console.error('Error removing track:', error);
    }
  };

  const handlePlayPause = async () => {
    if (!chatId || !playlist) return;
    const socket = getSocket();
    if (!socket) return;

    const newIsPlaying = !playlist.isPlaying;
    socket.emit('playlist:control', {
      chatId,
      action: newIsPlaying ? 'play' : 'pause',
      currentTime: audioRef.current?.currentTime || 0,
    });
  };

  const handleTrackEnd = () => {
    if (!chatId || !playlist) return;
    const socket = getSocket();
    if (!socket) return;

    const nextIndex = (playlist.currentTrackIndex + 1) % playlist.tracks.length;
    socket.emit('playlist:control', {
      chatId,
      action: 'next',
      trackIndex: nextIndex,
    });
  };

  if (!isOpen) return null;

  const currentTrack = playlist?.tracks[playlist.currentTrackIndex];
  const sortedTracks = playlist?.tracks.slice().sort((a, b) => b.votes - a.votes) || [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-3xl h-[85vh] min-h-[550px] bg-[#0d0d14]/95 backdrop-blur-3xl border border-white/[0.15] rounded-[2rem] shadow-[0_0_80px_rgba(0,0,0,0.7)] overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.08] bg-gradient-to-r from-nexo-500/5 to-purple-500/5 flex-shrink-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-nexo-500/30 to-purple-500/30 flex items-center justify-center">
                <Music className="w-6 h-6 text-nexo-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  Совместный плейлист
                </h2>
                <div className="flex items-center gap-2 text-sm text-zinc-400">
                  <Users className="w-4 h-4" />
                  <span>{playlist?.listeners.length || 0} слушателей</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2.5 hover:bg-white/10 rounded-xl transition-colors"
            >
              <X className="w-5 h-5 text-zinc-400" />
            </button>
          </div>

          {/* Current Track Player */}
          {currentTrack && (
            <div className="px-8 py-5 bg-gradient-to-r from-nexo-500/10 via-nexo-500/5 to-purple-500/10 border-b border-white/[0.08] flex-shrink-0">
              <div className="flex items-center gap-5">
                <button
                  onClick={handlePlayPause}
                  className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nexo-500 to-nexo-600 hover:from-nexo-600 hover:to-nexo-700 flex items-center justify-center transition-all shadow-lg shadow-nexo-500/30 active:scale-[0.95]"
                >
                  {playlist?.isPlaying ? (
                    <Pause className="w-6 h-6 text-white" />
                  ) : (
                    <Play className="w-6 h-6 text-white ml-0.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-nexo-400 animate-pulse" />
                    <span className="text-xs font-medium text-nexo-400 uppercase tracking-wider">Сейчас играет</span>
                  </div>
                  <h3 className="font-semibold text-white text-lg truncate">
                    {currentTrack.title}
                  </h3>
                  <p className="text-sm text-zinc-400 truncate">
                    {currentTrack.artist}
                  </p>
                </div>
                <div className="text-sm text-zinc-400 flex-shrink-0 font-mono">
                  {Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')} / {Math.floor(currentTrack.duration / 60)}:{String(Math.floor(currentTrack.duration % 60)).padStart(2, '0')}
                </div>
              </div>
              <audio
                ref={audioRef}
                src={currentTrack.url}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onEnded={handleTrackEnd}
              />
            </div>
          )}

          {/* Tracks List */}
          <div className="flex-1 overflow-y-auto px-8 py-5 min-h-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Треки ({sortedTracks.length})
              </h3>
              <button
                onClick={() => setShowAddTrack(true)}
                className="px-4 py-2 bg-nexo-500 text-white rounded-xl hover:bg-nexo-600 transition-all flex items-center gap-2 text-sm font-semibold shadow-lg shadow-nexo-500/25 active:scale-[0.95]"
              >
                <Plus className="w-4 h-4" />
                Добавить трек
              </button>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : sortedTracks.length === 0 ? (
              <div className="text-center py-12">
                <Music className="w-16 h-16 text-zinc-600 mx-auto mb-4" />
                <p className="text-zinc-500">Плейлист пуст</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedTracks.map((track, index) => (
                  <div
                    key={track.id}
                    className={`p-4 rounded-2xl transition-all ${
                      playlist?.currentTrackIndex === index
                        ? 'bg-nexo-500/15 ring-1 ring-nexo-500/40 shadow-lg shadow-nexo-500/10'
                        : 'bg-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center gap-1">
                        <button
                          onClick={() => handleVote(track.id, 'up')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            track.userVote === 'up'
                              ? 'text-green-400 bg-green-500/20'
                              : 'text-zinc-500 hover:text-green-400 hover:bg-green-500/10'
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                        </button>
                        <span className={`text-sm font-bold ${
                          track.votes > 0 ? 'text-green-400' : track.votes < 0 ? 'text-red-400' : 'text-zinc-500'
                        }`}>
                          {track.votes}
                        </span>
                        <button
                          onClick={() => handleVote(track.id, 'down')}
                          className={`p-1.5 rounded-lg transition-colors ${
                            track.userVote === 'down'
                              ? 'text-red-400 bg-red-500/20'
                              : 'text-zinc-500 hover:text-red-400 hover:bg-red-500/10'
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-white truncate text-base">
                          {track.title}
                        </h4>
                        <p className="text-sm text-zinc-400 truncate">
                          {track.artist}
                        </p>
                      </div>
                      <div className="text-sm text-zinc-500 flex-shrink-0 font-mono">
                        {Math.floor(track.duration / 60)}:{String(Math.floor(track.duration % 60)).padStart(2, '0')}
                      </div>
                      {track.addedBy.id === user?.id && (
                        <button
                          onClick={() => handleRemoveTrack(track.id)}
                          className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-colors flex-shrink-0"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add Track Modal */}
          <AnimatePresence>
            {showAddTrack && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 flex items-center justify-center p-4"
                onClick={() => setShowAddTrack(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="w-full max-w-md bg-[#0d0d14]/95 backdrop-blur-3xl border border-white/[0.15] rounded-2xl p-6 shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-white mb-4">
                    Добавить трек
                  </h3>
                  
                  {/* File Upload Area */}
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`mb-4 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all text-center ${
                      selectedFile
                        ? 'border-nexo-500/50 bg-nexo-500/10'
                        : 'border-white/[0.1] hover:border-white/[0.2] hover:bg-white/[0.02]'
                    }`}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="audio/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    {selectedFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <FileAudio className="w-8 h-8 text-nexo-400" />
                        <div className="text-left">
                          <p className="text-sm font-medium text-white truncate max-w-[200px]">
                            {selectedFile.name}
                          </p>
                          <p className="text-xs text-zinc-400">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} МБ
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Upload className="w-8 h-8 text-zinc-500" />
                        <p className="text-sm text-zinc-400">Нажмите чтобы загрузить аудиофайл</p>
                        <p className="text-xs text-zinc-600">MP3, WAV, OGG, FLAC</p>
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 h-px bg-white/[0.1]" />
                    <span className="text-xs text-zinc-500 uppercase tracking-wider">или</span>
                    <div className="flex-1 h-px bg-white/[0.1]" />
                  </div>

                  {/* URL Input */}
                  <input
                    type="text"
                    value={newTrackUrl}
                    onChange={(e) => {
                      setNewTrackUrl(e.target.value);
                      if (selectedFile) setSelectedFile(null);
                    }}
                    placeholder="URL трека"
                    className="w-full px-4 py-3.5 bg-white/[0.06] border border-white/[0.1] rounded-xl mb-4 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 focus:ring-1 focus:ring-nexo-500/30 transition-all"
                  />
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setShowAddTrack(false);
                        setSelectedFile(null);
                        setNewTrackUrl('');
                      }}
                      className="flex-1 px-4 py-3 bg-white/[0.06] text-zinc-300 rounded-xl hover:bg-white/[0.1] transition-colors text-sm font-medium"
                    >
                      Отмена
                    </button>
                    <button
                      onClick={handleAddTrack}
                      disabled={!newTrackUrl.trim() && !selectedFile}
                      className="flex-1 px-4 py-3 bg-nexo-500 text-white rounded-xl hover:bg-nexo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold shadow-lg shadow-nexo-500/25 flex items-center justify-center gap-2"
                    >
                      {uploading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Загрузка...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          Добавить
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
