import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, TrendingUp, Plus, MessageCircle, ThumbsUp, ThumbsDown, Award, Users, Filter } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface CommunitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Community {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  membersCount: number;
  postsCount: number;
  isJoined: boolean;
  createdAt: string;
}

interface Post {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatar?: string;
    karma: number;
  };
  communityId: string;
  community: {
    id: string;
    name: string;
    icon?: string;
  };
  upvotes: number;
  downvotes: number;
  commentsCount: number;
  userVote?: 'up' | 'down' | null;
  createdAt: string;
}

export default function CommunitiesModal({ isOpen, onClose }: CommunitiesModalProps) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'feed' | 'communities' | 'my-posts'>('feed');
  const [posts, setPosts] = useState<Post[]>([]);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'hot' | 'new' | 'top'>('hot');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<string>('');
  const [newPostTitle, setNewPostTitle] = useState('');
  const [newPostContent, setNewPostContent] = useState('');

  const categories = [
    { id: 'all', label: 'Все', icon: '🌐' },
    { id: 'tech', label: 'Технологии', icon: '💻' },
    { id: 'gaming', label: 'Игры', icon: '🎮' },
    { id: 'music', label: 'Музыка', icon: '🎵' },
    { id: 'art', label: 'Искусство', icon: '🎨' },
    { id: 'science', label: 'Наука', icon: '🔬' },
    { id: 'sports', label: 'Спорт', icon: '⚽' },
    { id: 'food', label: 'Еда', icon: '🍕' },
    { id: 'other', label: 'Другое', icon: '📦' },
  ];

  useEffect(() => {
    if (isOpen) {
      if (tab === 'feed') loadPosts();
      if (tab === 'communities') loadCommunities();
      if (tab === 'my-posts') loadMyPosts();
    }
  }, [isOpen, tab, selectedCategory, sortBy]);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (selectedCategory !== 'all') qp.set('category', selectedCategory);
      qp.set('sortBy', sortBy);
      if (searchQuery) qp.set('search', searchQuery);
      const response = await api.get('/communities/posts?' + qp.toString());
      setPosts(response.data);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCommunities = async () => {
    setLoading(true);
    try {
      const qp = new URLSearchParams();
      if (selectedCategory !== 'all') qp.set('category', selectedCategory);
      if (searchQuery) qp.set('search', searchQuery);
      const response = await api.get('/communities?' + qp.toString());
      setCommunities(response.data);
    } catch (error) {
      console.error('Error loading communities:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMyPosts = async () => {
    setLoading(true);
    try {
      const response = await api.get('/communities/my-posts');
      setMyPosts(response.data);
    } catch (error) {
      console.error('Error loading my posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (postId: string, vote: 'up' | 'down') => {
    try {
      await api.post(`/communities/posts/${postId}/vote`, { vote });
      loadPosts();
    } catch (error) {
      console.error('Error voting:', error);
    }
  };

  const handleJoinCommunity = async (communityId: string) => {
    try {
      await api.post(`/communities/${communityId}/join`, {});
      loadCommunities();
    } catch (error) {
      console.error('Error joining community:', error);
    }
  };

  const handleCreatePost = async () => {
    if (!selectedCommunity || !newPostTitle.trim() || !newPostContent.trim()) return;
    try {
      await api.post('/communities/posts', {
        communityId: selectedCommunity,
        title: newPostTitle,
        content: newPostContent,
      });
      setNewPostTitle('');
      setNewPostContent('');
      setShowCreatePost(false);
      setTab('my-posts');
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка создания поста');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-6xl h-[85vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20">
            <div className="flex items-center gap-3">
              <Users className="w-6 h-6 text-orange-600 dark:text-orange-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Сообщества
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'feed', label: 'Лента', icon: TrendingUp },
              { id: 'communities', label: 'Сообщества', icon: Users },
              { id: 'my-posts', label: 'Мои посты', icon: MessageCircle },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as any)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                  tab === id
                    ? 'bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-b-2 border-orange-600'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {(tab === 'feed' || tab === 'my-posts') && (
              <div className="p-6">
                {/* Filters */}
                <div className="mb-6 space-y-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск постов..."
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      {['hot', 'new', 'top'].map((sort) => (
                        <button
                          key={sort}
                          onClick={() => setSortBy(sort as any)}
                          className={`px-4 py-2 rounded-lg transition-colors ${
                            sortBy === sort
                              ? 'bg-orange-600 text-white'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                          }`}
                        >
                          {sort === 'hot' ? '🔥 Горячее' : sort === 'new' ? '🆕 Новое' : '⭐ Топ'}
                        </button>
                      ))}
                    </div>
                    {tab === 'feed' && (
                      <button
                        onClick={() => setShowCreatePost(true)}
                        className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center gap-2"
                      >
                        <Plus className="w-4 h-4" />
                        Создать пост
                      </button>
                    )}
                  </div>
                </div>

                {/* Posts */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
                  </div>
                ) : (tab === 'feed' ? posts : myPosts).length === 0 ? (
                  <div className="text-center py-12">
                    <MessageCircle className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {tab === 'feed' ? 'Нет постов' : 'У вас пока нет постов'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(tab === 'feed' ? posts : myPosts).map((post) => (
                      <div
                        key={post.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        <div className="p-4">
                          <div className="flex items-start gap-4">
                            {/* Voting */}
                            <div className="flex flex-col items-center gap-1">
                              <button
                                onClick={() => handleVote(post.id, 'up')}
                                className={`p-1 rounded transition-colors ${
                                  post.userVote === 'up'
                                    ? 'text-orange-600 bg-orange-100 dark:bg-orange-900/30'
                                    : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20'
                                }`}
                              >
                                <ThumbsUp className="w-5 h-5" />
                              </button>
                              <span className={`text-sm font-medium ${
                                post.upvotes - post.downvotes > 0
                                  ? 'text-orange-600'
                                  : post.upvotes - post.downvotes < 0
                                  ? 'text-gray-600'
                                  : 'text-gray-600'
                              }`}>
                                {post.upvotes - post.downvotes}
                              </span>
                              <button
                                onClick={() => handleVote(post.id, 'down')}
                                className={`p-1 rounded transition-colors ${
                                  post.userVote === 'down'
                                    ? 'text-gray-600 bg-gray-100 dark:bg-gray-900/30'
                                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/20'
                                }`}
                              >
                                <ThumbsDown className="w-5 h-5" />
                              </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {post.community.icon && (
                                  <img
                                    src={post.community.icon}
                                    alt={post.community.name}
                                    className="w-5 h-5 rounded-full"
                                  />
                                )}
                                <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                                  {post.community.name}
                                </span>
                                <span className="text-sm text-gray-500">•</span>
                                <span className="text-sm text-gray-500">
                                  {post.author.displayName}
                                </span>
                                <div className="flex items-center gap-1 text-sm text-gray-500">
                                  <Award className="w-3 h-3" />
                                  {post.author.karma}
                                </div>
                              </div>
                              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                                {post.title}
                              </h3>
                              <p className="text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                                {post.content}
                              </p>
                              <div className="flex items-center gap-4 text-sm text-gray-500">
                                <button className="flex items-center gap-1 hover:text-orange-600 transition-colors">
                                  <MessageCircle className="w-4 h-4" />
                                  {post.commentsCount} комментариев
                                </button>
                                <span>
                                  {new Date(post.createdAt).toLocaleDateString('ru')}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'communities' && (
              <div className="p-6">
                {/* Search */}
                <div className="mb-6">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Поиск сообществ..."
                      className="w-full pl-10 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>

                {/* Communities Grid */}
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600" />
                  </div>
                ) : communities.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Сообщества не найдены</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {communities.map((community) => (
                      <div
                        key={community.id}
                        className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-start gap-3 mb-3">
                          {community.icon && (
                            <img
                              src={community.icon}
                              alt={community.name}
                              className="w-12 h-12 rounded-full"
                            />
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900 dark:text-white">
                              {community.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                              {community.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400 mb-3">
                          <span>{community.membersCount} участников</span>
                          <span>{community.postsCount} постов</span>
                        </div>
                        <button
                          onClick={() => handleJoinCommunity(community.id)}
                          disabled={community.isJoined}
                          className={`w-full px-4 py-2 rounded-lg font-medium transition-colors ${
                            community.isJoined
                              ? 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-400 cursor-not-allowed'
                              : 'bg-orange-600 text-white hover:bg-orange-700'
                          }`}
                        >
                          {community.isJoined ? 'Вы участник' : 'Вступить'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Create Post Modal */}
          <AnimatePresence>
            {showCreatePost && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/50 flex items-center justify-center p-4"
                onClick={() => setShowCreatePost(false)}
              >
                <motion.div
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl p-6"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Создать пост
                  </h3>
                  <div className="space-y-4">
                    <select
                      value={selectedCommunity}
                      onChange={(e) => setSelectedCommunity(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <option value="">Выберите сообщество</option>
                      {communities.filter(c => c.isJoined).map((community) => (
                        <option key={community.id} value={community.id}>
                          {community.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={newPostTitle}
                      onChange={(e) => setNewPostTitle(e.target.value)}
                      placeholder="Заголовок поста"
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <textarea
                      value={newPostContent}
                      onChange={(e) => setNewPostContent(e.target.value)}
                      placeholder="Содержание поста"
                      className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
                      rows={6}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCreatePost(false)}
                        className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                      >
                        Отмена
                      </button>
                      <button
                        onClick={handleCreatePost}
                        disabled={!selectedCommunity || !newPostTitle.trim() || !newPostContent.trim()}
                        className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                      >
                        Опубликовать
                      </button>
                    </div>
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
