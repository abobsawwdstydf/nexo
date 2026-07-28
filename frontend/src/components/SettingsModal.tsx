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
  ChevronRight,
  Check,
  Monitor,
  Radio,
  Loader,
  Crown,
  Star,
  Download,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import type { User as UserType } from '../lib/types';
import { subscribeToNotifications, unsubscribeFromNotifications, sendTestNotification } from '../lib/notifications';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

type SettingsTab = 'general' | 'notifications' | 'appearance' | 'privacy' | 'profile' | 'premium';

interface SettingsModalProps {
  user: UserType;
  initialTab?: string;
  onClose: () => void;
}

const tabs: { id: SettingsTab; label: string; icon: typeof Bell }[] = [
  { id: 'general', label: 'Основные', icon: User },
  { id: 'notifications', label: 'Уведомления', icon: Bell },
  { id: 'appearance', label: 'Внешний вид', icon: Palette },
  { id: 'privacy', label: 'Конфиденциальность', icon: Shield },
  { id: 'premium', label: 'Премиум', icon: Crown },
  { id: 'profile', label: 'Профиль', icon: User },
];

function GeneralSettings() {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Общие</h3>
      <SettingRow icon={Globe} label="Язык" value="Русский" />
      <SettingRow icon={Smartphone} label="Аппаратное ускорение" value="Вкл" toggle />
      <SettingRow icon={Volume2} label="Звуки в приложении" value="Вкл" toggle />
      <SettingRow icon={Vibrate} label="Вибрация" value="Вкл" toggle />
    </div>
  );
}

function NotificationSettings() {
  const [pushEnabled, setPushEnabled] = useState(() => Notification.permission === 'granted');
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
    await sendTestNotification();
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

function AppearanceSettings() {
  const [theme, setTheme] = useState(() => localStorage.getItem('nexo_theme') || 'dark');
  const [colorScheme, setColorScheme] = useState(() => localStorage.getItem('nexo_color_scheme') || 'purple');

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
        </div>
        <p className="text-[10px] text-white/25 mt-2 px-1">
          Цвет акцента используется для выделения элементов интерфейса
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
      const response = await fetch('/api/account/export', { credentials: 'include' });
      if (!response.ok) throw new Error('Export failed');
      const data = await response.json();
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
  const [currency, setCurrency] = useState('RUB');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    Promise.all([
      api.getPremiumStatus().catch(() => ({ isPremium: false, premiumUntil: null })),
      api.getPremiumPrices().catch(() => ({ prices: {}, currency: 'RUB' })),
    ]).then(([status, priceData]) => {
      setPremiumStatus(status);
      setPrices(priceData.prices || {});
      setCurrency(priceData.currency || 'RUB');
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

  const months = [1, 3, 6, 12];
  const currencySymbol = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency;
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
        <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-orange-400/20 border border-amber-400/20">
          <Crown size={18} className="text-amber-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white/90">Нексо Премиум</h3>
          <p className="text-[10px] text-white/40">
            {isPremium
              ? `Действует до ${new Date(premiumStatus!.premiumUntil!).toLocaleDateString('ru-RU')}`
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
          { icon: '🎨', label: 'Уникальные темы' },
          { icon: '📎', label: 'Файлы до 2 ГБ' },
          { icon: '🏆', label: 'Особый значок' },
          { icon: '🎮', label: 'Эксклюзивные стикеры' },
          { icon: '☁️', label: 'Облако 100 ГБ' },
          { icon: '👑', label: 'Приоритетная поддержка' },
        ].map((feat, i) => (
          <div key={i} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
            <span className="text-sm">{feat.icon}</span>
            <span className="text-[10px] text-white/60 whitespace-nowrap">{feat.label}</span>
          </div>
        ))}
      </div>

      {!isPremium && (
        <>
          <div className="h-px bg-white/[0.04] my-1 mx-1" />
          <div className="grid grid-cols-2 gap-2 px-1">
            {months.map(m => {
              const price = prices[m];
              const isSelected = selected === m;
              const monthlyPrice = price ? (price / m) : null;
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
                  {price && (
                    <div className="mt-1">
                      <span className="text-lg font-bold text-white/90">{price} {currencySymbol}</span>
                      {monthlyPrice && (
                        <span className="text-[10px] text-white/30 ml-1">
                          {monthlyPrice} {currencySymbol}/мес
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
            {paying ? 'Создание платежа...' : selected ? `Купить за ${prices[selected]} ${currencySymbol}` : 'Выберите тариф'}
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
  radio,
  selected,
}: {
  icon: typeof Bell;
  label: string;
  value: string;
  toggle?: boolean;
  radio?: boolean;
  selected?: boolean;
}) {
  const [checked, setChecked] = useState(toggle ? value === 'Вкл' : false);

  return (
    <motion.div
      className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-white/[0.03] transition-colors cursor-pointer"
      whileTap={{ scale: 0.99 }}
      onClick={() => toggle && setChecked(v => !v)}
    >
      <div className="flex items-center gap-3">
        <Icon size={15} className="text-white/25" />
        <span className="text-xs text-white/60">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        {toggle && (
          <div
            className={`w-9 h-5 rounded-full transition-colors duration-200 relative ${
              checked ? 'bg-white/30' : 'bg-white/[0.08]'
            }`}
          >
            <motion.div
              animate={{ x: checked ? 18 : 2 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className="w-4 h-4 rounded-full bg-white/80 absolute top-0.5"
            />
          </div>
        )}
        {radio && (
          <div
            className={`w-4 h-4 rounded-full border-2 transition-colors ${
              selected ? 'border-white/60' : 'border-white/20'
            }`}
          >
            {selected && <div className="w-2 h-2 rounded-full bg-white/60 m-[3px]" />}
          </div>
        )}
        {value && !toggle && !radio && (
          <span className="text-xs text-white/30">{value}</span>
        )}
        {!toggle && !radio && value && (
          <ChevronRight size={12} className="text-white/15" />
        )}
      </div>
    </motion.div>
  );
}

export default function SettingsModal({ user, initialTab = 'general', onClose }: SettingsModalProps) {
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
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative w-full max-w-[560px] h-[80vh] flex rounded-2xl liquid-glass-strong overflow-hidden"
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
              {activeTab === 'general' && <GeneralSettings />}
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
