/**
 * SidePanelWrapper — единый стиль для всех окон боковой панели.
 * На ПК: фиксированная панель слева (рядом с сайдбаром).
 * На мобильном: полный экран.
 * embedded=true — встроенный режим внутри SideMenu (без оверлея и fixed).
 */
import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowLeft } from 'lucide-react';

interface SidePanelWrapperProps {
  onClose: () => void;
  title: string;
  icon?: ReactNode;
  children: ReactNode;
  showBack?: boolean;
  zIndex?: number;
  /** Встроенный режим — без оверлея, рендерится внутри SideMenu */
  embedded?: boolean;
}

export default function SidePanelWrapper({
  onClose,
  title,
  icon,
  children,
  showBack = false,
  zIndex = 9990,
  embedded = false,
}: SidePanelWrapperProps) {
  // Встроенный режим — просто шапка + контент без оверлея
  if (embedded) {
    return (
      <div className="flex flex-col h-full w-full overflow-hidden">
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] flex-shrink-0 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          >
            <ArrowLeft size={18} />
          </button>
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 text-zinc-300">
              {icon}
            </div>
          )}
          <h3 className="text-sm font-semibold text-white flex-1 truncate">{title}</h3>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {/* Overlay */}
      <motion.div
        key="side-panel-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        style={{ zIndex }}
        onClick={onClose}
      />

      {/* Панель */}
      <motion.div
        key="side-panel"
        initial={{ x: -340, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: -340, opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        style={{ zIndex: zIndex + 1 }}
        className={[
          'fixed inset-0',
          'sm:inset-auto sm:left-3 sm:top-3 sm:bottom-3 sm:w-[340px] sm:max-w-[calc(100vw-24px)]',
          'bg-[#0a0a0f]/95 backdrop-blur-3xl',
          'border-0 sm:border sm:border-white/[0.12]',
          'rounded-none sm:rounded-3xl',
          'shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_80px_rgba(99,102,241,0.08)]',
          'flex flex-col overflow-hidden',
        ].join(' ')}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] flex-shrink-0 bg-white/[0.02]">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          >
            {showBack ? <ArrowLeft size={18} /> : <X size={18} />}
          </button>
          {icon && (
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0 text-zinc-300">
              {icon}
            </div>
          )}
          <h3 className="text-sm font-semibold text-white flex-1 truncate">{title}</h3>
        </div>
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
