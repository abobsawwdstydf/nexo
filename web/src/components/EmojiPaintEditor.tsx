import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Pencil, Eraser, Square, Circle, Minus, Undo2, Redo2,
  Download, Upload, Trash2, Pipette, PaintBucket, Type,
  ZoomIn, ZoomOut, RotateCcw, Check,
} from 'lucide-react';

interface EmojiPaintEditorProps {
  onSave: (dataUrl: string, name: string) => void;
  onClose: () => void;
  initialImage?: string; // base64 or URL
  size?: number; // canvas size, default 512
}

type Tool = 'pencil' | 'eraser' | 'fill' | 'rect' | 'circle' | 'line' | 'text' | 'eyedropper';

interface HistoryEntry {
  imageData: ImageData;
}

const PALETTE = [
  '#ffffff', '#000000', '#ff0000', '#ff6600', '#ffcc00', '#00cc00',
  '#0066ff', '#9900ff', '#ff00cc', '#00cccc', '#ff9999', '#99ff99',
  '#9999ff', '#ffcc99', '#cccccc', '#666666', '#ff3366', '#33ff99',
  '#3399ff', '#ff9933', '#cc33ff', '#33ccff', '#ff6699', '#99ff33',
];

export default function EmojiPaintEditor({ onSave, onClose, initialImage, size = 512 }: EmojiPaintEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [tool, setTool] = useState<Tool>('pencil');
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(8);
  const [opacity, setOpacity] = useState(1);
  const [isDrawing, setIsDrawing] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [name, setName] = useState('Мой стикер');
  const [zoom, setZoom] = useState(1);
  const [textInput, setTextInput] = useState('');
  const [showTextInput, setShowTextInput] = useState(false);
  const [textPos, setTextPos] = useState({ x: 0, y: 0 });
  const [fontSize, setFontSize] = useState(32);

  const startPos = useRef({ x: 0, y: 0 });
  const lastPos = useRef({ x: 0, y: 0 });

  const getCtx = () => canvasRef.current?.getContext('2d');
  const getOverlayCtx = () => overlayRef.current?.getContext('2d');

  // Initialize canvas
  useEffect(() => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);

    if (initialImage) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        saveHistory();
      };
      img.src = initialImage;
    } else {
      saveHistory();
    }
  }, []);

  const saveHistory = useCallback(() => {
    const ctx = getCtx();
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, size, size);
    setHistory(prev => {
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push({ imageData });
      return newHistory.slice(-50); // Keep last 50 states
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex, size]);

  const undo = () => {
    if (historyIndex <= 0) return;
    const ctx = getCtx();
    if (!ctx) return;
    const newIndex = historyIndex - 1;
    ctx.putImageData(history[newIndex].imageData, 0, 0);
    setHistoryIndex(newIndex);
  };

  const redo = () => {
    if (historyIndex >= history.length - 1) return;
    const ctx = getCtx();
    if (!ctx) return;
    const newIndex = historyIndex + 1;
    ctx.putImageData(history[newIndex].imageData, 0, 0);
    setHistoryIndex(newIndex);
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * size,
      y: ((clientY - rect.top) / rect.height) * size,
    };
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const ctx = getCtx();
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;

    const targetIdx = (Math.floor(startY) * size + Math.floor(startX)) * 4;
    const targetR = data[targetIdx];
    const targetG = data[targetIdx + 1];
    const targetB = data[targetIdx + 2];
    const targetA = data[targetIdx + 3];

    const hex = fillColor.replace('#', '');
    const fillR = parseInt(hex.slice(0, 2), 16);
    const fillG = parseInt(hex.slice(2, 4), 16);
    const fillB = parseInt(hex.slice(4, 6), 16);

    if (targetR === fillR && targetG === fillG && targetB === fillB) return;

    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Set<number>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      if (x < 0 || x >= size || y < 0 || y >= size) continue;
      const idx = (y * size + x) * 4;
      if (visited.has(idx)) continue;
      if (
        Math.abs(data[idx] - targetR) > 30 ||
        Math.abs(data[idx + 1] - targetG) > 30 ||
        Math.abs(data[idx + 2] - targetB) > 30 ||
        Math.abs(data[idx + 3] - targetA) > 30
      ) continue;

      visited.add(idx);
      data[idx] = fillR;
      data[idx + 1] = fillG;
      data[idx + 2] = fillB;
      data[idx + 3] = 255;

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
  };

  const eyedropper = (x: number, y: number) => {
    const ctx = getCtx();
    if (!ctx) return;
    const pixel = ctx.getImageData(Math.floor(x), Math.floor(y), 1, 1).data;
    const hex = '#' + [pixel[0], pixel[1], pixel[2]].map(v => v.toString(16).padStart(2, '0')).join('');
    setColor(hex);
    setTool('pencil');
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e);
    setIsDrawing(true);
    startPos.current = pos;
    lastPos.current = pos;

    const ctx = getCtx();
    if (!ctx) return;

    if (tool === 'fill') {
      floodFill(pos.x, pos.y, color);
      saveHistory();
      return;
    }

    if (tool === 'eyedropper') {
      eyedropper(pos.x, pos.y);
      return;
    }

    if (tool === 'text') {
      setTextPos(pos);
      setShowTextInput(true);
      return;
    }

    ctx.globalAlpha = opacity;
    ctx.strokeStyle = tool === 'eraser' ? 'rgba(0,0,0,0)' : color;
    ctx.fillStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'pencil' || tool === 'eraser') {
      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
      } else {
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const pos = getCanvasPos(e);
    const ctx = getCtx();
    const overlayCtx = getOverlayCtx();
    if (!ctx) return;

    if (tool === 'pencil' || tool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      lastPos.current = pos;
    } else if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      // Draw on overlay
      if (!overlayCtx || !overlayRef.current) return;
      overlayCtx.clearRect(0, 0, size, size);
      overlayCtx.globalAlpha = opacity;
      overlayCtx.strokeStyle = color;
      overlayCtx.fillStyle = color + '40';
      overlayCtx.lineWidth = brushSize;

      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;

      if (tool === 'rect') {
        overlayCtx.strokeRect(startPos.current.x, startPos.current.y, dx, dy);
        overlayCtx.fillRect(startPos.current.x, startPos.current.y, dx, dy);
      } else if (tool === 'circle') {
        overlayCtx.beginPath();
        overlayCtx.ellipse(
          startPos.current.x + dx / 2,
          startPos.current.y + dy / 2,
          Math.abs(dx / 2),
          Math.abs(dy / 2),
          0, 0, Math.PI * 2
        );
        overlayCtx.fill();
        overlayCtx.stroke();
      } else if (tool === 'line') {
        overlayCtx.beginPath();
        overlayCtx.moveTo(startPos.current.x, startPos.current.y);
        overlayCtx.lineTo(pos.x, pos.y);
        overlayCtx.stroke();
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const pos = getCanvasPos(e);
    const ctx = getCtx();
    const overlayCtx = getOverlayCtx();
    if (!ctx) return;

    if (tool === 'rect' || tool === 'circle' || tool === 'line') {
      const dx = pos.x - startPos.current.x;
      const dy = pos.y - startPos.current.y;

      ctx.globalAlpha = opacity;
      ctx.strokeStyle = color;
      ctx.fillStyle = color + '40';
      ctx.lineWidth = brushSize;
      ctx.globalCompositeOperation = 'source-over';

      if (tool === 'rect') {
        ctx.strokeRect(startPos.current.x, startPos.current.y, dx, dy);
        ctx.fillRect(startPos.current.x, startPos.current.y, dx, dy);
      } else if (tool === 'circle') {
        ctx.beginPath();
        ctx.ellipse(
          startPos.current.x + dx / 2,
          startPos.current.y + dy / 2,
          Math.abs(dx / 2),
          Math.abs(dy / 2),
          0, 0, Math.PI * 2
        );
        ctx.fill();
        ctx.stroke();
      } else if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(startPos.current.x, startPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }

      overlayCtx?.clearRect(0, 0, size, size);
    }

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    saveHistory();
  };

  const handleTextSubmit = () => {
    const ctx = getCtx();
    if (!ctx || !textInput.trim()) {
      setShowTextInput(false);
      setTextInput('');
      return;
    }
    ctx.globalAlpha = opacity;
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px sans-serif`;
    ctx.fillText(textInput, textPos.x, textPos.y);
    ctx.globalAlpha = 1;
    setShowTextInput(false);
    setTextInput('');
    saveHistory();
  };

  const clearCanvas = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.clearRect(0, 0, size, size);
    saveHistory();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl, name);
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `${name}.png`;
    a.click();
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const ctx = getCtx();
        if (!ctx) return;
        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        saveHistory();
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const tools: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: 'pencil', icon: Pencil, label: 'Карандаш' },
    { id: 'eraser', icon: Eraser, label: 'Ластик' },
    { id: 'fill', icon: PaintBucket, label: 'Заливка' },
    { id: 'rect', icon: Square, label: 'Прямоугольник' },
    { id: 'circle', icon: Circle, label: 'Эллипс' },
    { id: 'line', icon: Minus, label: 'Линия' },
    { id: 'text', icon: Type, label: 'Текст' },
    { id: 'eyedropper', icon: Pipette, label: 'Пипетка' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-4xl bg-[#0f0f14] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '95vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-nexo-500 to-purple-600 flex items-center justify-center">
            <Pencil size={16} className="text-white" />
          </div>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="flex-1 bg-transparent text-white font-medium text-sm outline-none placeholder-zinc-500"
            placeholder="Название стикера..."
          />
          <div className="flex items-center gap-1">
            <button onClick={handleDownload} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors" title="Скачать PNG">
              <Download size={16} />
            </button>
            <label className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors cursor-pointer" title="Загрузить изображение">
              <Upload size={16} />
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            </label>
            <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left toolbar */}
          <div className="w-14 flex flex-col items-center gap-1 py-3 border-r border-white/10 bg-black/20 overflow-y-auto">
            {tools.map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                onClick={() => setTool(id)}
                title={label}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                  tool === id ? 'bg-nexo-500/30 text-nexo-400 ring-1 ring-nexo-500/50' : 'text-zinc-500 hover:text-white hover:bg-white/10'
                }`}
              >
                <Icon size={18} />
              </button>
            ))}

            <div className="w-8 h-px bg-white/10 my-1" />

            {/* Undo/Redo */}
            <button onClick={undo} disabled={historyIndex <= 0} title="Отменить" className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30">
              <Undo2 size={18} />
            </button>
            <button onClick={redo} disabled={historyIndex >= history.length - 1} title="Повторить" className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30">
              <Redo2 size={18} />
            </button>
            <button onClick={clearCanvas} title="Очистить" className="w-10 h-10 rounded-xl flex items-center justify-center text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 size={18} />
            </button>
          </div>

          {/* Canvas area */}
          <div
            ref={containerRef}
            className="flex-1 flex items-center justify-center bg-[#0a0a0f] overflow-auto"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          >
            <div
              className="relative"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                cursor: tool === 'eyedropper' ? 'crosshair' : tool === 'eraser' ? 'cell' : 'crosshair',
              }}
            >
              {/* Checkerboard background for transparency */}
              <div
                className="absolute inset-0 rounded-lg"
                style={{
                  backgroundImage: 'linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
                }}
              />
              <canvas
                ref={canvasRef}
                width={size}
                height={size}
                className="relative rounded-lg"
                style={{ width: Math.min(400, size), height: Math.min(400, size), display: 'block' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              />
              <canvas
                ref={overlayRef}
                width={size}
                height={size}
                className="absolute inset-0 rounded-lg pointer-events-none"
                style={{ width: Math.min(400, size), height: Math.min(400, size) }}
              />
            </div>
          </div>

          {/* Right panel */}
          <div className="w-52 flex flex-col gap-4 p-3 border-l border-white/10 bg-black/20 overflow-y-auto">
            {/* Color picker */}
            <div>
              <p className="text-xs text-zinc-500 mb-2 font-medium">Цвет</p>
              <div className="flex items-center gap-2 mb-2">
                <div
                  className="w-8 h-8 rounded-lg border-2 border-white/20 flex-shrink-0"
                  style={{ backgroundColor: color }}
                />
                <input
                  type="color"
                  value={color}
                  onChange={e => setColor(e.target.value)}
                  className="flex-1 h-8 rounded-lg cursor-pointer bg-transparent border border-white/10"
                />
              </div>
              <div className="grid grid-cols-6 gap-1">
                {PALETTE.map(c => (
                  <button
                    key={c}
                    onClick={() => setColor(c)}
                    className={`w-6 h-6 rounded-md transition-transform hover:scale-110 ${color === c ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            {/* Brush size */}
            <div>
              <p className="text-xs text-zinc-500 mb-2 font-medium">Размер: {brushSize}px</p>
              <input
                type="range"
                min={1}
                max={80}
                value={brushSize}
                onChange={e => setBrushSize(parseInt(e.target.value))}
                className="w-full accent-nexo-500"
              />
              <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                <span>1</span><span>80</span>
              </div>
            </div>

            {/* Opacity */}
            <div>
              <p className="text-xs text-zinc-500 mb-2 font-medium">Прозрачность: {Math.round(opacity * 100)}%</p>
              <input
                type="range"
                min={0.01}
                max={1}
                step={0.01}
                value={opacity}
                onChange={e => setOpacity(parseFloat(e.target.value))}
                className="w-full accent-nexo-500"
              />
            </div>

            {/* Font size (for text tool) */}
            {tool === 'text' && (
              <div>
                <p className="text-xs text-zinc-500 mb-2 font-medium">Размер шрифта: {fontSize}px</p>
                <input
                  type="range"
                  min={8}
                  max={128}
                  value={fontSize}
                  onChange={e => setFontSize(parseInt(e.target.value))}
                  className="w-full accent-nexo-500"
                />
              </div>
            )}

            {/* Zoom */}
            <div>
              <p className="text-xs text-zinc-500 mb-2 font-medium">Масштаб: {Math.round(zoom * 100)}%</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                  <ZoomOut size={16} />
                </button>
                <button onClick={() => setZoom(1)} className="flex-1 text-xs text-zinc-500 hover:text-white transition-colors">
                  <RotateCcw size={12} className="inline mr-1" />
                  Сброс
                </button>
                <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                  <ZoomIn size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
          <p className="text-xs text-zinc-500">
            {size}×{size}px · PNG с прозрачностью
          </p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-xl text-sm text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
              Отмена
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-sm bg-nexo-500 hover:bg-nexo-400 text-white font-medium transition-colors flex items-center gap-2"
            >
              <Check size={16} />
              Сохранить стикер
            </button>
          </div>
        </div>
      </motion.div>

      {/* Text input overlay */}
      <AnimatePresence>
        {showTextInput && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50"
            onClick={() => setShowTextInput(false)}
          >
            <div
              className="bg-[#1a1a24] rounded-2xl border border-white/10 p-4 w-80 shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <p className="text-sm text-zinc-400 mb-3">Введите текст</p>
              <input
                type="text"
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-nexo-500/50 mb-3"
                placeholder="Текст..."
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setShowTextInput(false)} className="flex-1 py-2 rounded-xl text-sm text-zinc-400 hover:bg-white/10 transition-colors">
                  Отмена
                </button>
                <button onClick={handleTextSubmit} className="flex-1 py-2 rounded-xl text-sm bg-nexo-500 text-white hover:bg-nexo-400 transition-colors">
                  Добавить
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
