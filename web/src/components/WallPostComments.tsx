import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Image, Mic, Loader2, Play, Pause, X, ArrowUpDown, Clock, TrendingUp, ChevronDown } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useToastStore } from '../stores/toastStore';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import VerifiedBadge from './VerifiedBadge';

interface Comment {
  id: string;
  postId: string;
  authorId: string;
  parentId: string | null;
  content: string | null;
  photoUrl: string | null;
  voiceUrl: string | null;
  voiceDuration: number | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    isVerified: boolean;
    verifiedBadgeUrl: string | null;
    verifiedBadgeType?: string;
  };
  replies: Comment[];
}

interface WallPostCommentsProps {
  postId: string;
  onCommentAdded: () => void;
}

const PAGE_SIZE = 10;

export default function WallPostComments({ postId, onCommentAdded }: WallPostCommentsProps) {
  const { user } = useAuthStore();
  const { error: showError } = useToastStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [sortBy, setSortBy] = useState<'newest' | 'popular'>('newest');
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [voice, setVoice] = useState<File | null>(null);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [audioElements] = useState(new Map<string, HTMLAudioElement>());
  const [showSortMenu, setShowSortMenu] = useState(false);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadComments = useCallback(async (reset = true) => {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      const offset = reset ? 0 : comments.length;
      const data = await api.get(
        `/wall/post/${postId}/comments?offset=${offset}&limit=${PAGE_SIZE}&sort=${sortBy}`
      );
      if (reset) {
        setComments(data.comments);
      } else {
        setComments(prev => [...prev, ...data.comments]);
      }
      setTotal(data.total);
    } catch (err) {
      console.error('Error loading comments:', err);
      showError('Ошибка загрузки комментариев');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [postId, sortBy, comments.length, showError]);

  useEffect(() => {
    loadComments(true);
  }, [postId, sortBy]);

  const hasMore = comments.length < total;

  // Запись голосового
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setVoice(file);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      showError('Ошибка доступа к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setRecording(false);
    }
  };

  // Отправить комментарий
  const handleSubmit = async () => {
    if (!newComment.trim() && !photo && !voice) {
      showError('Напишите комментарий или прикрепите медиа');
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      if (newComment.trim()) {
        formData.append('content', newComment);
      }
      if (replyTo) {
        formData.append('parentId', replyTo);
      }
      if (photo) {
        formData.append('photo', photo);
      }
      if (voice) {
        formData.append('voice', voice);
      }

      // Отправляем через api.post с правильной авторизацией
      const newCommentData = await api.post(`/wall/post/${postId}/comment`, formData);
      
      if (replyTo) {
        setComments(prev => prev.map(c => {
          if (c.id === replyTo) {
            return {
              ...c,
              replies: [...c.replies, newCommentData]
            };
          }
          return c;
        }));
      } else {
        setComments(prev => [newCommentData, ...prev]);
        setTotal(prev => prev + 1);
      }

      setNewComment('');
      setReplyTo(null);
      setPhoto(null);
      setVoice(null);
      onCommentAdded();
    } catch (err: any) {
      console.error('Error creating comment:', err);
      showError(err.message || 'Ошибка создания комментария');
    } finally {
      setSubmitting(false);
    }
  };

  // Воспроизведение голосовых
  const toggleVoice = (url: string) => {
    if (playingVoice === url) {
      const audio = audioElements.get(url);
      audio?.pause();
      setPlayingVoice(null);
    } else {
      audioElements.forEach(audio => audio.pause());
      
      let audio = audioElements.get(url);
      if (!audio) {
        audio = new Audio(url);
        audio.addEventListener('ended', () => setPlayingVoice(null));
        audioElements.set(url, audio);
      }
      
      audio.play();
      setPlayingVoice(url);
    }
  };

  // Открыть профиль
  const openProfile = (username: string) => {
    api.searchUsers(username).then(users => {
      const found = users.find(u => u.username === username);
      if (found) {
        useNavigationStore.getState().openProfile(found.id);
      }
    }).catch(() => {});
  };

  // Рендер комментария
  const renderComment = (comment: Comment, isReply = false) => (
    <motion.div
      key={comment.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${isReply ? 'ml-12' : ''}`}
    >
      <div className="flex gap-3">
        <button onClick={() => openProfile(comment.author.username)} className="flex-shrink-0">
          {comment.author.avatar ? (
            <img
              src={comment.author.avatar}
              alt=""
              className="w-8 h-8 rounded-full object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-nexo-500/20 to-purple-600/20 flex items-center justify-center">
              <span className="text-xs font-bold text-white">
                {comment.author.displayName[0]?.toUpperCase() || comment.author.username[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </button>

        <div className="flex-1 min-w-0">
          <div className="bg-surface-tertiary rounded-2xl px-3 py-2">
            <button onClick={() => openProfile(comment.author.username)} className="flex items-center gap-1.5 mb-1 hover:opacity-80 transition-opacity">
              <span className="text-sm font-semibold text-white">
                {comment.author.displayName || comment.author.username}
              </span>
              {comment.author.isVerified && (
                <VerifiedBadge
                  size="xs"
                  verifiedBadgeUrl={comment.author.verifiedBadgeUrl}
                />
              )}
            </button>

            {comment.content && (
              <p className="text-sm text-white whitespace-pre-wrap break-words">
                {comment.content}
              </p>
            )}

            {comment.photoUrl && (
              <img
                src={comment.photoUrl}
                alt=""
                className="mt-2 rounded-lg max-w-full"
              />
            )}

            {comment.voiceUrl && (
              <button
                onClick={() => toggleVoice(comment.voiceUrl!)}
                className="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-nexo-500/20 flex items-center justify-center">
                  {playingVoice === comment.voiceUrl ? (
                    <Pause size={12} className="text-nexo-400" />
                  ) : (
                    <Play size={12} className="text-nexo-400" />
                  )}
                </div>
                <span className="text-xs text-white">Голосовое</span>
                {comment.voiceDuration && (
                  <span className="text-xs text-zinc-500">{Math.round(comment.voiceDuration)}с</span>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 px-3">
            <span className="text-xs text-zinc-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true, locale: ru })}
            </span>
            {!isReply && (
              <button
                onClick={() => {
                  setReplyTo(comment.id);
                  textareaRef.current?.focus();
                }}
                className="text-xs text-zinc-500 hover:text-white transition-colors"
              >
                Ответить
              </button>
            )}
          </div>

          {/* Replies */}
          {comment.replies.length > 0 && (
            <div className="mt-3 space-y-3">
              {comment.replies.map(reply => renderComment(reply, true))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  return (
    <div className="border-t border-border bg-surface/50">
      <div className="p-4 space-y-4">
        {/* Sort controls */}
        {comments.length > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              {total} {total === 1 ? 'комментарий' : total < 5 ? 'комментария' : 'комментариев'}
            </span>
            <div className="relative">
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-zinc-400 hover:text-white hover:bg-surface-tertiary transition-colors"
              >
                <ArrowUpDown size={12} />
                {sortBy === 'newest' ? 'Новые' : 'Популярные'}
              </button>
              {showSortMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSortMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 z-20 bg-surface-secondary border border-border rounded-xl shadow-lg overflow-hidden">
                    <button
                      onClick={() => { setSortBy('newest'); setShowSortMenu(false); }}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                        sortBy === 'newest' ? 'text-nexo-400 bg-nexo-500/10' : 'text-zinc-400 hover:text-white hover:bg-surface-tertiary'
                      }`}
                    >
                      <Clock size={12} />
                      Новые
                    </button>
                    <button
                      onClick={() => { setSortBy('popular'); setShowSortMenu(false); }}
                      className={`flex items-center gap-2 w-full px-3 py-2 text-xs transition-colors ${
                        sortBy === 'popular' ? 'text-nexo-400 bg-nexo-500/10' : 'text-zinc-400 hover:text-white hover:bg-surface-tertiary'
                      }`}
                    >
                      <TrendingUp size={12} />
                      Популярные
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Comments list */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={20} className="animate-spin text-zinc-400" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-zinc-500 text-sm py-4">Нет комментариев</p>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {comments.map(comment => renderComment(comment))}
            </AnimatePresence>

            {hasMore && (
              <button
                onClick={() => loadComments(false)}
                disabled={loadingMore}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-surface-tertiary transition-colors"
              >
                {loadingMore ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <ChevronDown size={16} />
                )}
                {loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
              </button>
            )}
          </div>
        )}

        {/* New comment form */}
        <div className="space-y-2">
          {replyTo && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-nexo-500/10 border border-nexo-500/20">
              <span className="text-sm text-nexo-400 flex-1">
                Ответ на комментарий
              </span>
              <button
                onClick={() => setReplyTo(null)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={14} className="text-zinc-400" />
              </button>
            </div>
          )}

          {photo && (
            <div className="relative inline-block">
              <img
                src={URL.createObjectURL(photo)}
                alt=""
                className="h-20 rounded-lg"
              />
              <button
                onClick={() => setPhoto(null)}
                className="absolute -top-2 -right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              >
                <X size={14} className="text-white" />
              </button>
            </div>
          )}

          {voice && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-tertiary">
              <Mic size={16} className="text-nexo-400" />
              <span className="text-sm text-white flex-1">Голосовое сообщение</span>
              <button
                onClick={() => setVoice(null)}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors"
              >
                <X size={14} className="text-zinc-400" />
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <textarea
              ref={textareaRef}
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Написать комментарий..."
              className="flex-1 px-3 py-2 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent resize-none transition-colors"
              rows={1}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={e => setPhoto(e.target.files?.[0] || null)}
              className="hidden"
            />
            <button
              onClick={() => photoInputRef.current?.click()}
              disabled={!!photo}
              className="p-2.5 rounded-xl bg-surface-tertiary hover:bg-surface-hover disabled:opacity-50 transition-colors"
            >
              <Image size={18} className="text-nexo-400" />
            </button>

            <button
              onClick={recording ? stopRecording : startRecording}
              disabled={!!voice}
              className={`p-2.5 rounded-xl transition-colors ${
                recording
                  ? 'bg-red-500/20 hover:bg-red-500/30'
                  : 'bg-surface-tertiary hover:bg-surface-hover'
              } disabled:opacity-50`}
            >
              <Mic size={18} className={recording ? 'text-red-400' : 'text-nexo-400'} />
            </button>

            <button
              onClick={handleSubmit}
              disabled={submitting || (!newComment.trim() && !photo && !voice)}
              className="p-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin text-white" />
              ) : (
                <Send size={18} className="text-white" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
