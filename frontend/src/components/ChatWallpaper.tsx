import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Image, X, Check, Upload, Palette, Trash2 } from 'lucide-react';

const WALLPAPER_KEY = 'nexo_chat_wallpapers';

interface ChatWallpaperData {
  [chatId: string]: {
    type: 'color' | 'gradient' | 'image' | 'pattern';
    value: string;
    thumbnail?: string;
    name?: string;
  };
}

const PRESET_WALLPAPERS = [
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #0f0f13 0%, #1a1a2e 50%, #16213e 100%)', name: 'Ноктюрн' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #0d1117 0%, #1a1a2e 50%, #0d1117 100%)', name: 'Космос' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #2d1b69 100%)', name: 'Неон' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)', name: 'Глубина' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #000000 0%, #1b1b1b 50%, #2d2d2d 100%)', name: 'Графит' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0a1628 100%)', name: 'Океан' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #1a0a0a 0%, #3a1a1a 50%, #1a0a0a 100%)', name: 'Марс' },
  { type: 'gradient' as const, value: 'linear-gradient(135deg, #0a1a0a 0%, #1a3a1a 50%, #0a1a0a 100%)', name: 'Лес' },
  { type: 'color' as const, value: '#0f0f13', name: 'Тёмный' },
  { type: 'color' as const, value: '#1a1a2e', name: 'Индиго' },
  { type: 'color' as const, value: '#0d1117', name: 'Чёрный' },
  { type: 'color' as const, value: '#16213e', name: 'Сапфир' },
  { type: 'color' as const, value: '#2d1b69', name: 'Пурпур' },
  { type: 'color' as const, value: '#1a3a5c', name: 'Азур' },
  { type: 'color' as const, value: '#2d2d2d', name: 'Серый' },
  { type: 'color' as const, value: '#0a0a0a', name: 'AMOLED' },
  { type: 'pattern' as const, value: 'url("data:image/svg+xml,%3Csvg width=\'40\' height=\'40\' viewBox=\'0 0 40 40\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.03\'%3E%3Cpath d=\'M0 0h40v40H0z\'/%3E%3C/g%3E%3C/svg%3E")', name: 'Сетка' },
  { type: 'pattern' as const, value: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.02\'%3E%3Ccircle cx=\'30\' cy=\'30\' r=\'30\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")', name: 'Точки' },
];

function loadWallpapers(): ChatWallpaperData {
  try {
    const raw = localStorage.getItem(WALLPAPER_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveWallpapers(data: ChatWallpaperData) {
  try {
    localStorage.setItem(WALLPAPER_KEY, JSON.stringify(data));
  } catch {}
}

interface ChatWallpaperProps {
  chatId: string;
  children: React.ReactNode;
}

export function ChatWallpaper({ chatId, children }: ChatWallpaperProps) {
  const [wallpaper, setWallpaper] = useState<ChatWallpaperData[string] | null>(null);

  useEffect(() => {
    const data = loadWallpapers();
    if (data[chatId]) {
      setWallpaper(data[chatId]);
    }
  }, [chatId]);

  const bgStyle = wallpaper ? {
    background: wallpaper.value,
    backgroundSize: wallpaper.type === 'image' ? 'cover' : wallpaper.type === 'pattern' ? 'auto' : undefined,
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  } : undefined;

  return (
    <div className="relative h-full flex flex-col" style={bgStyle}>
      {children}
    </div>
  );
}

interface WallpaperPickerProps {
  chatId: string;
  currentWallpaper?: ChatWallpaperData[string] | null;
  onClose: () => void;
  onApply: () => void;
}

export function WallpaperPicker({ chatId, currentWallpaper, onClose, onApply }: WallpaperPickerProps) {
  const [selected, setSelected] = useState(currentWallpaper || null);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'presets' | 'custom'>('presets');

  const applyWallpaper = useCallback((wall: ChatWallpaperData[string]) => {
    const data = loadWallpapers();
    data[chatId] = wall;
    saveWallpapers(data);
    setSelected(wall);
    onApply();
  }, [chatId, onApply]);

  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const imgUrl = ev.target?.result as string;
      setCustomImage(imgUrl);
      applyWallpaper({ type: 'image', value: imgUrl, name: file.name });
    };
    reader.readAsDataURL(file);
  }, [applyWallpaper]);

  const removeWallpaper = useCallback(() => {
    const data = loadWallpapers();
    delete data[chatId];
    saveWallpapers(data);
    setSelected(null);
    setCustomImage(null);
    onApply();
  }, [chatId, onApply]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      className="absolute bottom-full left-0 mb-2 w-[320px] z-50"
      onClick={e => e.stopPropagation()}
    >
      <div className="rounded-2xl liquid-glass-strong overflow-hidden max-h-[400px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white/90 flex items-center gap-2">
            <Image size={14} className="text-white/50" />
            Обои чата
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.08] transition-colors">
            <X size={14} className="text-white/40" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-3 pt-2">
          <button
            onClick={() => setActiveTab('presets')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'presets'
                ? 'bg-white/10 text-white/80'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Palette size={12} className="inline mr-1" />
            Цвета
          </button>
          <button
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              activeTab === 'custom'
                ? 'bg-white/10 text-white/80'
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            <Upload size={12} className="inline mr-1" />
            Свои
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === 'presets' ? (
            <div className="grid grid-cols-4 gap-2">
              {PRESET_WALLPAPERS.map((w, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.02 }}
                  onClick={() => applyWallpaper(w)}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden border-2 transition-all hover:scale-105 ${
                    selected?.value === w.value
                      ? 'border-blue-400/60 shadow-lg shadow-blue-400/20'
                      : 'border-white/[0.06] hover:border-white/20'
                  }`}
                >
                  <div
                    className="w-full h-full"
                    style={{
                      background: w.value,
                      backgroundSize: w.type === 'pattern' ? 'auto' : 'cover',
                    }}
                  />
                  {selected?.value === w.value && (
                    <div className="absolute inset-0 bg-blue-500/20 flex items-center justify-center">
                      <Check size={16} className="text-blue-400" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/60 to-transparent">
                    <p className="text-[8px] text-white/60 text-center truncate">{w.name}</p>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Upload */}
              <label className="flex flex-col items-center justify-center h-28 rounded-xl border-2 border-dashed border-white/[0.1] hover:border-white/[0.2] bg-white/[0.02] hover:bg-white/[0.04] cursor-pointer transition-all">
                <Upload size={20} className="text-white/30 mb-1" />
                <span className="text-[10px] text-white/40">Загрузить свои обои</span>
                <span className="text-[8px] text-white/20 mt-0.5">JPEG, PNG, WebP</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>

              {/* Custom image preview */}
              {customImage && (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={customImage} alt="" className="w-full h-32 object-cover" />
                  <button
                    onClick={removeWallpaper}
                    className="absolute top-2 right-2 p-1 rounded-lg bg-black/60 hover:bg-black/80 transition-colors"
                  >
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Remove button */}
        {selected && (
          <div className="px-3 pb-3">
            <button
              onClick={removeWallpaper}
              className="w-full py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-[10px] text-red-400 transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 size={11} />
              Сбросить обои
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function useChatWallpaper(chatId: string): ChatWallpaperData[string] | null {
  const [wallpaper, setWallpaper] = useState<ChatWallpaperData[string] | null>(null);

  useEffect(() => {
    const data = loadWallpapers();
    setWallpaper(data[chatId] || null);

    const handler = () => {
      const updated = loadWallpapers();
      setWallpaper(updated[chatId] || null);
    };

    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, [chatId]);

  return wallpaper;
}
