import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useLang } from '../lib/i18n';
import BottomSheet from './BottomSheet';

interface ConfirmModalProps {
  open: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  danger = true,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useLang();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return (
      <BottomSheet
        isOpen={open}
        onClose={onCancel}
        title={title || ''}
        showCloseButton
      >
        <div className="p-5 flex flex-col items-center text-center">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-3 ${danger ? 'bg-red-500/15' : 'bg-accent/15'}`}>
            <AlertTriangle size={24} className={danger ? 'text-red-400' : 'text-accent'} />
          </div>
          {title && (
            <h3 className="text-white text-base font-semibold mb-1">{title}</h3>
          )}
          <p className="text-zinc-400 text-sm leading-relaxed">{message}</p>
        </div>
        <div className="flex border-t border-white/5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCancel();
            }}
            className="flex-1 py-3 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-colors cursor-pointer"
          >
            {cancelText || t('cancel')}
          </button>
          <div className="w-px bg-white/5" />
          <button
            onClick={(e) => {
              e.stopPropagation();
              onConfirm();
            }}
            className={`flex-1 py-3 text-sm font-medium transition-colors cursor-pointer ${
              danger
                ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                : 'text-accent hover:bg-accent/10'
            }`}
          >
            {confirmText || t('confirm')}
          </button>
        </div>
      </BottomSheet>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm pointer-events-auto p-4"
          onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.35, bounce: 0.2 }}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="w-full max-w-[400px] rounded-2xl bg-[#1a1a1a] border border-white/10 shadow-2xl overflow-hidden pointer-events-auto"
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${danger ? 'bg-red-500/15' : 'bg-accent/15'}`}>
                  <AlertTriangle size={16} className={danger ? 'text-red-400' : 'text-accent'} />
                </div>
                <h3 className="text-sm font-semibold text-white">{title || ''}</h3>
              </div>
              <button
                onClick={onCancel}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-5 text-center">
              <p className="text-zinc-400 text-sm leading-relaxed">{message}</p>
            </div>
            <div className="flex border-t border-white/5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCancel();
                }}
                className="flex-1 py-3 text-sm font-medium text-zinc-400 hover:bg-white/5 hover:text-white transition-colors pointer-events-auto cursor-pointer"
              >
                {cancelText || t('cancel')}
              </button>
              <div className="w-px bg-white/5" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onConfirm();
                }}
                className={`flex-1 py-3 text-sm font-medium transition-colors pointer-events-auto cursor-pointer ${
                  danger
                    ? 'text-red-400 hover:bg-red-500/10 hover:text-red-300'
                    : 'text-accent hover:bg-accent/10'
                }`}
              >
                {confirmText || t('confirm')}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
