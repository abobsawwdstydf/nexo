import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeOff, Plus, Copy, Check, X, Link, Timer, Shield, LogOut, Users, Loader,
  RefreshCw, AlertTriangle, Ghost,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface IncognitoChatsProps {
  onClose: () => void;
}

interface IncognitoChat {
  id: string;
  alias: string;
  peerAlias: string;
  isActive: boolean;
  encrypted: boolean;
  expiresAt: string | null;
  messageCount: number;
}

const ALIASES = ['Фантом', 'Призрак', 'Тень', 'Шёпот', 'Наблюдатель', 'Страж', 'Странник', 'Вестник'];

export default function IncognitoChats({ onClose }: IncognitoChatsProps) {
  const [chats, setChats] = useState<IncognitoChat[]>([
    { id: '1', alias: 'Фантом', peerAlias: 'Тень', isActive: true, encrypted: true, expiresAt: '2025-01-20T00:00:00', messageCount: 24 },
    { id: '2', alias: 'Шёпот', peerAlias: 'Наблюдатель', isActive: false, encrypted: true, expiresAt: null, messageCount: 8 },
  ]);
  const [inviteCode, setInviteCode] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [selectedChat, setSelectedChat] = useState<IncognitoChat | null>(null);

  const createChat = useCallback(async () => {
    setCreating(true);
    try {
      const alias = ALIASES[Math.floor(Math.random() * ALIASES.length)];
      const code = Math.random().toString(36).slice(2, 10).toUpperCase();
      const newChat: IncognitoChat = {
        id: Date.now().toString(),
        alias,
        peerAlias: 'Ожидание...',
        isActive: true,
        encrypted: true,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        messageCount: 0,
      };
      setChats(prev => [newChat, ...prev]);
      setInviteCode(code);
      toast.success('Инкогнито-чат создан');
    } catch {
      toast.error('Ошибка создания');
    } finally {
      setCreating(false);
    }
  }, []);

  const handleJoin = useCallback(() => {
    if (!joinCode.trim()) return;
    toast.success('Подключение к чату...');
    setJoinCode('');
  }, [joinCode]);

  const handleCopyCode = useCallback(() => {
    if (inviteCode) {
      navigator.clipboard.writeText(inviteCode);
      setCopiedCode(true);
      toast.success('Код скопирован');
      setTimeout(() => setCopiedCode(false), 2000);
    }
  }, [inviteCode]);

  const handleLeave = useCallback((id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    setSelectedChat(null);
    toast.success('Вы покинули чат');
  }, []);

  const formatExpiry = (iso: string | null) => {
    if (!iso) return 'Без ограничений';
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return 'Истёк';
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}д ${hours}ч`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-slate-500/20 border border-slate-500/20 flex items-center justify-center">
            <EyeOff size={15} className="text-slate-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Инкогнито</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={createChat} disabled={creating}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Создать чат">
            {creating ? <Loader size={15} className="text-white/40 animate-spin" /> : <Plus size={15} className="text-white/40" />}
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Invite code */}
      <AnimatePresence>
        {inviteCode && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-3">
              <p className="text-[10px] text-white/30 uppercase mb-1.5">Код приглашения</p>
              <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <Link size={11} className="text-white/30 flex-shrink-0" />
                <span className="flex-1 text-sm font-mono text-white/60 tracking-wider">{inviteCode}</span>
                <motion.button onClick={handleCopyCode} className="p-1.5 rounded-lg hover:bg-white/[0.08]" whileTap={{ scale: 0.9 }}>
                  {copiedCode ? <Check size={12} className="text-green-400/70" /> : <Copy size={12} className="text-white/30" />}
                </motion.button>
                <button onClick={() => setInviteCode('')} className="p-1.5 rounded-lg hover:bg-white/[0.08]"><X size={12} className="text-white/30" /></button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join by code */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="flex gap-2">
          <input type="text" value={joinCode} onChange={e => setJoinCode(e.target.value)} placeholder="Ввести код приглашения..."
            className="flex-1 h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20 font-mono uppercase" />
          <motion.button onClick={handleJoin} disabled={!joinCode.trim()}
            className="px-3 h-9 rounded-xl bg-white/[0.06] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.1] transition-colors disabled:opacity-40"
            whileTap={{ scale: 0.95 }}>
            <RefreshCw size={14} />
          </motion.button>
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {chats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Ghost size={28} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30 mb-1">Нет инкогнито-чатов</p>
            <p className="text-xs text-white/15">Создайте или присоединитесь по коду</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {chats.map(chat => (
              <motion.div key={chat.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                onClick={() => setSelectedChat(selectedChat?.id === chat.id ? null : chat)}
                className={`p-3 rounded-xl border cursor-pointer transition-colors ${chat.isActive ? 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]' : 'bg-white/[0.01] border-white/[0.03] opacity-60'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-500/10 border border-slate-500/20 flex items-center justify-center">
                      <EyeOff size={12} className="text-slate-400/60" />
                    </div>
                    <div>
                      <p className="text-xs text-white/70 font-medium">{chat.alias}</p>
                      <p className="text-[10px] text-white/30">← {chat.peerAlias}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-white/25">{chat.messageCount} сообщ.</p>
                    <p className="text-[9px] text-white/15">{formatExpiry(chat.expiresAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {chat.encrypted && (
                    <span className="flex items-center gap-0.5 text-[9px] text-emerald-400/40"><Shield size={8} />E2E</span>
                  )}
                  <span className={`w-1.5 h-1.5 rounded-full ${chat.isActive ? 'bg-green-400/60' : 'bg-white/15'}`} />
                </div>
                {selectedChat?.id === chat.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="mt-2 pt-2 border-t border-white/[0.04] flex gap-1.5">
                    <motion.button onClick={(e) => { e.stopPropagation(); handleLeave(chat.id); }}
                      className="flex-1 py-1.5 rounded-lg bg-red-500/10 text-[10px] text-red-400/50 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1"
                      whileTap={{ scale: 0.95 }}>
                      <LogOut size={10} />Покинуть
                    </motion.button>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}