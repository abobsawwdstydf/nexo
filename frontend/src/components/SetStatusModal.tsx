import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Smile } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';

interface SetStatusModalProps {
  onClose: () => void;
  currentStatus?: { text: string; emoji?: string; expiresAt?: string } | null;
}

const PRESET_STATUSES = [
  { emoji: '🎮', text: 'Играю' },
  { emoji: '💼', text: 'На работе' },
  { emoji: '🎓', text: 'Учусь' },
  { emoji: '😴', text: 'Сплю' },
  { emoji: '🍕', text: 'Обедаю' },
  { emoji: '🚗', text: 'В дороге' },
  { emoji: '🎬', text: 'Смотрю фильм' },
  { emoji: '🎵', text: 'Слушаю музыку' },
  { emoji: '💪', text: 'Тренируюсь' },
  { emoji: '🌴', text: 'В отпуске' },
  { emoji: '📚', text: 'Читаю' },
  { emoji: '🎨', text: 'Творю' }
];

const DURATIONS = [
  { label: '1 час', minutes: 60 },
  { label: '4 часа', minutes: 240 },
  { label: '8 часов', minutes: 480 },
  { label: '24 часа', minutes: 1440 },
  { label: 'Пока не уберу', minutes: 0 }
];

export default function SetStatusModal({ onClose, currentStatus }: SetStatusModalProps) {
  const [text, setText] = useState(currentStatus?.text || '');
  const [emoji, setEmoji] = useState(currentStatus?.emoji || '');
  const [duration, setDuration] = useState(240); // 4 часа по умолчанию
  const [isLoading, setIsLoading] = useState(false);
  const { success, error } = useToastStore();

  const handleSetStatus = async () => {
    if (!text.trim()) {
      error('Введите текст статуса');
      return;
    }

    setIsLoading(true);
    try {
      await api.setUserStatus(text.trim(), emoji || undefined, duration);
      success('Статус установлен');
      onClose();
    } catch (err) {
      console.error('Error setting status:', err);
      error('Не удалось установить статус');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteStatus = async () => {
    setIsLoading(true);
    try {
      await api.deleteUserStatus();
      success('Статус удалён');
      onClose();
    } catch (err) {
      console.error('Error deleting status:', err);
      error('Не удалось удалить статус');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[400px] sm:max-w-[calc(100%-24px)] sm:rounded-2xl rounded-none z-50 bg-surface-secondary border border-border flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">Установить статус</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Emoji Picker */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              <Smile size={16} className="inline mr-1" />
              Эмодзи
            </label>
            <div className="grid grid-cols-6 gap-2">
              {PRESET_STATUSES.map((preset) => (
                <button
                  key={preset.emoji}
                  onClick={() => setEmoji(preset.emoji)}
                  className={`p-2 rounded-lg text-2xl transition-colors ${
                    emoji === preset.emoji
                      ? 'bg-nexo-500/20 ring-2 ring-nexo-500'
                      : 'hover:bg-white/5'
                  }`}
                >
                  {preset.emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Текст статуса
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Что у вас происходит?"
              maxLength={100}
              className="w-full px-4 py-3 bg-surface rounded-xl border border-border focus:border-nexo-500 focus:ring-2 focus:ring-nexo-500/20 outline-none transition-all"
            />
            <div className="text-xs text-zinc-500 mt-1 text-right">
              {text.length}/100
            </div>
          </div>

          {/* Preset Statuses */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Быстрый выбор
            </label>
            <div className="space-y-2">
              {PRESET_STATUSES.map((preset) => (
                <button
                  key={preset.text}
                  onClick={() => {
                    setEmoji(preset.emoji);
                    setText(preset.text);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left"
                >
                  <span className="text-2xl">{preset.emoji}</span>
                  <span className="text-sm">{preset.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              <Clock size={16} className="inline mr-1" />
              Длительность
            </label>
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map((dur) => (
                <button
                  key={dur.minutes}
                  onClick={() => setDuration(dur.minutes)}
                  className={`p-3 rounded-xl text-sm transition-colors ${
                    duration === dur.minutes
                      ? 'bg-nexo-500/20 text-nexo-400 ring-2 ring-nexo-500'
                      : 'bg-surface hover:bg-white/5'
                  }`}
                >
                  {dur.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border space-y-2">
          <button
            onClick={handleSetStatus}
            disabled={isLoading || !text.trim()}
            className="w-full py-3 bg-nexo-500 hover:bg-nexo-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
          >
            {isLoading ? 'Сохранение...' : 'Установить статус'}
          </button>

          {currentStatus && (
            <button
              onClick={handleDeleteStatus}
              disabled={isLoading}
              className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium transition-colors"
            >
              Удалить статус
            </button>
          )}
        </div>
      </motion.div>
    </>
  );
}
