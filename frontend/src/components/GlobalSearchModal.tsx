import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Search, X, MessageSquare, Hash, Loader2, CornerDownLeft, Paperclip, Calendar } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import type { Message } from '../lib/types';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
  onSelect: (message: Message) => void;
}

interface SearchResultItem {
  message: Message;
  chat?: { id: string; type: string; name: string; username: string; avatar: string | null } | null;
}

type MediaFilter = '' | 'photo' | 'video' | 'audio' | 'file';

const MEDIA_CHIPS: { key: MediaFilter; label: string }[] = [
  { key: '', label: 'Все' },
  { key: 'photo', label: 'Фото' },
  { key: 'video', label: 'Видео' },
  { key: 'audio', label: 'Аудио' },
  { key: 'file', label: 'Файлы' },
];

/** Глобальный поиск по всем чатам (FTS5-индекс на сервере). Ctrl+K / Cmd+K. */
export function GlobalSearchModal({ open, onClose, onSelect }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('');
  const [hasMedia, setHasMedia] = useState(false);
  const [showDates, setShowDates] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setResults([]);
      setSearched(false);
      setMediaFilter('');
      setHasMedia(false);
      setShowDates(false);
      setDateFrom('');
      setDateTo('');
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query.trim(), pageSize: '25' });
        if (mediaFilter) {
          params.set('mediaType', mediaFilter);
          params.set('hasMedia', 'true');
        } else if (hasMedia) {
          params.set('hasMedia', 'true');
        }
        if (dateFrom) params.set('dateFrom', dateFrom);
        if (dateTo) params.set('dateTo', dateTo);
        const data = await api.request<{ items?: SearchResultItem[] }>(
          `/messages/search?${params.toString()}`
        );
        if (cancelled) return;
        setResults(Array.isArray(data?.items) ? data.items : []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
          setSearched(true);
        }
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [query, open, mediaFilter, hasMedia, dateFrom, dateTo]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  if (!open) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[10vh] bg-black/70 backdrop-blur-md"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -12 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg rounded-2xl liquid-glass-strong overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06]">
          <Search size={17} className="text-white/30 flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Поиск по всем чатам (минимум 2 символа)..."
            className="flex-1 bg-transparent text-sm text-white/85 placeholder:text-white/25 outline-none"
          />
          {loading ? (
            <Loader2 size={14} className="text-white/30 animate-spin flex-shrink-0" />
          ) : (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0">
              <X size={15} className="text-white/40" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/[0.06] flex-wrap">
          {MEDIA_CHIPS.map(chip => (
            <button
              key={chip.key}
              onClick={() => setMediaFilter(chip.key)}
              className={`px-2.5 h-6 rounded-full text-[10px] font-medium transition-colors ${
                mediaFilter === chip.key
                  ? 'bg-white/15 text-white border border-white/20'
                  : 'text-white/35 hover:text-white/60 hover:bg-white/[0.06] border border-transparent'
              }`}
            >
              {chip.label}
            </button>
          ))}
          <button
            onClick={() => setHasMedia(v => !v)}
            disabled={!!mediaFilter}
            className={`flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${
              hasMedia && !mediaFilter
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-white/35 hover:text-white/60 hover:bg-white/[0.06] border border-transparent'
            }`}
          >
            <Paperclip size={10} />
            С вложениями
          </button>
          <button
            onClick={() => setShowDates(v => !v)}
            className={`flex items-center gap-1 px-2.5 h-6 rounded-full text-[10px] font-medium transition-colors ${
              showDates || dateFrom || dateTo
                ? 'bg-white/15 text-white border border-white/20'
                : 'text-white/35 hover:text-white/60 hover:bg-white/[0.06] border border-transparent'
            }`}
          >
            <Calendar size={10} />
            Дата
          </button>
        </div>

        {/* Date range (collapsible) */}
        {showDates && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/[0.06]">
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={e => setDateFrom(e.target.value)}
              className="flex-1 min-w-0 h-7 px-2 text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/70 outline-none [color-scheme:dark]"
            />
            <span className="text-[10px] text-white/25 flex-shrink-0">—</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={e => setDateTo(e.target.value)}
              className="flex-1 min-w-0 h-7 px-2 text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/70 outline-none [color-scheme:dark]"
            />
          </div>
        )}

        {/* Results */}
        <div className="max-h-[46vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-white/25">
              <CornerDownLeft size={13} />
              Введите запрос для поиска по всем сообщениям
            </div>
          ) : !loading && searched && results.length === 0 ? (
            <div className="py-10 text-center">
              <MessageSquare size={22} className="mx-auto mb-2 text-white/15" />
              <p className="text-xs text-white/30">Ничего не найдено</p>
            </div>
          ) : (
            <div className="p-1.5">
              {results.map(({ message, chat: msgChat }) => (
                <button
                  key={message.id}
                  onClick={() => onSelect({ ...message, chatId: message.chatId || msgChat?.id || '' })}
                  className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.05] transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.06] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {msgChat?.avatar ? (
                      <img src={normalizeMediaUrl(msgChat.avatar)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Hash size={14} className="text-white/25" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-white/80 truncate">
                        {msgChat?.name || msgChat?.username || 'Чат'}
                      </span>
                      {message.sender && (
                        <span className="text-[10px] text-white/30 flex-shrink-0">
                          {message.sender.displayName || message.sender.username}
                        </span>
                      )}
                      <span className="text-[10px] text-white/20 ml-auto flex-shrink-0">
                        {formatSearchTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-xs text-white/45 truncate mt-0.5">
                      {message.content || (message.media?.length ? '📎 Вложение' : '')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/[0.06] flex items-center gap-4 text-[10px] text-white/25">
          <span>FTS5-поиск по всем вашим чатам</span>
          <span className="ml-auto flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-white/[0.06] border border-white/[0.08]">Esc</kbd>
            закрыть
          </span>
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatSearchTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: '2-digit' });
}