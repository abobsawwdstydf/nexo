import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, FileText } from 'lucide-react';
import { api } from '../lib/api';
import BottomSheet from './BottomSheet';

interface TemplatesModalProps {
  onClose: () => void;
  onSelect: (content: string) => void;
}

interface Template {
  id: string;
  name: string;
  content: string;
  createdAt: string;
}

export default function TemplatesModal({ onClose, onSelect }: TemplatesModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/templates');
      setTemplates(response);
    } catch (error) {
      console.error('Load templates error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim() || !newContent.trim()) return;

    try {
      const template = await api.post('/api/templates', {
        name: newName,
        content: newContent,
      });
      setTemplates([template, ...templates]);
      setNewName('');
      setNewContent('');
      setShowCreate(false);
    } catch (error) {
      console.error('Create template error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/templates/${id}`);
      setTemplates(templates.filter(t => t.id !== id));
    } catch (error) {
      console.error('Delete template error:', error);
    }
  };

  const handleSelect = (content: string) => {
    onSelect(content);
    onClose();
  };

  const content = (
    <>
      {/* Create form */}
      {showCreate && (
        <div className="p-4 border-b border-white/5 space-y-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Название шаблона..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Содержание шаблона..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-nexo-500 resize-none h-24"
          />
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || !newContent.trim()}
              className="flex-1 px-3 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm disabled:opacity-50"
            >
              Создать
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="flex-1 px-3 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition text-sm"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Templates list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading && (
          <div className="text-center text-white/60 py-8">Загрузка...</div>
        )}

        {!loading && templates.length === 0 && !showCreate && (
          <div className="text-center text-white/60 py-8">
            Нет шаблонов
          </div>
        )}

        <AnimatePresence>
          {templates.map(template => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/10 hover:bg-white/20 rounded-lg p-3 transition cursor-pointer group"
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  onClick={() => handleSelect(template.content)}
                  className="flex-1 min-w-0"
                >
                  <h3 className="text-white font-medium text-sm">{template.name}</h3>
                  <p className="text-white/60 text-xs line-clamp-2 mt-1">
                    {template.content}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(template.id)}
                  className="p-1 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 rounded transition"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-white/5">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm"
        >
          <Plus size={16} />
          Новый шаблон
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen onClose={onClose} title="Шаблоны сообщений">
        {content}
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 flex items-center justify-center z-50"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a1a1a] rounded-2xl border border-white/10 flex flex-col w-[500px] h-[600px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/5 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-white/60" />
            <h2 className="text-lg font-semibold text-white">Шаблоны сообщений</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {content}
      </div>
    </motion.div>
  );
}
