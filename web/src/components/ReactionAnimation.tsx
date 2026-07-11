import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getAnimatedEmojiUrl, hasAnimatedEmoji } from '../lib/animatedEmojis';

interface ReactionAnimationProps {
  emoji: string;
  onComplete: () => void;
}

export default function ReactionAnimation({ emoji, onComplete }: ReactionAnimationProps) {
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; rotation: number; delay: number }>>([]);

  const gifUrl = getAnimatedEmojiUrl(emoji);

  useEffect(() => {
    const newParticles = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      x: Math.random() * window.innerWidth,
      y: window.innerHeight + 50,
      rotation: Math.random() * 360,
      delay: Math.random() * 0.5
    }));
    setParticles(newParticles);

    const timer = setTimeout(onComplete, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  const getAnimation = () => {
    switch (emoji) {
      case '❤️': return 'hearts';
      case '🎉': return 'confetti';
      case '🔥': return 'fire';
      case '👍': return 'thumbsup';
      case '😂': return 'laugh';
      case '😮': return 'wow';
      case '😢': return 'sad';
      case '👏': return 'clap';
      case '✨': return 'glow';
      case '⭐': case '💫': return 'glow';
      case '🎄': case '🌲': return 'sway';
      case '❄️': case '🍂': case '🌸': return 'fall';
      case '💡': case '🔮': return 'flicker';
      case '🏀': case '⚽': return 'jump';
      default: return 'default';
    }
  };

  const getEmojiCssClass = () => {
    switch (emoji) {
      case '❤️': return 'emoji-heartbeat';
      case '🔥': return 'emoji-pulse';
      case '✨': case '⭐': case '💫': return 'emoji-glow';
      case '🎄': case '🌲': return 'emoji-sway';
      case '❄️': case '🍂': case '🌸': return 'emoji-fall';
      case '💡': case '🔮': return 'emoji-flicker';
      case '🏀': case '⚽': return 'emoji-jump';
      case '⚙️': case '🎡': return 'emoji-spin';
      default: return 'emoji-bounce';
    }
  };

  const animationType = getAnimation();

  const renderEmoji = (size: number, className: string) => {
    if (gifUrl) {
      return (
        <img
          src={gifUrl}
          alt={emoji}
          width={size}
          height={size}
          className={`${className} object-contain`}
          draggable={false}
        />
      );
    }
    return <span className={className}>{emoji}</span>;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] pointer-events-none"
    >
      {/* Центральный эмодзи */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{
          scale: [0, 1.5, 1.2],
          opacity: [0, 1, 0]
        }}
        transition={{
          duration: 1.5,
          times: [0, 0.5, 1]
        }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        {renderEmoji(200, getEmojiCssClass())}
      </motion.div>

      {/* Частицы */}
      <AnimatePresence>
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            initial={{
              x: particle.x,
              y: particle.y,
              opacity: 0,
              scale: 0,
              rotate: particle.rotation
            }}
            animate={{
              y: animationType === 'confetti' ? -100 : particle.y - window.innerHeight - 100,
              opacity: [0, 1, 1, 0],
              scale: [0, 1, 1, 0.5],
              rotate: particle.rotation + (animationType === 'confetti' ? 720 : 360)
            }}
            transition={{
              duration: 2.5,
              delay: particle.delay,
              ease: 'easeOut'
            }}
            className="absolute"
          >
            {renderEmoji(40, 'text-4xl')}
          </motion.div>
        ))}
      </AnimatePresence>

      {/* Специальные эффекты */}
      {animationType === 'fire' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.3, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-t from-orange-500/20 via-red-500/10 to-transparent"
        />
      )}

      {animationType === 'hearts' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.2, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-gradient-to-t from-pink-500/20 via-red-500/10 to-transparent"
        />
      )}
    </motion.div>
  );
}
