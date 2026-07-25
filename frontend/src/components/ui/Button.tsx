import { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline' | 'glass';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-gradient-to-r from-nexo-500 to-nexo-600 hover:from-nexo-400 hover:to-nexo-500 text-white shadow-lg shadow-nexo-500/30 hover:shadow-xl hover:shadow-nexo-500/40',
  secondary: 'liquid-glass-subtle hover:bg-white/[0.1] text-white border border-white/[0.08] hover:border-white/[0.15]',
  ghost: 'bg-transparent text-zinc-300 hover:bg-white/[0.05] hover:text-white',
  danger: 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-400 hover:to-red-500 text-white shadow-lg shadow-red-500/30',
  success: 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-400 hover:to-green-500 text-white shadow-lg shadow-green-500/30',
  outline: 'bg-transparent text-nexo-400 border border-nexo-500/40 hover:bg-nexo-500/10 hover:border-nexo-500/60',
  glass: 'liquid-glass text-white',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-xl',
  md: 'px-4 py-2 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2 rounded-2xl',
  icon: 'p-2 rounded-xl',
};

const iconSizeClasses: Record<ButtonSize, string> = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
  lg: 'w-5 h-5',
  icon: 'w-5 h-5',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      disabled,
      className,
      children,
      type = 'button',
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          'relative inline-flex items-center justify-center font-medium select-none',
          'transition-all duration-200 ease-out',
          'active:scale-[0.97] active:translate-y-0',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
          variantClasses[variant],
          sizeClasses[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading && <Loader2 className={cn(iconSizeClasses[size], 'animate-spin')} />}
        {!loading && icon && iconPosition === 'left' && (
          <span className={iconSizeClasses[size]}>{icon}</span>
        )}
        {children}
        {!loading && icon && iconPosition === 'right' && (
          <span className={iconSizeClasses[size]}>{icon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
