import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Heart, TrendingUp, Target, Gift } from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../stores/authStore';

interface DonationModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientId?: string;
  recipientName?: string;
}

export default function DonationModal({ isOpen, onClose, recipientId, recipientName }: DonationModalProps) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<'send' | 'top' | 'goals' | 'history'>('send');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [sending, setSending] = useState(false);
  const [topDonators, setTopDonators] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && recipientId) {
      if (tab === 'top') loadTopDonators();
      if (tab === 'goals') loadGoals();
      if (tab === 'history') loadHistory();
    }
  }, [isOpen, tab, recipientId]);

  const loadTopDonators = async () => {
    try {
      const response = await api.get(`/donations/top/${recipientId}`);
      setTopDonators(response.data);
    } catch (error) {
      console.error('Error loading top donators:', error);
    }
  };

  const loadGoals = async () => {
    try {
      const response = await api.get(`/donations/goals/${recipientId}`);
      setGoals(response.data);
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const loadHistory = async () => {
    try {
      const response = await api.get('/donations/history');
      setHistory(response.data);
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleSend = async () => {
    if (!recipientId || !amount || parseInt(amount) <= 0) return;

    try {
      setSending(true);
      await api.post('/donations/send', {
        recipientId,
        amount: parseInt(amount),
        message,
        isAnonymous
      });
      setAmount('');
      setMessage('');
      onClose();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Ошибка отправки доната');
    } finally {
      setSending(false);
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
          className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-surface-secondary">
            <div className="flex items-center gap-3">
              <Heart className="w-6 h-6 text-pink-600 dark:text-pink-400" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Донаты и чаевые
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[
              { id: 'send', label: 'Отправить', icon: Gift },
              { id: 'top', label: 'Топ донатеров', icon: TrendingUp },
              { id: 'goals', label: 'Цели', icon: Target },
              { id: 'history', label: 'История', icon: Heart }
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id as any)}
                className={`flex-1 px-4 py-3 flex items-center justify-center gap-2 transition-colors ${
                  tab === id
                    ? 'bg-pink-50 dark:bg-pink-900/20 text-pink-600 dark:text-pink-400 border-b-2 border-pink-600'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {tab === 'send' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Получатель
                  </label>
                  <div className="px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                    <span className="text-gray-900 dark:text-white font-medium">
                      {recipientName}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Сумма
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="100"
                      className="w-full pl-12 pr-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                      min="1"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2">
                     
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    {[10, 50, 100, 500, 1000].map(preset => (
                      <button
                        key={preset}
                        onClick={() => setAmount(preset.toString())}
                        className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 hover:bg-pink-100 dark:hover:bg-pink-900/30 rounded-lg text-sm transition-colors"
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Сообщение (необязательно)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Спасибо за контент!"
                    className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-pink-500"
                    rows={3}
                  />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    className="w-4 h-4 text-pink-600 rounded focus:ring-pink-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Анонимный донат
                  </span>
                </label>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-gray-600 dark:text-gray-400">Ваш баланс:</span>
                    <div className="flex items-center gap-2">
                     
                      <span className="font-semibold text-gray-900 dark:text-white">
                        {user?.beavers || 0}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={handleSend}
                    disabled={sending || !amount || parseInt(amount) <= 0}
                    className="w-full px-4 py-3 bg-nexo-500 text-white rounded-lg hover:bg-nexo-600 transition-all disabled:opacity-50 font-medium"
                  >
                    {sending ? 'Отправка...' : 'Отправить донат'}
                  </button>
                </div>
              </div>
            )}

            {tab === 'top' && (
              <div className="space-y-3">
                {topDonators.length === 0 ? (
                  <div className="text-center py-12">
                    <TrendingUp className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Пока нет донатов</p>
                  </div>
                ) : (
                  topDonators.map((donator, index) => (
                    <div
                      key={donator.user.id}
                      className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-400 text-yellow-900' :
                        index === 1 ? 'bg-gray-300 text-gray-700' :
                        index === 2 ? 'bg-orange-400 text-orange-900' :
                        'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {donator.user.displayName || donator.user.username}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                       
                        <span className="font-semibold text-gray-900 dark:text-white">
                          {donator.totalAmount}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'goals' && (
              <div className="space-y-4">
                {goals.length === 0 ? (
                  <div className="text-center py-12">
                    <Target className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">Нет активных целей</p>
                  </div>
                ) : (
                  goals.map(goal => (
                    <div
                      key={goal.id}
                      className="p-4 bg-surface-tertiary rounded-xl border border-border"
                    >
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {goal.title}
                      </h3>
                      {goal.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {goal.description}
                        </p>
                      )}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600 dark:text-gray-400">Прогресс:</span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {goal.currentAmount} / {goal.targetAmount} бобров
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-nexo-500 transition-all duration-500"
                            style={{ width: `${Math.min(goal.progress, 100)}%` }}
                          />
                        </div>
                        <div className="text-right text-sm font-medium text-pink-600 dark:text-pink-400">
                          {goal.progress.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {tab === 'history' && (
              <div className="space-y-3">
                {history.length === 0 ? (
                  <div className="text-center py-12">
                    <Heart className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">История пуста</p>
                  </div>
                ) : (
                  history.map(donation => (
                    <div
                      key={donation.id}
                      className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {donation.senderId === user?.id ? (
                              <>Вы → {donation.recipient.displayName || donation.recipient.username}</>
                            ) : (
                              <>{donation.sender ? `${donation.sender.displayName || donation.sender.username} → Вы` : 'Анонимный донат'}</>
                            )}
                          </div>
                          {donation.message && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              {donation.message}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                         
                          <span className={`font-semibold ${
                            donation.senderId === user?.id
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-green-600 dark:text-green-400'
                          }`}>
                            {donation.senderId === user?.id ? '-' : '+'}{donation.amount}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(donation.createdAt).toLocaleString('ru')}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
