import { memo } from 'react';

interface UserTagProps {
  text: string;
  color?: string | null;
  style?: string | null;
  size?: 'xs' | 'sm' | 'md';
}

/**
 * Красивый тег пользователя (выдаётся администратором).
 * Поддерживает стили: solid, outline, gradient, glow
 */
function UserTagInner({ text, color = '#6366f1', style = 'solid', size = 'sm' }: UserTagProps) {
  const c = color || '#6366f1';
  const s = style || 'solid';

  const sizeClasses = {
    xs: 'text-[9px] px-1.5 py-0.5 rounded-md',
    sm: 'text-[10px] px-2 py-0.5 rounded-lg',
    md: 'text-xs px-2.5 py-1 rounded-lg',
  };

  // Convert hex to rgb for rgba usage
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : '99, 102, 241';
  };

  const rgb = hexToRgb(c);

  const getTagStyle = (): React.CSSProperties => {
    switch (s) {
      case 'outline':
        return {
          background: 'transparent',
          border: `1px solid ${c}`,
          color: c,
        };
      case 'gradient':
        return {
          background: `linear-gradient(135deg, ${c}, ${adjustColor(c, -30)})`,
          color: '#fff',
          border: 'none',
        };
      case 'glow':
        return {
          background: `rgba(${rgb}, 0.2)`,
          border: `1px solid rgba(${rgb}, 0.5)`,
          color: c,
          boxShadow: `0 0 8px rgba(${rgb}, 0.4), inset 0 0 8px rgba(${rgb}, 0.1)`,
        };
      case 'solid':
      default:
        return {
          background: c,
          color: '#fff',
          border: 'none',
        };
    }
  };

  return (
    <span
      className={`inline-flex items-center font-bold tracking-wide uppercase select-none flex-shrink-0 ${sizeClasses[size]}`}
      style={getTagStyle()}
    >
      {text}
    </span>
  );
}

/** Slightly darken/lighten a hex color */
function adjustColor(hex: string, amount: number): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  const r = Math.max(0, Math.min(255, parseInt(result[1], 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(result[2], 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(result[3], 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

const UserTag = memo(UserTagInner);
export default UserTag;
