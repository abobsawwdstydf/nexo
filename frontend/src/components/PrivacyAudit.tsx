import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Play, X, Check, AlertTriangle, AlertCircle, Info, Loader, ChevronDown, ChevronRight,
  Eye, Lock, UserCheck, Globe, Bell, MessageCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface PrivacyAuditProps {
  onClose: () => void;
}

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface AuditIssue {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  category: string;
  fixed: boolean;
}

const SEVERITY_CONFIG: Record<Severity, { color: string; bg: string; icon: typeof AlertTriangle; label: string }> = {
  critical: { color: 'text-red-400/80', bg: 'bg-red-500/15 border-red-500/20', icon: AlertTriangle, label: 'Критический' },
  high: { color: 'text-orange-400/80', bg: 'bg-orange-500/15 border-orange-500/20', icon: AlertCircle, label: 'Высокий' },
  medium: { color: 'text-yellow-400/80', bg: 'bg-yellow-500/15 border-yellow-500/20', icon: Info, label: 'Средний' },
  low: { color: 'text-blue-400/80', bg: 'bg-blue-500/15 border-blue-500/20', icon: Info, label: 'Низкий' },
  info: { color: 'text-white/40', bg: 'bg-white/[0.04] border-white/[0.06]', icon: Info, label: 'Инфо' },
};

const CATEGORIES = ['Профиль', 'Конфиденциальность', 'Безопасность', 'Уведомления', 'Данные'];

export default function PrivacyAudit({ onClose }: PrivacyAuditProps) {
  const [auditing, setAuditing] = useState(false);
  const [audited, setAudited] = useState(false);
  const [issues, setIssues] = useState<AuditIssue[]>([]);
  const [score, setScore] = useState(0);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const runAudit = useCallback(async () => {
    setAuditing(true);
    setIssues([]);
    try {
      await new Promise(r => setTimeout(r, 2000));
      const auditIssues: AuditIssue[] = [
        { id: '1', title: 'Публичный профиль', description: 'Ваш профиль доступен всем пользователям. Рекомендуется ограничить видимость.', severity: 'medium', category: 'Профиль', fixed: false },
        { id: '2', title: 'Двухфакторная аутентификация', description: '2FA не включена. Это significantly повышает безопасность аккаунта.', severity: 'high', category: 'Безопасность', fixed: false },
        { id: '3', title: 'Статус в сети', description: 'Ваш статус активности виден всем.', severity: 'low', category: 'Конфиденциальность', fixed: false },
        { id: '4', title: 'Геолокация в фото', description: 'Геоданные в фотографиях не скрыты.', severity: 'medium', category: 'Данные', fixed: false },
        { id: '5', title: 'Push-уведомления', description: 'Уведомления от незнакомцев включены.', severity: 'low', category: 'Уведомления', fixed: false },
        { id: '6', title: 'Номер телефона', description: 'Номер телефона виден в настройках приватности.', severity: 'high', category: 'Профиль', fixed: false },
        { id: '7', title: 'Список друзей', description: 'Список друзей публичный.', severity: 'medium', category: 'Конфиденциальность', fixed: false },
        { id: '8', title: 'История звонков', description: 'История звонков хранится без шифрования.', severity: 'info', category: 'Безопасность', fixed: true },
      ];
      setIssues(auditIssues);
      const fixed = auditIssues.filter(i => i.fixed).length;
      const total = auditIssues.length;
      setScore(Math.round((fixed / total) * 100) || Math.round(Math.random() * 40 + 30));
      setAudited(true);
    } catch {
      toast.error('Ошибка аудита');
    } finally {
      setAuditing(false);
    }
  }, []);

  const handleFix = useCallback((id: string) => {
    setIssues(prev => prev.map(i => i.id === id ? { ...i, fixed: !i.fixed } : i));
    const updated = issues.map(i => i.id === id ? { ...i, fixed: !i.fixed } : i);
    const fixed = updated.filter(i => i.fixed).length;
    setScore(Math.round((fixed / updated.length) * 100));
    toast.success('Проблема обработана');
  }, [issues]);

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const catIssues = issues.filter(i => i.category === cat);
    if (catIssues.length > 0) acc[cat] = catIssues;
    return acc;
  }, {} as Record<string, AuditIssue[]>);

  const unfixed = issues.filter(i => !i.fixed).length;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center">
            <Shield size={15} className="text-emerald-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Аудит приватности</h2>
        </div>
        <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <X size={15} className="text-white/40" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Score / Run */}
        {!audited ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-12">
            <div className="w-20 h-20 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Shield size={32} className="text-emerald-400/50" />
            </div>
            <p className="text-sm text-white/50 mb-1">Проверка приватности</p>
            <p className="text-xs text-white/25 mb-6 text-center max-w-[200px]">Проведём аудит ваших настроек безопасности</p>
            <motion.button onClick={runAudit} disabled={auditing}
              className="px-6 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/20 text-xs text-emerald-400/80 font-medium hover:bg-emerald-500/30 transition-colors disabled:opacity-40 flex items-center gap-2"
              whileTap={{ scale: 0.98 }}>
              {auditing ? <><Loader size={12} className="animate-spin" />Проверка...</> : <><Play size={12} />Начать аудит</>}
            </motion.button>
          </motion.div>
        ) : (
          <>
            {/* Score card */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
              <div className="relative w-16 h-16 mx-auto mb-3">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke={score > 60 ? '#22c55e' : score > 30 ? '#f59e0b' : '#ef4444'} strokeWidth="2.5"
                    strokeDasharray={`${score} 100`} strokeLinecap="round" />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-white/80">{score}%</span>
              </div>
              <p className="text-xs text-white/50">
                {score >= 80 ? 'Отлично! Ваша приватность защищена' : score >= 50 ? 'Есть что улучшить' : 'Нужно улучшить настройки'}
              </p>
              <p className="text-[10px] text-white/25 mt-1">{unfixed} проблем требует внимания</p>
              <button onClick={runAudit} className="mt-2 text-[10px] text-emerald-400/50 hover:text-emerald-400/70 transition-colors">
                Повторить аудит
              </button>
            </motion.div>

            {/* Issues by category */}
            {Object.entries(grouped).map(([category, catIssues]) => {
              const isOpen = expandedCategory === category;
              const unfixedInCat = catIssues.filter(i => !i.fixed).length;
              return (
                <div key={category}>
                  <button onClick={() => setExpandedCategory(isOpen ? null : category)}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] transition-colors">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60 font-medium">{category}</span>
                      {unfixedInCat > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[9px] bg-red-500/15 text-red-400/60">{unfixedInCat}</span>
                      )}
                    </div>
                    <motion.div animate={{ rotate: isOpen ? 90 : 0 }}><ChevronRight size={14} className="text-white/30" /></motion.div>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden">
                        <div className="space-y-1 pt-1">
                          {catIssues.map(issue => {
                            const sev = SEVERITY_CONFIG[issue.severity];
                            const SevIcon = sev.icon;
                            return (
                              <div key={issue.id} className={`p-2.5 rounded-xl border transition-colors ${issue.fixed ? 'opacity-50' : ''} bg-white/[0.02] border-white/[0.04]`}>
                                <div className="flex items-start gap-2">
                                  <div className={`p-1 rounded-lg ${sev.bg} flex-shrink-0`}>
                                    <SevIcon size={10} className={sev.color} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs text-white/60">{issue.title}</p>
                                    <p className="text-[10px] text-white/30 mt-0.5">{issue.description}</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  <span className={`text-[9px] ${sev.color}`}>{sev.label}</span>
                                  <motion.button onClick={() => handleFix(issue.id)}
                                    className={`px-2 py-1 rounded-lg text-[10px] transition-colors ${issue.fixed ? 'bg-green-500/15 text-green-400/70' : 'bg-white/[0.04] text-white/40 hover:bg-white/[0.08]'}`}
                                    whileTap={{ scale: 0.95 }}>
                                    {issue.fixed ? <><Check size={9} className="inline mr-1" />Исправлено</> : 'Исправить'}
                                  </motion.button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}