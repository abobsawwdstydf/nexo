import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lock, Eye, EyeOff, Shield, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useChatStore } from '../stores/chatStore';
import BottomSheet from './BottomSheet';

interface HiddenChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'create' | 'unlock';
  chatId?: string;
  onUnlocked?: () => void;
}

export default function HiddenChatModal({ isOpen, onClose, mode, chatId, onUnlocked }: HiddenChatModalProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const { archivedChatIds, archiveChat } = useChatStore();

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleCreate = async () => {
    if (!password.trim()) {
      setError('Введите пароль');
      return;
    }
    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    if (password.length < 4) {
      setError('Пароль должен быть не менее 4 символов');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.setHiddenChatPassword(chatId!, password);
      // Архивируем чат чтобы скрыть из основного списка
      archiveChat(chatId!);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Ошибка установки пароля');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlock = async () => {
    if (!password.trim()) {
      setError('Введите пароль');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await api.verifyHiddenChatPassword(chatId!, password);
      onUnlocked?.();
      onClose();
    } catch (e: any) {
      setError('Неверный пароль');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const header = (
    <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
          <Lock size={16} className="text-purple-400" />
        </div>
        <h3 className="text-sm font-semibold text-white">
          {mode === 'create' ? 'Скрытый чат' : 'Разблокировать чат'}
        </h3>
      </div>
      <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
        <X size={18} />
      </button>
    </div>
  );

  const content = (
    <div className="p-5 space-y-4">
      {mode === 'create' && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
          <AlertTriangle size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Чат будет скрыт в архиве и защищён паролем. Не забудьте пароль — восстановить его невозможно.
          </p>
        </div>
      )}

      <div>
        <label className="text-xs text-zinc-500 mb-2 block">
          {mode === 'create' ? 'Пароль для чата' : 'Введите пароль'}
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => { setPassword(e.target.value); setError(null); }}
            placeholder="Пароль..."
            className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
            onKeyDown={e => e.key === 'Enter' && (mode === 'create' ? handleCreate() : handleUnlock())}
          />
          <button
            onClick={() => setShowPassword(s => !s)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {mode === 'create' && (
        <div>
          <label className="text-xs text-zinc-500 mb-2 block">Подтвердите пароль</label>
          <input
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={e => { setConfirmPassword(e.target.value); setError(null); }}
            placeholder="Повторите пароль..."
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500/50"
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
          />
        </div>
      )}

      {error && (
        <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg">{error}</p>
      )}

      <button
        onClick={mode === 'create' ? handleCreate : handleUnlock}
        disabled={isLoading}
        className="w-full py-3 rounded-xl bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
      >
        <Shield size={16} />
        {isLoading ? 'Загрузка...' : mode === 'create' ? 'Скрыть чат' : 'Разблокировать'}
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title={mode === 'create' ? 'Скрытый чат' : 'Разблокировать чат'}>
        {content}
      </BottomSheet>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {header}
          {content}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
