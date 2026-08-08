import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Flag, MessageSquare, BadgeCheck, RefreshCw, Send, ShieldAlert } from 'lucide-react';
import { api } from '../lib/api';
import type { AdminReport, AdminFeedbackTicket } from '../lib/api/admin';
import { toast } from '../lib/toast';

type Tab = 'reports' | 'feedback' | 'badges';

interface AdminPanelProps {
  onClose: () => void;
}

function SectionHeader({ title, icon: Icon, onRefresh, loading }: {
  title: string;
  icon: typeof Flag;
  onRefresh: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
        <Icon size={16} className="text-accent" />
        {title}
      </h3>
      <button
        onClick={onRefresh}
        className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/[0.08] transition-colors"
      >
        <motion.span
          animate={loading ? { rotate: 360 } : {}}
          transition={loading ? { repeat: Infinity, duration: 0.8, ease: 'linear' } : {}}
          className="block"
        >
          <RefreshCwIcon />
        </motion.span>
      </button>
    </div>
  );
}

function RefreshCwIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [tab, setTab] = useState<Tab>('reports');
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [feedback, setFeedback] = useState<AdminFeedbackTicket[]>([]);
  const [loading, setLoading] = useState(false);

  // Badge form
  const [badgeTarget, setBadgeTarget] = useState('');
  const [badgeType, setBadgeType] = useState('verified');
  const [badgeUrl, setBadgeUrl] = useState('');

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.getAdminReports();
      setReports(items);
    } catch (err) {
      console.error('Failed to load reports:', err);
      toast.error('Не удалось загрузить жалобы');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    try {
      const items = await api.getAdminFeedback();
      setFeedback(items);
    } catch (err) {
      console.error('Failed to load feedback:', err);
      toast.error('Не удалось загрузить обращения');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'reports') loadReports();
    if (tab === 'feedback') loadFeedback();
  }, [tab, loadReports, loadFeedback]);

  const handleReply = async (chatId: string) => {
    const content = window.prompt('Ответ пользователю:');
    if (!content || !content.trim()) return;
    try {
      await api.adminReplyFeedback(chatId, content.trim());
      toast.success('Ответ отправлен');
      loadFeedback();
    } catch (err) {
      console.error('Failed to reply:', err);
      toast.error('Не удалось отправить ответ');
    }
  };

  const handleGrantBadge = async () => {
    if (!badgeTarget.trim() || !badgeUrl.trim()) {
      toast.error('Укажи ID пользователя и URL бейджа');
      return;
    }
    try {
      await api.adminSetBadge({ targetId: badgeTarget.trim(), badgeType, badgeUrl: badgeUrl.trim() });
      toast.success('Бейдж выдан');
      setBadgeTarget('');
      setBadgeUrl('');
    } catch (err) {
      console.error('Failed to grant badge:', err);
      toast.error('Не удалось выдать бейдж');
    }
  };

  const handleClearBadge = async () => {
    if (!badgeTarget.trim()) {
      toast.error('Укажи ID пользователя');
      return;
    }
    try {
      await api.adminClearBadge(badgeTarget.trim());
      toast.success('Бейдж снят');
      setBadgeTarget('');
    } catch (err) {
      console.error('Failed to clear badge:', err);
      toast.error('Не удалось снять бейдж');
    }
  };

  const TABS: { id: Tab; label: string; icon: typeof Flag }[] = [
    { id: 'reports', label: 'Жалобы', icon: Flag },
    { id: 'feedback', label: 'Обратная связь', icon: MessageSquare },
    { id: 'badges', label: 'Бейджи', icon: BadgeCheck },
  ];

  return (
    <motion.div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.94, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 16 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="relative w-full max-w-2xl max-h-[80vh] flex flex-col rounded-3xl liquid-glass-strong border border-white/[0.1] shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500/25 to-orange-500/25 border border-red-500/25 flex items-center justify-center">
            <ShieldAlert size={17} className="text-red-300" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-white">Панель администратора</h2>
            <p className="text-[11px] text-white/40">Модерация платформы</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 px-5 pt-3 pb-2 border-b border-white/[0.06] overflow-x-auto no-scrollbar">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
                tab === t.id
                  ? 'bg-white/[0.12] text-white border border-white/[0.1]'
                  : 'bg-white/[0.04] text-white/50 hover:text-white/70 border border-transparent'
              }`}
            >
              <t.icon size={13} />
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'reports' && (
            <div>
              <SectionHeader title="Жалобы на чаты и модерация" icon={Flag} onRefresh={loadReports} loading={loading} />
              {reports.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-10">Жалоб пока нет</p>
              ) : (
                <div className="space-y-2">
                  {reports.map(r => (
                    <div key={r.id} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">
                          {r.chatName || '(чат удалён)'}
                        </span>
                        <span className="text-[11px] text-white/30 flex-shrink-0">
                          {new Date(r.createdAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        Пожаловался: <span className="text-white/70">{r.actorName || r.actorId}</span>
                        {' · '}Тип: <span className="text-white/70">{r.action}</span>
                        {r.duration > 0 && <> · <span className="text-white/70">{r.duration} мин</span></>}
                      </div>
                      {r.reason && (
                        <p className="mt-2 text-xs text-white/60 bg-white/[0.04] rounded-xl px-3 py-2">
                          «{r.reason}»
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'feedback' && (
            <div>
              <SectionHeader title="Обращения в поддержку" icon={MessageSquare} onRefresh={loadFeedback} loading={loading} />
              {feedback.length === 0 ? (
                <p className="text-xs text-white/30 text-center py-10">Обращений пока нет</p>
              ) : (
                <div className="space-y-2">
                  {feedback.map(t => (
                    <div key={t.chatId} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-white">{t.name || 'Без названия'}</span>
                        <span className="text-[11px] text-white/30 flex-shrink-0">
                          {new Date(t.lastAt).toLocaleString('ru-RU')}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/40">
                        Сообщений: {t.messageCount}
                        {t.lastMessage?.content && (
                          <p className="mt-1.5 text-white/60 bg-white/[0.05] rounded-xl px-3 py-2 line-clamp-2">
                            {t.lastMessage.content}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleReply(t.chatId)}
                        className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-accent/15 hover:bg-accent/25 text-accent text-xs font-medium transition-colors"
                      >
                        <MessageSquare size={12} />
                        Ответить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'badges' && (
            <div>
              <SectionHeader title="Выдача бейджей" icon={BadgeCheck} onRefresh={() => {}} loading={false} />
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                <div>
                  <label className="block text-[11px] text-white/40 mb-1">ID пользователя (targetId)</label>
                  <input
                    value={badgeTarget}
                    onChange={e => setBadgeTarget(e.target.value)}
                    placeholder="user_id"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-white/40 mb-1">Тип бейджа</label>
                  <select
                    value={badgeType}
                    onChange={e => setBadgeType(e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white outline-none focus:border-white/30"
                  >
                    {['verified', 'premium', 'developer', 'moderator'].map(t => (
                      <option key={t} value={t} className="bg-[#12121a]">{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] text-white/40 mb-1">URL бейджа</label>
                  <input
                    value={badgeUrl}
                    onChange={e => setBadgeUrl(e.target.value)}
                    placeholder="https://img.darkheavens.ru/badges/verified.png"
                    className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none focus:border-white/30"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleGrantBadge}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-xs font-semibold transition-colors"
                  >
                    <BadgeCheck size={13} />
                    Выдать бейдж
                  </button>
                  <button
                    onClick={handleClearBadge}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-semibold transition-colors"
                  >
                    <SparkleIcon />
                    Снять бейдж
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function SparkleIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
    </svg>
  );
}

function AlertTriangle() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}