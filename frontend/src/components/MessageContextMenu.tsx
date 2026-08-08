import React, { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Pin, Reply, Copy, Edit3, Trash2, Forward } from 'lucide-react';
import type { Message } from '../lib/types';

interface MessageContextMenuProps {
  message: Message;
  isOwn: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onReply: (message: Message) => void;
  onForward: (message: Message) => void;
  onPin: (messageId: string) => void;
  onCopy: (content: string) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string, forEveryone: boolean) => void;
}

export function MessageContextMenu({
  message,
  isOwn,
  position,
  onClose,
  onReply,
  onForward,
  onPin,
  onCopy,
  onEdit,
  onDelete,
}: MessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <motion.div
      ref={menuRef}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="fixed z-50 w-52 py-1.5 rounded-2xl liquid-glass-strong border border-white/[0.1] shadow-2xl"
      style={{ top: position.y, left: position.x }}
    >
      <button
        onClick={() => { onPin(message.id); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Pin size={14} />
        Закрепить
      </button>
      <button
        onClick={() => { onReply(message); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Reply size={14} />
        Ответить
      </button>
      <button
        onClick={() => { onCopy(message.content || ''); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Copy size={14} />
        Копировать
      </button>
      <button
        onClick={() => { onForward(message); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
      >
        <Forward size={14} />
        Переслать
      </button>
      {isOwn && (
        <button
          onClick={() => { onEdit(message); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-white/70 hover:bg-white/[0.08] transition-colors"
        >
          <Edit3 size={14} />
          Редактировать
        </button>
      )}
      <div className="mx-3 my-1 h-px bg-white/[0.06]" />
      <button
        onClick={() => { onDelete(message.id, false); onClose(); }}
        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.08] transition-colors"
      >
        <Trash2 size={14} />
        Удалить для меня
      </button>
      {isOwn && (
        <button
          onClick={() => { onDelete(message.id, true); onClose(); }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-400 hover:bg-white/[0.08] transition-colors"
        >
          <Trash2 size={14} />
          Удалить для всех
        </button>
      )}
    </motion.div>
  );
}
