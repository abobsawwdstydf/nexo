import { useState, useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { X, Search, UserPlus, Loader2, Users, Radio, MessageCircle, Hash, Check } from 'lucide-react';
import { api } from '../lib/api';
import { UserAvatar, OnlineDot } from './UserAvatar';
import { getDomain } from '../lib/getDomain';
import type { Chat, UserPresence } from '../lib/types';

type CreateTab = 'personal' | 'group' | 'channel';

interface NewChatModalProps {
  initialTab?: CreateTab;
  onClose: () => void;
  onChatCreated: (chat: Chat | null) => void;
}

const TABS: { id: CreateTab; label: string; icon: typeof MessageCircle }[] = [
  { id: 'personal', label: 'Личный', icon: MessageCircle },
  { id: 'group', label: 'Группа', icon: Users },
  { id: 'channel', label: 'Канал', icon: Radio },
];

export default function NewChatModal({ initialTab = 'personal', onClose, onChatCreated }: NewChatModalProps) {
  const [tab, setTab] = useState<CreateTab>(initialTab);

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
          <div>
            <h2 className="text-sm font-semibold text-white/90 font-display">Создать</h2>
            <p className="text-[11px] text-white/30">
              {tab === 'personal' ? 'Начните личный диалог' : tab === 'group' ? 'Группа для друзей' : 'Публичный канал'}
            </p>
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

        {/* Tabs */}
        <div className="flex gap-1 px-4 pt-3">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all duration-200 ${
                tab === t.id
                  ? 'bg-white/[0.08] text-white/90'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.03]'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'personal' && (
          <PersonalTab onClose={onClose} onChatCreated={onChatCreated} />
        )}
        {tab === 'group' && (
          <GroupTab onClose={onClose} onChatCreated={onChatCreated} />
        )}
        {tab === 'channel' && (
          <ChannelTab onClose={onClose} onChatCreated={onChatCreated} />
        )}
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════ Personal ═══════════════════════════ */

function PersonalTab({ onClose, onChatCreated }: { onClose: () => void; onChatCreated: (chat: Chat | null) => void }) {
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
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await api.searchUsers(query);
        if (cancelled) return;
        setResults(Array.isArray(users) ? users : []);
        setError('');
      } catch {
        if (cancelled) return;
        setError('Ошибка поиска');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const handleStartChat = async (userId: string) => {
    setCreating(userId);
    setError('');
    try {
      const chat = await api.createPersonalChat(userId);
      onChatCreated(chat);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания чата');
    } finally {
      setCreating(null);
    }
  };

  return (
    <div>
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
      <div className="px-2 pb-2 min-h-[240px] max-h-[400px] overflow-y-auto">
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
          <EmptyState icon={<Search size={26} className="text-white/15" />} title="Введите имя или username" hint="Минимум 2 символа" />
        ) : results.length === 0 ? (
          <EmptyState icon={<MessageCircle size={26} className="text-white/15" />} title="Ничего не найдено" hint="Попробуйте другой запрос" />
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
                    <span className="text-sm font-medium text-white/80 truncate">{u.displayName}</span>
                    {u.isOnline && <span className="text-[10px] text-green-400/60">в сети</span>}
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
        {error && <p className="text-xs text-red-400/70 text-center pt-2">{error}</p>}
      </div>
    </div>
  );
}

/* ═══════════════════════════ Group ═══════════════════════════ */

function GroupTab({ onClose, onChatCreated }: { onClose: () => void; onChatCreated: (chat: Chat | null) => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserPresence[]>([]);
  const [selected, setSelected] = useState<UserPresence[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await api.searchUsers(query);
        if (cancelled) return;
        setResults(Array.isArray(users) ? users : []);
      } catch {
        if (!cancelled) setError('Ошибка поиска');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query]);

  const toggleSelect = (u: UserPresence) => {
    setSelected(prev =>
      prev.some(x => x.id === u.id) ? prev.filter(x => x.id !== u.id) : [...prev, u]
    );
  };

  const isValid = name.trim().length >= 2 && selected.length >= 1;

  const handleCreate = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const chat = await api.createGroup(
        name.trim(),
        selected.map(u => u.id),
        username.trim() || undefined,
      );
      onChatCreated(chat);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания группы');
    } finally {
      setSubmitting(false);
    }
  };

  const shownResults = results.filter(u => !selected.some(x => x.id === u.id));

  return (
    <div className="px-5 py-4 space-y-3">
      <div>
        <label className="block text-xs text-white/40 mb-1.5">Название группы</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Например: Банда котиков"
          maxLength={64}
          className="w-full h-10 px-4 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
        />
      </div>

      <div>
        <label className="block text-xs text-white/40 mb-1.5">
          Username <span className="text-white/20">(для публичной группы, необязательно)</span>
        </label>
        <div className="relative">
          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="banda_kotikov"
            maxLength={32}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>
        {username.length >= 3 && (
          <p className="text-[10px] text-white/20 mt-1">
            {getDomain()}/@{username}
          </p>
        )}
      </div>

      {/* Selected members */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map(u => (
            <span
              key={u.id}
              className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg bg-white/[0.06] border border-white/[0.06]"
            >
              <UserAvatar user={u} size="sm" />
              <span className="text-[11px] text-white/70 max-w-[120px] truncate">{u.displayName}</span>
              <button
                onClick={() => toggleSelect(u)}
                className="p-0.5 rounded hover:bg-white/[0.08] transition-colors"
              >
                <X size={10} className="text-white/40" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Добавить участников..."
            className="w-full h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>
      </div>

      <div className="max-h-[220px] overflow-y-auto -mx-1 px-1">
        {loading ? (
          <div className="flex flex-col gap-2 px-3 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2">
                <div className="w-9 h-9 rounded-xl skeleton-shimmer bg-white/[0.04]" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded skeleton-shimmer bg-white/[0.04]" />
                  <div className="h-2 w-14 rounded skeleton-shimmer bg-white/[0.03]" />
                </div>
              </div>
            ))}
          </div>
        ) : query.length < 2 ? (
          <p className="text-[11px] text-white/25 text-center py-4">Начните вводить имя, чтобы добавить участника</p>
        ) : shownResults.length === 0 ? (
          <p className="text-[11px] text-white/25 text-center py-4">Все найденные уже добавлены</p>
        ) : (
          <div className="space-y-0.5">
            {shownResults.map(u => (
              <button
                key={u.id}
                onClick={() => toggleSelect(u)}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/[0.04] transition-colors text-left"
              >
                <div className="relative flex-shrink-0">
                  <UserAvatar user={u} />
                  {u.isOnline && <OnlineDot />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-white/80 truncate block">{u.displayName}</span>
                  <span className="text-xs text-white/30 truncate block">@{u.username}</span>
                </div>
                <div className="w-5 h-5 rounded-full border border-white/20 flex items-center justify-center">
                  {selected.some(x => x.id === u.id) && <Check size={12} className="text-emerald-400" />}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-xs text-red-400/70">{error}</p>}

      <div className="flex items-center justify-end gap-2 pt-1">
        <motion.button
          onClick={onClose}
          className="px-4 py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Отмена
        </motion.button>
        <motion.button
          onClick={handleCreate}
          disabled={!isValid || submitting}
          className="px-5 py-2 text-xs font-medium bg-accent/15 hover:bg-accent/25 border border-accent/20 text-accent rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          whileHover={isValid ? { scale: 1.03 } : {}}
          whileTap={isValid ? { scale: 0.97 } : {}}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Создание...
            </span>
          ) : (
            'Создать группу'
          )}
        </motion.button>
      </div>
    </div>
  );
}

/* ═══════════════════════════ Channel ═══════════════════════════ */

function ChannelTab({ onClose, onChatCreated }: { onClose: () => void; onChatCreated: (chat: Chat | null) => void }) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim().length >= 2 && username.trim().length >= 3;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createChannel(
        name.trim(),
        username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        description.trim() || undefined,
      );
      onChatCreated(null);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания канала');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-5 py-4 space-y-4">
      <div>
        <label className="block text-xs text-white/40 mb-1.5">Название канала</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Например: Новости дня"
          maxLength={64}
          className="w-full h-10 px-4 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
        />
      </div>

      <div>
        <label className="block text-xs text-white/40 mb-1.5">
          Username <span className="text-white/20">(ссылка на канал)</span>
        </label>
        <div className="relative">
          <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
            placeholder="novosti_dnya"
            maxLength={32}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
          />
        </div>
        {username.length >= 3 && (
          <p className="text-[10px] text-white/20 mt-1">
            {getDomain()}/@{username}
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs text-white/40 mb-1.5">
          Описание <span className="text-white/20">(необязательно)</span>
        </label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="О чём ваш канал?"
          maxLength={255}
          rows={3}
          className="w-full px-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06] resize-none"
        />
      </div>

      {error && <p className="text-xs text-red-400/70">{error}</p>}

      <div className="flex items-center justify-end gap-2">
        <motion.button
          onClick={onClose}
          className="px-4 py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          Отмена
        </motion.button>
        <motion.button
          onClick={handleSubmit}
          disabled={!isValid || submitting}
          className="px-5 py-2 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/20 text-rose-300/80 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
          whileHover={isValid ? { scale: 1.03 } : {}}
          whileTap={isValid ? { scale: 0.97 } : {}}
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Создание...
            </span>
          ) : (
            'Создать канал'
          )}
        </motion.button>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-[240px] text-center">
      {icon}
      <p className="text-sm text-white/30 mt-3">{title}</p>
      <p className="text-xs text-white/20 mt-1">{hint}</p>
    </div>
  );
}
