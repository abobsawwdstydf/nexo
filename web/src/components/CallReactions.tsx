import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';

interface Reaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

const REACTION_EMOJIS = ['❤️', '🔥', '😂', '😮', '😢', '👍', '🎉', '✨'];
const STICKERS = ['🎤', '🎵', '💯', '🚀', '⭐', '🌈', '🎨', '🎭'];

interface CallReactionsProps {
  isActive: boolean;
  onSendReaction: (emoji: string, isSticker?: boolean) => void;
  onClose: () => void;
}

export default function CallReactions({ isActive, onSendReaction, onClose }: CallReactionsProps) {
  const [selectedTab, setSelectedTab] = useState<'emoji' | 'stickers'>('emoji');
  
  const handleReaction = (emoji: string) => {
    const isSticker = STICKERS.includes(emoji);
    onSendReaction(emoji, isSticker);
  };
  
  if (!isActive) return null;
  
  return (
    <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.9 }}
        className="bg-black/80 backdrop-blur-2xl rounded-3xl border border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
          <div className="flex gap-1">
            <button
              onClick={() => setSelectedTab('emoji')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedTab === 'emoji'
                  ? 'bg-nexo-500/30 text-nexo-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Реакции
            </button>
            <button
              onClick={() => setSelectedTab('stickers')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                selectedTab === 'stickers'
                  ? 'bg-nexo-500/30 text-nexo-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              Стикеры
            </button>
          </div>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-white/10 transition-colors">
            <X size={16} className="text-zinc-400" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-3">
          <div className="flex flex-wrap gap-2 justify-center max-w-[280px]">
            <AnimatePresence mode="wait">
              {selectedTab === 'emoji' ? (
                <motion.div
                  key="emoji"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="flex flex-wrap gap-2"
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <motion.button
                      key={emoji}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleReaction(emoji)}
                      className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-full transition-colors"
                    >
                      {emoji}
                    </motion.button>
                  ))}
                </motion.div>
              ) : (
                <motion.div
                  key="stickers"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex flex-wrap gap-2"
                >
                  {STICKERS.map((sticker) => (
                    <motion.button
                      key={sticker}
                      whileHover={{ scale: 1.2 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleReaction(sticker)}
                      className="w-10 h-10 flex items-center justify-center text-2xl hover:bg-white/10 rounded-full transition-colors"
                    >
                      {sticker}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        {/* Quick reactions bar */}
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-2">
          <Sparkles size={14} className="text-nexo-400" />
          <span className="text-xs text-zinc-400">Быстрые:</span>
          <div className="flex gap-1">
            {REACTION_EMOJIS.slice(0, 4).map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleReaction(emoji)}
                className="w-7 h-7 flex items-center justify-center text-lg hover:bg-white/10 rounded-full transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
