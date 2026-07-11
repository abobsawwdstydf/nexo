import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, RotateCcw, RotateCw, Download, Palette, Eraser } from 'lucide-react';
import { getSocket } from '../lib/socket';

interface DrawingBoardProps {
  callId: string;
  onClose: () => void;
  onSave?: (imageData: string) => void;
}

export default function DrawingBoard({ callId, onClose, onSave }: DrawingBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(3);
  const [isEraser, setIsEraser] = useState(false);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [historyStep, setHistoryStep] = useState(-1);
  const socket = getSocket();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    // Fill with dark background
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Save initial state
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setHistory([imageData]);
    setHistoryStep(0);
  }, []);

  const saveState = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const newHistory = history.slice(0, historyStep + 1);
    newHistory.push(imageData);
    setHistory(newHistory);
    setHistoryStep(newHistory.length - 1);
  };

  const undo = () => {
    if (historyStep > 0) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      setHistoryStep(historyStep - 1);
      ctx.putImageData(history[historyStep - 1], 0, 0);
    }
  };

  const redo = () => {
    if (historyStep < history.length - 1) {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      setHistoryStep(historyStep + 1);
      ctx.putImageData(history[historyStep + 1], 0, 0);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isEraser) {
      ctx.clearRect(x - brushSize / 2, y - brushSize / 2, brushSize, brushSize);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    // Broadcast to other participants
    if (socket) {
      socket.emit('drawing_update', {
        callId,
        x,
        y,
        color: isEraser ? 'eraser' : color,
        brushSize,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    saveState();
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const imageData = canvas.toDataURL('image/png');
    if (onSave) {
      onSave(imageData);
    }

    // Download
    const link = document.createElement('a');
    link.href = imageData;
    link.download = `drawing-${Date.now()}.png`;
    link.click();
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveState();
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 sm:inset-auto sm:right-3 sm:top-3 sm:bottom-3 sm:w-[600px] sm:h-[500px] bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col z-50"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <h2 className="text-lg font-semibold text-white">Доска для рисования</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition"
        >
          <X size={20} className="text-white/60" />
        </button>
      </div>

      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="flex-1 cursor-crosshair bg-[#1a1a1a]"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-3 p-4 border-t border-white/10 flex-wrap">
        {/* Color picker */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-white/60">Цвет:</label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            disabled={isEraser}
            className="w-10 h-10 rounded cursor-pointer"
          />
        </div>

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-white/60">Размер:</label>
          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(parseInt(e.target.value))}
            className="w-24"
          />
          <span className="text-sm text-white/60">{brushSize}px</span>
        </div>

        {/* Tools */}
        <button
          onClick={() => setIsEraser(!isEraser)}
          className={`p-2 rounded-lg transition ${
            isEraser ? 'bg-nexo-500' : 'hover:bg-white/10'
          }`}
          title="Ластик"
        >
          <Eraser size={18} className="text-white" />
        </button>

        {/* Undo/Redo */}
        <button
          onClick={undo}
          disabled={historyStep <= 0}
          className="p-2 hover:bg-white/10 rounded-lg transition disabled:opacity-50"
          title="Отмена"
        >
          <RotateCcw size={18} className="text-white" />
        </button>

        <button
          onClick={redo}
          disabled={historyStep >= history.length - 1}
          className="p-2 hover:bg-white/10 rounded-lg transition disabled:opacity-50"
          title="Повтор"
        >
          <RotateCw size={18} className="text-white" />
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition text-sm"
        >
          Очистить
        </button>

        {/* Save */}
        <button
          onClick={handleSave}
          className="px-3 py-2 bg-nexo-500 hover:bg-nexo-600 text-white rounded-lg transition text-sm ml-auto flex items-center gap-2"
        >
          <Download size={16} />
          Сохранить
        </button>
      </div>
    </motion.div>
  );
}
