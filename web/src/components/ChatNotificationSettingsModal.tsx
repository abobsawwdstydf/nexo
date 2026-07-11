import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Bell, BellOff, Volume2, VolumeX, Eye, EyeOff } from 'lucide-react';
import { useNotificationStore, type ChatNotificationSettings } from '../stores/notificationStore';
import { useToastStore } from '../stores/toastStore';

interface ChatNotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string;
}

export default function ChatNotificationSettingsModal({ isOpen, onClose, chatId, chatName }: ChatNotificationSettingsModalProps) {
  const { getChatSettings, setChatSettings, resetChatSettings } = useNotificationStore();
  const { success } = useToastStore();
  const [settings, setSettings] = useState<ChatNotificationSettings>(getChatSettings(chatId));

  useEffect(() => {
    setSettings(getChatSettings(chatId));
  }, [chatId, getChatSettings]);

  const update = (partial: Partial<ChatNotificationSettings>) => {
    const newSettings = { ...settings, ...partial };
    setSettings(newSettings);
    setChatSettings(chatId, partial);
  };

  const handleReset = () => {
    resetChatSettings(chatId);
    success('Настройки уведомлений сброшены');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-surface border border-border rounded-2xl w-full max-w-sm overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-accent" />
              <h2 className="text-lg font-semibold text-primary truncate">Уведомления: {chatName}</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition">
              <X className="w-5 h-5 text-secondary" />
            </button>
          </div>

          <div className="p-4 space-y-1">
            <ToggleRow
              icon={settings.enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              label="Уведомления"
              desc="Показывать уведомления из этого чата"
              value={settings.enabled}
              onChange={(v) => update({ enabled: v })}
            />
            <ToggleRow
              icon={settings.sound ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
              label="Звук"
              desc="Звуковое оповещение"
              value={settings.sound}
              onChange={(v) => update({ sound: v })}
            />
            <ToggleRow
              icon={settings.vibration ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              label="Вибрация"
              desc="Вибрация при сообщении"
              value={settings.vibration}
              onChange={(v) => update({ vibration: v })}
            />
            <ToggleRow
              icon={settings.preview ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
              label="Превью"
              desc="Показывать текст сообщения"
              value={settings.preview}
              onChange={(v) => update({ preview: v })}
            />
          </div>

          <div className="p-4 border-t border-border">
            <button
              onClick={handleReset}
              className="w-full text-sm text-secondary hover:text-primary transition py-2"
            >
              Сбросить настройки для этого чата
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-muted/50 transition cursor-pointer"
      onClick={() => onChange(!value)}
    >
      <div className="text-secondary">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium text-primary">{label}</div>
        <div className="text-xs text-secondary">{desc}</div>
      </div>
      <div
        className={`w-10 h-6 rounded-full transition-colors relative ${
          value ? 'bg-accent' : 'bg-muted border border-border'
        }`}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-5' : 'translate-x-1'
          }`}
        />
      </div>
    </div>
  );
}
