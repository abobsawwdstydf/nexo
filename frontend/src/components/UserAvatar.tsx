import { normalizeMediaUrl } from '../lib/mediaUrl';

interface UserAvatarProps {
  user: { avatar: string | null; displayName: string };
  size?: 'sm' | 'md';
}

export function UserAvatar({ user, size = 'md' }: UserAvatarProps) {
  const sizeClass = size === 'sm' ? 'w-8 h-8' : 'w-10 h-10';

  if (user.avatar) {
    return (
      <img
        src={normalizeMediaUrl(user.avatar)}
        alt={user.displayName}
        className={`${sizeClass} rounded-full object-cover flex-shrink-0`}
      />
    );
  }

  const initials = user.displayName
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={`${sizeClass} rounded-full bg-white/[0.06] border border-white/[0.05] flex items-center justify-center flex-shrink-0`}
    >
      <span className="text-xs font-medium text-white/50">{initials}</span>
    </div>
  );
}

export function OnlineDot() {
  return (
    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400/80 border-2 border-[#0a0a0f]" />
  );
}
