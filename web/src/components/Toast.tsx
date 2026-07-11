import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  id: string;
  type: ToastType;
  message: ReactNode;
  duration?: number;
  onClose: (id: string) => void;
}

export default function Toast({ id, type, message, duration = 4000, onClose }: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onClose(id), duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onClose]);

  const icons = {
    success: <CheckCircle size={20} className="text-emerald-400" />,
    error: <AlertCircle size={20} className="text-red-400" />,
    info: <Info size={20} className="text-blue-400" />,
    warning: <AlertTriangle size={20} className="text-amber-400" />,
  };

  const colors = {
    success: 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/30',
    error: 'from-red-500/20 to-red-600/10 border-red-500/30',
    info: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
    warning: 'from-amber-500/20 to-amber-600/10 border-amber-500/30',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r ${colors[type]} backdrop-blur-xl border shadow-2xl min-w-[300px] max-w-[500px]`}
    >
      <div className="flex-shrink-0">{icons[type]}</div>
      <div className="flex-1 text-sm font-medium text-white">{message}</div>
      <button
        onClick={() => onClose(id)}
        className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors text-zinc-400 hover:text-white"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
