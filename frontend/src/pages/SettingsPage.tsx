import { motion } from 'framer-motion';
import { ArrowLeft, Shield, Bell, Palette, Database, Lock, Eye, Moon, Sun, Globe, Volume2, Key } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { useThemeStore } from '../stores/themeStore';
import { useState } from 'react';

interface SettingsPageProps {
  onClose: () => void;
}

type SettingsSection = 'main' | 'privacy' | 'notifications' | 'appearance' | 'data';

function SettingsItem({ icon, label, desc, onClick, badge }: { icon: React.ReactNode; label: string; desc?: string; onClick?: () => void; badge?: string }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left rounded-xl"
    >
      <div className="w-9 h-9 rounded-xl bg-[var(--color-surface)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">{label}</span>
          {badge && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[var(--color-accent)]/15 text-[var(--color-accent)]">{badge}</span>}
        </div>
        {desc && <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{desc}</p>}
      </div>
    </button>
  );
}

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${enabled ? 'bg-[var(--color-accent)]' : 'bg-white/10'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-5' : 'left-1'}`} />
    </button>
  );
}

export default function SettingsPage({ onClose }: SettingsPageProps) {
  const { user } = useAuthStore();
  const { navigateTo } = useNavigationStore();
  const { mode, setMode } = useThemeStore();
  const [section, setSection] = useState<SettingsSection>('main');

  // Privacy toggles (mock state)
  const [showOnline, setShowOnline] = useState(true);
  const [showReadReceipts, setShowReadReceipts] = useState(true);
  const [showPhone, setShowPhone] = useState(false);
  const [twoFA, setTwoFA] = useState(false);

  // Notification toggles (mock state)
  const [notifMessages, setNotifMessages] = useState(true);
  const [notifCalls, setNotifCalls] = useState(true);
  const [notifSounds, setNotifSounds] = useState(true);

  const renderSection = () => {
    switch (section) {
      case 'privacy':
        return (
          <div className="space-y-1">
            <SettingsItem icon={<Lock size={16} className="text-[var(--color-accent)]" />} label="Двухфакторная аутентификация" desc={twoFA ? 'Включена' : 'Выключена'} onClick={() => setTwoFA(!twoFA)} badge={twoFA ? 'ВКЛ' : undefined} />
            <SettingsItem icon={<Eye size={16} className="text-[var(--color-accent)]" />} label="Показывать онлайн" desc={showOnline ? 'Видят все' : 'Скрыто'} onClick={() => setShowOnline(!showOnline)} />
            <SettingsItem icon={<Shield size={16} className="text-[var(--color-accent)]" />} label="Читать уведомления" desc={showReadReceipts ? 'Показывать' : 'Скрыто'} onClick={() => setShowReadReceipts(!showReadReceipts)} />
            <SettingsItem icon={<Globe size={16} className="text-[var(--color-accent)]" />} label="Номер телефона" desc={showPhone ? 'Виден всем' : 'Скрыт'} onClick={() => setShowPhone(!showPhone)} />
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-1">
            <SettingsItem icon={<Bell size={16} className="text-[var(--color-accent)]" />} label="Сообщения" desc={notifMessages ? 'Включены' : 'Выключены'} onClick={() => setNotifMessages(!notifMessages)} />
            <SettingsItem icon={<Volume2 size={16} className="text-[var(--color-accent)]" />} label="Звуки" desc={notifSounds ? 'Включены' : 'Выключены'} onClick={() => setNotifSounds(!notifSounds)} />
            <SettingsItem icon={<Bell size={16} className="text-[var(--color-accent)]" />} label="Звонки" desc={notifCalls ? 'Включены' : 'Выключены'} onClick={() => setNotifCalls(!notifCalls)} />
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-3">
            <div className="px-4">
              <p className="text-xs text-[var(--color-text-secondary)] mb-2 font-medium uppercase tracking-wider">Тема</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setMode('dark')}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${mode === 'dark' ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-white' : 'bg-white/[0.04] border-white/[0.08] text-[var(--color-text-secondary)] hover:bg-white/[0.08]'}`}
                >
                  <Moon size={16} />
                  <span className="text-sm font-medium">Тёмная</span>
                </button>
                <button
                  onClick={() => setMode('light')}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${mode === 'light' ? 'bg-[var(--color-accent)]/15 border-[var(--color-accent)]/50 text-white' : 'bg-white/[0.04] border-white/[0.08] text-[var(--color-text-secondary)] hover:bg-white/[0.08]'}`}
                >
                  <Sun size={16} />
                  <span className="text-sm font-medium">Светлая</span>
                </button>
              </div>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-1">
            <SettingsItem icon={<Database size={16} className="text-[var(--color-accent)]" />} label="Облачное хранилище" desc="Управление файлами" onClick={() => navigateTo('files')} />
            <SettingsItem icon={<Key size={16} className="text-[var(--color-accent)]" />} label="Экспорт данных" desc="Скачать копию" />
          </div>
        );

      default:
        return (
          <div className="space-y-1">
            <SettingsItem icon={<Lock size={16} className="text-[var(--color-accent)]" />} label="Конфиденциальность" desc="Онлайн, уведомления, номер" onClick={() => setSection('privacy')} />
            <SettingsItem icon={<Bell size={16} className="text-[var(--color-accent)]" />} label="Уведомления" desc="Звуки и оповещения" onClick={() => setSection('notifications')} />
            <SettingsItem icon={<Palette size={16} className="text-[var(--color-accent)]" />} label="Внешний вид" desc="Тема и оформление" onClick={() => setSection('appearance')} />
            <SettingsItem icon={<Database size={16} className="text-[var(--color-accent)]" />} label="Данные и хранилище" desc="Файлы и экспорт" onClick={() => setSection('data')} />
          </div>
        );
    }
  };

  const sectionTitle: Record<SettingsSection, string> = {
    main: 'Настройки',
    privacy: 'Конфиденциальность',
    notifications: 'Уведомления',
    appearance: 'Внешний вид',
    data: 'Данные и хранилище',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col bg-[var(--color-bg)]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <button
          onClick={() => section === 'main' ? navigateTo('chat') : setSection('main')}
          className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5"
        >
          <ArrowLeft size={20} className="text-[var(--color-text-secondary)]" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center">
            <Shield size={16} className="text-[var(--color-accent)]" />
          </div>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">{sectionTitle[section]}</h1>
        </div>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto p-3">
        {renderSection()}
      </div>
    </motion.div>
  );
}
