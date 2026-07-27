import { useState, useRef } from 'react';
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
} from 'lucide-react';
import type { User as UserType } from '../lib/types';

type SettingsTab = 'general' | 'notifications' | 'appearance' | 'privacy' | 'profile';

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
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Уведомления</h3>
      <SettingRow icon={Bell} label="Личные сообщения" value="Вкл" toggle />
      <SettingRow icon={Users} label="Группы" value="Вкл" toggle />
      <SettingRow icon={MessageCircle} label="Каналы" value="Вкл" toggle />
      <SettingRow icon={Phone} label="Звонки" value="Вкл" toggle />
      <div className="h-px bg-white/[0.04] my-3 mx-1" />
      <SettingRow icon={BellOff} label="Не беспокоить" value="Выкл" toggle />
    </div>
  );
}

function AppearanceSettings() {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Оформление</h3>
      <SettingRow icon={Sun} label="Светлая тема" value="" radio selected={false} />
      <SettingRow icon={Moon} label="Тёмная тема" value="" radio selected={true} />
      <SettingRow icon={Palette} label="Цвет акцента" value="Фиолетовый" />

      <div className="h-px bg-white/[0.04] my-3 mx-1" />

      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Чат</h3>
      <SettingRow icon={MessageCircle} label="Режим компактный" value="Выкл" toggle />
      <SettingRow icon={Palette} label="Фон чата" value="По умолчанию" />
    </div>
  );
}

function PrivacySettings() {
  return (
    <div className="space-y-1">
      <h3 className="text-xs font-semibold text-white/40 uppercase tracking-wider px-1 pb-2">Приватность</h3>
      <SettingRow icon={Eye} label="Кто видит номер" value="Никто" />
      <SettingRow icon={EyeOff} label="Статус в сети" value="Все" />
      <SettingRow icon={Check} label="Подтверждение прочтения" value="Вкл" toggle />
      <div className="h-px bg-white/[0.04] my-3 mx-1" />
      <SettingRow icon={Shield} label="Безопасность" value="" />
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
      className="absolute inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative w-full max-w-[560px] h-[80vh] flex rounded-2xl overflow-hidden"
        style={{ background: 'rgba(15,15,20,0.96)', backdropFilter: 'blur(40px)', border: '1px solid rgba(255,255,255,0.08)' }}
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
          <div className="text-xs font-semibold text-white/30 uppercase tracking-wider px-3 pb-3 pt-2">
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
              {activeTab === 'profile' && <ProfileSettings user={user} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
