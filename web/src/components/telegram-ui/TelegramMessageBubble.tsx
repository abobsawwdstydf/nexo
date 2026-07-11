import { useState, useRef, useCallback, memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCheck,
  Reply,
  Forward,
  Copy,
  Pin,
  Bookmark,
  Trash2,
  MoreVertical,
  Play,
  Pause,
  FileText,
  Download,
} from 'lucide-react';
import { normalizeMediaUrl } from '../../lib/mediaUrl';

interface ReplyData {
  text: string;
  senderName?: string;
  mediaType?: string;
  onClick?: () => void;
}

interface TelegramMessageBubbleProps {
  text: string;
  timestamp: string;
  isOwn: boolean;
  isRead?: boolean;
  senderName?: string;
  senderColor?: string;
  isVerified?: boolean;
  replyTo?: ReplyData;
  forwarded?: boolean;
  media?: {
    type: 'image' | 'video' | 'voice' | 'sticker' | 'file' | 'gif';
    url: string;
    duration?: number;
    thumbnail?: string;
    fileName?: string;
    fileSize?: string;
  };
  reactions?: { emoji: string; count: number; isSelected: boolean }[];
  onReply?: () => void;
  onForward?: () => void;
  onCopy?: () => void;
  onPin?: () => void;
  onDelete?: () => void;
  onReactionAdd?: (emoji: string) => void;
  onReactionRemove?: (emoji: string) => void;
  children?: ReactNode;
  className?: string;
}

function TelegramMessageBubble({
  text,
  timestamp,
  isOwn,
  isRead = false,
  senderName,
  senderColor = '#6366f1',
  isVerified = false,
  replyTo,
  forwarded,
  media,
  reactions = [],
  onReply,
  onForward,
  onCopy,
  onPin,
  onDelete,
  onReactionAdd,
  onReactionRemove,
  children,
  className = '',
}: TelegramMessageBubbleProps) {
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handlePointerDown = useCallback(() => {
    setIsPressed(true);
    longPressTimer.current = setTimeout(() => {
      setShowContextMenu(true);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    setIsPressed(false);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  }, []);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setShowContextMenu(true);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`relative flex ${isOwn ? 'justify-end' : 'justify-start'} px-3 py-[2px] group ${className}`}
    >
      <div
        className={`relative max-w-[85%] sm:max-w-[65%] ${isOwn ? 'ml-[15%]' : 'mr-[15%]'}`}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onContextMenu={handleContextMenu}
      >
        {/* Bubble */}
        <motion.div
          animate={{
            scale: isPressed ? 0.98 : 1,
          }}
          transition={{ duration: 0.1 }}
          className={`relative rounded-2xl px-3 py-1.5 ${
            isOwn
              ? 'bg-[var(--color-accent)] text-white rounded-br-sm shadow-lg shadow-[var(--color-accent)]/20'
              : 'bg-white/[0.06] text-white rounded-bl-sm shadow-md shadow-black/10'
          }`}
        >
          {/* Sender name */}
          {senderName && !isOwn && (
            <div className="flex items-center gap-1 mb-0.5">
              <span className="text-[13px] font-semibold" style={{ color: senderColor }}>
                {senderName}
              </span>
              {isVerified && (
                <div className="w-3.5 h-3.5 rounded-full bg-[var(--color-accent)] flex items-center justify-center">
                  <svg width="7" height="5" viewBox="0 0 10 8" fill="white">
                    <path d="M1 4l2.5 2.5L9 1" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Forwarded header */}
          {forwarded && (
            <div className="flex items-center gap-1 mb-1 opacity-60">
              <Forward size={12} />
              <span className="text-[11px] font-medium">Пересланное сообщение</span>
            </div>
          )}

          {/* Reply preview */}
          {replyTo && (
            <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={replyTo.onClick}
              className={`w-full flex items-start gap-2 mb-1.5 p-2 rounded-lg ${
                isOwn ? 'bg-white/[0.12]' : 'bg-white/[0.04]'
              } border-l-2 ${isOwn ? 'border-white/30' : 'border-[var(--color-accent)]/50'}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold" style={{ color: isOwn ? 'rgba(255,255,255,0.8)' : senderColor }}>
                  {replyTo.senderName || 'Ответ'}
                </p>
                <p className="text-[12px] text-white/50 truncate">{replyTo.text}</p>
              </div>
            </motion.button>
          )}

          {/* Media */}
          {media && (
            <div className="mb-1 -mx-1 -mt-0.5">
              {media.type === 'image' && (
                <div className="rounded-xl overflow-hidden">
                  <img
                    src={normalizeMediaUrl(media.url)}
                    alt=""
                    className="w-full h-auto max-h-[300px] object-cover"
                    loading="lazy"
                  />
                </div>
              )}
              {media.type === 'video' && (
                <div className="rounded-xl overflow-hidden relative">
                  <video
                    src={normalizeMediaUrl(media.url)}
                    poster={media.thumbnail ? normalizeMediaUrl(media.thumbnail) : undefined}
                    controls
                    className="w-full h-auto max-h-[300px] object-cover"
                    preload="metadata"
                  />
                </div>
              )}
              {media.type === 'voice' && (
                <div className="flex items-center gap-2 px-1 py-1">
                  <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Play size={14} className="text-white ml-0.5" fill="white" />
                  </div>
                  <div className="flex-1 h-[2px] bg-white/20 rounded-full">
                    <div className="w-0 h-full bg-white/60 rounded-full" />
                  </div>
                  <span className="text-[10px] text-white/40 tabular-nums">
                    {media.duration ? `${Math.floor(media.duration / 60)}:${(media.duration % 60).toString().padStart(2, '0')}` : '0:00'}
                  </span>
                </div>
              )}
              {media.type === 'file' && (
                <div className="flex items-center gap-3 p-2 rounded-xl bg-white/[0.06]">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <FileText size={18} className="text-white/50" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] text-white truncate">{media.fileName || 'Файл'}</p>
                    {media.fileSize && (
                      <p className="text-[11px] text-white/40">{media.fileSize}</p>
                    )}
                  </div>
                  <Download size={16} className="text-white/40 flex-shrink-0" />
                </div>
              )}
              {media.type === 'sticker' && (
                <div className="w-[160px] h-[160px]">
                  <img
                    src={normalizeMediaUrl(media.url)}
                    alt=""
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              )}
              {media.type === 'gif' && (
                <div className="rounded-xl overflow-hidden">
                  <img
                    src={normalizeMediaUrl(media.url)}
                    alt=""
                    className="w-full h-auto max-h-[250px] object-cover"
                    loading="lazy"
                  />
                </div>
              )}
            </div>
          )}

          {/* Text + time row */}
          <div className="flex items-end gap-2">
            <p className="text-[14.5px] leading-[1.4] whitespace-pre-wrap break-words">{text}</p>
            <div className="flex items-center gap-0.5 flex-shrink-0 ml-1 mb-0.5">
              <span className="text-[10.5px] opacity-50 tabular-nums whitespace-nowrap">{timestamp}</span>
              {isOwn && (
                isRead ? (
                  <CheckCheck size={14} className="text-white/70" />
                ) : (
                  <Check size={14} className="text-white/50" />
                )
              )}
            </div>
          </div>
        </motion.div>

        {/* Reactions */}
        {reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
            {reactions.map((r, i) => (
              <motion.button
                key={i}
                whileTap={{ scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                onClick={() =>
                  r.isSelected ? onReactionRemove?.(r.emoji) : onReactionAdd?.(r.emoji)
                }
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[12px] border transition-all duration-200 ${
                  r.isSelected
                    ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]/40 text-white shadow-sm'
                    : 'bg-white/[0.04] border-white/[0.06] text-white/60 hover:bg-white/[0.08] hover:border-white/[0.1]'
                }`}
              >
                <span>{r.emoji}</span>
                {r.count > 1 && <span className="text-[10px]">{r.count}</span>}
              </motion.button>
            ))}
          </div>
        )}

        {/* Context menu */}
        <AnimatePresence>
          {showContextMenu && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40"
                onClick={() => setShowContextMenu(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: -5 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -5 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`absolute z-50 top-0 ${
                  isOwn ? 'right-0' : 'left-0'
                } mt-0 min-w-[180px] rounded-2xl glass-strong border border-white/[0.1] shadow-2xl overflow-hidden py-1 backdrop-blur-xl`}
              >
                {onReply && (
                  <ContextMenuItem icon={<Reply size={16} />} label="Ответить" onClick={() => { onReply(); setShowContextMenu(false); }} />
                )}
                {onForward && (
                  <ContextMenuItem icon={<Forward size={16} />} label="Переслать" onClick={() => { onForward(); setShowContextMenu(false); }} />
                )}
                {onCopy && (
                  <ContextMenuItem icon={<Copy size={16} />} label="Копировать" onClick={() => { onCopy(); setShowContextMenu(false); }} />
                )}
                {onPin && (
                  <ContextMenuItem icon={<Pin size={16} />} label="Закрепить" onClick={() => { onPin(); setShowContextMenu(false); }} />
                )}
                <ContextMenuItem icon={<Bookmark size={16} />} label="В избранное" onClick={() => setShowContextMenu(false)} />
                {onDelete && (
                  <ContextMenuItem icon={<Trash2 size={16} />} label="Удалить" danger onClick={() => { onDelete(); setShowContextMenu(false); }} />
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function ContextMenuItem({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.08] transition-all duration-150 ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-white/80 hover:text-white'
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="text-[13px] font-medium">{label}</span>
    </button>
  );
}

export default memo(TelegramMessageBubble);
