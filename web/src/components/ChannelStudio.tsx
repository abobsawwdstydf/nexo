import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart3, Users, Eye, MessageSquare, Settings, Trash2, Edit3, Image as ImageIcon, ArrowLeft, TrendingUp, Camera, Loader2, LinkIcon, TrendingDown, Crown, Lock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import Avatar from './Avatar';

interface ChannelStudioProps {
  channelId: string;
  onClose: () => void;
}

export default function ChannelStudio({ channelId, onClose }: ChannelStudioProps) {
  const { user } = useAuthStore();
  const { updateChat, addChat, setActiveChat, loadMessages } = useChatStore();
  const { t } = useLang();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const openingChatRef = useRef(false);
  const [activeTab, setActiveTab] = useState<'analytics' | 'settings' | 'subscribers'>('analytics');
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({ name: '', description: '', avatar: null as File | null });
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loadingSubscribers, setLoadingSubscribers] = useState(false);
  const [growthData, setGrowthData] = useState<{date: string; count: number}[]>([]);
  const [growthPeriod, setGrowthPeriod] = useState<'7d' | '24h' | '30d'>('7d');
  const [subscriptionPrice, setSubscriptionPrice] = useState(0);
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState('');
  const [savingPrice, setSavingPrice] = useState(false);

  useEffect(() => {
    loadAnalytics();
    loadChannel();
    loadSubscribers();
    loadSubscriptionPrice();
  }, [channelId]);

  const loadAnalytics = async () => {
    try {
      const data: any = await api.getChannelAnalytics(channelId);
      setAnalytics(data);
      // Use real growth data from API
      if (data?.growthData && Array.isArray(data.growthData)) {
        setGrowthData(data.growthData);
      } else {
        setGrowthData([]);
      }
    } catch (e) {
      // Analytics only available for admins
      console.error('Failed to load analytics:', e);
      setAnalytics(null);
      setGrowthData([]);
    } finally {
      setLoading(false);
    }
  };

  const loadChannel = async () => {
    try {
      const chat = await api.getChat(channelId);
      setChannel(chat);
      setEditData({
        name: chat.name || '',
        description: chat.description || '',
        avatar: null,
      });
    } catch (e) {
      console.error('Failed to load channel:', e);
    }
  };

  const loadSubscribers = async () => {
    try {
      setLoadingSubscribers(true);
      const chat = await api.getChat(channelId);
      // Filter out admin, show only regular members (subscribers)
      const subs = chat.members.filter((m: any) => m.role !== 'admin');
      setSubscribers(subs);
    } catch (e) {
      console.error('Failed to load subscribers:', e);
    } finally {
      setLoadingSubscribers(false);
    }
  };

  const loadSubscriptionPrice = async () => {
    try {
      const data = await api.get(`/channel-subscriptions/${channelId}`);
      setSubscriptionPrice(data.priceMonthly || 0);
      setPriceInput(String(data.priceMonthly || 0));
    } catch (e) {
      // Ignore
    }
  };

  const handleSavePrice = async () => {
    const price = parseInt(priceInput);
    if (isNaN(price) || price < 0) return;
    setSavingPrice(true);
    try {
      await api.put(`/channel-subscriptions/${channelId}/price`, { priceMonthly: price });
      setSubscriptionPrice(price);
      setEditingPrice(false);
    } catch (e) {
      console.error('Failed to save price:', e);
    } finally {
      setSavingPrice(false);
    }
  };

  const handleOpenChat = async (subscriberUserId: string) => {
    // Prevent multiple simultaneous requests
    if (openingChatRef.current) return;
    openingChatRef.current = true;
    
    try {
      const store = useChatStore.getState();
      const existingChat = store.chats.find(c =>
        c.type === 'personal' && c.members.some(m => m.user.id === subscriberUserId)
      );

      if (existingChat) {
        store.setActiveChat(existingChat.id);
        store.loadMessages(existingChat.id);
      } else {
        // Small delay to ensure store is synced
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Re-check after delay
        const refreshedChats = store.chats;
        const stillExisting = refreshedChats.find(c =>
          c.type === 'personal' && c.members.some(m => m.user.id === subscriberUserId)
        );
        
        if (stillExisting) {
          store.setActiveChat(stillExisting.id);
          store.loadMessages(stillExisting.id);
        } else {
          const chat = await api.createPersonalChat(subscriberUserId);
          store.addChat(chat);
          store.setActiveChat(chat.id);
          store.loadMessages(chat.id);
        }
      }
      onClose();
    } catch (e) {
      console.error('Failed to open chat:', e);
    } finally {
      openingChatRef.current = false;
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setAvatarUploading(true);
      const updatedChat = await api.uploadGroupAvatar(channelId, file);
      updateChat(updatedChat);
      setChannel(updatedChat);
    } catch (e) {
      console.error('Failed to upload avatar:', e);
    } finally {
      setAvatarUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarUploading(true);
      const updatedChat = await api.removeGroupAvatar(channelId);
      updateChat(updatedChat);
      setChannel(updatedChat);
    } catch (e) {
      console.error('Failed to remove avatar:', e);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      await api.updateGroup(channelId, { name: editData.name, description: editData.description });
      setIsEditing(false);
      loadChannel();
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  const handleDeleteChannel = async () => {
    if (!confirm('Вы уверены, что хотите удалить канал? Это действие нельзя отменить.')) return;
    try {
      await api.deleteChat(channelId);
      onClose();
    } catch (e) {
      console.error('Failed to delete channel:', e);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-50"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, x: 50 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 50 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-2xl bg-surface-secondary z-50 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border bg-surface-secondary">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-zinc-400 hover:text-white">
              <ArrowLeft size={20} />
            </button>
            <div>
              <h2 className="text-lg font-bold text-white">{channel?.name || 'Канал'}</h2>
              <p className="text-xs text-zinc-500">Студия управления</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-hover text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border bg-surface-secondary">
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'analytics'
                ? 'text-nexo-400 border-b-2 border-nexo-400 bg-nexo-500/10'
                : 'text-zinc-400 hover:text-white hover:bg-surface-hover'
            }`}
          >
            <BarChart3 size={16} />
            Аналитика
          </button>
          <button
            onClick={() => setActiveTab('subscribers')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'subscribers'
                ? 'text-nexo-400 border-b-2 border-nexo-400 bg-nexo-500/10'
                : 'text-zinc-400 hover:text-white hover:bg-surface-hover'
            }`}
          >
            <Users size={16} />
            Подписчики
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-3 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'settings'
                ? 'text-nexo-400 border-b-2 border-nexo-400 bg-nexo-500/10'
                : 'text-zinc-400 hover:text-white hover:bg-surface-hover'
            }`}
          >
            <Settings size={16} />
            Настройки
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : activeTab === 'analytics' && analytics ? (
            <div className="space-y-4">
              {/* Stats Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Users size={16} className="text-nexo-400" />
                    <span className="text-xs text-zinc-400">Подписчики</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatNumber(analytics.subscribers)}</p>
                </div>
                <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Eye size={16} className="text-emerald-400" />
                    <span className="text-xs text-zinc-400">Просмотры</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatNumber(analytics.totalViews)}</p>
                </div>
                <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <MessageSquare size={16} className="text-nexo-400" />
                    <span className="text-xs text-zinc-400">Посты</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatNumber(analytics.posts)}</p>
                </div>
                <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-orange-400" />
                    <span className="text-xs text-zinc-400">Средние просмотры</span>
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {analytics.posts > 0 ? formatNumber(Math.round(analytics.totalViews / analytics.posts)) : '0'}
                  </p>
                </div>
              </div>

              {/* Growth Chart */}
              <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <TrendingUp size={16} className="text-emerald-400" />
                    Рост подписчиков
                  </h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setGrowthPeriod('24h')}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        growthPeriod === '24h'
                          ? 'bg-nexo-500/20 text-nexo-400'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      24ч
                    </button>
                    <button
                      onClick={() => setGrowthPeriod('7d')}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        growthPeriod === '7d'
                          ? 'bg-nexo-500/20 text-nexo-400'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      7д
                    </button>
                    <button
                      onClick={() => setGrowthPeriod('30d')}
                      className={`px-2 py-1 rounded-lg text-xs font-medium transition-colors ${
                        growthPeriod === '30d'
                          ? 'bg-nexo-500/20 text-nexo-400'
                          : 'bg-white/5 text-zinc-400 hover:text-white'
                      }`}
                    >
                      30д
                    </button>
                  </div>
                </div>
                {growthData.length > 0 ? (
                  <div className="h-32 flex items-end gap-1">
                    {growthData.map((item, idx) => {
                      const maxValue = Math.max(...growthData.map(d => d.count), 1);
                      const height = (item.count / maxValue) * 100;
                      const date = new Date(item.date);
                      const label = growthPeriod === '24h' 
                        ? date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
                        : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-2">
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ delay: idx * 0.05, duration: 0.5 }}
                            className="w-full bg-nexo-500 rounded-t-lg relative group"
                          >
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-black/80 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                              +{item.count}
                            </div>
                          </motion.div>
                          <span className="text-[10px] text-zinc-500 truncate w-full text-center">
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="h-32 flex items-center justify-center text-zinc-500">
                    <p className="text-sm">Нет данных о росте</p>
                  </div>
                )}
              </div>

              {/* Top Posts */}
              <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                  <TrendingUp size={16} className="text-orange-400" />
                  Топ посты
                </h3>
                <div className="space-y-2">
                  {analytics.topPosts.slice(0, 5).map((post: any, idx: number) => (
                    <div key={post.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-secondary">
                      <span className="text-xs font-bold text-zinc-500 w-4">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{post.content || 'Медиа пост'}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {formatNumber(post.viewCount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recent Posts */}
              <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                <h3 className="text-sm font-semibold text-white mb-3">Последние посты</h3>
                <div className="space-y-2">
                  {analytics.recentPosts.slice(0, 5).map((post: any) => (
                    <div key={post.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface-secondary">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{post.content || 'Медиа пост'}</p>
                        <p className="text-xs text-zinc-500">
                          {new Date(post.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Eye size={12} />
                          {formatNumber(post.viewCount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : activeTab === 'subscribers' ? (
            <div className="space-y-2">
              {loadingSubscribers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : subscribers.length > 0 ? (
                <div className="space-y-1">
                  {subscribers.map((member) => (
                    <button
                      key={member.user.id}
                      onClick={() => handleOpenChat(member.user.id)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-colors group text-left"
                    >
                      <div className="relative flex-shrink-0">
                        {member.user.avatar ? (
                          <img src={member.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-nexo-500 flex items-center justify-center text-white text-sm font-bold">
                            {(member.user.displayName || member.user.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        {member.user.isOnline && (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-surface-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {member.user.displayName || member.user.username}
                        </p>
                        <p className="text-xs text-zinc-500">@{member.user.username}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-zinc-500">
                          {new Date(member.joinedAt).toLocaleDateString()}
                        </span>
                        <MessageSquare size={16} className="text-zinc-600 group-hover:text-nexo-400 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-zinc-500">
                  <Users size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Пока нет подписчиков</p>
                </div>
              )}
            </div>
          ) : activeTab === 'settings' && channel ? (
            <div className="space-y-4">
              {isEditing ? (
                <>
                  {/* Avatar upload */}
                  <div className="flex flex-col items-center py-4">
                    <div className="relative group">
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-nexo-500/20 rounded-full blur-[30px] pointer-events-none" />
                      <div className="relative z-10 p-1.5 rounded-full border border-white/10 shadow-2xl">
                        {channel.avatar ? (
                          <img src={channel.avatar} alt="" className="w-24 h-24 rounded-full object-cover shadow-inner" />
                        ) : (
                          <div className="w-24 h-24 rounded-full bg-nexo-500 flex items-center justify-center text-white font-bold text-3xl shadow-inner">
                            {(channel.name || 'C')[0].toUpperCase()}
                          </div>
                        )}
                      </div>

                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={avatarUploading}
                        className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                      >
                        {avatarUploading ? (
                          <Loader2 size={20} className="text-white animate-spin" />
                        ) : (
                          <Camera size={20} className="text-white" />
                        )}
                      </button>
                      {channel.avatar && (
                        <button
                          onClick={handleRemoveAvatar}
                          disabled={avatarUploading}
                          className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X size={12} className="text-white" />
                        </button>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarUpload}
                    />
                    <p className="text-xs text-zinc-500 mt-2">Нажмите на аватар, чтобы изменить</p>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                      Название канала
                    </label>
                    <input
                      type="text"
                      value={editData.name}
                      onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-surface-tertiary border border-border text-white focus:border-nexo-500 focus:outline-none"
                      placeholder="Название канала..."
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                      Описание
                    </label>
                    <textarea
                      value={editData.description}
                      onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                      className="w-full px-4 py-3 rounded-xl bg-surface-tertiary border border-border text-white focus:border-nexo-500 focus:outline-none resize-none h-32"
                      placeholder="Описание канала..."
                    />
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={handleSaveSettings}
                      className="flex-1 py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
                    >
                      Отмена
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-4 p-4 rounded-2xl bg-surface-tertiary border border-border">
                    <Avatar
                      src={channel.avatar}
                      name={channel.name || 'Канал'}
                      size="lg"
                      className="w-20 h-20"
                    />
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-white">{channel.name}</h3>
                      <p className="text-sm text-zinc-400">{analytics?.subscribers || 0} подписчиков</p>
                    </div>
                  </div>

                  {/* Channel link */}
                  {channel.username && (
                    <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 block">
                        Ссылка на канал
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-surface-secondary border border-border">
                          <LinkIcon size={14} className="text-nexo-400 flex-shrink-0" />
                          <span className="text-sm text-zinc-300 truncate">
                            {window.location.origin}/?channel={channel.username}
                          </span>
                        </div>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/?channel=${channel.username}`);
                            alert('Ссылка скопирована!');
                          }}
                          className="p-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white transition-colors"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-zinc-500 mt-2">Поделитесь этой ссылкой, чтобы другие могли присоединиться к каналу</p>
                    </div>
                  )}

                  <button
                    onClick={() => setIsEditing(true)}
                    className="w-full py-3 rounded-xl bg-surface-tertiary border border-border text-white font-medium hover:bg-surface-hover transition-colors flex items-center justify-center gap-2"
                  >
                    <Edit3 size={18} />
                    Редактировать канал
                  </button>

                  {/* Subscription price */}
                  <div className="bg-surface-tertiary rounded-2xl p-4 border border-border">
                    <div className="flex items-center gap-2 mb-3">
                      <Crown size={16} className="text-amber-400" />
                      <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        Платная подписка
                      </label>
                    </div>
                    {editingPrice ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="number"
                            value={priceInput}
                            onChange={e => setPriceInput(e.target.value)}
                            min={0}
                            className="w-full px-4 py-2.5 rounded-xl bg-surface-secondary border border-border text-white focus:border-amber-500 focus:outline-none pr-16"
                            placeholder="0 = бесплатно"
                          />
                          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-zinc-400 flex items-center gap-1">/мес</span>
                        </div>
                        <p className="text-xs text-zinc-500">
                          0 = бесплатный канал. Укажите цену в бобрах за месяц подписки.
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setEditingPrice(false); setPriceInput(String(subscriptionPrice)); }}
                            className="flex-1 py-2 rounded-xl bg-white/5 text-sm text-zinc-400 hover:bg-white/10 transition-colors"
                          >
                            Отмена
                          </button>
                          <button
                            onClick={handleSavePrice}
                            disabled={savingPrice}
                            className="flex-1 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {savingPrice ? <Loader2 size={14} className="animate-spin" /> : null}
                            Сохранить
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <div>
                          {subscriptionPrice > 0 ? (
                            <div className="flex items-center gap-2">
                              <Lock size={14} className="text-amber-400" />
                              <span className="text-sm font-medium text-amber-400 flex items-center gap-1">{subscriptionPrice} / месяц</span>
                            </div>
                          ) : (
                            <span className="text-sm text-zinc-400">Бесплатный канал</span>
                          )}
                          <p className="text-xs text-zinc-500 mt-1">
                            {subscriptionPrice > 0 ? 'Новые подписчики платят бобрами' : 'Все могут подписаться бесплатно'}
                          </p>
                        </div>
                        <button
                          onClick={() => setEditingPrice(true)}
                          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                        >
                          <Edit3 size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-border">
                    <button
                      onClick={handleDeleteChannel}
                      className="w-full py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 font-medium hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={18} />
                      Удалить канал
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : null}
        </div>
      </motion.div>
    </>
  );
}
