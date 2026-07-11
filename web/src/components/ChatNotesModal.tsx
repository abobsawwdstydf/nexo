import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Search, Tag, Edit2, Trash2, StickyNote } from 'lucide-react';
import api from '../lib/api';

interface ChatNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId?: string;
}

export default function ChatNotesModal({ isOpen, onClose, chatId }: ChatNotesModalProps) {
  const [notes, setNotes] = useState<any[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadNotes();
      loadTags();
    }
  }, [isOpen, chatId]);

  useEffect(() => {
    filterNotes();
  }, [notes, searchQuery, selectedTags]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/chat-notes' + (chatId ? '?chatId=' + encodeURIComponent(chatId) : ''));
      setNotes(response.data);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const response = await api.get('/chat-notes/tags');
      setAllTags(response.data);
    } catch (error) {
      console.error('Error loading tags:', error);
    }
  };

  const filterNotes = () => {
    let filtered = notes;

    if (searchQuery) {
      filtered = filtered.filter(note =>
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter(note =>
        selectedTags.some(tag => note.tags.includes(tag))
      );
    }

    setFilteredNotes(filtered);
  };

  const handleSaveNote = async () => {
    if (!editingNote) return;

    try {
      if (editingNote.id) {
        await api.put(`/chat-notes/${editingNote.id}`, editingNote);
      } else {
        await api.post('/chat-notes', {
          ...editingNote,
          chatId: chatId || editingNote.chatId
        });
      }
      setShowEditor(false);
      setEditingNote(null);
      loadNotes();
    } catch (error) {
      console.error('Error saving note:', error);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!confirm('Удалить заметку?')) return;

    try {
      await api.delete(`/chat-notes/${noteId}`);
      loadNotes();
    } catch (error) {
      console.error('Error deleting note:', error);
    }
  };

  const handleNewNote = () => {
    setEditingNote({
      title: '',
      content: '',
      tags: [],
      chatId
    });
    setShowEditor(true);
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-4xl h-[80vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20">
            <div className="flex items-center gap-3">
              <StickyNote className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Заметки к чатам
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleNewNote}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Новая заметка
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Search and filters */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск по заметкам..."
                className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
              />
            </div>

            {allTags.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Tag className="w-4 h-4 text-gray-400" />
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm transition-colors ${
                      selectedTags.includes(tag)
                        ? 'bg-yellow-600 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notes list or editor */}
          <div className="flex-1 overflow-y-auto p-6">
            {showEditor ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editingNote?.title || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, title: e.target.value })}
                  placeholder="Название заметки"
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-yellow-500"
                />
                <textarea
                  value={editingNote?.content || ''}
                  onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                  placeholder="Содержание заметки..."
                  className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  rows={12}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Теги (через запятую)
                  </label>
                  <input
                    type="text"
                    value={editingNote?.tags?.join(', ') || ''}
                    onChange={(e) => setEditingNote({
                      ...editingNote,
                      tags: e.target.value.split(',').map(t => t.trim()).filter(t => t)
                    })}
                    placeholder="работа, важное, идеи"
                    className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSaveNote}
                    className="flex-1 px-4 py-3 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors font-medium"
                  >
                    Сохранить
                  </button>
                  <button
                    onClick={() => {
                      setShowEditor(false);
                      setEditingNote(null);
                    }}
                    className="px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {loading ? (
                  <div className="col-span-2 flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600"></div>
                  </div>
                ) : filteredNotes.length === 0 ? (
                  <div className="col-span-2 text-center py-12">
                    <StickyNote className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">
                      {searchQuery || selectedTags.length > 0 ? 'Заметки не найдены' : 'Нет заметок'}
                    </p>
                  </div>
                ) : (
                  filteredNotes.map(note => (
                    <div
                      key={note.id}
                      className="p-4 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 hover:shadow-lg transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 dark:text-white flex-1">
                          {note.title}
                        </h3>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditingNote(note);
                              setShowEditor(true);
                            }}
                            className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                          </button>
                          <button
                            onClick={() => handleDeleteNote(note.id)}
                            className="p-1.5 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 line-clamp-3">
                        {note.content}
                      </p>
                      {note.tags.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {note.tags.map((tag: string) => (
                            <span
                              key={tag}
                              className="px-2 py-1 bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-full text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(note.updatedAt).toLocaleString('ru')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
