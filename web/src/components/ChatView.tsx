import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Phone,
  MoreVertical,
  Search,
  X,
  ArrowDown,
  Trash2,
  UserPlus,
  UserMinus,
  Bell,
  BellOff,
  Settings,
  Eraser,
  Pin,
  Forward,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  BarChart3,
  Lock,
  Sparkles,
} from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { isChatMuted, toggleMuteChat } from '../lib/sounds';
import { useLang } from '../lib/i18n';
import { formatLastSeen } from '../lib/utils';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { useSettingsStore } from '../stores/settingsStore';
import type { UserBasic, Message } from '../lib/types';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import TypingIndicator from './TypingIndicator';
import UserProfile from './UserProfile';
import GroupSettings from './GroupSettings';
import ForwardModal from './ForwardModal';
import ConfirmModal from './ConfirmModal';
import Avatar from './Avatar';
import ChannelProfile from './ChannelProfile';
import ChannelStudio from './ChannelStudio';
import ThreadView from './ThreadView';
import BackgroundPickerModal from './BackgroundPickerModal';
import MediaSearchModal from './MediaSearchModal';
import ChatSummaryModal from './ChatSummaryModal';
import HiddenChatModal from './HiddenChatModal';
import { useNavigationStore } from '../stores/navigationStore';

import { useThemeStore } from '../stores/themeStore';

export default function ChatView({ onStartCall, onStartGroupCall }: { onStartCall?: (targetUser: UserBasic, type: 'voice' | 'video') => void; onStartGroupCall?: (chatId: string, chatName: string, type: 'voice' | 'video') => void }) {
  const { user } = useAuthStore();
  const { t, lang } = useLang();
  const { getChatBackground: getSettingsChatBackground } = useSettingsStore();
  const {
    activeChat,
    chats,
    messages,
    typingUsers,
    pinnedMessages,
    isLoadingMessages,
    setActiveChat,
  } = useChatStore();

  const [showTopMenu, setShowTopMenu] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [muted, setMuted] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [showDeleteMenu, setShowDeleteMenu] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ message: string; action: () => void } | null>(null);
  const [scrollReady, setScrollReady] = useState(false);
  const [activeGroupCallParticipants, setActiveGroupCallParticipants] = useState<string[]>([]);
  const [isChannelSubscribed, setIsChannelSubscribed] = useState(true);

  const [showChatSummary, setShowChatSummary] = useState(false);
  const [showHiddenChatModal, setShowHiddenChatModal] = useState(false);
  const [hiddenChatMode, setHiddenChatMode] = useState<'create' | 'unlock'>('create');
  const [showChannelStudio, setShowChannelStudio] = useState(false);
  const [showChannelProfile, setShowChannelProfile] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showMediaSearch, setShowMediaSearch] = useState(false);
  const [inputCollapsed, setInputCollapsed] = useState(false);
  const inputDragStartY = useRef(0);

  const openSidebarProfile = useNavigationStore(s => s.openSidebarProfile);

  const handleOpenProfile = useCallback((userId: string) => {
    if (window.innerWidth >= 768) {
      openSidebarProfile(userId);
    } else {
      setProfileUserId(userId);
    }
  }, [openSidebarProfile]);

  // Listen for channel profile open events from MessageBubble
  useEffect(() => {
    const handleOpenChannelProfile = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.channelId) {
        setActiveChat(customEvent.detail.channelId);
        setShowChannelProfile(true);
      }
    };
    
    const handleOpenChannelStudio = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.channelId) {
        setActiveChat(customEvent.detail.channelId);
        setShowChannelStudio(true);
      }
    };
    
    window.addEventListener('open-channel-profile', handleOpenChannelProfile);
    window.addEventListener('open-channel-studio', handleOpenChannelStudio);

    // Listen for thread creation
    const handleCreateThread = async (e: Event) => {
      const customEvent = e as CustomEvent;
      const { messageId, chatId } = customEvent.detail || {};
      if (!messageId || !chatId) return;

      try {
        const thread = await api.createThread(chatId, messageId);
        if (thread?.id) {
          setActiveThreadId(thread.id);
        }
      } catch (err) {
        console.error('Failed to create thread:', err);
      }
    };

    window.addEventListener('create-thread', handleCreateThread);

    return () => {
      window.removeEventListener('open-channel-profile', handleOpenChannelProfile);
      window.removeEventListener('open-channel-studio', handleOpenChannelStudio);
      window.removeEventListener('create-thread', handleCreateThread);
    };
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const topMenuRef = useRef<HTMLDivElement>(null);
  const deleteMenuRef = useRef<HTMLDivElement>(null);

  const chatViewRef = useRef<HTMLDivElement>(null);

  const chat = chats.find((c) => c.id === activeChat);
  const chatMessages = activeChat ? messages[activeChat] || [] : [];
  const pinnedMsg = activeChat ? pinnedMessages[activeChat] : null;

  // Количество непрочитанных сообщений (для бейджика)
  const unreadCount = chatMessages.filter(
    (m) => m.senderId !== user?.id && !m.readBy?.some((r) => r.userId === user?.id)
  ).length;

  const otherMember = chat?.members.find((m) => m.user.id !== user?.id);
  const isFavorites = chat?.type === 'favorites';
  const chatName = isFavorites
    ? t('favorites')
    : chat?.type === 'personal'
      ? otherMember?.user.displayName || otherMember?.user.username || t('chat')
      : chat?.name || t('group');
  const chatAvatar = isFavorites
    ? null
    : chat?.type === 'personal'
      ? otherMember?.user.avatar
      : chat?.avatar;
  const isOnline = chat?.type === 'personal' && otherMember?.user.isOnline;

  // Get custom background for this chat
  const chatBackgroundObj = activeChat ? getSettingsChatBackground(activeChat) : null;
  const chatBackgroundRaw = chatBackgroundObj?.backgroundUrl || null;
  
  // Convert preset backgrounds to CSS
  const PRESET_BG_MAP: Record<string, string> = {
    'preset-default': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    'preset-blue':    'linear-gradient(135deg, #1e3a5f 0%, #0f2040 100%)',
    'preset-purple':  'linear-gradient(135deg, #3b1f5e 0%, #1e0f40 100%)',
    'preset-green':   'linear-gradient(135deg, #1a3d2b 0%, #0f2018 100%)',
    'preset-pink':    'linear-gradient(135deg, #5e1f3b 0%, #400f20 100%)',
    'preset-orange':  'linear-gradient(135deg, #5e3b1f 0%, #402010 100%)',
    'preset-teal':    'linear-gradient(135deg, #0f3d3d 0%, #0a2020 100%)',
    'preset-night':   'linear-gradient(135deg, #0a0a1a 0%, #050510 100%)',
    'preset-aurora':  'linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0d2b1b 100%)',
    'preset-cosmos':  'linear-gradient(135deg, #0a0015 0%, #150030 50%, #000a20 100%)',
    'preset-forest':  'linear-gradient(135deg, #0d2b0d 0%, #1a3d1a 100%)',
    'preset-ocean':   'linear-gradient(135deg, #001a33 0%, #003366 100%)',
  };
  
  const chatBackground = chatBackgroundRaw
    ? (PRESET_BG_MAP[chatBackgroundRaw] || chatBackgroundRaw)
    : null; // Прозрачный фон по умолчанию
  
  const isGradientBg = chatBackground && (chatBackground.startsWith('linear-gradient') || chatBackground.startsWith('radial-gradient'));
  const isImageBg = chatBackground && !isGradientBg;

  const typingInChat = typingUsers.filter((t) => t.chatId === activeChat && t.userId !== user?.id);
  const isChannel = chat?.type === 'channel';
  const showTypingIndicator = typingInChat.length > 0 && !isChannel;

  // Load muted state and background
  useEffect(() => {
    if (activeChat) {
      setMuted(isChatMuted(activeChat));
      setScrollReady(false);
      setActiveGroupCallParticipants([]);
      // Load chat background
      useSettingsStore.getState().loadChatBackground(activeChat);
    }
  }, [activeChat]);


  // Listen for active group calls
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handler = (data: { chatId: string; participants: string[] }) => {
      if (data.chatId === activeChat) {
        setActiveGroupCallParticipants(data.participants.filter(p => p !== user?.id));
      }
    };
    socket.on('group_call_active', handler);
    // Request current status when opening a group chat
    if (activeChat && chat?.type === 'group') {
      socket.emit('group_call_status', { chatId: activeChat });
    }
    return () => { socket.off('group_call_active', handler); };
  }, [activeChat, user?.id, chat?.type]);

  // Track message views in channels
  useEffect(() => {
    if (!activeChat || !chat || chat.type !== 'channel') return;
    
    // Mark messages as viewed when they're visible
    const trackViews = async () => {
      const messageElements = document.querySelectorAll('[id^="msg-"]');
      const viewportHeight = window.innerHeight;
      
      for (const msgEl of Array.from(messageElements)) {
        const rect = msgEl.getBoundingClientRect();
        const messageId = msgEl.id.replace('msg-', '');
        
        // If message is visible in viewport
        if (rect.top >= 0 && rect.bottom <= viewportHeight) {
          try {
            await api.markPostViewed(messageId);
          } catch (e) {
            // Ignore errors
          }
        }
      }
    };
    
    // Track views after messages load
    const timer = setTimeout(trackViews, 1000);
    
    // Also track on scroll
    const handleScroll = () => {
      clearTimeout(timer);
      setTimeout(trackViews, 500);
    };
    
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
    }
    
    return () => {
      clearTimeout(timer);
      if (container) {
        container.removeEventListener('scroll', handleScroll);
      }
    };
  }, [activeChat, chat?.type, messages]);

  // Close top menu on click outside
  useEffect(() => {
    if (!showTopMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (topMenuRef.current && !topMenuRef.current.contains(e.target as Node)) {
        setShowTopMenu(false);
      }
    };
    // Use setTimeout to avoid the same click that opened the menu from closing it
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showTopMenu]);

  // Close delete menu on click outside
  useEffect(() => {
    if (!showDeleteMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (deleteMenuRef.current && !deleteMenuRef.current.contains(e.target as Node)) {
        setShowDeleteMenu(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
    };
  }, [showDeleteMenu]);



  // Прокрутка вниз
  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant', block: 'end' });
  }, []);

  // Первичная прокрутка при открытии чата или после загрузки (layout effect — до отрисовки)
  useLayoutEffect(() => {
    if (!isLoadingMessages && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
      setScrollReady(true);
    }
  }, [activeChat, isLoadingMessages]);

  // Scroll on new message arrivals
  useEffect(() => {
    if (chatMessages.length > 0) {
      const lastMsg = chatMessages[chatMessages.length - 1];
      if (lastMsg.senderId === user?.id) {
        setTimeout(() => scrollToBottom(true), 50);
      } else {
        // Если пользователь внизу — прокрутить
        const container = messagesContainerRef.current;
        if (container) {
          const isNearBottom =
            container.scrollHeight - container.scrollTop - container.clientHeight < 250;
          if (isNearBottom) setTimeout(() => scrollToBottom(true), 50);
        }
      }
    }
  }, [chatMessages.length, user?.id, scrollToBottom]);

  // Read receipts — debounced via ref to avoid excessive emits
  const sentReadIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!activeChat || !user?.id) return;
    // Reset tracked IDs when switching chats
    sentReadIdsRef.current.clear();
  }, [activeChat, user?.id]);

  useEffect(() => {
    if (!activeChat || !user?.id) return;
    const unread = chatMessages.filter(
      (m) => m.senderId !== user.id && !m.readBy?.some((r) => r.userId === user.id) && !sentReadIdsRef.current.has(m.id)
    );
    if (unread.length > 0) {
      const ids = unread.map((m) => m.id);
      ids.forEach((id) => sentReadIdsRef.current.add(id));
      const socket = getSocket();
      if (socket) {
        socket.emit('read_messages', {
          chatId: activeChat,
          messageIds: ids,
        });
      }
      // Update local store immediately for current user
      useChatStore.getState().markRead(activeChat, user.id, ids);
    }
  }, [chatMessages.length, activeChat, user?.id]);

  // Scroll detection
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    setShowScrollDown(!isNearBottom);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!chatViewRef.current) return;
    const { left, top } = chatViewRef.current.getBoundingClientRect();
    chatViewRef.current.style.setProperty('--mouse-x', `${e.clientX - left}px`);
    chatViewRef.current.style.setProperty('--mouse-y', `${e.clientY - top}px`);
  };

  // Поиск сообщений на сервере
  useEffect(() => {
    if (!searchText.trim() || !activeChat) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await api.searchMessages(searchText, activeChat);
        setSearchResults(results);
      } catch (err) {
        console.error('Search error:', err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [searchText, activeChat]);

  const openSearch = () => {
    setShowSearch(true);
    setShowTopMenu(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  if (!activeChat || !chat) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-surface-secondary relative z-0">
        {/* Slowly pulsing purple background */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden transition-opacity duration-[10000ms]">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vw] h-[60vw] max-w-[800px] max-h-[800px] bg-nexo-600/10 rounded-full blur-[120px] animate-[pulse_8s_ease-in-out_infinite]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] max-w-[500px] max-h-[500px] bg-purple-600/15 rounded-full blur-[100px] animate-[pulse_12s_ease-in-out_infinite_reverse]" />
        </div>

        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMSkvPjwvc3ZnPg==')] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)] opacity-20 pointer-events-none" />

        <div className="text-center relative z-10 w-full max-w-sm px-6 flex flex-col items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="w-32 h-32 mx-auto mb-8 rounded-[2rem] relative select-none"
          >
            <img src="/logo.png" alt="Нексо" className="w-32 h-32 rounded-[2rem] object-cover transform hover:scale-105 transition-transform select-none pointer-events-none" draggable={false} />
          </motion.div>
          <motion.h2
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-nexo-400 via-fuchsia-400 to-indigo-400 mb-4 drop-shadow-lg tracking-tight select-none"
          >
            Нексо
          </motion.h2>
          <motion.p
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="text-sm font-medium text-zinc-300 bg-white/5 backdrop-blur-lg py-2.5 px-6 rounded-full inline-flex border border-white/10 shadow-lg select-none"
          >
            {t('selectChat')}
          </motion.p>
        </div>
      </div>
    );
  }

  const initials = chatName
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleToggleSelect = (msgId: string) => {
    const newMap = new Set(selectedMessages);
    if (newMap.has(msgId)) {
      newMap.delete(msgId);
      if (newMap.size === 0) setSelectionMode(false);
    } else {
      newMap.add(msgId);
    }
    setSelectedMessages(newMap);
  };

  const handleStartSelection = (msgId: string) => {
    setSelectionMode(true);
    setSelectedMessages(new Set([msgId]));
  };

  const handleForward = (targetChatId: string) => {
    const socket = getSocket();
    if (!socket || !activeChat) return;

    const messagesToForward = Array.from(selectedMessages)
      .map(id => chatMessages.find(m => m.id === id))
      .filter(Boolean)
      .sort((a, b) => new Date(a!.createdAt).getTime() - new Date(b!.createdAt).getTime());

    messagesToForward.forEach(msg => {
      socket.emit('send_message', {
        chatId: targetChatId,
        content: msg?.content,
        type: msg?.type,
        forwardedFromId: msg?.sender.id,
        mediaUrl: msg?.media?.[0]?.url,
        mediaType: msg?.media?.[0]?.type,
        fileName: msg?.media?.[0]?.filename,
        fileSize: msg?.media?.[0]?.size ?? undefined,
      });
    });

    setSelectionMode(false);
    setSelectedMessages(new Set());
    setShowForwardModal(false);
    setActiveChat(targetChatId);
  };

  const handleBulkDelete = (deleteForAll: boolean) => {
    const socket = getSocket();
    if (!socket || !activeChat) return;

    const ids = Array.from(selectedMessages);
    socket.emit('delete_messages', {
      messageIds: ids,
      chatId: activeChat,
      deleteForAll,
    });

    // Optimistic local removal
    if (!deleteForAll) {
      useChatStore.getState().hideMessages(ids, activeChat);
    }

    setSelectionMode(false);
    setSelectedMessages(new Set());
    setShowDeleteMenu(false);
  };

  return (
    <div
      ref={chatViewRef}
      onMouseMove={handleMouseMove}
      className={`flex flex-col h-full w-full overflow-hidden transition-colors duration-500 ${
        isImageBg ? 'bg-cover bg-center' : ''
      }`}
      style={
        isImageBg
          ? { backgroundImage: `url(${chatBackground})` }
          : chatBackground
            ? { background: chatBackground }
            : {}
      }
    >
      {/* Шапка чата */}
      {selectionMode ? (
        <div className="h-[60px] sm:h-[76px] flex items-center justify-between px-4 sm:px-6 border-b border-white/[0.06] glass-strong z-20 flex-shrink-0">
          <div className="flex items-center gap-4 text-white">
            <button onClick={() => { setSelectionMode(false); setSelectedMessages(new Set()); }} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition">
              <X size={20} className="text-zinc-300" />
            </button>
            <span className="font-medium text-[15px]">{selectedMessages.size} {t('selected') || 'выбрано'}</span>
          </div>
          <div className="flex items-center gap-3">
            {/* Кнопка удаления с выпадающим меню */}
            <div className="relative" ref={deleteMenuRef}>
              <button
                disabled={selectedMessages.size === 0}
                onClick={() => setShowDeleteMenu(!showDeleteMenu)}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/90 text-white font-medium rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                <Trash2 size={18} />
                {t('delete')}
              </button>
              <AnimatePresence>
                {showDeleteMenu && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: -5 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: -5 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#09090b]/95 backdrop-blur-2xl shadow-2xl z-50 py-1.5 ring-1 ring-border/50 overflow-hidden"
                  >
                    <button
                      onClick={() => handleBulkDelete(false)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                    >
                      <Trash2 size={16} className="text-zinc-400" />
                      {t('deleteForMe')}
                    </button>
                    <div className="border-t border-border/30 mx-3" />
                    <button
                      onClick={() => handleBulkDelete(true)}
                      className="flex items-center gap-3 w-full px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                    >
                      <Trash2 size={16} className="text-red-400" />
                      {t('deleteForAll')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              disabled={selectedMessages.size === 0}
              onClick={() => setShowForwardModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-black font-medium rounded-xl hover:bg-zinc-200 transition-colors disabled:opacity-50"
            >
              <Forward size={18} />
              {t('forward')}
            </button>
          </div>
        </div>
      ) : (
        <div className="h-[60px] sm:h-[76px] flex items-center justify-between px-2 sm:px-4 z-20 flex-shrink-0 relative">
          {/* Кнопка назад */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setActiveChat(null)}
            aria-label="Назад"
            className="relative z-10 w-[44px] h-[44px] rounded-2xl flex items-center justify-center transition-all hover:scale-105 active:scale-95 shrink-0"
            style={{
              background: 'rgba(30, 30, 30, 0.6)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            }}
          >
            <ChevronLeft size={20} className="text-white" />
          </motion.button>

          {/* Центральная плашка — Имя + Статус + Кнопки */}
          <div
            className="absolute left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 pl-5 pr-1 py-1 rounded-full transition-all min-w-[200px] max-w-[340px]"
            style={{
              background: 'rgba(30, 30, 30, 0.6)',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
            }}
          >
            <button
              onClick={() => {
                if (chat.type === 'channel') {
                  setShowChannelProfile(true);
                } else if (chat.type === 'personal' && otherMember) {
                   handleOpenProfile(otherMember.user.id);
                } else if (chat.type === 'group') {
                  setShowGroupSettings(true);
                }
              }}
              className="flex flex-col items-start min-w-0 flex-1 py-1.5"
            >
              <span className="font-bold text-[14px] sm:text-[15px] text-white truncate leading-tight w-full" style={{ letterSpacing: '0.3px' }}>
                {chatName}
              </span>
              <span className="text-[10px] sm:text-[11px] leading-tight mt-0.5 w-full truncate" style={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                {isFavorites
                  ? t('favoritesDescription')
                  : showTypingIndicator
                    ? <span className="text-accent font-medium">{t('typing')}</span>
                    : isOnline
                      ? <span className="text-emerald-400">{t('online')}</span>
                      : chat.type === 'personal' && otherMember?.user.lastSeen
                        ? `${t('lastSeenAt')} ${formatLastSeen(otherMember.user.lastSeen, lang)}`
                        : chat.type === 'group'
                          ? `${chat.members.length} ${t('members')}`
                          : chat.type === 'channel'
                            ? `${chat.members.length} ${t('subscribers')}`
                            : ''}
              </span>
            </button>

            {/* Кнопки поиска и меню внутри плашки */}
            <div className="flex items-center gap-0.5 shrink-0">
              <AnimatePresence>
                {showSearch && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 160, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <input
                      ref={searchInputRef}
                      type="text"
                      placeholder={t('searchMessages')}
                      value={searchText}
                      onChange={(e) => setSearchText(e.target.value)}
                      className="w-full px-2.5 py-1 rounded-lg bg-white/5 text-xs text-white placeholder-zinc-500 border border-white/10 focus:border-nexo-500/50"
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (showSearch) { setShowSearch(false); setSearchText(''); } else { openSearch(); }
                }}
                className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-zinc-400 hover:text-white shrink-0"
              >
                {showSearch ? <X size={16} /> : <Search size={16} />}
              </button>

              <div className="relative" ref={topMenuRef}>
                <button
                  onClick={() => setShowTopMenu(!showTopMenu)}
                  className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors text-zinc-400 hover:text-white shrink-0"
                >
                  <MoreVertical size={16} />
                </button>
                <AnimatePresence>
                  {showTopMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -5 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-full mt-2 w-56 rounded-2xl glass-strong shadow-2xl z-[100] py-1.5 ring-1 ring-border/50 backdrop-blur-2xl"
                    >
                      <button
                        onClick={() => { openSearch(); setShowTopMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                      >
                        <Search size={16} />
                        {t('searchMessages')}
                      </button>
                      {!isFavorites && chat.type !== 'channel' && (
                        <button
                          onClick={async () => {
                            setShowTopMenu(false);
                            if (chat.type === 'personal' && otherMember) {
                              try {
                                const friendStatus = await api.getFriendshipStatus(otherMember.user.id);
                                if (friendStatus.status !== 'accepted') { alert('Вы можете звонить только друзьям.'); return; }
                                onStartCall?.(otherMember.user, 'voice');
                              } catch (e) { console.error(e); alert('Не удалось проверить статус дружбы'); }
                            } else if (chat.type === 'group') { onStartGroupCall?.(chat.id, chat.name || 'Group', 'voice'); }
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                        >
                          <Phone size={16} className="text-emerald-400" />
                          Позвонить
                        </button>
                      )}
                      {chat.type === 'personal' && otherMember && (
                        <button
                          onClick={() => { setShowTopMenu(false); setProfileUserId(otherMember.user.id); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                        >
                          <UserPlus size={16} />
                          {t('userProfile')}
                        </button>
                      )}
                      <button
                        onClick={() => { if (activeChat) { const nowMuted = toggleMuteChat(activeChat); setMuted(nowMuted); } }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                      >
                        {muted ? <Bell size={16} /> : <BellOff size={16} />}
                        {muted ? t('enableSound') : t('disableSound')}
                      </button>
                      <button
                        onClick={() => { setShowTopMenu(false); setShowBackgroundPicker(true); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                        Фон чата
                      </button>
                      <button
                        onClick={() => { setShowTopMenu(false); setShowMediaSearch(true); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                      >
                        <Search size={16} />
                        Поиск по медиа
                      </button>
                      {chat.type === 'group' && (
                        <button
                          onClick={() => { setShowTopMenu(false); setShowGroupSettings(true); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                        >
                          <Settings size={16} />
                          {t('groupSettings')}
                        </button>
                      )}
                      {chat.type === 'channel' && chat.members.some(m => m.user.id === user?.id && m.role === 'admin') && (
                        <button
                          onClick={() => { setShowTopMenu(false); setShowChannelStudio(true); }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                        >
                          <BarChart3 size={16} className="text-nexo-400" />
                          Студия канала
                        </button>
                      )}
                      {chat.type === 'channel' && (
                        <button
                          onClick={() => {
                            setShowTopMenu(false);
                            const shareUrl = `${window.location.origin}/channel/${chat.username}`;
                            navigator.clipboard.writeText(shareUrl);
                            alert('Ссылка скопирована в буфер обмена!');
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                            <polyline points="16 6 12 2 8 6"/>
                            <line x1="12" y1="2" x2="12" y2="15"/>
                          </svg>
                          Поделиться каналом
                        </button>
                      )}
                      {chat.type === 'channel' && chat.members.some(m => m.user.id === user?.id && m.role === 'admin') && (
                        <button
                          onClick={async () => {
                            setShowTopMenu(false);
                            if (!confirm('Вы уверены?')) return;
                            try { await api.deleteChat(activeChat); useChatStore.getState().removeChat(activeChat); } catch (e) { console.error(e); }
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <Trash2 size={16} />
                          Удалить канал
                        </button>
                      )}
                      {chat.type === 'channel' && !chat.members.some(m => m.user.id === user?.id && m.role === 'admin') && (
                        <button
                          onClick={async () => {
                            setShowTopMenu(false);
                            try { await api.deleteChat(activeChat); useChatStore.getState().removeChat(activeChat); } catch (e) { console.error(e); }
                          }}
                          className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                        >
                          <UserMinus size={16} />
                          {t('leaveChannel')}
                        </button>
                      )}
                      {chat.type !== 'channel' && chat.type !== 'favorites' && (
                        <>
                          <div className="border-t border-border my-1" />
                          <button
                            onClick={() => {
                              setShowTopMenu(false);
                              if (activeChat) setConfirmAction({ message: t('clearChatConfirm'), action: async () => { try { await api.clearChat(activeChat); useChatStore.getState().clearMessages(activeChat); } catch (e) { console.error(e); } } });
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                          >
                            <Eraser size={16} />
                            {t('clearChat')}
                          </button>
                          <button
                            onClick={() => {
                              setShowTopMenu(false);
                              if (activeChat) setConfirmAction({ message: t('deleteChatConfirm'), action: async () => { try { await api.deleteChat(activeChat); useChatStore.getState().removeChat(activeChat); } catch (e) { console.error(e); } } });
                            }}
                            className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                          >
                            <Trash2 size={16} />
                            {t('deleteChat')}
                          </button>
                        </>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Аватарка */}
          <div className="relative z-10 shrink-0">
            <button
              onClick={() => {
                if (chat.type === 'channel') {
                  setShowChannelProfile(true);
                } else if (chat.type === 'personal' && otherMember) {
                   handleOpenProfile(otherMember.user.id);
                } else if (chat.type === 'group') {
                  setShowGroupSettings(true);
                }
              }}
              className="w-[44px] h-[44px] rounded-full overflow-hidden flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'rgba(30, 30, 30, 0.6)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
              }}
            >
              {isFavorites ? (
                <div className="w-full h-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
                  <Bookmark size={18} className="text-white" />
                </div>
              ) : (
                <Avatar
                  src={chatAvatar}
                  name={chatName}
                  size="sm"
                  online={isOnline ? true : undefined}
                  className="rounded-full w-full h-full"
                  isVerified={chat.isVerified}
                  verifiedBadgeUrl={chat.verifiedBadgeUrl}
                  verifiedBadgeType={chat.verifiedBadgeType}
                />
              )}
            </button>
          </div>


        </div>
      )}

      {/* Результаты поиска */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="absolute top-[60px] sm:top-[76px] left-0 right-0 z-20 max-h-[300px] overflow-y-auto bg-[#09090b]/95 backdrop-blur-xl border-b border-border"
          >
            {isSearching ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-zinc-400">Поиск...</p>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <p className="text-sm text-zinc-400">
                  {searchText.trim() ? 'Ничего не найдено' : 'Введите текст для поиска'}
                </p>
              </div>
            ) : (
              searchResults.map((msg, idx) => (
                <div
                  key={msg.id}
                  className="px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0"
                  onClick={() => {
                    // Scroll to message
                    const el = document.getElementById(`msg-${msg.id}`);
                    if (el) {
                      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      el.classList.add('bg-nexo-500/20');
                      setTimeout(() => el.classList.remove('bg-nexo-500/20'), 2000);
                    }
                    setShowSearch(false);
                    setSearchText('');
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-nexo-400">
                      {msg.sender?.displayName || msg.sender?.username}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {new Date(msg.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">
                    {msg.content}
                  </p>
                  {idx < searchResults.length - 1 && (
                    <div className="mt-2 h-px bg-white/5" />
                  )}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Закреплённое сообщение */}
      {/* Active group call banner */}
      {chat?.type === 'group' && activeGroupCallParticipants.length > 0 && (
        <button
          onClick={() => onStartGroupCall?.(chat.id, chat.name || 'Group', 'voice')}
          className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors text-left w-full flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Phone size={14} className="text-emerald-400" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-emerald-400">{t('activeCall')}</p>
            <p className="text-sm text-zinc-300">{activeGroupCallParticipants.length} {t('participants')}</p>
          </div>
          <span className="text-xs text-emerald-400 font-medium px-3 py-1 rounded-full bg-emerald-500/20">{t('joinCall')}</span>
        </button>
      )}

      {pinnedMsg && (
        <button
          onClick={() => {
            const el = document.getElementById(`msg-${pinnedMsg.id}`);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              el.classList.add('bg-nexo-500/20');
              setTimeout(() => el.classList.remove('bg-nexo-500/20'), 2000);
            }
          }}
          className="flex items-center gap-3 px-4 py-2 border-b border-border bg-[#09090b]/60 hover:bg-surface-hover transition-colors text-left w-full flex-shrink-0"
        >
          <Pin size={16} className="text-nexo-400 flex-shrink-0 rotate-45" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-nexo-400">{t('pinnedMessage')}</p>
            <p className="text-sm text-zinc-300 truncate">
              {pinnedMsg.content || (pinnedMsg.media?.length > 0 ? t('media') : '...')}
            </p>
          </div>
          <X
            size={16}
            className="text-zinc-500 hover:text-white flex-shrink-0 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              const socket = getSocket();
              if (socket && activeChat) {
                socket.emit('unpin_message', { messageId: pinnedMsg.id, chatId: activeChat });
              }
            }}
          />
        </button>
      )}

      {/* Сообщения */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        data-messages-container
        className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-2 relative z-0 min-h-0"
        style={chatBackground ? {
          backgroundImage: `url(${chatBackground})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed'
        } : undefined}
      >
        {isLoadingMessages ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : chatMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-zinc-500">{t('noMessages')}</p>
          </div>
        ) : (
          <div className="space-y-1 max-w-3xl mx-auto">
            {chatMessages.map((msg, i) => {
              const prevMsg = i > 0 ? chatMessages[i - 1] : null;
              const showAvatar = !prevMsg || prevMsg.senderId !== msg.senderId;
              const showDate =
                !prevMsg ||
                new Date(msg.createdAt).toDateString() !== new Date(prevMsg.createdAt).toDateString();

              // Format date separator
              const formatDateSeparator = (date: Date) => {
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);

                if (date.toDateString() === today.toDateString()) {
                  return t('today');
                }
                if (date.toDateString() === yesterday.toDateString()) {
                  return t('yesterday');
                }

                return date.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                  day: 'numeric',
                  month: 'long',
                });
              };

              return (
                <div key={msg.id} id={`msg-${msg.id}`} className="transition-colors duration-500">
                  {showDate && (
                    <div className="flex justify-center my-4 select-none sticky top-0 z-10">
                      <span className="px-3 py-1 rounded-full text-xs text-zinc-400 bg-surface-secondary/80 backdrop-blur-sm shadow-sm select-none">
                        {formatDateSeparator(new Date(msg.createdAt))}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={msg}
                    isMine={msg.senderId === user?.id}
                    showAvatar={showAvatar}
                    onViewProfile={(userId) => handleOpenProfile(userId)}
                    selectionMode={selectionMode}
                    isSelected={selectedMessages.has(msg.id)}
                    onToggleSelect={handleToggleSelect}
                    onStartSelectionMode={handleStartSelection}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} className="h-4" /> {/* Empty spacer for the bottom scroll boundary */}
          </div>
        )}
      </div>

      {/* Кнопка прокрутки вниз */}
      <AnimatePresence>
        {showScrollDown && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-6 w-11 h-11 rounded-full bg-surface-tertiary/90 backdrop-blur-md border border-border shadow-2xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-surface-hover hover:scale-105 transition-all z-10"
          >
            <ArrowDown size={20} />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1.5 rounded-full bg-accent text-white text-[11px] font-bold flex items-center justify-center shadow-lg border-2 border-surface-secondary"
              >
                {unreadCount > 99 ? '99+' : unreadCount}
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Typing индикатор - только не в каналах */}
      {showTypingIndicator && (
        <div className="px-4 pb-1 flex-shrink-0">
          <TypingIndicator />
        </div>
      )}

      {/* Ввод сообщения - только для тех кто может писать */}
      {(!chat || chat.type !== 'channel' || chat.members.some(m => m.user.id === user?.id && m.role === 'admin')) && (
        <div
          className="flex-shrink-0 relative"
          onTouchStart={(e) => { inputDragStartY.current = e.touches[0].clientY; }}
          onTouchEnd={(e) => {
            const delta = e.changedTouches[0].clientY - inputDragStartY.current;
            if (delta > 60) setInputCollapsed(true);
            else if (delta < -60) setInputCollapsed(false);
          }}
        >
          <AnimatePresence>
            {inputCollapsed && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                onClick={() => setInputCollapsed(false)}
                className="px-6 py-2 flex items-center justify-center cursor-pointer"
              >
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-zinc-400 text-xs hover:bg-white/10 transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7"/></svg>
                  Написать сообщение
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            animate={{ height: inputCollapsed ? 0 : 'auto', opacity: inputCollapsed ? 0 : 1 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: inputCollapsed ? 'hidden' : 'visible' }}
          >
            <MessageInput chatId={activeChat} />
          </motion.div>
        </div>
      )}

      {/* Профиль пользователя */}
      <AnimatePresence>
        {profileUserId && (
          <UserProfile
            userId={profileUserId}
            chatId={activeChat || undefined}
            onClose={() => setProfileUserId(null)}
            isSelf={profileUserId === user?.id}
          />
        )}
      </AnimatePresence>

      {/* Настройки группы */}
      <AnimatePresence>
        {showGroupSettings && chat && chat.type === 'group' && (
          <GroupSettings
            chat={chat}
            onClose={() => setShowGroupSettings(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForwardModal && activeChat && (
          <ForwardModal
            messages={Array.from(selectedMessages)
              .map((id) => messages[activeChat]?.find((m: Message) => m.id === id))
              .filter((m): m is Message => m !== undefined)}
            onClose={() => setShowForwardModal(false)}
          />
        )}
      </AnimatePresence>

      <ConfirmModal
        open={!!confirmAction}
        message={confirmAction?.message || ''}
        onConfirm={() => {
          confirmAction?.action();
          setConfirmAction(null);
        }}
        onCancel={() => setConfirmAction(null)}
      />

      <AnimatePresence>
        {showChannelProfile && (
          <ChannelProfile
            channelId={activeChat!}
            onClose={() => setShowChannelProfile(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showChannelStudio && (
          <ChannelStudio
            channelId={activeChat!}
            onClose={() => setShowChannelStudio(false)}
          />
        )}
      </AnimatePresence>

      {/* Thread View */}
      <AnimatePresence>
        {activeThreadId && (
          <ThreadView
            threadId={activeThreadId}
            chatId={activeChat!}
            onClose={() => setActiveThreadId(null)}
          />
        )}
      </AnimatePresence>

      {/* Background Picker Modal */}
      <BackgroundPickerModal
        isOpen={showBackgroundPicker}
        onClose={() => setShowBackgroundPicker(false)}
        chatId={activeChat || ''}
      />

      {/* Media Search Modal */}
      <AnimatePresence>
        {showMediaSearch && activeChat && (
          <MediaSearchModal
            chatId={activeChat}
            onClose={() => setShowMediaSearch(false)}
          />
        )}
      </AnimatePresence>

      {/* Chat Summary Modal */}
      <AnimatePresence>
        {showChatSummary && activeChat && chat && (
          <ChatSummaryModal
            isOpen={showChatSummary}
            onClose={() => setShowChatSummary(false)}
            chatId={activeChat}
            chatName={chatName}
          />
        )}
      </AnimatePresence>

      {/* Hidden Chat Modal */}
      <AnimatePresence>
        {showHiddenChatModal && activeChat && (
          <HiddenChatModal
            isOpen={showHiddenChatModal}
            onClose={() => setShowHiddenChatModal(false)}
            mode={hiddenChatMode}
            chatId={activeChat}
            onUnlocked={() => {
              setShowHiddenChatModal(false);
            }}
          />
        )}
      </AnimatePresence>

      
    </div>
  );
}
