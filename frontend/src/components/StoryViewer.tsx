import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Heart } from 'lucide-react';
import type { Story, StoryGroup } from '../lib/types';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { useAuthStore } from '../stores/authStore';
import { useInitStore } from '../stores/initStore';

const STORY_DURATION = 5000;
const REACTIONS = ['❤️', '😂', '🔥', '👍', '😮'];

interface StoriesViewerProps {
  groups: StoryGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

export function StoriesViewer({ groups, initialGroupIndex, onClose }: StoriesViewerProps) {
  const user = useAuthStore(s => s.user);
  const setStories = useInitStore(s => s.setStories);
  const [groupIdx, setGroupIdx] = useState(initialGroupIndex);
  const [storyIdx, setStoryIdx] = useState(0);
  const [progress, setProgress] = useState(0);
  const [reaction, setReaction] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const progressStartRef = useRef<number>(0);
  const pausedRef = useRef(false);
  const markedRef = useRef<Set<string>>(new Set());

  const group = groups[groupIdx];
  const stories = group?.stories ?? [];
  const story = stories[Math.min(storyIdx, stories.length - 1)];

  useEffect(() => {
    setGroupIdx(initialGroupIndex);
    setStoryIdx(0);
    setProgress(0);
  }, [initialGroupIndex]);

  const refreshStories = useCallback(async () => {
    try {
      const fresh = await api.getStories();
      const map = new Map<string, StoryGroup>();
      for (const s of fresh) {
        const author = (s as unknown as { user?: { id: string; username: string; displayName: string; avatar: string | null } }).user;
        const uid = author?.id || 'me';
        if (!map.has(uid)) {
          map.set(uid, {
            user: author ?? {
              id: 'me',
              username: user?.username || '',
              displayName: user?.displayName || 'Мои истории',
              avatar: user?.avatar ?? null,
            },
            stories: [],
            hasUnviewed: false,
          });
        }
        map.get(uid)!.stories.push(s);
      }
      setStories(Array.from(map.values()));
    } catch { /* keep current state */ }
  }, [setStories, user]);

  const markViewed = useCallback(async (sid: string) => {
    if (markedRef.current.has(sid)) return;
    markedRef.current.add(sid);
    try { await api.viewStory(sid); } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    setProgress(0);
    if (story) markViewed(story.id);
  }, [groupIdx, storyIdx, story?.id, markViewed]);

  const goNext = useCallback(() => {
    if (storyIdx < stories.length - 1) {
      setStoryIdx(i => i + 1);
    } else if (groupIdx < groups.length - 1) {
      setGroupIdx(g => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [storyIdx, stories.length, groupIdx, groups.length, onClose]);

  const goPrev = useCallback(() => {
    if (storyIdx > 0) {
      setStoryIdx(i => i - 1);
    } else if (groupIdx > 0) {
      setGroupIdx(g => g - 1);
      setStoryIdx(stories.length - 1);
    }
  }, [storyIdx, groupIdx, stories.length]);

  useEffect(() => {
    if (!story) return;
    progressStartRef.current = Date.now();
    timerRef.current = window.setInterval(() => {
      if (pausedRef.current) {
        progressStartRef.current = Date.now();
        return;
      }
      const elapsed = Date.now() - progressStartRef.current;
      const pct = Math.min(100, (elapsed / STORY_DURATION) * 100);
      setProgress(pct);
      if (elapsed >= STORY_DURATION) goNext();
    }, 100);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [story?.id, groupIdx, storyIdx, goNext]);

  const handleReaction = async (emoji: string) => {
    if (!story) return;
    setReaction(emoji);
    try { await api.addStoryReaction(story.id, emoji); } catch { /* non-fatal */ }
    window.setTimeout(() => setReaction(null), 1200);
  };

  const handleDelete = async () => {
    if (!story) return;
    if (!window.confirm('Удалить эту историю?')) return;
    try {
      await api.deleteStory(story.id);
      await refreshStories();
      setStoryIdx(i => Math.max(0, i - 1));
      setProgress(0);
    } catch (err) {
      console.error('Failed to delete story:', err);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  if (!group || !story) {
    return (
      <motion.div
        className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white">
          <X size={20} />
        </button>
        <p className="text-white/50">Истории закончились</p>
      </motion.div>
    );
  }

  const isMine = user?.id === group.user.id;

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => { pausedRef.current = true; }}
      onMouseLeave={() => { pausedRef.current = false; }}
    >
      {/* Progress segments */}
      <div className="absolute top-0 left-0 right-0 z-20 flex gap-1 p-3 pt-5">
        {stories.map((s, i) => {
          const isActive = i === storyIdx;
          return (
            <div key={s.id} className="flex-1 h-[3px] rounded-full bg-white/25 overflow-hidden">
              {isActive && (
                <div
                  className="h-full bg-white rounded-full transition-all duration-100 ease-linear"
                  style={{ width: `${progress}%` }}
                />
              )}
              {!isActive && i < storyIdx && <div className="h-full bg-white rounded-full" />}
            </div>
          );
        })}
      </div>

      {/* Header */}
      <div className="absolute top-6 left-0 right-0 z-20 flex items-center gap-3 px-4">
        <div className="w-9 h-9 rounded-full overflow-hidden border border-white/30 flex-shrink-0 bg-white/10">
          {group.user.avatar ? (
            <img src={normalizeMediaUrl(group.user.avatar)} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-xs font-semibold text-white/70">
              {(group.user.displayName || group.user.username || '?').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-white truncate">
            {group.user.displayName || group.user.username}
          </div>
          <div className="text-[11px] text-white/60">
            {new Date(story.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
        {isMine && (
          <button
            onClick={handleDelete}
            className="p-2 rounded-full hover:bg-white/15 text-white/80 transition-colors"
            title="Удалить историю"
          >
            <Trash2 size={18} />
          </button>
        )}
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/15 text-white transition-colors">
          <X size={22} />
        </button>
      </div>

      {/* Story content */}
      <div className="absolute inset-0 flex items-center justify-center select-none">
        <AnimatePresence mode="wait">
          <motion.div
            key={story.id}
            className="relative w-full h-full flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {story.mediaUrl ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                <motion.img
                  src={normalizeMediaUrl(story.mediaUrl)}
                  alt=""
                  className="max-h-full max-w-full object-contain"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  draggable={false}
                />
                {story.content && (
                  <p className="absolute bottom-12 left-0 right-0 text-white text-center px-8 text-lg font-medium drop-shadow-lg">
                    {story.content}
                  </p>
                )}
              </div>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center p-10"
                style={{ backgroundColor: story.bgColor || '#1e1b4b' }}
              >
                <p className="text-2xl md:text-4xl font-semibold text-white text-center leading-relaxed whitespace-pre-wrap max-w-2xl">
                  {story.content}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Tap zones */}
      <button className="absolute top-16 left-0 bottom-24 w-1/4 z-10" onClick={goPrev} aria-label="Назад" />
      <button className="absolute top-16 right-0 bottom-24 w-3/4 z-10" onClick={goNext} aria-label="Дальше" />

      {/* Reactions */}
      <div className="absolute bottom-6 left-0 right-0 z-30 flex flex-col items-center gap-3 pointer-events-none">
        <AnimatePresence>
          {reaction && (
            <motion.div
              key={reaction}
              initial={{ scale: 0, y: 24 }}
              animate={{ scale: 1.4, y: 0 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 15 }}
              className="text-5xl"
            >
              {reaction}
            </motion.div>
          )}
        </AnimatePresence>
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-xl rounded-full px-4 py-2 border border-white/10 pointer-events-auto">
          <Heart size={13} className="text-white/50" />
          {REACTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleReaction(emoji)}
              className="text-xl hover:scale-125 transition-transform duration-150"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}