import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { X, Tag, Check } from 'lucide-react';
import { api } from '../lib/api';
import BottomSheet from './BottomSheet';

interface MessageTagModalProps {
  isOpen: boolean;
  messageId: string;
  onClose: () => void;
  onSave?: (tags: string[]) => void;
  existingTags?: string[];
}

const PRESET_TAGS = [
  { label: '⭐ Важное', value: 'important', color: '#f59e0b' },
  { label: '📌 Задача', value: 'task', color: '#3b82f6' },
  { label: '💡 Идея', value: 'idea', color: '#8b5cf6' },
  { label: '✅ Сделано', value: 'done', color: '#10b981' },
  { label: '❓ Вопрос', value: 'question', color: '#06b6d4' },
  { label: '🔗 Ссылка', value: 'link', color: '#f97316' },
  { label: '📎 Файл', value: 'file', color: '#6b7280' },
  { label: '💬 Цитата', value: 'quote', color: '#ec4899' },
];

export default function MessageTagModal({ isOpen, messageId, onClose, onSave, existingTags = [] }: MessageTagModalProps) {
  const [selected, setSelected] = useState<string[]>(existingTags);
  const [customTag, setCustomTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (isOpen && messageId) {
      loadTags();
    }
  }, [isOpen, messageId]);

  const loadTags = async () => {
    try {
      const tags = await api.get(`/message-tags/${messageId}`);
      setSelected(tags.map((t: any) => t.tag));
    } catch (error) {
      console.error('Failed to load tags:', error);
    }
  };

  const toggleTag = async (tag: string) => {
    const isRemoving = selected.includes(tag);
    
    // Оптимистичное обновление UI
    setSelected(prev =>
      isRemoving ? prev.filter(t => t !== tag) : [...prev, tag]
    );

    try {
      if (isRemoving) {
        // Найти ID тега для удаления
        const tags = await api.get(`/message-tags/${messageId}`);
        const tagToDelete = tags.find((t: any) => t.tag === tag);
        if (tagToDelete) {
          await api.delete(`/message-tags/${tagToDelete.id}`);
        }
      } else {
        // Добавить новый тег
        await api.post('/message-tags', {
          messageId,
          tag,
          color: PRESET_TAGS.find(t => t.value === tag)?.color || '#3b82f6',
        });
      }
    } catch (error) {
      console.error('Failed to toggle tag:', error);
      // Откатить изменения при ошибке
      setSelected(prev =>
        isRemoving ? [...prev, tag] : prev.filter(t => t !== tag)
      );
    }
  };

  const addCustomTag = async () => {
    const tag = customTag.trim().toLowerCase().replace(/\s+/g, '_');
    if (!tag || selected.includes(tag)) return;

    setSelected(prev => [...prev, tag]);
    setCustomTag('');

    try {
      await api.post('/message-tags', {
        messageId,
        tag,
        color: '#3b82f6',
      });
    } catch (error) {
      console.error('Failed to add custom tag:', error);
      setSelected(prev => prev.filter(t => t !== tag));
    }
  };

  const handleSave = () => {
    if (onSave) {
      onSave(selected);
    }
    onClose();
  };

  if (!isOpen) return null;

  const content = (
    <div className="p-5 space-y-4">
      {/* Preset tags */}
      <div className="grid grid-cols-2 gap-2">
        {PRESET_TAGS.map(tag => (
          <button
            key={tag.value}
            onClick={() => toggleTag(tag.value)}
            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all ${
              selected.includes(tag.value)
                ? 'bg-white/10 border border-white/20'
                : 'bg-white/5 border border-white/5 hover:bg-white/10'
            }`}
          >
            <span className="flex-1 text-left text-zinc-200">{tag.label}</span>
            {selected.includes(tag.value) && (
              <Check size={14} className="text-emerald-400 flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {/* Custom tag */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customTag}
          onChange={e => setCustomTag(e.target.value)}
          placeholder="Свой тег..."
          className="flex-1 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
          onKeyDown={e => e.key === 'Enter' && addCustomTag()}
        />
        <button
          onClick={addCustomTag}
          className="px-3 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 text-sm transition-colors"
        >
          +
        </button>
      </div>

      {/* Selected tags */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map(tag => (
            <span
              key={tag}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs cursor-pointer hover:bg-red-500/20 hover:text-red-300 transition-colors"
              onClick={() => toggleTag(tag)}
            >
              #{tag}
              <X size={10} />
            </span>
          ))}
        </div>
      )}

      <button
        onClick={handleSave}
        className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors"
      >
        Сохранить теги
      </button>
    </div>
  );

  const header = (
    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center">
          <Tag size={16} className="text-amber-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">Теги сообщения</h3>
      </div>
      <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
        <X size={18} />
      </button>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <BottomSheet isOpen={isOpen} onClose={onClose} showCloseButton={false}>
        {header}
        {content}
      </BottomSheet>,
      document.body
    );
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {header}
        {content}
      </motion.div>
    </motion.div>,
    document.body
  );
}
