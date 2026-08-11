import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Users, MessageSquareText, Star, BellPlus, BellOff, Loader2, Eye } from 'lucide-react';
import type { Chat } from '../lib/types';
import { getInitials } from '../lib/initials';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { VerifiedBadge } from './VerifiedBadge';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface ChannelProfileModalProps {
  chat: Chat;
  onClose: () => void;
  onOpenUser?: (userId: string) => void;
  onSubscribed?: (chat: Chat) => void;
}

export default function ChannelProfileModal({ chat, onClose, onOpenUser, onSubscribed }: ChannelProfileModalProps) {
  const { user } = useAuthStore();
  const [busy, setBusy] = useState(false);

  const initials = getInitials(chat.name);
  const members = chat.members || [];
  const isChannel = chat.type === 'channel';
  const isMember = !!members.find(m => m.userId === user?.id);
  const isOwner = !!members.find(m => m.userId === user?.id && m.role === 'owner');

  const handleSubscribe = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isMember) {
        await api.leaveChat(chat.id);
        toast.info('Вы отписались от канала');
        onSubscribed?.({ ...chat, members: members.filter(m => m.userId !== user?.id) });
      } else {
        const res = await api.subscribeChannel(chat.id);
        toast.success('Вы подписались на канал');
        if (res.chat) onSubscribed?.(res.chat);
      }
      onClose();
    } catch (err) {
      console.error('[Channel] subscribe failed:', err);
      toast.error('Не удалось обновить подписку');
    } finally {
      setBusy(false);
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
        <div className="h-32 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black relative overflow-hidden">
          <div className="absolute inset-0 bg-black/20" />
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10 blur-3xl" />
        </div>

        {/* Avatar */}
        <div className="flex justify-center -mt-12 relative z-10">
          <div className="w-24 h-24 rounded-3xl overflow-hidden ring-4 ring-[#0a0a0f] shadow-2xl">
            {chat.avatar ? (
              <img src={normalizeMediaUrl(chat.avatar)} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-zinc-700 to-zinc-800 flex items-center justify-center">
                <span className="text-2xl font-bold text-white/60">{initials}</span>
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
              {chat.isPremium && <Star size={15} className="text-amber-400 fill-amber-400" />}
            </div>

            <div className="flex items-center justify-center gap-4 mt-2 text-xs text-white/40">
              <span className="flex items-center gap-1.5">
                <Users size={12} />
                {isChannel
                  ? `${(chat.subscribersCount || members.length)} подписчиков`
                  : `${members.length} участников`}
              </span>
            </div>

            {chat.description && (
              <p className="mt-3 text-xs text-white/60 leading-relaxed max-w-xs mx-auto">
                {chat.description}
              </p>
            )}

            {!isChannel && chat.linkedChatId && (
              <p className="mt-2 text-[10px] text-white/30">
                Комментарии к посту канала
              </p>
            )}
          </div>

          {/* Subscribe / Unsubscribe (public channels only, non-owners) */}
          {isChannel && !isOwner && (
            <button
              onClick={handleSubscribe}
              disabled={busy}
              className={`mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border text-xs font-medium transition-all disabled:opacity-50 ${
                isMember
                  ? 'bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.1] text-white/80'
                  : 'bg-accent hover:bg-accent/90 border-transparent text-white'
              }`}
            >
              {busy ? (
                <Loader2 size={15} className="animate-spin" />
              ) : isMember ? (
                <><BellOff size={15} /> Отписаться</>
              ) : (
                <><BellPlus size={15} /> Подписаться</>
              )}
            </button>
          )}

          {/* Owner extra info */}
          {isChannel && isOwner && (
            <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-white/30">
              <Eye size={11} />
              Это ваш канал — статистика: {chat.subscribersCount || members.length} подписчиков
            </p>
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
                  <button
                    key={member.userId}
                    onClick={() => {
                      if (member.user && onOpenUser) {
                        onOpenUser(member.userId);
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-white/[0.03] hover:bg-white/[0.07] border border-transparent hover:border-white/[0.06] transition-all text-left"
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
                ))}
              </div>
            </div>
          )}

          {/* Close action */}
          <div className="grid grid-cols-2 gap-2 mt-6">
            <button
              onClick={onClose}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] text-xs font-medium text-white/80 transition-all col-span-2"
            >
              <MessageSquareText size={15} />
              {isChannel ? 'Открыть канал' : 'Открыть комментарии'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}