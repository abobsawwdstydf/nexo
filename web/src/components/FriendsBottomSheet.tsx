import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, AnimatePresence, type PanInfo } from 'framer-motion';
import { Users, UserPlus, Search, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import Avatar from './Avatar';
import type { FriendWithId, FriendRequest } from '../lib/types';

type FriendsTab = 'list' | 'requests' | 'search';

interface FriendsBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
}

const COLLAPSED_RATIO = 0.45;
const FULL_RATIO = 0.92;

export default function FriendsBottomSheet({ isOpen, onClose, isMobile }: FriendsBottomSheetProps) {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<FriendsTab>('list');
  const [friends, setFriends] = useState<FriendWithId[]>([]);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<FriendRequest[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const dragY = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadFriends = useCallback(() => {
    api.getFriends()
      .then((data: any) => setFriends(data.map((f: any) => ({ ...f.friend, friendshipId: f.id }))))
      .catch(console.error);
  }, []);

  const loadRequests = useCallback(() => {
    Promise.all([api.getFriendRequests(), api.getOutgoingRequests()])
      .then(([incoming, outgoing]) => {
        setIncomingRequests(incoming || []);
        setOutgoingRequests(outgoing || []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    loadFriends();
    loadRequests();
    setActiveTab('list');
    setIsExpanded(false);
  }, [isOpen, loadFriends, loadRequests]);

  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const results = await api.searchUsers(searchQuery);
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

  const sendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      loadRequests();
      setSearchResults(prev => prev.filter(u => u.id !== userId));
    } catch (e) { console.error(e); }
  };

  const acceptRequest = async (requestId: string) => {
    try {
      await api.acceptFriendRequest(requestId);
      loadFriends();
      loadRequests();
    } catch (e) { console.error(e); }
  };

  const declineRequest = async (requestId: string) => {
    try { await api.declineFriendRequest(requestId); loadRequests(); } catch (e) { console.error(e); }
  };

  const removeFriend = async (friendId: string) => {
    try { await api.removeFriend(friendId); loadFriends(); } catch (e) { console.error(e); }
  };

  const cancelOutgoing = async (requestId: string) => {
    try { await api.declineFriendRequest(requestId); loadRequests(); } catch (e) { console.error(e); }
  };

  const handleDragEnd = (_: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;
    if (isExpanded) {
      if (offset > 80 || velocity > 300) {
        setIsExpanded(false);
      }
    } else {
      if (offset < -60 || velocity < -300) {
        setIsExpanded(true);
      } else if (offset > 120 || velocity > 500) {
        onClose();
      }
    }
    dragY.set(0);
  };

  // Desktop: modal overlay
  if (!isMobile) return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm hidden sm:block"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[75] w-full max-w-sm max-h-[75vh] hidden sm:flex flex-col overflow-hidden rounded-2xl bg-[#1a1a1f] border border-white/10 shadow-2xl"
          >
            <DesktopFriendsContent
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              friends={friends}
              incomingRequests={incomingRequests}
              outgoingRequests={outgoingRequests}
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              searchResults={searchResults}
              isLoading={isLoading}
              onClose={onClose}
              acceptRequest={acceptRequest}
              declineRequest={declineRequest}
              removeFriend={removeFriend}
              cancelOutgoing={cancelOutgoing}
              sendRequest={sendRequest}
            />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Mobile: bottom sheet
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm sm:hidden"
            onClick={onClose}
          />
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{
              y: isExpanded ? `${(1 - FULL_RATIO) * 100}%` : `${(1 - COLLAPSED_RATIO) * 100}%`,
            }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            style={{ y: dragY }}
            className="fixed inset-x-0 bottom-0 z-[75] sm:hidden flex flex-col overflow-hidden rounded-t-2xl bg-[#1a1a1f] border-t border-white/10 shadow-[0_-16px_40px_rgba(0,0,0,0.5)]"
          >
            {/* Drag handle */}
            <div
              className="flex-shrink-0 flex justify-center pt-2.5 pb-2 cursor-pointer"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              <div className="w-9 h-1 bg-white/15 rounded-full" />
            </div>

            {/* Header */}
            <div className="flex-shrink-0 px-4 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
                  <Users size={13} className="text-white" />
                </div>
                <h2 className="text-sm font-bold text-white">Друзья</h2>
                {friends.length > 0 && (
                  <span className="min-w-[16px] h-4 px-1 rounded-full bg-white/10 text-[9px] font-bold flex items-center justify-center text-zinc-300">
                    {friends.length > 99 ? '99+' : friends.length}
                  </span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex-shrink-0 px-4 pb-2">
              <div className="flex gap-1 p-0.5 rounded-xl bg-white/5">
                {([
                  { key: 'list' as FriendsTab, label: 'Друзья', count: friends.length },
                  { key: 'requests' as FriendsTab, label: 'Запросы', count: incomingRequests.length + outgoingRequests.length },
                  { key: 'search' as FriendsTab, label: 'Поиск', count: 0 },
                ]).map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                      activeTab === tab.key
                        ? 'bg-white/10 text-white'
                        : 'text-zinc-400 hover:text-white'
                    }`}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className={`min-w-[14px] h-[14px] px-1 rounded-full text-[8px] font-bold flex items-center justify-center ${
                        activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-nexo-500 text-white'
                      }`}>
                        {tab.count > 99 ? '99+' : tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] min-h-0">
              {activeTab === 'list' && (
                <div className="space-y-0.5 pt-1">
                  {friends.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-zinc-500">
                      <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                        <Users size={18} className="opacity-40" />
                      </div>
                      <p className="text-xs">Список друзей пуст</p>
                      <button
                        onClick={() => setActiveTab('search')}
                        className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-nexo-400 transition-all"
                      >
                        Найти друзей
                      </button>
                    </div>
                  ) : (
                    friends.map(friend => (
                      <div key={friend.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                        <div className="relative flex-shrink-0">
                          <Avatar
                            src={friend.avatar}
                            name={friend.displayName || friend.username}
                            size="sm"
                            isVerified={friend.isVerified}
                            verifiedBadgeUrl={friend.verifiedBadgeUrl}
                            verifiedBadgeType={friend.verifiedBadgeType}
                          />
                          {friend.isOnline && (
                            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#1a1a1f]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{friend.displayName || friend.username}</p>
                          <p className="text-[10px] text-zinc-500 truncate">@{friend.username}</p>
                        </div>
                        <button
                          onClick={() => removeFriend(friend.id)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === 'requests' && (
                <div className="space-y-2 pt-1">
                  {incomingRequests.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Входящие ({incomingRequests.length})
                      </h3>
                      <div className="space-y-0.5">
                        {incomingRequests.map(req => (
                          <div key={req.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                            <div className="relative flex-shrink-0">
                              <Avatar
                                src={req.sender?.avatar}
                                name={req.sender?.displayName || req.sender?.username}
                                size="sm"
                                isVerified={req.sender?.isVerified}
                                verifiedBadgeUrl={req.sender?.verifiedBadgeUrl}
                                verifiedBadgeType={req.sender?.verifiedBadgeType}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{req.sender?.displayName || req.sender?.username}</p>
                              <p className="text-[10px] text-zinc-500 truncate">@{req.sender?.username}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button
                                onClick={() => acceptRequest(req.id)}
                                className="w-7 h-7 rounded-lg bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center text-green-400 transition-all"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                              </button>
                              <button
                                onClick={() => declineRequest(req.id)}
                                className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400 transition-all"
                              >
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {outgoingRequests.length > 0 && (
                    <div>
                      <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                        Исходящие ({outgoingRequests.length})
                      </h3>
                      <div className="space-y-0.5">
                        {outgoingRequests.map(req => (
                          <div key={req.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                            <div className="relative flex-shrink-0">
                              <Avatar
                                src={(req as any).receiver?.avatar}
                                name={(req as any).receiver?.displayName || (req as any).receiver?.username || '?'}
                                size="sm"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-white truncate">{(req as any).receiver?.displayName || (req as any).receiver?.username || 'Запрос отправлен'}</p>
                              <p className="text-[10px] text-zinc-500">Ожидание ответа...</p>
                            </div>
                            <button
                              onClick={() => cancelOutgoing(req.id)}
                              className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
                            >
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-zinc-500">
                      <p className="text-xs">Нет запросов</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'search' && (
                <div className="pt-1">
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Найти пользователей..."
                      className="w-full pl-8 pr-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 bg-white/5 border border-white/10 focus:outline-none focus:border-nexo-500/50 transition-colors"
                    />
                  </div>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Loader2 size={18} className="text-nexo-400 animate-spin" />
                    </div>
                  ) : searchResults.length > 0 ? (
                    <div className="space-y-0.5">
                      {searchResults.map(u => (
                        <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                          <div className="relative flex-shrink-0">
                            <Avatar
                              src={u.avatar}
                              name={u.displayName || u.username}
                              size="sm"
                              isVerified={u.isVerified}
                              verifiedBadgeUrl={u.verifiedBadgeUrl}
                              verifiedBadgeType={u.verifiedBadgeType}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-white truncate">{u.displayName || u.username}</p>
                            <p className="text-[10px] text-zinc-500 truncate">@{u.username}</p>
                          </div>
                          <button
                            onClick={() => sendRequest(u.id)}
                            className="px-2 py-1 rounded-lg bg-nexo-500/20 hover:bg-nexo-500/30 text-[10px] text-nexo-300 font-medium transition-all flex-shrink-0"
                          >
                            <UserPlus size={10} className="inline mr-0.5" />
                            Добавить
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : searchQuery.length >= 2 ? (
                    <p className="text-center text-[11px] text-zinc-500 py-6">Не найдено</p>
                  ) : (
                    <p className="text-center text-[11px] text-zinc-500 py-6">Введите имя для поиска</p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function DesktopFriendsContent({
  activeTab, setActiveTab, friends, incomingRequests, outgoingRequests,
  searchQuery, setSearchQuery, searchResults, isLoading, onClose,
  acceptRequest, declineRequest, removeFriend, cancelOutgoing, sendRequest,
}: {
  activeTab: FriendsTab;
  setActiveTab: (t: FriendsTab) => void;
  friends: FriendWithId[];
  incomingRequests: FriendRequest[];
  outgoingRequests: FriendRequest[];
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchResults: any[];
  isLoading: boolean;
  onClose: () => void;
  acceptRequest: (id: string) => void;
  declineRequest: (id: string) => void;
  removeFriend: (id: string) => void;
  cancelOutgoing: (id: string) => void;
  sendRequest: (id: string) => void;
}) {
  return (
    <>
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
            <Users size={13} className="text-white" />
          </div>
          <h2 className="text-sm font-bold text-white">Друзья</h2>
          {friends.length > 0 && (
            <span className="min-w-[16px] h-4 px-1 rounded-full bg-white/10 text-[9px] font-bold flex items-center justify-center text-zinc-300">
              {friends.length > 99 ? '99+' : friends.length}
            </span>
          )}
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>

      <div className="px-3 pt-2 pb-1 flex-shrink-0">
        <div className="flex gap-1 p-0.5 rounded-xl bg-white/5">
          {([
            { key: 'list' as FriendsTab, label: 'Друзья', count: friends.length },
            { key: 'requests' as FriendsTab, label: 'Запросы', count: incomingRequests.length + outgoingRequests.length },
            { key: 'search' as FriendsTab, label: 'Поиск', count: 0 },
          ]).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-all flex items-center justify-center gap-1 ${
                activeTab === tab.key
                  ? 'bg-white/10 text-white'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`min-w-[14px] h-[14px] px-1 rounded-full text-[8px] font-bold flex items-center justify-center ${
                  activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-nexo-500 text-white'
                }`}>
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-0">
        {activeTab === 'list' && (
          <div className="space-y-0.5 pt-1">
            {friends.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-zinc-500">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                  <Users size={18} className="opacity-40" />
                </div>
                <p className="text-xs">Список друзей пуст</p>
                <button
                  onClick={() => setActiveTab('search')}
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-nexo-400 transition-all"
                >
                  Найти друзей
                </button>
              </div>
            ) : (
              friends.map(friend => (
                <div key={friend.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                  <div className="relative flex-shrink-0">
                    <Avatar
                      src={friend.avatar}
                      name={friend.displayName || friend.username}
                      size="sm"
                      isVerified={friend.isVerified}
                      verifiedBadgeUrl={friend.verifiedBadgeUrl}
                      verifiedBadgeType={friend.verifiedBadgeType}
                    />
                    {friend.isOnline && (
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-[#1a1a1f]" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white truncate">{friend.displayName || friend.username}</p>
                    <p className="text-[10px] text-zinc-500 truncate">@{friend.username}</p>
                  </div>
                  <button
                    onClick={() => removeFriend(friend.id)}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'requests' && (
          <div className="space-y-2 pt-1">
            {incomingRequests.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Входящие ({incomingRequests.length})
                </h3>
                <div className="space-y-0.5">
                  {incomingRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <div className="relative flex-shrink-0">
                        <Avatar
                          src={req.sender?.avatar}
                          name={req.sender?.displayName || req.sender?.username}
                          size="sm"
                          isVerified={req.sender?.isVerified}
                          verifiedBadgeUrl={req.sender?.verifiedBadgeUrl}
                          verifiedBadgeType={req.sender?.verifiedBadgeType}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{req.sender?.displayName || req.sender?.username}</p>
                        <p className="text-[10px] text-zinc-500 truncate">@{req.sender?.username}</p>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => acceptRequest(req.id)}
                          className="w-7 h-7 rounded-lg bg-green-500/20 hover:bg-green-500/30 flex items-center justify-center text-green-400 transition-all"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </button>
                        <button
                          onClick={() => declineRequest(req.id)}
                          className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400 transition-all"
                        >
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {outgoingRequests.length > 0 && (
              <div>
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  Исходящие ({outgoingRequests.length})
                </h3>
                <div className="space-y-0.5">
                  {outgoingRequests.map(req => (
                    <div key={req.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                      <div className="relative flex-shrink-0">
                        <Avatar
                          src={(req as any).receiver?.avatar}
                          name={(req as any).receiver?.displayName || (req as any).receiver?.username || '?'}
                          size="sm"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-white truncate">{(req as any).receiver?.displayName || (req as any).receiver?.username || 'Запрос отправлен'}</p>
                        <p className="text-[10px] text-zinc-500">Ожидание ответа...</p>
                      </div>
                      <button
                        onClick={() => cancelOutgoing(req.id)}
                        className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 flex items-center justify-center text-zinc-500 hover:text-red-400 transition-all flex-shrink-0"
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {incomingRequests.length === 0 && outgoingRequests.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-zinc-500">
                <p className="text-xs">Нет запросов</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'search' && (
          <div className="pt-1">
            <div className="relative mb-2">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Найти пользователей..."
                className="w-full pl-8 pr-3 py-2 rounded-xl text-xs text-white placeholder-zinc-500 bg-white/5 border border-white/10 focus:outline-none focus:border-nexo-500/50 transition-colors"
              />
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={18} className="text-nexo-400 animate-spin" />
              </div>
            ) : searchResults.length > 0 ? (
              <div className="space-y-0.5">
                {searchResults.map(u => (
                  <div key={u.id} className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/[0.03] transition-colors">
                    <div className="relative flex-shrink-0">
                      <Avatar
                        src={u.avatar}
                        name={u.displayName || u.username}
                        size="sm"
                        isVerified={u.isVerified}
                        verifiedBadgeUrl={u.verifiedBadgeUrl}
                        verifiedBadgeType={u.verifiedBadgeType}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-white truncate">{u.displayName || u.username}</p>
                      <p className="text-[10px] text-zinc-500 truncate">@{u.username}</p>
                    </div>
                    <button
                      onClick={() => sendRequest(u.id)}
                      className="px-2 py-1 rounded-lg bg-nexo-500/20 hover:bg-nexo-500/30 text-[10px] text-nexo-300 font-medium transition-all flex-shrink-0"
                    >
                      <UserPlus size={10} className="inline mr-0.5" />
                      Добавить
                    </button>
                  </div>
                ))}
              </div>
            ) : searchQuery.length >= 2 ? (
              <p className="text-center text-[11px] text-zinc-500 py-6">Не найдено</p>
            ) : (
              <p className="text-center text-[11px] text-zinc-500 py-6">Введите имя для поиска</p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
