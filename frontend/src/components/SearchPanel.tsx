import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Calendar, User, FileText, Image, Video, Music, Hash, Filter } from 'lucide-react';
import { ClearInput } from './ClearInput';
import { api } from '../lib/api';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import Avatar from './Avatar';

interface SearchPanelProps {
  onClose: () => void;
  onSelectMessage: (messageId: string, chatId: string) => void;
}

interface SearchResult {
  id: string;
  content: string;
  type: string;
  createdAt: string;
  sender: {
    id: string;
    username: string;
    displayName: string;
    avatar: string | null;
  };
  chat: {
    id: string;
    type: string;
    name: string | null;
    avatar: string | null;
  };
  media: any[];
}

export default function SearchPanel({ onClose, onSelectMessage }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [total, setTotal] = useState(0);
  
  // Фильтры
  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState<string>('');
  const [filterSender, setFilterSender] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '50',
        offset: '0',
      });

      if (filterType) params.append('type', filterType);
      if (filterSender) params.append('senderId', filterSender);
      if (filterDateFrom) params.append('dateFrom', filterDateFrom);
      if (filterDateTo) params.append('dateTo', filterDateTo);

      const response = await api.get(`/search/global?${params.toString()}`);
      setResults(response.messages || []);
      setTotal(response.total || 0);
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const clearFilters = () => {
    setFilterType('');
    setFilterSender('');
    setFilterDateFrom('');
    setFilterDateTo('');
  };

  const hasActiveFilters = filterType || filterSender || filterDateFrom || filterDateTo;

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image size={14} />;
      case 'video': return <Video size={14} />;
      case 'voice':
      case 'audio': return <Music size={14} />;
      case 'file': return <FileText size={14} />;
      default: return null;
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query) return text;
    const parts = text.split(new RegExp(`(${query})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === query.toLowerCase() 
        ? <mark key={i} className="bg-nexo-500/30 text-nexo-300">{part}</mark>
        : part
    );
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
        className="relative w-full max-w-3xl h-[80vh] rounded-[1.5rem] bg-[#141418] border border-white/[0.07] shadow-[0_0_80px_rgba(123,97,255,0.06)] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        {/* Header with modern search input */}
        <div className="p-5 border-b border-white/[0.06] flex items-center gap-3">
          <motion.div 
            className="flex-1 relative"
            initial={false}
            animate={{ scale: query ? 1 : 1 }}
          >
            <div className="flex items-center gap-3 bg-white/[0.04] rounded-2xl px-4 py-3 border border-white/[0.06] focus-within:border-nexo-500/30 focus-within:bg-white/[0.06] transition-all duration-300">
              <motion.div
                animate={{ rotate: isSearching ? 360 : 0 }}
                transition={{ duration: 1, repeat: isSearching ? Infinity : 0, ease: 'linear' }}
              >
                <Search size={18} className="text-nexo-400" />
              </motion.div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Найти сообщение, файл, медиа..."
                className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none text-sm"
                autoFocus
              />
              {query && (
                <motion.button
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  onClick={() => { setQuery(''); setResults([]); }}
                  className="p-1 rounded-full bg-white/10 hover:bg-white/15 transition-colors text-zinc-400 hover:text-white"
                >
                  <X size={14} />
                </motion.button>
              )}
            </div>
          </motion.div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFilters(!showFilters)}
            className={`p-3 rounded-2xl transition-all duration-200 relative ${
              showFilters || hasActiveFilters
                ? 'bg-nexo-500/15 text-nexo-400 border border-nexo-500/20'
                : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white border border-white/[0.06]'
            }`}
            title="Фильтры"
          >
            <Filter size={18} />
            {hasActiveFilters && (
              <motion.div 
                initial={{ scale: 0 }} 
                animate={{ scale: 1 }}
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-nexo-500"
              />
            )}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="p-3 rounded-2xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.08] transition-all duration-200 text-zinc-500 hover:text-white/80"
          >
            <X size={18} />
          </motion.button>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="border-b border-white/[0.06] overflow-hidden"
            >
              <div className="p-5 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Тип</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-nexo-500/30 transition-colors appearance-none"
                    >
                      <option value="">Все типы</option>
                      <option value="text">Текст</option>
                      <option value="image">Фото</option>
                      <option value="video">Видео</option>
                      <option value="voice">Голосовые</option>
                      <option value="file">Файлы</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block font-medium">От даты</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-nexo-500/30 transition-colors"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block font-medium">До даты</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-white text-sm focus:outline-none focus:border-nexo-500/30 transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleSearch}
                    className="flex-1 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors text-sm"
                  >
                    Применить
                  </motion.button>
                  {hasActiveFilters && (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { clearFilters(); handleSearch(); }}
                      className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-zinc-300 hover:text-white font-medium transition-colors border border-white/[0.06] text-sm"
                    >
                      Сбросить
                    </motion.button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          {isSearching ? (
            <div className="flex items-center justify-center h-full">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-[3px] border-nexo-500/30 border-t-nexo-500 rounded-full animate-spin" />
                <p className="text-xs text-zinc-500">Поиск...</p>
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                <Search size={28} className="opacity-30 text-nexo-400" />
              </div>
              <p className="text-sm">
                {query ? 'Ничего не найдено' : 'Введите запрос для поиска'}
              </p>
            </div>
          ) : (
            <div className="p-3">
              <div className="px-3 py-2 text-xs text-zinc-500 font-medium">
                Найдено: {total} {total === 1 ? 'сообщение' : total < 5 ? 'сообщения' : 'сообщений'}
              </div>
              <div className="space-y-1">
                {results.map((result, idx) => (
                  <motion.button
                    key={result.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.03, duration: 0.2 }}
                    onClick={() => {
                      onSelectMessage(result.id, result.chat.id);
                      onClose();
                    }}
                    className="w-full p-3.5 rounded-2xl hover:bg-white/[0.04] transition-all duration-200 text-left group"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={result.sender.avatar}
                        name={result.sender.displayName || result.sender.username}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white/90 group-hover:text-white transition-colors">
                            {result.sender.displayName || result.sender.username}
                          </span>
                          {getTypeIcon(result.type)}
                          <span className="text-xs text-zinc-500">
                            {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true, locale: ru })}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-400 line-clamp-2 group-hover:text-zinc-300 transition-colors">
                          {highlightText(result.content || '[медиа]', query)}
                        </div>
                        <div className="text-xs text-zinc-600 mt-1">
                          в {result.chat.name || 'личном чате'}
                        </div>
                      </div>
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
