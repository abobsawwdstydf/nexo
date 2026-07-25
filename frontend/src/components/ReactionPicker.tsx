import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import AnimatedEmoji from './AnimatedEmoji';

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

const REACTIONS = [
  { emoji: '❤️', name: 'Сердце', animation: 'hearts' },
  { emoji: '👍', name: 'Лайк', animation: 'thumbsup' },
  { emoji: '😂', name: 'Смех', animation: 'laugh' },
  { emoji: '😮', name: 'Удивление', animation: 'wow' },
  { emoji: '😢', name: 'Грусть', animation: 'sad' },
  { emoji: '🔥', name: 'Огонь', animation: 'fire' },
  { emoji: '🎉', name: 'Праздник', animation: 'confetti' },
  { emoji: '👏', name: 'Аплодисменты', animation: 'clap' },
  { emoji: '💯', name: '100', animation: 'hundred' },
  { emoji: '🤔', name: 'Думаю', animation: 'thinking' },
  { emoji: '😍', name: 'Влюблён', animation: 'love' },
  { emoji: '🤩', name: 'Звёзды', animation: 'starstruck' },
  { emoji: '😎', name: 'Крутой', animation: 'cool' },
  { emoji: '🥳', name: 'Вечеринка', animation: 'party' },
  { emoji: '😱', name: 'Шок', animation: 'shock' },
];

export default function ReactionPicker({ onSelect, onClose, position }: ReactionPickerProps) {
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50"
        onClick={onClose}
      />

      {/* Picker */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 10 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed z-50 bg-surface-secondary/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl p-3"
        style={{
          left: position ? `${position.x}px` : '50%',
          top: position ? `${position.y}px` : '50%',
          transform: position ? 'translate(-50%, -100%)' : 'translate(-50%, -50%)'
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2 px-1">
          <span className="text-xs font-medium text-zinc-400">Реакции</span>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={14} className="text-zinc-400" />
          </button>
        </div>

        {/* Reactions Grid */}
        <div className="grid grid-cols-5 gap-1">
          {REACTIONS.map((reaction) => (
            <motion.button
              key={reaction.emoji}
              onClick={() => {
                onSelect(reaction.emoji);
                onClose();
              }}
              onMouseEnter={() => setHoveredEmoji(reaction.emoji)}
              onMouseLeave={() => setHoveredEmoji(null)}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.9 }}
              className="relative w-12 h-12 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors"
            >
              <AnimatedEmoji emoji={reaction.emoji} size={32} />

              {/* Tooltip */}
              <AnimatePresence>
                {hoveredEmoji === reaction.emoji && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 bg-black/90 text-white text-xs px-2 py-1 rounded-lg whitespace-nowrap pointer-events-none"
                  >
                    {reaction.name}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </>
  );
}
