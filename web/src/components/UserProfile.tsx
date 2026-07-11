import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  MoreVertical,
  MessageSquare,
  Phone,
  Video,
  Star,
  Camera,
  X,
  AtSign,
  Edit3,
  Check,
  Loader2,
  Image as ImageIcon,
  FileText,
  Link as LinkIcon,
  Download,
  ExternalLink,
  Play,
  UserPlus,
  UserMinus,
  UserCheck,
  Clock,
  PhoneIncoming,
  PhoneOutgoing,
  PhoneMissed,
  Pin,
  Hash,
  Lock,
  Music,
  Crown,
  Newspaper,
  QrCode,
  Users,
  Share2,
  BellOff,
  Trash2,
  Ban,
  Search,
  Upload,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import { User, Message, FriendshipStatus, Chat } from '../lib/types';
import ImageLightbox from './ImageLightbox';
import { getSocket } from '../lib/socket';
import PinChannelModal from './PinChannelModal';
import { SecretChatModal } from './SecretChatModal';
import { useToastStore } from '../stores/toastStore';
import ProfileMusic from './ProfileMusic';
import PremiumBadgeUpload from './PremiumBadgeUpload';
import VerifiedBadge from './VerifiedBadge';
import QRCodeModal from './QRCodeModal';
import ShareProfileModal from './ShareProfileModal';

interface UserProfileProps {
  userId: string;
  chatId?: string;
  onClose: () => void;
  isSelf?: boolean;
  embedded?: boolean;
}

type MediaTab = 'media' | 'files' | 'links';
type ProfileTab = MediaTab | 'calls' | 'music' | 'nft_gifts' | 'nft_tags' | 'hashtags';

export default function UserProfile({ userId, chatId, onClose, isSelf, embedded }: UserProfileProps) {
  const { user: authUser, updateUser } = useAuthStore();
  const isPremium = useAuthStore(state => state.isPremium());
  const { t, lang } = useLang();
  const { success, error: showError } = useToastStore();
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ProfileTab>('media');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editData, setEditData] = useState({ displayName: '', bio: '', username: '' });
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState<{ text: string; emoji?: string; expiresAt?: string } | null>(null);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [statusEmoji, setStatusEmoji] = useState('');
  const [statusExpires, setStatusExpires] = useState('24');

  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [activeMusicTrackIndex, setActiveMusicTrackIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [sharedMedia, setSharedMedia] = useState<Message[]>([]);
  const [sharedFiles, setSharedFiles] = useState<Message[]>([]);
  const [sharedLinks, setSharedLinks] = useState<Array<Message & { links?: string[] }>>([]);
  const [callHistory, setCallHistory] = useState<Array<{
    id: string;
    type: 'voice' | 'video';
    status: 'completed' | 'missed' | 'declined' | 'failed';
    duration: number;
    createdAt: string;
    isIncoming: boolean;
  }>>([]);
  const [tabLoading, setTabLoading] = useState(false);
  const [loadedTabs, setLoadedTabs] = useState<Set<ProfileTab>>(new Set());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const [friendStatus, setFriendStatus] = useState<FriendshipStatus | null>(null);
  const [friendLoading, setFriendLoading] = useState(false);

  const [showPinModal, setShowPinModal] = useState(false);
  const [showSecretChatModal, setShowSecretChatModal] = useState(false);

  const [isOpeningChat, setIsOpeningChat] = useState(false);
  const openingChatRef = useRef(false);

  const [equippedNFTCard, setEquippedNFTCard] = useState<any>(null);
  const [equippedNFTTags, setEquippedNFTTags] = useState<any[]>([]);
  const [profileNFTCards, setProfileNFTCards] = useState<any[]>([]);
  const [profileNFTTags, setProfileNFTTags] = useState<any[]>([]);

  const [showQRCode, setShowQRCode] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const [showAvatarFullscreen, setShowAvatarFullscreen] = useState(false);

  const [userHashtags, setUserHashtags] = useState<Array<{
    id: string;
    tag: string;
    useCount: number;
    ownerUseCount: number;
    createdAt: string;
  }>>([]);

  useEffect(() => {
    loadProfile();
    loadStatus();
    if (!isSelf) {
      api.getFriendshipStatus(userId).then(setFriendStatus).catch(() => {});
    }
  }, [userId]);

  useEffect(() => {
    api.get<{ card: any; tags: any[] }>(`/nft/equipped/${userId}`).then((data) => {
      setEquippedNFTCard(data?.card?.card || null);
      setEquippedNFTTags(data?.tags || []);
    }).catch(() => {});
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'nft_gifts' || activeTab === 'nft_tags') {
      api.get<{ cards: any[]; tags: any[] }>('/nft/inventory').then((data) => {
        setProfileNFTCards(data?.cards || []);
        setProfileNFTTags(data?.tags || []);
      }).catch(() => {});
    }
  }, [activeTab, userId, isSelf]);

  useEffect(() => {
    if (profile && isEditingProfile) {
      setEditData({
        displayName: profile.displayName || '',
        bio: profile.bio || '',
        username: profile.username || '',
      });
    }
  }, [profile, isEditingProfile]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    if (showProfileMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showProfileMenu]);

  const loadTabData = useCallback(async (tab: ProfileTab) => {
    if (loadedTabs.has(tab)) return;
    setTabLoading(true);
    try {
      if (tab === 'calls') {
        if (!chatId) return;
        const allCalls = await api.getCallHistory(100);
        const userCalls = allCalls.filter(c =>
          c.callerId === userId || c.calleeId === userId
        ).map(c => ({
          id: c.id,
          type: c.type as 'voice' | 'video',
          status: c.status,
          duration: c.duration,
          createdAt: c.createdAt,
          isIncoming: c.calleeId === userId,
        }));
        setCallHistory(userCalls);
      } else if (tab === 'hashtags') {
        const hashtags = await api.get('/wall/hashtags/owned');
        setUserHashtags(hashtags);
      } else if (chatId) {
        const data = await api.getSharedMedia(chatId, tab as MediaTab);
        if (tab === 'media') setSharedMedia(data);
        else if (tab === 'files') setSharedFiles(data);
        else setSharedLinks(data);
      }
      setLoadedTabs(prev => new Set(prev).add(tab));
    } catch (e) {
      console.error('Failed to load shared', tab, e);
    } finally {
      setTabLoading(false);
    }
  }, [chatId, loadedTabs, userId]);

  useEffect(() => {
    loadTabData(activeTab);
  }, [activeTab, loadTabData]);

  const loadProfile = async () => {
    try {
      setIsLoading(true);
      if (isSelf && authUser) {
        setProfile(authUser);
      } else {
        const data = await api.getUser(userId);
        setProfile(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setIsSavingProfile(true);
      const updated = await api.updateProfile(editData);
      setProfile(updated);
      if (isSelf && updateUser) {
        updateUser(updated);
      }
      setIsEditingProfile(false);
    } catch (e) {
      console.error('Failed to update profile:', e);
      showError(e instanceof Error ? e.message : 'Ошибка сохранения');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleAvatarUploadInEdit = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const updated = await api.uploadAvatar(file);
      setProfile(prev => prev ? { ...prev, avatar: updated.avatar } : prev);
      if (isSelf && updateUser) updateUser({ avatar: updated.avatar });
    } catch (err) {
      console.error('Avatar upload failed:', err);
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const loadStatus = async () => {
    try {
      const data = await api.get(`/status/${userId}`);
      setStatus(data);
    } catch (e) {
      console.error('Failed to load status:', e);
    }
  };

  const handleSaveStatus = async () => {
    if (!statusText.trim()) {
      showError('Введите текст статуса');
      return;
    }
    try {
      const data = await api.post('/status', {
        text: statusText.trim(),
        emoji: statusEmoji || null,
        expiresIn: statusExpires ? parseInt(statusExpires) : null
      });
      setStatus(data);
      setIsEditingStatus(false);
      success('Статус обновлён');
    } catch (e) {
      console.error('Failed to save status:', e);
      showError(e instanceof Error ? e.message : 'Ошибка сохранения статуса');
    }
  };

  const handleDeleteStatus = async () => {
    try {
      await api.delete('/status');
      setStatus(null);
      setIsEditingStatus(false);
      success('Статус удалён');
    } catch (e) {
      console.error('Failed to delete status:', e);
      showError(e instanceof Error ? e.message : 'Ошибка удаления статуса');
    }
  };

  const startEditingStatus = () => {
    setStatusText(status?.text || '');
    setStatusEmoji(status?.emoji || '');
    setStatusExpires('24');
    setIsEditingStatus(true);
  };

  const handleSendFriendRequest = async () => {
    try {
      setFriendLoading(true);
      const result = await api.sendFriendRequest(userId);
      if (result.status === 'accepted') {
        setFriendStatus({ status: 'accepted' } as FriendshipStatus);
      } else {
        setFriendStatus({ status: 'pending', direction: 'outgoing' } as FriendshipStatus);
      }
      const socket = getSocket();
      if (socket) socket.emit('friend_request', { friendId: userId });
    } catch (e) {
      console.error(e);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleAcceptFriend = async () => {
    if (!friendStatus?.friendshipId) return;
    try {
      setFriendLoading(true);
      await api.acceptFriendRequest(friendStatus.friendshipId);
      setFriendStatus({ status: 'accepted', friendshipId: friendStatus.friendshipId });
      const socket = getSocket();
      if (socket) socket.emit('friend_accepted', { friendId: userId });
    } catch (e) {
      console.error(e);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleRemoveFriend = async () => {
    if (!friendStatus?.friendshipId) return;
    try {
      setFriendLoading(true);
      await api.removeFriend(friendStatus.friendshipId);
      setFriendStatus({ status: 'none' } as FriendshipStatus);
      const socket = getSocket();
      if (socket) socket.emit('friend_removed', { friendId: userId });
    } catch (e) {
      console.error(e);
    } finally {
      setFriendLoading(false);
    }
  };

  const handleOpenChat = async () => {
    if (openingChatRef.current) return;
    openingChatRef.current = true;
    setIsOpeningChat(true);
    try {
      const store = useChatStore.getState();
      const currentChats = store.chats;
      const existingChat = currentChats.find(c =>
        c.type === 'personal' && c.members.some(m => m.user.id === userId)
      );
      if (existingChat) {
        store.setActiveChat(existingChat.id);
        store.loadMessages(existingChat.id);
      } else {
        await new Promise(resolve => setTimeout(resolve, 100));
        const refreshedChats = useChatStore.getState().chats;
        const stillExisting = refreshedChats.find(c =>
          c.type === 'personal' && c.members.some(m => m.user.id === userId)
        );
        if (stillExisting) {
          useChatStore.getState().setActiveChat(stillExisting.id);
          useChatStore.getState().loadMessages(stillExisting.id);
        } else {
          const chat = await api.createPersonalChat(userId);
          useChatStore.getState().addChat(chat);
          useChatStore.getState().setActiveChat(chat.id);
          useChatStore.getState().loadMessages(chat.id);
        }
      }
      onClose();
    } catch (e) {
      console.error('Failed to open chat:', e);
    } finally {
      openingChatRef.current = false;
      setIsOpeningChat(false);
    }
  };

  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const tabs: { key: ProfileTab; label: string; icon: React.ElementType }[] = [
    { key: 'media', label: t('mediaTab'), icon: ImageIcon },
    { key: 'files', label: t('filesTab'), icon: FileText },
    { key: 'links', label: t('linksTab'), icon: LinkIcon },
    { key: 'calls', label: (t('callsTab') as string) || 'Звонки', icon: PhoneIncoming },
    { key: 'music', label: 'Music', icon: Music },
    { key: 'nft_gifts', label: 'Подарки', icon: Crown },
    { key: 'nft_tags', label: 'Теги', icon: Hash },
    ...(isSelf ? [{ key: 'hashtags' as ProfileTab, label: 'Хэштеги', icon: Hash }] : []),
  ];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f]">
        <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a0a0f] text-zinc-500">
        {t('profileNotFound')}
      </div>
    );
  }

  const profileBody = (
    <div className="flex flex-col h-full bg-[#0a0a0f]/95 backdrop-blur-xl">
      {/* ===== HEADER — Messenger style ===== */}
      <div className="flex-shrink-0 relative">
        <div className="flex items-center gap-1 px-1 py-[7px]">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors -ml-1"
          >
            <ArrowLeft size={22} className="text-white" />
          </motion.button>

          <div className="flex-1 min-w-0 px-1">
            <h1 className="text-[17px] font-semibold text-white truncate leading-tight">
              {profile.displayName || profile.username}
            </h1>
          </div>

          <div className="flex items-center gap-0" ref={profileMenuRef}>
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/[0.06] active:bg-white/[0.1] transition-colors"
            >
              <MoreVertical size={22} className="text-nexo-400" />
            </motion.button>
            <AnimatePresence>
              {showProfileMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-56 rounded-2xl bg-[#09090b]/95 backdrop-blur-2xl shadow-2xl z-50 py-1.5 ring-1 ring-white/10 overflow-hidden"
                >
                  {isSelf ? (
                    <>
                      <button
                        onClick={() => { setIsEditingProfile(true); setShowProfileMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <Edit3 size={16} />
                        Редактировать профиль
                      </button>
                      <button
                        onClick={() => { setShowQRCode(true); setShowProfileMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <QrCode size={16} />
                        QR-код
                      </button>
                      <button
                        onClick={() => { setShowShareModal(true); setShowProfileMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <Share2 size={16} />
                        Поделиться профилем
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { setShowProfileMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <Search size={16} />
                        Поиск
                      </button>
                      <button
                        onClick={() => { setShowProfileMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] hover:text-white transition-colors"
                      >
                        <BellOff size={16} />
                        Отключить уведомления
                      </button>
                      <div className="border-t border-white/10 mx-3 my-1" />
                      <button
                        onClick={() => { setShowProfileMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <Ban size={16} />
                        Заблокировать
                      </button>
                      <button
                        onClick={() => { setShowProfileMenu(false); }}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <Trash2 size={16} />
                        Удалить чат
                      </button>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="h-px bg-white/[0.06]" />
      </div>

      {/* ===== SCROLLABLE CONTENT ===== */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden pb-24 sm:pb-8">
        {/* ===== AVATAR ===== */}
        <div className="flex flex-col items-center pt-6 pb-3 px-6 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] h-[200px] bg-nexo-500/5 rounded-full blur-[60px] pointer-events-none" />

          <motion.div
            whileTap={{ scale: 0.97 }}
            onClick={() => {
              if (isSelf) avatarInputRef.current?.click();
              else if (profile.avatar) setShowAvatarFullscreen(true);
            }}
            className="relative cursor-pointer"
          >
            {isPremium && (
              <div className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-yellow-400 via-orange-500 to-yellow-600 opacity-70 blur-[2px] animate-[spin_6s_linear_infinite]" />
            )}

            <div className={`relative w-[120px] h-[120px] rounded-full overflow-hidden ${isPremium ? 'ring-[3px] ring-yellow-400/60' : 'ring-[2px] ring-white/10'}`}>
              {profile.avatar ? (
                <img
                  src={profile.avatar}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-white/10 flex items-center justify-center">
                  <span className="text-[42px] font-bold text-white/80">
                    {(profile.displayName || profile.username || '??').charAt(0).toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {profile.isOnline && !isSelf && (
              <div className="absolute bottom-1 right-1 w-[22px] h-[22px] rounded-full bg-[#0a0a0f] flex items-center justify-center">
                <div className="w-[16px] h-[16px] rounded-full bg-[#4dcd5e]" />
              </div>
            )}

            {isSelf && (
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-nexo-500 flex items-center justify-center shadow-lg shadow-nexo-500/30 border-[3px] border-[#0a0a0f]"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={16} className="text-white" />
              </motion.button>
            )}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUploadInEdit}
              disabled={avatarUploading}
            />
          </motion.div>

          {/* Name */}
          <div className="flex items-center gap-1.5 mt-4">
            <h2 className="text-[22px] font-bold text-white text-center leading-tight">
              {profile.displayName || profile.username}
            </h2>
            {profile.isVerified && (
              <span className="flex-shrink-0 inline-flex items-center justify-center">
                <VerifiedBadge
                  size="md"
                  verifiedBadgeUrl={profile.verifiedBadgeUrl}
                  verifiedBadgeType={profile.verifiedBadgeType}
                />
              </span>
            )}
            {isPremium && (
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                <Star size={11} className="text-white fill-white" />
              </div>
            )}
          </div>

          {/* Username — click to copy */}
          {profile.username && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(`@${profile.username}`);
                success('Скопировано');
              }}
              className="text-[15px] text-nexo-400 mt-0.5 hover:underline transition-colors"
            >
              @{profile.username}
            </button>
          )}

          {/* Status */}
          <p className={`text-[14px] mt-1 ${profile.isOnline ? 'text-nexo-400/70' : 'text-zinc-500'}`}>
            {profile.isOnline
              ? 'в сети'
              : t('wasRecently')}
          </p>

          {/* Action Buttons — Telegram style pill buttons */}
          {!isSelf && (
            <div className="flex items-center gap-2.5 mt-5 w-full justify-center">
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleOpenChat}
                disabled={isOpeningChat}
                className="flex items-center gap-2 px-5 py-[9px] rounded-full bg-nexo-500 hover:bg-nexo-600 active:bg-nexo-700 transition-colors shadow-lg shadow-nexo-500/20"
              >
                {isOpeningChat ? (
                  <Loader2 size={17} className="text-white animate-spin" />
                ) : (
                  <MessageSquare size={17} className="text-white" strokeWidth={2} />
                )}
                <span className="text-[14px] font-medium text-white">{t('sendMessage') || 'Написать'}</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSecretChatModal(true)}
                className="flex items-center gap-2 px-5 py-[9px] rounded-full bg-white/[0.06] hover:bg-white/[0.1] active:bg-[#243545] border border-white/[0.08] transition-colors"
              >
                <Lock size={17} className="text-nexo-400" strokeWidth={2} />
                <span className="text-[14px] font-medium text-nexo-400">Секретный чат</span>
              </motion.button>
            </div>
          )}

          {/* Friend Buttons */}
          {!isSelf && friendStatus && (
            <div className="mt-3 w-full max-w-[320px] mx-auto">
              {friendStatus.status === 'none' && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSendFriendRequest}
                  disabled={friendLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-[9px] rounded-full bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-nexo-400 transition-all text-[14px] font-medium"
                >
                  {friendLoading ? <Loader2 size={17} className="animate-spin" /> : <UserPlus size={17} />}
                  {t('addFriend')}
                </motion.button>
              )}
              {friendStatus.status === 'pending' && friendStatus.direction === 'outgoing' && (
                <div className="flex items-center justify-center gap-2 px-5 py-[9px] rounded-full bg-white/[0.06] border border-white/[0.08] text-zinc-500 text-[14px] font-medium">
                  <Clock size={16} />
                  {t('requestSent')}
                </div>
              )}
              {friendStatus.status === 'pending' && friendStatus.direction === 'incoming' && (
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleAcceptFriend}
                    disabled={friendLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-[9px] rounded-full bg-[#2b5278] hover:bg-[#346594] text-nexo-400 transition-all text-[14px] font-medium"
                  >
                    {friendLoading ? <Loader2 size={17} className="animate-spin" /> : <UserCheck size={17} />}
                    {t('accept')}
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={handleRemoveFriend}
                    disabled={friendLoading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-[9px] rounded-full bg-[#3a2020] hover:bg-[#4a2828] text-[#e05555] transition-all text-[14px] font-medium"
                  >
                    {t('decline')}
                  </motion.button>
                </div>
              )}
              {friendStatus.status === 'accepted' && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRemoveFriend}
                  disabled={friendLoading}
                  className="w-full flex items-center justify-center gap-2 px-5 py-[9px] rounded-full bg-[#3a2020] hover:bg-[#4a2828] text-[#e05555] transition-all text-[14px] font-medium"
                >
                  {friendLoading ? <Loader2 size={17} className="animate-spin" /> : <UserMinus size={17} />}
                  {t('removeFriend')}
                </motion.button>
              )}
            </div>
          )}
        </div>

        {/* ===== INFO SECTIONS — Telegram style ===== */}
        <div className="mx-4 mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          {/* Bio */}
          <div className="w-full flex items-start gap-3.5 px-4 py-[11px] border-b border-white/[0.06]">
            <span className="text-zinc-500 mt-[2px] flex-shrink-0">
              <Edit3 size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] text-zinc-500 leading-tight">{t('aboutMe')}</p>
              <p className="text-[15px] text-white mt-0.5 break-words leading-snug">
                {profile.bio || <span className="text-zinc-500">{t('notSpecified')}</span>}
              </p>
            </div>
          </div>

          {/* Status */}
          <div className="w-full flex items-start gap-3.5 px-4 py-[11px] border-b border-white/[0.06]">
            <span className="text-zinc-500 mt-[2px] flex-shrink-0">
              <MessageSquare size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-zinc-500 leading-tight">Статус</p>
              {status ? (
                <div>
                  <p className="text-[15px] text-white mt-0.5 break-words leading-snug flex items-center gap-2">
                    {status.emoji && <span className="text-lg">{status.emoji}</span>}
                    <span>{status.text}</span>
                  </p>
                  {status.expiresAt && (
                    <p className="text-[12px] text-zinc-500 mt-1 flex items-center gap-1">
                      <Clock size={10} />
                      Истекает {new Date(status.expiresAt).toLocaleString('ru-RU', {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-[15px] text-zinc-500 mt-0.5">
                  {isSelf ? 'Установите статус' : 'Нет статуса'}
                </p>
              )}
            </div>
            {isSelf && (
              <button
                onClick={startEditingStatus}
                className="mt-[2px] flex-shrink-0 p-1 rounded-lg hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors"
              >
                <Edit3 size={16} />
              </button>
            )}
          </div>

          {/* Username */}
          {profile.username && (
            <div className="w-full flex items-start gap-3.5 px-4 py-[11px] border-b border-white/[0.06]">
              <span className="text-zinc-500 mt-[2px] flex-shrink-0">
                <AtSign size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-zinc-500 leading-tight">Username</p>
                <p className="text-[15px] text-nexo-400 mt-0.5">@{profile.username}</p>
              </div>
            </div>
          )}

          {/* Registered */}
          <div className="w-full flex items-start gap-3.5 px-4 py-[11px]">
            <span className="text-zinc-500 mt-[2px] flex-shrink-0">
              <Check size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] text-zinc-500 leading-tight">{t('onNexoSince')}</p>
              <p className="text-[15px] text-white mt-0.5">
                {new Date(profile.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                  day: 'numeric', month: 'long', year: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Verified */}
        {profile.isVerified && (
          <div className="mx-4 mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <div className="w-full flex items-start gap-3.5 px-4 py-[11px]">
              <span className="text-nexo-400 mt-[2px] flex-shrink-0">
                <Check size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-zinc-500 leading-tight">Верификация</p>
                <p className="text-[15px] text-nexo-400 mt-0.5">
                  {profile.verifiedAt
                    ? `Верифицирован ${new Date(profile.verifiedAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Аккаунт верифицирован'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Premium */}
        {profile.isPremium && (
          <div className="mx-4 mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <div className="w-full flex items-start gap-3.5 px-4 py-[11px]">
              <span className="text-yellow-400 mt-[2px] flex-shrink-0">
                <Star size={20} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] text-zinc-500 leading-tight">Подписка</p>
                <p className="text-[15px] text-yellow-400 mt-0.5">
                  {profile.premiumUntil
                    ? `Активна до ${new Date(profile.premiumUntil).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}`
                    : 'Активная подписка'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pinned Channel */}
        {profile.pinnedChannel && (
          <div className="mx-4 mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <a
              href={`/?channel=${encodeURIComponent(profile.pinnedChannel.username || '')}`}
              className="w-full flex items-center gap-3.5 px-4 py-[11px] hover:bg-white/[0.02] transition-colors"
            >
              {profile.pinnedChannel.avatar ? (
                <img src={profile.pinnedChannel.avatar} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-nexo-500/20 flex items-center justify-center flex-shrink-0">
                  <Hash size={18} className="text-nexo-400" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[14px] text-white font-medium truncate">{profile.pinnedChannel.name || profile.pinnedChannel.username}</p>
                <p className="text-[13px] text-zinc-500 truncate">{profile.pinnedChannel.description || `@${profile.pinnedChannel.username}`}</p>
              </div>
              <ExternalLink size={16} className="text-zinc-500 flex-shrink-0" />
            </a>
          </div>
        )}

        {/* Self profile buttons */}
        {isSelf && (
          <div className="mx-4 mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
            <button
              onClick={() => setIsEditingProfile(true)}
              className="w-full flex items-start gap-3.5 px-4 py-[11px] border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-zinc-500 mt-[2px] flex-shrink-0">
                <Edit3 size={20} />
              </span>
              <span className="text-[15px] text-nexo-400">Редактировать профиль</span>
            </button>
            <button
              onClick={() => setShowQRCode(true)}
              className="w-full flex items-start gap-3.5 px-4 py-[11px] border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-zinc-500 mt-[2px] flex-shrink-0">
                <QrCode size={20} />
              </span>
              <span className="text-[15px] text-nexo-400">QR-код</span>
            </button>
            <button
              onClick={() => setShowPinModal(true)}
              className="w-full flex items-start gap-3.5 px-4 py-[11px] border-b border-white/[0.06] hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-zinc-500 mt-[2px] flex-shrink-0">
                <Pin size={20} />
              </span>
              <span className="text-[15px] text-nexo-400">
                {profile.pinnedChannel ? 'Изменить закреплённый канал' : 'Прикрепить канал'}
              </span>
            </button>
            <button
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'audio/*';
                input.onchange = async (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (!file) return;
                  try {
                    const audioUrl = URL.createObjectURL(file);
                    const audio = new Audio(audioUrl);
                    const duration = await new Promise<number>((resolve) => {
                      audio.onloadedmetadata = () => {
                        resolve(Math.round(audio.duration));
                        URL.revokeObjectURL(audioUrl);
                      };
                      audio.onerror = () => {
                        resolve(0);
                        URL.revokeObjectURL(audioUrl);
                      };
                    });
                    if (duration <= 0) {
                      showError('Не удалось определить длительность');
                      return;
                    }
                    await api.uploadProfileMusic(file, duration);
                    success('Музыка загружена');
                    loadProfile();
                  } catch (err) {
                    showError(err instanceof Error ? err.message : 'Ошибка загрузки музыки');
                  }
                };
                input.click();
              }}
              className="w-full flex items-start gap-3.5 px-4 py-[11px] hover:bg-white/[0.02] transition-colors"
            >
              <span className="text-zinc-500 mt-[2px] flex-shrink-0">
                <Upload size={20} />
              </span>
              <span className="text-[15px] text-nexo-400">Прикрепить музыку</span>
            </button>
          </div>
        )}

        {/* Profile Music */}
        {(() => {
          const musicRaw = (profile as any).profileMusic;
          if (!musicRaw) return null;
          let tracks: Array<{ id: string; name: string; url: string; duration: number }> = [];
          try {
            tracks = typeof musicRaw === 'string' ? JSON.parse(musicRaw) : musicRaw;
            if (!Array.isArray(tracks)) tracks = [];
          } catch { return null; }
          if (tracks.length === 0) return null;
          const activeTrack = tracks[activeMusicTrackIndex] || tracks[0];
          return (
            <div className="mx-4 mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
              {tracks.map((track, idx) => (
                <div key={track.id} className={`w-full flex items-center gap-3.5 px-4 py-[11px] ${idx > 0 ? 'border-t border-white/[0.06]' : ''}`}>
                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        if (isPlayingMusic && activeMusicTrackIndex === idx) {
                          audioRef.current.pause();
                          setIsPlayingMusic(false);
                        } else {
                          setActiveMusicTrackIndex(idx);
                          audioRef.current.src = track.url;
                          audioRef.current.play();
                          setIsPlayingMusic(true);
                        }
                      }
                    }}
                    className="w-10 h-10 rounded-full bg-nexo-500 flex items-center justify-center flex-shrink-0"
                  >
                    {isPlayingMusic && activeMusicTrackIndex === idx ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-white font-medium truncate">{track.name || 'Музыка профиля'}</p>
                    <p className="text-[13px] text-zinc-500">
                      {isPlayingMusic && activeMusicTrackIndex === idx ? 'Воспроизводится...' : track.duration ? `${Math.floor(track.duration / 60)}:${String(track.duration % 60).padStart(2, '0')}` : ''}
                    </p>
                  </div>
                </div>
              ))}
              <audio
                ref={audioRef}
                src={activeTrack.url}
                onEnded={() => setIsPlayingMusic(false)}
                onPause={() => setIsPlayingMusic(false)}
                onPlay={() => setIsPlayingMusic(true)}
              />
            </div>
          );
        })()}

        {/* Wall Stats */}
        <div className="mx-4 mb-3 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
          <div className="w-full flex items-start gap-3.5 px-4 py-[11px] border-b border-white/[0.06]">
            <span className="text-zinc-500 mt-[2px] flex-shrink-0"><Newspaper size={20} /></span>
            <p className="text-[13px] text-zinc-500 leading-tight">Стена</p>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/[0.06]">
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-[17px] font-bold text-white">{(profile as any).subscribersCount || 0}</span>
              <span className="text-[11px] text-zinc-500">Подписчики</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-[17px] font-bold text-white">{(profile as any).postsCount || 0}</span>
              <span className="text-[11px] text-zinc-500">Посты</span>
            </div>
            <div className="flex flex-col items-center gap-0.5 py-3">
              <span className="text-[17px] font-bold text-white">{userHashtags.length}</span>
              <span className="text-[11px] text-zinc-500">Хэштеги</span>
            </div>
          </div>
        </div>

        {/* ===== TABS — Telegram style ===== */}
        {tabs.length > 0 && (
          <div className="border-b border-white/[0.06]">
            <div className="flex items-center overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`relative flex items-center gap-1.5 px-4 py-[11px] whitespace-nowrap transition-colors ${
                      isActive ? 'text-nexo-400' : 'text-zinc-500'
                    }`}
                  >
                    <span className={`text-[14px] font-medium ${isActive ? 'text-nexo-400' : 'text-zinc-500'}`}>
                      {tab.label}
                    </span>
                    {isActive && (
                      <motion.div
                        layoutId="profileTabLine"
                        className="absolute bottom-0 left-3 right-3 h-[2.5px] bg-nexo-500 rounded-full"
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ===== TAB CONTENT ===== */}
        <div className="min-h-[200px]">
          {tabLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-zinc-500" />
            </div>
          ) : activeTab === 'media' ? (
            sharedMedia.length > 0 ? (
              <div className="grid grid-cols-3 gap-0.5 p-1">
                {(() => {
                  const allMedia = sharedMedia.flatMap((msg) => (msg.media || []));
                  return allMedia.map((m, idx) => (
                    <div
                      key={m.id}
                      onClick={() => setLightboxIndex(idx)}
                      className="relative aspect-square bg-[#0a0a0f] overflow-hidden group cursor-pointer"
                    >
                      {m.type === 'video' ? (
                        <>
                          <img src={m.thumbnail || m.url} alt="" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                            <Play size={24} className="text-white fill-white" />
                          </div>
                        </>
                      ) : (
                        <img src={m.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                      )}
                    </div>
                  ));
                })()}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-[13px] text-zinc-500">{t('sharedPhotos')}</p>
              </div>
            )
          ) : activeTab === 'files' ? (
            sharedFiles.length > 0 ? (
              <div>
                {sharedFiles.flatMap((msg) =>
                  (msg.media || []).map((m) => (
                    <a
                      key={m.id}
                      href={m.url}
                      download={m.filename || 'file'}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.06]"
                    >
                      <div className="w-10 h-10 rounded-xl bg-nexo-500/10 flex items-center justify-center flex-shrink-0">
                        <FileText size={18} className="text-nexo-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[14px] text-white truncate">{m.filename || 'file'}</p>
                        <p className="text-[12px] text-zinc-500">
                          {m.size ? `${(m.size / 1024).toFixed(1)} KB` : ''}
                        </p>
                      </div>
                      <Download size={16} className="text-zinc-500 flex-shrink-0" />
                    </a>
                  ))
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-[13px] text-zinc-500">{t('sharedFiles')}</p>
              </div>
            )
          ) : activeTab === 'links' ? (
            sharedLinks.length > 0 ? (
              <div>
                {sharedLinks.map((msg) => (
                  <div key={msg.id} className="px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.06]">
                    <p className="text-[12px] text-zinc-500 mb-1.5">
                      {msg.sender?.displayName || msg.sender?.username} · {new Date(msg.createdAt).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}
                    </p>
                    {(msg.links || []).map((link: string, i: number) => (
                      <a key={i} href={link} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-[14px] text-nexo-400 hover:text-[#5a9be0] transition-colors truncate">
                        <ExternalLink size={14} className="flex-shrink-0" />
                        <span className="truncate">{link}</span>
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-[13px] text-zinc-500">{t('sharedLinks')}</p>
              </div>
            )
          ) : activeTab === 'calls' ? (
            callHistory.length > 0 ? (
              <div>
                {callHistory.map((call) => (
                  <div key={call.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.06]">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                      call.status === 'missed' ? 'bg-[#e05555]/20 text-[#e05555]' :
                      'bg-[#4dcd5e]/20 text-[#4dcd5e]'
                    }`}>
                      {call.status === 'missed' ? <PhoneMissed size={16} /> :
                       call.isIncoming ? <PhoneIncoming size={16} /> :
                       <PhoneOutgoing size={16} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] text-white font-medium">
                        {call.status === 'missed' ? (call.isIncoming ? t('missedCall') : t('declinedCall')) :
                         call.isIncoming ? t('incomingCall') : t('outgoingCall')}
                      </p>
                      <p className="text-[12px] text-zinc-500">
                        {new Date(call.createdAt).toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[12px] text-zinc-500 font-mono">
                        {call.duration > 0 ? formatCallDuration(call.duration) : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center py-8">
                <p className="text-[13px] text-zinc-500">{t('noCalls')}</p>
              </div>
            )
          ) : activeTab === 'music' ? (
            <div className="p-4">
              <ProfileMusic userId={userId} isOwner={isSelf || false} />
              {isSelf && isPremium && (
                <div className="mt-6"><PremiumBadgeUpload /></div>
              )}
            </div>
          ) : activeTab === 'nft_gifts' ? (
            <div className="p-4">
              {profileNFTCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Crown size={32} className="text-zinc-500 mb-3" />
                  <p className="text-[14px] text-zinc-500">Нет NFT карточек</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {profileNFTCards.map((instance: any) => (
                    <div key={instance.id} className="rounded-2xl overflow-hidden border border-white/[0.08] bg-white/[0.04]">
                      <div className="relative aspect-[3/4]" style={{
                        background: instance.card.gradientColors
                          ? `linear-gradient(135deg, ${JSON.parse(instance.card.gradientColors).join(', ')})`
                          : instance.card.backgroundColor || '#667eea',
                      }}>
                        {instance.card.photoUrl && (
                          <div className="absolute inset-0 flex items-center justify-center p-4">
                            <img src={instance.card.photoUrl} className="max-w-full max-h-full object-contain" alt={instance.card.name} />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/95 to-transparent">
                          <p className="text-[13px] font-bold text-white truncate">{instance.card.name}</p>
                          <p className="text-[11px] text-white/60">#{instance.serialNumber}/{instance.card.totalSupply}</p>
                        </div>
                      </div>
                      <div className="p-2 flex items-center justify-center gap-1 text-[13px] font-bold text-nexo-400">
                        <span>{instance.card.currentPrice}</span>
                       
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'nft_tags' ? (
            <div className="p-4">
              {profileNFTTags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Hash size={32} className="text-zinc-500 mb-3" />
                  <p className="text-[14px] text-zinc-500">Нет тегов</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {profileNFTTags.map((instance: any) => (
                    <div key={instance.id} className="bg-white/[0.04] rounded-2xl p-3 text-center border border-white/[0.08]">
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-xl"
                        style={{ background: instance.tag.backgroundColor || '#667eea' }}>
                        {instance.tag.iconUrl}
                      </div>
                      <p className="text-[13px] font-bold text-white truncate">{instance.tag.name}</p>
                      <p className="text-[11px] text-zinc-500">#{instance.serialNumber}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : activeTab === 'hashtags' ? (
            <div className="p-4">
              {userHashtags.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Hash size={32} className="text-zinc-500 mb-3" />
                  <p className="text-[14px] text-zinc-500">Нет хэштегов</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {userHashtags.map((hashtag) => (
                    <div key={hashtag.id} className="bg-white/[0.04] rounded-xl p-3 border border-white/[0.08] hover:bg-white/[0.08] transition-colors cursor-pointer"
                      onClick={() => { window.location.href = `/wall/hashtag/${hashtag.tag}`; }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[14px] font-bold text-white">#{hashtag.tag}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[12px] text-zinc-500">Всего: <span className="text-nexo-400 font-bold">{hashtag.useCount}</span></span>
                          <span className="text-[12px] text-zinc-500">Вами: <span className="text-white font-bold">{hashtag.ownerUseCount}</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  // ===== MODALS =====
  const profileModals = (
    <>
      {/* Fullscreen Avatar */}
      <AnimatePresence>
        {showAvatarFullscreen && profile?.avatar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/95 flex items-center justify-center"
            onClick={() => setShowAvatarFullscreen(false)}
          >
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center z-10"
              onClick={() => setShowAvatarFullscreen(false)}
            >
              <X size={20} className="text-white" />
            </motion.button>
            <motion.img
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              src={profile.avatar}
              alt={profile.displayName || ''}
              className="max-w-[90vw] max-h-[90vh] object-contain rounded-2xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxIndex !== null && (
          <ImageLightbox
            images={sharedMedia.flatMap((msg) => (msg.media || []).map((m) => ({ url: m.url, type: m.type })))}
            initialIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
          />
        )}
      </AnimatePresence>

      {/* Edit profile modal */}
      <AnimatePresence>
        {isEditingProfile && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-50" onClick={() => setIsEditingProfile(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white/[0.04] border border-white/[0.08] rounded-2xl z-50 shadow-2xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
                <h3 className="text-[17px] font-semibold text-white">Редактировать профиль</h3>
                <button onClick={() => setIsEditingProfile(false)} className="p-2 rounded-full hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
                <div>
                  <label className="text-[13px] text-zinc-500 mb-2 block">Username</label>
                  <div className="relative">
                    <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input type="text" value={editData.username} onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-white focus:border-nexo-500 focus:outline-none text-[14px]"
                      placeholder="@username" />
                  </div>
                </div>
                <div>
                  <label className="text-[13px] text-zinc-500 mb-2 block">Имя</label>
                  <input type="text" value={editData.displayName} onChange={(e) => setEditData({ ...editData, displayName: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-white focus:border-nexo-500 focus:outline-none text-[14px]"
                    placeholder="Ваше имя" />
                </div>
                <div>
                  <label className="text-[13px] text-zinc-500 mb-2 block">О себе</label>
                  <textarea value={editData.bio} onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-white focus:border-nexo-500 focus:outline-none resize-none h-24 text-[14px]"
                    placeholder="Расскажите о себе..." />
                </div>
              </div>
              <div className="flex gap-3 p-4 border-t border-white/[0.06]">
                <motion.button whileTap={{ scale: 0.97 }} onClick={handleSaveProfile} disabled={isSavingProfile}
                  className="flex-1 py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-[14px]">
                  {isSavingProfile ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                  Сохранить
                </motion.button>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => setIsEditingProfile(false)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-white font-medium transition-all text-[14px]">
                  Отмена
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Status Edit Modal */}
      <AnimatePresence>
        {isEditingStatus && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsEditingStatus(false)}>
            <motion.div
              initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-md rounded-2xl bg-white/[0.04] border border-white/[0.08] shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}>
              <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-[17px] font-semibold text-white">Изменить статус</h3>
                <button onClick={() => setIsEditingStatus(false)} className="p-2 rounded-full hover:bg-white/[0.06] text-zinc-500 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="text-[13px] text-zinc-500 mb-1.5 block">Эмодзи</label>
                  <input type="text" value={statusEmoji} onChange={(e) => setStatusEmoji(e.target.value.slice(0, 2))}
                    placeholder="😊" maxLength={2}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-white text-2xl text-center placeholder-zinc-500 focus:outline-none focus:border-nexo-500 transition-colors" />
                </div>
                <div>
                  <label className="text-[13px] text-zinc-500 mb-1.5 block">Текст статуса</label>
                  <input type="text" value={statusText} onChange={(e) => setStatusText(e.target.value.slice(0, 200))}
                    placeholder="Чем вы занимаетесь?" maxLength={200} autoFocus
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500 transition-colors text-[14px]" />
                  <p className="text-[12px] text-zinc-500 mt-1 text-right">{statusText.length}/200</p>
                </div>
                <div>
                  <label className="text-[13px] text-zinc-500 mb-1.5 block">Истекает через</label>
                  <select value={statusExpires} onChange={(e) => setStatusExpires(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[#0a0a0f] border border-white/[0.08] text-white focus:outline-none focus:border-nexo-500 transition-colors appearance-none text-[14px]">
                    <option value="1" className="bg-[#0a0a0f]">1 час</option>
                    <option value="4" className="bg-[#0a0a0f]">4 часа</option>
                    <option value="8" className="bg-[#0a0a0f]">8 часов</option>
                    <option value="24" className="bg-[#0a0a0f]">24 часа</option>
                    <option value="168" className="bg-[#0a0a0f]">7 дней</option>
                    <option value="" className="bg-[#0a0a0f]">Никогда</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveStatus} disabled={!statusText.trim()}
                    className="flex-1 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:bg-white/[0.06] disabled:text-zinc-500 text-white font-medium transition-colors text-[14px]">
                    Сохранить
                  </button>
                  {status && (
                    <button onClick={handleDeleteStatus}
                      className="px-4 py-2.5 rounded-xl bg-[#e05555]/10 hover:bg-[#e05555]/20 text-[#e05555] font-medium transition-colors text-[14px]">
                      Удалить
                    </button>
                  )}
                  <button onClick={() => setIsEditingStatus(false)}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-zinc-500 hover:text-white font-medium transition-colors text-[14px]">
                    Отмена
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPinModal && (
          <PinChannelModal userId={userId} currentPinnedChannelId={profile?.pinnedChannelId}
            onPin={() => loadProfile()} onUnpin={() => loadProfile()} onClose={() => setShowPinModal(false)} />
        )}
      </AnimatePresence>

      {showSecretChatModal && profile && (
        <SecretChatModal isOpen={showSecretChatModal} onClose={() => setShowSecretChatModal(false)}
          userId={userId} username={profile.displayName || profile.username}
          onChatCreated={(chatId) => {
            setShowSecretChatModal(false);
            const { loadChats, setActiveChat } = useChatStore.getState();
            loadChats();
            setActiveChat(chatId);
            onClose();
          }} />
      )}

      <AnimatePresence>
      </AnimatePresence>

      {showQRCode && profile && (
        <QRCodeModal user={{ id: profile.id, username: profile.username || '', displayName: profile.displayName || profile.username || '', avatar: profile.avatar || null }}
          onClose={() => setShowQRCode(false)} />
      )}
      {showShareModal && profile && (
        <ShareProfileModal user={{ id: profile.id, username: profile.username || '', displayName: profile.displayName || profile.username || '', avatar: profile.avatar || null }}
          onClose={() => setShowShareModal(false)} />
      )}
    </>
  );

  if (embedded) return profileBody;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-[#0a0a0f] animate-[slideUp_0.2s_ease-out]">
      <style>{`@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }`}</style>
      {profileBody}
      {profileModals}
    </div>
  );
}
