import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';
import { НексоLoader } from '../LoadingStates';

export type SpinnerSize = 'sm' | 'md' | 'lg' | 'xl';

export interface SpinnerProps extends HTMLAttributes<HTMLDivElement> {
  size?: SpinnerSize;
  variant?: 'border' | 'nexo' | 'dots';
}

const sizeMap: Record<SpinnerSize, string> = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-[3px]',
  xl: 'w-14 h-14 border-4',
};

export function Spinner({ size = 'md', variant = 'border', className, ...props }: SpinnerProps) {
  if (variant === 'dots') {
    return (
      <div className={cn('inline-flex items-center gap-1', className)} {...props}>
        <span className="w-1.5 h-1.5 rounded-full bg-nexo-400 typing-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-nexo-400 typing-dot" />
        <span className="w-1.5 h-1.5 rounded-full bg-nexo-400 typing-dot" />
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label="Загрузка"
      className={cn(
        'inline-block rounded-full animate-spin',
        variant === 'nexo' ? 'border-nexo-500/20 border-t-nexo-500' : 'border-white/15 border-t-nexo-400',
        sizeMap[size],
        className
      )}
      {...props}
    />
  );
}

export function FullPageSpinner({ label = 'Загрузка...' }: { label?: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 bg-surface">
      <НексоLoader size="lg" />
      {label && (
        <p className="text-xs text-white/30 tracking-widest uppercase mt-4">{label}</p>
      )}
    </div>
  );
}
