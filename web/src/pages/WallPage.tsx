import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X, Hash, FileText } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { useNavigationStore } from '../stores/navigationStore';
import { saveEncrypted, loadDecrypted, saveTimestamp, loadTimestamp } from '../lib/storageEncryption';
import WallPost from '../components/WallPost';
import NewPostModal from '../components/NewPostModal';
import HashtagPage from './HashtagPage';
import NexoAIPage from './NexoAIPage';

const WALL_CACHE_KEY = 'nexo_wall_feed_cache';
const WALL_CACHE_TTL = 2 * 60 * 1000;
const WALL_HASHTAG_CACHE_KEY = 'nexo_wall_hashtags_cache';
const WALL_HASHTAG_CACHE_TTL = 5 * 60 * 1000;

interface WallPostType {
  id: string;
  authorId: string;
  content: string | null;
  fontStyle: string | null;
  viewsCount: number;
  createdAt: string;
  updatedAt: string;
  media: Array<{
    id: string;
    type: string;
    url: string;
    thumbnail?: string;
    duration?: number;
    size?: number;
    order: number;
  }>;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    isVerified: boolean;
    verifiedBadgeUrl: string | null;
  };
  reactionsCount: number;
  commentsCount: number;
  userReaction: string | null;
}

interface Hashtag {
  id: string;
  tag: string;
  ownerId: string;
  useCount: number;
  ownerUseCount: number;
  createdAt: string;
}

interface WallPageProps {
  highlightPostId?: string | null;
  onHighlightCleared?: () => void;
}

export default function WallPage({ highlightPostId, onHighlightCleared }: WallPageProps) {
  const { user } = useAuthStore();
  const { error: showError } = useToastStore();
  const { navigateTo, openProfile, showAI, openAI, closeAI } = useNavigationStore();
  const [posts, setPosts] = useState<WallPostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [showNewPost, setShowNewPost] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [hashtags, setHashtags] = useState<Hashtag[]>([]);
  const [selectedHashtag, setSelectedHashtag] = useState<string | null>(null);
  const [loadingHashtags, setLoadingHashtags] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [viewMode, setViewMode] = useState<'feed' | 'my' | 'friends' | 'search'>('feed');
  const viewModeRef = useRef<'feed' | 'my' | 'friends' | 'search'>('feed');
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Определяем мобильное устройство
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Загрузка хэштегов пользователя
  const loadHashtags = async () => {
    const cached = loadDecrypted(WALL_HASHTAG_CACHE_KEY);
    const cachedTs = loadTimestamp(`${WALL_HASHTAG_CACHE_KEY}_ts`);
    if (cached && Array.isArray(cached) && cachedTs && Date.now() - cachedTs < WALL_HASHTAG_CACHE_TTL) {
      setHashtags(cached);
    }
    try {
      const data = await api.get('/wall/hashtags/owned');
      const list = Array.isArray(data) ? data : [];
      setHashtags(list);
      try {
        saveEncrypted(WALL_HASHTAG_CACHE_KEY, list);
        saveTimestamp(`${WALL_HASHTAG_CACHE_KEY}_ts`, Date.now());
      } catch {}
    } catch (err) {
      console.error('Error loading hashtags:', err);
      if (!cached) {
        showError('Ошибка загрузки хэштегов');
      }
    } finally {
      setLoadingHashtags(false);
    }
  };

  // Загрузка ленты
  const loadFeed = async (reset = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      const mode = viewModeRef.current;
      let endpoint = `/wall/feed?offset=${currentOffset}&limit=20`;
      if (mode === 'my' && user?.id) {
        endpoint = `/wall/user/${user.id}?offset=${currentOffset}&limit=20`;
      } else if (mode === 'friends') {
        endpoint = `/wall/friends?offset=${currentOffset}&limit=20`;
      }

      // Мгновенно показываем кэш при первой загрузке
      if (reset) {
        const cached = loadDecrypted(WALL_CACHE_KEY);
        const cachedTs = loadTimestamp(`${WALL_CACHE_KEY}_ts`);
        if (cached && Array.isArray(cached.posts) && cachedTs && Date.now() - cachedTs < WALL_CACHE_TTL) {
          setPosts(cached.posts);
          setHasMore(!!cached.hasMore);
          setOffset(cached.posts.length);
        }
      }

      const response = await api.get(endpoint);
      const newPosts = response.posts || [];

      if (reset) {
        setPosts(newPosts);
        setOffset(20);
        try {
          saveEncrypted(WALL_CACHE_KEY, { posts: newPosts, hasMore: !!response.hasMore });
          saveTimestamp(`${WALL_CACHE_KEY}_ts`, Date.now());
        } catch {}
      } else {
        setPosts(prev => [...prev, ...newPosts]);
        setOffset(prev => prev + 20);
      }

      setHasMore(!!response.hasMore);
    } catch (err) {
      console.error('Error loading feed:', err);
      showError('Ошибка загрузки ленты');
    } finally {
      setLoading(false);
    }
  };

  // Поиск
  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      loadFeed(true);
      return;
    }

    setSearching(true);
    try {
      const response = await api.get(`/wall/search?q=${encodeURIComponent(searchQuery)}&offset=0&limit=20`);
      setPosts(response.posts);
      setHasMore(response.hasMore);
      setOffset(20);
    } catch (err) {
      console.error('Error searching:', err);
      showError('Ошибка поиска');
    } finally {
      setSearching(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadFeed();
        }
      },
      { threshold: 0.1 }
    );

    observerRef.current.observe(loadMoreRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, loading, offset]);

  // Первая загрузка
  useEffect(() => {
    loadFeed(true);
    loadHashtags();
  }, []);

  // Scroll to highlighted post
  useEffect(() => {
    if (!highlightPostId) return;
    
    // First try to find the post in the loaded list
    const existingPost = posts.find(p => p.id === highlightPostId);
    if (existingPost) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`wall-post-${highlightPostId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-nexo-500', 'ring-offset-2', 'ring-offset-[#0a0a0f]');
          setTimeout(() => {
            el.classList.remove('ring-2', 'ring-nexo-500', 'ring-offset-2', 'ring-offset-[#0a0a0f]');
            onHighlightCleared?.();
          }, 3000);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
    
    // Post not in list - fetch it directly
    const fetchAndHighlight = async () => {
      try {
        const postData = await api.get(`/wall/post/${highlightPostId}`);
        if (postData) {
          // Add to the beginning of the list
          setPosts(prev => [postData, ...prev]);
          
          // Scroll to it after render
          setTimeout(() => {
            const el = document.getElementById(`wall-post-${highlightPostId}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('ring-2', 'ring-nexo-500', 'ring-offset-2', 'ring-offset-[#0a0a0f]');
              setTimeout(() => {
                el.classList.remove('ring-2', 'ring-nexo-500', 'ring-offset-2', 'ring-offset-[#0a0a0f]');
                onHighlightCleared?.();
              }, 3000);
            }
          }, 500);
        }
      } catch (err) {
        console.error('Error fetching post:', err);
        showError('Пост не найден');
        onHighlightCleared?.();
      }
    };
    
    fetchAndHighlight();
  }, [highlightPostId, posts.length]);

  // Обработка создания нового поста
  const handlePostCreated = (newPost: WallPostType) => {
    setPosts(prev => [newPost, ...prev]);
    setShowNewPost(false);
    // Перезагружаем хэштеги, так как могли добавиться новые
    loadHashtags();
  };

  // Обработка удаления поста
  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  // Если выбран хэштег, показываем страницу хэштега
  if (selectedHashtag) {
    return (
      <HashtagPage
        tag={selectedHashtag}
        onClose={() => setSelectedHashtag(null)}
      />
    );
  }

  return (
    <div className="h-full flex bg-surface">
      {/* Основной контент */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 border-b border-border bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 sm:px-8">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-white flex-1">Стена</h1>
              
              {/* Кнопки переключения режима */}
              <button
                onClick={async () => {
                  setViewMode('feed');
                  viewModeRef.current = 'feed';
                  setLoading(true);
                  setOffset(0);
                  await loadFeed(true);
                }}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  viewMode === 'feed'
                    ? 'bg-nexo-500 text-white'
                    : 'bg-surface-tertiary text-zinc-400 hover:text-white'
                }`}
              >
                Лента
              </button>
              
              <button
                onClick={async () => {
                  setViewMode('friends');
                  viewModeRef.current = 'friends';
                  setLoading(true);
                  setOffset(0);
                  await loadFeed(true);
                }}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  viewMode === 'friends'
                    ? 'bg-nexo-500 text-white'
                    : 'bg-surface-tertiary text-zinc-400 hover:text-white'
                }`}
              >
                Лента друзей
              </button>
              
              <button
                onClick={() => setShowNewPost(true)}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  showNewPost
                    ? 'bg-nexo-500/20 text-nexo-400 hover:bg-nexo-500/30'
                    : 'bg-surface-tertiary text-zinc-400 hover:text-white'
                }`}
              >
                Новый пост
              </button>
              
              <button
                onClick={async () => {
                  if (!user?.id) return;
                  setViewMode('my');
                  viewModeRef.current = 'my';
                  setLoading(true);
                  setOffset(0);
                  await loadFeed(true);
                }}
                className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  viewMode === 'my'
                    ? 'bg-nexo-500 text-white'
                    : 'bg-surface-tertiary text-zinc-400 hover:text-white'
                }`}
              >
                Мои посты
              </button>
            </div>
            
            {/* Поиск */}
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Поиск по #тегам..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      setSelectedHashtag(searchQuery.replace('#', ''));
                    }
                  }}
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      if (viewMode === 'search') {
                        setViewMode('feed');
                        loadFeed(true);
                      }
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
              
              <div className="relative">
                <FileText size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Поиск по содержимому..."
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const query = (e.target as HTMLInputElement).value;
                      if (query.trim()) {
                        handleSearch();
                        setViewMode('search');
                      }
                    }
                  }}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-64 pl-9 pr-3 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
                />
              </div>
            </div>

            {/* Hashtag Panel */}
            {hashtags.length > 0 && viewMode === 'feed' && (
              <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4">
                {loadingHashtags ? (
                  <Loader2 size={16} className="animate-spin text-zinc-400" />
                ) : (
                  hashtags.map(tag => (
                    <button
                      key={tag.id}
                      onClick={() => setSelectedHashtag(tag.tag)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-nexo-500/20 hover:bg-nexo-500/30 text-nexo-400 hover:text-nexo-300 transition-colors whitespace-nowrap text-sm font-medium flex-shrink-0"
                    >
                      <Hash size={14} />
                      <span>{tag.tag}</span>
                      <span className="text-xs opacity-70">({tag.useCount})</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Feed */}
        <div className="flex-1 overflow-y-auto pb-20 sm:pb-4">
          <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4 sm:px-8">
          {loading && posts.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-zinc-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500">Нет постов</p>
              <button
                onClick={() => setShowNewPost(true)}
                className="mt-4 px-6 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors"
              >
                Создать первый пост
              </button>
            </div>
          ) : (
            <>
              <AnimatePresence mode="popLayout">
                {posts.map(post => (
                  <div key={post.id} id={`wall-post-${post.id}`}>
                    <WallPost
                      post={post}
                      onDelete={handlePostDeleted}
                    />
                  </div>
                ))}
              </AnimatePresence>

              {/* Load more trigger */}
              {hasMore && (
                <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                  <Loader2 size={24} className="animate-spin text-zinc-400" />
                </div>
              )}

              {!hasMore && posts.length > 0 && (
                <div className="text-center py-4">
                  <p className="text-zinc-500 text-sm">Все посты загружены</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      </div>

      {/* New Post Modal */}
      <AnimatePresence>
        {showNewPost && (
          <NewPostModal
            onClose={() => setShowNewPost(false)}
            onPostCreated={handlePostCreated}
          />
        )}
      </AnimatePresence>

      {/* Nexo AI Panel - slide-up sheet on mobile */}
      <AnimatePresence>
        {showAI && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.1 }}
            className="fixed inset-0 z-[200]"
            onClick={() => closeAI()}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
              exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className={`${
                isMobile
                  ? 'absolute inset-x-0 bottom-0 top-[52px] rounded-t-[20px]'
                  : 'fixed inset-8 rounded-2xl shadow-2xl overflow-hidden'
              } border border-white/10 overflow-hidden`}
              style={{ background: '#111' }}
              onClick={(e) => e.stopPropagation()}
            >
              <NexoAIPage onClose={() => closeAI()} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
