import { getAnimatedEmojiUrl } from '../lib/animatedEmojis';

interface AnimatedEmojiProps {
  emoji: string;
  size?: number;
  className?: string;
  fallbackToText?: boolean;
}

/**
 * Компонент для рендеринга анимированного эмодзи.
 * Если для эмодзи есть GIF — показывает анимацию.
 * Иначе — fallback на текстовый эмодзи.
 */
export default function AnimatedEmoji({ emoji, size = 24, className = '', fallbackToText = true }: AnimatedEmojiProps) {
  const gifUrl = getAnimatedEmojiUrl(emoji);

  if (gifUrl) {
    return (
      <img
        src={gifUrl}
        alt={emoji}
        width={size}
        height={size}
        className={`inline-block object-contain ${className}`}
        style={{ imageRendering: 'auto' }}
        loading="lazy"
        draggable={false}
      />
    );
  }

  if (fallbackToText) {
    return (
      <span
        className={`inline-block ${className}`}
        style={{ fontSize: size * 0.75, lineHeight: 1 }}
        role="img"
        aria-label={emoji}
      >
        {emoji}
      </span>
    );
  }

  return null;
}
