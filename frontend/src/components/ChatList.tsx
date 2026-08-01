import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  MessageCircle,
  LogOut,
  MoreVertical,
  User,
  Settings,
  Bookmark,
  Users,
  UserPlus,
  Plus,
  X,
  Clock,
  ArrowRight,
  Shield,
  Globe,
} from 'lucide-react';
import type { Chat, User as UserType } from '../lib/types';

interface ChatListProps {
  chats: Chat[];
  selectedChatId: string | null;
  onSelectChat: (chatId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  loading: boolean;
  user: UserType | null;
  onLogout: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onOpenFriends: () => void;
  onNewChat: () => void;
  onNewChannel: () => void;
  onOpenAccountManager: () => void;
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon?: typeof Users;
  label: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] transition-all duration-200 text-xs text-white/50 hover:text-white/70 hover:border-white/[0.1]"
      whileHover={{ scale: 1.03, y: -1 }}
      whileTap={{ scale: 0.97 }}
    >
      {Icon ? <Icon size={14} /> : null}
      {label}
    </motion.button>
  );
}

function ChatAvatar({ chat }: { chat: Chat }) {
  if (chat.id === '_saved_messages_') {
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Bookmark size={16} className="text-amber-400/70" />
      </div>
    );
  }

  const initials = (chat.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isOnline = chat.type === 'personal' && (chat as any).otherMember?.isOnline;

  return (
    <div className="relative flex-shrink-0">
      {chat.avatar ? (
        <img
          src={chat.avatar}
          alt={chat.name || 'Chat'}
          className="w-11 h-11 rounded-xl object-cover"
        />
      ) : (
        <div className="w-11 h-11 rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center">
          <span className="text-sm font-medium text-white/50">{initials}</span>
        </div>
      )}
      {isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400/80 border-2 border-[#0a0a0f]" />
      )}
    </div>
  );
}

function formatLastMessageTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'сейчас';
  if (diffMins < 60) return `${diffMins}м`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}ч`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}д`;

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function ChatListItem({
  chat,
  isSelected,
  onSelect,
}: {
  chat: Chat;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const lastMsg = chat.lastMessage || chat.messages?.[chat.messages.length - 1] || null;
  const previewText = lastMsg?.content || '';
  const timeStr = formatLastMessageTime(lastMsg?.createdAt || chat.createdAt);
  const unread = chat.unreadCount || 0;

  return (
    <motion.button
      onClick={onSelect}
      className={`
        relative w-full flex items-center gap-3 px-3 py-2.5 text-left transition-all duration-200
        ${isSelected
          ? 'bg-white/[0.08] border border-white/[0.1] liquid-glass-subtle'
          : 'hover:bg-white/[0.03] border border-transparent hover:border-white/[0.04]'
        }
        rounded-xl
      `}
      whileTap={{ scale: 0.98 }}
      layout
    >
      <ChatAvatar chat={chat} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-white/90 truncate">
            {chat.name || 'Без названия'}
          </span>
          {timeStr && (
            <span className="text-[11px] text-white/30 flex-shrink-0">
              {timeStr}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-white/40 truncate">
            {previewText || (chat.type === 'personal' ? 'Личный чат' : chat.type === 'group' ? 'Группа' : 'Канал')}
          </span>
          {unread > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-[10px] font-semibold text-white px-1">
                {unread > 99 ? '99+' : unread}
              </span>
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export function ChatList({
  chats,
  selectedChatId,
  onSelectChat,
  searchQuery,
  onSearchChange,
  loading,
  user,
  onLogout,
  onOpenProfile,
  onOpenSettings,
  onOpenFriends,
  onNewChat,
  onNewChannel,
  onOpenAccountManager,
}: ChatListProps) {
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBlurTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => {
    if (searchBlurTimerRef.current) clearTimeout(searchBlurTimerRef.current);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexo_recent_searches');
      if (saved) setRecentSearches(JSON.parse(saved));
    } catch {}
  }, []);

  const saveRecentSearch = (query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('nexo_recent_searches', JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem('nexo_recent_searches');
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowUserMenu(false);
      }
    }
    if (showUserMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showUserMenu]);

  const handleSearchSubmit = (query: string) => {
    if (query.trim()) {
      saveRecentSearch(query);
      setShowRecentSearches(false);
    }
  };

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <img
            src="/logo.png"
            alt="Нексо"
            className="w-8 h-8 rounded-xl object-cover bg-white/[0.06]"
            draggable={false}
          />
          <div>
            <h1 className="text-sm font-semibold text-white/90 font-display tracking-wide">
              Нексо
            </h1>
            <p className="text-[11px] text-white/30">
              Мессенджер
            </p>
          </div>
        </div>

        <div className="relative flex-shrink-0" ref={menuRef}>
          <motion.button
            onClick={() => setShowUserMenu(v => !v)}
            className="p-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-all duration-200"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MoreVertical size={19} className="text-white/60" />
          </motion.button>

          <AnimatePresence>
            {showUserMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15, ease: [0.4, 0, 0.2, 1] }}
                className="absolute right-0 top-full mt-1 w-52 py-1.5 rounded-xl liquid-glass-strong z-50"
              >
                <button
                  onClick={() => { setShowUserMenu(false); onOpenProfile(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
                >
                  <User size={15} />
                  Профиль
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); onOpenSettings(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
                >
                  <Settings size={15} />
                  Настройки
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); onOpenSettings(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
                >
                  <Shield size={15} />
                  Безопасность
                </button>
                <button
                  onClick={() => { setShowUserMenu(false); onOpenAccountManager(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors"
                >
                  <Globe size={15} />
                  Аккаунты
                </button>
                <div className="mx-3 my-1 h-px bg-white/[0.06]" />
                <button
                  onClick={() => { setShowUserMenu(false); onLogout(); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs text-red-400/70 hover:text-red-400 hover:bg-white/[0.06] transition-colors"
                >
                  <LogOut size={15} />
                  Выйти
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="relative" ref={searchRef}>
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            onFocus={() => setShowRecentSearches(true)}
            onBlur={() => {
              if (searchBlurTimerRef.current) clearTimeout(searchBlurTimerRef.current);
              searchBlurTimerRef.current = setTimeout(() => setShowRecentSearches(false), 200);
            }}
            onKeyDown={e => { if (e.key === 'Enter') handleSearchSubmit(searchQuery); }}
            placeholder="Поиск чатов, сообщений..."
            className="w-full h-10 pl-10 pr-10 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06] focus:ring-2 focus:ring-white/5 focus:translate-y-[-1px]"
          />
          {searchQuery && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={() => { onSearchChange(''); searchRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 transition-colors"
            >
              <X size={14} className="text-white/30" />
            </motion.button>
          )}

          <AnimatePresence>
            {showRecentSearches && recentSearches.length > 0 && !searchQuery && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 right-0 top-full mt-1 py-2 rounded-xl liquid-glass-strong z-50"
              >
                <div className="flex items-center justify-between px-3 mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-white/30 font-medium">
                    Недавние
                  </span>
                  <button
                    onClick={clearRecentSearches}
                    className="text-[10px] text-white/30 hover:text-white/50 transition-colors"
                  >
                    Очистить
                  </button>
                </div>
                {recentSearches.map((query, i) => (
                  <button
                    key={i}
                    onClick={() => { onSearchChange(query); setShowRecentSearches(false); }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/50 hover:text-white/80 hover:bg-white/[0.06] transition-colors"
                  >
                    <Clock size={12} className="text-white/20 flex-shrink-0" />
                    <span className="truncate">{query}</span>
                    <ArrowRight size={12} className="ml-auto text-white/20" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-shrink-0 flex items-center gap-1.5 px-3 pb-2">
        <ActionButton icon={Users} label="Друзья" onClick={onOpenFriends} />
        <ActionButton icon={UserPlus} label="Новый чат" onClick={onNewChat} />
        <ActionButton icon={Plus} label="Канал" onClick={onNewChannel} />
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <div className="flex flex-col gap-2 px-2 pt-2">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-11 h-11 rounded-xl skeleton-shimmer bg-white/[0.04]" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 rounded skeleton-shimmer bg-white/[0.04]" />
                  <div className="h-2.5 w-40 rounded skeleton-shimmer bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 px-4 text-center animate-fade-in">
            <MessageCircle size={28} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30">
              {searchQuery ? 'Ничего не найдено' : 'Нет чатов'}
            </p>
            <p className="text-xs text-white/20 mt-1">
              {searchQuery ? 'Попробуйте другой запрос' : 'Начните новый диалог'}
            </p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <AnimatePresence mode="popLayout">
              {chats.map((chat, index) => (
                <motion.div
                  key={chat.id}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -12, scale: 0.97 }}
                  transition={{ delay: index * 0.025, duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                >
                  <ChatListItem
                    chat={chat}
                    isSelected={chat.id === selectedChatId}
                    onSelect={() => onSelectChat(chat.id)}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      <div className="flex-shrink-0 px-3 py-2 border-t border-white/[0.06]">
        <motion.button
          onClick={onOpenProfile}
          className="w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-white/[0.03] transition-colors"
          whileTap={{ scale: 0.98 }}
        >
          <div className="relative">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={user.displayName}
                className="w-9 h-9 rounded-xl object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-white/[0.08] border border-white/[0.06] flex items-center justify-center">
                <User size={16} className="text-white/50" />
              </div>
            )}
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400/80 border-2 border-[#0a0a0f]" />
          </div>
          <div className="flex-1 text-left min-w-0">
            <p className="text-sm font-medium text-white/90 truncate">
              {user?.displayName || user?.username || ''}
            </p>
            <p className="text-[11px] text-white/40">Личный кабинет</p>
          </div>
          <MoreVertical size={15} className="text-white/30" />
        </motion.button>
      </div>
    </>
  );
}
