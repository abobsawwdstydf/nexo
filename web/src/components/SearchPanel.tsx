import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Calendar, User, FileText, Image, Video, Music, Hash, Filter } from 'lucide-react';
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
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-3xl h-[80vh] rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/5 flex items-center gap-3">
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus-within:border-nexo-500/50 transition-colors">
            <Search size={18} className="text-zinc-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Поиск по сообщениям..."
              className="flex-1 bg-transparent text-white placeholder-zinc-500 outline-none"
              autoFocus
            />
            {query && (
              <button
                onClick={() => {
                  setQuery('');
                  setResults([]);
                }}
                className="p-1 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg transition-colors relative ${
              showFilters || hasActiveFilters
                ? 'bg-nexo-500/20 text-nexo-400'
                : 'bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
            title="Фильтры"
          >
            <Filter size={18} />
            {hasActiveFilters && (
              <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-nexo-500" />
            )}
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Filters */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-b border-white/5 overflow-hidden"
            >
              <div className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {/* Тип файла */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">Тип</label>
                    <select
                      value={filterType}
                      onChange={(e) => setFilterType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-nexo-500/50"
                    >
                      <option value="">Все типы</option>
                      <option value="text">Текст</option>
                      <option value="image">Фото</option>
                      <option value="video">Видео</option>
                      <option value="voice">Голосовые</option>
                      <option value="file">Файлы</option>
                    </select>
                  </div>

                  {/* Дата от */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">От даты</label>
                    <input
                      type="date"
                      value={filterDateFrom}
                      onChange={(e) => setFilterDateFrom(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-nexo-500/50"
                    />
                  </div>

                  {/* Дата до */}
                  <div>
                    <label className="text-xs text-zinc-500 mb-1.5 block">До даты</label>
                    <input
                      type="date"
                      value={filterDateTo}
                      onChange={(e) => setFilterDateTo(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-nexo-500/50"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSearch}
                    className="flex-1 py-2 rounded-lg bg-nexo-500 hover:bg-nexo-600 text-white font-medium transition-colors"
                  >
                    Применить
                  </button>
                  {hasActiveFilters && (
                    <button
                      onClick={() => {
                        clearFilters();
                        handleSearch();
                      }}
                      className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium transition-colors"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {isSearching ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-4 border-nexo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
              <Search size={48} className="opacity-30" />
              <p className="text-sm">
                {query ? 'Ничего не найдено' : 'Введите запрос для поиска'}
              </p>
            </div>
          ) : (
            <div className="p-2">
              <div className="px-2 py-2 text-xs text-zinc-500">
                Найдено: {total} {total === 1 ? 'сообщение' : total < 5 ? 'сообщения' : 'сообщений'}
              </div>
              <div className="space-y-1">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => {
                      onSelectMessage(result.id, result.chat.id);
                      onClose();
                    }}
                    className="w-full p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={result.sender.avatar}
                        name={result.sender.displayName || result.sender.username}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-white">
                            {result.sender.displayName || result.sender.username}
                          </span>
                          {getTypeIcon(result.type)}
                          <span className="text-xs text-zinc-500">
                            {formatDistanceToNow(new Date(result.createdAt), { addSuffix: true, locale: ru })}
                          </span>
                        </div>
                        <div className="text-sm text-zinc-300 line-clamp-2">
                          {highlightText(result.content || '[медиа]', query)}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          в {result.chat.name || 'личном чате'}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
