import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BellOff, Volume2, VolumeX, X } from 'lucide-react';
import { api } from '../lib/api';

interface ChatNotificationSettingsProps {
  chatId: string;
  chatName: string;
  onClose: () => void;
}

export default function ChatNotificationSettingsModal({ chatId, chatName, onClose }: ChatNotificationSettingsProps) {
  const [muted, setMuted] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [vibrateEnabled, setVibrateEnabled] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/chat-notifications/${chatId}`, {
        muted,
        mutedUntil: mutedUntil || null,
        soundEnabled,
        vibrateEnabled,
        showPreview,
      });
      onClose();
    } catch (err) {
      console.error('Failed to save notification settings:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-md rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell size={20} className="text-indigo-400" />
            <h3 className="text-lg font-semibold text-white">Уведомления</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <p className="text-zinc-400 text-sm">{chatName}</p>

          {/* Mute toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {muted ? <BellOff size={20} className="text-red-400" /> : <Bell size={20} className="text-indigo-400" />}
              <div>
                <p className="text-white text-sm font-medium">Отключить уведомления</p>
                <p className="text-zinc-500 text-xs">{muted ? 'Уведомления отключены' : 'Уведомления включены'}</p>
              </div>
            </div>
            <button
              onClick={() => setMuted(!muted)}
              className={`relative w-12 h-6 rounded-full transition-colors ${muted ? 'bg-red-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${muted ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Mute duration */}
          {muted && (
            <div className="ml-8">
              <label className="text-sm text-zinc-400 mb-2 block">Отключить до:</label>
              <div className="space-y-1.5">
                {[
                  { value: '', label: 'Навсегда' },
                  { value: '1h', label: '1 час' },
                  { value: '4h', label: '4 часа' },
                  { value: '8h', label: '8 часов' },
                  { value: 'tomorrow', label: 'До завтра' },
                ].map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setMutedUntil(opt.value)}
                    className={`w-full p-2 rounded-lg border text-left text-sm transition-all ${
                      mutedUntil === opt.value
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-white'
                        : 'bg-white/5 border-white/10 text-zinc-300 hover:bg-white/10'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Sound */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {soundEnabled ? <Volume2 size={20} className="text-indigo-400" /> : <VolumeX size={20} className="text-zinc-500" />}
              <p className="text-white text-sm font-medium">Звук</p>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Vibrate */}
          <div className="flex items-center justify-between">
            <p className="text-white text-sm font-medium">Вибрация</p>
            <button
              onClick={() => setVibrateEnabled(!vibrateEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${vibrateEnabled ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${vibrateEnabled ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          {/* Preview */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-sm font-medium">Показывать текст</p>
              <p className="text-zinc-500 text-xs">Содержимое сообщения в уведомлении</p>
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`relative w-12 h-6 rounded-full transition-colors ${showPreview ? 'bg-indigo-500' : 'bg-zinc-700'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${showPreview ? 'translate-x-6' : ''}`} />
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:bg-zinc-700 text-white font-medium transition-colors"
          >
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
