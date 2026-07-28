import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette, Upload, Check, RotateCcw, Save, X, Image, Droplets, Type as TypeIcon,
} from 'lucide-react';
import { toast } from '../lib/toast';

interface ChatThemeSelectorProps {
  onClose: () => void;
}

const COLOR_PALETTES = [
  { id: 'default', name: 'Стандарт', bubble: '#6366f1', bg: '#0a0a0f', text: '#fafafa' },
  { id: 'ocean', name: 'Океан', bubble: '#0ea5e9', bg: '#0c1929', text: '#e0f2fe' },
  { id: 'forest', name: 'Лес', bubble: '#22c55e', bg: '#0a1a0f', text: '#dcfce7' },
  { id: 'sunset', name: 'Закат', bubble: '#f97316', bg: '#1a0f0a', text: '#fff7ed' },
  { id: 'cherry', name: 'Вишня', bubble: '#e11d48', bg: '#1a0a0f', text: '#fff1f2' },
  { id: 'lavender', name: 'Лаванда', bubble: '#a855f7', bg: '#120a1a', text: '#f3e8ff' },
  { id: 'mint', name: 'Мята', bubble: '#14b8a6', bg: '#0a1a17', text: '#ccfbf1' },
  { id: 'gold', name: 'Золото', bubble: '#eab308', bg: '#1a170a', text: '#fef9c3' },
  { id: 'rose', name: 'Роза', bubble: '#f43f5e', bg: '#1a0a10', text: '#ffe4e6' },
  { id: 'steel', name: 'Сталь', bubble: '#64748b', bg: '#0f1419', text: '#e2e8f0' },
];

export default function ChatThemeSelector({ onClose }: ChatThemeSelectorProps) {
  const [selectedPalette, setSelectedPalette] = useState('default');
  const [bubbleColor, setBubbleColor] = useState('#6366f1');
  const [bgColor, setBgColor] = useState('#0a0a0f');
  const [textColor, setTextColor] = useState('#fafafa');
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const selectPalette = useCallback((p: typeof COLOR_PALETTES[0]) => {
    setSelectedPalette(p.id);
    setBubbleColor(p.bubble);
    setBgColor(p.bg);
    setTextColor(p.text);
  }, []);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setBgImage(ev.target?.result as string);
      toast.success('Фон загружен');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      localStorage.setItem('nexo_chat_theme', JSON.stringify({ bubbleColor, bgColor, textColor, bgImage, palette: selectedPalette }));
      await new Promise(r => setTimeout(r, 300));
      toast.success('Тема сохранена');
    } catch {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  }, [bubbleColor, bgColor, textColor, bgImage, selectedPalette]);

  const handleReset = useCallback(() => {
    setSelectedPalette('default');
    setBubbleColor('#6366f1');
    setBgColor('#0a0a0f');
    setTextColor('#fafafa');
    setBgImage(null);
    toast.success('Тема сброшена');
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/20 flex items-center justify-center">
            <Palette size={15} className="text-purple-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Тема чата</h2>
        </div>
        <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <X size={15} className="text-white/40" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Color palette */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Палитра</label>
          <div className="grid grid-cols-5 gap-2">
            {COLOR_PALETTES.map(p => (
              <motion.button key={p.id} onClick={() => selectPalette(p)}
                className={`p-2 rounded-xl border transition-all ${selectedPalette === p.id ? 'border-white/20 bg-white/[0.08]' : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.05]'}`}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <div className="w-6 h-6 rounded-full mx-auto mb-1 border border-white/10" style={{ backgroundColor: p.bubble }} />
                <p className="text-[9px] text-white/40 text-center">{p.name}</p>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Bubble color */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Цвет пузырей</label>
          <div className="flex items-center gap-3">
            <input type="color" value={bubbleColor} onChange={e => setBubbleColor(e.target.value)}
              className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer" />
            <input type="text" value={bubbleColor} onChange={e => setBubbleColor(e.target.value)}
              className="flex-1 h-8 px-3 text-xs font-mono bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none focus:border-white/20" />
          </div>
        </div>

        {/* Text color */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Цвет текста</label>
          <div className="flex items-center gap-3">
            <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)}
              className="w-8 h-8 rounded-lg border border-white/10 cursor-pointer" />
            <input type="text" value={textColor} onChange={e => setTextColor(e.target.value)}
              className="flex-1 h-8 px-3 text-xs font-mono bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/60 outline-none focus:border-white/20" />
          </div>
        </div>

        {/* Background image */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Фоновое изображение</label>
          <input type="file" ref={fileRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
          <div className="flex gap-2">
            <motion.button onClick={() => fileRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.08] transition-colors"
              whileTap={{ scale: 0.98 }}>
              <Upload size={12} />Загрузить
            </motion.button>
            {bgImage && (
              <motion.button onClick={() => setBgImage(null)}
                className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400/60 hover:bg-red-500/20 transition-colors"
                whileTap={{ scale: 0.98 }}>
                <X size={12} />
              </motion.button>
            )}
          </div>
          {bgImage && (
            <div className="mt-2 h-16 rounded-xl overflow-hidden border border-white/[0.06]">
              <img src={bgImage} alt="" className="w-full h-full object-cover" />
            </div>
          )}
        </div>

        {/* Preview */}
        <div>
          <label className="text-xs font-semibold text-white/40 uppercase tracking-wider block px-1 pb-2">Предпросмотр</label>
          <div className="rounded-xl border border-white/[0.06] overflow-hidden h-36 relative"
            style={{ backgroundColor: bgColor, backgroundImage: bgImage ? `url(${bgImage})` : undefined, backgroundSize: 'cover' }}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative p-3 space-y-2">
              <div className="flex justify-start">
                <div className="px-3 py-1.5 rounded-xl rounded-tl-sm max-w-[70%]"
                  style={{ backgroundColor: bubbleColor }}>
                  <p className="text-[10px]" style={{ color: textColor }}>Привет! Как дела?</p>
                </div>
              </div>
              <div className="flex justify-end">
                <div className="px-3 py-1.5 rounded-xl rounded-tr-sm max-w-[70%]"
                  style={{ backgroundColor: bubbleColor + '99' }}>
                  <p className="text-[10px]" style={{ color: textColor }}>Всё отлично, спасибо!</p>
                </div>
              </div>
              <div className="flex justify-start">
                <div className="px-3 py-1.5 rounded-xl rounded-tl-sm max-w-[70%]"
                  style={{ backgroundColor: bubbleColor }}>
                  <p className="text-[10px]" style={{ color: textColor }}>Отлично :)</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <motion.button onClick={handleReset}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.08] transition-colors"
            whileTap={{ scale: 0.98 }}>
            <RotateCcw size={12} />Сбросить
          </motion.button>
          <motion.button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/20 text-xs text-purple-400/80 font-medium hover:bg-purple-500/30 transition-colors disabled:opacity-40"
            whileTap={{ scale: 0.98 }}>
            {saving ? <motion.div className="w-3 h-3 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" /> : <><Save size={12} />Сохранить</>}
          </motion.button>
        </div>
      </div>
    </div>
  );
}