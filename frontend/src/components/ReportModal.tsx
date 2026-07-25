import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Flag, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetType: 'message' | 'user' | 'chat' | 'wall_post' | 'wall_comment' | 'story';
  targetId: string;
}

const REASONS = [
  { value: 'spam', label: 'Спам', icon: '📢' },
  { value: 'harassment', label: 'Преследование / Оскорбления', icon: '😠' },
  { value: 'violence', label: 'Насилие', icon: '⚠️' },
  { value: 'nudity', label: 'Нагота / Сексуальный контент', icon: '🔞' },
  { value: 'hate_speech', label: 'Разжигание ненависти', icon: '🚫' },
  { value: 'other', label: 'Другое', icon: '📝' },
];

export default function ReportModal({ isOpen, onClose, targetType, targetId }: ReportModalProps) {
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { success, error } = useToastStore();

  const handleSubmit = async () => {
    if (!reason) return;
    setSubmitting(true);
    try {
      await api.post('/reports', { targetType, targetId, reason, description });
      success('Жалоба отправлена. Спасибо!');
      onClose();
    } catch (e: any) {
      error(e.message || 'Ошибка отправки');
    } finally {
      setSubmitting(false);
    }
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
          className="bg-surface border border-border rounded-2xl w-full max-w-md overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              <h2 className="text-lg font-semibold text-primary">Пожаловаться</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition">
              <X className="w-5 h-5 text-secondary" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <p className="text-sm text-secondary">Выберите причину жалобы:</p>
            <div className="grid grid-cols-2 gap-2">
              {REASONS.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setReason(r.value)}
                  className={`flex items-center gap-2 p-3 rounded-xl border transition text-left text-sm ${
                    reason === r.value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border hover:border-accent/50 text-primary'
                  }`}
                >
                  <span>{r.icon}</span>
                  <span>{r.label}</span>
                </button>
              ))}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Дополнительные детали (необязательно)..."
              className="w-full p-3 bg-muted border border-border rounded-xl text-sm text-primary placeholder-secondary resize-none h-20"
            />
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-secondary hover:text-primary transition rounded-lg"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason || submitting}
              className="px-4 py-2 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 transition"
            >
              {submitting ? 'Отправка...' : 'Отправить'}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
