import { memo, useState, useRef, useCallback } from 'react';
import { getInitials, generateAvatarColor } from '../lib/utils';
import VerifiedBadge from './VerifiedBadge';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  online?: boolean;
  isVerified?: boolean;
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
}

const sizeClasses = {
  xs: 'w-6 h-6 text-[10px]',
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-12 h-12 text-base',
  xl: 'w-20 h-20 text-xl',
} as const;

const onlineDotSize = {
  xs: 'w-1.5 h-1.5 border',
  sm: 'w-2 h-2 border',
  md: 'w-2.5 h-2.5 border-2',
  lg: 'w-3 h-3 border-2',
  xl: 'w-4 h-4 border-2',
} as const;

const verifiedBadgeSize = {
  xs: { cls: 'w-3.5 h-3.5', bottom: '-1px', right: '-1px', checkSize: 8 },
  sm: { cls: 'w-4 h-4', bottom: '-1px', right: '-1px', checkSize: 10 },
  md: { cls: 'w-5 h-5', bottom: '-1px', right: '-1px', checkSize: 12 },
  lg: { cls: 'w-6 h-6', bottom: '-2px', right: '-2px', checkSize: 14 },
  xl: { cls: 'w-8 h-8', bottom: '-2px', right: '-2px', checkSize: 18 },
} as const;

function AvatarInner({ src, name, size = 'md', className = '', online, isVerified, verifiedBadgeUrl, verifiedBadgeType }: AvatarProps) {
  const sizeClass = sizeClasses[size];
  const initials = getInitials(name || '?');
  const gradientClass = generateAvatarColor(name || '');
  const badge = verifiedBadgeSize[size];

  const isGif = src?.toLowerCase().endsWith('.gif');
  const isVideo = src && (src.toLowerCase().endsWith('.mp4') || src.toLowerCase().endsWith('.webm'));
  const isAnimated = isGif || isVideo;

  const [isHovered, setIsHovered] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    if (isVideo && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }, [isVideo]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    if (isVideo && videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isVideo]);

  const handleImgLoad = useCallback(() => setImgLoaded(true), []);
  const handleImgError = useCallback(() => setImgError(true), []);

  const showImage = src && !imgError;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className="relative inline-block"
        onMouseEnter={isAnimated ? handleMouseEnter : undefined}
        onMouseLeave={isAnimated ? handleMouseLeave : undefined}
      >
        {showImage ? (
          isVideo ? (
            <video
              ref={videoRef}
              src={src}
              className={`${sizeClass} rounded-full object-cover select-none pointer-events-none`}
              muted
              loop
              playsInline
            />
          ) : (
            <>
              {/* Skeleton shimmer while loading */}
              {!imgLoaded && (
                <div className={`${sizeClass} rounded-full bg-surface-tertiary animate-pulse absolute inset-0`} />
              )}
              <img
                src={src}
                alt={name}
                className={`${sizeClass} rounded-full object-cover select-none pointer-events-none ${isAnimated ? 'transition-transform hover:scale-105' : ''} ${imgLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                draggable={false}
                loading="lazy"
                onLoad={handleImgLoad}
                onError={handleImgError}
              />
            </>
          )
        ) : (
          <div
            className={`${sizeClass} rounded-full ${gradientClass} flex items-center justify-center text-white font-medium select-none`}
          >
            {initials}
          </div>
        )}

        {isVerified && (
          <div
            className={`absolute ${badge.cls}`}
            style={{
              bottom: badge.bottom,
              right: badge.right,
              zIndex: 10,
            }}
          >
            <VerifiedBadge
              size={size}
              verifiedBadgeUrl={verifiedBadgeUrl}
              verifiedBadgeType={verifiedBadgeType}
            />
          </div>
        )}
      </div>

      {online !== undefined && (
        <div
          className={`absolute bottom-0 right-0 ${onlineDotSize[size]} rounded-full border-2 border-surface ${
            online ? 'bg-online' : 'bg-offline'
          }`}
          style={{ zIndex: isVerified ? 11 : 5 }}
        />
      )}
    </div>
  );
}

const Avatar = memo(AvatarInner);
export default Avatar;
