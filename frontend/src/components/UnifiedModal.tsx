import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, LucideIcon } from 'lucide-react';

interface UnifiedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl';
  position?: 'center' | 'right';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
  '6xl': 'max-w-6xl',
  '7xl': 'max-w-7xl',
};

/**
 * Унифицированное модальное окно для всего приложения
 * - На ПК: боковая панель справа или центр
 * - На мобильных: полный экран
 */
export default function UnifiedModal({
  isOpen,
  onClose,
  title,
  icon: Icon,
  children,
  maxWidth = '6xl',
  position = 'center',
}: UnifiedModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          transition={{ type: 'spring', damping: 30, stiffness: 350 }}
          className={`
            bg-[#141418] rounded-[1.5rem]
            w-full ${maxWidthClasses[maxWidth]}
            h-auto sm:max-h-[88vh]
            overflow-hidden shadow-[0_0_80px_rgba(123,97,255,0.08)]
            flex flex-col
            border border-white/[0.07]
          `}
          onClick={e => e.stopPropagation()}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/[0.06] flex-shrink-0">
            <div className="flex items-center gap-3">
              {Icon && (
                <div className="w-10 h-10 rounded-xl bg-nexo-500/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-nexo-400" />
                </div>
              )}
              <h2 className="text-lg font-bold tracking-tight" style={{ background: 'linear-gradient(135deg, #fff, #a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/[0.06] rounded-xl transition-all duration-200 text-zinc-500 hover:text-white/80"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
