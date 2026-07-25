import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAnimatedEmojiUrl } from '../lib/animatedEmojis';

interface FloatingReaction {
  id: string;
  emoji: string;
  isSticker: boolean;
  x: number;
  startTime: number;
}

interface FloatingReactionsProps {
  reactions: FloatingReaction[];
}

export default function FloatingReactions({ reactions }: FloatingReactionsProps) {
  const [activeReactions, setActiveReactions] = useState<FloatingReaction[]>([]);

  useEffect(() => {
    reactions.forEach((reaction) => {
      if (!activeReactions.find(r => r.id === reaction.id)) {
        setActiveReactions(prev => [...prev, reaction]);
      }
    });

    const timer = setTimeout(() => {
      setActiveReactions(prev => prev.filter(r =>
        Date.now() - r.startTime < 3000
      ));
    }, 100);

    return () => clearTimeout(timer);
  }, [reactions]);

  const renderEmoji = (emoji: string, size: number) => {
    const gifUrl = getAnimatedEmojiUrl(emoji);
    if (gifUrl) {
      return (
        <img
          src={gifUrl}
          alt={emoji}
          width={size}
          height={size}
          className="object-contain"
          draggable={false}
        />
      );
    }
    return <span style={{ fontSize: size }}>{emoji}</span>;
  };

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      <AnimatePresence>
        {activeReactions.map((reaction) => (
          <motion.div
            key={reaction.id}
            initial={{
              opacity: 0,
              y: 0,
              x: reaction.x,
              scale: 0.5,
              rotate: 0
            }}
            animate={{
              opacity: [0, 1, 1, 0],
              y: -200,
              x: reaction.x + (Math.random() - 0.5) * 100,
              scale: [0.5, 1.2, 1, 0.8],
              rotate: (Math.random() - 0.5) * 60
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: 2.5, ease: 'easeOut' }}
            className="absolute bottom-20"
            style={{ left: `${reaction.x}%` }}
          >
            {renderEmoji(reaction.emoji, 72)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
