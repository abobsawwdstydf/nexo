import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Download, Send, Loader2, RefreshCw, Wand2, Check } from 'lucide-react';
import { api } from '../lib/api';

interface AIImageGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onSend?: (imageUrl: string, prompt: string) => void;
}

const STYLE_PRESETS = [
  { label: 'Реалистичный', value: 'photorealistic, high quality, detailed' },
  { label: 'Аниме', value: 'anime style, manga, japanese art' },
  { label: 'Масло', value: 'oil painting, artistic, canvas texture' },
  { label: 'Пиксель', value: 'pixel art, 8-bit, retro game style' },
  { label: 'Акварель', value: 'watercolor painting, soft colors' },
  { label: 'Киберпанк', value: 'cyberpunk, neon lights, futuristic city' },
];

export default function AIImageGenerator({ isOpen, onClose, onSend }: AIImageGeneratorProps) {
  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    setGeneratedUrl(null);

    const fullPrompt = selectedStyle ? `${prompt}, ${selectedStyle}` : prompt;

    try {
      const result = await api.generateImage(fullPrompt);
      setGeneratedUrl(result.url);
    } catch (e: any) {
      setError(e.message || 'Ошибка генерации');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedStyle]);

  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!generatedUrl || !onSend || isSending) return;
    setIsSending(true);
    try {
      await onSend(generatedUrl, prompt);
    } finally {
      setIsSending(false);
    }
  };

  const handleDownload = () => {
    if (!generatedUrl) return;
    const a = document.createElement('a');
    a.href = generatedUrl;
    a.download = `nexo-ai-${Date.now()}.png`;
    a.target = '_blank';
    a.click();
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="w-full max-w-lg bg-[#0a0a0f] rounded-2xl border border-white/10 shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Wand2 size={16} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">AI Генерация изображений</h3>
              <p className="text-xs text-zinc-500">Нексо AI • Нексо НУче</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Prompt input */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Описание изображения</label>
            <textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              placeholder="Опишите что хотите сгенерировать..."
              rows={3}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 resize-none"
              onKeyDown={e => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) generate();
              }}
            />
          </div>

          {/* Style presets */}
          <div>
            <label className="text-xs text-zinc-500 mb-2 block">Стиль</label>
            <div className="flex flex-wrap gap-2">
              {STYLE_PRESETS.map(s => (
                <button
                  key={s.value}
                  onClick={() => setSelectedStyle(selectedStyle === s.value ? '' : s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    selectedStyle === s.value
                      ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                      : 'bg-white/5 text-zinc-400 border border-white/10 hover:bg-white/10'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Generated image */}
          <AnimatePresence>
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center gap-3 py-8"
              >
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center">
                    <Sparkles size={28} className="text-purple-400 animate-pulse" />
                  </div>
                  <div className="absolute inset-0 rounded-2xl border-2 border-purple-500/30 animate-ping" />
                </div>
                <p className="text-sm text-zinc-400">Генерирую изображение...</p>
              </motion.div>
            )}

            {generatedUrl && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative rounded-xl overflow-hidden"
              >
                <img
                  src={generatedUrl}
                  alt={prompt}
                  className="w-full rounded-xl object-cover max-h-[300px]"
                />
              </motion.div>
            )}

            {error && !isGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={generate}
              disabled={!prompt.trim() || isGenerating}
              className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <Loader2 size={16} className="animate-spin" />
              ) : generatedUrl ? (
                <RefreshCw size={16} />
              ) : (
                <Sparkles size={16} />
              )}
              {isGenerating ? 'Генерирую...' : generatedUrl ? 'Ещё раз' : 'Сгенерировать'}
            </button>

            {generatedUrl && (
              <>
                <button
                  onClick={handleDownload}
                  className="px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
                  title="Скачать"
                >
                  <Download size={16} />
                </button>
                {onSend && (
                  <button
                    onClick={handleSend}
                    disabled={isSending}
                    className="px-4 py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:opacity-60 text-white transition-colors flex items-center gap-1.5"
                    title="Отправить в чат"
                  >
                    {isSending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
