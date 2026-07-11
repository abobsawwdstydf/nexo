import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { X, ChevronUp } from 'lucide-react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
  showCloseButton?: boolean;
}

export default function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '85vh',
  showCloseButton = true,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);

  const handleDragEnd = useCallback(
    (_: any, info: PanInfo) => {
      const totalDrag = info.offset.y;
      const velocity = info.velocity.y;

      if (isExpanded) {
        // Из развёрнутого состояния: свайп вниз → свернуть
        if (totalDrag > 80 || velocity > 400) {
          setIsExpanded(false);
        }
      } else {
        // Из обычного состояния: свайп вниз → закрыть, свайп вверх → развернуть
        if (totalDrag > 100 || velocity > 500) {
          onClose();
        } else if (totalDrag < -80 || velocity < -400) {
          setIsExpanded(true);
        }
      }
    },
    [isExpanded, onClose],
  );

  const handleDragStart = useCallback((_: any, info: PanInfo) => {
    setDragStartY(info.point.y);
  }, []);

  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
      setIsExpanded(false);
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9990]">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Sheet */}
          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.15}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            className="absolute inset-x-0 bottom-0 rounded-t-[20px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              className="bg-[#1a1a1a] border-t border-white/10 shadow-2xl flex flex-col"
              animate={{
                maxHeight: isExpanded ? '100vh' : maxHeight,
                height: isExpanded ? '100vh' : undefined,
                borderRadius: isExpanded ? '0' : '20px 20px 0 0',
              }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            >
              {/* Drag handle */}
              <div
                className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing"
                onDoubleClick={toggleExpand}
              >
                <div className="w-10 h-1 rounded-full bg-white/20" />
              </div>

              {/* Header */}
              {(title || showCloseButton) && (
                <div className="flex items-center justify-between px-5 py-3 border-b border-white/5 flex-shrink-0">
                  <h3 className="text-sm font-semibold text-white">{title || ''}</h3>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={toggleExpand}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                      title={isExpanded ? 'Свернуть' : 'Развернуть'}
                    >
                      <ChevronUp
                        size={16}
                        className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {showCloseButton && (
                      <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain">
                {children}
              </div>
            </motion.div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
