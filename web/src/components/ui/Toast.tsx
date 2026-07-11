import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string | ReactNode;
  description?: string;
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  success: (message: string | ReactNode, description?: string, duration?: number) => void;
  error: (message: string | ReactNode, description?: string, duration?: number) => void;
  info: (message: string | ReactNode, description?: string, duration?: number) => void;
  warning: (message: string | ReactNode, description?: string, duration?: number) => void;
  remove: (id: string) => void;
  clear: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const ICONS = {
  success: <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />,
  error: <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />,
  info: <Info className="w-5 h-5 text-blue-400 flex-shrink-0" />,
  warning: <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0" />,
};

const BORDER = {
  success: 'border-l-green-500',
  error: 'border-l-red-500',
  info: 'border-l-blue-500',
  warning: 'border-l-yellow-500',
};

function ToastItemView({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  return (
    <div
      className={cn(
        'glass-toast border-l-4 rounded-xl p-3.5 shadow-2xl',
        'min-w-[300px] max-w-md',
        'animate-slide-in-right',
        BORDER[toast.type]
      )}
    >
      <div className="flex items-start gap-3">
        {ICONS[toast.type]}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white break-words">{toast.message}</p>
          {toast.description && (
            <p className="mt-1 text-xs text-zinc-400 break-words">{toast.description}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 transition-colors"
          aria-label="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export interface ToastProviderProps {
  children: ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

const POSITIONS = {
  'top-right': 'top-4 right-4',
  'top-left': 'top-4 left-4',
  'bottom-right': 'bottom-4 right-4',
  'bottom-left': 'bottom-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
};

export function ToastProvider({ children, position = 'top-right' }: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (type: ToastType, message: string | ReactNode, description?: string, duration = 4000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message, description, duration }]);
      if (duration > 0) {
        setTimeout(() => remove(id), duration);
      }
    },
    [remove]
  );

  const clear = useCallback(() => setToasts([]), []);

  const value: ToastContextValue = {
    toasts,
    success: (m, d, dur) => add('success', m, d, dur),
    error: (m, d, dur) => add('error', m, d, dur),
    info: (m, d, dur) => add('info', m, d, dur),
    warning: (m, d, dur) => add('warning', m, d, dur),
    remove,
    clear,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className={cn('fixed z-[80] flex flex-col gap-2 pointer-events-none', POSITIONS[position])}>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastItemView toast={t} onClose={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
