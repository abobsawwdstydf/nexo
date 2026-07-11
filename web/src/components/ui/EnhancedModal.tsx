import React, { useEffect, useState, useRef } from 'react';
import { X } from 'lucide-react';

interface EnhancedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  animation?: 'fade' | 'slide-up' | 'slide-down' | 'scale' | 'flip';
}

export const EnhancedModal: React.FC<EnhancedModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  className = '',
  headerClassName = '',
  bodyClassName = '',
  animation = 'scale',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
      setTimeout(() => setIsAnimating(true), 10);
      document.body.style.overflow = 'hidden';
    } else {
      setIsAnimating(false);
      setTimeout(() => {
        setIsVisible(false);
        document.body.style.overflow = '';
      }, 300);
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isVisible) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full mx-4',
  };

  const animationClasses = {
    fade: isAnimating ? 'opacity-100' : 'opacity-0',
    'slide-up': isAnimating ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
    'slide-down': isAnimating ? 'translate-y-0 opacity-100' : '-translate-y-8 opacity-0',
    scale: isAnimating ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
    flip: isAnimating ? 'rotate-0 opacity-100' : 'rotate-12 opacity-0',
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (closeOnBackdrop && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
        isAnimating ? 'backdrop-blur-sm' : ''
      }`}
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${
          isAnimating ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={`
          relative w-full ${sizeClasses[size]}
          glass-strong rounded-2xl shadow-2xl
          transform transition-all duration-300 ease-out
          ${animationClasses[animation]}
          ${className}
        `}
        style={{
          maxHeight: 'calc(100vh - 2rem)',
        }}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div
            className={`
              flex items-center justify-between
              px-6 py-4 border-b border-white/10
              ${headerClassName}
            `}
          >
            {title && (
              <h2 className="text-xl font-semibold text-white gradient-text">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2 rounded-lg glass-btn
                  hover:bg-white/10 active:scale-95
                  transition-all duration-200
                  group
                "
                aria-label="Закрыть"
              >
                <X className="w-5 h-5 text-gray-400 group-hover:text-white transition-colors" />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        <div
          className={`
            overflow-y-auto overflow-x-hidden
            ${bodyClassName}
          `}
          style={{
            maxHeight: title || showCloseButton ? 'calc(100vh - 8rem)' : 'calc(100vh - 4rem)',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
};
