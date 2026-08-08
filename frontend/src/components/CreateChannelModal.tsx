import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Radio, Hash, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { getDomain } from '../lib/getDomain';

interface CreateChannelModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateChannelModal({ onClose, onCreated }: CreateChannelModalProps) {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isValid = name.trim().length >= 2 && username.trim().length >= 3;

  const handleSubmit = async () => {
    if (!isValid || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await api.createChannel(
        name.trim(),
        username.trim().toLowerCase().replace(/[^a-z0-9_-]/g, ''),
        description.trim() || undefined,
      );
      onCreated();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка создания канала');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl liquid-glass-strong overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 border border-rose-500/20 flex items-center justify-center">
              <Radio size={16} className="text-rose-400/70" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white/90 font-display">Создать канал</h2>
              <p className="text-[11px] text-white/30">Публичный канал для всех</p>
            </div>
          </div>
          <motion.button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <X size={16} className="text-white/40" />
          </motion.button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Название канала</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Например: Новости дня"
              maxLength={64}
              className="w-full h-10 px-4 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
            />
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">
              Username <span className="text-white/20">(ссылка на канал)</span>
            </label>
            <div className="relative">
              <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="novosti_dnya"
                maxLength={32}
                className="w-full h-10 pl-9 pr-3 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
              />
            </div>
            {username.length >= 3 && (
              <p className="text-[10px] text-white/20 mt-1">
                {getDomain()}/@{username}
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs text-white/40 mb-1.5">
              Описание <span className="text-white/20">(необязательно)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="О чём ваш канал?"
              maxLength={255}
              rows={3}
              className="w-full px-4 py-2.5 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06] resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-red-400/70">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.06]">
          <motion.button
            onClick={onClose}
            className="px-4 py-2 text-xs text-white/50 hover:text-white/70 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            Отмена
          </motion.button>
          <motion.button
            onClick={handleSubmit}
            disabled={!isValid || submitting}
            className="px-5 py-2 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/20 text-rose-300/80 rounded-xl transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            whileHover={isValid ? { scale: 1.03 } : {}}
            whileTap={isValid ? { scale: 0.97 } : {}}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 size={12} className="animate-spin" />
                Создание...
              </span>
            ) : (
              'Создать канал'
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
