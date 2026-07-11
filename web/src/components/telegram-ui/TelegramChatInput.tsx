import { useState, useRef, useCallback, useEffect, memo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smile,
  Paperclip,
  Mic,
  Send,
  Camera,
  Image as ImageIcon,
  X,
  Reply,
  Edit3,
  Forward,
  ChevronDown,
} from 'lucide-react';

interface ReplyPreview {
  text: string;
  senderName?: string;
  mediaType?: string;
  onClear: () => void;
}

interface TelegramChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  onVoiceRecord?: () => void;
  onAttach?: () => void;
  onEmoji?: () => void;
  onCamera?: () => void;
  placeholder?: string;
  replyPreview?: ReplyPreview;
  isEditing?: boolean;
  editPreview?: { text: string; onClear: () => void };
  rightButtons?: ReactNode;
  className?: string;
}

function TelegramChatInput({
  value,
  onChange,
  onSend,
  onVoiceRecord,
  onAttach,
  onEmoji,
  onCamera,
  placeholder = 'Сообщение',
  replyPreview,
  isEditing = false,
  editPreview,
  rightButtons,
  className = '',
}: TelegramChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  const hasText = value.trim().length > 0;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const maxHeight = 150;
    textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (hasText) {
          onSend();
        }
      }
    },
    [hasText, onSend]
  );

  const handleSubmit = useCallback(() => {
    if (hasText) {
      onSend();
    }
  }, [hasText, onSend]);

  return (
    <div className={`relative flex-shrink-0 ${className}`}>
      {/* Reply/Edit preview */}
      <AnimatePresence>
        {(replyPreview || isEditing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-2 px-4 py-2.5 bg-white/[0.04] border-t border-white/[0.06]">
              <div className="w-0.5 h-8 rounded-full bg-[var(--color-accent)] flex-shrink-0" />
              <div className="flex-1 min-w-0">
                {isEditing && editPreview ? (
                  <>
                    <p className="text-[12px] text-[var(--color-accent)] font-medium">Редактирование</p>
                    <p className="text-[13px] text-white/60 truncate">{editPreview.text}</p>
                  </>
                ) : replyPreview ? (
                  <>
                    <p className="text-[12px] text-[var(--color-accent)] font-medium">
                      {replyPreview.senderName || 'Ответ'}
                    </p>
                    <p className="text-[13px] text-white/60 truncate">{replyPreview.text}</p>
                  </>
                ) : null}
              </div>
              <button
                onClick={isEditing ? editPreview?.onClear : replyPreview?.onClear}
                className="w-7 h-7 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X size={14} className="text-white/50" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input area */}
      <div className="glass-strong border-t border-white/[0.06]">
        <div className="flex items-end gap-1.5 px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          {/* Emoji button */}
          {onEmoji && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onEmoji}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 mb-0.5"
            >
              <Smile size={22} className="text-white/50" />
            </motion.button>
          )}

          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              rows={1}
              className="w-full resize-none bg-white/[0.06] border border-white/[0.06] rounded-2xl px-3.5 py-2 text-[15px] text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--color-accent)]/40 focus:bg-white/[0.08] transition-all leading-[1.35]"
              style={{ maxHeight: '150px' }}
            />
          </div>

          {/* Attach button */}
          {onAttach && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onAttach}
              className="flex items-center justify-center w-9 h-9 rounded-full hover:bg-white/10 transition-colors flex-shrink-0 mb-0.5"
            >
              <Paperclip size={22} className="text-white/50 rotate-[-45deg]" />
            </motion.button>
          )}

          {/* Send / Voice / Camera */}
          {hasText ? (
            <motion.button
              key="send"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              whileTap={{ scale: 0.85 }}
              onClick={handleSubmit}
              className="w-9 h-9 rounded-full bg-[var(--color-accent)] flex items-center justify-center flex-shrink-0 mb-0.5 shadow-lg shadow-[var(--color-accent)]/20"
            >
              <Send size={18} className="text-white ml-0.5" />
            </motion.button>
          ) : (
            <div className="flex items-center gap-0.5 flex-shrink-0 mb-0.5">
              {onCamera && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onCamera}
                  className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <Camera size={22} className="text-white/50" />
                </motion.button>
              )}
              {onVoiceRecord && (
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={onVoiceRecord}
                  className="w-9 h-9 rounded-full hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  <Mic size={22} className="text-white/50" />
                </motion.button>
              )}
            </div>
          )}

          {rightButtons}
        </div>
      </div>
    </div>
  );
}

export default memo(TelegramChatInput);
