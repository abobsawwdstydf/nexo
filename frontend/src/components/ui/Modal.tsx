import { ReactNode, useEffect, useRef, MouseEvent } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Button } from './Button';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footer?: ReactNode;
  hideHeader?: boolean;
  fullScreenOnMobile?: boolean;
}

const sizeClasses: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-full mx-3',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEsc = true,
  className,
  headerClassName,
  bodyClassName,
  footer,
  hideHeader = false,
  fullScreenOnMobile = false,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !closeOnEsc) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const handleBackdrop = (e: MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md animate-fade-in"
      onClick={handleBackdrop}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative w-full liquid-glass rounded-2xl shadow-2xl animate-scale-in',
          'flex flex-col',
          sizeClasses[size],
          fullScreenOnMobile && 'sm:rounded-2xl rounded-none sm:max-h-[calc(100vh-2rem)] max-h-screen sm:h-auto h-screen',
          !fullScreenOnMobile && 'max-h-[calc(100vh-2rem)]',
          className
        )}
      >
        {!hideHeader && (title || showCloseButton) && (
          <div
            className={cn(
              'flex items-center justify-between gap-3 px-5 py-4 border-b border-white/[0.08] flex-shrink-0',
              headerClassName
            )}
          >
            {title && (
              <h2 className="text-base font-semibold text-white truncate flex-1 min-w-0">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                className="flex-shrink-0 -mr-2"
                aria-label="Закрыть"
              >
                <X />
              </Button>
            )}
          </div>
        )}

        <div className={cn('flex-1 overflow-y-auto overflow-x-hidden', bodyClassName)}>
          {children}
        </div>

        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.08] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Подтвердить',
  cancelText = 'Отмена',
  variant = 'primary',
  loading = false,
}: ConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div className="p-5">
        <p className="text-sm text-zinc-300 leading-relaxed">{message}</p>
      </div>
      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-white/[0.08]">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button
          variant={variant === 'danger' ? 'danger' : 'primary'}
          onClick={onConfirm}
          loading={loading}
        >
          {confirmText}
        </Button>
      </div>
    </Modal>
  );
}
