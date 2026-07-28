import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Edit3, Trash2, X, Check, Copy, Search, Send, Tag,
  ChevronDown, Loader, Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface MessageTemplatesProps {
  onClose: () => void;
  onInsert?: (text: string) => void;
}

interface Template {
  id: string;
  name: string;
  content: string;
  shortcut: string;
  category: string;
}

const CATEGORIES = ['Общее', 'Ответы', 'Приветствия', 'Прощания', 'Бизнес', 'Персональные'];

export default function MessageTemplates({ onClose, onInsert }: MessageTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([
    { id: '1', name: 'Приветствие', content: 'Привет! Как дела?', shortcut: '/priv', category: 'Приветствия' },
    { id: '2', name: 'Благодарность', content: 'Спасибо за помощь! 🙏', shortcut: '/spas', category: 'Ответы' },
    { id: '3', name: 'Договорённость', content: 'Хорошо, давай договорились на {дата} в {время}.', shortcut: '/dogov', category: 'Бизнес' },
    { id: '4', name: 'Напоминание', content: 'Напоминаю: {текст}', shortcut: '/napom', category: 'Персональные' },
  ]);
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [shortcut, setShortcut] = useState('');
  const [category, setCategory] = useState('Общее');

  const resetForm = useCallback(() => { setName(''); setContent(''); setShortcut(''); setCategory('Общее'); }, []);

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.content.toLowerCase().includes(search.toLowerCase());
    const matchCat = !activeCategory || t.category === activeCategory;
    return matchSearch && matchCat;
  });

  const handleCreate = useCallback(() => {
    if (!name.trim() || !content.trim()) return;
    if (editId) {
      setTemplates(prev => prev.map(t => t.id === editId ? { ...t, name, content, shortcut, category } : t));
      toast.success('Шаблон обновлён');
    } else {
      setTemplates(prev => [...prev, { id: Date.now().toString(), name, content, shortcut, category }]);
      toast.success('Шаблон создан');
    }
    resetForm();
    setEditId(null);
    setShowCreate(false);
  }, [name, content, shortcut, category, editId, resetForm]);

  const handleEdit = useCallback((t: Template) => {
    setName(t.name);
    setContent(t.content);
    setShortcut(t.shortcut);
    setCategory(t.category);
    setEditId(t.id);
    setShowCreate(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success('Шаблон удалён');
  }, []);

  const handleInsert = useCallback((t: Template) => {
    onInsert?.(t.content);
    toast.success('Шаблон вставлен');
  }, [onInsert]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Скопировано');
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-teal-500/20 border border-teal-500/20 flex items-center justify-center">
            <FileText size={15} className="text-teal-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Шаблоны</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => { setShowCreate(v => !v); setEditId(null); resetForm(); }}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Plus size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск шаблонов..."
            className="w-full h-8 pl-9 pr-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
        </div>
      </div>

      {/* Categories */}
      <div className="flex-shrink-0 px-3 py-1.5 flex gap-1 overflow-x-auto">
        <button onClick={() => setActiveCategory(null)}
          className={`px-2 py-0.5 rounded-lg text-[10px] flex-shrink-0 transition-colors ${!activeCategory ? 'bg-teal-500/15 text-teal-400/70 border border-teal-500/20' : 'text-white/30 hover:bg-white/[0.04]'}`}>
          Все
        </button>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setActiveCategory(activeCategory === c ? null : c)}
            className={`px-2 py-0.5 rounded-lg text-[10px] flex-shrink-0 transition-colors ${activeCategory === c ? 'bg-teal-500/15 text-teal-400/70 border border-teal-500/20' : 'text-white/30 hover:bg-white/[0.04]'}`}>
            {c}
          </button>
        ))}
      </div>

      {/* Create/Edit form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-3 space-y-2">
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Название шаблона..."
                className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
              <textarea value={content} onChange={e => setContent(e.target.value)} rows={3} placeholder="Текст шаблона... (используйте {переменные})"
                className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={shortcut} onChange={e => setShortcut(e.target.value)} placeholder="Шорткат (/cmd)"
                  className="h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none" />
                <select value={category} onChange={e => setCategory(e.target.value)}
                  className="h-8 px-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none">
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setShowCreate(false); setEditId(null); resetForm(); }} className="flex-1 py-2 rounded-xl bg-white/[0.04] text-xs text-white/50">Отмена</button>
                <motion.button onClick={handleCreate} disabled={!name.trim() || !content.trim()}
                  className="flex-1 py-2 rounded-xl bg-teal-500/20 border border-teal-500/20 text-xs text-teal-400/80 font-medium disabled:opacity-40"
                  whileTap={{ scale: 0.98 }}>
                  {editId ? 'Обновить' : 'Создать'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText size={24} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30">Нет шаблонов</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map(t => (
              <motion.div key={t.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors group">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs text-white/70 font-medium">{t.name}</p>
                  {t.shortcut && <span className="text-[9px] text-teal-400/50 font-mono">{t.shortcut}</span>}
                </div>
                <p className="text-[10px] text-white/40 leading-relaxed mb-1.5 whitespace-pre-wrap">{t.content}</p>
                <div className="flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded text-[9px] bg-white/[0.04] text-white/25">{t.category}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleCopy(t.content)} className="p-1 rounded hover:bg-white/[0.08]" title="Копировать">
                      <Copy size={10} className="text-white/30" />
                    </button>
                    {onInsert && (
                      <button onClick={() => handleInsert(t)} className="p-1 rounded hover:bg-white/[0.08]" title="Вставить">
                        <Send size={10} className="text-teal-400/50" />
                      </button>
                    )}
                    <button onClick={() => handleEdit(t)} className="p-1 rounded hover:bg-white/[0.08]" title="Редактировать">
                      <Edit3 size={10} className="text-white/30" />
                    </button>
                    <button onClick={() => handleDelete(t.id)} className="p-1 rounded hover:bg-white/[0.08]" title="Удалить">
                      <Trash2 size={10} className="text-red-400/50" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}