import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Search, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';
import WallPost from '../components/WallPost';

interface HashtagPageProps {
  tag: string;
  onClose: () => void;
}

interface HashtagData {
  id: string;
  tag: string;
  ownerId: string;
  useCount: number;
  ownerUseCount: number;
  createdAt: string;
  owner?: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
    isVerified: boolean;
  };
}

export default function HashtagPage({ tag, onClose }: HashtagPageProps) {
  const { error: showError } = useToastStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [hashtag, setHashtag] = useState<HashtagData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Загрузить посты по хэштегу
  const loadPosts = async (reset = false) => {
    try {
      const currentOffset = reset ? 0 : offset;
      const response = await api.get(`/wall/hashtag/${tag}/posts?offset=${currentOffset}&limit=20`);
      
      if (reset) {
        setPosts(response.posts);
        setHashtag(response.hashtag);
        setOffset(20);
      } else {
        setPosts(prev => [...prev, ...response.posts]);
        setOffset(prev => prev + 20);
      }
      
      setHasMore(response.hasMore);
    } catch (err) {
      console.error('Error loading hashtag posts:', err);
      showError('Ошибка загрузки постов');
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    if (!loadMoreRef.current || !hasMore || loading) return;

    observerRef.current = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadPosts();
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
    loadPosts(true);
  }, [tag]);

  // Обработка удаления поста
  const handlePostDeleted = (postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  return (
    <div className="h-full flex flex-col bg-surface">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-surface-secondary/50 backdrop-blur-xl sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <ArrowLeft size={20} className="text-zinc-400" />
            </button>
            <div className="flex-1">
              <h1 className="text-xl font-bold text-white">#{tag}</h1>
              {hashtag && (
                <p className="text-xs text-zinc-500">
                  {hashtag.useCount} использований
                  {hashtag.owner && ` • Создатель: @${hashtag.owner.username}`}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="flex-1 overflow-y-auto pb-4">
        <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
          {loading && posts.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={32} className="animate-spin text-zinc-400" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500">Нет постов с этим хэштегом</p>
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
  );
}
