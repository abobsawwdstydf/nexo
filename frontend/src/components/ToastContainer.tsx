import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';
import { toast, type ToastItem } from '../lib/toast';

const icons = {
  success: CheckCircle,
  error: XCircle,
  info: Info,
};

const colors = {
  success: 'bg-green-500/15 border-green-500/25 text-green-400',
  error: 'bg-red-500/15 border-red-500/25 text-red-400',
  info: 'bg-blue-500/15 border-blue-500/25 text-blue-400',
};

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  const Icon = icons[item.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-xl
        ${colors[item.type]}
        w-[360px] max-w-[90vw] shadow-2xl
      `}
    >
      <Icon size={16} className="flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{item.title}</p>
        {item.description && (
          <p className="text-xs opacity-70 mt-0.5">{item.description}</p>
        )}
      </div>
      <button
        onClick={() => onDismiss(item.id)}
        className="p-0.5 rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0"
      >
        <X size={12} className="opacity-50" />
      </button>
    </motion.div>
  );
}

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const unsub = toast.subscribe(setItems);
    return () => unsub();
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      <div className="pointer-events-auto flex flex-col gap-2">
        <AnimatePresence mode="popLayout">
          {items.map(t => (
            <ToastItemView key={t.id} item={t} onDismiss={toast.remove} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
