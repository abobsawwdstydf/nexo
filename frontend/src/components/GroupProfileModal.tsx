import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, MessageSquareText, UserPlus, LogOut, UserMinus, Search, Loader2, Check } from 'lucide-react';
import type { Chat } from '../lib/types';
import { getInitials } from '../lib/initials';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { VerifiedBadge } from './VerifiedBadge';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../lib/toast';

interface GroupProfileModalProps {
  chat: Chat;
  onClose: () => void;
  onOpenUser?: (userId: string) => void;
  onMembersChanged?: (chat: Chat) => void;
  onLeave?: (chatId: string) => void;
}

interface FriendItem {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
}

export default function GroupProfileModal({
  chat,
  onClose,
  onOpenUser,
  onMembersChanged,
  onLeave,
}: GroupProfileModalProps) {
  const { user } = useAuthStore();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [kickingId, setKickingId] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);

  const members = chat.members || [];
  const me = members.find(m => m.userId === user?.id);
  const isOwner = me?.role === 'owner';
  const isAdmin = isOwner || me?.role === 'admin';

  const openInvite = async () => {
    setInviteOpen(true);
    setLoadingFriends(true);
    try {
      const { getSocket } = await import('../lib/socket');
      const friendsData = await api.fetchFriendsWS();
      setFriends(
        friendsData.map((f: FriendItem) => ({
          id: f.id,
          username: f.username || '',
          displayName: f.displayName || f.username || '',
          avatar: f.avatar || null,
        }))
      );
    } catch (err) {
      console.error('[Group] failed to load friends:', err);
    } finally {
      setLoadingFriends(false);
    }
  };

  const filteredFriends = friends.filter(f =>
    !members.some(m => m.userId === f.id) &&
    (f.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleInvite = async (friendId: string) => {
    setInvitingId(friendId);
    try {
      await api.addChatMember(chat.id, friendId);
      toast.success('Участник добавлен');
      const fresh = await api.getChat(chat.id);
      onMembersChanged?.(fresh);
    } catch (err) {
      console.error('[Group] invite failed:', err);
      toast.error('Не удалось пригласить');
    } finally {
      setInvitingId(null);
    }
  };

  const handleKick = async (targetId: string) => {
    setKickingId(targetId);
    try {
      await api.kickMember(chat.id, targetId);
      toast.success('Участник исключён');
      const fresh = await api.getChat(chat.id);
      onMembersChanged?.(fresh);
    } catch (err) {
      console.error('[Group] kick failed:', err);
      toast.error('Не удалось исключить участника');
    } finally {
      setKickingId(null);
    }
  };

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await api.leaveChat(chat.id);
      toast.info('Вы вышли из группы');
      onLeave?.(chat.id);
    } catch (err) {
      console.error('[Group] leave failed:', err);
      toast.error('Не удалось выйти из группы');
    } finally {
      setLeaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-[60] flex items-end md:items-center justify-center p-0 md:p-4 bg-black/80 backdrop-blur-md"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 40 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 40 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        className="relative w-full h-full md:h-auto md:max-h-[88vh] max-w-none md:max-w-[440px] rounded-none md:rounded-3xl liquid-glass-strong overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <motion.button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/40 border border-white/[0.08] hover:bg-white/[0.1] transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X size={18} className="text-white/70" />
        </motion.button>

        {/* Banner */}
        <div className="h-32 bg-gradient-to-br from-indigo-900 via-zinc-900 to-black relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Avatar */}
        <div className="flex justify-center -mt-12 relative z-10">
          <div className="w-24 h-24 rounded-3xl overflow-hidden ring-4 ring-[#0a0a0f] shadow-2xl">
            {chat.avatar ? (
              <img src={normalizeMediaUrl(chat.avatar)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-indigo-700 to-zinc-800 flex items-center justify-center">
                <span className="text-2xl font-bold text-white/60">{getInitials(chat.name)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="px-6 pt-3 pb-6">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <h1 className="text-lg font-bold text-white/90 font-display">{chat.name || 'Без названия'}</h1>
              <VerifiedBadge
                isVerified={chat.isVerified}
                badgeUrl={chat.verifiedBadgeUrl}
                badgeType={chat.verifiedBadgeType}
                size={17}
              />
            </div>

            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <Users size={12} />
                {members.length} участников
              </span>
            </div>

            {chat.description && (
              <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
                {chat.description}
              </p>
            )}
          </div>

          {/* Invite */}
          {isAdmin && (
            <>
              <button
                onClick={openInvite}
                className="mt-6 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent hover:bg-accent/90 text-white text-xs font-medium transition-all"
              >
                <UserPlus size={15} />
                Пригласить участника
              </button>

              {inviteOpen && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 overflow-hidden"
                >
                  <div className="relative mb-2">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Поиск среди друзей..."
                      className="w-full h-8 pl-8 pr-3 text-xs bg-white/[0.05] border border-white/[0.08] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                    />
                  </div>
                  {loadingFriends ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 size={16} className="text-white/30 animate-spin" />
                    </div>
                  ) : filteredFriends.length === 0 ? (
                    <p className="text-center text-[11px] text-white/30 py-3">Нет доступных друзей</p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {filteredFriends.map(friend => (
                        <div
                          key={friend.id}
                          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-white/[0.05] transition-colors"
                        >
                          {friend.avatar ? (
                            <img src={normalizeMediaUrl(friend.avatar)} alt="" className="w-8 h-8 rounded-lg object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-[11px] font-bold text-white/60">
                              {getInitials(friend.displayName)}
                            </div>
                          )}
                          <span className="flex-1 min-w-0 text-xs text-white/80 truncate">{friend.displayName}</span>
                          <button
                            onClick={() => handleInvite(friend.id)}
                            disabled={invitingId === friend.id}
                            className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 transition-colors disabled:opacity-50"
                            title="Добавить в группу"
                          >
                            {invitingId === friend.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <UserPlus size={13} />
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </>
          )}

          {/* Members */}
          {members.length > 0 && (
            <div className="mt-6 text-left">
              <div className="flex items-center gap-2 px-1 mb-2">
                <Users size={14} className="text-white/40" />
                <span className="text-[11px] uppercase tracking-wide text-white/40 font-medium">
                  Участники · {members.length}
                </span>
              </div>
              <div className="space-y-1">
                {members.map(member => (
                  <div
                    key={member.userId}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/[0.06] transition-all"
                  >
                    <button
                      onClick={() => {
                        if (member.user && member.userId !== user?.id && onOpenUser) onOpenUser(member.userId);
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      {member.user?.avatar ? (
                        <img
                          src={normalizeMediaUrl(member.user.avatar)}
                          alt=""
                          className="w-9 h-9 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-sm font-bold text-white/60">
                          {getInitials(member.user?.displayName || member.user?.username || '?')}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white/85 truncate">
                          {member.user?.displayName || member.user?.username || 'Пользователь'}
                          {member.role === 'owner' && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-amber-400/10 border border-amber-400/20 text-[9px] font-semibold text-amber-400">
                              ВЛАДЕЛЕЦ
                            </span>
                          )}
                          {member.role === 'admin' && (
                            <span className="ml-2 px-1.5 py-0.5 rounded-md bg-white/[0.06] border border-white/[0.1] text-[9px] font-semibold text-white/50">
                              АДМИН
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                    {isAdmin && member.userId !== user?.id && member.role !== 'owner' && (
                      <button
                        onClick={() => handleKick(member.userId)}
                        disabled={kickingId === member.userId}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400/80 transition-colors disabled:opacity-50"
                        title="Исключить"
                      >
                        {kickingId === member.userId ? <Loader2 size={13} className="animate-spin" /> : <UserMinus size={13} />}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all"
            >
              <MessageSquareText size={15} />
              Открыть чат
            </button>
            <button
              onClick={handleLeave}
              disabled={leaving}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-xs font-medium text-red-400 transition-all disabled:opacity-50"
            >
              {leaving ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
              Выйти из группы
            </button>
          </div>

          {isOwner && (
            <p className="mt-3 text-center text-[10px] text-white/25 flex items-center justify-center gap-1">
              <Check size={10} />
              Вы владелец группы — можете приглашать и исключать участников
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}