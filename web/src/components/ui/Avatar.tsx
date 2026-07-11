import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: AvatarSize;
  className?: string;
  ringClass?: string;
  isOnline?: boolean;
  showOnlineIndicator?: boolean;
  isVerified?: boolean;
  verifiedBadgeUrl?: string;
  verifiedBadgeType?: string;
  fallbackIcon?: ReactNode;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-16 h-16 text-lg',
  '2xl': 'w-24 h-24 text-2xl',
};

const dotSizeClasses: Record<AvatarSize, string> = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-4 h-4 border-2',
  '2xl': 'w-5 h-5 border-[3px]',
};

function getInitials(name?: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() || '?';
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const COLORS = [
  'from-pink-500 to-rose-600',
  'from-purple-500 to-indigo-600',
  'from-blue-500 to-cyan-600',
  'from-green-500 to-emerald-600',
  'from-orange-500 to-amber-600',
  'from-red-500 to-pink-600',
  'from-teal-500 to-cyan-600',
  'from-indigo-500 to-purple-600',
];

function getColorByName(name?: string): string {
  if (!name) return COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return COLORS[Math.abs(hash) % COLORS.length];
}

export function Avatar({
  src,
  name,
  size = 'md',
  className,
  ringClass = 'ring-2 ring-white/10',
  isOnline,
  showOnlineIndicator = false,
  isVerified,
  verifiedBadgeUrl,
  fallbackIcon,
}: AvatarProps) {
  return (
    <div className={cn('relative inline-block flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name || ''}
          loading="lazy"
          className={cn(
            'rounded-full object-cover bg-surface-tertiary',
            sizeClasses[size],
            ringClass
          )}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div
          className={cn(
            'rounded-full flex items-center justify-center font-semibold text-white bg-gradient-to-br',
            getColorByName(name),
            sizeClasses[size],
            ringClass
          )}
        >
          {fallbackIcon || getInitials(name)}
        </div>
      )}

      {showOnlineIndicator && (
        <span
          className={cn(
            'absolute bottom-0 right-0 rounded-full border-[#0e1621]',
            isOnline ? 'bg-[#4dcd5e]' : 'bg-[#6d7f8e]',
            dotSizeClasses[size]
          )}
        />
      )}

      {isVerified && (
        <span
          className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-[#6ab2f2] border-2 border-[#0e1621] flex items-center justify-center text-[8px] text-white"
          aria-label="Verified"
        >
          ✓
        </span>
      )}
    </div>
  );
}
