import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  AtSign,
  Copy,
  Check,
  Star,
  MessageCircle,
  UserPlus,
  UserCheck,
  UserMinus,
  Ban,
  Unlock,
  Users,
  Cake,
  Music,
  ChevronRight,
  Clock,
} from 'lucide-react';
import type { User } from '../lib/types';
import type { CommonChatInfo } from '../lib/api/users';
import { api } from '../lib/api';
import { VerifiedBadge } from './VerifiedBadge';
import { toast } from '../lib/toast';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { formatLastSeen } from '../lib/formatLastSeen';
import { getInitials } from '../lib/initials';

interface ContactProfileModalProps {
  userId: string;
  onClose: () => void;
  onMessage: (userId: string) => void;
  onOpenCommonChat?: (chatId: string) => void;
}

export default function ContactProfileModal({ userId, onClose, onMessage, onOpenCommonChat }: ContactProfileModalProps) {
  const [user, setUser] = useState<User | null>(null);
  const [friendship, setFriendship] = useState<string>('none');
  const [friendshipId, setFriendshipId] = useState('');
  const [blockedByMe, setBlockedByMe] = useState(false);
  const [blockedMe, setBlockedMe] = useState(false);
  const [commonChats, setCommonChats] = useState<CommonChatInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getUser(userId);
      setUser(data.user);
      setFriendship(data.friendship);
      setFriendshipId(data.friendshipId || '');
      setBlockedByMe(data.blockedByMe);
      setBlockedMe(data.blockedMe);
      setCommonChats(data.commonChats || []);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Не удалось загрузить профиль');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, [load]);

  const handleCopyUsername = () => {
    navigator.clipboard.writeText(`@${user?.username || ''}`);
    setCopied(true);
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
  };

  const refresh = async () => {
    await load();
    setConfirmBlock(false);
  };

  const handleAction = async (fn: () => Promise<unknown>, successMsg: string) => {
    if (busy) return;
    try {
      setBusy(true);
      await fn();
      toast.success(successMsg);
      await refresh();
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const initials = getInitials(user?.displayName || user?.username);

  const fmtDate = (iso?: string | null): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const details = [
    ...(user?.birthday ? [{ Icon: Cake, label: 'День рождения', value: fmtDate(user.birthday)! }] : []),
    ...(user?.profileMusic ? [{ Icon: Music, label: 'Музыка', value: user.profileMusic }] : []),
  ];

  const premiumColor = user?.isPremium
    ? 'from-amber-400 via-yellow-300 to-orange-400'
    : 'from-zinc-800 via-zinc-900 to-black';

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

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-white/20 border-t-accent rounded-full animate-spin" />
          </div>
        ) : error || !user ? (
          <div className="flex flex-col items-center justify-center h-64 px-8 text-center">
            <p className="text-sm text-white/60">{error || 'Пользователь не найден'}</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-white/80"
            >
              Закрыть
            </button>
          </div>
        ) : (
          <>
            {/* Banner */}
            <div className={`h-32 bg-gradient-to-br ${premiumColor} relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/20" />
              <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
            </div>

            {/* Avatar */}
            <div className="flex justify-center -mt-12 relative z-10">
              <div className="w-24 h-24 rounded-3xl overflow-hidden ring-4 ring-[#0a0a0f] shadow-2xl">
                {user.avatar ? (
                  <img src={normalizeMediaUrl(user.avatar)} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                    <span className="text-2xl font-bold text-white/60">{initials}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="px-6 pt-3 pb-6 text-center">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-lg font-bold text-white/90 font-display">
                  {user.displayName || user.username}
                </h1>
                <VerifiedBadge
                  isVerified={user.isVerified}
                  badgeUrl={user.verifiedBadgeUrl}
                  badgeType={user.verifiedBadgeType}
                  size={17}
                />
                {user.isPremium && <Star size={15} className="text-amber-400 fill-amber-400" />}
              </div>

              <button
                onClick={handleCopyUsername}
                className="inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:text-white/80 transition-all"
              >
                <AtSign size={12} />
                @{user.username}
                {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
              </button>

              {/* Presence */}
              <div className="flex items-center justify-center gap-4 mt-3 text-xs">
                <span className={`flex items-center gap-1.5 ${user.isOnline ? 'text-green-400 font-medium' : 'text-white/40'}`}>
                  <span className={`w-2 h-2 rounded-full ${user.isOnline ? 'bg-green-400 animate-pulse' : 'bg-white/20'}`} />
                  {user.isOnline ? 'В сети' : 'Не в сети'}
                </span>
                {!user.isOnline && (
                  <span className="flex items-center gap-1.5 text-white/35">
                    <Clock size={12} />
                    {formatLastSeen(user.lastSeen) || 'давно'}
                  </span>
                )}
              </div>

              {user.bio && (
                <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
                  {user.bio}
                </p>
              )}

              {/* Block notice */}
              {blockedMe && (
                <div className="mt-3 px-4 py-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-300">
                  Вы заблокированы этим пользователем
                </div>
              )}

              {/* Details */}
              {details.length > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-5 text-left">
                  {details.map(({ Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-2.5 px-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06]">
                      <Icon size={14} className="shrink-0 text-white/40" />
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase tracking-wide text-white/35 truncate">{label}</div>
                        <div className="text-xs text-white/80 truncate">{value}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-2 gap-2 mt-6">
                <button
                  onClick={() => { onClose(); onMessage(user.id); }}
                  disabled={blockedMe || busy}
                  className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent/15 hover:bg-accent/25 border border-accent/20 text-xs font-medium text-accent transition-all disabled:opacity-40 col-span-2"
                >
                  <MessageCircle size={15} />
                  Написать
                </button>

                {friendship === 'none' && (
                  <button
                    onClick={() => handleAction(() => api.sendFriendRequest(user.id), 'Заявка отправлена')}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all disabled:opacity-40 col-span-2"
                  >
                    <UserPlus size={15} />
                    Добавить в друзья
                  </button>
                )}

                {friendship === 'pending_sent' && (
                  <button
                    disabled
                    className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.08] text-xs font-medium text-white/50 col-span-2 cursor-default"
                  >
                    <Clock size={15} />
                    Заявка отправлена
                  </button>
                )}

                {friendship === 'pending_received' && (
                  <>
                    <button
                      onClick={() => handleAction(() => api.acceptFriendRequest(friendshipId), 'Вы теперь друзья')}
                      disabled={busy}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-green-500/15 hover:bg-green-500/25 border border-green-500/20 text-xs font-medium text-green-300 transition-all disabled:opacity-40"
                    >
                      <UserCheck size={15} />
                      Принять
                    </button>
                    <button
                      onClick={() => handleAction(() => api.declineFriendRequest(friendshipId), 'Заявка отклонена')}
                      disabled={busy}
                      className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium text-rose-300 transition-all disabled:opacity-40"
                    >
                      Отклонить
                    </button>
                  </>
                )}

                {friendship === 'accepted' && (
                  <button
                    onClick={() => handleAction(() => api.removeFriend(friendshipId), 'Удалён из друзей')}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-rose-500/20 border border-white/[0.08] text-xs font-medium text-white/80 hover:text-rose-300 transition-all disabled:opacity-40 col-span-2"
                  >
                    <UserMinus size={15} />
                    Удалить из друзей
                  </button>
                )}

                {confirmBlock ? (
                  <div className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-xs col-span-2 px-3">
                    <span className="text-rose-300">Заблокировать?</span>
                    <button
                      onClick={() => handleAction(() => api.post('/users/block', { blockedUserId: user.id }), 'Пользователь заблокирован')}
                      disabled={busy}
                      className="px-3 py-1 rounded-lg bg-rose-500/30 hover:bg-rose-500/40 text-rose-100 font-medium transition-all"
                    >
                      Да
                    </button>
                    <button
                      onClick={() => setConfirmBlock(false)}
                      className="px-3 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.1] text-white/70 transition-all"
                    >
                      Нет
                    </button>
                  </div>
                ) : blockedByMe ? (
                  <button
                    onClick={() => handleAction(() => api.post('/users/unblock', { blockedUserId: user.id }), 'Пользователь разблокирован')}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all disabled:opacity-40 col-span-2"
                  >
                    <Unlock size={15} />
                    Разблокировать
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmBlock(true)}
                    disabled={busy}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-xs font-medium text-rose-300 transition-all disabled:opacity-40 col-span-2"
                  >
                    <Ban size={15} />
                    Заблокировать
                  </button>
                )}
              </div>

              {/* Common chats (like Telegram) */}
              {commonChats.length > 0 && (
                <div className="mt-6 text-left">
                  <div className="flex items-center gap-2 px-1 mb-2">
                    <Users size={14} className="text-white/40" />
                    <span className="text-[11px] uppercase tracking-wide text-white/40 font-medium">
                      Общие группы · {commonChats.length}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {commonChats.map(chat => (
                      <button
                        key={chat.id}
                        onClick={() => {
                          if (onOpenCommonChat) {
                            onClose();
                            onOpenCommonChat(chat.id);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/[0.06] transition-all text-left"
                      >
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center text-sm font-bold text-white/60">
                          {(chat.name || 'Г').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-medium text-white/85 truncate">{chat.name || 'Группа'}</div>
                          <div className="text-[10px] text-white/35">{chat.type === 'group' ? 'Группа' : 'Личный чат'}</div>
                        </div>
                        <ChevronRight size={14} className="text-white/25" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}