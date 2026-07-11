import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Plus, Edit2, Trash2, Zap } from 'lucide-react';
import { api } from '../lib/api';
import BottomSheet from './BottomSheet';

interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
}

interface QuickReplyModalProps {
  onClose: () => void;
  onSelect: (message: string) => void;
}

export default function QuickReplyModal({ onClose, onSelect }: QuickReplyModalProps) {
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [shortcut, setShortcut] = useState('');
  const [message, setMessage] = useState('');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    loadReplies();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadReplies = async () => {
    try {
      const data = await api.get('/quick-replies');
      setReplies(data);
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error);
    }
  };

  const handleSave = async () => {
    if (!shortcut.trim() || !message.trim()) return;

    try {
      if (editingId) {
        await api.post('/quick-replies', {
          id: editingId,
          shortcut: shortcut.trim(),
          message: message.trim(),
        });
      } else {
        await api.post('/quick-replies', {
          shortcut: shortcut.trim(),
          message: message.trim(),
        });
      }
      await loadReplies();
      setIsCreating(false);
      setEditingId(null);
      setShortcut('');
      setMessage('');
    } catch (error) {
      console.error('Ошибка сохранения шаблона:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return;
    try {
      await api.post('/quick-replies/delete', { id });
      await loadReplies();
    } catch (error) {
      console.error('Ошибка удаления шаблона:', error);
    }
  };

  const handleEdit = (reply: QuickReply) => {
    setEditingId(reply.id);
    setShortcut(reply.shortcut);
    setMessage(reply.message);
    setIsCreating(true);
  };

  const header = (
    <div className="p-4 border-b border-white/5 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Zap size={20} className="text-nexo-400" />
        <h3 className="text-lg font-semibold text-white">Быстрые ответы</h3>
      </div>
      <div className="flex items-center gap-2">
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="px-3 py-1.5 rounded-lg bg-nexo-500 hover:bg-nexo-600 text-white text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <Plus size={16} />
            Создать
          </button>
        )}
        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );

  const body = (
    <div className="flex-1 overflow-y-auto p-4">
      {isCreating ? (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Команда (например: /привет)</label>
            <input
              type="text"
              value={shortcut}
              onChange={(e) => setShortcut(e.target.value)}
              placeholder="/привет"
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block">Сообщение</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Привет! Как дела?"
              rows={4}
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 transition-colors resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!shortcut.trim() || !message.trim()}
              className="flex-1 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium transition-colors"
            >
              {editingId ? 'Сохранить' : 'Создать'}
            </button>
            <button
              onClick={() => {
                setIsCreating(false);
                setEditingId(null);
                setShortcut('');
                setMessage('');
              }}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : replies.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3 py-12">
          <Zap size={48} className="opacity-30" />
          <p className="text-sm">Нет шаблонов</p>
          <p className="text-xs text-zinc-600">Создайте первый шаблон для быстрых ответов</p>
        </div>
      ) : (
        <div className="space-y-2">
          {replies.map((reply) => (
            <div
              key={reply.id}
              className="p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors group"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  onClick={() => {
                    onSelect(reply.message);
                    onClose();
                  }}
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-mono text-nexo-400">{reply.shortcut}</span>
                  </div>
                  <p className="text-sm text-zinc-300 line-clamp-2">{reply.message}</p>
                </button>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEdit(reply)}
                    className="p-2 rounded-lg hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
                    title="Редактировать"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(reply.id)}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-zinc-400 hover:text-red-400 transition-colors"
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const footer = !isCreating && replies.length > 0 && (
    <div className="p-4 border-t border-white/5">
      <div className="text-xs text-zinc-500 text-center">
        Используйте команды в чате (например: <span className="text-nexo-400">/привет</span>) или горячие клавиши <span className="text-nexo-400">Ctrl+1-9</span>
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen onClose={onClose} title="Быстрые ответы">
        {!isCreating && (
          <div className="px-4 pt-2">
            <button
              onClick={() => setIsCreating(true)}
              className="w-full px-3 py-1.5 rounded-lg bg-nexo-500 hover:bg-nexo-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus size={16} />
              Создать
            </button>
          </div>
        )}
        {body}
        {footer}
      </BottomSheet>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-2xl max-h-[80vh] rounded-2xl bg-[#1a1a1a] border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {header}
        {body}
        {footer}
      </motion.div>
    </div>
  );
}
