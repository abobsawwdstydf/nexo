import { useState, useEffect } from 'react';
import { Camera, FileImage, FileText, BarChart3, MapPin, List, User, Sticker } from 'lucide-react';

interface AttachMenuProps {
  onClose: () => void;
  onSelectFile: () => void;
  onSelectImage: () => void;
  onSelectCamera: () => void;
  onSelectPoll: () => void;
  onSelectLocation: () => void;
  onSelectSticker?: () => void;
  onSelectContact?: () => void;
}

const items = [
  { id: 'gallery', icon: FileImage, label: 'Галерея', color: '#6ab2f2' },
  { id: 'camera', icon: Camera, label: 'Камера', color: '#a78bfa' },
  { id: 'file', icon: FileText, label: 'Файл', color: '#94a3b8' },
  { id: 'sticker', icon: Sticker, label: 'Стикер', color: '#fbbf24' },
  { id: 'contact', icon: User, label: 'Контакт', color: '#34d399' },
  { id: 'location', icon: MapPin, label: 'Геолокация', color: '#f87171' },
  { id: 'poll', icon: BarChart3, label: 'Опрос', color: '#4ade80' },
  { id: 'list', icon: List, label: 'Список', color: '#c084fc' },
];

export default function AttachMenu({
  onClose,
  onSelectFile,
  onSelectImage,
  onSelectCamera,
  onSelectPoll,
  onSelectLocation,
  onSelectSticker,
  onSelectContact,
}: AttachMenuProps) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const handleSelect = (id: string) => {
    switch (id) {
      case 'gallery': onSelectImage(); break;
      case 'camera': onSelectCamera(); break;
      case 'file': onSelectFile(); break;
      case 'sticker': onSelectSticker?.(); break;
      case 'contact': onSelectContact?.(); break;
      case 'location': onSelectLocation(); break;
      case 'poll': onSelectPoll(); break;
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100]"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      <div
        className={isMobile
          ? 'fixed bottom-0 left-0 right-0 z-[101]'
          : 'absolute bottom-16 left-1/2 -translate-x-1/2 w-[340px] max-w-[calc(100%-32px)]'
        }
        onClick={e => e.stopPropagation()}
      >
        <div
          className={`relative overflow-hidden ${
            isMobile ? 'rounded-t-2xl pb-[env(safe-area-inset-bottom)]' : 'rounded-2xl'
          }`}
          style={{
            background: 'rgba(20, 20, 22, 0.85)',
            backdropFilter: 'blur(40px)',
            WebkitBackdropFilter: 'blur(40px)',
            boxShadow: '0 -4px 40px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          {isMobile && (
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="w-8 h-1 bg-white/15 rounded-full" />
            </div>
          )}

          <div className={`grid grid-cols-4 gap-1 ${isMobile ? 'px-3 pb-4 pt-2' : 'px-3 pb-3 pt-3'}`}>
            {items.map((item) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-100 active:scale-95 hover:bg-white/[0.06]"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center transition-colors"
                  style={{
                    background: `${item.color}15`,
                    border: `1px solid ${item.color}20`,
                  }}
                >
                  <item.icon size={20} style={{ color: item.color }} />
                </div>
                <span className="text-[10px] font-medium text-zinc-400 leading-none whitespace-nowrap">
                  {item.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
