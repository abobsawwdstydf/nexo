import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCheck,
  Trash2,
  Reply,
  Copy,
  Pencil,
  Pin,
  Bookmark,
  Forward,
} from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { getSocket } from '../../lib/socket';
import { api } from '../../lib/api';
import { useLang } from '../../lib/i18n';
import { normalizeMediaUrl } from '../../lib/mediaUrl';
import type { Message, Chat } from '../../lib/types';

interface ContextMenuProps {
  show: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  message: Message;
  userId: string | undefined;
  isMine: boolean;
  isPinned: boolean;
  quotedText: string | null;
  setQuotedText: (text: string | null) => void;
  hasVoice: boolean;
  hasAudio: boolean;
  chat: Chat | undefined;
  onStartSelectionMode?: (id: string) => void;
  onOpenAIModal: () => void;
  onOpenTagModal: () => void;
  onOpenAddToProfile: (audioUrl: string) => void;
  onOpenForwardModal: () => void;
}

export default function ContextMenu({
  show,
  position,
  onClose,
  message,
  userId,
  isMine,
  isPinned,
  quotedText,
  setQuotedText,
  hasVoice,
  hasAudio,
  chat,
  onStartSelectionMode,
  onOpenAIModal,
  onOpenTagModal,
  onOpenAddToProfile,
  onOpenForwardModal,
}: ContextMenuProps) {
  const { t } = useLang();
  const { setReplyTo, setEditingMessage, pinnedMessages, chats } = useChatStore();
  const [deleteMenuMode, setDeleteMenuMode] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const chatForDelete = chats.find(c => c.id === message.chatId);
  const otherMemberName = chatForDelete?.type === 'personal'
    ? chatForDelete.members.find(m => m.user.id !== userId)?.user.displayName
      || chatForDelete.members.find(m => m.user.id !== userId)?.user.username
      || ''
    : '';

  const handleCopy = () => {
    if (message.content) navigator.clipboard.writeText(message.content);
    onClose();
  };

  const handleReply = () => {
    setReplyTo({ ...message, quote: quotedText });
    onClose();
    setQuotedText(null);
  };

  const handleEdit = () => {
    setEditingMessage(message);
    onClose();
  };

  const handleDeleteForAll = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('delete_messages', {
        messageIds: [message.id],
        chatId: message.chatId,
        deleteForAll: true,
      });
    }
    onClose();
    setDeleteMenuMode(false);
  };

  const handleDeleteForMe = () => {
    const socket = getSocket();
    if (socket) {
      socket.emit('delete_messages', {
        messageIds: [message.id],
        chatId: message.chatId,
        deleteForAll: false,
      });
    }
    useChatStore.getState().hideMessages([message.id], message.chatId);
    onClose();
    setDeleteMenuMode(false);
  };

  const handlePin = () => {
    const socket = getSocket();
    if (socket) {
      if (isPinned) {
        socket.emit('unpin_message', { messageId: message.id, chatId: message.chatId });
      } else {
        socket.emit('pin_message', { messageId: message.id, chatId: message.chatId });
      }
    }
    onClose();
  };

  const handleBookmark = async () => {
    try {
      if (isBookmarked) {
        await api.removeBookmark(message.id);
        setIsBookmarked(false);
      } else {
        await api.addBookmark(message.id);
        setIsBookmarked(true);
      }
    } catch { /* ignore */ }
    onClose();
  };

  const handleReaction = (emoji: string) => {
    const socket = getSocket();
    if (socket) {
      const existingReaction = message.reactions?.find(
        (r) => r.userId === userId && r.emoji === emoji
      );
      if (existingReaction) {
        socket.emit('remove_reaction', { messageId: message.id, chatId: message.chatId, emoji });
      } else {
        socket.emit('add_reaction', { messageId: message.id, chatId: message.chatId, emoji });
      }
    }
    onClose();
  };

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const hideMenu = (e: MouseEvent) => {
      if (contextMenuRef.current?.contains(e.target as Node)) return;
      onClose();
      setDeleteMenuMode(false);
    };
    window.addEventListener('click', hideMenu, true);
    window.addEventListener('contextmenu', hideMenu, true);
    return () => {
      window.removeEventListener('click', hideMenu, true);
      window.removeEventListener('contextmenu', hideMenu, true);
    };
  }, [show, onClose]);

  return typeof document !== 'undefined' ? createPortal(
    <AnimatePresence>
      {show && (
        <motion.div
          ref={contextMenuRef}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="fixed z-[9999] w-[280px] max-w-[calc(100vw-16px)] rounded-[1.25rem] glass-strong shadow-2xl py-1.5 overflow-hidden border border-white/10"
          style={{ 
            left: Math.min(position.x, window.innerWidth - 296), 
            top: Math.min(position.y, window.innerHeight - 400) 
          }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
          {deleteMenuMode ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
                <button
                  onClick={() => setDeleteMenuMode(false)}
                  className="p-1 rounded-lg hover:bg-surface-hover transition-colors text-zinc-400 hover:text-white"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
                </button>
                <span className="text-sm font-medium text-zinc-300">{t('delete')}</span>
              </div>
              <button
                onClick={handleDeleteForMe}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <Trash2 size={16} className="text-zinc-400" />
                {t('deleteForMe')}
              </button>
              <button
                onClick={handleDeleteForAll}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
              >
                <Trash2 size={16} />
                {chatForDelete?.type === 'personal' && otherMemberName
                  ? `${t('deleteAlsoFor')} ${otherMemberName}`
                  : t('deleteForAll')}
              </button>
            </>
          ) : (
            <>
              {/* Quick reactions */}
              <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
                {['👍', '❤️', '😂', '😮', '😢', '🔥'].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => handleReaction(emoji)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-hover transition-colors text-lg"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              <button
                onClick={handleReply}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <Reply size={16} />
                {quotedText ? t('replyWithQuote') : t('reply')}
              </button>

              <button
                onClick={() => { onOpenForwardModal(); onClose(); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <Forward size={16} />
                Переслать
              </button>

              <button
                onClick={handleBookmark}
                className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${isBookmarked ? 'text-nexo-400 hover:bg-nexo-500/10' : 'text-zinc-300 hover:bg-surface-hover hover:text-white'}`}
              >
                <Bookmark size={16} className={isBookmarked ? 'fill-nexo-400' : ''} />
                {isBookmarked ? 'Убрать из закладок' : 'В закладки'}
              </button>

              <button
                onClick={() => { onClose(); onStartSelectionMode?.(message.id); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <CheckCheck size={16} />
                {t('select')}
              </button>

              <button
                onClick={handlePin}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
              >
                <Pin size={16} />
                {isPinned ? t('unpinMessage') : t('pinMessage')}
              </button>

              {message.content && (
                <>
                  <button
                    onClick={() => { onClose(); onOpenAIModal(); }}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      <circle cx="9" cy="10" r="1"/>
                      <circle cx="15" cy="10" r="1"/>
                      <path d="M9 14h6"/>
                    </svg>
                    Спросить AI
                  </button>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                  >
                    <Copy size={16} />
                    {t('copy')}
                  </button>
                </>
              )}

              {/* Add to Profile button for audio/voice messages */}
              {(hasVoice || hasAudio) && (
                <button
                  onClick={() => {
                    const voiceMedia = message.media?.find((m) => m.type === 'voice');
                    const audioMedia = message.media?.find((m) => m.type === 'audio');
                    const audioUrl = normalizeMediaUrl((voiceMedia || audioMedia)?.url || '');
                    if (audioUrl) {
                      onOpenAddToProfile(audioUrl);
                      onClose();
                    }
                  }}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                  </svg>
                  Добавить в профиль
                </button>
              )}

              {isMine && message.content && (
                <button
                  onClick={handleEdit}
                  className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-surface-hover hover:text-white transition-colors"
                >
                  <Pencil size={16} />
                  {t('edit')}
                </button>
              )}

              <div className="border-t border-border my-1" />
              <button
                onClick={() => setDeleteMenuMode(true)}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={16} />
                {t('delete')}
              </button>
              <button
                onClick={() => { onClose(); onOpenTagModal(); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-amber-400 hover:bg-amber-500/10 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                Теги
              </button>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  ) : null;
}
