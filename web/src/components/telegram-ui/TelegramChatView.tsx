import { useState, useRef, useCallback, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft,
  Search,
  Phone,
  Video,
  MoreVertical,
  Pin,
  VolumeX,
  Trash2,
  Users,
  Settings,
  Image as ImageIcon,
  Wallpaper,
  Megaphone,
  Eye,
} from 'lucide-react';
import TelegramNavBar from './TelegramNavBar';
import TelegramChatInput from './TelegramChatInput';
import TelegramMessageBubble from './TelegramMessageBubble';
import { normalizeMediaUrl } from '../../lib/mediaUrl';

interface ChatMessage {
  id: string;
  text: string;
  timestamp: string;
  isOwn: boolean;
  isRead?: boolean;
  senderName?: string;
  senderColor?: string;
  replyTo?: { text: string; senderName?: string };
  media?: { type: string; url: string; duration?: number; fileName?: string; fileSize?: string };
  reactions?: { emoji: string; count: number; isSelected: boolean }[];
}

interface TelegramChatViewProps {
  chatName: string;
  avatarUrl?: string | null;
  isOnline?: boolean;
  isChannel?: boolean;
  isGroup?: boolean;
  memberCount?: number;
  messages: ChatMessage[];
  currentUserId: string;
  onBack?: () => void;
  onCall?: () => void;
  onVideoCall?: () => void;
  onInfo?: () => void;
  onSearch?: (query: string) => void;
  onSendMessage: (text: string) => void;
  onReply?: (messageId: string) => void;
  onForward?: (messageId: string) => void;
  onCopy?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  onDelete?: (messageId: string) => void;
  onReactionAdd?: (messageId: string, emoji: string) => void;
  onReactionRemove?: (messageId: string, emoji: string) => void;
  typingUsers?: string[];
  className?: string;
}

function TelegramChatView({
  chatName,
  avatarUrl,
  isOnline = false,
  isChannel = false,
  isGroup = false,
  memberCount,
  messages,
  currentUserId,
  onBack,
  onCall,
  onVideoCall,
  onInfo,
  onSearch,
  onSendMessage,
  onReply,
  onForward,
  onCopy,
  onPin,
  onDelete,
  onReactionAdd,
  onReactionRemove,
  typingUsers,
  className = '',
}: TelegramChatViewProps) {
  const [inputValue, setInputValue] = useState('');
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(() => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim());
    setInputValue('');
    setReplyTo(null);
  }, [inputValue, onSendMessage]);

  const handleReply = useCallback(
    (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId);
      if (msg) setReplyTo(msg);
    },
    [messages]
  );

  const subtitle = typingUsers?.length
    ? typingUsers.length === 1
      ? `${typingUsers[0]} печатает...`
      : `${typingUsers.length} печатают...`
    : isChannel
      ? `${memberCount?.toLocaleString() || 0} подписчиков`
      : isGroup
        ? `${memberCount?.toLocaleString() || 0} участников`
        : isOnline
          ? 'в сети'
          : 'не в сети';

  return (
    <div className={`flex flex-col h-full bg-[#09090b] ${className}`}>
      {/* Navigation bar */}
      <TelegramNavBar
        title={chatName}
        subtitle={subtitle}
        showBack={!!onBack}
        onBack={onBack}
        rightButtons={[
          ...(onCall
            ? [{ icon: <Phone size={19} className="text-white/70" />, onClick: onCall }]
            : []),
          ...(onVideoCall
            ? [{ icon: <Video size={19} className="text-white/70" />, onClick: onVideoCall }]
            : []),
          ...(onSearch
            ? [{ icon: <Search size={19} className="text-white/70" />, onClick: () => onSearch('') }]
            : []),
          ...(onInfo
            ? [{ icon: <MoreVertical size={19} className="text-white/70" />, onClick: onInfo }]
            : []),
        ]}
      />

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden py-2"
      >
        {messages.map((msg) => (
          <TelegramMessageBubble
            key={msg.id}
            text={msg.text}
            timestamp={msg.timestamp}
            isOwn={msg.isOwn}
            isRead={msg.isRead}
            senderName={msg.senderName}
            senderColor={msg.senderColor}
            replyTo={msg.replyTo}
            media={msg.media as any}
            reactions={msg.reactions}
            onReply={onReply ? () => handleReply(msg.id) : undefined}
            onForward={onForward ? () => onForward(msg.id) : undefined}
            onCopy={onCopy ? () => onCopy(msg.id) : undefined}
            onPin={onPin ? () => onPin(msg.id) : undefined}
            onDelete={onDelete ? () => onDelete(msg.id) : undefined}
            onReactionAdd={onReactionAdd ? (emoji) => onReactionAdd(msg.id, emoji) : undefined}
            onReactionRemove={onReactionRemove ? (emoji) => onReactionRemove(msg.id, emoji) : undefined}
          />
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {typingUsers && typingUsers.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex items-center gap-2 px-4 py-2"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    animate={{
                      y: [0, -4, 0],
                      opacity: [0.4, 1, 0.4],
                    }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.15,
                    }}
                    className="w-1.5 h-1.5 rounded-full bg-white/40"
                  />
                ))}
              </div>
              <span className="text-[12px] text-white/30">
                {typingUsers[0]} печатает
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <TelegramChatInput
        value={inputValue}
        onChange={setInputValue}
        onSend={handleSend}
        replyPreview={
          replyTo
            ? {
                text: replyTo.text,
                senderName: replyTo.senderName || (replyTo.isOwn ? 'Вы' : chatName),
                onClear: () => setReplyTo(null),
              }
            : undefined
        }
        placeholder={
          isChannel ? 'Комментарий...' : 'Сообщение'
        }
      />
    </div>
  );
}

export default memo(TelegramChatView);
