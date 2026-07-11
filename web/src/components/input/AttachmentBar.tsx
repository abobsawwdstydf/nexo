import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImageIcon, FileText, Music } from 'lucide-react';
import type { Attachment } from './types';

interface AttachmentBarProps {
  attachments: Attachment[];
  isSending: boolean;
  onRemove: (index: number) => void;
  t: (key: string) => string;
}

export default function AttachmentBar({ attachments, isSending, onRemove, t }: AttachmentBarProps) {
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const checkScrollArrows = () => {
    const el = scrollRef.current;
    if (el) {
      setShowLeftArrow(el.scrollLeft > 0);
      setShowRightArrow(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }
  };

  const scrollAttachments = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (el) {
      const scrollAmount = 200;
      el.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  useEffect(() => {
    checkScrollArrows();
  }, [attachments]);

  if (attachments.length === 0) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0, y: 10 }}
      animate={{ height: 'auto', opacity: 1, y: 0 }}
      exit={{ height: 0, opacity: 0, y: 10 }}
      onAnimationComplete={checkScrollArrows}
      className="mb-2 max-w-3xl mx-auto px-1.5 relative"
    >
      {showLeftArrow && (
        <button
          onClick={() => scrollAttachments('left')}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-all shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
        </button>
      )}

      {showRightArrow && (
        <button
          onClick={() => scrollAttachments('right')}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-black/80 transition-all shadow-lg"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 18 6-6-6-6"/>
          </svg>
        </button>
      )}

      <div
        ref={scrollRef}
        onScroll={checkScrollArrows}
        className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1 pl-2 pr-2"
      >
        {attachments.map((att, index) => (
          <div key={index} className="relative flex-shrink-0 w-16 h-16 bg-white/[0.08] backdrop-blur-xl border border-white/15 rounded-lg overflow-hidden shadow-lg group">
            <div className="w-full h-full relative">
              {att.preview ? (
                <img src={att.preview} alt="" className="w-full h-full object-cover" />
              ) : att.type === 'video' ? (
                <div className="w-full h-full bg-gradient-to-br from-nexo-500/30 to-purple-600/30 flex items-center justify-center">
                  <ImageIcon size={16} className="text-nexo-300" />
                </div>
              ) : att.type === 'audio' ? (
                <div className="w-full h-full bg-gradient-to-br from-emerald-500/30 to-teal-600/30 flex items-center justify-center">
                  <Music size={16} className="text-emerald-300" />
                </div>
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-sky-500/30 to-blue-600/30 flex items-center justify-center">
                  <FileText size={16} className="text-sky-300" />
                </div>
              )}
              <button
                onClick={() => onRemove(index)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-red-500/90 hover:bg-red-600 flex items-center justify-center text-white transition-all opacity-0 group-hover:opacity-100"
              >
                <X size={8} />
              </button>
            </div>
            {index === attachments.length - 1 && attachments.length > 5 && (
              <div className="absolute bottom-0 right-0 left-0 bg-black/60 text-[8px] text-white text-center py-0.5">
                +{attachments.length - 1}
              </div>
            )}
          </div>
        ))}
      </div>
      {isSending && (
        <div className="mt-1 flex items-center gap-1.5 text-nexo-400 text-xs">
          <div className="w-3 h-3 border-2 border-nexo-400 border-t-transparent rounded-full animate-spin" />
          <span>{t('uploading')}</span>
        </div>
      )}
    </motion.div>
  );
}
