import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Send, Check, Forward } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { getSocket } from '../lib/socket';
import Avatar from './Avatar';
import BottomSheet from './BottomSheet';
import type { Chat, Message } from '../lib/types';

interface ForwardModalProps {
  messages: Message[];
  onClose: () => void;
}

export default function ForwardModal({ messages, onClose }: ForwardModalProps) {
  const { chats } = useChatStore();
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChats, setSelectedChats] = useState<Set<string>>(new Set());
  const [isSending, setIsSending] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const availableChats = useMemo(() => {
    return chats.filter(chat => {
      if (chat.type === 'personal' && chat.members?.length === 1) return false;
      if (chat.type === 'channel') {
        const member = chat.members?.find(m => m.userId === user?.id);
        return member?.role === 'admin';
      }
      return true;
    });
  }, [chats, user?.id]);

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return availableChats;
    const query = searchQuery.toLowerCase();
    return availableChats.filter(chat => {
      const name = chat.name || chat.username || '';
      const type = chat.type;
      return name.toLowerCase().includes(query) || type.includes(query);
    });
  }, [availableChats, searchQuery]);

  const toggleChat = (chatId: string) => {
    const newSelected = new Set(selectedChats);
    if (newSelected.has(chatId)) {
      newSelected.delete(chatId);
    } else {
      newSelected.add(chatId);
    }
    setSelectedChats(newSelected);
  };

  const handleForward = async () => {
    if (selectedChats.size === 0 || isSending) return;

    setIsSending(true);
    const socket = getSocket();

    if (!socket) {
      setIsSending(false);
      return;
    }

    try {
      for (const chatId of selectedChats) {
        for (const message of messages) {
          const forwardedMessage = {
            chatId,
            content: message.content,
            type: message.type,
            media: message.media,
            forwardedFromId: message.senderId,
          };
          socket.emit('send_message', forwardedMessage);
        }
      }
      setTimeout(() => { onClose(); }, 300);
    } catch (error) {
      console.error('Forward error:', error);
      setIsSending(false);
    }
  };

  const getChatLabel = (chat: Chat) => {
    if (chat.type === 'channel') return 'Канал';
    if (chat.type === 'group') return 'Группа';
    if (chat.type === 'personal') return 'Личный чат';
    return '';
  };

  const header = (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
        <Forward size={16} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-sm font-semibold text-white">Переслать сообщение</h2>
        <p className="text-xs text-zinc-400">
          {messages.length === 1 ? '1 сообщение' : `${messages.length} сообщений`}
        </p>
      </div>
      <button
        onClick={onClose}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );

  const search = (
    <div className="px-4 py-3 border-b border-white/5">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск чатов..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#222] rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary"
          autoFocus
        />
      </div>
    </div>
  );

  const chatList = (
    <div className="flex-1 overflow-y-auto overscroll-contain">
      {filteredChats.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full py-12 text-zinc-400">
          <Search size={48} className="mb-4 opacity-30" />
          <p className="text-sm">Чаты не найдены</p>
        </div>
      ) : (
        <div className="p-2">
          {filteredChats.map((chat) => {
            const isSelected = selectedChats.has(chat.id);
            const chatName = chat.name || chat.username || 'Без имени';

            return (
              <button
                key={chat.id}
                onClick={() => toggleChat(chat.id)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                  isSelected
                    ? 'bg-primary/20 hover:bg-primary/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <Avatar
                  src={chat.avatar}
                  name={chatName}
                  size="md"
                  isVerified={chat.isVerified}
                  verifiedBadgeUrl={chat.verifiedBadgeUrl}
                  verifiedBadgeType={chat.verifiedBadgeType}
                />
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white truncate">{chatName}</span>
                  </div>
                  <span className="text-xs text-zinc-400">
                    {getChatLabel(chat)}
                  </span>
                </div>
                {isSelected && (
                  <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Check size={14} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  const footer = (
    <div className="px-4 py-3 border-t border-white/5">
      <button
        onClick={handleForward}
        disabled={selectedChats.size === 0 || isSending}
        className={`w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2 ${
          selectedChats.size === 0 || isSending
            ? 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            : 'bg-primary hover:bg-primary-hover text-white'
        }`}
      >
        {isSending ? (
          <>
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Отправка...
          </>
        ) : (
          <>
            <Send size={18} />
            Переслать {selectedChats.size > 0 && `(${selectedChats.size})`}
          </>
        )}
      </button>
    </div>
  );

  const content = (
    <>
      {search}
      {chatList}
      {footer}
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen onClose={onClose} showCloseButton={false}>
        {header}
        {content}
      </BottomSheet>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-[#1a1a1a] rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {header}
          {content}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
