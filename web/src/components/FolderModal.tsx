import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Folder, Check, Palette } from 'lucide-react';

interface FolderModalProps {
  onClose: () => void;
  onSave: (data: { name: string; icon: string; color: string }) => void;
  initialData?: { name: string; icon: string; color: string };
  title?: string;
}

const FOLDER_ICONS = ['📁', '📂', '🗂️', '📋', '📌', '⭐', '❤️', '💼', '🎯', '🔥', '✨', '🎨', '🎵', '🎮', '📱', '💻'];

const PRESET_COLORS = [
  '#6366f1', '#a855f7', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#6b7280',
];

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 99, g: 102, b: 241 };
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

export default function FolderModal({ onClose, onSave, initialData, title = 'Создать папку' }: FolderModalProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [icon, setIcon] = useState(initialData?.icon || '📁');
  const [color, setColor] = useState(initialData?.color || '#6366f1');
  const [showRgb, setShowRgb] = useState(false);
  const rgb = hexToRgb(color);

  const handleRgbChange = useCallback((r: number, g: number, b: number) => {
    setColor(rgbToHex(r, g, b));
  }, []);

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, color });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 350 }}
        className="relative w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl bg-[#1a1a1f] border border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <Folder size={18} className="text-nexo-400" />
            <h3 className="text-base font-semibold text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Название папки"
              maxLength={30}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50 transition-colors"
              autoFocus
            />
            <div className="mt-1 text-[10px] text-zinc-500 text-right">{name.length}/30</div>
          </div>

          <div>
            <div className="grid grid-cols-8 gap-1.5">
              {FOLDER_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => setIcon(emoji)}
                  className={`aspect-square rounded-lg flex items-center justify-center text-lg transition-all ${
                    icon === emoji
                      ? 'bg-nexo-500/20 ring-2 ring-nexo-500 scale-110'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs text-zinc-500">Цвет</label>
              <button
                onClick={() => setShowRgb(!showRgb)}
                className="flex items-center gap-1 text-[10px] text-nexo-400 hover:text-nexo-300 transition-colors"
              >
                <Palette size={12} />
                {showRgb ? 'Пресеты' : 'RGB'}
              </button>
            </div>

            {showRgb ? (
              <div className="space-y-2 p-2.5 rounded-xl bg-white/5 border border-white/10">
                {[
                  { label: 'R', value: rgb.r, max: 255, color: '#ef4444', channel: 'r' },
                  { label: 'G', value: rgb.g, max: 255, color: '#22c55e', channel: 'g' },
                  { label: 'B', value: rgb.b, max: 255, color: '#3b82f6', channel: 'b' },
                ].map(({ label, value, color: barColor, channel }) => (
                  <div key={channel} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold w-3 text-center" style={{ color: barColor }}>{label}</span>
                    <input
                      type="range"
                      min={0}
                      max={255}
                      value={value}
                      onChange={(e) => {
                        const newRgb = { ...rgb };
                        (newRgb as any)[channel] = Number(e.target.value);
                        handleRgbChange(newRgb.r, newRgb.g, newRgb.b);
                      }}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #000, ${barColor})`,
                        accentColor: barColor,
                      }}
                    />
                    <span className="text-[10px] text-zinc-400 w-7 text-right font-mono">{value}</span>
                  </div>
                ))}
                <div className="flex items-center gap-2 pt-1">
                  <div className="w-6 h-6 rounded-lg border border-white/20" style={{ backgroundColor: color }} />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (/^#[0-9a-f]{6}$/i.test(v)) setColor(v);
                    }}
                    className="flex-1 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-white text-[11px] font-mono focus:outline-none"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-5 gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`aspect-square rounded-lg transition-all relative ${
                      color === c ? 'ring-2 ring-white scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check size={14} className="absolute inset-0 m-auto text-white" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center text-lg"
              style={{ backgroundColor: color + '20', color }}
            >
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white truncate">{name || 'Название'}</div>
              <div className="text-[10px] text-zinc-500">0 чатов</div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-sm font-medium transition-colors"
          >
            Отмена
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="flex-1 py-2 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors"
          >
            {initialData ? 'Сохранить' : 'Создать'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
