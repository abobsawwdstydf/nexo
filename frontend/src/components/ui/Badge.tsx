import { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
  icon?: ReactNode;
  dot?: boolean;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-white/[0.06] text-zinc-300 border-white/[0.08]',
  primary: 'bg-nexo-500/15 text-nexo-400 border-nexo-500/30',
  success: 'bg-green-500/15 text-green-400 border-green-500/30',
  warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  danger: 'bg-red-500/15 text-red-400 border-red-500/30',
  info: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const sizeClasses = {
  sm: 'px-1.5 py-0.5 text-[10px] gap-1',
  md: 'px-2 py-0.5 text-xs gap-1.5',
};

export function Badge({
  variant = 'default',
  size = 'md',
  icon,
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border whitespace-nowrap',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', {
        'bg-nexo-400': variant === 'primary',
        'bg-green-400': variant === 'success',
        'bg-yellow-400': variant === 'warning',
        'bg-red-400': variant === 'danger',
        'bg-blue-400': variant === 'info',
        'bg-zinc-400': variant === 'default',
      })} />}
      {icon}
      {children}
    </span>
  );
}
