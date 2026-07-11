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
  position = 'right',
}: UnifiedModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-end sm:items-center justify-center sm:p-4"
        onClick={onClose}
      >
        <motion.div
          initial={position === 'right' ? { x: '100%', opacity: 0 } : { scale: 0.9, opacity: 0 }}
          animate={position === 'right' ? { x: 0, opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={position === 'right' ? { x: '100%', opacity: 0 } : { scale: 0.9, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className={`
            bg-[#1a1a1a] 
            ${position === 'right' 
              ? 'fixed right-0 top-0 bottom-0 w-full sm:w-[480px] rounded-none sm:rounded-l-3xl' 
              : `rounded-none sm:rounded-2xl w-full ${maxWidthClasses[maxWidth]}`
            }
            h-full sm:h-auto sm:max-h-[90vh] 
            overflow-hidden shadow-2xl 
            flex flex-col
          `}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 flex-shrink-0">
            <div className="flex items-center gap-3">
              {Icon && <Icon className="w-6 h-6 text-purple-400" />}
              <h2 className="text-2xl font-bold text-white">{title}</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-zinc-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
