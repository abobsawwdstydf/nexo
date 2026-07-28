import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, AlertTriangle, Trash2, VolumeX, Eye, EyeOff, Users, Check, X,
  Loader, ChevronDown, Activity, Settings, List, Plus,
} from 'lucide-react';
import { toast } from '../lib/toast';

type ModerationAction = 'warn' | 'mute' | 'delete';
type LogSeverity = 'low' | 'medium' | 'high' | 'critical';
type Tab = 'settings' | 'log';

interface ModerationPanelProps {
  onClose: () => void;
}

interface ModerationLog {
  id: string;
  username: string;
  action: string;
  reason: string;
  severity: LogSeverity;
  timestamp: string;
}

const SEVERITY_COLORS: Record<LogSeverity, { bg: string; text: string; label: string }> = {
  low: { bg: 'bg-green-500/10 border-green-500/20', text: 'text-green-400/70', label: 'Низкий' },
  medium: { bg: 'bg-yellow-500/10 border-yellow-500/20', text: 'text-yellow-400/70', label: 'Средний' },
  high: { bg: 'bg-orange-500/10 border-orange-500/20', text: 'text-orange-400/70', label: 'Высокий' },
  critical: { bg: 'bg-red-500/10 border-red-500/20', text: 'text-red-400/70', label: 'Критический' },
};

const ACTION_OPTIONS: { key: ModerationAction; label: string; icon: typeof AlertTriangle }[] = [
  { key: 'warn', label: 'Предупредить', icon: AlertTriangle },
  { key: 'mute', label: 'Заглушить', icon: VolumeX },
  { key: 'delete', label: 'Удалить', icon: Trash2 },
];

export default function ModerationPanel({ onClose }: ModerationPanelProps) {
  const [tab, setTab] = useState<Tab>('settings');
  const [autoModeration, setAutoModeration] = useState(true);
  const [spamThreshold, setSpamThreshold] = useState(60);
  const [toxicityThreshold, setToxicityThreshold] = useState(70);
  const [nsfwThreshold, setNsfwThreshold] = useState(80);
  const [modAction, setModAction] = useState<ModerationAction>('warn');
  const [whitelist, setWhitelist] = useState<string[]>(['Алексей', 'Мария', 'Дмитрий']);
  const [newWhitelistUser, setNewWhitelistUser] = useState('');
  const [logs] = useState<ModerationLog[]>([
    { id: '1', username: 'User123', action: 'Предупреждение', reason: 'Спам в чате', severity: 'medium', timestamp: '2025-01-14T18:30:00' },
    { id: '2', username: 'ToxicUser', action: 'Заглушён', reason: 'Токсичное поведение', severity: 'high', timestamp: '2025-01-13T14:20:00' },
    { id: '3', username: 'Bot42', action: 'Удалено', reason: 'NSFW контент', severity: 'critical', timestamp: '2025-01-12T09:15:00' },
    { id: '4', username: 'Spammer99', action: 'Предупреждение', reason: 'Рекламные ссылки', severity: 'low', timestamp: '2025-01-11T16:45:00' },
  ]);

  const stats = { totalScanned: 12847, flaggedMessages: 234, actionsTaken: 89, activeUsers: 156 };

  const addWhitelistUser = useCallback(() => {
    if (!newWhitelistUser.trim()) return;
    setWhitelist(prev => [...prev, newWhitelistUser.trim()]);
    setNewWhitelistUser('');
    toast.success('Пользователь добавлен в белый список');
  }, [newWhitelistUser]);

  const removeWhitelistUser = useCallback((name: string) => {
    setWhitelist(prev => prev.filter(u => u !== name));
  }, []);

  const SliderInput = ({ label, value, onChange, color }: { label: string; value: number; onChange: (v: number) => void; color: string }) => (
    <div>
      <div className="flex items-center justify-between px-1 pb-1.5">
        <span className="text-[10px] text-white/40">{label}</span>
        <span className="text-[10px] text-white/50 font-mono">{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value} onChange={e => onChange(Number(e.target.value))}
        className={`w-full h-1.5 rounded-full appearance-none bg-white/[0.08] cursor-pointer`}
        style={{ accentColor: color }} />
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
            <Shield size={15} className="text-red-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Модерация</h2>
        </div>
        <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <X size={15} className="text-white/40" />
        </motion.button>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 flex gap-1 px-3 py-2 border-b border-white/[0.06]">
        <button onClick={() => setTab('settings')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${tab === 'settings' ? 'bg-white/[0.08] text-white/80' : 'text-white/40 hover:bg-white/[0.04]'}`}>
          <Settings size={12} className="inline mr-1.5" />Настройки
        </button>
        <button onClick={() => setTab('log')} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${tab === 'log' ? 'bg-white/[0.08] text-white/80' : 'text-white/40 hover:bg-white/[0.04]'}`}>
          <List size={12} className="inline mr-1.5" />Журнал
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {tab === 'settings' ? (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Просканировано', value: stats.totalScanned.toLocaleString(), icon: Eye, color: 'text-blue-400/60' },
                { label: 'Помечено', value: stats.flaggedMessages.toString(), icon: AlertTriangle, color: 'text-yellow-400/60' },
                { label: 'Действий', value: stats.actionsTaken.toString(), icon: Shield, color: 'text-green-400/60' },
                { label: 'Активных', value: stats.activeUsers.toString(), icon: Users, color: 'text-violet-400/60' },
              ].map(s => (
                <div key={s.label} className="p-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-center gap-1.5 mb-1">
                    <s.icon size={11} className={s.color} />
                    <span className="text-[9px] text-white/30">{s.label}</span>
                  </div>
                  <p className="text-sm text-white/70 font-semibold">{s.value}</p>
                </div>
              ))}
            </div>

            {/* Auto moderation toggle */}
            <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03]">
              <div className="flex items-center gap-3">
                <Shield size={15} className={autoModeration ? 'text-red-400/70' : 'text-white/25'} />
                <div>
                  <span className="text-xs text-white/60 block">Авто-модерация</span>
                  <span className="text-[10px] text-white/25">{autoModeration ? 'Включена' : 'Выключена'}</span>
                </div>
              </div>
              <div onClick={() => setAutoModeration(v => !v)}
                className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer ${autoModeration ? 'bg-red-500/50' : 'bg-white/[0.08]'}`}>
                <motion.div animate={{ x: autoModeration ? 18 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  className="w-4 h-4 rounded-full bg-white/80 absolute top-0.5" />
              </div>
            </div>

            {/* Thresholds */}
            <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-3">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block">Пороги чувствительности</label>
              <SliderInput label="Спам" value={spamThreshold} onChange={setSpamThreshold} color="#f59e0b" />
              <SliderInput label="Токсичность" value={toxicityThreshold} onChange={setToxicityThreshold} color="#ef4444" />
              <SliderInput label="NSFW" value={nsfwThreshold} onChange={setNsfwThreshold} color="#8b5cf6" />
            </div>

            {/* Action selector */}
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Действие</label>
              <div className="grid grid-cols-3 gap-1.5">
                {ACTION_OPTIONS.map(a => {
                  const Icon = a.icon;
                  return (
                    <motion.button key={a.key} onClick={() => setModAction(a.key)}
                      className={`p-2.5 rounded-xl border text-center transition-all ${modAction === a.key ? 'bg-white/[0.08] border-white/[0.12]' : 'bg-white/[0.03] border-white/[0.06] hover:bg-white/[0.05]'}`}
                      whileTap={{ scale: 0.97 }}>
                      <Icon size={14} className={`mx-auto mb-1 ${modAction === a.key ? 'text-white/70' : 'text-white/30'}`} />
                      <p className={`text-[10px] ${modAction === a.key ? 'text-white/70' : 'text-white/40'}`}>{a.label}</p>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* Whitelist */}
            <div>
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Белый список</label>
              <div className="flex gap-2 mb-2">
                <input type="text" value={newWhitelistUser} onChange={e => setNewWhitelistUser(e.target.value)} placeholder="Имя пользователя..."
                  className="flex-1 h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                  onKeyDown={e => e.key === 'Enter' && addWhitelistUser()} />
                <motion.button onClick={addWhitelistUser} className="px-3 h-8 rounded-xl bg-green-500/20 border border-green-500/20 text-green-400/70" whileTap={{ scale: 0.95 }}>
                  <Plus size={14} />
                </motion.button>
              </div>
              <div className="space-y-0.5">
                {whitelist.map(user => (
                  <div key={user} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                    <div className="w-6 h-6 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                      <Check size={10} className="text-green-400/60" />
                    </div>
                    <span className="text-xs text-white/50 flex-1">{user}</span>
                    <button onClick={() => removeWhitelistUser(user)} className="p-1 rounded hover:bg-white/[0.08]">
                      <X size={10} className="text-red-400/40" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* Log tab */
          <div className="space-y-1.5">
            {logs.map(log => {
              const sev = SEVERITY_COLORS[log.severity];
              return (
                <motion.div key={log.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[9px] border ${sev.bg} ${sev.text}`}>{sev.label}</span>
                      <span className="text-xs text-white/60 font-medium">{log.username}</span>
                    </div>
                    <span className="text-[9px] text-white/20">{new Date(log.timestamp).toLocaleString('ru-RU')}</span>
                  </div>
                  <p className="text-[10px] text-white/40">{log.action}: {log.reason}</p>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}