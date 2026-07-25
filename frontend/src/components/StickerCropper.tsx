import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Upload, Crop, RotateCw, ZoomIn, ZoomOut, Check } from 'lucide-react';

interface StickerCropperProps {
  onDone: (blob: Blob, fileName: string) => void;
  onCancel: () => void;
}

export default function StickerCropper({ onDone, onCancel }: StickerCropperProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageSrc) return;
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.1, Math.min(5, prev + delta)));
  };

  const handleExport = useCallback(() => {
    if (!imageSrc || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 512;
    canvas.width = size;
    canvas.height = size;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      ctx.clearRect(0, 0, size, size);
      ctx.save();
      ctx.translate(size / 2, size / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(scale, scale);

      const aspect = img.width / img.height;
      let drawWidth: number;
      let drawHeight: number;

      if (aspect > 1) {
        drawHeight = size;
        drawWidth = size * aspect;
      } else {
        drawWidth = size;
        drawHeight = size / aspect;
      }

      ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      ctx.restore();

      canvas.toBlob((blob) => {
        if (blob) {
          const fileName = `sticker_${Date.now()}.webp`;
          onDone(blob, fileName);
        }
      }, 'image/webp', 0.9);
    };
    img.src = imageSrc;
  }, [imageSrc, scale, rotation, onDone]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Обрезка стикера</h3>
        <button onClick={onCancel} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10">
          <X size={16} />
        </button>
      </div>

      {!imageSrc ? (
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full h-40 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-2 text-zinc-500 hover:border-nexo-500/50 hover:text-nexo-400 transition-colors"
          >
            <Upload size={24} />
            <span className="text-sm">Выбери изображение</span>
            <span className="text-xs text-zinc-600">PNG, GIF, WebP, JPG</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Canvas preview area */}
          <div
            ref={containerRef}
            className="relative w-full h-64 bg-black/40 rounded-xl overflow-hidden cursor-move flex items-center justify-center"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          >
            <img
              src={imageSrc}
              alt="sticker preview"
              className="max-w-full max-h-full object-contain select-none pointer-events-none"
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
              }}
            />

            {/* Grid overlay */}
            <div className="absolute inset-0 pointer-events-none opacity-20">
              <div className="w-full h-full" style={{
                backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
                backgroundSize: '64px 64px',
              }} />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={() => setScale(prev => Math.max(0.1, prev - 0.1))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Уменьшить"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-xs text-zinc-400 w-12 text-center">{Math.round(scale * 100)}%</span>
            <button
              onClick={() => setScale(prev => Math.min(5, prev + 0.1))}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Увеличить"
            >
              <ZoomIn size={16} />
            </button>
            <button
              onClick={() => setRotation(prev => prev + 90)}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Повернуть"
            >
              <RotateCw size={16} />
            </button>
            <button
              onClick={() => { setScale(1); setRotation(0); setPosition({ x: 0, y: 0 }); }}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              title="Сбросить"
            >
              <Crop size={16} />
            </button>
          </div>

          {/* Export button */}
          <button
            onClick={handleExport}
            className="w-full py-2.5 rounded-xl bg-nexo-500 text-white text-sm font-medium hover:bg-nexo-600 transition-colors flex items-center justify-center gap-2"
          >
            <Check size={16} />
            Сохранить как WebP
          </button>

          {/* Change image */}
          <button
            onClick={() => { setImageSrc(null); setScale(1); setRotation(0); setPosition({ x: 0, y: 0 }); }}
            className="w-full py-2 rounded-xl bg-white/5 text-zinc-400 text-xs hover:bg-white/10 hover:text-white transition-colors"
          >
            Выбрать другое изображение
          </button>
        </div>
      )}

      {/* Hidden canvas for export */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
