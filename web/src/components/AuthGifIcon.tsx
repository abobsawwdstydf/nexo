import { useState } from 'react';
import { motion } from 'framer-motion';

interface AuthGifIconProps {
  src: string;
  alt?: string;
  size?: number;
  className?: string;
  focused?: boolean;
}

export default function AuthGifIcon({ src, alt = '', size = 20, className = '', focused = false }: AuthGifIconProps) {
  const [loaded, setLoaded] = useState(false);

  return (
    <motion.div
      className={`relative flex-shrink-0 ${className}`}
      initial={{ opacity: 0, scale: 0.5, rotate: -20 }}
      animate={{
        opacity: loaded ? 1 : 0,
        scale: focused ? 1.15 : 1,
        rotate: 0,
      }}
      whileHover={{ scale: 1.25, rotate: [0, -8, 8, -4, 0] }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
    >
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        onLoad={() => setLoaded(true)}
        className="pointer-events-none select-none"
        style={{ imageRendering: 'auto' }}
      />
      {focused && (
        <motion.div
          className="absolute -inset-1 rounded-full bg-[#6366f1]/20"
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
    </motion.div>
  );
}
