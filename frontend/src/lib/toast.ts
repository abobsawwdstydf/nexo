/**
 * Toast notification system — zero dependencies, event-based.
 * Usage:
 *   import { toast } from '../lib/toast';
 *   toast.success('Сообщение отправлено');
 *   toast.error('Ошибка сети');
 *   toast.info('Новое сообщение от ...');
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(fn => fn([...toasts]));
}

function add(t: Omit<ToastItem, 'id'>) {
  const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const item: ToastItem = { ...t, id };
  toasts = [...toasts, item];
  notify();

  if (t.duration !== 0) {
    setTimeout(() => remove(id), t.duration ?? 4000);
  }

  return id;
}

function remove(id: string) {
  toasts = toasts.filter(t => t.id !== id);
  notify();
}

export const toast = {
  success: (title: string, description?: string, duration?: number) =>
    add({ type: 'success', title, description, duration }),
  error: (title: string, description?: string, duration?: number) =>
    add({ type: 'error', title, description, duration }),
  info: (title: string, description?: string, duration?: number) =>
    add({ type: 'info', title, description, duration }),
  remove,
  subscribe: (fn: Listener) => {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  getToasts: () => [...toasts],
};
