import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, Calendar, Edit3, Trash2, X, Plus, Check, Loader, ChevronDown,
  Send, Repeat, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface ScheduledMessagesProps {
  onClose: () => void;
  onSend?: (text: string) => void;
}

type RepeatType = 'none' | 'daily' | 'weekly' | 'monthly';

interface ScheduledMsg {
  id: string;
  text: string;
  chatName: string;
  scheduledAt: string;
  repeat: RepeatType;
  status: 'pending' | 'sent' | 'cancelled';
}

const REPEAT_OPTIONS: { key: RepeatType; label: string }[] = [
  { key: 'none', label: 'Без повтора' },
  { key: 'daily', label: 'Ежедневно' },
  { key: 'weekly', label: 'Еженедельно' },
  { key: 'monthly', label: 'Ежемесячно' },
];

export default function ScheduledMessages({ onClose, onSend }: ScheduledMessagesProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [message, setMessage] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [repeat, setRepeat] = useState<RepeatType>('none');
  const [saving, setSaving] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledMsg[]>([
    { id: '1', text: 'Напоминание о встрече', chatName: 'Рабочий чат', scheduledAt: '2025-01-15T10:00:00', repeat: 'none', status: 'pending' },
    { id: '2', text: 'Отчёт за неделю', chatName: 'Дизайн команда', scheduledAt: '2025-01-20T09:00:00', repeat: 'weekly', status: 'pending' },
  ]);

  const handleCreate = useCallback(async () => {
    if (!message.trim() || !date || !time) return;
    setSaving(true);
    try {
      const dt = new Date(`${date}T${time}`);
      const newMsg: ScheduledMsg = {
        id: Date.now().toString(),
        text: message.trim(),
        chatName: 'Текущий чат',
        scheduledAt: dt.toISOString(),
        repeat,
        status: 'pending',
      };
      setScheduled(prev => [...prev, newMsg]);
      setMessage('');
      setDate('');
      setTime('');
      setRepeat('none');
      setShowCreate(false);
      toast.success('Сообщение запланировано');
    } catch {
      toast.error('Ошибка планирования');
    } finally {
      setSaving(false);
    }
  }, [message, date, time, repeat]);

  const handleCancel = useCallback((id: string) => {
    setScheduled(prev => prev.map(m => m.id === id ? { ...m, status: 'cancelled' } : m));
    toast.success('Отменено');
  }, []);

  const handleDelete = useCallback((id: string) => {
    setScheduled(prev => prev.filter(m => m.id !== id));
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/20 flex items-center justify-center">
            <Clock size={15} className="text-blue-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Запланированные</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => setShowCreate(v => !v)}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="Создать">
            <Plus size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-3 space-y-3">
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2}
                placeholder="Текст сообщения..."
                className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" />

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Дата</label>
                  <input type="date" value={date} onChange={e => setDate(e.target.value)}
                    className="w-full h-8 px-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none focus:border-white/20 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="text-[10px] text-white/30 block mb-1">Время</label>
                  <input type="time" value={time} onChange={e => setTime(e.target.value)}
                    className="w-full h-8 px-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none focus:border-white/20 [color-scheme:dark]" />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-white/30 block mb-1">Повтор</label>
                <div className="flex gap-1">
                  {REPEAT_OPTIONS.map(r => (
                    <button key={r.key} onClick={() => setRepeat(r.key)}
                      className={`px-2 py-1 rounded-lg text-[10px] transition-colors ${repeat === r.key ? 'bg-blue-500/20 text-blue-400/70 border border-blue-500/20' : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:bg-white/[0.06]'}`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-white/[0.04] text-xs text-white/50 hover:bg-white/[0.08] transition-colors">
                  Отмена
                </button>
                <motion.button onClick={handleCreate} disabled={saving || !message.trim() || !date || !time}
                  className="flex-1 py-2 rounded-xl bg-blue-500/20 border border-blue-500/20 text-xs text-blue-400/80 font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5"
                  whileTap={{ scale: 0.98 }}>
                  {saving ? <Loader size={12} className="animate-spin" /> : <><Send size={11} />Запланировать</>}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {scheduled.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Clock size={24} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30">Нет запланированных</p>
            <p className="text-xs text-white/15 mt-1">Нажмите + чтобы создать</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {scheduled.map(msg => (
              <motion.div key={msg.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className={`p-3 rounded-xl border transition-colors ${msg.status === 'cancelled' ? 'bg-white/[0.01] border-white/[0.03] opacity-50' : 'bg-white/[0.03] border-white/[0.06]'}`}>
                <div className="flex items-start justify-between mb-1.5">
                  <p className="text-xs text-white/60 flex-1 pr-2 leading-relaxed">{msg.text}</p>
                  {msg.status === 'cancelled' && (
                    <span className="text-[10px] text-red-400/50 flex-shrink-0">Отменено</span>
                  )}
                </div>
                <div className="flex items-center gap-3 text-[10px] text-white/30">
                  <div className="flex items-center gap-1">
                    <Calendar size={10} />
                    <span>{formatDate(msg.scheduledAt)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock size={10} />
                    <span>{formatTime(msg.scheduledAt)}</span>
                  </div>
                  {msg.repeat !== 'none' && (
                    <div className="flex items-center gap-1">
                      <Repeat size={10} />
                      <span>{REPEAT_OPTIONS.find(r => r.key === msg.repeat)?.label}</span>
                    </div>
                  )}
                  <span className="text-white/20">→ {msg.chatName}</span>
                </div>
                {msg.status === 'pending' && (
                  <div className="flex gap-1 mt-2">
                    <motion.button onClick={() => handleCancel(msg.id)}
                      className="px-2 py-1 rounded-lg bg-white/[0.04] text-[10px] text-white/40 hover:bg-white/[0.08] transition-colors" whileTap={{ scale: 0.95 }}>
                      Отменить
                    </motion.button>
                    <motion.button onClick={() => handleDelete(msg.id)}
                      className="px-2 py-1 rounded-lg bg-red-500/10 text-[10px] text-red-400/50 hover:bg-red-500/20 transition-colors" whileTap={{ scale: 0.95 }}>
                      Удалить
                    </motion.button>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}