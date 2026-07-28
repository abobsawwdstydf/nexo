import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Pen, Eraser, Square, Circle, Type, Minus, Undo2, Redo2, Trash2,
  Palette, Download, Share2, X, Loader, MousePointer, Check,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

type Tool = 'pen' | 'eraser' | 'rect' | 'circle' | 'line' | 'text' | 'select';

interface WhiteboardPanelProps {
  onClose: () => void;
}

const COLORS = ['#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899'];
const SIZES = [2, 4, 8, 12, 20];

export default function WhiteboardPanel({ onClose }: WhiteboardPanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [size, setSize] = useState(4);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [undoStack, setUndoStack] = useState<ImageData[]>([]);
  const [redoStack, setRedoStack] = useState<ImageData[]>([]);
  const [shareLink, setShareLink] = useState('');
  const [shared, setShared] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const saveState = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack(prev => [...prev.slice(-20), data]);
    setRedoStack([]);
  }, []);

  const getPos = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }, []);

  const startDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    saveState();
    const pos = getPos(e);
    lastPos.current = pos;
    setIsDrawing(true);

    if (tool === 'pen' || tool === 'eraser') {
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = tool === 'eraser' ? '#0a0a0f' : color;
      ctx.lineWidth = tool === 'eraser' ? size * 4 : size;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [tool, color, size, getPos, saveState]);

  const draw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const pos = getPos(e);

    if (tool === 'pen' || tool === 'eraser') {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
    }
    lastPos.current = pos;
  }, [isDrawing, tool, getPos]);

  const endDraw = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if ((tool === 'rect' || tool === 'circle' || tool === 'line') && lastPos.current) {
      const pos = getPos(e);
      const start = lastPos.current;
      ctx.strokeStyle = color;
      ctx.lineWidth = size;
      ctx.lineCap = 'round';

      if (tool === 'rect') {
        ctx.strokeRect(start.x, start.y, pos.x - start.x, pos.y - start.y);
      } else if (tool === 'circle') {
        const rx = Math.abs(pos.x - start.x) / 2;
        const ry = Math.abs(pos.y - start.y) / 2;
        const cx = start.x + (pos.x - start.x) / 2;
        const cy = start.y + (pos.y - start.y) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
    }

    if (tool === 'text' && lastPos.current) {
      const text = prompt('Введите текст:');
      if (text) {
        ctx.fillStyle = color;
        ctx.font = `${size * 4}px sans-serif`;
        ctx.fillText(text, lastPos.current.x, lastPos.current.y);
      }
    }

    setIsDrawing(false);
    lastPos.current = null;
  }, [isDrawing, tool, color, size, getPos]);

  const undo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || undoStack.length === 0) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setRedoStack(prev => [...prev, current]);
    const prev = undoStack[undoStack.length - 1];
    ctx.putImageData(prev, 0, 0);
    setUndoStack(s => s.slice(0, -1));
  }, [undoStack]);

  const redo = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || redoStack.length === 0) return;
    const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setUndoStack(prev => [...prev, current]);
    const next = redoStack[redoStack.length - 1];
    ctx.putImageData(next, 0, 0);
    setRedoStack(s => s.slice(0, -1));
  }, [redoStack]);

  const clearCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    saveState();
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, [saveState]);

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `nexo-whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, []);

  const handleShare = useCallback(() => {
    const link = `https://nexo.app/whiteboard/${Date.now().toString(36)}`;
    setShareLink(link);
    setShared(true);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = 800;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0a0f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const tools: { key: Tool; icon: typeof Pen; label: string }[] = [
    { key: 'pen', icon: Pen, label: 'Карандаш' },
    { key: 'eraser', icon: Eraser, label: 'Ластик' },
    { key: 'rect', icon: Square, label: 'Прямоугольник' },
    { key: 'circle', icon: Circle, label: 'Круг' },
    { key: 'line', icon: Minus, label: 'Линия' },
    { key: 'text', icon: Type, label: 'Текст' },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-pink-500/20 border border-pink-500/20 flex items-center justify-center">
            <Pen size={15} className="text-pink-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Whiteboard</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={handleShare} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <Share2 size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex-shrink-0 flex items-center gap-1 px-3 py-2 border-b border-white/[0.06] overflow-x-auto">
        {tools.map(t => {
          const Icon = t.icon;
          return (
            <motion.button key={t.key} onClick={() => setTool(t.key)}
              className={`p-2 rounded-lg transition-colors flex-shrink-0 ${tool === t.key ? 'bg-white/[0.1] text-white/80' : 'text-white/30 hover:bg-white/[0.06]'}`}
              whileTap={{ scale: 0.9 }} title={t.label}>
              <Icon size={14} />
            </motion.button>
          );
        })}
        <div className="w-px h-5 bg-white/[0.06] mx-1 flex-shrink-0" />
        <motion.button onClick={undo} className="p-2 rounded-lg text-white/30 hover:bg-white/[0.06] flex-shrink-0" whileTap={{ scale: 0.9 }} title="Отменить">
          <Undo2 size={14} />
        </motion.button>
        <motion.button onClick={redo} className="p-2 rounded-lg text-white/30 hover:bg-white/[0.06] flex-shrink-0" whileTap={{ scale: 0.9 }} title="Повторить">
          <Redo2 size={14} />
        </motion.button>
        <motion.button onClick={clearCanvas} className="p-2 rounded-lg text-red-400/50 hover:bg-red-500/10 flex-shrink-0" whileTap={{ scale: 0.9 }} title="Очистить">
          <Trash2 size={14} />
        </motion.button>
        <div className="w-px h-5 bg-white/[0.06] mx-1 flex-shrink-0" />
        <motion.button onClick={handleDownload} className="p-2 rounded-lg text-white/30 hover:bg-white/[0.06] flex-shrink-0" whileTap={{ scale: 0.9 }} title="Скачать">
          <Download size={14} />
        </motion.button>
        {/* Color picker */}
        <div className="relative flex-shrink-0">
          <button onClick={() => setShowColors(v => !v)} className="p-2 rounded-lg hover:bg-white/[0.06]">
            <div className="w-4 h-4 rounded-full border-2 border-white/20" style={{ backgroundColor: color }} />
          </button>
          <AnimatePresence>
            {showColors && (
              <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                className="absolute top-full mt-1 left-0 z-50 p-2 rounded-xl bg-black/80 backdrop-blur-xl border border-white/10 grid grid-cols-4 gap-1.5">
                {COLORS.map(c => (
                  <button key={c} onClick={() => { setColor(c); setShowColors(false); }}
                    className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${color === c ? 'border-white/60 scale-110' : 'border-white/10'}`}
                    style={{ backgroundColor: c }} />
                ))}
                <input type="color" value={color} onChange={e => setColor(e.target.value)}
                  className="w-6 h-6 rounded-full border-2 border-white/10 cursor-pointer col-span-4" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Size */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {SIZES.map(s => (
            <button key={s} onClick={() => setSize(s)}
              className={`w-5 h-5 rounded flex items-center justify-center ${size === s ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}>
              <div className="rounded-full bg-white/60" style={{ width: s, height: s }} />
            </button>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 overflow-hidden bg-[#0a0a0f] flex items-center justify-center p-2">
        <canvas ref={canvasRef} onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
          className="max-w-full max-h-full rounded-lg cursor-crosshair" style={{ imageRendering: 'auto' }} />
      </div>

      {/* Share link */}
      <AnimatePresence>
        {shared && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex-shrink-0 px-3 py-2 border-t border-white/[0.06]">
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03]">
              <Share2 size={11} className="text-white/30" />
              <input type="text" readOnly value={shareLink} className="flex-1 text-[10px] text-white/40 bg-transparent outline-none" />
              <motion.button onClick={() => { navigator.clipboard.writeText(shareLink); toast.success('Скопировано'); }}
                className="p-1 rounded hover:bg-white/[0.08]" whileTap={{ scale: 0.9 }}>
                <Check size={11} className="text-green-400/70" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}