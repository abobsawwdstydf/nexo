import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Loader2, Sparkles } from 'lucide-react';

/**
 * Loading States Components
 * Beautiful loading indicators and spinners
 */

const LETTERS = ['Н', 'Е', 'К', 'С', 'О'];

function getLoadedCount(pct: number) {
  if (pct >= 80) return 5;
  if (pct >= 60) return 4;
  if (pct >= 40) return 3;
  if (pct >= 20) return 2;
  if (pct >= 5) return 1;
  return 0;
}

// Нексо Loader (используется в App.tsx)
export function НексоLoader({ size = 'md', theme = 'dark' }: { size?: 'sm' | 'md' | 'lg'; theme?: 'light' | 'dark' }) {
  const [progress, setProgress] = useState(0);
  const [loadedCount, setLoadedCount] = useState(0);
  const finishedRef = useRef(false);

  const isDark = theme === 'dark';

  const sizes = {
    sm: { fontSize: 28, gap: 5, barWidth: 120, pctSize: 10 },
    md: { fontSize: 42, gap: 6, barWidth: 180, pctSize: 12 },
    lg: { fontSize: 56, gap: 8, barWidth: 240, pctSize: 13 },
  };
  const s = sizes[size];

  useEffect(() => {
    finishedRef.current = false;
    let p = 0;

    const step = () => {
      if (finishedRef.current) return;
      const inc = p < 60 ? Math.random() * 4 + 2 : p < 85 ? Math.random() * 2 + 0.8 : Math.random() * 0.8 + 0.2;
      p = Math.min(p + inc, 100);
      setProgress(p);
      setLoadedCount(getLoadedCount(p));

      if (p >= 100) {
        finishedRef.current = true;
        setLoadedCount(5);
        return;
      }

      const delay = p < 70 ? Math.random() * 120 + 80 : Math.random() * 200 + 150;
      setTimeout(step, delay);
    };

    const t = setTimeout(step, 300);
    return () => { finishedRef.current = true; clearTimeout(t); };
  }, []);

  const letterColor = isDark ? '#ffffff' : '#1a1a1a';
  const strokeEmpty = isDark ? 'rgba(255,255,255,0.15)' : '#d0d0d0';
  const dotColor = isDark ? 'rgba(255,255,255,0.2)' : '#d0d0d0';
  const trackBg = isDark ? 'rgba(255,255,255,0.08)' : '#eaeaea';
  const barGradient = isDark
    ? 'linear-gradient(90deg, #6366f1, #a855f7)'
    : 'linear-gradient(90deg, #4f46e5, #7c3aed)';
  const pctSub = isDark ? 'rgba(255,255,255,0.35)' : '#bbb';
  const pctMain = isDark ? '#ffffff' : '#1a1a1a';

  return (
    <div className="flex flex-col items-center" style={{ gap: s.gap * 3 }}>
      <div className="flex items-center" style={{ gap: s.gap }}>
        {LETTERS.map((letter, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0.3, y: 8 }}
            animate={{
              opacity: i < loadedCount ? 1 : 0.3,
              y: 0,
            }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="font-bold select-none"
            style={{
              fontSize: s.fontSize,
              letterSpacing: '0.08em',
              WebkitTextStroke: i < loadedCount ? '0px transparent' : `2px ${strokeEmpty}`,
              color: i < loadedCount ? letterColor : 'transparent',
              transition: 'color 0.3s ease, -webkit-text-stroke 0.3s ease',
            }}
          >
            {letter}
          </motion.span>
        ))}
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="font-light"
          style={{ fontSize: s.fontSize, color: dotColor }}
        >
          .
        </motion.span>
      </div>

      <div className="flex flex-col items-center" style={{ gap: 10, width: s.barWidth }}>
        <div
          className="w-full rounded-full overflow-hidden"
          style={{ height: 2, background: trackBg }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ background: barGradient }}
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            transition={{ duration: 0.15 }}
          />
        </div>
        <span style={{ fontSize: s.pctSize, letterSpacing: '0.15em', color: pctSub }}>
          <span style={{ color: pctMain, fontWeight: 500 }}>{Math.round(Math.min(progress, 100))}</span>%
        </span>
      </div>
    </div>
  );
}

// Alias for Latin import
export const NexoLoader = НексоLoader;

// Simple Spinner
export function Spinner({ size = 20, className = '' }: { size?: number; className?: string }) {
  return (
    <Loader2 size={size} className={`animate-spin ${className}`} />
  );
}

// Dots Loader
export function DotsLoader({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const dotSizes = {
    sm: 'w-1.5 h-1.5',
    md: 'w-2 h-2',
    lg: 'w-3 h-3',
  };

  const dotSize = dotSizes[size];

  return (
    <div className="flex items-center gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className={`${dotSize} rounded-full bg-nexo-500`}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

// Pulse Loader
export function PulseLoader() {
  return (
    <div className="relative w-12 h-12">
      <motion.div
        className="absolute inset-0 rounded-full bg-nexo-500/30"
        animate={{
          scale: [1, 1.5, 1],
          opacity: [0.6, 0, 0.6],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      />
      <motion.div
        className="absolute inset-2 rounded-full bg-nexo-500/50"
        animate={{
          scale: [1, 1.3, 1],
          opacity: [0.8, 0, 0.8],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          delay: 0.5,
        }}
      />
      <div className="absolute inset-4 rounded-full bg-nexo-500" />
    </div>
  );
}

// Progress Bar
export function ProgressBar({ progress = 0, className = '' }: { progress?: number; className?: string }) {
  return (
    <div className={`w-full h-1 bg-white/10 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="h-full bg-gradient-to-r from-nexo-500 to-purple-600 rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

// Indeterminate Progress Bar
export function IndeterminateProgress({ className = '' }: { className?: string }) {
  return (
    <div className={`w-full h-1 bg-white/10 rounded-full overflow-hidden ${className}`}>
      <motion.div
        className="h-full w-1/3 bg-gradient-to-r from-nexo-500 to-purple-600 rounded-full"
        animate={{
          x: ['-100%', '400%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  );
}

// Skeleton Pulse (alternative to shimmer)
export function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <motion.div
      className={`bg-white/5 rounded ${className}`}
      animate={{
        opacity: [0.5, 1, 0.5],
      }}
      transition={{
        duration: 1.5,
        repeat: Infinity,
      }}
    />
  );
}

// Loading Overlay
export function LoadingOverlay({ message = 'Загрузка...' }: { message?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[9999]"
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="rounded-3xl p-10 flex flex-col items-center"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 0 80px rgba(99,102,241,0.08)',
        }}
      >
        <НексоLoader size="lg" />
        {message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/40 text-xs mt-6 tracking-widest uppercase"
          >
            {message}
          </motion.p>
        )}
      </motion.div>
    </motion.div>
  );
}

// AI Thinking Indicator
export function AIThinking() {
  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl glass-subtle">
      <motion.div
        animate={{
          rotate: [0, 360],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: 'linear',
        }}
      >
        <Sparkles size={16} className="text-nexo-400" />
      </motion.div>
      <span className="text-sm text-zinc-400">AI думает</span>
      <DotsLoader size="sm" />
    </div>
  );
}

// Typing Indicator (for chat)
export function TypingIndicator({ name = 'Пользователь' }: { name?: string }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
        <DotsLoader size="sm" />
      </div>
      <span className="text-xs text-zinc-500">{name} печатает...</span>
    </div>
  );
}

// Upload Progress
export function UploadProgress({ progress = 0, fileName = 'Файл' }: { progress?: number; fileName?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="glass-card p-4 rounded-xl"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-white truncate flex-1">{fileName}</span>
        <span className="text-xs text-zinc-500 ml-2">{Math.round(progress)}%</span>
      </div>
      <ProgressBar progress={progress} />
    </motion.div>
  );
}

// Connecting Indicator
export function ConnectingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
    >
      <div className="glass-toast px-4 py-2 rounded-full flex items-center gap-2">
        <Spinner size={14} className="text-yellow-500" />
        <span className="text-sm text-white">Подключение...</span>
      </div>
    </motion.div>
  );
}

// Success Checkmark Animation
export function SuccessCheckmark({ size = 64 }: { size?: number }) {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 20,
      }}
      className="relative"
      style={{ width: size, height: size }}
    >
      <motion.div
        className="absolute inset-0 rounded-full bg-green-500/20"
        initial={{ scale: 0 }}
        animate={{ scale: [0, 1.2, 1] }}
        transition={{ duration: 0.5 }}
      />
      <motion.svg
        viewBox="0 0 24 24"
        className="absolute inset-0 text-green-500"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <motion.path
          d="M5 13l4 4L19 7"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.svg>
    </motion.div>
  );
}
