import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Check } from 'lucide-react';
import api from '../lib/api';

interface DisappearingMessagesSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
}

export default function DisappearingMessagesSettings({ isOpen, onClose, chatId }: DisappearingMessagesSettingsProps) {
  const [enabled, setEnabled] = useState(false);
  const [timer, setTimer] = useState(60);
  const [loading, setLoading] = useState(false);

  const timerOptions = [
    { value: 30, label: '30 секунд' },
    { value: 60, label: '1 минута' },
    { value: 300, label: '5 минут' },
    { value: 3600, label: '1 час' },
    { value: 86400, label: '1 день' },
    { value: 604800, label: '1 неделя' },
  ];

  useEffect(() => {
    if (isOpen) {
      loadSettings();
    }
  }, [isOpen, chatId]);

  const loadSettings = async () => {
    try {
      const response = await api.get(`/disappearing-messages/${chatId}`);
      setEnabled(response.data.enabled);
      setTimer(response.data.timer);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.post(`/disappearing-messages/${chatId}`, {
        enabled,
        timer,
      });
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="w-full max-w-md bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Исчезающие сообщения
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Enable Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Включить исчезающие сообщения
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Сообщения будут автоматически удаляться после прочтения
                </p>
              </div>
              <button
                onClick={() => setEnabled(!enabled)}
                className={`w-14 h-8 rounded-full transition-colors flex items-center px-1 ${
                  enabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full bg-white shadow transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Timer Selection */}
            {enabled && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-3"
              >
                <h3 className="font-medium text-gray-900 dark:text-white">
                  Время до удаления
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {timerOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setTimer(option.value)}
                      className={`px-4 py-3 rounded-xl transition-all ${
                        timer === option.value
                          ? 'bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2 dark:ring-offset-gray-800'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        {timer === option.value && <Check className="w-4 h-4" />}
                        <span className="text-sm font-medium">{option.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Info */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
              <p className="text-sm text-blue-900 dark:text-blue-300">
                ℹ️ Сообщения будут удалены через выбранное время после того, как получатель их прочитает. Пересылка таких сообщений запрещена.
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 font-medium"
              >
                {loading ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
