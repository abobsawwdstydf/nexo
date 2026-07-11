import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Clock, Shield, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';

interface SecretChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  username: string;
  onChatCreated: (chatId: string) => void;
}

export function SecretChatModal({ isOpen, onClose, userId, username, onChatCreated }: SecretChatModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selfDestructTimer, setSelfDestructTimer] = useState<number | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');

  const timerOptions = [
    { label: 'Без таймера', value: null },
    { label: '5 секунд', value: 5 },
    { label: '10 секунд', value: 10 },
    { label: '30 секунд', value: 30 },
    { label: '1 минута', value: 60 },
    { label: '5 минут', value: 300 },
    { label: '1 час', value: 3600 },
    { label: '1 день', value: 86400 },
  ];

  const handleCreate = async () => {
    if (isCreating) return;
    
    try {
      setIsCreating(true);
      setError('');

      const response = await api.createSecretChat(userId, password || undefined, selfDestructTimer || undefined);
      
      if (response.chat) {
        onChatCreated(response.chat.id);
        onClose();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Не удалось создать секретный чат');
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          className="bg-surface rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 p-6 text-white">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Lock className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Секретный чат</h2>
                  <p className="text-sm text-white/80">с {username}</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Features */}
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-sm">
                <Shield className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text">End-to-End шифрование</p>
                  <p className="text-text-secondary text-xs">Только вы и собеседник можете читать сообщения</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <Clock className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text">Самоуничтожающиеся сообщения</p>
                  <p className="text-text-secondary text-xs">Сообщения автоматически удаляются через заданное время</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-sm">
                <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-text">Защита от скриншотов</p>
                  <p className="text-text-secondary text-xs">Собеседник получит уведомление при попытке скриншота</p>
                </div>
              </div>
            </div>

            {/* Password (optional) */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Пароль (необязательно)
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Оставьте пустым для отключения"
                  className="w-full px-4 py-3 bg-surface-hover rounded-xl border border-border focus:border-accent focus:outline-none text-text pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-xs text-text-secondary mt-1">
                Пароль потребуется для открытия чата
              </p>
            </div>

            {/* Self-destruct timer */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Таймер самоуничтожения
              </label>
              <div className="grid grid-cols-2 gap-2">
                {timerOptions.map((option) => (
                  <button
                    key={option.label}
                    onClick={() => setSelfDestructTimer(option.value)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      selfDestructTimer === option.value
                        ? 'bg-accent text-white shadow-lg shadow-accent/30'
                        : 'bg-surface-hover text-text hover:bg-surface-active'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-text-secondary mt-2">
                {selfDestructTimer
                  ? `Сообщения будут удаляться через ${timerOptions.find(o => o.value === selfDestructTimer)?.label.toLowerCase()}`
                  : 'Сообщения не будут удаляться автоматически'}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-500">
                {error}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isCreating}
                className="flex-1 px-4 py-3 rounded-xl bg-surface-hover hover:bg-surface-active text-text font-medium transition-colors disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleCreate}
                disabled={isCreating}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium transition-all disabled:opacity-50 shadow-lg shadow-purple-500/30"
              >
                {isCreating ? 'Создание...' : 'Создать'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
