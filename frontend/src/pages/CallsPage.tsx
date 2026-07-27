import { motion } from 'framer-motion';
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, ArrowLeft, Clock } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';
import { cn } from '../components/ui';
import type { User } from '../lib/types';

interface CallsPageProps {
  onClose: () => void;
}

type CallType = 'incoming' | 'outgoing' | 'missed';
type CallMediaType = 'audio' | 'video';

interface CallRecord {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  type: CallType;
  media: CallMediaType;
  duration: number; // seconds
  timestamp: string;
}

// Мок данные — потом заменим на API
const MOCK_CALLS: CallRecord[] = [
  { id: '1', userId: '1', username: 'alex_dev', displayName: 'Алексей', avatarUrl: null, type: 'outgoing', media: 'video', duration: 342, timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: '2', userId: '2', username: 'maria_ui', displayName: 'Мария', avatarUrl: null, type: 'incoming', media: 'audio', duration: 1240, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString() },
  { id: '3', userId: '3', username: 'dmitry_ops', displayName: 'Дмитрий', avatarUrl: null, type: 'missed', media: 'audio', duration: 0, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
  { id: '4', userId: '1', username: 'alex_dev', displayName: 'Алексей', avatarUrl: null, type: 'incoming', media: 'video', duration: 890, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: '5', userId: '4', username: 'anna_pm', displayName: 'Анна', avatarUrl: null, type: 'outgoing', media: 'audio', duration: 0, timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
];

function formatDuration(seconds: number): string {
  if (seconds === 0) return 'Не дозвонился';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCallTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Вчера';
  } else if (diffDays < 7) {
    return d.toLocaleDateString('ru-RU', { weekday: 'long' });
  }
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function getCallIcon(type: CallType) {
  switch (type) {
    case 'incoming': return <PhoneIncoming size={16} className="text-emerald-400" />;
    case 'outgoing': return <PhoneOutgoing size={16} className="text-sky-400" />;
    case 'missed': return <PhoneMissed size={16} className="text-rose-400" />;
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function CallsPage({ onClose }: CallsPageProps) {
  const { user } = useAuthStore();
  const { openProfile, navigateTo } = useNavigationStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="h-full flex flex-col bg-[var(--color-bg)]"
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <button onClick={() => navigateTo('chat')} className="sm:hidden w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/5">
          <ArrowLeft size={20} className="text-[var(--color-text-secondary)]" />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/15 flex items-center justify-center">
            <Phone size={16} className="text-[var(--color-accent)]" />
          </div>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Звонки</h1>
        </div>
      </div>

      {/* Calls list */}
      <div className="flex-1 overflow-y-auto">
        {MOCK_CALLS.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mb-4">
              <Phone size={28} className="text-[var(--color-accent)]/40" />
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm">Нет звонков</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {MOCK_CALLS.map((call, i) => (
              <motion.button
                key={call.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => openProfile(call.userId)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
              >
                {/* Avatar */}
                <div className="w-11 h-11 rounded-full bg-[var(--color-surface)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)]">
                  <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{getInitials(call.displayName)}</span>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{call.displayName}</span>
                    {getCallIcon(call.type)}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] mt-0.5">
                    <Clock size={11} />
                    <span>{formatCallTime(call.timestamp)}</span>
                    {call.duration > 0 && <span>· {formatDuration(call.duration)}</span>}
                  </div>
                </div>

                {/* Call button */}
                <div className="w-9 h-9 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                  {call.media === 'video' ? (
                    <Video size={16} className="text-[var(--color-accent)]" />
                  ) : (
                    <Phone size={16} className="text-[var(--color-accent)]" />
                  )}
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
