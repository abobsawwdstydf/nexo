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
  Reply,
  Forward,
  Pin,
  Check,
  CheckCheck,
  MessageCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { toast } from '../lib/toast';
import type { Chat, Message, Reaction } from '../lib/types';

const COMMON_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💯'];

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

function MessageBubble({
  message,
  isOwn,
  isChannel,
  onReply,
  onReact,
}: {
  message: Message;
  isOwn: boolean;
  isChannel?: boolean;
  onReply?: () => void;
  onReact?: () => void;
}) {
  const time = formatTime(message.createdAt);
  const showSender = !isOwn && message.sender && (isChannel || message.sender.displayName);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={`group relative flex ${isOwn && !isChannel ? 'justify-end' : 'justify-start'} mb-1`}
    >
      <div className="max-w-[75%]">
        {/* Reply quote */}
        {message.replyTo && (
          <div
            className={`
              px-3 py-1.5 mb-1 rounded-lg border-l-2 text-xs
              ${isOwn && !isChannel ? 'bg-white/[0.06] border-white/20' : 'bg-black/[0.2] border-white/30'}
            `}
          >
            <p className="font-medium text-white/60 text-[10px]">
              {message.replyTo.sender.displayName}
            </p>
            <p className="text-white/40 truncate">{message.replyTo.content}</p>
          </div>
        )}

        {/* Forwarded indicator */}
        {message.forwardedFrom && (
          <p className="text-[10px] text-white/30 mb-0.5 flex items-center gap-1">
            <Forward size={10} />
            Переслано от @{message.forwardedFrom.username}
          </p>
        )}

        {/* Bubble */}
        <div
          className={`
            px-3.5 py-2
            ${isOwn && !isChannel
              ? 'rounded-2xl rounded-br-[6px] bubble-sent'
              : 'rounded-2xl rounded-bl-[6px] bubble-received'
            }
          `}
        >
          {showSender && (
            <p className="text-[11px] font-semibold text-blue-400/70 mb-0.5">
              {message.sender.displayName || message.sender.username}
            </p>
          )}
          {message.content && (
            <p className={`text-sm leading-relaxed word-break ${isOwn && !isChannel ? 'text-white/90' : 'text-white/85'}`}>
              {message.content}
            </p>
          )}
          <div className={`flex items-center gap-2 mt-1 ${isOwn && !isChannel ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-white/30">{time}</span>
            {isOwn && !isChannel && (
              message.readBy && message.readBy.length > 1 ? (
                <span className="text-[10px] text-blue-400/60 flex items-center gap-0.5">
                  <CheckCheck size={12} />
                  {message.readBy.length}
                </span>
              ) : message._isFailed ? (
                <span className="text-[10px] text-red-400/60">Ошибка</span>
              ) : message._isSending ? (
                <span className="text-[10px] text-white/20">...</span>
              ) : (
                <span className="text-[10px] text-blue-400/50"><CheckCheck size={12} /></span>
              )
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwn && !isChannel ? 'justify-end' : 'justify-start'}`}>
            {message.reactions.map((r, i) => (
              <button
                key={i}
                onClick={() => onReact?.()}
                className="px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.06] text-xs hover:bg-white/[0.1] transition-colors"
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div className={`absolute top-0 ${isOwn && !isChannel ? 'left-0 -translate-x-full pl-1' : 'right-0 translate-x-full pr-1'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5`}>
          <button
            onClick={onReply}
            className="p-1 rounded-lg bg-black/40 border border-white/[0.06] hover:bg-white/[0.1] transition-colors"
            title="Ответить"
          >
            <Reply size={12} className="text-white/50" />
          </button>
          <button
            onClick={onReact}
            className="p-1 rounded-lg bg-black/40 border border-white/[0.06] hover:bg-white/[0.1] transition-colors"
            title="Реакция"
          >
            <Smile size={12} className="text-white/50" />
          </button>
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
  onSearchToggle,
  pinnedMessages,
}: {
  chat: Chat;
  onBack: () => void;
  onSearchToggle?: () => void;
  pinnedMessages?: Array<{ id: string; message: Message }>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const initials = (chat.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

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
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <motion.button
            onClick={onBack}
            className="md:hidden p-2 -ml-1 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft size={18} className="text-white/50" />
          </motion.button>

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

        <div className="flex items-center gap-1">
          {/* Pinned indicator */}
          {pinnedMessages && pinnedMessages.length > 0 && (
            <motion.button
              onClick={() => setShowPinned(v => !v)}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Закреплённые сообщения"
            >
              <Pin size={14} className="text-white/30" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white/15 flex items-center justify-center">
                <span className="text-[8px] text-white/60">{pinnedMessages.length}</span>
              </span>
            </motion.button>
          )}

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
                  <ChatMenuItem icon={Search} label="Поиск" onClick={onSearchToggle} />
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

      {/* Pinned messages bar */}
      <AnimatePresence>
        {showPinned && pinnedMessages && pinnedMessages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]"
          >
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                <Pin size={10} />
                <span>Закреплённые сообщения</span>
              </div>
              {pinnedMessages.map(pm => (
                <div key={pm.id} className="flex items-start gap-2 px-2 py-1 rounded-lg bg-white/[0.03]">
                  <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Pin size={8} className="text-white/30" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/50 font-medium truncate">
                      {pm.message.sender.displayName}
                    </p>
                    <p className="text-xs text-white/40 truncate">{pm.message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatMenuItem({
  icon: Icon,
  label,
  onClick,
  className = '',
}: {
  icon: typeof Search;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors ${className}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function MessageInput({
  onSend,
  replyTo,
  onCancelReply,
  chatId,
}: {
  onSend: (text: string, options?: { replyToId?: string }) => void;
  replyTo?: { id: string; content: string; sender: string } | null;
  onCancelReply?: () => void;
  chatId: string;
}) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Draft: restore saved text
  useEffect(() => {
    try {
      const draft = localStorage.getItem(`nexo_draft_${chatId}`);
      if (draft) {
        setText(draft);
      }
    } catch {}
  }, [chatId]);

  // Draft: save on change
  useEffect(() => {
    try {
      if (text.trim()) {
        localStorage.setItem(`nexo_draft_${chatId}`, text);
      } else {
        localStorage.removeItem(`nexo_draft_${chatId}`);
      }
    } catch {}
  }, [text, chatId]);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [replyTo]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed, replyTo ? { replyToId: replyTo.id } : undefined);
    setText('');
    onCancelReply?.();
    localStorage.removeItem(`nexo_draft_${chatId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const startRecording = async () => {
    try {
      setRecordingError('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Stop all tracks
        stream.getTracks().forEach(t => t.stop());

        if (chunksRef.current.length === 0) return;

        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });

        try {
          const media = await api.uploadFile(file);
          onSend('', { replyToId: replyTo?.id });
          // Send as audio message via WS with media
          const socket = await import('../lib/socket').then(m => m.getSocket());
          if (socket && socket.connected) {
            socket.emit('send_message', {
              chatId,
              content: '🎤 Голосовое сообщение',
              type: 'audio',
              media: [media],
              replyToId: replyTo?.id || null,
            });
            toast.success('Голосовое сообщение отправлено', undefined, 2000);
          }
        } catch (err) {
          console.error('[Voice] Failed to upload:', err);
          setRecordingError('Ошибка отправки');
        }
      };

      recorder.onerror = () => {
        setRecordingError('Ошибка записи');
        stream.getTracks().forEach(t => t.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      setIsRecording(true);
      setRecordingDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordingDuration(d => d + 1);
      }, 1000);
    } catch (err) {
      console.error('[Voice] Mic access denied:', err);
      setRecordingError('Нет доступа к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
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
    <div className="flex-shrink-0 border-t border-white/[0.06]">
      {/* Reply preview bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.04]"
          >
            <Reply size={12} className="text-white/30 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/50 font-medium">{replyTo.sender}</p>
              <p className="text-[11px] text-white/30 truncate">{replyTo.content}</p>
            </div>
            <motion.button
              onClick={onCancelReply}
              className="p-1 rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <X size={12} className="text-white/40" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="px-3 py-3">
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
            {recordingError && (
              <span className="text-xs text-red-400">{recordingError}</span>
            )}
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

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 5 }}
      className="p-2 rounded-xl liquid-glass-strong z-50"
      onClick={e => e.stopPropagation()}
    >
      <div className="grid grid-cols-4 gap-1">
        {COMMON_EMOJIS.map(emoji => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ForwardModal({
  onClose,
  onForward,
}: {
  onClose: () => void;
  onForward: (chatId: string) => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getChats()
      .then(data => {
        const chatArray: Chat[] = Array.isArray(data) ? data : ((data as any)?.chats ?? []);
        setChats(chatArray);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = search
    ? chats.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : chats;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-sm rounded-2xl liquid-glass-strong overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white/90">Переслать</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.08] transition-colors">
            <X size={14} className="text-white/40" />
          </button>
        </div>

        <div className="px-3 pt-2 pb-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск чатов..."
            className="w-full h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto px-2 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-8">Нет чатов</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => onForward(c.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-white/50">
                    {(c.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-white/70 truncate">{c.name || 'Без названия'}</span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TypingDots({ names }: { names: string[] }) {
  const label = names.length === 1
    ? `${names[0]} печатает`
    : names.length === 2
    ? `${names[0]} и ${names[1]} печатают`
    : `${names[0]} и ещё ${names.length - 1} печатают`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="flex items-center gap-2 px-4 py-1.5"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            className="w-1.5 h-1.5 rounded-full bg-white/30 block"
          />
        ))}
      </div>
      <span className="text-[11px] text-white/30">{label}</span>
    </motion.div>
  );
}

export function MessageArea({ chat, onBack }: MessageAreaProps) {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Feature states
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; sender: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [showForward, setShowForward] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const isChannel = chat.type === 'channel';
  const pinnedMessages = chat.pinnedMessages || [];

  // Fetch messages
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

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAutoScroll(isNearBottom);
  }, []);

  // Send message
  const handleSend = useCallback(async (text: string, options?: { replyToId?: string }) => {
    try {
      const optimisticId = `opt_${Date.now()}`;
      const optimisticMsg: Message = {
        id: optimisticId,
        chatId: chat.id,
        senderId: user?.id || '',
        content: text,
        type: 'text',
        replyToId: options?.replyToId || null,
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
        readBy: [{ userId: user?.id || '' }],
        _isSending: true,
      };

      setMessages(prev => [...prev, optimisticMsg]);
      setAutoScroll(true);

      const result = await api.sendMessageWS(chat.id, text, options);

      setMessages(prev =>
        prev.map(m =>
          m.id === optimisticId
            ? { ...m, id: result.messageId, createdAt: result.createdAt, _isSending: false }
            : m
        )
      );

      // Toast on send
      if (!options?.replyToId) {
        toast.success('Отправлено', text.length > 50 ? text.slice(0, 50) + '…' : text, 2000);
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev =>
        prev.map(m =>
          m.id.startsWith('opt_') && m._isSending
            ? { ...m, _isSending: false, _isFailed: true }
            : m
        )
      );
    }
  }, [chat.id, user]);

  // Toggle reaction
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      // Check if already reacted - find our reaction
      const msg = messages.find(m => m.id === messageId);
      const existingReaction = msg?.reactions?.find(
        r => r.emoji === emoji && r.userId === user?.id
      );

      if (existingReaction) {
        await api.removeReaction(messageId, emoji);
      } else {
        await api.addReaction(messageId, emoji);
      }

      // Update local state
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== messageId) return m;
          const reactions = [...(m.reactions || [])];
          if (existingReaction) {
            return { ...m, reactions: reactions.filter(r => r !== existingReaction) };
          }
          reactions.push({
            id: `optimistic-${Date.now()}`,
            emoji,
            userId: user?.id || '',
            user: { id: user?.id || '', username: user?.username || '', displayName: user?.displayName || '' },
          });
          return { ...m, reactions };
        })
      );
    } catch (err) {
      console.error('[React] Failed:', err);
    }
    setShowEmojiPicker(null);
  }, [messages, user]);

  // Typing indicator
  useEffect(() => {
    let cancelled = false;
    async function initTyping() {
      try {
        const { getSocket } = await import('../lib/socket');
        const socket = getSocket();
        if (!socket?.connected) return;

        socket.on('typing', (data: { chatId: string; userId: string; username: string }) => {
          if (cancelled || data.chatId !== chat.id || data.userId === user?.id) return;
          setTypingUsers(prev => prev.includes(data.username) ? prev : [...prev, data.username]);
          // Auto-clear after 3 seconds
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u !== data.username));
          }, 3000);
        });

        socket.on('stop_typing', (data: { chatId: string; userId: string }) => {
          if (cancelled || data.chatId !== chat.id) return;
          setTypingUsers([]);
        });
      } catch {}
    }
    initTyping();
    return () => { cancelled = true; };
  }, [chat.id, user?.id]);

  // Search
  useEffect(() => {
    if (!searchMode || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/messages/search?q=${encodeURIComponent(searchQuery)}&chatId=${chat.id}`, {
          credentials: 'include',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('nexo_access_token')}`,
          },
        });
        const data = await response.json();
        setSearchResults(data?.items || data || []);
      } catch (err) {
        console.error('[Search] Failed:', err);
      } finally {
        setSearching(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [searchQuery, searchMode, chat.id]);

  const handleForward = useCallback(async (targetChatId: string) => {
    if (!forwardingMsg) return;
    try {
      const content = forwardingMsg.content || '';
      await api.sendMessageWS(targetChatId, `📩 Переслано: ${content}`);
      toast.success('Переслано', undefined, 2000);
    } catch (err) {
      console.error('[Forward] Failed:', err);
    }
    setShowForward(null);
    setForwardingMsg(null);
  }, [forwardingMsg]);

  return (
    <>
      <ChatHeader
        chat={chat}
        onBack={onBack}
        onSearchToggle={() => setSearchMode(v => !v)}
        pinnedMessages={pinnedMessages}
      />

      {/* Search bar */}
      <AnimatePresence>
        {searchMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]"
          >
            <div className="px-3 py-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск в чате..."
                  autoFocus
                  className="w-full h-8 pl-9 pr-8 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchMode(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X size={12} className="text-white/30 hover:text-white/60" />
                  </button>
                )}
              </div>

              {/* Search results */}
              {searchQuery.length >= 2 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                  {searching ? (
                    <p className="text-xs text-white/30 text-center py-3">Поиск...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-white/20 text-center py-3">Ничего не найдено</p>
                  ) : (
                    searchResults.slice(0, 10).map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => {
                          setSearchQuery('');
                          setSearchMode(false);
                        }}
                        className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <Search size={10} className="text-white/20 mt-1 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/40">{msg.sender.displayName}</p>
                          <p className="text-xs text-white/50 truncate">{msg.content}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <div className="relative">
                    <MessageBubble
                      message={msg}
                      isOwn={msg.senderId === user?.id}
                      isChannel={isChannel}
                      onReply={() => setReplyTo({
                        id: msg.id,
                        content: msg.content || '',
                        sender: msg.sender.displayName || msg.sender.username,
                      })}
                      onReact={() => setShowEmojiPicker(
                        showEmojiPicker === msg.id ? null : msg.id
                      )}
                    />
                    {/* Emoji picker for this message */}
                    <AnimatePresence>
                      {showEmojiPicker === msg.id && (
                        <div className={`absolute top-0 z-40 ${msg.senderId === user?.id ? 'left-0 -translate-x-full pl-2' : 'right-0 translate-x-full pr-2'}`}>
                          <EmojiPicker
                            onSelect={(emoji) => handleReact(msg.id, emoji)}
                            onClose={() => setShowEmojiPicker(null)}
                          />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}

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

      {/* Typing indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && <TypingDots names={typingUsers} />}
      </AnimatePresence>

      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        chatId={chat.id}
      />

      {/* Forward modal */}
      <AnimatePresence>
        {showForward && (
          <ForwardModal
            onClose={() => { setShowForward(null); setForwardingMsg(null); }}
            onForward={handleForward}
          />
        )}
      </AnimatePresence>
    </>
  );
}
