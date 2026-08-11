import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Loader2, Users, Link2, ArrowRight } from 'lucide-react';
import { api } from '../lib/api';
import { getInitials } from '../lib/initials';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { toast } from '../lib/toast';
import type { InviteChatInfo } from '../lib/api/inviteLinks';

interface JoinInviteModalProps {
  code: string;
  onClose: () => void;
  onJoined: (chatId: string) => void;
}

export default function JoinInviteModal({ code, onClose, onJoined }: JoinInviteModalProps) {
  const [chat, setChat] = useState<InviteChatInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    try {
      const info = await api.getInviteInfo(code);
      setChat(info.chat);
    } catch (err: any) {
      setError(err?.message || 'Ссылка-приглашение недействительна');
    }
  }, [code]);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async () => {
    if (!chat || joining) return;
    setJoining(true);
    try {
      const res = await api.joinInvite(code);
      if (!res.alreadyMember) toast.success('Вы вступили в чат');
      onJoined(res.chatId);
    } catch (err: any) {
      setError(err?.message || 'Не удалось вступить в чат');
      setJoining(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ duration: 0.25 }}
        className="w-full max-w-sm liquid-glass rounded-3xl p-6 text-center"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-white/40 hover:text-white/80 hover:bg-white/10 transition-colors"
        >
          <X size={16} />
        </button>

        {error ? (
          <div className="py-6 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-400 flex items-center justify-center">
              <Link2 size={24} />
            </div>
            <p className="text-sm text-white/70">{error}</p>
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs text-white/80 transition-colors"
            >
              Закрыть
            </button>
          </div>
        ) : !chat ? (
          <div className="py-8 flex flex-col items-center gap-3">
            <Loader2 size={22} className="text-white/40 animate-spin" />
            <p className="text-xs text-white/40">Загружаем приглашение…</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              {chat.avatar ? (
                <img src={normalizeMediaUrl(chat.avatar)} alt="" className="w-20 h-20 rounded-3xl object-cover shadow-lg" />
              ) : (
                <div
                  className="w-20 h-20 rounded-3xl flex items-center justify-center text-2xl font-bold text-white/80 shadow-lg"
                  style={{
                    background: chat.customColor
                      ? `linear-gradient(135deg, ${chat.customColor}, ${chat.customColor}88)`
                      : 'linear-gradient(135deg, hsl(230 100% 62%), hsl(180 90% 45%))',
                  }}
                >
                  {chat.customIcon || getInitials(chat.name)}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold text-white">{chat.name}</h2>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-xs text-white/50">
                <Users size={12} className="text-white/35" />
                {chat.memberCount} участников
                <span className="text-white/20">•</span>
                {chat.type === 'channel' ? 'канал' : 'группа'}
              </p>
            </div>

            {chat.rules && (
              <p className="text-[11px] text-white/40 leading-relaxed bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 max-h-20 overflow-y-auto">
                {chat.rules}
              </p>
            )}

            <button
              onClick={handleJoin}
              disabled={joining}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-all disabled:opacity-60"
            >
              {joining ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {joining ? 'Вступаем…' : 'Вступить в чат'}
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}