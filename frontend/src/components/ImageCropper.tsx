import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDrag, usePinch } from '@use-gesture/react';
import { X, Check, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageCropperProps {
  open: boolean;
  imageSrc: string;
  shape?: 'circle' | 'rect'; // circle = avatar, rect = header
  aspectRatio?: number;      // width/height, default 1 for circle, 3 for rect
  onCrop: (blob: Blob) => void;
  onClose: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export default function ImageCropper({ open, imageSrc, shape = 'circle', aspectRatio, onCrop, onClose }: ImageCropperProps) {
  const ratio = aspectRatio ?? (shape === 'circle' ? 1 : 3);
  const cropSize = Math.min(320, window.innerWidth - 64);
  const cropWidth = shape === 'rect' ? cropSize : cropSize;
  const cropHeight = shape === 'rect' ? cropSize / ratio : cropSize;

  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [ready, setReady] = useState(false);

  // Compute initial fit
  useEffect(() => {
    if (!open || !imageSrc) return;
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setReady(false);
  }, [open, imageSrc]);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
    setReady(true);
  }, []);

  // Drag gesture
  useDrag(({ delta: [dx, dy] }) => {
    setOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, {
    target: containerRef,
    filterTaps: true,
    enabled: ready,
  });

  // Pinch gesture (for touch)
  usePinch(({ offset: [scale] }) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale)));
  }, {
    target: containerRef,
    scaleBounds: { min: MIN_ZOOM, max: MAX_ZOOM },
    enabled: ready,
  });

  // Mouse wheel zoom
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev - e.deltaY * 0.003)));
  }, []);

  // Reset
  const resetTransform = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };

  // Crop and return blob
  const doCrop = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !imgSize.w) return;

    const img = imgRef.current;
    if (!img) return;

    // Output size
    const outW = shape === 'circle' ? 512 : 1536;
    const outH = shape === 'circle' ? 512 : Math.round(512 / ratio);

    canvas.width = outW;
    canvas.height = outH;

    if (shape === 'circle') {
      ctx.beginPath();
      ctx.arc(outW / 2, outH / 2, outW / 2, 0, Math.PI * 2);
      ctx.clip();
    }

    // Source rectangle in natural pixels, accounting for zoom and offset.
    // The CSS transform is: translate(-50%,-50%) translate(offset) scale(zoom)
    // With transform-origin: center, the visible region of the natural image
    // that maps to the crop viewport (cropWidth x cropHeight) is:
    const sw = cropWidth / zoom;
    const sh = cropHeight / zoom;
    const sx = (imgSize.w - sw) / 2 - offset.x / zoom;
    const sy = (imgSize.h - sh) / 2 - offset.y / zoom;

    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH);

    canvas.toBlob((blob) => {
      if (blob) onCrop(blob);
    }, 'image/jpeg', 0.92);
  }, [imgSize, offset, zoom, cropWidth, cropHeight, shape, ratio, onCrop]);

  if (!open) return null;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', maxWidth: 360, marginBottom: 16 }}>
            <motion.button onClick={onClose}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <X size={20} color="#fff" />
            </motion.button>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>
              {shape === 'circle' ? 'Обрежьте фото' : 'Обрежьте обложку'}
            </span>
            <motion.button onClick={doCrop}
              style={{ background: '#845EF7', border: 'none', borderRadius: 10, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              whileHover={{ scale: 1.1, background: '#4752c4' }} whileTap={{ scale: 0.9 }}>
              <Check size={20} color="#fff" />
            </motion.button>
          </div>

          {/* Crop viewport */}
          <div
            ref={containerRef}
            onWheel={onWheel}
            style={{
              width: cropWidth, height: cropHeight,
              borderRadius: shape === 'circle' ? '50%' : 16,
              overflow: 'hidden',
              border: '3px solid rgba(255,255,255,0.3)',
              background: '#1a1b1e',
              cursor: 'grab',
              touchAction: 'none',
              position: 'relative',
            }}
          >
            {imageSrc && (
              <img
                ref={imgRef}
                src={imageSrc}
                alt=""
                onLoad={onImageLoad}
                draggable={false}
                style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  maxWidth: 'none',
                  transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                  userSelect: 'none',
                  pointerEvents: 'none',
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 20 }}>
            <motion.button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z - 0.3))}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <ZoomOut size={18} color="#fff" />
            </motion.button>
            <div style={{ width: 140, height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.25)', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3,
                background: '#845EF7',
                width: `${((zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)) * 100}%`,
                transition: 'width 0.1s',
              }} />
              <input
                type="range" min={MIN_ZOOM * 100} max={MAX_ZOOM * 100} value={zoom * 100}
                onChange={e => setZoom(Number(e.target.value) / 100)}
                style={{
                  position: 'absolute', inset: 0, width: '100%', height: '100%',
                  opacity: 0, cursor: 'pointer',
                }}
              />
            </div>
            <motion.button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z + 0.3))}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <ZoomIn size={18} color="#fff" />
            </motion.button>
            <motion.button onClick={resetTransform}
              style={{ background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 10, width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
              <RotateCcw size={16} color="#fff" />
            </motion.button>
          </div>

          {/* Hint */}
          <p style={{ color: '#9A9A9A', fontSize: 13, marginTop: 14, fontFamily: "'Inter',sans-serif", letterSpacing: '0.01em', lineHeight: 1.5, textAlign: 'center', maxWidth: 280 }}>
            Колёсико мыши или pinch для масштаба · Перетаскивайте для перемещения
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
