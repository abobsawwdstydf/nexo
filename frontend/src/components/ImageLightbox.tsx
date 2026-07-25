import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageLightboxProps {
  url?: string;
  images?: { url: string; type?: string }[];
  initialIndex?: number;
  onClose: () => void;
}

export default function ImageLightbox({ url, images, initialIndex = 0, onClose }: ImageLightboxProps) {
  const gallery = images && images.length > 0;
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const currentUrl = gallery ? images![index].url : url!;
  const currentType = gallery ? images![index].type : undefined;
  const total = gallery ? images!.length : 1;

  const goPrev = useCallback(() => {
    if (gallery) { setIndex((i) => (i > 0 ? i - 1 : total - 1)); setZoom(1); }
  }, [gallery, total]);

  const goNext = useCallback(() => {
    if (gallery) { setIndex((i) => (i < total - 1 ? i + 1 : 0)); setZoom(1); }
  }, [gallery, total]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === '+' || e.key === '=') setZoom(z => Math.min(z + 0.25, 3));
      if (e.key === '-') setZoom(z => Math.max(z - 0.25, 0.5));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, goPrev, goNext]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-xl flex items-center justify-center"
      onClick={onClose}
    >
      {/* Top bar */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-2">
          {gallery && total > 1 && (
            <span className="px-3 py-1 rounded-full text-sm text-white/70 bg-black/40 backdrop-blur-sm">
              {index + 1} / {total}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.max(z - 0.25, 0.5)); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
          >
            <ZoomOut size={18} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setZoom(z => Math.min(z + 0.25, 3)); }}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
          >
            <ZoomIn size={18} />
          </button>
          <a
            href={currentUrl}
            download
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
          >
            <Download size={18} />
          </a>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Left arrow */}
      {gallery && total > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goPrev(); }}
          className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Right arrow */}
      {gallery && total > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goNext(); }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
        >
          <ChevronRight size={28} />
        </button>
      )}

      {/* Media */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentUrl}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="flex items-center justify-center w-full h-full p-8"
        >
          {currentType === 'video' ? (
            <video
              src={currentUrl}
              controls
              autoPlay
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
            />
          ) : (
            <img
              src={currentUrl}
              alt=""
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl cursor-zoom-in"
              style={{ transform: `scale(${zoom})`, transition: 'transform 0.2s' }}
              onClick={() => setZoom(z => z >= 1.5 ? 1 : z + 0.5)}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {/* Zoom level indicator */}
      {zoom !== 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-black/60 backdrop-blur-sm text-sm text-white/70">
          {Math.round(zoom * 100)}%
        </div>
      )}
    </motion.div>,
    document.body
  );
}
