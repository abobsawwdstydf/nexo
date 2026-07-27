import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Phone,
  Video,
  MoreVertical,
  Send,
  Paperclip,
  Smile,
  ChevronDown,
  Mic,
  Image,
  Search,
  BellOff,
  Flag,
  Users,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import type { Chat, Message } from '../lib/types';

interface MessageAreaProps {
  chat: Chat;
  onBack: () => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const curr = new Date(messages[index].createdAt);
  const prev = new Date(messages[index - 1].createdAt);
  return (
    curr.getDate() !== prev.getDate() ||
    curr.getMonth() !== prev.getMonth() ||
    curr.getFullYear() !== prev.getFullYear()
  );
}

function MessageBubble({ message, isOwn }: { message: Message; isOwn: boolean }) {
  const time = formatTime(message.createdAt);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-1`}
    >
      <div
        className={`
          max-w-[75%] px-3.5 py-2 rounded-2xl
          ${isOwn
            ? 'bg-white/[0.1] border border-white/[0.08] rounded-br-[6px]'
            : 'bg-white/[0.04] border border-white/[0.04] rounded-bl-[6px]'
          }
        `}
      >
        {!isOwn && message.sender && (
          <p className="text-[11px] font-medium text-white/40 mb-0.5">
            {message.sender.displayName || message.sender.username}
          </p>
        )}
        {message.content && (
          <p className="text-sm text-white/85 leading-relaxed word-break">
            {message.content}
          </p>
        )}
        <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <span className="text-[10px] text-white/30">{time}</span>
          {isOwn && (
            <span className="text-[10px] text-white/25">✓</span>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DateSeparator({ dateStr }: { dateStr: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.04]">
        <span className="text-[11px] text-white/30 font-medium">
          {formatDate(dateStr)}
        </span>
      </div>
    </div>
  );
}

function ChatHeader({
  chat,
  onBack,
}: {
  chat: Chat;
  onBack: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = (chat.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  return (
    <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
      <div className="flex items-center gap-2 min-w-0">
        {/* Back button (mobile) */}
        <motion.button
          onClick={onBack}
          className="md:hidden p-2 -ml-1 rounded-xl hover:bg-white/[0.06] transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <ArrowLeft size={18} className="text-white/50" />
        </motion.button>

        {/* Avatar */}
        {chat.avatar ? (
          <img
            src={chat.avatar}
            alt={chat.name || ''}
            className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-medium text-white/50">{initials}</span>
          </div>
        )}

        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-white/90 truncate">
            {chat.name || 'Без названия'}
          </h2>
          <p className="text-[11px] text-white/30">
            {chat.type === 'personal'
              ? 'Личный чат'
              : chat.type === 'group'
              ? `${chat.members?.length || 0} участников`
              : 'Канал'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1">
        <motion.button
          className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Phone size={16} className="text-white/40" />
        </motion.button>
        <motion.button
          className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Video size={16} className="text-white/40" />
        </motion.button>

        {/* More menu */}
        <div className="relative" ref={menuRef}>
          <motion.button
            onClick={() => setShowMenu(v => !v)}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <MoreVertical size={16} className="text-white/40" />
          </motion.button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -5 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1 w-48 py-1.5 rounded-xl liquid-glass-strong z-50"
              >
                <ChatMenuItem icon={Search} label="Поиск" />
                <ChatMenuItem icon={BellOff} label="Отключить звук" />
                <ChatMenuItem icon={Image} label="Медиафайлы" />
                {chat.type === 'group' && <ChatMenuItem icon={Users} label="Участники" />}
                <div className="mx-3 my-1 h-px bg-white/[0.06]" />
                <ChatMenuItem icon={Flag} label="Пожаловаться" className="text-red-400/70" />
                <ChatMenuItem icon={Trash2} label="Удалить чат" className="text-red-400/70" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

function ChatMenuItem({
  icon: Icon,
  label,
  className = '',
}: {
  icon: typeof Search;
  label: string;
  className?: string;
}) {
  return (
    <button className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors ${className}`}>
      <Icon size={14} />
      {label}
    </button>
  );
}

function MessageInput({
  onSend,
}: {
  onSend: (text: string) => void;
}) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Focus input on mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);
    recordTimerRef.current = setInterval(() => {
      setRecordingDuration(d => d + 1);
    }, 1000);
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-shrink-0 px-3 py-3 border-t border-white/[0.06]">
      {isRecording ? (
        <div className="flex items-center gap-3 px-3 py-1.5">
          <motion.button
            onClick={stopRecording}
            className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={16} className="text-red-400" />
          </motion.button>
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0"
          />
          <span className="text-sm text-white/70 font-mono">{formatDuration(recordingDuration)}</span>
          <span className="text-xs text-white/40">Говорите...</span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <div className="relative">
            <motion.button
              onClick={() => setShowAttach(v => !v)}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Paperclip size={16} className="text-white/30" />
            </motion.button>

            <AnimatePresence>
              {showAttach && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full left-0 mb-2 w-40 py-1.5 rounded-xl liquid-glass-strong z-50"
                >
                  <AttachItem icon={Image} label="Фото" />
                  <AttachItem icon={Paperclip} label="Файл" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Сообщение..."
              className="w-full h-10 px-4 pr-10 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
            />
            <motion.button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Smile size={15} className="text-white/25" />
            </motion.button>
          </div>

          {text.trim() ? (
            <motion.button
              onClick={handleSubmit}
              className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 transition-colors flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Send size={16} className="text-white/60" />
            </motion.button>
          ) : (
            <motion.button
              onClick={startRecording}
              className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Mic size={16} className="text-white/40" />
            </motion.button>
          )}
        </div>
      )}
    </div>
  );
}

function AttachItem({ icon: Icon, label }: { icon: typeof Image; label: string }) {
  return (
    <button className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors">
      <Icon size={14} />
      {label}
    </button>
  );
}

export function MessageArea({ chat, onBack }: MessageAreaProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // ─── Fetch messages ────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const data = await api.getMessages(chat.id);
        if (!cancelled) {
          setMessages(data || []);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [chat.id]);

  // ─── Auto-scroll to bottom ─────────────────────────────────────────
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  // Track scroll position to determine auto-scroll
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAutoScroll(isNearBottom);
  }, []);

  // ─── Send message ──────────────────────────────────────────────────
  const handleSend = useCallback(async (text: string) => {
    try {
      // Optimistic message
      const optimisticId = `opt_${Date.now()}`;
      const optimisticMsg: Message = {
        id: optimisticId,
        chatId: chat.id,
        senderId: user?.id || '',
        content: text,
        type: 'text',
        replyToId: null,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        sender: {
          id: user?.id || '',
          username: user?.username || '',
          displayName: user?.displayName || '',
          avatar: user?.avatar || null,
        },
        media: [],
        reactions: [],
        readBy: [],
        _isSending: true,
      };

      setMessages(prev => [...prev, optimisticMsg]);
      setAutoScroll(true);

      // Send via WS
      const result = await api.sendMessageWS(chat.id, text);

      // Replace optimistic with real
      setMessages(prev =>
        prev.map(m =>
          m.id === optimisticId
            ? { ...m, id: result.messageId, createdAt: result.createdAt, _isSending: false }
            : m
        )
      );
    } catch (err) {
      console.error('Failed to send message:', err);
      // Mark as failed
      setMessages(prev =>
        prev.map(m =>
          m.id.startsWith('opt_') && m._isSending
            ? { ...m, _isSending: false, _isFailed: true }
            : m
        )
      );
    }
  }, [chat.id, user]);

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <>
      <ChatHeader chat={chat} onBack={onBack} />

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
        {loading ? (
          <div className="flex flex-col gap-3 pt-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="h-12 w-48 rounded-2xl skeleton-shimmer bg-white/[0.03]"
                  style={{ borderRadius: i % 2 === 0 ? '16px 16px 4px 16px' : '16px 16px 16px 4px' }}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-white/30">Нет сообщений</p>
            <p className="text-xs text-white/20 mt-1">Напишите первое сообщение</p>
          </div>
        ) : (
          <div className="min-h-full flex flex-col justify-end">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <div key={msg.id}>
                  {shouldShowDateSeparator(messages, idx) && (
                    <DateSeparator dateStr={msg.createdAt} />
                  )}
                  <MessageBubble
                    message={msg}
                    isOwn={msg.senderId === user?.id}
                  />
                </div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Auto-scroll button */}
        {!autoScroll && messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              setAutoScroll(true);
            }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 p-2 rounded-full liquid-glass-subtle shadow-lg"
          >
            <ChevronDown size={16} className="text-white/50" />
          </motion.button>
        )}
      </div>

      <MessageInput onSend={handleSend} />
    </>
  );
}
