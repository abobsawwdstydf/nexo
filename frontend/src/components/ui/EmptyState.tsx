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

function EmptyIllustration() {
  return (
    <svg width="120" height="120" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Background circle */}
      <circle cx="60" cy="60" r="56" fill="rgba(132,94,247,0.08)" stroke="rgba(132,94,247,0.15)" strokeWidth="1.5" strokeDasharray="4 4" />
      {/* Inner glow */}
      <circle cx="60" cy="60" r="40" fill="rgba(132,94,247,0.05)" />
      {/* Chat bubble */}
      <rect x="32" y="34" width="40" height="28" rx="12" fill="rgba(132,94,247,0.15)" stroke="rgba(132,94,247,0.3)" strokeWidth="1.5" />
      <circle cx="44" cy="48" r="2.5" fill="rgba(132,94,247,0.5)" />
      <circle cx="52" cy="48" r="2.5" fill="rgba(132,94,247,0.5)" />
      <circle cx="60" cy="48" r="2.5" fill="rgba(132,94,247,0.5)" />
      {/* Small decorative dots */}
      <circle cx="24" cy="50" r="2" fill="rgba(132,94,247,0.2)" />
      <circle cx="96" cy="44" r="3" fill="rgba(132,94,247,0.15)" />
      <circle cx="88" cy="72" r="1.5" fill="rgba(132,94,247,0.25)" />
      <circle cx="30" cy="74" r="1.5" fill="rgba(132,94,247,0.2)" />
      {/* Plus icon */}
      <circle cx="72" cy="68" r="10" fill="rgba(132,94,247,0.1)" stroke="rgba(132,94,247,0.25)" strokeWidth="1.2" />
      <line x1="72" y1="63" x2="72" y2="73" stroke="rgba(132,94,247,0.5)" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="67" y1="68" x2="77" y2="68" stroke="rgba(132,94,247,0.5)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
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
      {icon ? (
        <div
          className={cn(
            'rounded-2xl flex items-center justify-center',
            isCompact ? 'w-12 h-12' : 'w-20 h-20',
            'bg-white/[0.04] border border-white/[0.06] text-zinc-500'
          )}
        >
          {icon}
        </div>
      ) : (
        <div className={cn(isCompact ? 'scale-75' : '')}>
          <EmptyIllustration />
        </div>
      )}

      <div className="max-w-sm">
        <h3 className={cn('font-semibold text-white', isCompact ? 'text-sm' : 'text-lg')}
          style={{ letterSpacing: '0.02em' }}
        >
          {title}
        </h3>
        {description && (
          <p className={cn('mt-1 text-[#B0B0B0]', isCompact ? 'text-xs' : 'text-sm')}>
            {description}
          </p>
        )}
      </div>

      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
