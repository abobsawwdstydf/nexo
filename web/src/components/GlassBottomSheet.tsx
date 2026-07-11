import { useRef, useEffect, useCallback, useState } from 'react';
import { motion, useMotionValue, AnimatePresence, type PanInfo } from 'framer-motion';

interface GlassBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Height of the sheet when open. Default: '75vh' */
  openHeight?: string;
  /** Whether the sheet can be dragged to close. Default: true */
  draggable?: boolean;
}

const COLLAPSED_RATIO = 0.32;
const FULL_RATIO = 0.94;

export default function GlassBottomSheet({
  isOpen,
  onClose,
  children,
  openHeight = '75vh',
  draggable = true,
}: GlassBottomSheetProps) {
  const dragY = useMotionValue(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDragEnd = useCallback((_: any, info: PanInfo) => {
    const velocity = info.velocity.y;
    const offset = info.offset.y;
    if (isExpanded) {
      if (offset > 100 || velocity > 400) {
        setIsExpanded(false);
      }
    } else {
      if (offset < -80 || velocity < -400) {
        setIsExpanded(true);
      } else if (offset > 150 || velocity > 600) {
        onClose();
      }
    }
    dragY.set(0);
  }, [onClose, dragY, isExpanded]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm sm:hidden"
            onClick={onClose}
          />

          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{
              y: isExpanded ? `${(1 - FULL_RATIO) * 100}%` : `${(1 - COLLAPSED_RATIO) * 100}%`,
            }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            drag={draggable ? 'y' : false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.15}
            onDragEnd={handleDragEnd}
            style={{ y: dragY, height: openHeight }}
            className="fixed inset-x-0 bottom-0 z-[75] sm:hidden flex flex-col rounded-t-[32px] overflow-hidden shadow-[0_-20px_40px_rgba(0,0,0,0.4)]"
          >
            <div className="absolute inset-0 bg-[rgba(11,19,38,0.6)] backdrop-blur-[40px] border border-white/[0.1] border-b-0 rounded-t-[32px]" />

            <div className="relative flex flex-col h-full min-h-0">
              <div
                className="flex-shrink-0 flex justify-center pt-3 pb-4 cursor-pointer group active:scale-95 transition-transform"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                <div className="w-12 h-1.5 bg-white/20 rounded-full group-hover:bg-white/40 transition-colors" />
              </div>

              <div className="flex-1 overflow-y-auto px-4 pb-[max(16px,env(safe-area-inset-bottom))] min-h-0">
                {children}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
