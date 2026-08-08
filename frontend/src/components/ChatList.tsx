import { useState, useRef, useEffect, useMemo } from 'react';
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
  Plus,
  X,
  Clock,
  ArrowRight,
  Pin,
  BellOff,
  Bell,
  Trash2,
  Edit3,
  SquarePen,
  PlusCircle,
  Sparkles,
  Camera,
} from 'lucide-react';
import type { Chat, User as UserType } from '../lib/types';
import { NOTES_CHAT_ID } from '../lib/api/noteChat';
import { AI_CHAT_ID } from '../lib/api/aiChat';
import { VerifiedBadge } from './VerifiedBadge';
import { AnimatedEmoji } from './AnimatedEmoji';
import { StoriesBar } from './StoriesBar';

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
  onOpenAccountManager: () => void;
  onOpenFeedback: () => void;
}

const CATEGORIES = [
  { id: 'all', label: 'Все' },
  { id: 'news', label: 'Новости', badge: 2 },
  { id: 'personal', label: 'Личные' },
  { id: 'groups', label: 'Группы' },
  { id: 'channels', label: 'Каналы' },
];

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
  if (chat.id === NOTES_CHAT_ID) {
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
        <Bookmark size={18} className="text-amber-400" />
      </div>
    );
  }
  if (chat.id === AI_CHAT_ID) {
    return (
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/25 to-fuchsia-500/25 border border-violet-500/25 flex items-center justify-center flex-shrink-0 shadow-[0_0_20px_rgba(139,92,246,0.25)]">
        <Sparkles size={18} className="text-violet-300" />
      </div>
    );
  }

  const initials = (chat.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const isOnline = chat.type === 'personal' && chat.otherMember?.isOnline;

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
  isPinned,
  isMuted,
  onSelect,
  onContextMenu,
}: {
  chat: Chat;
  isSelected: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
  onSelect: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const lastMsg = chat.lastMessage || chat.messages?.[chat.messages.length - 1] || null;
  const previewText = lastMsg?.content || '';
  const timeStr = formatLastMessageTime(lastMsg?.createdAt || chat.createdAt);
  const unread = chat.unreadCount || 0;

  return (
    <motion.button
      onClick={onSelect}
      onContextMenu={onContextMenu}
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
          <span className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-medium text-white/90 truncate">
              {chat.name || 'Без названия'}
            </span>
            {chat.isVerified && (
              <VerifiedBadge
                isVerified
                badgeUrl={chat.verifiedBadgeUrl}
                badgeType={chat.verifiedBadgeType}
                size={14}
              />
            )}
            {isMuted && <BellOff size={12} className="text-white/30 flex-shrink-0" />}
          </span>
          {timeStr && (
            <span className="text-[11px] text-white/30 flex-shrink-0 flex items-center gap-1">
              {isPinned && <Pin size={11} className="text-accent rotate-45" />}
              {timeStr}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-white/40 truncate">
            {previewText || (chat.type === 'personal' ? 'Личный чат' : chat.type === 'group' ? 'Группа' : chat.type === 'system' ? 'Поддержка' : 'Канал')}
          </span>
          {unread > 0 && (
            <span className="flex-shrink-0 min-w-[18px] h-[18px] rounded-full bg-accent flex items-center justify-center">
              <span className="text-[10px] font-bold text-white px-1">
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
  onOpenAccountManager,
  onOpenFeedback,
}: ChatListProps) {
  const [activeFolder, setActiveFolder] = useState('all');
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nexo_pinned_chats') || '[]'); } catch { return []; }
  });
  const [mutedIds, setMutedIds] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('nexo_muted_chats') || '[]'); } catch { return []; }
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);

  const togglePin = (chatId: string) => {
    setPinnedIds(prev => {
      const next = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
      localStorage.setItem('nexo_pinned_chats', JSON.stringify(next));
      return next;
    });
    setContextMenu(null);
  };

  const toggleMute = (chatId: string) => {
    setMutedIds(prev => {
      const next = prev.includes(chatId) ? prev.filter(id => id !== chatId) : [...prev, chatId];
      localStorage.setItem('nexo_muted_chats', JSON.stringify(next));
      return next;
    });
    setContextMenu(null);
  };

  // Filter chats by search and category folder
  const filteredChats = useMemo(() => {
    return chats.filter(chat => {
      if (activeFolder === 'news' && chat.type !== 'channel') return false;
      if (activeFolder === 'personal' && chat.type !== 'personal') return false;
      if (activeFolder === 'groups' && chat.type !== 'group') return false;
      if (activeFolder === 'channels' && chat.type !== 'channel') return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        chat.name?.toLowerCase().includes(q) ||
        chat.username?.toLowerCase().includes(q)
      );
    }).sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return 0;
    });
  }, [chats, searchQuery, activeFolder, pinnedIds]);

  // Mock Stories List for TG 2026 header experience
  const stories = [
    { id: 'me', name: 'Моя история', avatar: user?.avatar, isMe: true },
    { id: '1', name: 'АСТ-54', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100' },
    { id: '2', name: 'Лысый из...', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100' },
    { id: '3', name: 'Новосиб...', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#0a0a0f] border-r border-white/[0.06] relative">
      {/* ─── Top Header Bar (Screenshot 2 TG Style) ──────────────── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <button
          onClick={onOpenProfile}
          className="text-xs font-semibold text-accent hover:text-accent/80 transition-colors"
        >
          Изм.
        </button>
        <h1 className="text-base font-bold text-white/90 font-display tracking-tight">
          Чаты
        </h1>
        <div className="flex items-center gap-2">
          <motion.button
            onClick={onNewChat}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white transition-colors"
          >
            <SquarePen size={17} />
          </motion.button>
        </div>
      </div>

      {/* ─── Stories Horizontal Scroll (Screenshot 2) ──────────────── */}
      <div className="flex-shrink-0 px-3 py-2 border-b border-white/[0.04] overflow-x-auto no-scrollbar flex items-center gap-3">
        {stories.map(story => (
          <button
            key={story.id}
            onClick={onOpenProfile}
            className="flex flex-col items-center gap-1 min-w-[54px] group"
          >
            <div className={`relative w-12 h-12 rounded-full p-0.5 ${story.isMe ? 'bg-gradient-to-tr from-accent to-accent-dark' : 'bg-gradient-to-tr from-pink-500 via-purple-500 to-indigo-500'}`}>
              <img
                src={story.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100'}
                alt={story.name}
                className="w-full h-full rounded-full object-cover border-2 border-[#0a0a0f]"
              />
              {story.isMe && (
                <span className="absolute bottom-0 right-0 p-0.5 rounded-full bg-accent text-white border border-[#0a0a0f]">
                  <Plus size={10} strokeWidth={3} />
                </span>
              )}
            </div>
            <span className="text-[10px] text-white/50 group-hover:text-white/80 truncate w-14 text-center">
              {story.name}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Search Bar Pill Widget (Screenshot 2) ────────────────── */}
      <div className="flex-shrink-0 px-3 py-2">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Поиск чатов, сообщений..."
            className="w-full h-9 pl-9 pr-8 text-xs bg-white/[0.05] border border-white/[0.08] rounded-2xl text-white/80 placeholder:text-white/30 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.08]"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10"
            >
              <X size={13} className="text-white/40" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Folder Category Tabs (Screenshot 2) ──────────────────── */}
      <div className="flex-shrink-0 px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-white/[0.04]">
        {CATEGORIES.map(cat => {
          const isActive = activeFolder === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveFolder(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white/[0.12] text-white shadow-sm border border-white/[0.1]'
                  : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
              }`}
            >
              <span>{cat.label}</span>
              {cat.badge && (
                <span className="w-4 h-4 rounded-full bg-accent text-[9px] font-bold text-white flex items-center justify-center">
                  {cat.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Chats Stream ────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-0.5 pb-20">
        {loading ? (
          <div className="flex flex-col gap-2 p-2">
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
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center pt-12 px-4 text-center">
            <MessageCircle size={32} className="text-white/20 mb-2" />
            <p className="text-xs text-white/40">Чатов не найдено</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredChats.map((chat, index) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ChatListItem
                  chat={chat}
                  isSelected={chat.id === selectedChatId}
                  isPinned={pinnedIds.includes(chat.id)}
                  isMuted={mutedIds.includes(chat.id)}
                  onSelect={() => onSelectChat(chat.id)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, chatId: chat.id });
                  }}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Context Menu for Pin/Mute Chat */}
      <AnimatePresence>
        {contextMenu && (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              style={{ top: contextMenu.y, left: contextMenu.x }}
              className="absolute w-48 py-1 rounded-2xl liquid-glass-strong border border-white/[0.1] shadow-2xl z-50 text-xs"
            >
              <button
                onClick={() => togglePin(contextMenu.chatId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-white/80 hover:bg-white/[0.08] transition-colors"
              >
                <Pin size={14} className="text-accent" />
                {pinnedIds.includes(contextMenu.chatId) ? 'Открепить чат' : 'Закрепить чат'}
              </button>
              <button
                onClick={() => toggleMute(contextMenu.chatId)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-white/80 hover:bg-white/[0.08] transition-colors"
              >
                {mutedIds.includes(contextMenu.chatId) ? <Bell size={14} /> : <BellOff size={14} />}
                {mutedIds.includes(contextMenu.chatId) ? 'Включить звук' : 'Беззвучный режим'}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
