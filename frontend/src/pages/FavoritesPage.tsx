import { motion } from 'framer-motion';
import { Star, ArrowLeft, MessageSquare, Image, FileText } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useNavigationStore } from '../stores/navigationStore';

interface FavoritesPageProps {
  onClose: () => void;
}

// Мок данные — потом заменим на API
const MOCK_FAVORITES = [
  { id: '1', type: 'text' as const, content: 'Не забудь купить молоко и хлеб', sender: 'Мария', chatName: 'Семья', timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString() },
  { id: '2', type: 'text' as const, content: 'API ключ для продакшена: sk-proj-***', sender: 'Алексей', chatName: 'Рабочий чат', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString() },
  { id: '3', type: 'image' as const, content: 'Фото с отпуска', sender: 'Дмитрий', chatName: 'Друзья', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() },
  { id: '4', type: 'file' as const, content: 'Договор_2024.pdf', sender: 'Анна', chatName: 'Рабочий чат', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString() },
  { id: '5', type: 'text' as const, content: 'Встреча в 15:00, не опаздывай!', sender: 'Елена', chatName: 'Команда', timestamp: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString() },
];

function getTypeIcon(type: string) {
  switch (type) {
    case 'image': return <Image size={14} className="text-emerald-400" />;
    case 'file': return <FileText size={14} className="text-sky-400" />;
    default: return <MessageSquare size={14} className="text-violet-400" />;
  }
}

function formatTime(iso: string): string {
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

export default function FavoritesPage({ onClose }: FavoritesPageProps) {
  const { user } = useAuthStore();
  const { navigateTo } = useNavigationStore();

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
          <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center">
            <Star size={16} className="text-yellow-400" />
          </div>
          <h1 className="text-lg font-bold text-[var(--color-text-primary)]">Избранное</h1>
        </div>
      </div>

      {/* Favorites list */}
      <div className="flex-1 overflow-y-auto">
        {MOCK_FAVORITES.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 flex items-center justify-center mb-4">
              <Star size={28} className="text-yellow-400/40" />
            </div>
            <p className="text-[var(--color-text-secondary)] text-sm">Нет избранных сообщений</p>
            <p className="text-[var(--color-text-secondary)] text-xs mt-1 opacity-60">Нажмите ⭐ на сообщении, чтобы сохранить его</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {MOCK_FAVORITES.map((fav, i) => (
              <motion.button
                key={fav.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-white/[0.03] transition-colors text-left"
              >
                {/* Type icon */}
                <div className="w-9 h-9 rounded-xl bg-[var(--color-surface)] flex items-center justify-center flex-shrink-0 border border-[var(--color-border)] mt-0.5">
                  {getTypeIcon(fav.type)}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-primary)] truncate">{fav.content}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-[var(--color-text-secondary)]">
                    <span className="font-medium">{fav.sender}</span>
                    <span>·</span>
                    <span>{fav.chatName}</span>
                    <span>·</span>
                    <span>{formatTime(fav.timestamp)}</span>
                  </div>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
