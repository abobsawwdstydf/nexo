import { motion } from 'framer-motion';

/**
 * Skeleton Components Library
 * Beautiful loading placeholders with shimmer effect
 */

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'rounded';
  width?: string | number;
  height?: string | number;
  animation?: 'pulse' | 'wave' | 'none';
}

export function Skeleton({
  className = '',
  variant = 'text',
  width,
  height,
  animation = 'wave',
}: SkeletonProps) {
  const baseClasses = 'bg-white/5 relative overflow-hidden';
  
  const variantClasses = {
    text: 'rounded h-4',
    circular: 'rounded-full',
    rectangular: 'rounded-none',
    rounded: 'rounded-xl',
  };

  const animationClasses = {
    pulse: 'animate-pulse-soft',
    wave: 'skeleton-shimmer',
    none: '',
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${animationClasses[animation]} ${className}`}
      style={style}
    >
      {animation === 'wave' && (
        <div className="skeleton-shimmer-gradient" />
      )}
    </div>
  );
}

// Chat List Item Skeleton
export function ChatListItemSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Skeleton variant="circular" width={48} height={48} />
      <div className="flex-1 space-y-2">
        <Skeleton width="60%" height={16} />
        <Skeleton width="80%" height={14} />
      </div>
      <div className="flex flex-col items-end gap-2">
        <Skeleton width={40} height={12} />
        <Skeleton variant="circular" width={20} height={20} />
      </div>
    </div>
  );
}

// Message Bubble Skeleton
export function MessageBubbleSkeleton({ sent = false }: { sent?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${sent ? 'justify-end' : 'justify-start'} mb-2 px-4`}
    >
      <div className={`flex gap-2 max-w-[70%] ${sent ? 'flex-row-reverse' : 'flex-row'}`}>
        {!sent && <Skeleton variant="circular" width={32} height={32} />}
        <div className="space-y-2">
          <Skeleton variant="rounded" width={200} height={60} />
          <Skeleton width={80} height={12} />
        </div>
      </div>
    </motion.div>
  );
}

// User Profile Skeleton
export function UserProfileSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Skeleton variant="circular" width={80} height={80} />
        <div className="flex-1 space-y-3">
          <Skeleton width="60%" height={24} />
          <Skeleton width="40%" height={16} />
        </div>
      </div>

      {/* Bio */}
      <div className="space-y-2">
        <Skeleton width="100%" height={14} />
        <Skeleton width="90%" height={14} />
        <Skeleton width="70%" height={14} />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Skeleton variant="rounded" className="flex-1" height={44} />
        <Skeleton variant="rounded" className="flex-1" height={44} />
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} variant="rounded" height={80} />
        ))}
      </div>
    </div>
  );
}

// Story Circle Skeleton
export function StoryCircleSkeleton() {
  return (
    <div className="flex flex-col items-center gap-1 flex-shrink-0">
      <Skeleton variant="circular" width={56} height={56} />
      <Skeleton width={56} height={10} />
    </div>
  );
}

// Card Skeleton
export function CardSkeleton() {
  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <Skeleton width={120} height={20} />
        <Skeleton variant="circular" width={32} height={32} />
      </div>
      <Skeleton width="100%" height={60} />
      <div className="flex gap-2">
        <Skeleton variant="rounded" className="flex-1" height={36} />
        <Skeleton variant="rounded" className="flex-1" height={36} />
      </div>
    </div>
  );
}

// Table Row Skeleton
export function TableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-3 border-b border-white/5">
      {Array.from({ length: columns }).map((_, i) => (
        <Skeleton key={i} className="flex-1" height={16} />
      ))}
    </div>
  );
}

// Grid Skeleton
export function GridSkeleton({ items = 6, columns = 3 }: { items?: number; columns?: number }) {
  return (
    <div className={`grid gap-4`} style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
      {Array.from({ length: items }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

// List Skeleton
export function ListSkeleton({ items = 5 }: { items?: number }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: items }).map((_, i) => (
        <ChatListItemSkeleton key={i} />
      ))}
    </div>
  );
}

// Full Page Skeleton
export function PageSkeleton() {
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="h-16 px-6 flex items-center gap-4 border-b border-white/5">
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton width={200} height={24} />
        <div className="flex-1" />
        <Skeleton variant="rounded" width={100} height={36} />
      </div>

      {/* Content */}
      <div className="flex-1 p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <ListSkeleton items={8} />
      </div>
    </div>
  );
}

// Image Skeleton with aspect ratio
export function ImageSkeleton({ aspectRatio = '16/9', className = '' }: { aspectRatio?: string; className?: string }) {
  return (
    <div className={`relative w-full ${className}`} style={{ aspectRatio }}>
      <Skeleton variant="rounded" className="absolute inset-0" />
    </div>
  );
}

// Avatar Group Skeleton
export function AvatarGroupSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex -space-x-2">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} variant="circular" width={32} height={32} className="ring-2 ring-surface" />
      ))}
    </div>
  );
}
