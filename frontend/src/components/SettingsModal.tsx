import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  BellOff,
  Palette,
  Shield,
  User,
  Smartphone,
  Volume2,
  Vibrate,
  Globe,
  Eye,
  EyeOff,
  Moon,
  Sun,
  MessageCircle,
  Phone,
  Users,
  Check,
  Monitor,
  Radio,
  Loader,
  Crown,
  Download,
  AlertTriangle,
  Paperclip,
  Trophy,
  Gamepad2,
  Cloud,
  PenLine,
} from 'lucide-react';
import {
  ShareIcon as Share2,
  TrashIcon as Trash2,
  ChevronRightIcon as ChevronRight,
} from '../lib/appleIcons';
import type { User as UserType } from '../lib/types';
import { subscribeToNotifications, unsubscribeFromNotifications, sendTestNotification } from '../lib/notifications';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { BUILD_COMMIT, BUILD_TIME, getBackendVersion, type BackendVersion } from '../lib/version';
import { useSoundsEnabled } from '../lib/soundSettings';

type SettingsTab = 'general' | 'notifications' | 'appearance' | 'privacy' | 'profile' | 'premium';

interface SettingsModalProps {
  user: UserType;
  initialTab?: string;
  onClose: () => void;
  onInfoClick?: () => void;
}

const tabs: { id: SettingsTab; label: string; icon: typeof Bell }[] = [
  { id: 'general', label: 'Основные', icon: User },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'appearance', label: 'Внешний вид', icon: Palette },
  { id: 'privacy', label: 'Конфиденциальность', icon: Shield },
  { id: 'premium', label: 'НуЧе', icon: Crown },
  { id: 'profile', label: 'Профиль', icon: User },
];

function GeneralSettings({ onInfoClick }: { onInfoClick?: () => void }) {
  const [soundsOn, setSoundsOn] = useSoundsEnabled();
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Общие</h3>
      <SettingRow icon={Globe} label="Язык" value="Русский" />
      <SettingRow icon={Smartphone} label="Аппаратное ускорение" value="Вкл" toggle />
      <SettingRow icon={Volume2} label="Звуки в приложении" value={soundsOn ? 'Вкл' : 'Выкл'} toggle checked={soundsOn} onChange={setSoundsOn} />
      <SettingRow icon={Vibrate} label="Вибрация" value="Вкл" toggle />

      <div className="h-px bg-white/[0.04] my-3 mx-1" />
      <VersionInfo />
      {onInfoClick && (
        <div className="mt-2">
          <button
            onClick={onInfoClick}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.04] rounded-lg transition-colors"
          >
            <Globe size={16} className="text-white/50 shrink-0" />
            <span>Страница о проекте</span>
          </button>
        </div>
      )}
    </div>
  );
}

function VersionInfo() {
  const [backend, setBackend] = useState<BackendVersion | null>(null);

  useEffect(() => {
    let mounted = true;
    getBackendVersion().then(v => {
      if (mounted) setBackend(v);
    });
    return () => { mounted = false; };
  }, []);

  const buildDate = BUILD_TIME ? new Date(BUILD_TIME).toLocaleString('ru-RU') : '—';

  return (
    <div className="px-1 pb-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Версия</h3>
      <div className="space-y-1.5 px-1">
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">Приложение</span>
          <span className="text-xs text-white/40 font-mono">build-{BUILD_COMMIT}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">Сборка</span>
          <span className="text-xs text-white/30">{buildDate}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">Сервер</span>
          <span className="text-xs text-white/40 font-mono">
            {backend ? `build-${backend.commit}` : 'недоступен'}
          </span>
        </div>
      </div>
    </div>
  );
}

function NotificationSettings() {
  const [pushEnabled, setPushEnabled] = useState(() => {
    try {
      return typeof Notification !== 'undefined' && Notification.permission === 'granted';
    } catch {
      return false;
    }
  });
  const [pushLoading, setPushLoading] = useState(false);

  const handlePushToggle = async () => {
    setPushLoading(true);
    try {
      if (pushEnabled) {
        await unsubscribeFromNotifications();
        setPushEnabled(false);
      } else {
        const result = await subscribeToNotifications();
        setPushEnabled(result !== null);
      }
    } catch {
      console.error('[Push] Toggle failed');
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      await sendTestNotification();
    } catch (err) {
      console.error('[Push] Test notification failed:', err);
      toast.error('Не удалось отправить тестовое уведомление');
    }
  };

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Уведомления</h3>
      <SettingRow icon={Bell} label="Личные сообщения" value="Вкл" toggle />
      <SettingRow icon={Users} label="Группы" value="Вкл" toggle />
      <SettingRow icon={MessageCircle} label="Каналы" value="Вкл" toggle />
      <SettingRow icon={Phone} label="Звонки" value="Вкл" toggle />
      <div className="h-px bg-white/[0.04] my-3 mx-1" />
      <SettingRow icon={BellOff} label="Не беспокоить" value="Выкл" toggle />

      <div className="h-px bg-white/[0.04] my-3 mx-1" />

      {/* Push notifications */}
      <div className="px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Radio size={15} className="text-white/25" />
          <span className="text-xs text-white/60">Push-уведомления</span>
        </div>
        <div className="flex items-center gap-2">
          {pushLoading ? (
            <Loader size={14} className="text-white/30 animate-spin" />
          ) : (
            <div
              onClick={handlePushToggle}
              className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer ${
                pushEnabled ? 'bg-white/30' : 'bg-white/[0.08]'
              }`}
            >
              <motion.div
                animate={{ x: pushEnabled ? 18 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white/80 absolute top-0.5"
              />
            </div>
          )}
        </div>
      </div>

      {pushEnabled && (
        <motion.button
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleTestNotification}
          className="ml-11 text-[11px] text-white/30 hover:text-white/50 transition-colors"
        >
          Отправить тестовое уведомление
        </motion.button>
      )}
    </div>
  );
}

const THEMES = [
  { id: 'dark', label: 'Тёмная', icon: Moon, desc: 'Классический тёмный режим' },
  { id: 'light', label: 'Светлая', icon: Sun, desc: 'Светлая тема' },
  { id: 'amoled', label: 'AMOLED', icon: Moon, desc: 'Глубокий чёрный' },
  { id: 'midnight', label: 'Полуночная', icon: Monitor, desc: 'Тёмно-синий' },
] as const;

const COLOR_SCHEMES = [
  { id: 'blue', color: '#3b82f6', label: 'Синий' },
  { id: 'purple', color: '#8b5cf6', label: 'Фиолетовый' },
  { id: 'green', color: '#22c55e', label: 'Зелёный' },
  { id: 'red', color: '#ef4444', label: 'Красный' },
  { id: 'orange', color: '#f97316', label: 'Оранжевый' },
  { id: 'indigo', color: '#6366f1', label: 'Индиго' },
  { id: 'cyan', color: '#06b6d4', label: 'Голубой' },
  { id: 'rose', color: '#f43f5e', label: 'Розовый' },
  { id: 'emerald', color: '#10b981', label: 'Изумрудный' },
  { id: 'amber', color: '#f59e0b', label: 'Янтарный' },
  { id: 'slate', color: '#64748b', label: 'Серый' },
  { id: 'pink', color: '#ec4899', label: 'Пинк' },
  { id: 'teal', color: '#14b8a6', label: 'Бирюзовый' },
  { id: 'yellow', color: '#eab308', label: 'Жёлтый' },
];

function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return '163, 163, 163';
  return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
}

function applyCustomAccent(color: string) {
  const root = document.documentElement;
  root.style.setProperty('--nexo-custom-color', color);
  root.style.setProperty('--nexo-custom-rgb', hexToRgb(color));
  root.style.setProperty('--color-accent', color);
  root.style.setProperty('--color-accent-dark', color);
  root.style.setProperty('--color-accent-bright', color);
}

function AppearanceSettings() {
  const [theme, setTheme] = useState(() => localStorage.getItem('nexo_theme') || 'dark');
  const [colorScheme, setColorScheme] = useState(() => localStorage.getItem('nexo_color_scheme') || 'purple');
  const [customColor, setCustomColor] = useState(() => localStorage.getItem('nexo_custom_color') || '#8b5cf6');
  const [shared, setShared] = useState(false);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme);
    localStorage.setItem('nexo_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const handleColorChange = (newColor: string) => {
    setColorScheme(newColor);
    localStorage.setItem('nexo_color_scheme', newColor);
    document.documentElement.setAttribute('data-color-scheme', newColor);
  };

  const handleCustomColorChange = (color: string) => {
    setCustomColor(color);
    localStorage.setItem('nexo_custom_color', color);
    handleColorChange('custom');
    applyCustomAccent(color);
  };

  const handleShare = async () => {
    const color = colorScheme === 'custom' ? customColor : '';
    const hash = `#theme=${encodeURIComponent(theme)}&scheme=${encodeURIComponent(colorScheme)}${color ? `&color=${encodeURIComponent(color)}` : ''}`;
    const url = `${window.location.origin}${window.location.pathname}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Ссылка на тему скопирована');
    } catch {
      window.prompt('Ссылка на тему:', url);
    }
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  };

  useEffect(() => {
    // Import theme from URL share link (#theme=dark&scheme=blue&color=...)
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const t = params.get('theme');
    const s = params.get('scheme');
    const c = params.get('color');
    if (t && (t === 'dark' || t === 'light' || t === 'amoled' || t === 'midnight')) {
      setTheme(t);
      localStorage.setItem('nexo_theme', t);
      document.documentElement.setAttribute('data-theme', t);
    }
    if (s) {
      setColorScheme(s);
      localStorage.setItem('nexo_color_scheme', s);
      document.documentElement.setAttribute('data-color-scheme', s);
      if (s === 'custom' && c) {
        setCustomColor(c);
        localStorage.setItem('nexo_custom_color', c);
        applyCustomAccent(c);
      }
      if (s === 'custom' && c) {
        toast.success('Импортирована кастомная тема');
      }
    }
    if (t || s) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-5">
      {/* Theme */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-3">Тема оформления</h3>
        <div className="grid grid-cols-2 gap-2">
          {THEMES.map(t => {
            const Icon = t.icon;
            const isActive = theme === t.id;
            return (
              <motion.button
                key={t.id}
                onClick={() => handleThemeChange(t.id)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`
                  relative flex items-start gap-3 p-3 rounded-xl border transition-all duration-200
                  ${isActive
                    ? 'bg-white/[0.08] border-white/20'
                    : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'
                  }
                `}
              >
                <div className={`p-1.5 rounded-lg ${isActive ? 'bg-white/15' : 'bg-white/[0.04]'}`}>
                  <Icon size={16} className={isActive ? 'text-white/80' : 'text-white/40'} />
                </div>
                <div className="text-left">
                  <p className={`text-sm font-medium ${isActive ? 'text-white/90' : 'text-white/60'}`}>{t.label}</p>
                  <p className="text-[10px] text-white/30 mt-0.5">{t.desc}</p>
                </div>
                {isActive && (
                  <Check size={14} className="absolute top-2 right-2 text-white/60" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Color scheme */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-3">Цвет акцента</h3>
        <div className="grid grid-cols-7 gap-2 px-1">
          {COLOR_SCHEMES.map(c => {
            const isActive = colorScheme === c.id;
            return (
              <motion.button
                key={c.id}
                onClick={() => handleColorChange(c.id)}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`
                  w-full aspect-square rounded-xl transition-all duration-200 relative
                  ${isActive ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-[#0a0a0f]' : ''}
                `}
                style={{ backgroundColor: c.color }}
                title={c.label}
              >
                {isActive && (
                  <Check size={12} className="absolute inset-0 m-auto text-white" />
                )}
              </motion.button>
            );
          })}
          {/* Custom swatch */}
          <label
            className={`
              w-full aspect-square rounded-xl transition-all duration-200 relative flex items-center justify-center cursor-pointer
              ${colorScheme === 'custom' ? 'ring-2 ring-white/40 ring-offset-1 ring-offset-[#0a0a0f]' : ''}
            `}
            style={{ background: 'conic-gradient(#ff5f6d, #ffc371, #47e3a1, #6a5af9, #ff5f6d)' }}
            title="Свой цвет"
          >
            {colorScheme === 'custom' ? (
              <Check size={12} className="text-white" />
            ) : (
              <span className="text-[8px] font-bold text-white/90 tracking-wide">RGB</span>
            )}
            <input
              type="color"
              value={customColor}
              onChange={e => handleCustomColorChange(e.target.value)}
              className="absolute inset-0 opacity-0 cursor-pointer"
              aria-label="Свой цвет акцента"
            />
          </label>
        </div>
        <p className="text-[10px] text-white/25 mt-2 px-1">
          Цвет акцента используется для выделения элементов интерфейса
        </p>
      </div>

      {/* Share / Import theme */}
      <div>
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Поделиться темой</h3>
        <motion.button
          onClick={handleShare}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] text-xs text-white/70 transition-colors"
        >
          {shared ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} className="text-white/40" />}
          {shared ? 'Скопировано!' : 'Скопировать ссылку на тему'}
        </motion.button>
        <p className="text-[10px] text-white/25 mt-2 px-1">
          Тот, кто откроет ссылку, автоматически применит эту тему
        </p>
      </div>
    </div>
  );
}

function PrivacySettings() {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const data = await api.request('/account/export');
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexo-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Данные экспортированы');
    } catch (err) {
      toast.error('Ошибка экспорта данных');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await api.request('/account/delete', { method: 'DELETE' });
      toast.success('Аккаунт удалён');
      localStorage.clear();
      window.location.href = '/login';
    } catch (err) {
      toast.error('Ошибка удаления аккаунта');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Приватность</h3>
      <SettingRow icon={Eye} label="Кто видит номер" value="Никто" />
      <SettingRow icon={EyeOff} label="Статус в сети" value="Все" />
      <SettingRow icon={Check} label="Подтверждение прочтения" value="Вкл" toggle />
      <div className="h-px bg-white/[0.04] my-3 mx-1" />
      <SettingRow icon={Shield} label="Безопасность" value="" />

      <div className="h-px bg-white/[0.04] my-3 mx-1" />

      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2 pt-3">Данные</h3>

      {/* Export data */}
      <motion.button
        onClick={handleExport}
        disabled={exporting}
        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors disabled:opacity-50"
        whileTap={{ scale: 0.99 }}
      >
        <Download size={15} className="text-white/25" />
        <span className="text-xs text-white/60 flex-1 text-left">Экспорт данных</span>
        {exporting ? (
          <Loader size={12} className="text-white/30 animate-spin" />
        ) : (
          <ChevronRight size={12} className="text-white/15" />
        )}
      </motion.button>

      {/* Delete account */}
      {!confirmDelete ? (
        <motion.button
          onClick={() => setConfirmDelete(true)}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors"
          whileTap={{ scale: 0.99 }}
        >
          <Trash2 size={15} className="text-red-400/60" />
          <span className="text-xs text-red-400/70 flex-1 text-left">Удалить аккаунт</span>
          <ChevronRight size={12} className="text-white/15" />
        </motion.button>
      ) : (
        <div className="px-3 py-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-red-400/70">
            <AlertTriangle size={14} />
            <span>Вы уверены? Это действие необратимо.</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/60 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleDeleteAccount}
              disabled={deleting}
              className="flex-1 py-2 rounded-xl bg-red-500/80 hover:bg-red-500 text-xs text-white font-medium transition-colors disabled:opacity-50"
            >
              {deleting ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileSettings({ user }: { user: UserType }) {
  const initials = (user.displayName || user.username || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-4">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Профиль</h3>

      <div className="flex items-center gap-4 px-1">
        <div className="w-16 h-16 rounded-2xl overflow-hidden bg-gradient-to-br from-zinc-700 to-zinc-800 flex-shrink-0">
          {user.avatar ? (
            <img src={user.avatar} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-lg font-bold text-white/50">{initials}</span>
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-white/90">{user.displayName || user.username}</p>
          <p className="text-xs text-white/40">@{user.username}</p>
          <p className="text-xs text-white/30 mt-1">{user.bio || 'Нет описания'}</p>
        </div>
      </div>

      <div className="space-y-1 pt-2">
        <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Аккаунт</h3>
        <SettingRow icon={User} label="Имя" value={user.displayName || '—'} />
        <SettingRow icon={Globe} label="Username" value={`@${user.username}`} />
        <SettingRow icon={Smartphone} label="Дата регистрации" value={new Date(user.createdAt).toLocaleDateString('ru-RU')} />
      </div>
    </div>
  );
}

function PremiumSettings() {
  const [premiumStatus, setPremiumStatus] = useState<{ isPremium: boolean; premiumUntil: string | null } | null>(null);
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);
  const [aliases, setAliases] = useState<any[]>([]);
  const [newAlias, setNewAlias] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.getPremiumStatus().catch(() => ({ isPremium: false, premiumUntil: null })),
      api.getPremiumPrices().catch(() => ({ prices: {} })),
      api.getUserAliases().catch(() => []),
    ]).then(([status, priceData, aliasData]) => {
      setPremiumStatus(status);
      setPrices(priceData.prices || {});
      setAliases(Array.isArray(aliasData) ? aliasData : []);
    }).finally(() => setLoading(false));
  }, []);

  const handlePurchase = async () => {
    if (!selected) return;
    setPaying(true);
    try {
      const result = await api.createPayment({ type: 'premium', premiumMonths: selected });
      if (result.confirmationUrl) {
        window.open(result.confirmationUrl, '_blank', 'noopener,noreferrer');
        toast.success('Страница оплаты открыта');
      }
    } catch (err) {
      console.error('[Premium] Payment error:', err);
      toast.error('Ошибка создания платежа');
    } finally {
      setPaying(false);
    }
  };

  const handleAddAlias = async () => {
    if (!newAlias.trim()) return;
    setAdding(true);
    setError('');
    try {
      const result = await api.createUserAlias(newAlias.trim());
      setAliases(prev => [...prev, result]);
      setNewAlias('');
      toast.success('Юзернейм добавлен');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Ошибка';
      setError(msg);
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    try {
      await api.deleteUserAlias(aliasId);
      setAliases(prev => prev.filter(a => a.id !== aliasId));
      toast.success('Юзернейм удалён');
    } catch (err) {
      toast.error('Не удалось удалить');
    }
  };

  const months = [1, 3, 6, 12];
  const isPremium = premiumStatus?.isPremium ?? false;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 px-1 pb-2">
        <img src="/НуЧе.png" alt="" className="w-9 h-9 object-contain" />
        <div>
          <h3 className="text-sm font-semibold text-white/90">НуЧе</h3>
          <p className="text-[10px] text-white/40">
            {isPremium
              ? premiumStatus?.premiumUntil
                ? `Действует до ${new Date(premiumStatus.premiumUntil).toLocaleDateString('ru-RU')}`
                : 'НуЧе активен'
              : 'Разблокируйте все возможности'}
          </p>
        </div>
        {isPremium && (
          <div className="ml-auto px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-400/20 to-orange-400/20 border border-amber-400/20">
            <span className="text-[10px] font-semibold text-amber-400">АКТИВЕН</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5 px-1">
        {[
          { icon: Palette, label: 'Уникальные темы' },
          { icon: Paperclip, label: 'Файлы до 2 ГБ' },
          { icon: Trophy, label: 'Особый значок' },
          { icon: Gamepad2, label: 'Эксклюзивные стикеры' },
          { icon: Cloud, label: 'Облако 100 ГБ' },
          { icon: Crown, label: 'Приоритетная поддержка' },
          { icon: PenLine, label: 'Доп. юзернеймы' },
        ].map((feat, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <feat.icon size={13} className="text-amber-400" />
            <span className="text-[10px] text-white/60 whitespace-nowrap">{feat.label}</span>
          </div>
        ))}
      </div>

      {/* Additional usernames */}
      <div className="h-px bg-white/[0.04] my-1 mx-1" />
      {isPremium && (
        <div className="px-1 space-y-2">
          <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">Дополнительные юзернеймы</h4>
          <p className="text-[10px] text-white/30">Доступно 10 дополнительных юзернеймов для аккаунта (0–10)</p>
          <div className="space-y-1.5">
            {aliases.map((a) => (
              <div key={a.id} className="flex items-center justify-between px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                <span className="text-sm text-white/80 font-mono">@{a.alias}</span>
                <button
                  onClick={() => handleDeleteAlias(a.id)}
                  className="px-2 py-1 text-[10px] text-white/40 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  Удалить
                </button>
              </div>
            ))}
            {aliases.length === 0 && (
              <p className="text-xs text-white/20 italic px-1">Нет дополнительных юзернеймов</p>
            )}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={newAlias}
              onChange={(e) => { setNewAlias(e.target.value); setError(''); }}
              placeholder="Новый юзернейм..."
              className="flex-1 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white placeholder:text-white/20 outline-none focus:border-white/40"
            />
            <button
              onClick={handleAddAlias}
              disabled={adding || !newAlias.trim() || aliases.length >= 10}
              className="px-4 py-2 rounded-xl bg-white/[0.08] border border-white/[0.12] text-white/80 text-sm font-medium hover:bg-white/[0.14] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {adding ? '...' : 'Добавить'}
            </button>
          </div>
          {error && <p className="text-xs text-red-400 px-1">{error}</p>}
        </div>
      )}

      {!isPremium && (
        <>
          <div className="h-px bg-white/[0.04] my-1 mx-1" />
          <div className="grid grid-cols-2 gap-2 px-1">
            {months.map(m => {
              const price = prices[m];
              const isSelected = selected === m;
              const roundedPrice = price ? Math.round(price) : null;
              const monthlyPrice = roundedPrice ? Math.round(roundedPrice / m) : null;
              return (
                <button
                  key={m}
                  onClick={() => setSelected(m)}
                  className={`relative p-3 rounded-xl border transition-all text-left ${
                    isSelected
                      ? 'border-amber-500/50 bg-amber-500/10'
                      : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="text-sm font-medium text-white/80">{m} {m === 1 ? 'месяц' : m < 5 ? 'месяца' : 'месяцев'}</span>
                  {roundedPrice && (
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-lg font-bold text-white/90">{roundedPrice.toLocaleString('ru-RU')}</span>
                      <span className="text-sm font-semibold text-white/50">₽</span>
                      {monthlyPrice && (
                        <span className="text-[10px] text-white/30 ml-0.5">
                          {monthlyPrice.toLocaleString('ru-RU')}/мес
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            onClick={handlePurchase}
            disabled={!selected || paying}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {paying ? 'Создание платежа...' : selected && prices[selected] ? `Купить за ${Math.round(prices[selected]).toLocaleString('ru-RU')} НуЧе` : 'Выберите тариф'}
          </button>
        </>
      )}
    </div>
  );
}

function SettingRow({
  icon: Icon,
  label,
  value,
  toggle,
  checked,
  onChange,
}: {
  icon: typeof Bell;
  label: string;
  value: string;
  toggle?: boolean;
  checked?: boolean;
  onChange?: (v: boolean) => void;
}) {
  const [internal, setInternal] = useState(toggle ? value === 'Вкл' : false);
  const isChecked = onChange ? !!checked : internal;

  return (
    <motion.div
      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.03] hover:border-white/[0.06] border border-transparent transition-all duration-200 cursor-pointer"
      whileTap={{ scale: 0.99 }}
      onClick={() => {
        if (!toggle) return;
        const next = !isChecked;
        if (onChange) onChange(next);
        else setInternal(next);
      }}
    >
      <div className="flex items-center gap-3">
        <Icon size={15} className="text-white/25" />
        <span className="text-xs text-white/60">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {toggle && (
          <div
            className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${
              isChecked ? 'bg-white/30' : 'bg-white/[0.08]'
            }`}
          >
            <motion.div
              animate={{ x: isChecked ? 18 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-4 h-4 rounded-full bg-white/80 absolute top-0.5"
            />
          </div>
        )}
        {value && !toggle && (
          <span className="text-xs text-white/30">{value}</span>
        )}
        {!toggle && value && (
          <ChevronRight size={12} className="text-white/15" />
        )}
      </div>
    </motion.div>
  );
}

export default function SettingsModal({ user, initialTab = 'general', onClose, onInfoClick }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab as SettingsTab);
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20, filter: "blur(4px)" }}
        animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
        exit={{ opacity: 0, scale: 0.92, y: 20, filter: "blur(4px)" }}
        transition={{ type: "spring", stiffness: 300, damping: 28 }}
        className="relative w-full max-w-[560px] h-[80vh] flex rounded-2xl liquid-glass-strong overflow-hidden glass-ambient"
        onClick={e => e.stopPropagation()}
      >
        {/* ─── Close ──────────────────────────────────────────────── */}
        <motion.button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-xl bg-black/40 border border-white/[0.06] hover:bg-white/[0.1] transition-colors"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <X size={16} className="text-white/50" />
        </motion.button>

        {/* ─── Sidebar ────────────────────────────────────────────── */}
        <div className="w-48 flex-shrink-0 p-3 border-r border-white/[0.06] flex flex-col gap-1">
          <div className="text-xs font-semibold text-white/30 uppercase font-display tracking-wider px-3 pb-3 pt-2">
            Настройки
          </div>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-all duration-200
                ${activeTab === tab.id
                  ? 'bg-white/[0.08] text-white/90 border border-white/[0.06]'
                  : 'text-white/40 hover:text-white/60 hover:bg-white/[0.03] border border-transparent'
                }
              `}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ─── Content ────────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeTab === 'general' && <GeneralSettings onInfoClick={onInfoClick} />}
              {activeTab === 'notifications' && <NotificationSettings />}
              {activeTab === 'appearance' && <AppearanceSettings />}
              {activeTab === 'privacy' && <PrivacySettings />}
              {activeTab === 'premium' && <PremiumSettings />}
              {activeTab === 'profile' && <ProfileSettings user={user} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}

