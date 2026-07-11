import { HTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

export type DividerOrientation = 'horizontal' | 'vertical';
export type DividerSpacing = 'none' | 'sm' | 'md' | 'lg';

export interface DividerProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: DividerOrientation;
  spacing?: DividerSpacing;
  label?: string;
}

const spacingMap: Record<DividerOrientation, Record<DividerSpacing, string>> = {
  horizontal: {
    none: 'my-0',
    sm: 'my-2',
    md: 'my-4',
    lg: 'my-6',
  },
  vertical: {
    none: 'mx-0',
    sm: 'mx-2',
    md: 'mx-4',
    lg: 'mx-6',
  },
};

export function Divider({
  orientation = 'horizontal',
  spacing = 'md',
  label,
  className,
  ...props
}: DividerProps) {
  if (orientation === 'vertical') {
    return (
      <div
        role="separator"
        aria-orientation="vertical"
        className={cn('inline-block self-stretch w-px bg-white/[0.08]', spacingMap.vertical[spacing], className)}
        {...props}
      />
    );
  }

  if (label) {
    return (
      <div className={cn('flex items-center gap-3', spacingMap.horizontal[spacing], className)} {...props}>
        <div className="flex-1 h-px bg-white/[0.08]" />
        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">{label}</span>
        <div className="flex-1 h-px bg-white/[0.08]" />
      </div>
    );
  }

  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      className={cn('h-px w-full bg-white/[0.08]', spacingMap.horizontal[spacing], className)}
      {...props}
    />
  );
}
