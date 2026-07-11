import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  User,
  Users,
  Settings,
  Languages,
  Info,
  LogOut,
  ArrowLeft,
  Camera,
  Edit3,
  Check,
  Loader2,
  Trash2,
  AtSign,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Palette,
  UserPlus,
  UserMinus,
  UserCheck,
  Clock,
  Search,
  Shield,
  Eye,
  Phone,
  Mic,
  Bell,
  Volume2,
  Minimize2,
  Maximize2,
  Monitor,
  Crown,
  BarChart3,
  Cloud,
  Smile,
  Wallet,
  Pin,
  Sparkles,
  Store,
  Video,
  Gift,
  Award,
  ListMusic,
  ShieldAlert,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useLang } from '../lib/i18n';
import { useCallSettingsStore } from '../stores/callSettingsStore';
import { useUIThemeStore } from '../stores/uiThemeStore';
import DevicesTab from './DevicesTab';
import LegalPage from './LegalPage';
import PremiumPage from '../pages/PremiumPage';
import StatisticsPage from '../pages/StatisticsPage';
import ThemeSettings from './ThemeSettings';
import CloudStorageModal from './CloudStorageModal';
import CustomEmojiPicker from './CustomEmojiPicker';
import YooMoneyInfoPage from './YooKassaInfoPage';
import FakePasswordModal from './FakePasswordModal';
import BadgesModal from './BadgesModal';
import CollabPlaylistModal from './CollabPlaylistModal';
import MusicPlaylistsModal from './MusicPlaylistsModal';
import UserProfile from './UserProfile';
import type { User as UserType, UserPresence, FriendRequest, FriendWithId } from '../lib/types';

type SideView = 'main' | 'profile' | 'settings' | 'about' | 'friends' | 'calls' | 'premium' | 'statistics' | 'wallet' | 'cloud' | 'badges' | 'playlists' | 'fake_password';

interface SideMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SideMenu({ isOpen, onClose }: SideMenuProps) {
  const { user, updateUser, logout } = useAuthStore();
  const { clearStore } = useChatStore();
  const [showCloudStorage, setShowCloudStorage] = useState(false);
  const [showCustomEmoji, setShowCustomEmoji] = useState(false);
  const [showYooKassaInfo, setShowYooKassaInfo] = useState(false);
  const [showFakePassword, setShowFakePassword] = useState(false);
  const [showBadges, setShowBadges] = useState(false);
  const [showPlaylists, setShowPlaylists] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState<{
    notifyAll: boolean;
    notifyMessages: boolean;
    notifyCalls: boolean;
    notifyFriends: boolean;
  }>({
    notifyAll: true,
    notifyMessages: true,
    notifyCalls: true,
    notifyFriends: true,
  });
  const callSettings = useCallSettingsStore();

  useEffect(() => {
    // Load notification settings only if user is logged in
    if (user) {
      api.getNotificationSettings().then((settings) => {
        if (settings) setNotificationSettings(settings);
      }).catch(() => {
        // Silent fail - keep default values
      });
    }
  }, [user]);

  const updateNotificationSetting = async (key: 'notifyAll' | 'notifyMessages' | 'notifyCalls' | 'notifyFriends', value: boolean) => {
    try {
      const newSettings = { ...notificationSettings, [key]: value };
      if (key === 'notifyAll') {
        newSettings.notifyMessages = value;
        newSettings.notifyCalls = value;
        newSettings.notifyFriends = value;
      }
      await api.updateNotificationSettings(newSettings);
      setNotificationSettings(newSettings);
    } catch (e) {
      console.error('Failed to update notification settings:', e);
    }
  };
  const uiTheme = useUIThemeStore();
  const { t, lang, setLang } = useLang();

  const [view, setView] = useState<SideView>('main');
  const [prevView, setPrevView] = useState<SideView>('main');
  const [isEditing, setIsEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [friends, setFriends] = useState<FriendWithId[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [friendSearch, setFriendSearch] = useState('');
  const [friendSearchResults, setFriendSearchResults] = useState<UserPresence[]>([]);
  const [friendSearchLoading, setFriendSearchLoading] = useState(false);
  const [showDevices, setShowDevices] = useState(false);
  const [legalPage, setLegalPage] = useState<'terms' | 'privacy' | null>(null);
  const [profileStatus, setProfileStatus] = useState<{ text: string; emoji?: string } | null>(null);

  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);

  const changeView = (newView: SideView) => {
    setPrevView(view);
    setView(newView);
  };

  // Load friends
  useEffect(() => {
    if (view === 'friends') {
      loadFriends();
    }
  }, [view]);

  // Load call history
  useEffect(() => {
    if (view === 'calls') {
      setCallsLoading(true);
      api.getCallHistory(50).then((logs: any[]) => {
        setCallHistory(logs);
      }).catch(() => {}).finally(() => setCallsLoading(false));
    }
  }, [view]);

  const loadFriends = async () => {
    setFriendsLoading(true);
    try {
      const [friendsData, requests] = await Promise.all([
        api.getFriends(),
        api.getFriendRequests(),
      ]);
      setFriends(friendsData);
      setFriendRequests(requests);
    } catch (e) {
      console.error(e);
    } finally {
      setFriendsLoading(false);
    }
  };

  // Search friends
  useEffect(() => {
    if (!friendSearch.trim() || friendSearch.trim().length < 3) {
      setFriendSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setFriendSearchLoading(true);
      try {
        const raw = friendSearch.trim();
        const q = raw.startsWith('@') ? raw.slice(1) : raw;
        const results = await api.searchUsers(q);
        setFriendSearchResults(results.filter((u) => u.id !== user?.id));
      } catch (e) {
        console.error(e);
      } finally {
        setFriendSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [friendSearch, user?.id]);

  const handleSendFriendRequest = async (userId: string) => {
    try {
      await api.sendFriendRequest(userId);
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAcceptFriend = async (friendshipId: string) => {
    try {
      await api.acceptFriendRequest(friendshipId);
      loadFriends();
    } catch (e) {
      console.error(e);
    }
  };

  const handleRemoveFriend = async (friendshipId: string) => {
    try {
      await api.removeFriend(friendshipId);
      setFriends((prev) => prev.filter((f) => f.friendshipId !== friendshipId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeclineRequest = async (friendshipId: string) => {
    try {
      await api.declineFriendRequest(friendshipId);
      setFriendRequests((prev) => prev.filter((r) => r.id !== friendshipId));
    } catch (e) {
      console.error(e);
    }
  };

  const handleLogout = () => {
    clearStore();
    logout();
    onClose();
  };

  // Profile editing
  useEffect(() => {
    if (view === 'profile' && user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      // Load status
      api.get(`/status/${user.id}`).then(setProfileStatus).catch(() => {});
    }
  }, [view, user]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await api.updateProfile({ displayName, bio });
      updateUser({ displayName, bio });
      setIsEditing(false);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarUploading(true);
    try {
      const updatedUser = await api.uploadAvatar(file);
      updateUser({ avatar: updatedUser.avatar });
    } catch (e) {
      console.error(e);
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      const updatedUser = await api.removeAvatar();
      updateUser({ avatar: updatedUser.avatar });
    } catch (e) {
      console.error(e);
    }
  };

  const initials = (user?.displayName || user?.username || '?')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const menuItems = [
    { icon: User, label: t('myProfile'), onClick: () => changeView('profile') },
    { icon: Users, label: t('friends'), onClick: () => changeView('friends'), badge: friendRequests.length > 0 ? friendRequests.length : undefined },
    { icon: Phone, label: 'Звонки', onClick: () => changeView('calls') },
    { divider: true },
    { icon: Crown, label: 'Нексо НУче', onClick: () => changeView('premium'), highlight: true },
    { icon: BarChart3, label: 'Статистика', onClick: () => changeView('statistics') },
    { icon: Cloud, label: 'Облачное хранилище', onClick: () => changeView('cloud') },
    { icon: Smile, label: 'Кастомные эмодзи', onClick: () => { setShowCustomEmoji(true); } },
    { divider: true },
    { icon: Award, label: 'Мои значки', onClick: () => changeView('badges') },
    { icon: ListMusic, label: 'Плейлисты', onClick: () => changeView('playlists') },
    { icon: ShieldAlert, label: 'Фейковый пароль', onClick: () => changeView('fake_password') },
    { divider: true },
    { icon: Settings, label: t('settings'), onClick: () => changeView('settings') },
    { divider: true },
    { icon: Info, label: t('aboutApp'), subtitle: 'Нексо v1.3', onClick: () => changeView('about') },
  ];

  // Slide direction for animations
  const slideDir = prevView === 'main' ? 1 : -1;
  const viewVariants = {
    enter: (dir: number) => ({ x: dir * 100, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: -dir * 100, opacity: 0 }),
  };

  // ======= MAIN VIEW =======
  const renderMain = () => (
    <motion.div key="main" className="relative z-[1] flex flex-col h-full min-h-0" initial={false} animate="center" exit="exit" variants={viewVariants} custom={-1} transition={{ duration: 0.2 }}>
      {/* Header — жидкое стекло */}
      <div className="relative overflow-hidden flex-shrink-0">
        <div className="absolute inset-0 bg-white/[0.03] pointer-events-none" />
        <div className="absolute inset-0 backdrop-blur-xl bg-white/[0.04] pointer-events-none" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent pointer-events-none" />
        <div className="relative p-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="relative group cursor-pointer" onClick={() => changeView('profile')}>
              <div className="absolute -inset-0.5 bg-white/10 rounded-full opacity-40 blur-sm group-hover:opacity-60 transition duration-500" />
              <div className="relative">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="w-[64px] h-[64px] rounded-full object-cover ring-2 ring-white/10" />
                ) : (
                    <div className="w-[64px] h-[64px] rounded-full bg-white/10 flex items-center justify-center ring-2 ring-white/10 relative overflow-hidden backdrop-blur-sm">
                    
                    <span className="relative z-10 text-xl font-bold text-white/90">{initials}</span>
                  </div>
                )}
              </div>
              <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-[#0a0a0f]" />
            </div>
            <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
              <X size={18} />
            </button>
          </div>
          <h3 className="text-lg font-semibold text-white/90 tracking-tight leading-tight">
            {user?.displayName || user?.username}
          </h3>
          <div className="flex items-center gap-1.5 mt-1">
            <AtSign size={11} className="text-zinc-500" />
            <span className="text-xs text-zinc-500">{user?.username}</span>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
      </div>

      {/* Menu items — жидкое стекло */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {menuItems.map((item, i) => {
          if ('divider' in item) return <div key={i} className="my-2 mx-3 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />;
          const Icon = item.icon!;
          const isHighlight = 'highlight' in item && item.highlight;
          return (
            <button
              key={i}
              onClick={item.onClick}
              className={`group w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all duration-300 active:scale-[0.98] backdrop-blur-sm border liquid-glass-subtle ${
                isHighlight
                  ? 'border-yellow-500/20 hover:border-yellow-500/30'
                  : 'hover:border-white/[0.06]'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 border ${
                isHighlight
                  ? 'bg-yellow-500/20 border-yellow-500/30 group-hover:bg-yellow-500/30'
                  : 'bg-white/[0.06] group-hover:bg-white/[0.1] border-white/[0.04] group-hover:border-white/[0.08]'
              }`}>
                <Icon size={17} className={`transition-all duration-300 ${
                  isHighlight ? 'text-yellow-400' : 'text-zinc-400 group-hover:text-zinc-200'
                }`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-[13.5px] font-medium transition-all duration-300 ${
                  isHighlight ? 'text-yellow-400 group-hover:text-yellow-300' : 'text-zinc-300 group-hover:text-white'
                }`}>{item.label}</p>
                {item.subtitle && <p className="text-[10px] text-zinc-600 mt-0.5">{item.subtitle}</p>}
              </div>
              {'beavers' in item ? (
                <span className="bg-amber-500/20 text-amber-400 text-[10px] font-bold px-2 h-5 rounded-full flex items-center justify-center flex-shrink-0 gap-0.5">
                  {(item as any).beavers}
                </span>
              ) : 'badge' in item && item.badge ? (
                <span className="bg-nexo-500/20 text-nexo-400 text-[10px] font-bold min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center flex-shrink-0">
                  {item.badge}
                </span>
              ) : (
                <ChevronRight size={14} className={`transition-colors flex-shrink-0 ${
                  isHighlight ? 'text-yellow-600 group-hover:text-yellow-500' : 'text-zinc-700 group-hover:text-zinc-500'
                }`} />
              )}
            </button>
          );
        })}
      </div>

      {/* Нет кнопки выйти — она в настройках */}
    </motion.div>
  );

  // ======= PROFILE VIEW =======
  // Используем единый UserProfile компонент с isSelf=true
  const renderProfile = () => (
    <motion.div key="profile" className="relative z-[1] flex flex-col h-full min-h-0" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      {user && (
        <UserProfile
          userId={user.id}
          isSelf={true}
          onClose={() => changeView('main')}
          embedded={true}
        />
      )}
    </motion.div>
  );
  // ======= SETTINGS VIEW =======
  const renderSettings = () => (
    <motion.div key="settings" className="relative z-[1] flex flex-col h-full min-h-0" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.08] flex-shrink-0">
        <button onClick={() => changeView('main')} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('settings')}</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{t('language')}</h4>
          <div className="space-y-1">
            <button
              onClick={() => setLang('ru')}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${lang === 'ru' ? 'bg-nexo-500/15 ring-1 ring-nexo-500/30' : 'bg-surface-tertiary/50 hover:bg-surface-hover'}`}
            >
              <span className="text-lg">🇷🇺</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Русский</p>
              </div>
              {lang === 'ru' && <Check size={16} className="text-nexo-400" />}
            </button>
            <button
              onClick={() => setLang('en')}
              className={`w-full flex items-center gap-4 px-3 py-3 rounded-xl transition-colors ${lang === 'en' ? 'bg-nexo-500/15 ring-1 ring-nexo-500/30' : 'bg-surface-tertiary/50 hover:bg-surface-hover'}`}
            >
              <span className="text-lg">🇬🇧</span>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">English</p>
              </div>
              {lang === 'en' && <Check size={16} className="text-nexo-400" />}
            </button>
          </div>
        </div>
        {/* Кастомизация - ThemeSettings */}
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Palette size={14} />
            Кастомизация
          </h4>
          <ThemeSettings />
        </div>
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{t('privacy')}</h4>
          <div className="space-y-1">
            <button
              onClick={async () => {
                const newVal = !user?.hideStoryViews;
                try {
                  await api.updateSettings({ hideStoryViews: newVal });
                  updateUser({ hideStoryViews: newVal });
                } catch {}
              }}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <Eye size={18} className="text-zinc-400 flex-shrink-0" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">{t('hideStoryViews')}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">{t('hideStoryViewsDesc')}</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${user?.hideStoryViews ? 'bg-nexo-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${user?.hideStoryViews ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>
        </div>
        {/* Push Notifications Settings */}
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Bell size={14} />
            Push уведомления
          </h4>
          <div className="space-y-1">
            {/* All Notifications */}
            <button
              onClick={() => updateNotificationSetting('notifyAll', !notificationSettings.notifyAll)}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <Bell size={18} className={`flex-shrink-0 ${notificationSettings.notifyAll ? 'text-nexo-400' : 'text-zinc-400'}`} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Все уведомления</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Включить/выключить всё</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${notificationSettings.notifyAll ? 'bg-nexo-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationSettings.notifyAll ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {/* Messages */}
            <button
              onClick={() => updateNotificationSetting('notifyMessages', !notificationSettings.notifyMessages)}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <MessageSquare size={18} className={`flex-shrink-0 ${notificationSettings.notifyMessages ? 'text-emerald-400' : 'text-zinc-400'}`} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Сообщения</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Новые сообщения</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${notificationSettings.notifyMessages ? 'bg-emerald-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationSettings.notifyMessages ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {/* Friends */}
            <button
              onClick={() => updateNotificationSetting('notifyFriends', !notificationSettings.notifyFriends)}
              className="w-full flex items-center gap-4 px-3 py-3 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] transition-all"
            >
              <UserPlus size={18} className={`flex-shrink-0 ${notificationSettings.notifyFriends ? 'text-purple-400' : 'text-zinc-400'}`} />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-zinc-200">Друзья</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Запросы в друзья</p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-0.5 ${notificationSettings.notifyFriends ? 'bg-purple-500' : 'bg-zinc-600'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform ${notificationSettings.notifyFriends ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>
          </div>
          <p className="text-[10px] text-zinc-600 mt-2 px-2">
            💡 Уведомления приходят даже когда браузер закрыт
          </p>
        </div>
        {/* Devices */}
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <Monitor size={14} />
            Устройства
          </h4>
          <button
            onClick={() => setShowDevices(true)}
            className="w-full flex items-center gap-4 px-3 py-3 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] transition-all"
          >
            <Monitor size={18} className="text-nexo-400" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm text-zinc-200">Активные сессии</p>
              <p className="text-[11px] text-zinc-500 mt-0.5">Управление устройствами и сессиями</p>
            </div>
            <ChevronRight size={16} className="text-zinc-500" />
          </button>
        </div>
        <div className="px-5 py-3">
          <h4 className="text-xs text-zinc-500 uppercase tracking-wide mb-3">{t('about')}</h4>
          <div className="flex items-center gap-4 px-3 py-3 rounded-xl liquid-glass-subtle border border-white/[0.06]">
            <Info size={18} className="text-zinc-400" />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-200">Нексо</p>
              <p className="text-xs text-zinc-500">{t('version')} 1.3.0</p>
            </div>
          </div>
        </div>

        {/* Выйти из аккаунта */}
        <div className="px-5 py-3 pb-6">
          <div className="h-px bg-white/[0.08] mb-4" />
          {!showLogoutConfirm ? (
            <button
              onClick={() => setShowLogoutConfirm(true)}
              className="group w-full flex items-center gap-4 px-3 py-3 rounded-xl bg-red-500/[0.06] hover:bg-red-500/[0.12] border border-red-500/[0.1] hover:border-red-500/[0.2] transition-all"
            >
              <LogOut size={18} className="text-red-400/70 group-hover:text-red-400 transition-colors" />
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm text-red-400/70 group-hover:text-red-400 transition-colors">{t('logout')}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">Выйти из текущего аккаунта</p>
              </div>
            </button>
          ) : (
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 space-y-3">
              <p className="text-sm text-white font-medium">Выйти из аккаунта?</p>
              <p className="text-xs text-zinc-400">Вы будете перенаправлены на страницу входа</p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-sm text-zinc-400 transition-all"
                >
                  Отмена
                </button>
                <button
                  onClick={handleLogout}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm text-white font-medium transition-all"
                >
                  Выйти
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
  const renderFriends = () => (
    <motion.div key="friends" className="relative z-[1] flex flex-col h-full min-h-0" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.08] flex-shrink-0">
        <button onClick={() => { changeView('main'); setFriendSearch(''); setFriendSearchResults([]); }} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('friends')}</h3>
      </div>

      <div className="px-4 pt-3 pb-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder={t('searchFriends')}
            value={friendSearch}
            onChange={(e) => setFriendSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm text-white placeholder-zinc-500 liquid-glass-input border border-white/[0.06] focus:border-nexo-500/50 focus:bg-white/[0.06] transition-all"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {friendsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : (
          <>
            {friendSearch.trim().length > 0 && (
              <div className="px-4 pt-2 pb-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  <Search size={12} className="inline mr-1" />{t('searchFriends').split('(')[0].trim()}
                </h4>
                {(() => {
                  const raw = friendSearch.trim();
                  const q = raw.startsWith('@') ? raw.slice(1) : raw;
                  if (q.length < 3) {
                    return <p className="text-xs text-zinc-500 text-center py-3">{t('minCharsHint')}</p>;
                  }
                  if (friendSearchLoading) {
                    return (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 size={18} className="animate-spin text-zinc-400" />
                      </div>
                    );
                  }
                  if (friendSearchResults.length === 0) {
                    return <p className="text-xs text-zinc-500 text-center py-3">{t('noSearchResults')}</p>;
                  }
                  return (
                    <div className="space-y-1">
                      {friendSearchResults.map((u) => (
                        <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl liquid-glass-subtle border border-white/[0.06]">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                              {(u.displayName || u.username || '?')[0].toUpperCase()}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{u.displayName || u.username}</p>
                            <p className="text-xs text-zinc-500">@{u.username}</p>
                          </div>
                          <button
                            onClick={() => handleSendFriendRequest(u.id)}
                            className="p-2 rounded-lg bg-nexo-500/20 text-nexo-400 hover:bg-nexo-500/30 transition-colors"
                            title={t('addFriend')}
                          >
                            <UserPlus size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            )}

              {friendRequests.length > 0 && (
              <div className="px-4 pt-4 pb-2">
                <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                  {t('friendRequests')} ({friendRequests.length})
                </h4>
                <div className="space-y-2">
                  {friendRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-3 p-3 rounded-xl liquid-glass-subtle border border-white/[0.06]">
                      {req.sender?.avatar ? (
                        <img src={req.sender.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                          {(req.sender?.displayName || req.sender?.username || '?')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{req.sender?.displayName || req.sender?.username}</p>
                        <p className="text-xs text-zinc-500">@{req.sender?.username}</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAcceptFriend(req.id)}
                          className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                          title={t('accept')}
                        >
                          <UserCheck size={16} />
                        </button>
                        <button
                          onClick={() => handleDeclineRequest(req.id)}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                          title={t('decline')}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

              <div className="px-4 pt-4 pb-2">
              <h4 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                {t('friendsList')} ({friends.length})
              </h4>
              {friends.length === 0 ? (
                <p className="text-sm text-zinc-500 text-center py-8">{t('noFriends')}</p>
              ) : (
                <div className="space-y-1">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/[0.04] transition-all group/friend">
                      <div className="relative">
                        {friend.avatar ? (
                           <img src={friend.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                         ) : (
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white font-bold text-sm">
                             {(friend.displayName || friend.username || '?')[0].toUpperCase()}
                          </div>
                        )}
                        {friend.isOnline && (
                          <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-surface-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">{friend.displayName || friend.username}</p>
                        <p className="text-xs text-zinc-500">
                          {friend.isOnline ? t('online') : `@${friend.username}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveFriend(friend.friendshipId)}
                        className="p-2 rounded-lg text-zinc-600 opacity-0 group-hover/friend:opacity-100 hover:bg-red-500/20 hover:text-red-400 transition-all"
                        title={t('removeFriend')}
                      >
                        <UserMinus size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
  const renderCalls = () => (
    <motion.div key="calls" className="relative z-[1] flex flex-col h-full min-h-0" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.08] flex-shrink-0">
        <button onClick={() => changeView('main')} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">Звонки</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {callsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-zinc-400" />
          </div>
        ) : callHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
              <Phone size={28} className="text-zinc-600" />
            </div>
            <p className="text-sm text-zinc-500">Нет звонков</p>
            <p className="text-xs text-zinc-600 mt-1">История звонков появится здесь</p>
          </div>
        ) : (
          <div className="px-3 py-2 space-y-0.5">
            {callHistory.map((call) => {
              const isOutgoing = call.callerId === user?.id;
              const other = isOutgoing ? call.callee : call.caller;
              const isMissed = call.status === 'missed';
              const isDeclined = call.status === 'declined';
              const isVideo = call.type === 'video';
              const duration = call.duration || 0;
              const mins = Math.floor(duration / 60);
              const secs = duration % 60;
              const durationStr = duration > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : '';
              const date = new Date(call.createdAt);
              const now = new Date();
              const isToday = date.toDateString() === now.toDateString();
              const isYesterday = new Date(now.getTime() - 86400000).toDateString() === date.toDateString();
              const dateStr = isToday ? 'Сегодня' : isYesterday ? 'Вчера' : date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
              const timeStr = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

              return (
                <div key={call.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-all group">
                  <div className="relative flex-shrink-0">
                    {other?.avatar ? (
                       <img src={other.avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                     ) : (
                       <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                         {(other?.displayName || other?.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-sm font-medium truncate ${isMissed ? 'text-red-400' : 'text-white'}`}>
                        {other?.displayName || other?.username || 'Неизвестный'}
                      </p>
                      {isVideo && <Video size={12} className="text-zinc-500 flex-shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[11px] ${isMissed ? 'text-red-400/70' : isDeclined ? 'text-amber-400/70' : 'text-zinc-500'}`}>
                        {isOutgoing ? 'Исходящий' : 'Входящий'}
                        {isMissed && ' (пропущенный)'}
                        {isDeclined && ' (отклонённый)'}
                      </span>
                      {durationStr && <span className="text-[11px] text-zinc-600">· {durationStr}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[11px] text-zinc-600">{timeStr}</p>
                    <p className="text-[10px] text-zinc-700">{dateStr}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
  const renderAbout = () => (
    <motion.div key="about" className="relative z-[1] flex flex-col h-full min-h-0" initial={{ x: 100, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 100, opacity: 0 }} transition={{ duration: 0.2 }}>
      <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.08] flex-shrink-0">
        <button onClick={() => changeView('main')} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
          <ArrowLeft size={20} />
        </button>
        <h3 className="text-sm font-semibold text-white flex-1">{t('aboutApp')}</h3>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <img src="/logo.png" alt="Нексо" className="w-20 h-20 rounded-2xl object-cover mb-4 ring-2 ring-white/10" />
        <h2 className="text-xl font-bold gradient-text mb-1">Нексо</h2>
        <p className="text-sm text-zinc-400 mb-6">{t('version')} 1.3.0</p>
        <div className="text-xs text-zinc-500 space-y-1">
          <p>{t('modernMessenger')}</p>
          <p>{t('onPrivacy')}</p>
          <p className="mt-4 text-zinc-600">© 2026 Dark Heavens Corporate</p>
        </div>
        {/* Legal links */}
        <div className="mt-8 space-y-2 w-full">
          <button
            onClick={() => setLegalPage('terms')}
            className="w-full py-2.5 px-4 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] text-zinc-400 hover:text-white text-sm transition-all"
          >
            📄 Пользовательское соглашение
          </button>
          <button
            onClick={() => setLegalPage('privacy')}
            className="w-full py-2.5 px-4 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] text-zinc-400 hover:text-white text-sm transition-all"
          >
            🔒 Политика конфиденциальности
          </button>
          <button
            onClick={() => window.open('/yookassainfo', '_blank')}
            className="w-full py-2.5 px-4 rounded-xl liquid-glass-subtle hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] text-zinc-400 hover:text-white text-sm transition-all"
          >
            💳 Пополнение через YooKassa
          </button>
        </div>
      </div>
    </motion.div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/40 backdrop-blur-sm sm:bg-black/50 sm:backdrop-blur-md z-50" onClick={onClose} />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-[68px] sm:inset-auto sm:left-3 sm:top-3 sm:bottom-3 sm:w-[340px] sm:max-w-[calc(100vw-24px)] z-50 flex flex-col overflow-hidden rounded-t-[32px] sm:rounded-3xl max-h-[calc(85vh-68px)] sm:max-h-[calc(100vh-24px)]"
          >
            {/* Glass panel background */}
            <div className="absolute inset-0 sm:hidden bg-[rgba(11,19,38,0.6)] backdrop-blur-[40px] border border-white/[0.1] rounded-t-[32px]" />
            {/* Gradient border glow */}
            <div className="absolute -inset-px rounded-t-[32px] sm:rounded-3xl bg-white/[0.06] pointer-events-none opacity-50 blur-sm" />
            <div className="absolute -inset-px rounded-t-[32px] sm:rounded-3xl bg-white/[0.04] pointer-events-none" />
            {/* Liquid glass background layers */}
            <div className="absolute inset-0 liquid-glass-strong rounded-t-[32px] sm:rounded-3xl" />
            <div className="absolute inset-0 bg-white/[0.02] pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/8 to-transparent pointer-events-none" />
            <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent pointer-events-none" />
            <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-white/10 via-white/5 to-transparent pointer-events-none" />
            {/* Grabber handle - mobile only */}
            <div className="relative flex justify-center pt-3 pb-1 sm:hidden flex-shrink-0">
              <div className="w-12 h-1.5 bg-white/20 rounded-full" />
            </div>
            <AnimatePresence custom={slideDir} initial={false}>
              {view === 'main' && renderMain()}
              {view === 'profile' && renderProfile()}
              {view === 'settings' && renderSettings()}
              {view === 'friends' && renderFriends()}
              {view === 'calls' && renderCalls()}
              {view === 'about' && renderAbout()}
              {view === 'premium' && (
                <div className="h-full">
                  <PremiumPage onClose={() => changeView('main')} />
                </div>
              )}
              {view === 'statistics' && (
                <div className="h-full overflow-hidden">
                  <div className="h-14 flex items-center gap-3 px-4 border-b border-white/[0.08] flex-shrink-0">
                    <button onClick={() => changeView('main')} className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
                      <ArrowLeft size={20} />
                    </button>
                    <h3 className="text-sm font-semibold text-white flex-1">Статистика</h3>
                  </div>
                  <div className="h-[calc(100%-3.5rem)] overflow-y-auto">
                    <StatisticsPage />
                  </div>
                </div>
              )}
                                                        {view === 'cloud' && (
                <div className="h-full flex flex-col">
                  <CloudStorageModal onClose={() => changeView('main')} embedded={true} />
                </div>
              )}
              {view === 'badges' && (
                <div className="h-full flex flex-col">
                  <BadgesModal onClose={() => changeView('main')} isSelf={true} embedded={true} />
                </div>
              )}
              {view === 'playlists' && (
                <div className="h-full flex flex-col">
                  <MusicPlaylistsModal onClose={() => changeView('main')} />
                </div>
              )}
              {view === 'fake_password' && (
                <div className="h-full flex flex-col">
                  <FakePasswordModal onClose={() => changeView('main')} embedded={true} />
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}

      {/* Devices Tab */}
      <AnimatePresence>
        {showDevices && (
          <div className="fixed inset-0 z-[60]">
            <DevicesTab onClose={() => setShowDevices(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Legal Page */}
      <AnimatePresence>
        {legalPage && (
          <div className="fixed inset-0 z-[70]">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setLegalPage(null)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute right-0 top-0 bottom-0 w-full max-w-lg overflow-hidden"
            >
              {/* Liquid glass background */}
              <div className="absolute inset-0 bg-gradient-to-br from-[rgba(18,18,24,0.95)] via-[rgba(12,12,18,0.98)] to-[rgba(20,20,28,0.96)] backdrop-blur-3xl backdrop-saturate-150" />
              <div className="absolute top-0 left-0 bottom-0 w-px bg-gradient-to-b from-white/15 via-white/8 to-transparent pointer-events-none" />
              <div className="relative z-10 h-full">
                <LegalPage type={legalPage} onClose={() => setLegalPage(null)} />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Emoji */}
      <AnimatePresence>
        {showCustomEmoji && (
          <CustomEmojiPicker
            onSelect={(emoji) => {
              navigator.clipboard.writeText(`:${emoji.shortcode}:`).catch(() => {});
              setShowCustomEmoji(false);
            }}
            onClose={() => setShowCustomEmoji(false)}
          />
        )}
      </AnimatePresence>

    </AnimatePresence>
  );
}
