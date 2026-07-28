import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Globe, Search, X, Loader, CheckCircle, AlertCircle, Clock,
  ExternalLink, Bookmark, History, RefreshCw, Trash2, Send,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

type BrowseStatus = 'idle' | 'searching' | 'running' | 'completed' | 'failed';

interface BrowseResult {
  id: string;
  query: string;
  summary: string;
  sources: Array<{ title: string; url: string }>;
  status: BrowseStatus;
  createdAt: string;
}

interface AIBrowsePanelProps {
  onClose: () => void;
  onShareToChat?: (result: BrowseResult) => void;
}

const PROGRESS_STEPS = [
  'Анализ запроса...',
  'Поиск информации...',
  'Сбор данных...',
  'Обработка результатов...',
  'Формирование ответа...',
];

export default function AIBrowsePanel({ onClose, onShareToChat }: AIBrowsePanelProps) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<BrowseStatus>('idle');
  const [result, setResult] = useState<BrowseResult | null>(null);
  const [history, setHistory] = useState<BrowseResult[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = useCallback(() => {
    setProgressStep(0);
    let step = 0;
    progressTimer.current = setInterval(() => {
      step = (step + 1) % PROGRESS_STEPS.length;
      setProgressStep(step);
    }, 2000);
  }, []);

  const stopProgress = useCallback(() => {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
  }, []);

  useEffect(() => () => stopProgress(), [stopProgress]);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    const q = query.trim();
    setStatus('searching');
    startProgress();
    try {
      const res = await api.aiChat([
        { role: 'system', content: 'Ты AI-браузер. Ищи информацию и возвращай структурированный ответ с источниками на русском.' },
        { role: 'user', content: `Найди: ${q}` },
      ]);
      const newResult: BrowseResult = {
        id: Date.now().toString(),
        query: q,
        summary: res.text,
        sources: [],
        status: 'completed',
        createdAt: new Date().toISOString(),
      };
      setResult(newResult);
      setHistory(prev => [newResult, ...prev].slice(0, 50));
      setStatus('completed');
    } catch {
      setResult({ id: Date.now().toString(), query: q, summary: '', sources: [], status: 'failed', createdAt: new Date().toISOString() });
      setStatus('failed');
    } finally {
      stopProgress();
    }
  }, [query, startProgress, stopProgress]);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/20 flex items-center justify-center">
            <Globe size={15} className="text-cyan-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">AI-браузер</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => setShowHistory(v => !v)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} title="История">
            <History size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* History */}
      <AnimatePresence>
        {showHistory && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-white/40">История</span>
                {history.length > 0 && (
                  <button onClick={() => setHistory([])} className="text-[10px] text-red-400/50 hover:text-red-400/80">Очистить</button>
                )}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {history.length === 0 ? (
                  <p className="text-xs text-white/20 text-center py-4">Нет истории</p>
                ) : history.map(h => (
                  <div key={h.id} className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-white/[0.04] group">
                    <button onClick={() => { setQuery(h.query); setResult(h); setShowHistory(false); }} className="flex-1 text-left min-w-0">
                      <p className="text-xs text-white/60 truncate">{h.query}</p>
                      <p className="text-[10px] text-white/25">{new Date(h.createdAt).toLocaleString('ru-RU')}</p>
                    </button>
                    <button onClick={() => setHistory(prev => prev.filter(x => x.id !== h.id))} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-white/[0.08] transition-all">
                      <Trash2 size={11} className="text-red-400/50" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input type="text" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Что найти в интернете?"
            className="w-full h-10 pl-9 pr-10 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]" />
          {query && (
            <button onClick={() => { setQuery(''); setResult(null); setStatus('idle'); }} className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/[0.08]">
              <X size={12} className="text-white/30" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {status === 'idle' && !result && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
              <Globe size={24} className="text-white/15" />
            </div>
            <p className="text-sm text-white/30 mb-1">AI-браузер</p>
            <p className="text-xs text-white/15 max-w-[200px]">Задайте вопрос, и AI найдёт информацию</p>
          </div>
        )}

        {(status === 'searching' || status === 'running') && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-4">
              <Loader size={20} className="text-cyan-400/70 animate-spin" />
            </div>
            <p className="text-xs text-white/40 mb-3">Поиск: {query}</p>
            <div className="w-full max-w-[240px] space-y-1.5">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${i <= progressStep ? 'bg-cyan-400' : 'bg-white/10'}`} />
                  <span className={`text-[10px] transition-colors duration-500 ${i <= progressStep ? 'text-white/50' : 'text-white/15'}`}>{step}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {status === 'failed' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-12">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-3">
              <AlertCircle size={20} className="text-red-400/70" />
            </div>
            <p className="text-sm text-red-400/70 mb-2">Ошибка поиска</p>
            <button onClick={handleSearch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/60 transition-colors">
              <RefreshCw size={12} />Повторить
            </button>
          </motion.div>
        )}

        {status === 'completed' && result && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={13} className="text-green-400/70" />
                <span className="text-xs text-green-400/70 font-medium">Найдено</span>
              </div>
              <p className="text-xs text-white/25 mb-1">Запрос: {result.query}</p>
              <div className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{result.summary}</div>
            </div>

            {result.sources.length > 0 && (
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
                <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2">Источники</p>
                <div className="space-y-1.5">
                  {result.sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors group">
                      <ExternalLink size={11} className="text-white/20 group-hover:text-cyan-400/60 flex-shrink-0" />
                      <span className="text-xs text-white/50 group-hover:text-white/70 truncate">{s.title || s.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              {onShareToChat && (
                <motion.button onClick={() => onShareToChat(result)} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-400/70 hover:bg-indigo-500/20 transition-colors" whileTap={{ scale: 0.97 }}>
                  <Send size={12} />В чат
                </motion.button>
              )}
              <motion.button onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(result.query)}`, '_blank')} className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.08] transition-colors" whileTap={{ scale: 0.97 }}>
                <ExternalLink size={12} />В браузере
              </motion.button>
              <motion.button onClick={() => { navigator.clipboard.writeText(result.summary); setCopiedSummary(true); toast.success('Скопировано'); setTimeout(() => setCopiedSummary(false), 2000); }} className="flex items-center justify-center px-3 py-2 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.08] transition-colors" whileTap={{ scale: 0.97 }}>
                {copiedSummary ? <CheckCircle size={12} className="text-green-400/70" /> : <Bookmark size={12} />}
              </motion.button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}