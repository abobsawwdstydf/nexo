/**
 * Дизайн-система Нексо
 * Централизованные токены: цвета, отступы, радиусы, тени, анимации, z-index.
 * Импортируется в компонентах через `import { colors, radius, spacing } from '@/lib/design-system'`
 */

export const colors = {
  brand: {
    50: '#eef2ff',
    100: '#e0e7ff',
    200: '#c7d2fe',
    300: '#a5b4fc',
    400: '#818cf8',
    500: '#6366f1',
    600: '#4f46e5',
    700: '#4338ca',
    800: '#3730a3',
    900: '#312e81',
    950: '#1e1b4b',
  },
  surface: {
    base: '#09090b',
    secondary: '#111113',
    tertiary: '#1a1a1e',
    hover: '#222226',
  },
  border: {
    subtle: 'rgba(255, 255, 255, 0.06)',
    default: 'rgba(255, 255, 255, 0.08)',
    strong: 'rgba(255, 255, 255, 0.12)',
  },
  text: {
    primary: '#fafafa',
    secondary: 'rgba(255, 255, 255, 0.7)',
    tertiary: 'rgba(255, 255, 255, 0.5)',
    muted: 'rgba(255, 255, 255, 0.4)',
    disabled: 'rgba(255, 255, 255, 0.25)',
  },
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
  },
} as const;

export const radius = {
  none: '0',
  sm: '0.5rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '2rem',
  full: '9999px',
} as const;

export const spacing = {
  px: '1px',
  0: '0',
  0.5: '0.125rem',
  1: '0.25rem',
  1.5: '0.375rem',
  2: '0.5rem',
  2.5: '0.625rem',
  3: '0.75rem',
  3.5: '0.875rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  7: '1.75rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;

export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  notification: 90,
  max: 100,
} as const;

export const duration = {
  instant: '0ms',
  fast: '150ms',
  normal: '250ms',
  slow: '400ms',
  slower: '600ms',
} as const;

export const easing = {
  linear: 'linear',
  ease: 'ease',
  in: 'ease-in',
  out: 'ease-out',
  inOut: 'ease-in-out',
  smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
  spring: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  bounce: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

export const shadow = {
  xs: '0 1px 2px rgba(0, 0, 0, 0.2)',
  sm: '0 2px 4px rgba(0, 0, 0, 0.25)',
  md: '0 4px 12px rgba(0, 0, 0, 0.3)',
  lg: '0 8px 24px rgba(0, 0, 0, 0.4)',
  xl: '0 12px 40px rgba(0, 0, 0, 0.5)',
  glow: '0 0 24px rgba(99, 102, 241, 0.4)',
  glowStrong: '0 0 40px rgba(99, 102, 241, 0.6)',
  innerGlow: 'inset 0 0.5px 0 rgba(255, 255, 255, 0.08)',
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

export type ColorScheme = 'indigo' | 'blue' | 'purple' | 'green' | 'red' | 'orange';

export const colorSchemes: Record<ColorScheme, { accent: string; hover: string; light: string }> = {
  indigo: { accent: '#6366f1', hover: '#818cf8', light: 'rgba(99, 102, 241, 0.15)' },
  blue: { accent: '#3b82f6', hover: '#60a5fa', light: 'rgba(59, 130, 246, 0.15)' },
  purple: { accent: '#a855f7', hover: '#c084fc', light: 'rgba(168, 85, 247, 0.15)' },
  green: { accent: '#22c55e', hover: '#4ade80', light: 'rgba(34, 197, 94, 0.15)' },
  red: { accent: '#ef4444', hover: '#f87171', light: 'rgba(239, 68, 68, 0.15)' },
  orange: { accent: '#f97316', hover: '#fb923c', light: 'rgba(249, 115, 22, 0.15)' },
};

export const componentSize = {
  xs: { padding: '0.375rem 0.625rem', fontSize: '0.75rem', height: '1.5rem' },
  sm: { padding: '0.5rem 0.75rem', fontSize: '0.8125rem', height: '2rem' },
  md: { padding: '0.625rem 1rem', fontSize: '0.875rem', height: '2.5rem' },
  lg: { padding: '0.75rem 1.25rem', fontSize: '1rem', height: '3rem' },
  xl: { padding: '1rem 1.5rem', fontSize: '1.125rem', height: '3.5rem' },
} as const;
