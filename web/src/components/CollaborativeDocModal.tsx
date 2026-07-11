import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Clock, Users, MessageCircle, Download, FileText } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface CollaborativeDocModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  docId?: string;
}

export default function CollaborativeDocModal({ isOpen, onClose, chatId, docId }: CollaborativeDocModalProps) {
  const { user } = useAuthStore();
  const [doc, setDoc] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    if (isOpen && docId) {
      loadDoc();
    } else if (isOpen && !docId) {
      setTitle('');
      setContent('');
    }
  }, [isOpen, docId]);

  const loadDoc = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/collaborative-docs/${docId}`);
      setDoc(response.data);
      setTitle(response.data.title);
      setContent(response.data.content);
    } catch (error) {
      console.error('Error loading doc:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      if (docId) {
        const response = await api.put(`/collaborative-docs/${docId}`, {
          title,
          content
        });
        setDoc(response.data);
      } else {
        const response = await api.post('/collaborative-docs', {
          chatId,
          title: title || 'Без названия',
          content
        });
        setDoc(response.data);
      }
    } catch (error) {
      console.error('Error saving doc:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !docId) return;

    try {
      await api.post(`/collaborative-docs/${docId}/comments`, {
        content: newComment
      });
      setNewComment('');
      loadDoc();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleExport = async (format: 'pdf' | 'docx') => {
    try {
      const response = await api.get(`/collaborative-docs/${docId}/export/${format}`);
      console.log('Export:', response.data);
      // TODO: Реализовать скачивание файла
    } catch (error) {
      console.error('Error exporting:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-6xl h-[90vh] bg-white dark:bg-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
            <div className="flex items-center gap-3 flex-1">
              <FileText className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Название документа"
                className="flex-1 bg-transparent text-xl font-semibold text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowVersions(!showVersions)}
                className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
                title="История версий"
              >
                <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
              <button
                onClick={() => setShowComments(!showComments)}
                className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors relative"
                title="Комментарии"
              >
                <MessageCircle className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                {doc?.comments?.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                    {doc.comments.length}
                  </span>
                )}
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            {/* Editor */}
            <div className="flex-1 flex flex-col">
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Начните писать..."
                className="flex-1 p-6 bg-white dark:bg-gray-800 text-gray-900 dark:text-white resize-none focus:outline-none font-mono text-sm leading-relaxed"
              />
              
              {/* Footer */}
              <div className="px-6 py-3 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                  <span>Версия: {doc?.currentVersion || 1}</span>
                  <span>Символов: {content.length}</span>
                  <span>Слов: {content.split(/\s+/).filter(w => w).length}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleExport('pdf')}
                    className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    PDF
                  </button>
                  <button
                    onClick={() => handleExport('docx')}
                    className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    DOCX
                  </button>
                </div>
              </div>
            </div>

            {/* Sidebar */}
            {(showVersions || showComments) && (
              <div className="w-80 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 overflow-y-auto">
                {showVersions && (
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">История версий</h3>
                    <div className="space-y-2">
                      {doc?.versions?.map((version: any) => (
                        <div
                          key={version.id}
                          className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              Версия {version.version}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(version.createdAt).toLocaleString('ru')}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {version.author.displayName || version.author.username}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {showComments && (
                  <div className="p-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Комментарии</h3>
                    
                    {/* Add comment */}
                    <div className="mb-4">
                      <textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Добавить комментарий..."
                        className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                      <button
                        onClick={handleAddComment}
                        disabled={!newComment.trim()}
                        className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        Отправить
                      </button>
                    </div>

                    {/* Comments list */}
                    <div className="space-y-3">
                      {doc?.comments?.map((comment: any) => (
                        <div
                          key={comment.id}
                          className="p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {comment.author.displayName || comment.author.username}
                            </span>
                            <span className="text-xs text-gray-500">
                              {new Date(comment.createdAt).toLocaleString('ru')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300">
                            {comment.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
