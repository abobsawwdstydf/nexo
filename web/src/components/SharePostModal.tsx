import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Search, Loader2, Check } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';
import type { Chat } from '../lib/types';

interface SharePostModalProps {
  postId: string;
  postContent?: string;
  onClose: () => void;
}

export default function SharePostModal({ postId, postContent, onClose }: SharePostModalProps) {
  const { success, error: showError } = useToastStore();
  const [chats, setChats] = useState<Chat[]>([]);
  const [filteredChats, setFilteredChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  // Загрузить чаты
  useEffect(() => {
    const loadChats = async () => {
      try {
        const data = await api.getChats();
        setChats(data);
        setFilteredChats(data);
      } catch (err) {
        console.error('Error loading chats:', err);
        showError('Ошибка загрузки чатов');
      } finally {
        setLoading(false);
      }
    };
    loadChats();
  }, []);

  // Фильтрация чатов
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredChats(chats);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredChats(
        chats.filter(chat =>
          (chat.name && chat.name.toLowerCase().includes(query)) ||
          (chat.username && chat.username.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, chats]);

  // Переключение выбора чата
  const toggleChat = (chatId: string) => {
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
  };

  // Поделиться постом
  const handleShare = async () => {
    if (selectedChats.size === 0) {
      showError('Выберите хотя бы один чат');
      return;
    }

    setSharing(true);
    try {
      const postUrl = `${window.location.origin}/wall/post/${postId}`;
      const message = postContent
        ? `📌 Пост: ${postContent.substring(0, 100)}...\n\n${postUrl}`
        : `📌 Интересный пост:\n${postUrl}`;

      // Отправляем сообщение в каждый выбранный чат
      for (const chatId of selectedChats) {
        await api.post(`/chats/${chatId}/messages`, {
          content: message,
          type: 'text'
        });
      }

      success(`Пост поделен в ${selectedChats.size} чатах`);
      onClose();
    } catch (err) {
      console.error('Error sharing post:', err);
      showError('Ошибка при поделении поста');
    } finally {
      setSharing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-surface-secondary rounded-2xl border border-border w-full max-w-md max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-white">Поделиться постом</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Поиск чатов..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-tertiary text-sm text-white placeholder-zinc-500 border border-border focus:border-accent transition-colors"
            />
          </div>
        </div>

        {/* Chats list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : filteredChats.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-500 text-sm">Чаты не найдены</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {filteredChats.map(chat => (
                  <button
                    key={chat.id}
                    onClick={() => toggleChat(chat.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                      selectedChats.has(chat.id)
                        ? 'bg-nexo-500/20 border border-nexo-500/50'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    {/* Аватар чата */}
                    {chat.avatar ? (
                      <img
                        src={chat.avatar}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                        {(chat.name || chat.username || '?')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm font-medium text-white truncate">
                        {chat.name || chat.username || 'Чат'}
                      </p>
                      {chat.type === 'group' && (
                        <p className="text-xs text-zinc-500">Группа</p>
                      )}
                      {chat.type === 'channel' && (
                        <p className="text-xs text-zinc-500">Канал</p>
                      )}
                    </div>
                    {selectedChats.has(chat.id) && (
                      <Check size={18} className="text-nexo-400 flex-shrink-0" />
                    )}
                  </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-3">
          <p className="text-xs text-zinc-500">
            Выбрано: {selectedChats.size} {selectedChats.size === 1 ? 'чат' : 'чатов'}
          </p>
          <button
            onClick={handleShare}
            disabled={sharing || selectedChats.size === 0}
            className="w-full py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
          >
            {sharing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Отправка...</span>
              </>
            ) : (
              <span>Поделиться</span>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
