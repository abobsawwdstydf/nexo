import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bookmark, Search, Tag, Edit3, Trash2, X, Check, Download, Plus, ExternalLink, Clock,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface MessageBookmarksProps {
  onClose: () => void;
}

interface Bookmark {
  id: string;
  text: string;
  chatName: string;
  tags: string[];
  note: string;
  createdAt: string;
}

const AVAILABLE_TAGS = ['Важное', 'Идея', 'Задача', 'Ссылка', 'Цитата', 'Вопрос', 'Ответ'];

export default function MessageBookmarks({ onClose }: MessageBookmarksProps) {
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([
    { id: '1', text: 'Не забыть про дедлайн на проекте NEXO', chatName: 'Рабочий чат', tags: ['Задача', 'Важное'], note: 'Дедлайн 25 января', createdAt: '2025-01-10T14:30:00' },
    { id: '2', text: 'Отличная идея для нового функционала', chatName: 'Дизайн', tags: ['Идея'], note: '', createdAt: '2025-01-12T09:15:00' },
    { id: '3', text: 'https://github.com/nexo/api', chatName: 'Dev', tags: ['Ссылка'], note: 'Репозиторий API', createdAt: '2025-01-13T16:45:00' },
    { id: '4', text: 'Встреча перенесена на среду', chatName: 'Общий', tags: ['Важное'], note: '', createdAt: '2025-01-14T11:00:00' },
  ]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'chat'>('date');

  const filtered = bookmarks.filter(b => {
    const matchSearch = !search || b.text.toLowerCase().includes(search.toLowerCase()) || b.note.toLowerCase().includes(search.toLowerCase());
    const matchTag = !activeTag || b.tags.includes(activeTag);
    return matchSearch && matchTag;
  }).sort((a, b) => {
    if (sortBy === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return a.chatName.localeCompare(b.chatName);
  });

  const handleDelete = useCallback((id: string) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    toast.success('Закладка удалена');
  }, []);

  const startEdit = useCallback((b: Bookmark) => {
    setEditingId(b.id);
    setEditNote(b.note);
  }, []);

  const saveEdit = useCallback((id: string) => {
    setBookmarks(prev => prev.map(b => b.id === id ? { ...b, note: editNote } : b));
    setEditingId(null);
    toast.success('Заметка обновлена');
  }, [editNote]);

  const handleExport = useCallback(() => {
    const data = filtered.map(b => ({
      text: b.text,
      chat: b.chatName,
      tags: b.tags,
      note: b.note,
      date: b.createdAt,
    }));
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexo-bookmarks-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Закладки экспортированы');
  }, [filtered]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/20 flex items-center justify-center">
            <Bookmark size={15} className="text-amber-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Закладки</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={handleExport} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }} title="Экспорт">
            <Download size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск закладок..."
            className="w-full h-8 pl-9 pr-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
        </div>
      </div>

      {/* Tags */}
      <div className="flex-shrink-0 px-3 py-1.5 flex gap-1 overflow-x-auto">
        <button onClick={() => setActiveTag(null)}
          className={`px-2 py-0.5 rounded-lg text-[10px] flex-shrink-0 transition-colors ${!activeTag ? 'bg-amber-500/15 text-amber-400/70 border border-amber-500/20' : 'text-white/30 hover:bg-white/[0.04]'}`}>
          Все
        </button>
        {AVAILABLE_TAGS.map(tag => (
          <button key={tag} onClick={() => setActiveTag(activeTag === tag ? null : tag)}
            className={`px-2 py-0.5 rounded-lg text-[10px] flex-shrink-0 transition-colors ${activeTag === tag ? 'bg-amber-500/15 text-amber-400/70 border border-amber-500/20' : 'text-white/30 hover:bg-white/[0.04]'}`}>
            {tag}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex-shrink-0 px-3 py-1 flex items-center gap-2">
        <span className="text-[10px] text-white/25">Сортировка:</span>
        <button onClick={() => setSortBy('date')} className={`text-[10px] ${sortBy === 'date' ? 'text-amber-400/70' : 'text-white/25'}`}>По дате</button>
        <span className="text-white/10">·</span>
        <button onClick={() => setSortBy('chat')} className={`text-[10px] ${sortBy === 'chat' ? 'text-amber-400/70' : 'text-white/25'}`}>По чату</button>
      </div>

      {/* Bookmarks */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bookmark size={24} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30">Нет закладок</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(b => (
              <motion.div key={b.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] group hover:bg-white/[0.05] transition-colors">
                <p className="text-xs text-white/60 leading-relaxed mb-1.5">{b.text}</p>
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  {b.tags.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400/60">{tag}</span>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/25">
                  <span className="flex items-center gap-1"><Clock size={9} />{new Date(b.createdAt).toLocaleDateString('ru-RU')}</span>
                  <span>→ {b.chatName}</span>
                </div>
                {editingId === b.id ? (
                  <div className="mt-2 flex gap-1">
                    <input type="text" value={editNote} onChange={e => setEditNote(e.target.value)}
                      className="flex-1 h-7 px-2 text-[10px] bg-white/[0.04] border border-white/[0.06] rounded-lg text-white/60 outline-none"
                      placeholder="Заметка..." autoFocus />
                    <button onClick={() => saveEdit(b.id)} className="p-1 rounded-lg bg-green-500/10"><Check size={10} className="text-green-400/70" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 rounded-lg bg-white/[0.04]"><X size={10} className="text-white/30" /></button>
                  </div>
                ) : b.note ? (
                  <p className="mt-1.5 text-[10px] text-white/30 italic">📝 {b.note}</p>
                ) : null}
                <div className="flex gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(b)} className="p-1 rounded hover:bg-white/[0.08]"><Edit3 size={10} className="text-white/30" /></button>
                  <button onClick={() => handleDelete(b.id)} className="p-1 rounded hover:bg-white/[0.08]"><Trash2 size={10} className="text-red-400/50" /></button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}