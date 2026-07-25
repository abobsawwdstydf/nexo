import { HTMLAttributes, ElementType } from 'react';
import { cn } from '../../lib/utils';

export type GlassVariant = 'default' | 'subtle' | 'strong' | 'sidebar' | 'toast';

export interface GlassPanelProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassVariant;
  as?: ElementType;
}

const variantClasses: Record<GlassVariant, string> = {
  default: 'liquid-glass',
  subtle: 'liquid-glass-subtle',
  strong: 'liquid-glass-strong',
  sidebar: 'glass-sidebar',
  toast: 'glass-toast',
};

export function GlassPanel({
  variant = 'default',
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div className={cn(variantClasses[variant], className)} {...props}>
      {children}
    </div>
  );
}
