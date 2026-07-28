import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Plus, Clock, Edit3, Trash2, X, Check, Loader, MessageCircle,
  Calendar, Zap, AlertCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface SmartRemindersProps {
  onClose: () => void;
}

interface Reminder {
  id: string;
  text: string;
  time: string;
  chatName: string;
  isActive: boolean;
  isAISuggested: boolean;
}

export default function SmartReminders({ onClose }: SmartRemindersProps) {
  const [reminders, setReminders] = useState<Reminder[]>([
    { id: '1', text: 'Позвонить клиенту', time: '2025-01-15T10:00:00', chatName: 'Рабочий чат', isActive: true, isAISuggested: false },
    { id: '2', text: 'Подготовить презентацию', time: '2025-01-16T14:00:00', chatName: 'Дизайн', isActive: true, isAISuggested: false },
    { id: '3', text: 'Отправить отчёт за неделю', time: '2025-01-17T09:00:00', chatName: 'Общий', isActive: true, isAISuggested: true },
  ]);
  const [showCreate, setShowCreate] = useState(false);
  const [newText, setNewText] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('');
  const [newChat, setNewChat] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([
    'Отправить еженедельный отчёт',
    'Проверить статус задач',
    'Написать коллеге',
  ]);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  const handleCreate = useCallback(() => {
    if (!newText.trim() || !newDate || !newTime) return;
    const dt = new Date(`${newDate}T${newTime}`);
    setReminders(prev => [...prev, {
      id: Date.now().toString(),
      text: newText.trim(),
      time: dt.toISOString(),
      chatName: newChat.trim() || 'Общий',
      isActive: true,
      isAISuggested: false,
    }]);
    setNewText(''); setNewDate(''); setNewTime(''); setNewChat('');
    setShowCreate(false);
    toast.success('Напоминание создано');
  }, [newText, newDate, newTime, newChat]);

  const handleToggle = useCallback((id: string) => {
    setReminders(prev => prev.map(r => r.id === id ? { ...r, isActive: !r.isActive } : r));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success('Напоминание удалено');
  }, []);

  const handleAISuggest = useCallback(async () => {
    setSuggestionLoading(true);
    try {
      const res = await api.aiChat([
        { role: 'system', content: 'Предложи 3 полезных напоминания для мессенджера на русском. Верни только список, по одному на строку, без нумерации.' },
        { role: 'user', content: 'Предложи напоминания' },
      ]);
      const lines = res.text.split('\n').filter((l: string) => l.trim()).slice(0, 3);
      setAiSuggestions(lines);
    } catch {
      toast.error('Не удалось получить предложения');
    } finally {
      setSuggestionLoading(false);
    }
  }, []);

  const handleUseSuggestion = useCallback((text: string) => {
    setNewText(text);
    setShowCreate(true);
  }, []);

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} в ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center">
            <Bell size={15} className="text-indigo-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Напоминания</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => setShowCreate(v => !v)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
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
            <div className="px-3 py-3 space-y-2">
              <input type="text" value={newText} onChange={e => setNewText(e.target.value)} placeholder="Что напомнить..."
                className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                  className="h-8 px-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none [color-scheme:dark]" />
                <input type="time" value={newTime} onChange={e => setNewTime(e.target.value)}
                  className="h-8 px-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none [color-scheme:dark]" />
              </div>
              <input type="text" value={newChat} onChange={e => setNewChat(e.target.value)} placeholder="Чат (необязательно)..."
                className="w-full h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none" />
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-xl bg-white/[0.04] text-xs text-white/50">Отмена</button>
                <motion.button onClick={handleCreate} disabled={!newText.trim() || !newDate || !newTime}
                  className="flex-1 py-2 rounded-xl bg-indigo-500/20 border border-indigo-500/20 text-xs text-indigo-400/80 font-medium disabled:opacity-40"
                  whileTap={{ scale: 0.98 }}>Создать</motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* AI Suggestions */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider flex items-center gap-1">
              <Zap size={10} />AI-предложения
            </label>
            <motion.button onClick={handleAISuggest} disabled={suggestionLoading}
              className="text-[10px] text-indigo-400/50 hover:text-indigo-400/70 transition-colors disabled:opacity-40"
              whileTap={{ scale: 0.95 }}>
              {suggestionLoading ? <Loader size={10} className="animate-spin inline" /> : 'Обновить'}
            </motion.button>
          </div>
          <div className="space-y-1">
            {aiSuggestions.map((s, i) => (
              <button key={i} onClick={() => handleUseSuggestion(s)}
                className="w-full text-left px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.06] transition-colors flex items-center gap-2">
                <Zap size={10} className="text-indigo-400/40 flex-shrink-0" />
                <span className="truncate">{s}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Reminder list */}
        <div>
          <label className="text-[10px] font-semibold text-white/40 uppercase tracking-wider block mb-2 px-1">Все напоминания</label>
          {reminders.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Bell size={20} className="text-white/15 mb-2" />
              <p className="text-xs text-white/30">Нет напоминаний</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {reminders.map(r => (
                <motion.div key={r.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-xl border transition-colors ${r.isActive ? 'bg-white/[0.03] border-white/[0.06]' : 'bg-white/[0.01] border-white/[0.03] opacity-50'}`}>
                  <div className="flex items-start justify-between mb-1">
                    <p className="text-xs text-white/60 flex-1 pr-2">{r.text}</p>
                    <div onClick={() => handleToggle(r.id)} className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${r.isActive ? 'bg-indigo-500/40' : 'bg-white/[0.08]'}`}
                      style={{ width: 32, height: 18 }}>
                      <motion.div animate={{ x: r.isActive ? 15 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                        className="w-3.5 h-3.5 rounded-full bg-white/80 absolute top-[2px]" style={{ top: 1 }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-white/25">
                    <span className="flex items-center gap-1"><Clock size={9} />{formatDateTime(r.time)}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={9} />{r.chatName}</span>
                    {r.isAISuggested && <span className="flex items-center gap-1 text-indigo-400/40"><Zap size={9} />AI</span>}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-white/[0.08]">
                      <Trash2 size={10} className="text-red-400/50" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}