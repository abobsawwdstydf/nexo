import { useState, useEffect } from 'react';
import { Plus, UserRound } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { normalizeMediaUrl } from '../lib/mediaUrl';

interface Account {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  email: string;
  avatar?: string;
  token: string;
  refreshToken: string;
  lastUsed: number;
}

interface AccountStripProps {
  onManage: () => void;
}

/**
 * Плашка аккаунтов в самой верхней части мессенджера (в потоке, НЕ поверх).
 * Быстрое переключение между сохранёнными аккаунтами + «Добавить».
 */
export default function AccountStrip({ onManage }: AccountStripProps) {
  const { user, loginWithToken } = useAuthStore();
  const [accounts, setAccounts] = useState<Account[]>([]);

  useEffect(() => {
    const load = () => {
      try {
        setAccounts(JSON.parse(localStorage.getItem('nexo_accounts') || '[]'));
      } catch {
        setAccounts([]);
      }
    };
    load();
    window.addEventListener('storage', load);
    return () => window.removeEventListener('storage', load);
  }, []);

  const active = accounts.find(a => a.userId === user?.id);
  const others = accounts.filter(a => a.userId !== user?.id).slice(0, 5);

  // Текущий пользователь всегда виден в плашке, даже если его нет в списке
  const activeName = active?.displayName || user?.displayName || user?.username || '';
  const activeAvatar = active?.avatar ?? user?.avatar ?? undefined;

  const switchTo = (a: Account) => {
    if (a.userId === user?.id) return;
    loginWithToken(a.token, {
      id: a.userId,
      username: a.username,
      displayName: a.displayName,
      email: a.email,
      avatar: a.avatar || null,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      bio: null,
      createdAt: new Date().toISOString(),
    });
  };

  const renderAvatar = (avatar: string | undefined, name: string, size: 'sm' | 'md') => {
    const cls = size === 'md' ? 'w-8 h-8' : 'w-7 h-7';
    if (avatar) {
      return (
        <img
          src={normalizeMediaUrl(avatar)}
          alt={name}
          className={`${cls} rounded-full object-cover flex-shrink-0`}
        />
      );
    }
    return (
      <div className={`${cls} rounded-full bg-white/[0.07] border border-white/[0.06] flex items-center justify-center flex-shrink-0`}>
        <UserRound size={12} className="text-white/40" />
      </div>
    );
  };

  return (
    <div className="relative z-10 flex-shrink-0 px-2 pt-2">
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.06] liquid-glass px-3 py-1.5 overflow-x-auto no-scrollbar">
        <span className="text-[9px] uppercase tracking-[0.12em] text-white/30 flex-shrink-0">
          Аккаунты
        </span>

        {user && (
          <button
            onClick={() => onManage()}
            title={activeName || 'Мой аккаунт'}
            className="flex items-center gap-1.5 px-1.5 py-1 rounded-xl bg-white/[0.07] border border-accent/30 hover:bg-white/[0.1] transition-colors flex-shrink-0"
          >
            {renderAvatar(activeAvatar, activeName, 'md')}
            <span className="text-[11px] text-white/70 max-w-[90px] truncate hidden sm:block">
              {activeName}
            </span>
          </button>
        )}

        {others.map(a => (
          <button
            key={a.id}
            onClick={() => switchTo(a)}
            title={`${a.displayName || a.username} — переключиться`}
            className="p-1 rounded-full hover:bg-white/[0.07] transition-colors flex-shrink-0 opacity-80 hover:opacity-100"
          >
            {renderAvatar(a.avatar, a.displayName, 'md')}
          </button>
        ))}

        <button
          onClick={onManage}
          title="Добавить аккаунт"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.07] text-white/60 hover:text-white transition-colors flex-shrink-0"
        >
          <Plus size={13} />
          <span className="text-[11px] hidden sm:block">Добавить</span>
        </button>
      </div>
    </div>
  );
}