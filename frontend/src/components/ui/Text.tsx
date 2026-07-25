import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

type Variant = 'h1' | 'h2' | 'h3' | 'h4' | 'body' | 'small' | 'caption' | 'overline';

export interface TextProps extends HTMLAttributes<HTMLElement> {
  variant?: Variant;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'label';
  color?: 'primary' | 'secondary' | 'tertiary' | 'muted' | 'disabled' | 'accent' | 'danger' | 'success';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  truncate?: boolean;
  gradient?: boolean;
}

const variantClasses: Record<Variant, string> = {
  h1: 'text-3xl md:text-4xl font-bold leading-tight',
  h2: 'text-2xl md:text-3xl font-bold leading-tight',
  h3: 'text-xl md:text-2xl font-semibold leading-snug',
  h4: 'text-lg md:text-xl font-semibold leading-snug',
  body: 'text-sm leading-relaxed',
  small: 'text-xs leading-relaxed',
  caption: 'text-[11px] leading-relaxed',
  overline: 'text-[10px] uppercase tracking-wider font-semibold',
};

const colorClasses = {
  primary: 'text-white',
  secondary: 'text-zinc-300',
  tertiary: 'text-zinc-400',
  muted: 'text-zinc-500',
  disabled: 'text-zinc-600',
  accent: 'text-nexo-400',
  danger: 'text-red-400',
  success: 'text-green-400',
};

const weightClasses = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

export const Text = forwardRef<HTMLElement, TextProps>(
  (
    {
      variant = 'body',
      as: Tag = 'p',
      color = 'primary',
      weight,
      truncate = false,
      gradient = false,
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <Tag
        ref={ref as any}
        className={cn(
          variantClasses[variant],
          colorClasses[color],
          weight && weightClasses[weight],
          truncate && 'truncate',
          gradient && 'gradient-text',
          className
        )}
        {...props}
      >
        {children}
      </Tag>
    );
  }
);
Text.displayName = 'Text';
