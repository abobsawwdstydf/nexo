import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClearInput } from './ClearInput';
import {
  Search,
  Plus,
  Menu,
  X,
  MessageSquare,
  Users,
  Sparkles,
  Edit2,
  Trash2,
  Archive,
  ArchiveRestore,
  Share2,
  Newspaper,
  Phone,
  FileText,
  Star,
  Settings,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useLang } from '../lib/i18n';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { cn, Badge, Spinner, SearchInput, GlassPanel, EmptyState } from './ui';
import PremiumBadge from './PremiumBadge';
import { AnimatedInput, AnimatedBadge } from './animations/AnimatedUIComponents';
import Avatar from './Avatar';
import UserTag from './UserTag';
import { StoryGroup, Chat, SmartFolder } from '../lib/types';
import ChatListItem from './ChatListItem';
import NewChatModal from './NewChatModal';
import UserProfile from './UserProfile';
import SideMenu from './SideMenu';
import StoryViewer, { CreateStoryModal } from './StoryViewer';
import FolderModal from './FolderModal';
import SmartFolderModal from './SmartFolderModal';
import SearchPanel from './SearchPanel';
import ShareFolderModal from './ShareFolderModal';
import VerifiedBadge from './VerifiedBadge';
import { AvatarGroup } from './transitions/AvatarGroup';
import { NotificationBadge } from './transitions/NotificationBadge';

// Типы навигации
type NavTab = 'chats' | 'friends' | 'settings' | 'profile';

interface Folder {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  chats: Chat[];
}

interface SidebarProps {
  onOpenAI: () => void;
  onOpenFriends: () => void;
  onOpenWall?: () => void;
}

function NavButton({
  icon: Icon,
  label,
  active,
  onClick,
  badge,
}: {
  icon: typeof MessageSquare;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        aria-label={label}
        className={cn(
          'relative flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 hover:scale-110',
          active
            ? 'text-white border border-white/10'
            : 'hover:text-white text-zinc-500 border border-transparent'
        )}
      >
        <Icon
          size={20}
          className={cn(
            'transition-colors duration-200',
            active ? 'text-white' : 'text-zinc-500 group-hover:text-white'
          )}
        />

        {badge && badge > 0 && (
          <NotificationBadge
            count={badge}
            className="top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-nexo-500 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-surface"
          />
        )}
      </button>

      <div
        role="tooltip"
        className={cn(
          'absolute left-full ml-3 top-1/2 -translate-y-1/2 z-50',
          'px-3 py-1.5 rounded-lg text-xs font-medium text-white whitespace-nowrap',
          'bg-zinc-800 border border-white/10 shadow-xl',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none'
        )}
      >
        {label}
        <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-800" />
      </div>
    </div>
  );
}

export default function Sidebar({ onOpenAI, onOpenFriends, onOpenWall }: SidebarProps) {
  const { user } = useAuthStore();
  const { chats, activeChat, searchQuery, setSearchQuery, addChat, setActiveChat, archivedChatIds, showArchive, setShowArchive } = useChatStore();
  const { t } = useLang();
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSideMenu, setShowSideMenu] = useState(false);
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [storyViewerIndex, setStoryViewerIndex] = useState<number | null>(null);
  const [showCreateStory, setShowCreateStory] = useState(false);
  const openingChatRef = useRef(false);

  // Навигация
  const [activeTab, setActiveTab] = useState<NavTab>('chats');
  const [isMobile, setIsMobile] = useState(false);
  const { currentView } = useNavigationStore();

  // Результаты поиска
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [channelResults, setChannelResults] = useState<Chat[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Папки
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null); // null = все чаты
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderContextMenu, setFolderContextMenu] = useState<{ folderId: string; x: number; y: number } | null>(null);
  const [showSearchPanel, setShowSearchPanel] = useState(false);
  const [showShareFolder, setShowShareFolder] = useState<{ id: string; name: string; icon: string; color: string } | null>(null);
  // Smart Folders (Feature 1)
  const [smartFolders, setSmartFolders] = useState<SmartFolder[]>([]);
  const [selectedSmartFolder, setSelectedSmartFolder] = useState<string | null>(null);
  const [showSmartFolderModal, setShowSmartFolderModal] = useState(false);
  const [editingSmartFolder, setEditingSmartFolder] = useState<SmartFolder | null>(null);

  const { sidebarProfileUserId, closeSidebarProfile } = useNavigationStore();

  /** Определяем мобильное устройство */
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  /** Слушаем открытие нового чата через navigation store */
  useEffect(() => {
    const unsub = useNavigationStore.subscribe((state) => {
      if (state.showNewChat) {
        setShowNewChat(true);
        useNavigationStore.getState().closeNewChat();
      }
    });
    return unsub;
  }, []);

  // Auto-switch to profile tab when sidebarProfileUserId is set
  useEffect(() => {
    if (sidebarProfileUserId) {
      setActiveTab('profile');
    }
  }, [sidebarProfileUserId]);

  /** Загрузка папок */
  useEffect(() => {
    loadFolders();
    loadSmartFolders();
  }, []);

  const loadFolders = async () => {
    try {
      const data = await api.getFolders();
      setFolders(data);
    } catch (error) {
      console.error('Ошибка загрузки папок:', error);
    }
  };

  const loadSmartFolders = async () => {
    try {
      const { items } = await api.getSmartFolders();
      setSmartFolders(items || []);
    } catch (error) {
      console.error('Ошибка загрузки умных папок:', error);
    }
  };

  const handleDeleteSmartFolder = async (id: string) => {
    try {
      await api.deleteSmartFolder(id);
      await loadSmartFolders();
    } catch (error) {
      console.error('Ошибка удаления умной папки:', error);
    }
  };

  const handleCreateFolder = async (data: { name: string; icon: string; color: string }) => {
    try {
      await api.createFolder(data);
      await loadFolders();
      setShowFolderModal(false);
    } catch (error) {
      console.error('Ошибка создания папки:', error);
    }
  };

  const handleUpdateFolder = async (data: { name: string; icon: string; color: string }) => {
    if (!editingFolder) return;
    try {
      await api.updateFolder(editingFolder.id, data);
      await loadFolders();
      setShowFolderModal(false);
      setEditingFolder(null);
    } catch (error) {
      console.error('Ошибка обновления папки:', error);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Удалить папку? Чаты останутся в списке.')) return;
    try {
      await api.deleteFolder(folderId);
      await loadFolders();
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
      }
      setFolderContextMenu(null);
    } catch (error) {
      console.error('Ошибка удаления папки:', error);
    }
  };

  const handleAddChatToFolder = async (chatId: string, folderId: string) => {
    try {
      await api.addChatToFolder(folderId, chatId);
      await loadFolders();
    } catch (error) {
      console.error('Ошибка добавления чата в папку:', error);
    }
  };

  const handleRemoveChatFromFolder = async (chatId: string, folderId: string) => {
    try {
      await api.removeChatFromFolder(folderId, chatId);
      await loadFolders();
    } catch (error) {
      console.error('Ошибка удаления чата из папки:', error);
    }
  };

  /** Загрузка сторисов — ТОЛЬКО с сервера */
  const loadStories = () => {
    api.getStories()
      .then((stories) => {
        setStoryGroups(stories);
      })
      .catch(console.error);
  };

  /** Поиск */
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setChannelResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [users, channels] = await Promise.all([
          api.searchUsers(searchQuery),
          api.searchChannels(searchQuery),
        ]);
        setSearchResults(users);
        setChannelResults(channels);
      } catch (e) {
        console.error('Search error:', e);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleJoinChannel = async (channel: Chat) => {
    try {
      const joined = await api.joinChannel(channel.username!);
      addChat(joined);
      setActiveChat(joined.id);
      setSearchQuery('');
    } catch (e) {
      console.error('Failed to join channel:', e);
    }
  };

  const handleOpenChatWithUser = async (userId: string) => {
    if (openingChatRef.current) return;
    openingChatRef.current = true;

    try {
      const store = useChatStore.getState();
      const existingChat = store.chats.find(c =>
        c.type === 'personal' && c.members.some(m => m.user.id === userId)
      );

      if (existingChat) {
        store.setActiveChat(existingChat.id);
        setSearchQuery('');
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
        const refreshedChats = store.chats;
        const stillExisting = refreshedChats.find(c =>
          c.type === 'personal' && c.members.some(m => m.user.id === userId)
        );

        if (stillExisting) {
          store.setActiveChat(stillExisting.id);
        } else {
          const chat = await api.createPersonalChat(userId);
          store.addChat(chat);
          store.setActiveChat(chat.id);
        }
        setSearchQuery('');
      }
    } catch (e) {
      console.error('Failed to open chat:', e);
    } finally {
      openingChatRef.current = false;
    }
  };

  const handleOpenChatFromStory = (userId: string) => {
    handleOpenChatWithUser(userId);
  };

  useEffect(() => {
    loadStories();
    const interval = setInterval(loadStories, 30000);
    return () => clearInterval(interval);
  }, []);

  /** Фильтрация чатов */
  const filteredChats = chats.filter((chat) => {
    // Архив: показываем только архивные или только обычные
    const isArchived = archivedChatIds.has(chat.id);
    if (showArchive && !isArchived) return false;
    if (!showArchive && isArchived) return false;

    // Фильтр по папке
    if (selectedFolder) {
      const folder = folders.find(f => f.id === selectedFolder);
      if (folder && !folder.chats.some(c => c.id === chat.id)) {
        return false;
      }
    }

    // Фильтр по поиску
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    if (chat.name?.toLowerCase().includes(q)) return true;
    return chat.members.some(
      (m) =>
        m.user.id !== user?.id &&
        (m.user.username.toLowerCase().includes(q) ||
          m.user.displayName.toLowerCase().includes(q))
    );
  }).sort((a, b) => {
    if (a.type === 'favorites') return -1;
    if (b.type === 'favorites') return 1;
    return 0;
  });

  const archivedCount = chats.filter(c => archivedChatIds.has(c.id)).length;

  /** Счётчик непрочитанных */
  const unreadCount = chats.reduce((acc, chat) => acc + (chat.unreadCount || 0), 0);

  /** Переключение вкладок */
  const handleTabChange = (tab: NavTab) => {
    setActiveTab(tab);
    if (tab === 'chats') {
      setSearchQuery('');
      if (activeChat) setActiveChat(null);
      // Если на стене — переключаемся на чаты
      if (currentView === 'wall') {
        useNavigationStore.getState().navigateTo('chat');
      }
    }
    if (tab === 'settings') setShowSideMenu(true);
    if (tab === 'friends') onOpenFriends();
  };

  return (
    <>
      <div className={`w-full ${currentView !== 'wall' ? 'sm:w-[380px]' : ''} h-full flex sm:rounded-[28px] overflow-hidden relative z-10 liquid-glass-strong border border-white/[0.08]`}>

        {/* ====== БОКОВАЯ НАВИГАЦИЯ (ПК) ====== */}
        {!isMobile && (
          <div className="w-[56px] flex flex-col items-center py-3 gap-2.5 flex-shrink-0 z-20">
            {/* Логотип */}
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center liquid-glass border border-white/[0.1] transition-all duration-300 hover:shadow-lg hover:scale-105">
              <img src="/logo.png" alt="Нексо" className="w-7 h-7 rounded-xl object-cover" />
            </div>

            {/* Кнопки навигации — отдельная панель */}
            <div className="w-[44px] rounded-2xl flex flex-col items-center py-2 gap-1.5 liquid-glass-subtle border border-white/[0.08]">
              <NavButton
                icon={Menu}
                label="Меню"
                active={false}
                onClick={() => setShowSideMenu(true)}
              />
              <NavButton
                icon={MessageSquare}
                label="Чаты"
                active={currentView === 'chat'}
                onClick={() => handleTabChange('chats')}
                badge={unreadCount}
              />
              <NavButton
                icon={Users}
                label="Контакты"
                active={currentView === 'contacts'}
                onClick={() => useNavigationStore.getState().navigateTo('contacts')}
              />
              <NavButton
                icon={Phone}
                label="Звонки"
                active={currentView === 'calls'}
                onClick={() => useNavigationStore.getState().navigateTo('calls')}
              />
              <NavButton
                icon={Sparkles}
                label="Нексо AI"
                active={false}
                onClick={onOpenAI}
              />
              <NavButton
                icon={FileText}
                label="Файлы"
                active={currentView === 'files'}
                onClick={() => useNavigationStore.getState().navigateTo('files')}
              />
              <NavButton
                icon={Star}
                label="Избранное"
                active={currentView === 'favorites'}
                onClick={() => useNavigationStore.getState().navigateTo('favorites')}
              />
              {onOpenWall && (
                <NavButton
                  icon={Newspaper}
                  label="Стена"
                  active={currentView === 'wall'}
                  onClick={onOpenWall}
                />
              )}
            </div>

            <div className="flex-1" />

            {/* НуЧе Premium Banner */}
            <PremiumBadge variant="sidebar" />

            {/* Настройки */}
            <NavButton
              icon={Settings}
              label="Настройки"
              active={currentView === 'settings'}
              onClick={() => useNavigationStore.getState().navigateTo('settings')}
            />

            {/* Профиль — внизу колонки */}
            <button
              onClick={() => handleTabChange('profile')}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-white/[0.1] hover:border-[var(--color-accent)]/40 transition-all duration-200"
            >
              {user?.avatar ? (
                <img src={normalizeMediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-white/10 text-white text-sm font-bold">
                  {(user?.displayName || user?.username || '?')[0].toUpperCase()}
                </div>
              )}
            </button>
          </div>
        )}

        {/* ====== ОСНОВНОЙ КОНТЕНТ ====== */}
        {currentView !== 'wall' && (
        <div className="flex-1 flex flex-col min-w-0 gap-2 p-2">

          {/* Верхняя панель: Header + Поиск + Сторисы */}
          <div className="rounded-2xl overflow-hidden flex-shrink-0 liquid-glass border border-white/[0.08]">
            {/* Header */}
            <div className="relative h-[52px] px-4 flex items-center gap-3">
              <button
                onClick={() => setShowSideMenu(true)}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-white/50 hover:text-white hover:bg-white/[0.06] transition-all duration-150 flex-shrink-0"
                title="Меню"
                aria-label="Открыть меню"
              >
                <Menu size={16} />
              </button>

              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                <img src="/logo.png" alt="Нексо" className="w-6 h-6 rounded-lg object-cover" />
                <h1 className="text-[15px] font-bold text-white/90 truncate tracking-tight">
                  {activeTab === 'chats' && 'Нексо'}
                  {activeTab === 'friends' && 'Друзья'}
                  {activeTab === 'settings' && 'Настройки'}
                </h1>
              </div>
            </div>

            {/* Поиск — современный анимированный */}
            <div className="relative px-3 pb-2.5">
              <div className="relative group">
                <div className="flex items-center gap-2.5 bg-white/[0.04] rounded-2xl px-3.5 py-2.5 border border-white/[0.06] focus-within:border-nexo-500/25 focus-within:bg-white/[0.06] transition-all duration-300">
                  <motion.div
                    animate={{ rotate: isSearching ? 360 : 0 }}
                    transition={{ duration: 1, repeat: isSearching ? Infinity : 0, ease: 'linear' }}
                  >
                    <Search size={15} className="text-white/30" />
                  </motion.div>
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      activeTab === 'friends'
                        ? 'Имя или @username'
                        : searchResults.length > 0 || channelResults.length > 0
                          ? 'Уточните запрос...'
                          : 'Найти чат, контакт...'
                    }
                    className="flex-1 bg-transparent text-[13px] text-white placeholder-white/30 outline-none"
                  />
                  {searchQuery && (
                    <motion.button
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      onClick={() => setSearchQuery('')}
                      className="p-1 rounded-full bg-white/10 hover:bg-white/15 transition-colors text-white/30 hover:text-white/60"
                    >
                      <X size={12} />
                    </motion.button>
                  )}
                </div>
              </div>

              {searchQuery.trim() && (
                <motion.div 
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between mt-2 px-1"
                >
                  <span className="text-[10px] text-white/30">
                    {searchResults.length + channelResults.length > 0
                      ? `Найдено: ${searchResults.length} польз., ${channelResults.length} кан.`
                      : isSearching
                        ? 'Ищем...'
                        : 'Ничего не найдено'}
                  </span>
                  <button
                    onClick={() => setShowSearchPanel(true)}
                    className="text-[10px] text-nexo-400/70 hover:text-nexo-300 transition-colors duration-150"
                  >
                    Расширенный поиск →
                  </button>
                </motion.div>
              )}
            </div>

            {/* Сторисы */}
            {activeTab === 'chats' && (
              <div className="px-3 pb-2.5">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Истории</span>
                </div>
                <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                  <button
                    onClick={() => setShowCreateStory(true)}
                    className="flex flex-col items-center gap-1 flex-shrink-0 group"
                  >
                    <div className="w-14 h-14 rounded-full flex items-center justify-center transition-transform group-hover:scale-105 bg-surface-tertiary border border-surface-secondary">
                      <Plus size={16} className="text-nexo-400" />
                    </div>
                    <span className="text-[10px] text-zinc-500 truncate w-14 text-center">{t('newStory')}</span>
                  </button>

                  <AvatarGroup
                    items={storyGroups.map((group, idx) => {
                      const avatarUrl = group.user.avatar ? normalizeMediaUrl(group.user.avatar) : null;
                      const isMine = group.user.id === user?.id;
                      return (
                        <button
                          key={group.user.id}
                          onClick={() => setStoryViewerIndex(idx)}
                          className="flex flex-col items-center gap-1 flex-shrink-0 group"
                        >
                          <div className={`w-14 h-14 rounded-full p-[2px] transition-transform group-hover:scale-105 ${
                            group.hasUnviewed
                              ? 'bg-nexo-500 shadow-lg shadow-nexo-500/20'
                              : isMine
                                ? 'bg-zinc-500'
                                : 'bg-zinc-700'
                          }`}>
                            <div className="w-full h-full rounded-full overflow-hidden border-2 border-surface-primary">
                              <Avatar
                                src={avatarUrl}
                                name={group.user.displayName || group.user.username}
                                size="lg"
                                className="w-full h-full"
                                isVerified={(group.user as any).isVerified}
                                verifiedBadgeUrl={(group.user as any).verifiedBadgeUrl}
                                verifiedBadgeType={(group.user as any).verifiedBadgeType}
                              />
                            </div>
                          </div>
                          <span className="text-[10px] text-zinc-400 truncate w-14 text-center">
                            {isMine ? t('myStory') : (group.user.displayName || group.user.username).split(' ')[0]}
                          </span>
                        </button>
                      );
                    })}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Контент вкладки */}
          <div className={`flex-1 overflow-y-auto relative ${isMobile ? 'pb-28' : 'pb-0'}`}>
            <AnimatePresence mode="wait">
              {activeTab === 'chats' && (
                <motion.div
                  key="chats"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="h-full"
                >
                  {/* Список чатов — отдельная панель */}
                  <div className="h-full rounded-2xl overflow-hidden flex flex-col bg-surface-secondary border border-surface-secondary">
                    {/* Вкладки папок */}
                    {!searchQuery.trim() && (
                      <div className="px-2 py-2 flex items-center gap-1 overflow-x-auto scrollbar-hide border-b border-surface-secondary">
                        {/* Все чаты */}
                      <button
                        onClick={() => setSelectedFolder(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                          selectedFolder === null
                            ? 'bg-white/10 text-white ring-1 ring-white/20'
                            : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                        }`}
                        >
                          <MessageSquare size={14} />
                          Все чаты
                          <span className="text-[10px] opacity-60">({chats.length})</span>
                        </button>

                        {/* Папки */}
                        {folders.map((folder) => (
                          <button
                            key={folder.id}
                            onClick={() => setSelectedFolder(folder.id)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              setFolderContextMenu({ folderId: folder.id, x: e.clientX, y: e.clientY });
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.currentTarget.style.opacity = '0.5';
                            }}
                            onDragLeave={(e) => {
                              e.currentTarget.style.opacity = '1';
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              e.currentTarget.style.opacity = '1';
                              const chatId = e.dataTransfer.getData('chatId');
                              if (chatId) {
                                handleAddChatToFolder(chatId, folder.id);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                              selectedFolder === folder.id
                                ? 'ring-1'
                                : 'hover:bg-white/5'
                            }`}
                            style={{
                              backgroundColor: selectedFolder === folder.id ? folder.color + '20' : 'transparent',
                              color: selectedFolder === folder.id ? folder.color : '#a1a1aa',
                              borderColor: selectedFolder === folder.id ? folder.color + '50' : 'transparent',
                            }}
                          >
                            <span>{folder.icon}</span>
                            {folder.name}
                            <span className="text-[10px] opacity-60">({folder.chats.length})</span>
                          </button>
                        ))}

                        {/* Умные папки (Feature 1) */}
                        {smartFolders.map((sf) => (
                          <button
                            key={`sf-${sf.id}`}
                            onClick={() => setSelectedSmartFolder(selectedSmartFolder === sf.id ? null : sf.id)}
                            onContextMenu={(e) => {
                              e.preventDefault();
                              if (confirm(`Удалить умную папку "${sf.name}"?`)) {
                                handleDeleteSmartFolder(sf.id);
                              }
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                              selectedSmartFolder === sf.id
                                ? 'ring-1'
                                : 'hover:bg-white/5'
                            }`}
                            style={{
                              backgroundColor: selectedSmartFolder === sf.id ? sf.color + '20' : 'transparent',
                              color: selectedSmartFolder === sf.id ? sf.color : '#a1a1aa',
                              borderColor: selectedSmartFolder === sf.id ? sf.color + '50' : 'transparent',
                            }}
                          >
                            <span>{sf.icon || '⚡'}</span>
                            {sf.name}
                          </button>
                        ))}

                        {/* Кнопка создать умную папку */}
                        <button
                          onClick={() => {
                            setEditingSmartFolder(null);
                            setShowSmartFolderModal(true);
                          }}
                          className="px-2 py-1.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-all flex items-center gap-1"
                          title="Создать умную папку"
                        >
                          <Sparkles size={14} />
                        </button>

                        {/* Кнопка создать папку */}
                        <button
                          onClick={() => {
                            setEditingFolder(null);
                            setShowFolderModal(true);
                          }}
                          className="px-2 py-1.5 rounded-lg text-zinc-400 hover:bg-white/5 hover:text-white transition-all flex items-center gap-1"
                          title="Создать папку"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    )}

                    {searchQuery.trim() ? (
                      /* Результаты поиска */
                      <div className="py-2">
                        {searchResults.length > 0 && (
                          <div className="mb-4">
                            <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
                              <MessageSquare size={10} />
                              Пользователи
                            </div>
                            <div className="space-y-0.5">
                              {searchResults.map((u) => (
                                <motion.button
                                  key={u.id}
                                  onClick={() => handleOpenChatWithUser(u.id)}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors"
                                >
                                  <Avatar
                                    src={u.avatar}
                                    name={u.displayName || u.username}
                                    size="md"
                                    isVerified={u.isVerified}
                                    verifiedBadgeUrl={u.verifiedBadgeUrl}
                                    verifiedBadgeType={u.verifiedBadgeType}
                                  />
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                                      {u.isVerified && (
                                        <span className="flex-shrink-0 inline-flex items-center justify-center">
                                          <VerifiedBadge
                                            size="sm"
                                            verifiedBadgeUrl={u.verifiedBadgeUrl}
                                            verifiedBadgeType={u.verifiedBadgeType}
                                          />
                                        </span>
                                      )}
                                      {u.tagText && (
                                        <UserTag text={u.tagText} color={u.tagColor} style={u.tagStyle} size="xs" />
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-500">@{u.username}</p>
                                  </div>
                                  <MessageSquare size={14} className="text-zinc-600" />
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        )}

                        {channelResults.length > 0 && (
                          <div className="mb-4">
                            <div className="px-4 py-2 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                              Каналы
                            </div>
                            <div className="space-y-0.5">
                              {channelResults.map((channel) => (
                                <motion.button
                                  key={channel.id}
                                  onClick={() => handleJoinChannel(channel)}
                                  whileHover={{ scale: 1.01 }}
                                  whileTap={{ scale: 0.99 }}
                                  className="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-white/5 transition-colors"
                                >
                                  <Avatar
                                    src={channel.avatar}
                                    name={channel.name || channel.username || '?'}
                                    size="md"
                                    isVerified={channel.isVerified}
                                    verifiedBadgeUrl={channel.verifiedBadgeUrl}
                                    verifiedBadgeType={channel.verifiedBadgeType}
                                  />
                                  <div className="flex-1 text-left min-w-0">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <p className="text-sm font-medium text-white truncate">{channel.name}</p>
                                      {channel.isVerified && (
                                        <span className="flex-shrink-0 inline-flex items-center justify-center">
                                          <VerifiedBadge
                                            size="xs"
                                            verifiedBadgeUrl={channel.verifiedBadgeUrl}
                                            verifiedBadgeType={channel.verifiedBadgeType}
                                          />
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-500">@{channel.username}</p>
                                  </div>
                                  <MessageSquare size={14} className="text-zinc-600" />
                                </motion.button>
                              ))}
                            </div>
                          </div>
                        )}

                        {searchResults.length === 0 && channelResults.length === 0 && !isSearching && (
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3"
                          >
                            <div className="w-16 h-16 rounded-full liquid-glass-subtle flex items-center justify-center border border-white/[0.06]">
                              <Search size={24} className="opacity-50" />
                            </div>
                            <p className="text-sm">Ничего не найдено</p>
                          </motion.div>
                        )}

                        {isSearching && (
                          <div className="flex items-center justify-center py-12">
                            <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                          </div>
                        )}
                      </div>
                    ) : filteredChats.length === 0 ? (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3 px-6"
                      >
                        <div className="w-20 h-20 rounded-full liquid-glass-subtle flex items-center justify-center border border-white/[0.06]">
                          <MessageSquare size={36} className="opacity-30" />
                        </div>
                        <p className="text-sm text-center">{showArchive ? 'Архив пуст' : t('noChats')}</p>
                        {showArchive && (
                          <button
                            onClick={() => setShowArchive(false)}
                            className="text-xs text-nexo-400 hover:text-nexo-300 transition-colors"
                          >
                            ← Вернуться к чатам
                          </button>
                        )}
                      </motion.div>
                    ) : (
                      <div className="py-2">
                        {/* Заголовок архива */}
                        {showArchive && (
                          <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 mb-2">
                            <button
                              onClick={() => setShowArchive(false)}
                              className="flex items-center gap-2 text-sm text-nexo-400 hover:text-nexo-300 transition-colors"
                            >
                              <ArchiveRestore size={16} />
                              ← Назад
                            </button>
                            <div className="text-xs text-zinc-500">
                              {archivedCount} {archivedCount === 1 ? 'чат' : archivedCount < 5 ? 'чата' : 'чатов'}
                            </div>
                          </div>
                        )}
                        
                        {/* Кнопка архива */}
                        {!showArchive && !searchQuery.trim() && archivedCount > 0 && (
                          <button
                            onClick={() => setShowArchive(true)}
                            className="flex items-center gap-3 w-full px-3 py-3 hover:bg-white/5 transition-colors text-left mb-1"
                          >
                            <div className="w-12 h-12 rounded-full bg-zinc-700/50 flex items-center justify-center flex-shrink-0">
                              <Archive size={22} className="text-zinc-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white">Архив</p>
                              <p className="text-xs text-zinc-500">{archivedCount} {archivedCount === 1 ? 'чат' : archivedCount < 5 ? 'чата' : 'чатов'}</p>
                            </div>
                          </button>
                        )}
                        
                        {/* Список чатов */}
                        <div className="overflow-y-auto flex-1 min-h-0">
                          {filteredChats.map(chat => (
                            <ChatListItem key={chat.id} chat={chat} isActive={chat.id === activeChat} />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {activeTab === 'friends' && (
                <motion.div
                  key="friends"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="h-full rounded-2xl flex flex-col items-center justify-center text-zinc-500 gap-4 px-6 bg-surface-secondary border border-surface-secondary"
                >
                  <div className="w-20 h-20 rounded-full flex items-center justify-center bg-surface-tertiary">
                    <Users size={36} className="opacity-30" />
                  </div>
                  <p className="text-sm text-center font-medium">Друзья</p>
                  <p className="text-xs text-zinc-600 text-center">Управление друзьями через панель</p>
                </motion.div>
              )}

              {activeTab === 'profile' && user && (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="h-full rounded-2xl overflow-y-auto bg-surface-secondary border border-surface-secondary"
                >
                  <UserProfile
                    userId={sidebarProfileUserId || user.id}
                    isSelf={!sidebarProfileUserId || sidebarProfileUserId === user.id}
                    embedded
                    onClose={() => {
                      closeSidebarProfile();
                      setActiveTab('chats');
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

        </div>
        )}
      </div>

      {/* ====== МОДАЛКИ ====== */}
      <AnimatePresence>
        {showNewChat && <NewChatModal onClose={() => setShowNewChat(false)} />}
      </AnimatePresence>
      <SideMenu
        isOpen={showSideMenu}
        onClose={() => { setShowSideMenu(false); if (activeTab === 'settings') setActiveTab('chats'); }}
      />
      <AnimatePresence>
        {storyViewerIndex !== null && storyGroups.length > 0 && (
          <StoryViewer
            stories={storyGroups}
            initialUserIndex={storyViewerIndex}
            onClose={() => { setStoryViewerIndex(null); loadStories(); }}
            onRefresh={loadStories}
            onOpenChat={handleOpenChatFromStory}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showCreateStory && (
          <CreateStoryModal
            onClose={() => setShowCreateStory(false)}
            onCreated={loadStories}
          />
        )}
      </AnimatePresence>

      {/* Folder Modal */}
      <AnimatePresence>
        {showFolderModal && (
          <FolderModal
            onClose={() => {
              setShowFolderModal(false);
              setEditingFolder(null);
            }}
            onSave={editingFolder ? handleUpdateFolder : handleCreateFolder}
            initialData={editingFolder ? {
              name: editingFolder.name,
              icon: editingFolder.icon,
              color: editingFolder.color,
            } : undefined}
            title={editingFolder ? 'Редактировать папку' : 'Создать папку'}
          />
        )}
      </AnimatePresence>

      {/* Smart Folder Modal */}
      <AnimatePresence>
        {showSmartFolderModal && (
          <SmartFolderModal
            onClose={() => {
              setShowSmartFolderModal(false);
              setEditingSmartFolder(null);
            }}
            onSaved={() => {
              loadSmartFolders();
              setShowSmartFolderModal(false);
              setEditingSmartFolder(null);
            }}
            initialData={editingSmartFolder ?? undefined}
          />
        )}
      </AnimatePresence>

      {/* Folder Context Menu */}
      {folderContextMenu && typeof document !== 'undefined' && (
        <div
          className="fixed inset-0 z-[60]"
          onClick={() => setFolderContextMenu(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.15 }}
            className="fixed z-[70] w-48 rounded-xl liquid-glass shadow-2xl py-1 overflow-hidden border border-white/[0.1]"
            style={{
              left: Math.min(folderContextMenu.x, window.innerWidth - 200),
              top: Math.min(folderContextMenu.y, window.innerHeight - 100),
            }}
            onClick={(e) => e.stopPropagation()}
            role="menu"
          >
            <button
              onClick={() => {
                const folder = folders.find(f => f.id === folderContextMenu.folderId);
                if (folder) {
                  setEditingFolder(folder);
                  setShowFolderModal(true);
                }
                setFolderContextMenu(null);
              }}
              role="menuitem"
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Edit2 size={16} />
              Редактировать
            </button>
            <button
              onClick={() => {
                const folder = folders.find(f => f.id === folderContextMenu.folderId);
                if (folder) {
                  setShowShareFolder({
                    id: folder.id,
                    name: folder.name,
                    icon: folder.icon || '📁',
                    color: folder.color || '#7B61FF',
                  });
                }
                setFolderContextMenu(null);
              }}
              role="menuitem"
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
            >
              <Share2 size={16} />
              Поделиться
            </button>
            <button
              onClick={() => handleDeleteFolder(folderContextMenu.folderId)}
              role="menuitem"
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} />
              Удалить
            </button>
          </motion.div>
        </div>
      )}

      {/* Search Panel */}
      <AnimatePresence>
        {showSearchPanel && (
          <SearchPanel
            onClose={() => setShowSearchPanel(false)}
            onSelectMessage={(messageId, chatId) => {
              setActiveChat(chatId);
              // Scroll to message after chat loads
              setTimeout(() => {
                const messageElement = document.getElementById(`msg-${messageId}`);
                if (messageElement) {
                  messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  // Highlight message briefly
                  messageElement.classList.add('bg-yellow-500/20');
                  setTimeout(() => {
                    messageElement.classList.remove('bg-yellow-500/20');
                  }, 2000);
                }
              }, 500);
            }}
          />
        )}
      </AnimatePresence>



      {/* Share Folder Modal */}
      <AnimatePresence>
        {showShareFolder && (
          <ShareFolderModal
            folderId={showShareFolder.id}
            folderName={showShareFolder.name}
            folderIcon={showShareFolder.icon}
            folderColor={showShareFolder.color}
            onClose={() => setShowShareFolder(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
