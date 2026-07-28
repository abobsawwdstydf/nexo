import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, UserPlus, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { UserPresence } from '../lib/types';

interface NewChatModalProps {
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

function UserAvatar({ user }: { user: { avatar: string | null; displayName: string } }) {
  const initials = user.displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.displayName}
        className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
      />
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
      <span className="text-xs font-medium text-white/50">{initials}</span>
    </div>
  );
}

function OnlineDot() {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400/80 border-2 border-[#0a0a0f]" />
  );
}

export default function NewChatModal({ onClose, onChatCreated }: NewChatModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await api.searchUsers(query);
        setResults(Array.isArray(users) ? users : []);
        setError('');
      } catch {
        setError('Ошибка поиска');
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const handleStartChat = async (userId: string) => {
    setCreating(userId);
    setError('');
    try {
      const chat = await api.createPersonalChat(userId);
      onChatCreated(chat.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания чата');
    } finally {
      setCreating(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl liquid-glass-strong overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center">
              <UserPlus size={16} className="text-emerald-400/70" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90 font-display">Новый чат</h2>
              <p className="text-[11px] text-white/30">Начните личный диалог</p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={16} className="text-white/40" />
          </motion.button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Поиск пользователей..."
              autoFocus
              className="w-full h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
            />
          </div>
        </div>

        {/* Results */}
        <div className="px-2 pb-2 min-h-[200px] max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex flex-col gap-2 px-3 pt-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="w-10 h-10 rounded-xl skeleton-shimmer bg-white/[0.04]" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 w-24 rounded skeleton-shimmer bg-white/[0.04]" />
                    <div className="h-2 w-16 rounded skeleton-shimmer bg-white/[0.03]" />
                  </div>
                </div>
              ))}
            </div>
          ) : query.length < 2 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <Search size={28} className="text-white/15 mb-3" />
              <p className="text-sm text-white/30">Введите имя или username</p>
              <p className="text-xs text-white/20 mt-1">Минимум 2 символа</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[200px] text-center">
              <p className="text-sm text-white/30">Ничего не найдено</p>
              <p className="text-xs text-white/20 mt-1">Попробуйте другой запрос</p>
            </div>
          ) : (
            <div className="space-y-0.5">
              {results.map(u => (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors group cursor-pointer"
                  onClick={() => handleStartChat(u.id)}
                >
                  <div className="relative flex-shrink-0">
                    <UserAvatar user={u} />
                    {u.isOnline && <OnlineDot />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white/80 truncate">
                        {u.displayName}
                      </span>
                      {u.isOnline && (
                        <span className="text-[10px] text-green-400/60">в сети</span>
                      )}
                    </div>
                    <p className="text-xs text-white/30 truncate">@{u.username}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleStartChat(u.id); }}
                    disabled={creating === u.id}
                    className="p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 transition-colors flex-shrink-0 opacity-0 group-hover:opacity-100"
                  >
                    {creating === u.id ? (
                      <Loader2 size={14} className="text-emerald-400/70 animate-spin" />
                    ) : (
                      <UserPlus size={14} className="text-emerald-400/70" />
                    )}
                  </button>
                </motion.div>
              ))}
            </div>
          )}
          {error && (
            <p className="text-xs text-red-400/70 text-center pt-2">{error}</p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
