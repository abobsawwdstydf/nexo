import { HTMLAttributes, ReactNode, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'glass' | 'subtle' | 'solid' | 'gradient';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
  asChild?: boolean;
}

const variantClasses = {
  glass: 'glass-card',
  subtle: 'glass-subtle',
  solid: 'bg-surface-secondary border border-white/[0.08]',
  gradient: 'bg-gradient-to-br from-nexo-500/15 via-purple-600/10 to-transparent border border-white/[0.08]',
};

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = 'glass', padding = 'md', hover = false, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'rounded-2xl',
        variantClasses[variant],
        paddingClasses[padding],
        hover && 'transition-all duration-200 hover:border-white/[0.14] hover:-translate-y-0.5',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Card.displayName = 'Card';

export interface CardHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-start justify-between gap-3 mb-3', className)}
      {...props}
    >
      <div className="min-w-0 flex-1">
        {title && <h3 className="text-sm font-semibold text-white truncate">{title}</h3>}
        {subtitle && <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>}
        {children}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
);
CardHeader.displayName = 'CardHeader';
