import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Check, Image } from 'lucide-react';
import { useSettingsStore } from '../stores/settingsStore';
import BottomSheet from './BottomSheet';

interface BackgroundPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  chatId: string;
  onBackgroundSelected?: (backgroundUrl: string) => void;
}

const PRESET_BACKGROUNDS = [
  { id: 'default', name: 'Тёмный', style: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' },
  { id: 'blue', name: 'Синий', style: 'linear-gradient(135deg, #1e3a5f 0%, #0f2040 100%)' },
  { id: 'purple', name: 'Фиолет', style: 'linear-gradient(135deg, #3b1f5e 0%, #1e0f40 100%)' },
  { id: 'green', name: 'Зелёный', style: 'linear-gradient(135deg, #1a3d2b 0%, #0f2018 100%)' },
  { id: 'pink', name: 'Розовый', style: 'linear-gradient(135deg, #5e1f3b 0%, #400f20 100%)' },
  { id: 'orange', name: 'Закат', style: 'linear-gradient(135deg, #5e3b1f 0%, #402010 100%)' },
  { id: 'teal', name: 'Бирюза', style: 'linear-gradient(135deg, #0f3d3d 0%, #0a2020 100%)' },
  { id: 'night', name: 'Ночь', style: 'linear-gradient(135deg, #0a0a1a 0%, #050510 100%)' },
  { id: 'aurora', name: 'Аврора', style: 'linear-gradient(135deg, #0d1b2a 0%, #1b2838 50%, #0d2b1b 100%)' },
  { id: 'cosmos', name: 'Космос', style: 'linear-gradient(135deg, #0a0015 0%, #150030 50%, #000a20 100%)' },
  { id: 'forest', name: 'Лес', style: 'linear-gradient(135deg, #0d2b0d 0%, #1a3d1a 100%)' },
  { id: 'ocean', name: 'Океан', style: 'linear-gradient(135deg, #001a33 0%, #003366 100%)' },
  { id: 'tg-day', name: 'День', style: 'linear-gradient(180deg, #e8f0fe 0%, #d4e4fc 100%)' },
  { id: 'tg-warm', name: 'Тепло', style: 'linear-gradient(135deg, #f5e6d3 0%, #e8d5c4 50%, #d4c4b0 100%)' },
  { id: 'tg-plain', name: 'Поле', style: 'linear-gradient(135deg, #e8eed6 0%, #d4deba 100%)' },
  { id: 'tg-doodle', name: 'Дудл', style: 'linear-gradient(135deg, #f0f0f0 0%, #e0e0e0 100%)' },
  { id: 'tg-bubble', name: 'Пузыри', style: 'linear-gradient(135deg, #c9d6e8 0%, #b8c5d8 50%, #a7b4c8 100%)' },
  { id: 'tg-navy', name: 'Морская', style: 'linear-gradient(135deg, #17212b 0%, #0e1621 100%)' },
  { id: 'tg-night-blue', name: 'Синяя ночь', style: 'linear-gradient(180deg, #0d1b2a 0%, #1b263b 50%, #415a77 100%)' },
  { id: 'tg-gradient-1', name: 'Градиент 1', style: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
];

export default function BackgroundPickerModal({
  isOpen,
  onClose,
  chatId,
  onBackgroundSelected,
}: BackgroundPickerModalProps) {
  const { getChatBackground, setChatBackground, removeChatBackground } = useSettingsStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    if (isOpen) {
      const current = getChatBackground(chatId);
      setSelected(current?.backgroundUrl || null);
    }
  }, [isOpen, chatId]);

  const applyBackground = async (url: string) => {
    setIsLoading(true);
    try {
      await setChatBackground(chatId, url);
      setSelected(url);
      onBackgroundSelected?.(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const removeBackground = async () => {
    setIsLoading(true);
    try {
      await removeChatBackground(chatId);
      setSelected(null);
      onBackgroundSelected?.(null as any);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <div className="p-5 space-y-5">
      {/* Preset grid */}
      <div>
        <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Готовые фоны</p>
        <div className="grid grid-cols-5 gap-2">
          {PRESET_BACKGROUNDS.map((preset) => {
            const presetUrl = `preset-${preset.id}`;
            const isActive = selected === presetUrl;
            return (
              <button
                key={preset.id}
                onClick={() => applyBackground(presetUrl)}
                disabled={isLoading}
                className="relative aspect-square rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95"
                style={{ background: preset.style }}
              >
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 ring-2 ring-nexo-500 rounded-xl">
                    <Check size={18} className="text-white" />
                  </div>
                )}
                <span className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-white/70 font-medium">
                  {preset.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Remove */}
      {selected && (
        <button
          onClick={removeBackground}
          disabled={isLoading}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Trash2 size={15} />
          Убрать фон
        </button>
      )}
    </div>
  );

  // Мобильная версия — шторка
  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={onClose} title="Фон чата">
        {content}
      </BottomSheet>
    );
  }

  // Десктоп — центрированное модальное окно
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9990]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[9991]"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-[#0f0f14] rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-nexo-500/20 flex items-center justify-center">
                    <Image size={16} className="text-nexo-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">Фон чата</h3>
                </div>
                <button
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              {content}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
