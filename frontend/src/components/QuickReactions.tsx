import React from 'react';
import { motion } from 'framer-motion';
import { AnimatedEmoji } from './AnimatedEmoji';

interface QuickReactionsProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

const QUICK_REACTIONS = ['👍', '❤️', '🔥', '😂', '😮', '😢', '👏', '🎉'];

export function QuickReactions({ onSelect, onClose }: QuickReactionsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.8, y: 10 }}
      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 rounded-2xl liquid-glass-strong border border-white/[0.1] shadow-2xl z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1">
        {QUICK_REACTIONS.map((emoji) => (
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.3, y: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="p-1.5 rounded-xl hover:bg-white/[0.1] transition-colors"
          >
            <AnimatedEmoji emoji={emoji} size={28} />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}
