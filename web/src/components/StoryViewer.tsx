import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Plus, ChevronUp, Check } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { getInitials, generateAvatarColor } from '../lib/utils';
import Avatar from './Avatar';
import { StoryGroup } from '../lib/types';

const STORY_BG_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
  '#3b82f6', '#1e1e2e',
];

interface StoryViewerProps {
  stories: StoryGroup[];
  initialUserIndex: number;
  onClose: () => void;
  onRefresh: () => void;
  onOpenChat?: (userId: string) => void;
}

export default function StoryViewer({ stories, initialUserIndex, onClose, onRefresh, onOpenChat }: StoryViewerProps) {
  const { user } = useAuthStore();
  const { t } = useLang();
  const [userIndex, setUserIndex] = useState(initialUserIndex);
  const [storyIndex, setStoryIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const viewedRef = useRef<Set<string>>(new Set()); // track viewed in this session
  const [viewOverrides, setViewOverrides] = useState<Record<string, { viewCount: number; viewed: boolean }>>({});

  const STORY_DURATION = 5000; // 5 seconds per story
  const TICK = 50;

  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<Array<{ userId: string; username: string; displayName: string; avatar: string | null; viewedAt: string }>>([]);
  const [viewersLoading, setViewersLoading] = useState(false);

  const currentUser = stories[userIndex];
  const rawStory = currentUser?.stories?.[storyIndex];
  // Merge prop data with local overrides to avoid mutating props
  const currentStory = rawStory ? { ...rawStory, ...viewOverrides[rawStory.id] } : null;

  // Reset when viewer opens with different user
  useEffect(() => {
    setUserIndex(initialUserIndex);
    setStoryIndex(0);
    setProgress(0);
    viewedRef.current.clear();
    setViewOverrides({});
  }, [initialUserIndex]);

  const goNext = useCallback(() => {
    if (!currentUser) return;
    if (storyIndex < currentUser.stories.length - 1) {
      setStoryIndex(s => s + 1);
      setProgress(0);
    } else if (userIndex < stories.length - 1) {
      setUserIndex(u => u + 1);
      setStoryIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }, [storyIndex, userIndex, currentUser, stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIndex > 0) {
      setStoryIndex(s => s - 1);
      setProgress(0);
    } else if (userIndex > 0) {
      setUserIndex(u => u - 1);
      const prevUser = stories[userIndex - 1];
      setStoryIndex(prevUser.stories.length - 1);
      setProgress(0);
    }
  }, [storyIndex, userIndex, stories]);

  const canGoPrev = storyIndex > 0 || userIndex > 0;
  const canGoNext = (currentUser && storyIndex < currentUser.stories.length - 1) || userIndex < stories.length - 1;

  // Mark viewed
  useEffect(() => {
    if (!currentStory || !currentStory.id) return;
    if (currentUser.user.id === user?.id) return;
    if (currentStory.viewed || viewedRef.current.has(currentStory.id)) return;
    viewedRef.current.add(currentStory.id);
    const storyId = currentStory.id;
    const initialViewCount = currentStory.viewCount || 0;
    api.viewStory(storyId).then(() => {
      setViewOverrides(prev => ({
        ...prev,
        [storyId]: {
          viewCount: initialViewCount + 1,
          viewed: true,
        },
      }));
    }).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, currentUser?.user?.id, user?.id]);

  // Progress timer - use a key to force restart
  useEffect(() => {
    if (paused || !currentStory) return;
    setProgress(0);
    const step = (TICK / STORY_DURATION) * 100;
    timerRef.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goNext();
          return 0;
        }
        return prev + step;
      });
    }, TICK);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [storyIndex, userIndex, paused, goNext]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  const handleDelete = async () => {
    if (!currentStory) return;
    try {
      await api.deleteStory(currentStory.id);
      onRefresh();
      goNext();
    } catch (e) {
      console.error(e);
    }
  };

  if (!currentUser || !currentStory) return null;

  const timeAgo = (date: string) => {
    const diff = (Date.now() - new Date(date).getTime()) / 1000;
    if (diff < 60) return `${Math.floor(diff)}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    return `${Math.floor(diff / 3600)}h`;
  };

  const avatarUrl = currentUser.user.avatar
    ? normalizeMediaUrl(currentUser.user.avatar)
    : null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/95 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Story container */}
      <div
        className="relative w-full max-w-[420px] h-full max-h-[85vh] rounded-2xl overflow-hidden select-none"
        onMouseDown={() => setPaused(true)}
        onMouseUp={() => setPaused(false)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={() => setPaused(true)}
        onTouchEnd={() => setPaused(false)}
      >
        {/* Story content */}
        {currentStory.type === 'video' && currentStory.mediaUrl ? (
          <div className="w-full h-full bg-black flex items-center justify-center relative">
            <video
              src={normalizeMediaUrl(currentStory.mediaUrl)}
              className="w-full h-full object-contain"
              autoPlay
              muted={false}
              playsInline
              onLoadedMetadata={(e) => {
                const video = e.currentTarget;
                if (video.duration && !isNaN(video.duration) && video.duration !== Infinity) {
                  // Обновляем длительность истории на основе видео
                  const videoDuration = Math.ceil(video.duration * 1000);
                  // Можно сохранить в state если нужно динамически менять STORY_DURATION
                }
              }}
            />
            {currentStory.content && (
              <div className="absolute bottom-16 left-0 right-0 flex justify-center px-4 z-10">
                <p className="text-white text-base font-bold text-center drop-shadow-lg bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                  {currentStory.content}
                </p>
              </div>
            )}
          </div>
        ) : currentStory.type === 'image' && currentStory.mediaUrl ? (
          <div className="w-full h-full bg-black flex items-center justify-center">
            <img
              src={normalizeMediaUrl(currentStory.mediaUrl)}
              alt="story"
              className="w-full h-full object-contain"
              draggable={false}
            />
            {currentStory.content && (
              <div className="absolute bottom-16 left-0 right-0 flex justify-center px-4 z-10">
                <p className="text-white text-base font-bold text-center drop-shadow-lg bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                  {currentStory.content}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div
            className="w-full h-full flex items-center justify-center p-8"
            style={{ background: currentStory.bgColor || '#6366f1' }}
          >
            <p className="text-white text-2xl font-bold text-center leading-relaxed drop-shadow-lg"
              style={{ maxWidth: '90%', wordBreak: 'break-word' }}>
              {currentStory.content}
            </p>
          </div>
        )}

        {/* Progress bars */}
        <div className="absolute top-0 left-0 right-0 flex gap-1 p-2 z-10">
          {currentUser.stories.map((_, i) => (
            <div key={i} className="flex-1 h-[3px] bg-white/30 rounded-full overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-none"
                style={{
                  width: i < storyIndex ? '100%' : i === storyIndex ? `${progress}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-4 left-0 right-0 flex items-center gap-3 px-4 pt-2 z-10">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenChat && currentUser.user.id !== user?.id) {
                onOpenChat(currentUser.user.id);
                onClose();
              }
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-1 min-w-0"
          >
            <Avatar
              src={avatarUrl}
              name={currentUser.user.displayName || currentUser.user.username}
              size="sm"
              className="ring-2 ring-white/20 rounded-xl flex-shrink-0"
            />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white text-sm font-semibold truncate drop-shadow">
                {currentUser.user.id === user?.id ? t('myStory') : currentUser.user.displayName || currentUser.user.username}
              </p>
              <p className="text-white/60 text-xs drop-shadow">{timeAgo(currentStory.createdAt)}</p>
            </div>
          </button>
          {/* Кнопки справа */}
          <div className="flex items-center gap-1 flex-shrink-0">
            {currentUser.user.id === user?.id && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (showViewers) {
                      setShowViewers(false);
                      setPaused(false);
                    } else {
                      setPaused(true);
                      setShowViewers(true);
                      setViewersLoading(true);
                      api.getStoryViewers(currentStory.id).then(v => {
                        setViewers(v);
                        setViewersLoading(false);
                      }).catch(() => setViewersLoading(false));
                    }
                  }}
                  className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
                  title="Просмотры"
                >
                  <Eye size={14} />
                  {currentStory.viewCount > 0 && (
                    <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-nexo-500 text-white rounded-full px-1 leading-none py-0.5">{currentStory.viewCount}</span>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDelete(); }}
                  className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-red-400 hover:bg-black/60 transition-all"
                  title="Удалить"
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              className="w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/60 transition-all"
              title="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Left/Right click zones */}
        <div className="absolute inset-0 flex z-[5]">
          <div className="w-1/3 h-full cursor-pointer" onClick={goPrev} />
          <div className="w-1/3 h-full" />
          <div className="w-1/3 h-full cursor-pointer" onClick={goNext} />
        </div>

        {/* Navigation arrows */}
        {canGoPrev && (
          <button
            onClick={(e) => { e.stopPropagation(); goPrev(); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all"
          >
            <ChevronLeft size={20} />
          </button>
        )}
        {canGoNext && (
          <button
            onClick={(e) => { e.stopPropagation(); goNext(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center text-white/70 hover:bg-white/20 hover:text-white transition-all"
          >
            <ChevronRight size={20} />
          </button>
        )}

        {/* Viewers panel */}
        <AnimatePresence>
          {showViewers && currentUser.user.id === user?.id && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 z-20 bg-black/90 backdrop-blur-xl rounded-t-2xl border-t border-white/10 max-h-[50%] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-white text-sm font-semibold flex items-center gap-2">
                    <Eye size={14} /> {t('storyViewers')} ({currentStory.viewCount})
                  </h4>
                  <button
                    onClick={() => { setShowViewers(false); setPaused(false); }}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                {viewersLoading ? (
                  <div className="text-white/40 text-sm text-center py-4">{t('sending')}</div>
                ) : viewers.length === 0 ? (
                  <div className="text-white/40 text-sm text-center py-4">{t('noViewers')}</div>
                ) : (
                  <div className="space-y-2">
                    {viewers.map((v) => (
                      <div key={v.userId} className="flex items-center gap-3 py-1.5">
                        <Avatar
                          src={normalizeMediaUrl(v.avatar)}
                          name={v.displayName || v.username}
                          size="sm"
                          className="rounded-xl"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm truncate">{v.displayName || v.username}</p>
                          <p className="text-white/40 text-xs">@{v.username}</p>
                        </div>
                        <span className="text-white/30 text-xs">{timeAgo(v.viewedAt)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Story creation modal
interface CreateStoryModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateStoryModal({ onClose, onCreated }: CreateStoryModalProps) {
  const { t } = useLang();
  const [mode, setMode] = useState<'text' | 'image' | 'video'>('text');
  const [text, setText] = useState('');
  const [overlayText, setOverlayText] = useState('');
  const [bgColor, setBgColor] = useState('#6366f1');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [showAudioInput, setShowAudioInput] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioFileRef = useRef<HTMLInputElement>(null);

  // Устаревший imageFile для совместимости
  const imageFile = mode === 'image' ? mediaFile : null;

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaFile(file);
    const reader = new FileReader();
    reader.onload = () => setMediaPreview(reader.result as string);
    reader.readAsDataURL(file);
    if (file.type.startsWith('video/')) setMode('video');
    else setMode('image');
  };

  const handleAudioFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAudioFile(file);
    setAudioUrl('');
  };

  const handleCreate = async () => {
    if (mode === 'text' && !text.trim()) return;
    if ((mode === 'image' || mode === 'video') && !mediaFile) return;
    if (isUploading) return;
    setIsUploading(true);

    try {
      let mediaUrl: string | undefined;
      let audioMediaUrl: string | undefined;

      if (mediaFile) {
        const result = await api.uploadFile(mediaFile);
        if (!result?.url) throw new Error('Не получен URL файла');
        mediaUrl = result.url;
      }

      if (audioFile) {
        const result = await api.uploadFile(audioFile);
        if (result?.url) audioMediaUrl = result.url;
      } else if (audioUrl.trim()) {
        audioMediaUrl = audioUrl.trim();
      }

      await api.createStory({
        type: mode === 'video' ? 'video' : mode,
        content: mode === 'text' ? text.trim() : (overlayText.trim() || undefined),
        bgColor: mode === 'text' ? bgColor : undefined,
        mediaUrl,
        audioUrl: audioMediaUrl,
      });

      onCreated();
      onClose();
    } catch (e) {
      console.error('Ошибка создания истории:', e);
      alert('Ошибка: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-[400px] rounded-2xl glass-strong border border-white/10 overflow-hidden"
      >
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">{t('newStory')}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setMode('text')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'text' ? 'text-nexo-400 border-b-2 border-nexo-400' : 'text-zinc-400'}`}
          >
            Текст
          </button>
          <button
            onClick={() => { setMode('image'); fileInputRef.current?.click(); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'image' ? 'text-nexo-400 border-b-2 border-nexo-400' : 'text-zinc-400'}`}
          >
            Фото
          </button>
          <button
            onClick={() => { setMode('video'); fileInputRef.current?.click(); }}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${mode === 'video' ? 'text-nexo-400 border-b-2 border-nexo-400' : 'text-zinc-400'}`}
          >
            Видео
          </button>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={handleMediaSelect}
        />
        <input
          ref={audioFileRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleAudioFileSelect}
        />

        <div className="p-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {mode === 'text' ? (
            <>
              {/* Preview */}
              <div
                className="w-full h-44 rounded-xl flex items-center justify-center p-4 transition-colors"
                style={{ background: bgColor }}
              >
                <p className="text-white text-lg font-bold text-center break-words max-w-full">
                  {text || 'Введите текст...'}
                </p>
              </div>
              <textarea
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Введите текст истории..."
                maxLength={200}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-zinc-200 resize-none h-16 focus:outline-none focus:border-nexo-500/50"
              />
              {/* Color picker */}
              <div className="flex flex-wrap gap-2.5">
                {STORY_BG_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setBgColor(c)}
                    className={`relative w-9 h-9 rounded-full transition-all duration-150 ${bgColor === c ? 'scale-110 ring-2 ring-white shadow-lg shadow-black/40' : 'hover:scale-105 ring-1 ring-white/10'}`}
                    style={{ background: c }}
                    aria-label="Цвет фона"
                  >
                    {bgColor === c && (
                      <span className="absolute inset-0 flex items-center justify-center text-white drop-shadow">
                        <Check size={14} strokeWidth={3} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Media preview */}
              {mediaPreview ? (
                <div className="relative w-full h-44 rounded-xl overflow-hidden">
                  {mode === 'video' ? (
                    <video src={mediaPreview} className="w-full h-full object-cover" muted />
                  ) : (
                    <img src={mediaPreview} className="w-full h-full object-cover" alt="preview" />
                  )}
                  {/* Overlay text preview */}
                  {overlayText && (
                    <div className="absolute inset-0 flex items-end justify-center pb-4 px-4">
                      <p className="text-white text-base font-bold text-center drop-shadow-lg bg-black/40 px-3 py-1.5 rounded-xl backdrop-blur-sm">
                        {overlayText}
                      </p>
                    </div>
                  )}
                  <button
                    onClick={() => { setMediaFile(null); setMediaPreview(null); }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 flex items-center justify-center text-white"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-44 rounded-xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center text-zinc-400 hover:text-white hover:border-white/40 transition-colors gap-2"
                >
                  <Plus size={28} />
                  <span className="text-sm">{mode === 'video' ? 'Выбрать видео' : 'Выбрать фото'}</span>
                </button>
              )}

              {/* Текст поверх */}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Текст поверх (необязательно)</label>
                <input
                  type="text"
                  value={overlayText}
                  onChange={e => setOverlayText(e.target.value)}
                  placeholder="Текст поверх фото/видео..."
                  maxLength={100}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                />
              </div>
            </>
          )}

          {/* Аудио (для всех режимов) */}
          <div>
            <button
              onClick={() => setShowAudioInput(!showAudioInput)}
              className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <span className="text-base">🎵</span>
              {showAudioInput ? 'Скрыть аудио' : 'Добавить аудио'}
            </button>
            <AnimatePresence>
              {showAudioInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden mt-2 space-y-2"
                >
                  <div className="flex gap-2">
                    <input
                      type="url"
                      value={audioUrl}
                      onChange={e => { setAudioUrl(e.target.value); setAudioFile(null); }}
                      placeholder="Ссылка на аудио (https://...)"
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                    />
                    <button
                      onClick={() => audioFileRef.current?.click()}
                      className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs text-zinc-400 hover:text-white transition-colors border border-white/10 flex-shrink-0"
                    >
                      📁 Файл
                    </button>
                  </div>
                  {audioFile && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-nexo-500/10 border border-nexo-500/20">
                      <span className="text-xs text-nexo-400 truncate flex-1">{audioFile.name}</span>
                      <button onClick={() => setAudioFile(null)} className="text-zinc-500 hover:text-white">
                        <X size={12} />
                      </button>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={handleCreate}
            disabled={isUploading || (mode === 'text' && !text.trim()) || ((mode === 'image' || mode === 'video') && !mediaFile)}
            className="w-full py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-400 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Публикация...' : 'Опубликовать'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
