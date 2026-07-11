interface VerifiedBadgeProps {
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  verifiedBadgeUrl?: string | null;
  verifiedBadgeType?: string | null;
}

const sizeMap = {
  xs: 'w-3 h-3',
  sm: 'w-3.5 h-3.5',
  md: 'w-7 h-7',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

export default function VerifiedBadge({ size = 'sm', verifiedBadgeUrl, verifiedBadgeType }: VerifiedBadgeProps) {
  // Если есть кастомный бейдж
  if (verifiedBadgeUrl && verifiedBadgeType !== 'default') {
    return (
      <img
        src={verifiedBadgeUrl}
        alt="verified"
        className={`${sizeMap[size]} rounded-full object-cover`}
      />
    );
  }

  // Дефолтный бейдж — galocha_veri.png
  return (
    <img
      src="/galocha_veri.png"
      alt="verified"
      className={`${sizeMap[size]} object-contain`}
      title="Верифицирован"
    />
  );
}
