import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, MessageCircle, Eye, MoreVertical, Trash2, Play, Pause, Share2, UserPlus, UserCheck, Music, File as FileIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useNavigationStore } from '../stores/navigationStore';
import { audioManager } from '../lib/audioManager';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import WallPostComments from './WallPostComments';
import VerifiedBadge from './VerifiedBadge';
import PlaylistEmbedPreview from './PlaylistEmbedPreview';
import ReactionPicker from './ReactionPicker';

interface WallPostProps {
  post: {
    id: string;
    authorId: string;
    content: string | null;
    fontStyle: string | null;
    viewsCount: number;
    createdAt: string;
    media: Array<{
      id: string;
      type: string;
      url: string;
      thumbnail?: string;
      duration?: number;
      size?: number;
    }>;
    author: {
      id: string;
      username: string;
      displayName: string;
      avatar: string | null;
      isVerified: boolean;
      verifiedBadgeUrl: string | null;
      verifiedBadgeType?: string;
      subscribersCount?: number;
    };
    reactionsCount: number;
    commentsCount: number;
    userReaction: string | null;
    isSubscribed?: boolean;
  };
  onDelete: (postId: string) => void;
}

export default function WallPost({ post, onDelete }: WallPostProps) {
  const { user } = useAuthStore();
  const { success, error: showError } = useToastStore();
  const [showMenu, setShowMenu] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [localReaction, setLocalReaction] = useState(post.userReaction);
  const [reactionsCount, setReactionsCount] = useState(post.reactionsCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [isSubscribed, setIsSubscribed] = useState(post.isSubscribed || false);
  const [playingMedia, setPlayingMedia] = useState<string | null>(null);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionPickerPosition, setReactionPickerPosition] = useState<{ x: number; y: number } | undefined>();
  const postRef = useRef<HTMLDivElement>(null);
  const viewTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasViewedRef = useRef(false);

  const isOwner = user?.id === post.authorId;

  // Отметить просмотр с IntersectionObserver
  useEffect(() => {
    const element = postRef.current;
    if (!element || hasViewedRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasViewedRef.current) {
          viewTimerRef.current = setTimeout(async () => {
            if (!hasViewedRef.current) {
              hasViewedRef.current = true;
              try {
                await api.post(`/wall/post/${post.id}/view`, {});
              } catch (err) {
                console.error('Error marking view:', err);
              }
            }
          }, 1000);
        } else if (viewTimerRef.current) {
          clearTimeout(viewTimerRef.current);
          viewTimerRef.current = null;
        }
      },
      { threshold: 0.5 }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
      if (viewTimerRef.current) {
        clearTimeout(viewTimerRef.current);
      }
    };
  }, [post.id]);

  // Обработка реакции
  const handleReaction = useCallback(async (emoji: string) => {
    try {
      const response = await api.post(`/wall/post/${post.id}/react`, { emoji });
      
      if (response.action === 'added') {
        setLocalReaction(emoji);
        setReactionsCount(prev => prev + 1);
      } else {
        setLocalReaction(null);
        setReactionsCount(prev => prev - 1);
      }
    } catch (err) {
      console.error('Error reacting:', err);
      showError('Ошибка добавления реакции');
    }
    setShowReactionPicker(false);
  }, [post.id, showError]);

  // Открыть пикер реакций
  const openReactionPicker = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const rect = postRef.current?.getBoundingClientRect();
    if (rect) {
      let x: number, y: number;
      if ('touches' in e) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      } else {
        x = e.clientX;
        y = e.clientY;
      }
      setReactionPickerPosition({ x, y });
    }
    setShowReactionPicker(true);
  }, []);

  // Долгое нажатие для мобильных
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const handleTouchStart = useCallback(() => {
    longPressTimer.current = setTimeout(() => {
      openReactionPicker({ preventDefault: () => {} } as React.TouchEvent);
    }, 500);
  }, [openReactionPicker]);

  const handleTouchEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  // Подписка/отписка
  const handleSubscribe = async () => {
    if (isOwner) return;
    
    try {
      const response = await api.post(`/wall/user/${post.authorId}/subscribe`, {});
      
      if (response.action === 'subscribed') {
        setIsSubscribed(true);
        success('Вы подписались');
      } else {
        setIsSubscribed(false);
        success('Вы отписались');
      }
    } catch (err) {
      console.error('Error toggling subscription:', err);
      showError('Ошибка изменения подписки');
    }
  };

  // Удалить пост
  const handleDelete = async () => {
    if (!confirm('Удалить пост?')) return;
    
    try {
      await api.delete(`/wall/post/${post.id}`);
      success('Пост удален');
      onDelete(post.id);
    } catch (err) {
      console.error('Error deleting post:', err);
      showError('Ошибка удаления поста');
    }
  };

  // Открыть профиль автора
  const openAuthorProfile = () => {
    useNavigationStore.getState().openProfile(post.author.id);
  };

  // Воспроизведение аудио/голосовых — через глобальный audioManager для непрерывного воспроизведения
  const toggleMedia = (url: string) => {
    if (playingMedia === url) {
      audioManager.pausePersistent();
      setPlayingMedia(null);
    } else {
      audioManager.playPersistent(url, {
        onEnded: () => setPlayingMedia(null),
        onPlay: () => setPlayingMedia(url),
        onPause: () => setPlayingMedia(null),
      });
      setPlayingMedia(url);
    }
  };

  // Поделиться постом - нативный шеринг на мобилке, копирование ссылки на десктопе
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/wall/post/${post.id}`;
    const shareTitle = post.author?.displayName ? `Пост от ${post.author.displayName}` : 'Пост в Нексо';
    const shareText = post.content?.slice(0, 100) || shareTitle;

    // Try native share on mobile
    if (navigator.share) {
      try {
        await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        return;
      } catch (err: any) {
        // User cancelled or share failed - fall through to clipboard
        if (err.name === 'AbortError') return;
      }
    }

    // Fallback: clipboard
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        success('Ссылка на пост скопирована');
      } else {
        // Fallback for older browsers / non-HTTPS
        const textarea = document.createElement('textarea');
        textarea.value = shareUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        success('Ссылка на пост скопирована');
      }
    } catch (err) {
      console.error('Error sharing post:', err);
      showError('Ошибка копирования ссылки');
    }
  };

  // Рендер контента с хэштегами и упоминаниями
  const renderContent = (content: string) => {
    const parts = content.split(/(\s+)/);
    
    return parts.map((part, i) => {
      // Хэштег
      if (part.startsWith('#')) {
        const tag = part.slice(1);
        return (
          <a
            key={i}
            href={`/wall/hashtag/${tag}`}
            onClick={(e) => {
              e.preventDefault();
              useNavigationStore.getState().openHashtag(tag);
            }}
            className="text-nexo-400 hover:text-nexo-300 transition-colors font-medium"
          >
            {part}
          </a>
        );
      }
      
      // Упоминание
      if (part.startsWith('@')) {
        const username = part.slice(1);
        return (
          <a
            key={i}
            href={`/?user=${username}`}
            onClick={(e) => {
              e.preventDefault();
              api.searchUsers(username).then(users => {
                const foundUser = users.find(u => u.username === username);
                if (foundUser) {
                  useNavigationStore.getState().openProfile(foundUser.id);
                }
              });
            }}
            className="text-nexo-400 hover:text-nexo-300 transition-colors font-medium"
          >
            {part}
          </a>
        );
      }
      
      return <span key={i}>{part}</span>;
    });
  };

  const photos = post.media.filter(m => m.type === 'photo');
  const videos = post.media.filter(m => m.type === 'video');
  const audios = post.media.filter(m => m.type === 'audio');
  const voices = post.media.filter(m => m.type === 'voice');
  const files = post.media.filter(m => m.type === 'file');

  return (
    <motion.div
      ref={postRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-surface-secondary rounded-2xl border border-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <button onClick={openAuthorProfile} className="flex-shrink-0">
          {post.author.avatar ? (
            <img
              src={post.author.avatar}
              alt=""
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500/20 to-purple-600/20 flex items-center justify-center">
              <span className="text-sm font-bold text-white">
                {post.author.displayName[0]?.toUpperCase() || post.author.username[0]?.toUpperCase()}
              </span>
            </div>
          )}
        </button>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <button onClick={openAuthorProfile} className="flex items-center gap-1.5 hover:opacity-80 transition-opacity">
              <span className="text-sm font-semibold text-white truncate">
                {post.author.displayName || post.author.username}
              </span>
              {post.author.isVerified && (
                <VerifiedBadge
                  size="sm"
                  verifiedBadgeUrl={post.author.verifiedBadgeUrl}
                  verifiedBadgeType={post.author.verifiedBadgeType}
                />
              )}
            </button>
            
            {/* Subscribe button - компактная кнопка */}
            {!isOwner && (
              <button
                onClick={handleSubscribe}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1 ${
                  isSubscribed
                    ? 'bg-zinc-700 hover:bg-zinc-600 text-white'
                    : 'bg-nexo-500 hover:bg-nexo-600 text-white'
                }`}
              >
                {isSubscribed ? (
                  <>
                    <UserCheck size={12} />
                    <span>Подписан</span>
                  </>
                ) : (
                  <>
                    <UserPlus size={12} />
                    <span>Подписаться</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-zinc-500">
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true, locale: ru })}
            </p>
            {post.author.subscribersCount !== undefined && post.author.subscribersCount > 0 && (
              <span className="text-xs text-zinc-500">• {post.author.subscribersCount} подписчиков</span>
            )}
          </div>
        </div>

        {isOwner && (
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <MoreVertical size={18} className="text-zinc-400" />
            </button>
            
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-surface-tertiary border border-border rounded-xl shadow-xl z-50 overflow-hidden min-w-[160px]">
                  <button
                    onClick={handleDelete}
                    className="w-full px-4 py-2.5 flex items-center gap-2 hover:bg-red-500/10 text-red-400 transition-colors"
                  >
                    <Trash2 size={16} />
                    <span className="text-sm">Удалить</span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Content */}
      {post.content && (
        <div className="px-4 pb-3">
          <p className="text-white whitespace-pre-wrap break-words">
            {renderContent(post.content)}
          </p>
        </div>
      )}

      {/* Playlist Embeds from URLs in content */}
      {post.content && (() => {
        const playlistPattern = /(?:https?:\/\/)?(?:www\.)?[^\/\s]+\/\?playlist=([a-zA-Z0-9_-]+)/g;
        const matches = [...post.content.matchAll(playlistPattern)];
        if (matches.length > 0) {
          return (
            <div className="px-4 pb-3 space-y-2">
              {matches.map((match, i) => (
                <PlaylistEmbedPreview key={i} playlistId={match[1]} />
              ))}
            </div>
          );
        }
        return null;
      })()}

      {/* Media */}
      {photos.length > 0 && (
        <div className={photos.length === 1 ? '' : 'grid grid-cols-2 gap-0.5'}>
          {photos.map(photo => (
            <div key={photo.id} className="relative group">
              <img
                src={photo.url}
                alt=""
                className={`w-full h-auto object-cover ${photos.length === 1 ? 'max-h-[500px]' : 'aspect-square'}`}
              />
              <a
                href={photo.url}
                download
                className="absolute top-2 right-2 p-2 rounded-lg bg-black/50 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => e.stopPropagation()}
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              </a>
            </div>
          ))}
        </div>
      )}

      {videos.length > 0 && (
        <div className="px-4 pb-3">
          {videos.map(video => (
            <video
              key={video.id}
              src={video.url}
              controls
              className="w-full rounded-xl"
            />
          ))}
        </div>
      )}

      {audios.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {audios.map(audio => (
            <button
              key={audio.id}
              onClick={() => toggleMedia(audio.url)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary hover:bg-surface-hover transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-nexo-500/20 flex items-center justify-center flex-shrink-0">
                {playingMedia === audio.url ? (
                  <Pause size={16} className="text-nexo-400" />
                ) : (
                  <Play size={16} className="text-nexo-400" />
                )}
              </div>
              <Music size={16} className="text-nexo-400" />
              <div className="flex-1 text-left">
                <p className="text-sm text-white">Аудио</p>
                {audio.duration && (
                  <p className="text-xs text-zinc-500">{Math.round(audio.duration)}с</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {voices.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {voices.map(voice => (
            <button
              key={voice.id}
              onClick={() => toggleMedia(voice.url)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary hover:bg-surface-hover transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-nexo-500/20 flex items-center justify-center flex-shrink-0">
                {playingMedia === voice.url ? (
                  <Pause size={16} className="text-nexo-400" />
                ) : (
                  <Play size={16} className="text-nexo-400" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm text-white">Голосовое сообщение</p>
                {voice.duration && (
                  <p className="text-xs text-zinc-500">{Math.round(voice.duration)}с</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      {files.length > 0 && (
        <div className="px-4 pb-3 space-y-2">
          {files.map(file => (
            <a
              key={file.id}
              href={file.url}
              download
              className="flex items-center gap-3 p-3 rounded-xl bg-surface-tertiary hover:bg-surface-hover transition-colors"
            >
              <FileIcon size={16} className="text-nexo-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">Файл</p>
                {file.size && (
                  <p className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-4 py-3 border-t border-border flex items-center gap-4">
        <button
          onClick={() => handleReaction('❤️')}
          onContextMenu={openReactionPicker}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
            localReaction
              ? 'bg-red-500/20 text-red-400'
              : 'hover:bg-white/5 text-zinc-400'
          }`}
        >
          <Heart size={18} fill={localReaction ? 'currentColor' : 'none'} />
          {localReaction && (
            <span className="text-sm">{localReaction}</span>
          )}
          {reactionsCount > 0 && (
            <span className="text-sm font-medium">{reactionsCount}</span>
          )}
        </button>

        <button
          onClick={() => setShowComments(!showComments)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors"
        >
          <MessageCircle size={18} />
          {commentsCount > 0 && (
            <span className="text-sm font-medium">{commentsCount}</span>
          )}
        </button>

        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 text-zinc-400 transition-colors"
        >
          <Share2 size={18} />
        </button>

        <div className="flex items-center gap-1.5 ml-auto text-zinc-500">
          <Eye size={16} />
          <span className="text-sm">{post.viewsCount}</span>
        </div>
      </div>

      {/* Subscribe button - компактная кнопка рядом с ником */}

      {/* Comments */}
      {showComments && (
        <WallPostComments
          postId={post.id}
          onCommentAdded={() => setCommentsCount(prev => prev + 1)}
        />
      )}

      {/* Reaction Picker */}
      <AnimatePresence>
        {showReactionPicker && (
          <ReactionPicker
            onSelect={handleReaction}
            onClose={() => setShowReactionPicker(false)}
            position={reactionPickerPosition}
          />
        )}
      </AnimatePresence>

      {/* Share Modal */}
      {/* Removed - now using direct share */}
    </motion.div>
  );
}
