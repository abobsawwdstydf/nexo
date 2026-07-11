import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, UserPlus, Check, X, Search, Loader2, Clock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { useLang } from '../lib/i18n';
import Avatar from '../components/Avatar';
import type { FriendWithId, FriendRequest } from '../lib/types';

type FriendsTab = 'list' | 'requests' | 'search';

export default function FriendsPage({ onClose }: { onClose?: () => void }) {
  const { user } = useAuthStore();
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<FriendsTab>('list');
  const [friends, setFriends] = useState<FriendWithId[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /** Загрузка друзей */
  const loadFriends = () => {
    api.getFriends()
      .then((data: any) => setFriends(data.map((f: any) => ({ ...f.friend, friendshipId: f.id }))))
      .catch(console.error);
  };

  /** Загрузка запросов в друзья */
  const loadRequests = () => {
    Promise.all([
      api.getFriendRequests(),
      api.getOutgoingRequests(),
    ])
      .then(([incoming, outgoing]) => {
        setIncomingRequests(incoming || []);
        setOutgoingRequests(outgoing || []);
      })
      .catch(console.error);
  };

  useEffect(() => {
    loadFriends();
    loadRequests();
  }, []);

  /** Поиск пользователей */
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await api.searchUsers(searchQuery);
        // Исключаем уже друзей и себя
        const friendIds = new Set(friends.map(f => f.id));
        setSearchResults(results.filter(u => u.id !== user?.id && !friendIds.has(u.id)));
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, friends, user]);

  /** Отправить запрос в друзья */
  const sendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      loadRequests();
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (e) {
      console.error(e);
    }
  };

  /** Принять запрос */
  const acceptRequest = async (requestId: string) => {
    try {
      await api.acceptFriendRequest(requestId);
      loadFriends();
      loadRequests();
    } catch (e) {
      console.error(e);
    }
  };

  /** Отклонить запрос */
  const declineRequest = async (requestId: string) => {
    try {
      await api.declineFriendRequest(requestId);
      loadRequests();
    } catch (e) {
      console.error(e);
    }
  };

  /** Удалить друга */
  const removeFriend = async (friendId: string) => {
    try {
      await api.removeFriend(friendId);
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  /** Отменить исходящий запрос */
  const cancelOutgoing = async (requestId: string) => {
    try {
      await api.declineFriendRequest(requestId);
      loadRequests();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0f]">
      {/* Header */}
      <div className="glass-strong px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          className="glass-btn w-9 h-9 rounded-xl text-zinc-400 hover:text-white"
        >
          <X size={18} />
        </motion.button>
        <div className="flex items-center gap-2.5 flex-1">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
            <Users size={16} className="text-white" />
          </div>
          <h1 className="text-base font-bold text-white">Друзья</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 py-2 flex-shrink-0">
        <div className="flex gap-1 p-1 rounded-2xl glass-subtle">
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('list')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'list'
                ? 'glass-tab-active text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Друзья
            {friends.length > 0 && (
              <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                activeTab === 'list' ? 'bg-white/20 text-white' : 'bg-zinc-700 text-zinc-400'
              }`}>
                {friends.length > 99 ? '99+' : friends.length}
              </span>
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('requests')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'requests'
                ? 'glass-tab-active text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Запросы
            {(incomingRequests.length + outgoingRequests.length) > 0 && (
              <span className={`min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ${
                activeTab === 'requests' ? 'bg-white/20 text-white' : 'bg-nexo-500 text-white'
              }`}>
                {(incomingRequests.length + outgoingRequests.length) > 99 ? '99+' : (incomingRequests.length + outgoingRequests.length)}
              </span>
            )}
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => setActiveTab('search')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
              activeTab === 'search'
                ? 'glass-tab-active text-white'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Поиск
          </motion.button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <AnimatePresence mode="wait">
          {/* Список друзей */}
          {activeTab === 'list' && (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {friends.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
                  <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center">
                    <Users size={28} className="opacity-40" />
                  </div>
                  <p className="text-sm">Список друзей пуст</p>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveTab('search')}
                    className="glass-btn px-4 py-2 rounded-xl text-xs text-nexo-400"
                  >
                    <UserPlus size={14} className="mr-1.5" />
                    Найти друзей
                  </motion.button>
                </div>
              ) : (
                <div className="space-y-1">
                  {friends.map(friend => (
                    <div
                      key={friend.id}
                      className="flex items-center gap-3 p-3 rounded-2xl glass-subtle group"
                    >
                      <div className="relative">
                        <Avatar
                          src={friend.avatar}
                          name={friend.displayName || friend.username}
                          size="md"
                          isVerified={friend.isVerified}
                          verifiedBadgeUrl={friend.verifiedBadgeUrl}
                          verifiedBadgeType={friend.verifiedBadgeType}
                        />
                        {friend.isOnline && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-green-500 border-2 border-[#0a0a0f]" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{friend.displayName || friend.username}</p>
                        <p className="text-xs text-zinc-500">@{friend.username}</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.9 }}
                        onClick={() => removeFriend(friend.id)}
                        className="glass-btn w-8 h-8 rounded-xl text-zinc-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                        title="Удалить друга"
                      >
                        <X size={14} />
                      </motion.button>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* Запросы в друзья */}
          {activeTab === 'requests' && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Входящие запросы */}
              {incomingRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <UserPlus size={12} />
                    Входящие ({incomingRequests.length})
                  </h3>
                  <div className="space-y-1">
                    {incomingRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-3 p-3 rounded-2xl glass-subtle">
                        <Avatar
                          src={req.sender?.avatar}
                          name={req.sender?.displayName || req.sender?.username}
                          size="md"
                          isVerified={req.sender?.isVerified}
                          verifiedBadgeUrl={req.sender?.verifiedBadgeUrl}
                          verifiedBadgeType={req.sender?.verifiedBadgeType}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{req.sender?.displayName || req.sender?.username}</p>
                          <p className="text-xs text-zinc-500">@{req.sender?.username}</p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => acceptRequest(req.id)}
                            className="glass-btn w-8 h-8 rounded-xl text-green-400 hover:text-green-300"
                            title="Принять"
                          >
                            <Check size={14} />
                          </motion.button>
                          <motion.button
                            whileTap={{ scale: 0.9 }}
                            onClick={() => declineRequest(req.id)}
                            className="glass-btn w-8 h-8 rounded-xl text-red-400 hover:text-red-300"
                            title="Отклонить"
                          >
                            <X size={14} />
                          </motion.button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Исходящие запросы */}
              {outgoingRequests.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Clock size={12} />
                    Исходящие ({outgoingRequests.length})
                  </h3>
                  <div className="space-y-1">
                    {outgoingRequests.map(req => (
                      <div key={req.id} className="flex items-center gap-3 p-3 rounded-2xl glass-subtle">
                        <div className="w-10 h-10 rounded-full glass-subtle flex items-center justify-center">
                          <Clock size={16} className="text-zinc-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">Запрос отправлен</p>
                          <p className="text-xs text-zinc-500">Ожидание ответа...</p>
                        </div>
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => cancelOutgoing(req.id)}
                          className="glass-btn w-8 h-8 rounded-xl text-zinc-500 hover:text-red-400"
                          title="Отменить"
                        >
                          <X size={14} />
                        </motion.button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Пусто */}
              {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 gap-3 text-zinc-500">
                  <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center">
                    <Clock size={28} className="opacity-40" />
                  </div>
                  <p className="text-sm">Нет запросов в друзья</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Поиск */}
          {activeTab === 'search' && (
            <motion.div
              key="search"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ duration: 0.2 }}
            >
              {/* Поле поиска */}
              <div className="relative mb-4">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск по имени или username..."
                  className="w-full pl-10 pr-4 py-3 rounded-2xl text-sm text-white placeholder-zinc-500 glass-input"
                />
              </div>

              {/* Результаты */}
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={24} className="text-nexo-400 animate-spin" />
                </div>
              ) : searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map(u => (
                    <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl glass-subtle">
                      <Avatar
                        src={u.avatar}
                        name={u.displayName || u.username}
                        size="md"
                        isVerified={u.isVerified}
                        verifiedBadgeUrl={u.verifiedBadgeUrl}
                        verifiedBadgeType={u.verifiedBadgeType}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                        <p className="text-xs text-zinc-500">@{u.username}</p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => sendRequest(u.id)}
                        className="glass-btn px-3 py-1.5 rounded-xl text-xs text-nexo-400"
                      >
                        <UserPlus size={12} className="mr-1" />
                        Добавить
                      </motion.button>
                    </div>
                  ))}
                </div>
              ) : searchQuery.length >= 2 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
                  <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center">
                    <Search size={28} className="opacity-40" />
                  </div>
                  <p className="text-sm">Никого не найдено</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-500">
                  <div className="w-16 h-16 rounded-full glass-subtle flex items-center justify-center">
                    <Search size={28} className="opacity-40" />
                  </div>
                  <p className="text-sm">Введите имя для поиска</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
