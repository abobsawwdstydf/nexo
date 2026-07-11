import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type EmptyVariant = 'default' | 'compact';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  variant?: EmptyVariant;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant = 'default',
  className,
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'py-8 px-4 gap-3' : 'py-16 px-6 gap-4',
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            'rounded-2xl flex items-center justify-center',
            isCompact ? 'w-12 h-12' : 'w-20 h-20',
            'bg-white/[0.04] border border-white/[0.06] text-zinc-500'
          )}
        >
          {icon}
        </div>
      )}

      <div className="max-w-sm">
        <h3 className={cn('font-semibold text-white', isCompact ? 'text-sm' : 'text-lg')}>
          {title}
        </h3>
        {description && (
          <p className={cn('mt-1 text-zinc-500', isCompact ? 'text-xs' : 'text-sm')}>
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
