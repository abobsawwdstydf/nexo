import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Clock,
  MessageCircle,
  Check,
  Ban,
} from 'lucide-react';
import { api } from '../lib/api';
import type { FriendWithId, FriendRequest } from '../lib/types';

type Tab = 'online' | 'all' | 'pending' | 'blocked';

interface FriendsPanelProps {
  onClose: () => void;
  onStartChat: (userId: string) => void;
}

function FriendAvatar({
  user,
  size = 'md',
}: {
  user: { avatar: string | null; displayName: string };
  size?: 'sm' | 'md';
}) {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName}
        className={`${sizeClass} rounded-xl object-cover flex-shrink-0`}
      />
    );
  }

  const initials = user.displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`${sizeClass} rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center flex-shrink-0`}
    >
      <span className="text-xs font-medium text-white/50">{initials}</span>
    </div>
  );
}

function OnlineDot() {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400/80 border-2 border-[#0a0a0f]" />
  );
}

export default function FriendsPanel({ onClose, onStartChat }: FriendsPanelProps) {
  const [tab, setTab] = useState<Tab>('online');
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<FriendWithId[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<any[]>([]);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const { getSocket } = await import('../lib/socket');
      if (getSocket()?.connected) {
        const [friendsData, requestsData] = await Promise.all([
          api.fetchFriendsWS(),
          api.fetchFriendRequestsWS(),
        ]);
        setFriends(Array.isArray(friendsData) ? friendsData : []);
        setRequests(Array.isArray(requestsData) ? requestsData : []);
      } else {
        const [friendsData, requestsData] = await Promise.all([
          api.getFriends(),
          api.getFriendRequests(),
        ]);
        setFriends(Array.isArray(friendsData) ? friendsData : []);
        setRequests(Array.isArray(requestsData) ? requestsData : []);
      }
    } catch (err) {
      console.error('Failed to fetch friends:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchData();
    })();
    return () => { cancelled = true; };
  }, []);

  // Search friends by query
  const filteredFriends = friends.filter(f =>
    !search || f.displayName.toLowerCase().includes(search.toLowerCase()) ||
    f.username.toLowerCase().includes(search.toLowerCase())
  );

  const onlineFriends = filteredFriends.filter(f => f.isOnline);

  // Search users to add
  useEffect(() => {
    if (addQuery.length < 2) {
      setAddResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setAddLoading(true);
      try {
        const results = await api.searchUsers(addQuery);
        if (cancelled) return;
        setAddResults(Array.isArray(results) ? results : []);
        setAddError('');
      } catch {
        if (cancelled) return;
        setAddError('Ошибка поиска');
      } finally {
        if (!cancelled) setAddLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [addQuery]);

  const handleSendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      setAddQuery('');
      setAddResults([]);
      setShowAddFriend(false);
      fetchData();
    } catch {
      setAddError('Не удалось отправить заявку');
    }
  };

  const handleAccept = async (friendshipId: string) => {
    try {
      await api.acceptFriendRequest(friendshipId);
      fetchData();
    } catch {
      console.error('Failed to accept request');
    }
  };

  const handleDecline = async (friendshipId: string) => {
    try {
      await api.declineFriendRequest(friendshipId);
      fetchData();
    } catch {
      console.error('Failed to decline request');
    }
  };

  const handleRemove = async (friendshipId: string) => {
    try {
      await api.removeFriend(friendshipId);
      fetchData();
    } catch {
      console.error('Failed to remove friend');
    }
  };

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'online', label: 'В сети', icon: Users },
    { key: 'all', label: 'Все', icon: Users },
    { key: 'pending', label: 'Заявки', icon: UserPlus },
    { key: 'blocked', label: 'Заблок.', icon: Ban },
  ];

  const renderFriendList = (items: FriendWithId[], emptyText: string) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <Users size={28} className="text-white/15 mb-3" />
          <p className="text-sm text-white/30">{emptyText}</p>
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        {items.map(friend => (
          <motion.div
            key={friend.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="group flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-all duration-200 hover:border-white/[0.06] border border-transparent"
          >
            <div className="relative flex-shrink-0">
              <FriendAvatar user={friend} size="md" />
              {friend.isOnline && <OnlineDot />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white/80 truncate">
                  {friend.displayName}
                </span>
                {friend.isOnline && (
                  <span className="text-[10px] text-green-400/60">в сети</span>
                )}
              </div>
              <p className="text-xs text-white/30 truncate">@{friend.username}</p>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={() => onStartChat(friend.id)}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors"
                title="Написать"
              >
                <MessageCircle size={14} className="text-white/40 hover:text-white/70" />
              </button>
              <button
                onClick={() => handleRemove(friend.friendshipId)}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors"
                title="Удалить из друзей"
              >
                <UserX size={14} className="text-red-400/50 hover:text-red-400" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderPending = () => {
    const incoming = requests.filter(r => r.status === 'pending');
    if (incoming.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
          <Clock size={28} className="text-white/15 mb-3" />
          <p className="text-sm text-white/30">Нет входящих заявок</p>
        </div>
      );
    }

    return (
      <div className="space-y-0.5">
        {incoming.map(req => (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
          >
            <FriendAvatar user={req.sender} size="md" />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-white/80 truncate block">
                {req.sender.displayName}
              </span>
              <p className="text-xs text-white/30 truncate">@{req.sender.username}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleAccept(req.id)}
                className="p-1.5 rounded-lg bg-green-400/10 hover:bg-green-400/20 transition-colors"
                title="Принять"
              >
                <Check size={14} className="text-green-400/70" />
              </button>
              <button
                onClick={() => handleDecline(req.id)}
                className="p-1.5 rounded-lg bg-red-400/10 hover:bg-red-400/20 transition-colors"
                title="Отклонить"
              >
                <X size={14} className="text-red-400/70" />
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center glass-card-enhanced">
            <Users size={15} className="text-indigo-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90 font-display">Друзья</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button
            onClick={() => { setShowAddFriend(v => !v); setAddError(''); }}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Добавить друга"
          >
            <UserPlus size={15} className="text-white/40" />
          </motion.button>
          <motion.button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Add friend panel */}
      <AnimatePresence>
        {showAddFriend && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]"
          >
            <div className="px-4 py-3 space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={addQuery}
                  onChange={e => setAddQuery(e.target.value)}
                  placeholder="Поиск пользователей..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
                />
              </div>
              {addLoading && (
                <p className="text-xs text-white/30 text-center">Поиск...</p>
              )}
              {addError && (
                <p className="text-xs text-red-400/70">{addError}</p>
              )}
              {addResults.length > 0 && (
                <div className="space-y-0.5 max-h-40 overflow-y-auto">
                  {addResults.map(u => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.04]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FriendAvatar user={u} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs text-white/70 truncate">{u.displayName}</p>
                          <p className="text-[10px] text-white/30 truncate">@{u.username}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(u.id)}
                        className="p-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-colors flex-shrink-0"
                        title="Добавить в друзья"
                      >
                        <UserPlus size={12} className="text-indigo-400/70" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 px-3 py-2 border-b border-white/[0.06]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
              tab === t.key
                ? 'bg-white/[0.08] text-white/80'
                : 'text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Search (for online/all tabs) */}
      {(tab === 'online' || tab === 'all') && (
        <div className="flex-shrink-0 px-3 pt-2 pb-1">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск среди друзей..."
              className="w-full h-8 pl-9 pr-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
            />
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {loading ? (
          <div className="flex flex-col gap-2 px-2 pt-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-10 h-10 rounded-xl skeleton-shimmer bg-white/[0.04]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-24 rounded skeleton-shimmer bg-white/[0.04]" />
                  <div className="h-2 w-16 rounded skeleton-shimmer bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'online' ? (
          renderFriendList(onlineFriends, 'Нет друзей в сети')
        ) : tab === 'all' ? (
          renderFriendList(filteredFriends, 'Нет друзей')
        ) : tab === 'pending' ? (
          renderPending()
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
            <Ban size={28} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30">Нет заблокированных</p>
          </div>
        )}
      </div>
    </div>
  );
}

