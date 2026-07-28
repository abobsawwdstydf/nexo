import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Timer, Play, Pause, Check, X, Loader, Clock, Users, MessageCircle, Send,
  AlertTriangle, Shield, RefreshCw, Settings,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface DeadManSwitchProps {
  onClose: () => void;
}

type SwitchStatus = 'active' | 'triggered' | 'disabled';

interface Recipient {
  id: string;
  name: string;
  avatar: string | null;
}

export default function DeadManSwitch({ onClose }: DeadManSwitchProps) {
  const [enabled, setEnabled] = useState(false);
  const [inactivityDays, setInactivityDays] = useState(7);
  const [messageTemplate, setMessageTemplate] = useState('Привет! Это сообщение было отправлено автоматически, так как я долго не заходил в мессенджер. Если вы получили это, пожалуйста, свяжитесь со мной другим способом.');
  const [recipients, setRecipients] = useState<Recipient[]>([
    { id: '1', name: 'Мария', avatar: null },
    { id: '2', name: 'Алексей', avatar: null },
  ]);
  const [status, setStatus] = useState<SwitchStatus>('disabled');
  const [lastCheckIn, setLastCheckIn] = useState(new Date().toISOString());
  const [showAddRecipient, setShowAddRecipient] = useState(false);
  const [newRecipientName, setNewRecipientName] = useState('');
  const [confirmTrigger, setConfirmTrigger] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('nexo_deadman');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setEnabled(data.enabled || false);
        setInactivityDays(data.inactivityDays || 7);
        setMessageTemplate(data.messageTemplate || messageTemplate);
        setRecipients(data.recipients || []);
        setLastCheckIn(data.lastCheckIn || new Date().toISOString());
        if (data.enabled) setStatus('active');
      } catch {}
    }
  }, []);

  const saveSettings = useCallback(() => {
    localStorage.setItem('nexo_deadman', JSON.stringify({
      enabled, inactivityDays, messageTemplate, recipients, lastCheckIn,
    }));
  }, [enabled, inactivityDays, messageTemplate, recipients, lastCheckIn]);

  const handleToggle = useCallback(() => {
    const newEnabled = !enabled;
    setEnabled(newEnabled);
    setStatus(newEnabled ? 'active' : 'disabled');
    toast.success(newEnabled ? 'Dead Man\'s Switch активирован' : 'Dead Man\'s Switch деактивирован');
    setTimeout(saveSettings, 100);
  }, [enabled, saveSettings]);

  const handleCheckIn = useCallback(() => {
    setLastCheckIn(new Date().toISOString());
    toast.success('Проверка пройдена! Таймер сброшен.');
    saveSettings();
  }, [saveSettings]);

  const handleAddRecipient = useCallback(() => {
    if (!newRecipientName.trim()) return;
    setRecipients(prev => [...prev, { id: Date.now().toString(), name: newRecipientName.trim(), avatar: null }]);
    setNewRecipientName('');
    setShowAddRecipient(false);
    toast.success('Получатель добавлен');
  }, [newRecipientName]);

  const handleRemoveRecipient = useCallback((id: string) => {
    setRecipients(prev => prev.filter(r => r.id !== id));
  }, []);

  const handleTestTrigger = useCallback(async () => {
    setTesting(true);
    try {
      await new Promise(r => setTimeout(r, 1500));
      toast.success('Тестовое сообщение отправлено получателям');
    } catch {
      toast.error('Ошибка отправки');
    } finally {
      setTesting(false);
    }
  }, []);

  const getDaysSinceCheckIn = () => {
    const diff = Date.now() - new Date(lastCheckIn).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  };

  const daysSince = getDaysSinceCheckIn();
  const progress = Math.min(daysSince / inactivityDays, 1);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/20 flex items-center justify-center">
            <Timer size={15} className="text-orange-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Dead Man's Switch</h2>
        </div>
        <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <X size={15} className="text-white/40" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Status */}
        <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-white/50">Статус</span>
            <div onClick={handleToggle}
              className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer ${enabled ? 'bg-orange-500/50' : 'bg-white/[0.08]'}`}>
              <motion.div animate={{ x: enabled ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-4 h-4 rounded-full bg-white/80 absolute top-0.5" />
            </div>
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className={`px-2 py-1 rounded-lg text-[10px] border ${status === 'active' ? 'bg-green-500/10 border-green-500/20 text-green-400/70' : status === 'triggered' ? 'bg-red-500/10 border-red-500/20 text-red-400/70' : 'bg-white/[0.04] border-white/[0.06] text-white/30'}`}>
              {status === 'active' ? '● Активен' : status === 'triggered' ? '● Триггер!' : '○ Выкл'}
            </div>
            {enabled && (
              <span className="text-[10px] text-white/25">Последняя проверка: {new Date(lastCheckIn).toLocaleDateString('ru-RU')}</span>
            )}
          </div>
          {enabled && (
            <div>
              <div className="flex items-center justify-between text-[10px] text-white/25 mb-1">
                <span>Дней без активности: {daysSince}</span>
                <span>Лимит: {inactivityDays}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                <motion.div animate={{ width: `${progress * 100}%` }} transition={{ duration: 0.5 }}
                  className={`h-full rounded-full ${progress > 0.8 ? 'bg-red-500' : progress > 0.5 ? 'bg-yellow-500' : 'bg-green-500'}`} />
              </div>
            </div>
          )}
        </div>

        {/* Check-in button */}
        {enabled && (
          <motion.button onClick={handleCheckIn}
            className="w-full py-3 rounded-xl bg-green-500/15 border border-green-500/20 text-xs text-green-400/80 font-medium hover:bg-green-500/25 transition-colors flex items-center justify-center gap-2"
            whileTap={{ scale: 0.98 }}>
            <Check size={14} />Провериться (сбросить таймер)
          </motion.button>
        )}

        {/* Inactivity days */}
        <div>
          <div className="flex items-center justify-between px-1 pb-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Дней бездействия</label>
            <span className="text-xs text-white/50 font-mono">{inactivityDays} дн</span>
          </div>
          <input type="range" min={1} max={30} value={inactivityDays} onChange={e => setInactivityDays(Number(e.target.value))}
            className="w-full h-1.5 rounded-full appearance-none bg-white/[0.08] accent-orange-500 cursor-pointer" />
          <div className="flex justify-between text-[10px] text-white/20 px-0.5 mt-1">
            <span>1</span><span>15</span><span>30</span>
          </div>
        </div>

        {/* Message template */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Шаблон сообщения</label>
          <textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} rows={4}
            className="w-full px-3 py-2 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20 resize-none" />
        </div>

        {/* Recipients */}
        <div>
          <div className="flex items-center justify-between px-1 pb-2">
            <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Получатели</label>
            <button onClick={() => setShowAddRecipient(v => !v)} className="text-[10px] text-orange-400/50 hover:text-orange-400/70 transition-colors">+ Добавить</button>
          </div>
          <div className="space-y-1">
            {recipients.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                <div className="w-7 h-7 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                  <Users size={12} className="text-orange-400/50" />
                </div>
                <span className="text-xs text-white/60 flex-1">{r.name}</span>
                <button onClick={() => handleRemoveRecipient(r.id)} className="p-1 rounded hover:bg-white/[0.08]">
                  <X size={10} className="text-red-400/40" />
                </button>
              </div>
            ))}
            <AnimatePresence>
              {showAddRecipient && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden">
                  <div className="flex gap-2 pt-1">
                    <input type="text" value={newRecipientName} onChange={e => setNewRecipientName(e.target.value)} placeholder="Имя..."
                      className="flex-1 h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none"
                      onKeyDown={e => e.key === 'Enter' && handleAddRecipient()} autoFocus />
                    <motion.button onClick={handleAddRecipient} className="px-3 h-8 rounded-xl bg-orange-500/20 text-[10px] text-orange-400/70" whileTap={{ scale: 0.95 }}>
                      <Check size={12} />
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Test trigger */}
        <div className="border-t border-white/[0.06] pt-3">
          <motion.button onClick={handleTestTrigger} disabled={testing || recipients.length === 0}
            className="w-full py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.08] transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            whileTap={{ scale: 0.98 }}>
            {testing ? <><Loader size={12} className="animate-spin" />Отправка...</> : <><Send size={12} />Тестовое отправление</>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}