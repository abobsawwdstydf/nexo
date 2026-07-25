import { create } from 'zustand';
import type { ReactNode } from 'react';
import type { ToastType } from '../components/Toast';

interface Toast {
  id: string;
  type: ToastType;
  message: ReactNode;
  duration?: number;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (message: ReactNode, duration?: number) => void;
  error: (message: ReactNode, duration?: number) => void;
  info: (message: ReactNode, duration?: number) => void;
  warning: (message: ReactNode, duration?: number) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  
  addToast: (toast) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }));
  },
  
  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
  
  success: (message, duration) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'success', message, duration }],
    }));
  },
  
  error: (message, duration) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'error', message, duration }],
    }));
  },
  
  info: (message, duration) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'info', message, duration }],
    }));
  },
  
  warning: (message, duration) => {
    const id = Math.random().toString(36).substring(7);
    set((state) => ({
      toasts: [...state.toasts, { id, type: 'warning', message, duration }],
    }));
  },
}));
