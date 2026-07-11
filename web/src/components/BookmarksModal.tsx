import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Trash2, Edit2 } from 'lucide-react';
import { api } from '../lib/api';
import MessageBubble from './MessageBubble';

interface BookmarksModalProps {
  onClose: () => void;
}

interface Bookmark {
  id: string;
  messageId: string;
  note?: string;
  message: any;
  createdAt: string;
}

export default function BookmarksModal({ onClose }: BookmarksModalProps) {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNote, setEditNote] = useState('');

  useEffect(() => {
    loadBookmarks();
  }, []);

  const loadBookmarks = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/bookmarks' + (search ? '?search=' + encodeURIComponent(search) : ''));
      setBookmarks(response.bookmarks);
    } catch (error) {
      console.error('Load bookmarks error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/api/bookmarks/${id}`);
      setBookmarks(bookmarks.filter(b => b.id !== id));
    } catch (error) {
      console.error('Delete bookmark error:', error);
    }
  };

  const handleSaveNote = async (id: string, messageId: string) => {
    try {
      await api.post(`/api/bookmarks/${messageId}`, { note: editNote });
      setBookmarks(bookmarks.map(b =>
        b.id === id ? { ...b, note: editNote } : b
      ));
      setEditingId(null);
    } catch (error) {
      console.error('Save note error:', error);
    }
  };

  const filteredBookmarks = bookmarks.filter(b =>
    b.message?.content?.toLowerCase().includes(search.toLowerCase()) ||
    b.note?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[500px] sm:h-[600px] bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">Закладки</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X size={20} className="text-white/60" />
        </button>
      </div>

      {/* Search */}
      <div className="p-4 border-b border-white/10">
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Поиск закладок..."
            className="w-full bg-white/10 border border-white/20 text-white rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-nexo-500"
          />
        </div>
      </div>

      {/* Bookmarks list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {loading && (
          <div className="text-center text-white/60 py-8">Загрузка...</div>
        )}

        {!loading && filteredBookmarks.length === 0 && (
          <div className="text-center text-white/60 py-8">
            Нет закладок
          </div>
        )}

        <AnimatePresence>
          {filteredBookmarks.map(bookmark => (
            <motion.div
              key={bookmark.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="bg-white/10 rounded-lg p-3 space-y-2"
            >
              {/* Message preview */}
              <div className="text-sm text-white/60 line-clamp-2">
                {bookmark.message?.content}
              </div>

              {/* Note */}
              {editingId === bookmark.id ? (
                <div className="space-y-2">
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Добавьте заметку..."
                    className="w-full bg-white/10 border border-white/20 text-white rounded px-2 py-1 text-sm focus:outline-none focus:border-nexo-500 resize-none"
                    rows={2}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveNote(bookmark.id, bookmark.messageId)}
                      className="flex-1 px-2 py-1 bg-nexo-500 hover:bg-nexo-600 text-white rounded text-xs transition"
                    >
                      Сохранить
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
                    >
                      Отмена
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {bookmark.note && (
                    <div className="text-sm text-white/80 bg-white/5 rounded px-2 py-1">
                      📝 {bookmark.note}
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        setEditingId(bookmark.id);
                        setEditNote(bookmark.note || '');
                      }}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-xs transition"
                    >
                      <Edit2 size={12} />
                      Заметка
                    </button>
                    <button
                      onClick={() => handleDelete(bookmark.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded text-xs transition"
                    >
                      <Trash2 size={12} />
                      Удалить
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
