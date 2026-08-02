interface VerifiedBadgeProps {
  isVerified?: boolean;
  badgeUrl?: string | null;
  badgeType?: string | null;
  size?: number;
  className?: string;
}

// VerifiedBadge renders a verification badge (checkmark) next to names.
// Uses the user's custom badge image if provided, otherwise a default check.
export function VerifiedBadge({
  isVerified,
  badgeUrl,
  badgeType,
  size = 14,
  className = '',
}: VerifiedBadgeProps) {
  if (!isVerified) return null;
  return (
    <img
      src={badgeUrl || '/galochcka.png'}
      alt={badgeType || 'verified'}
      title={badgeType ? `Подтверждено: ${badgeType}` : 'Подтверждено'}
      className={`inline-block object-contain flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
      draggable={false}
      loading="lazy"
    />
  );
}
