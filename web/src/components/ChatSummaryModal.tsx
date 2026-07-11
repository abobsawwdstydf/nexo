import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Loader2, Copy, Check, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import BottomSheet from './BottomSheet';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return isMobile;
}

interface ChatSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  chatName: string;
}

export default function ChatSummaryModal({ isOpen, onClose, chatId, chatName }: ChatSummaryModalProps) {
  const isMobile = useIsMobile();
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [messageCount, setMessageCount] = useState(50);
  const [savedSummaries, setSavedSummaries] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadSavedSummaries();
      generateSummary();
    }
  }, [isOpen, chatId]);

  const loadSavedSummaries = async () => {
    try {
      const summaries = await api.get(`/ai/summaries/${chatId}`);
      setSavedSummaries(summaries);
    } catch (error) {
      console.error('Failed to load saved summaries:', error);
    }
  };

  const generateSummary = async () => {
    setIsLoading(true);
    setError(null);
    setSummary(null);

    try {
      const result = await api.getChatSummary(chatId, messageCount);
      setSummary(result.summary);
      // Обновляем список сохранённых резюме
      loadSavedSummaries();
    } catch (e: any) {
      setError(e.message || 'Ошибка генерации резюме');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (summary) {
      navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const summaryContent = (
    <>
      {/* Message count selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-zinc-500 whitespace-nowrap">Последних сообщений:</label>
        <div className="flex gap-2">
          {[25, 50, 100, 200].map(n => (
            <button
              key={n}
              onClick={() => setMessageCount(n)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                messageCount === n
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4 py-10"
          >
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                <Sparkles size={24} className="text-blue-400 animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-zinc-400">Анализирую переписку...</p>
          </motion.div>
        )}

        {summary && !isLoading && (
          <motion.div
            key="summary"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="p-4 rounded-xl bg-white/5 border border-white/10 max-h-[300px] overflow-y-auto">
              <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{summary}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-sm transition-colors"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
              <button
                onClick={generateSummary}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm transition-colors"
              >
                <Sparkles size={14} />
                Обновить
              </button>
              {savedSummaries.length > 0 && (
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-sm transition-colors"
                >
                  <FileText size={14} />
                  История ({savedSummaries.length})
                </button>
              )}
            </div>

            {showHistory && savedSummaries.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2 max-h-[200px] overflow-y-auto"
              >
                <p className="text-xs text-zinc-500 font-medium">Предыдущие резюме:</p>
                {savedSummaries.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setSummary(s.summary)}
                    className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/10 text-left transition-colors"
                  >
                    <p className="text-xs text-zinc-400 mb-1">
                      {new Date(s.createdAt).toLocaleDateString('ru-RU')} • {s.messageCount} сообщений
                    </p>
                    <p className="text-sm text-zinc-300 line-clamp-2">{s.summary}</p>
                  </button>
                ))}
              </motion.div>
            )}
          </motion.div>
        )}

        {error && !isLoading && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
              {error}
            </div>
            <button
              onClick={generateSummary}
              className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-sm transition-colors"
            >
              Попробовать снова
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  if (!isOpen) return null;

  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Резюме чата">
        <div className="p-5 space-y-4">
          {summaryContent}
        </div>
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <FileText size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Резюме чата</h3>
              <p className="text-xs text-zinc-500 truncate max-w-[200px]">{chatName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {summaryContent}
        </div>
      </motion.div>
    </motion.div>
  );
}
