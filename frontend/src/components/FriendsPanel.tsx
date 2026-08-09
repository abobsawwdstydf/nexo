import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  X,
  Users,
  UserPlus,
  UserX,
  Clock,
  MessageCircle,
  Check,
  Ban,
} from 'lucide-react';
import { api } from '../lib/api';
import { UserAvatar, OnlineDot } from './UserAvatar';
import { formatLastSeen } from '../lib/formatLastSeen';
import type { FriendWithId, FriendRequest, UserPresence } from '../lib/types';

type Tab = 'online' | 'all' | 'pending' | 'blocked';

interface FriendsPanelProps {
  onClose: () => void;
  onStartChat: (userId: string) => void;
  onOpenProfile?: (userId: string) => void;
}

export default function FriendsPanel({ onClose, onStartChat, onOpenProfile }: FriendsPanelProps) {
  const [tab, setTab] = useState<Tab>('online');
  const [search, setSearch] = useState('');
  const [friends, setFriends] = useState<FriendWithId[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [addQuery, setAddQuery] = useState('');
  const [addResults, setAddResults] = useState<UserPresence[]>([]);
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
  const filteredFriends = useMemo(() =>
    friends.filter(f =>
      !search ||
      f.displayName.toLowerCase().includes(search.toLowerCase()) ||
      f.username.toLowerCase().includes(search.toLowerCase())
    ), [friends, search]);

  const onlineFriends = filteredFriends.filter(f => f.isOnline);
  const incomingRequests = requests.filter(r => r.status === 'pending');

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

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: 'online', label: 'В сети' },
    { key: 'all', label: 'Все' },
    { key: 'pending', label: 'Заявки', badge: incomingRequests.length || undefined },
    { key: 'blocked', label: 'Заблокированные' },
  ];

  const renderFriendList = (items: FriendWithId[], emptyText: string) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center pt-12 px-4 text-center">
          <Users size={32} className="text-white/15 mb-3" />
          <p className="text-sm text-white/30">{emptyText}</p>
        </div>
      );
    }

    return (
      <AnimatePresence mode="popLayout">
        {items.map(friend => (
          <motion.div
            key={friend.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="group relative"
          >
            <div
              onClick={() => onOpenProfile && onOpenProfile(friend.id)}
              onKeyDown={(e) => {
                if (onOpenProfile && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  onOpenProfile(friend.id);
                }
              }}
              role={onOpenProfile ? 'button' : undefined}
              tabIndex={onOpenProfile ? 0 : undefined}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-all duration-200 border border-transparent hover:border-white/[0.06] text-left cursor-pointer"
              title="Открыть профиль"
            >
              <div className="relative flex-shrink-0">
                <div className="w-11 h-11 rounded-xl overflow-hidden">
                  <UserAvatar user={friend} size="md" />
                </div>
                {friend.isOnline && <OnlineDot />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white/85 truncate">
                    {friend.displayName}
                  </span>
                </div>
                <p className="text-[11px] text-white/35 truncate">
                  @{friend.username}
                  {!friend.isOnline && (
                    <span className="text-white/25">
                      {' · '}{formatLastSeen(friend.lastSeen) || 'был(а) давно'}
                    </span>
                  )}
                </p>
              </div>
              {friend.isOnline && (
                <span className="flex-shrink-0 text-[10px] text-green-400/70 font-medium">в сети</span>
              )}
              {/* Hover actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onStartChat(friend.id); }}
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors opacity-0 group-hover:opacity-100"
                  title="Написать"
                >
                  <MessageCircle size={15} className="text-white/40 hover:text-white/70" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemove(friend.friendshipId); }}
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors opacity-0 group-hover:opacity-100"
                  title="Удалить из друзей"
                >
                  <UserX size={15} className="text-red-400/50 hover:text-red-400" />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] relative">
      {/* ─── Top Header Bar (matches ChatList) ─────────────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <button
          onClick={onClose}
          className="md:hidden p-1.5 rounded-xl hover:bg-white/[0.06] text-white/40 transition-colors"
          title="Назад"
        >
          <X size={16} />
        </button>
        <h1 className="text-base font-bold text-white/90 font-display tracking-tight md:flex-1">
          Друзья
        </h1>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={() => { setShowAddFriend(v => !v); setAddError(''); }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-accent transition-colors"
            title="Добавить друга"
          >
            <UserPlus size={17} />
          </motion.button>
          <motion.button
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="hidden md:block p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white transition-colors"
            title="Закрыть"
          >
            <X size={17} />
          </motion.button>
        </div>
      </div>

      {/* ─── Add friend panel ─────────────────────────────────────── */}
      <AnimatePresence>
        {showAddFriend && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]"
          >
            <div className="px-3 py-3 space-y-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={addQuery}
                  onChange={e => setAddQuery(e.target.value)}
                  placeholder="Поиск пользователей..."
                  className="w-full h-9 pl-9 pr-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-2xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
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
                        <UserAvatar user={u} size="sm" />
                        <div className="min-w-0">
                          <p className="text-xs text-white/70 truncate">{u.displayName}</p>
                          <p className="text-[10px] text-white/30 truncate">@{u.username}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendRequest(u.id)}
                        className="p-1.5 rounded-lg bg-accent/10 hover:bg-accent/20 transition-colors flex-shrink-0"
                        title="Добавить в друзья"
                      >
                        <UserPlus size={12} className="text-accent/70" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Search Bar Pill (matches ChatList) ───────────────────── */}
      <div className="flex-shrink-0 px-3 py-2">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск друзей..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-white/[0.05] border border-white/[0.08] rounded-2xl text-white/80 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.08]"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10"
            >
              <X size={13} className="text-white/40" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Category Chips (matches ChatList) ────────────────────── */}
      <div className="flex-shrink-0 px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/[0.04]">
        {tabs.map(t => {
          const isActive = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white/[0.12] text-white shadow-sm border border-white/[0.1]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <span>{t.label}</span>
              {t.badge && (
                <span className="w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Content Stream ───────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 pb-20 md:pb-2">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-11 h-11 rounded-xl skeleton-shimmer bg-white/[0.04]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-24 rounded skeleton-shimmer bg-white/[0.04]" />
                  <div className="h-2.5 w-32 rounded skeleton-shimmer bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'online' ? (
          renderFriendList(onlineFriends, 'Нет друзей в сети')
        ) : tab === 'all' ? (
          renderFriendList(filteredFriends, 'Нет друзей')
        ) : tab === 'pending' ? (
          incomingRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center pt-12 px-4 text-center">
              <Clock size={32} className="text-white/15 mb-3" />
              <p className="text-sm text-white/30">Нет входящих заявок</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {incomingRequests.map(req => (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
                >
                  <div className="w-11 h-11 rounded-xl overflow-hidden">
                    <UserAvatar user={req.sender} size="md" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-white/80 truncate block">
                      {req.sender.displayName}
                    </span>
                    <p className="text-[11px] text-white/35 truncate">@{req.sender.username}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(req.id)}
                      className="p-2 rounded-lg bg-green-400/10 hover:bg-green-400/20 transition-colors"
                      title="Принять"
                    >
                      <Check size={15} className="text-green-400/70" />
                    </button>
                    <button
                      onClick={() => handleDecline(req.id)}
                      className="p-2 rounded-lg bg-red-400/10 hover:bg-red-400/20 transition-colors"
                      title="Отклонить"
                    >
                      <X size={15} className="text-red-400/70" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )
        ) : (
          <div className="flex flex-col items-center justify-center pt-12 px-4 text-center">
            <Ban size={32} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30">Нет заблокированных</p>
          </div>
        )}
      </div>
    </div>
  );
}