import { useEffect, useCallback, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export type LiquidGlassModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

interface LiquidGlassModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: LiquidGlassModalSize;
  title?: string;
  fullScreenOnMobile?: boolean;
  showClose?: boolean;
  className?: string;
}

const sizeClasses: Record<LiquidGlassModalSize, string> = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-3xl',
  full: 'max-w-4xl',
};

export default function LiquidGlassModal({
  isOpen,
  onClose,
  children,
  size = 'md',
  title,
  fullScreenOnMobile = true,
  showClose = true,
  className = '',
}: LiquidGlassModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal body */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: 'spring', damping: 30, stiffness: 280 }}
            className={`relative z-10 w-full ${sizeClasses[size]} ${
              fullScreenOnMobile ? 'sm:max-h-[88vh]' : 'max-h-[88vh]'
            } ${
              fullScreenOnMobile
                ? 'max-sm:fixed max-sm:inset-0 max-sm:w-full max-sm:h-full max-sm:max-w-full max-sm:max-h-full max-sm:rounded-none'
                : ''
            } flex flex-col overflow-hidden ${className}`}
          >
            {/* Gradient border glow */}
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-nexo-500/40 via-purple-500/20 to-pink-500/30 pointer-events-none opacity-60 blur-sm" />
            <div className="absolute -inset-px rounded-3xl bg-gradient-to-br from-nexo-500/20 via-transparent to-purple-500/15 pointer-events-none" />

            {/* Glass body */}
            <div className="relative liquid-glass rounded-3xl overflow-hidden flex flex-col min-h-0 h-full">
              {/* Ambient glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-nexo-500/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-purple-500/8 rounded-full blur-3xl pointer-events-none" />

              {/* Header */}
              {(title || showClose) && (
                <div className="relative flex items-center justify-between px-5 py-4 border-b border-white/[0.06] flex-shrink-0">
                  <div className="absolute inset-0 bg-gradient-to-r from-nexo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
                  {title && (
                    <h2 className="text-base font-bold text-white relative z-10">{title}</h2>
                  )}
                  {!title && <div />}
                  {showClose && (
                    <motion.button
                      whileTap={{ scale: 0.92 }}
                      onClick={onClose}
                      className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 border border-white/[0.06] text-zinc-400 hover:text-white transition-all relative z-10"
                    >
                      <X size={16} />
                    </motion.button>
                  )}
                </div>
              )}

              {/* Content */}
              <div className="relative flex-1 overflow-y-auto min-h-0">
                {children}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
