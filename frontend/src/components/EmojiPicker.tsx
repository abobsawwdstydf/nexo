import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import BottomSheet from './BottomSheet';
import AnimatedEmoji from './AnimatedEmoji';
import { EMOJI_CATEGORIES } from '../lib/animatedEmojis';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [isMobile, setIsMobile] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const pickerContent = (
    <div className="flex-1 overflow-hidden flex flex-col min-h-0">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] overflow-x-auto flex-shrink-0 scrollbar-hide">
        {EMOJI_CATEGORIES.map((cat, i) => (
          <button
            key={cat.name}
            onClick={() => setActiveCategory(i)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeCategory === i
                ? 'bg-nexo-500/20 text-nexo-400 border border-nexo-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATEGORIES[activeCategory]?.emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              className="w-full aspect-square rounded-lg hover:bg-white/[0.08] transition-colors flex items-center justify-center p-0.5"
              title={emoji}
            >
              <AnimatedEmoji emoji={emoji} size={28} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (isMobile) {
    return createPortal(
      <BottomSheet isOpen={true} onClose={onClose} title="Эмодзи" maxHeight="70vh">
        {pickerContent}
      </BottomSheet>,
      document.body
    );
  }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99990]" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.15 }}
        className="fixed z-[99991] rounded-2xl shadow-2xl border border-white/10 bg-[#111113] overflow-hidden flex flex-col bottom-20 left-1/2 -translate-x-1/2 w-[380px] max-h-[480px]"
        onClick={e => e.stopPropagation()}
      >
        {pickerContent}
      </motion.div>
    </>,
    document.body
  );
}
