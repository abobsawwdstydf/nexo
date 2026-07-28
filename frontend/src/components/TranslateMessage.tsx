import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Languages, Copy, Check, Loader, X } from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface TranslateMessageProps {
  messageId: string;
  content: string;
  onTranslate?: (translated: string) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { code: 'auto', name: 'Автоопределение' },
  { code: 'ru', name: 'Русский' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'it', name: 'Italiano' },
  { code: 'pt', name: 'Português' },
  { code: 'zh', name: '中文' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ar', name: 'العربية' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'tr', name: 'Türkçe' },
  { code: 'nl', name: 'Nederlands' },
  { code: 'pl', name: 'Polski' },
  { code: 'uk', name: 'Українська' },
  { code: 'be', name: 'Беларуская' },
  { code: 'th', name: 'ไทย' },
  { code: 'vi', name: 'Tiếng Việt' },
  { code: 'id', name: 'Bahasa Indonesia' },
  { code: 'sv', name: 'Svenska' },
  { code: 'fi', name: 'Suomi' },
  { code: 'cs', name: 'Čeština' },
];

export default function TranslateMessage({ messageId, content, onTranslate, onClose }: TranslateMessageProps) {
  const [language, setLanguage] = useState('auto');
  const [translated, setTranslated] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  const handleTranslate = useCallback(async () => {
    setLoading(true);
    setError('');
    setTranslated('');
    try {
      const targetLang = language === 'auto' ? 'тот язык, на котором написано сообщение, и переведи на русский' : LANGUAGES.find(l => l.code === language)?.name || language;
      const res = await api.aiChat([
        { role: 'system', content: `Ты переводчик. Переведи текст на ${targetLang}. Отвечай ТОЛЬКО переведённым текстом, без пояснений.` },
        { role: 'user', content },
      ]);
      setTranslated(res.text);
      onTranslate?.(res.text);
    } catch {
      setError('Ошибка перевода');
    } finally {
      setLoading(false);
    }
  }, [language, content, onTranslate]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(translated);
    setCopied(true);
    toast.success('Перевод скопирован');
    setTimeout(() => setCopied(false), 2000);
  }, [translated]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="absolute bottom-full mb-2 left-0 z-50 w-72 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl p-3 shadow-xl"
      onClick={e => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Languages size={12} className="text-indigo-400/60" />
          <span className="text-[10px] text-white/50 font-medium">Перевод</span>
        </div>
        <button onClick={onClose} className="p-0.5 rounded hover:bg-white/[0.1] transition-colors">
          <X size={11} className="text-white/30" />
        </button>
      </div>

      {/* Language selector */}
      <select value={language} onChange={e => setLanguage(e.target.value)}
        className="w-full h-8 px-2 mb-2 text-[10px] bg-white/[0.06] border border-white/[0.08] rounded-lg text-white/70 outline-none cursor-pointer">
        {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
      </select>

      {/* Translate button */}
      {!translated && !loading && !error && (
        <motion.button onClick={handleTranslate}
          className="w-full py-2 rounded-xl bg-indigo-500/15 border border-indigo-500/20 text-[10px] text-indigo-400/70 font-medium hover:bg-indigo-500/25 transition-colors"
          whileTap={{ scale: 0.98 }}>
          Перевести
        </motion.button>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center gap-2 py-4">
          <Loader size={12} className="text-indigo-400/60 animate-spin" />
          <span className="text-[10px] text-white/30">Перевод...</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="text-center py-3">
          <p className="text-[10px] text-red-400/60">{error}</p>
          <button onClick={handleTranslate} className="text-[10px] text-white/30 hover:text-white/50 mt-1">Повторить</button>
        </div>
      )}

      {/* Result */}
      <AnimatePresence>
        {translated && !loading && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <div className="p-2 rounded-lg bg-white/[0.04] border border-white/[0.06] mb-2">
              <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap">{translated}</p>
            </div>
            <div className="flex gap-1.5">
              <motion.button onClick={handleCopy}
                className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/[0.06] text-[10px] text-white/40 hover:bg-white/[0.1] transition-colors"
                whileTap={{ scale: 0.95 }}>
                {copied ? <><Check size={10} className="text-green-400/70" />Скопировано</> : <><Copy size={10} />Копировать</>}
              </motion.button>
              <motion.button onClick={handleTranslate}
                className="px-3 py-1.5 rounded-lg bg-white/[0.06] text-[10px] text-white/40 hover:bg-white/[0.1] transition-colors"
                whileTap={{ scale: 0.95 }}>
                ↻
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}