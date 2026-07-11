import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  X, Pencil, Eraser, Trash2, Undo2, Download, Send,
  Minus, Plus, Palette, Square, Circle, Minus as LineIcon
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useToastStore } from '../stores/toastStore';
import { getSocket } from '../lib/socket';

interface DrawingBoardProps {
  chatId: string;
  sessionId?: string;
  onClose: () => void;
  onSaveAsMessage?: (imageDataUrl: string) => void;
}

type Tool = 'pen' | 'eraser' | 'line' | 'rect' | 'circle';

interface Stroke {
  tool: Tool;
  color: string;
  width: number;
  points: { x: number; y: number }[];
  startX?: number;
  startY?: number;
  endX?: number;
  endY?: number;
}

const COLORS = [
  '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ec4899', '#000000', '#6b7280',
];

export default function ChatDrawingBoard({ chatId, sessionId: initialSessionId, onClose, onSaveAsMessage }: DrawingBoardProps) {
  const { user } = useAuthStore();
  const { success, error: showError } = useToastStore();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#ffffff');
  const [lineWidth, setLineWidth] = useState(3);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [saving, setSaving] = useState(false);
  const [remoteCursors, setRemoteCursors] = useState<Record<string, { x: number; y: number }>>({});

  const startX = useRef(0);
  const startY = useRef(0);

  useEffect(() => {
    initSession();
    setupSocketListeners();
    return () => cleanupSocketListeners();
  }, [chatId]);

  useEffect(() => {
    redrawCanvas();
  }, [strokes]);

  const initSession = async () => {
    if (initialSessionId) {
      // Load existing session
      try {
        const data = await api.get<{ session: any }>(`/drawing-chat/chat/${chatId}`);
        if (data.session?.canvasData) {
          loadCanvasFromData(data.session.canvasData);
        }
        setSessionId(data.session?.id || null);
      } catch {
        // Start new session
        await startNewSession();
      }
    } else {
      await startNewSession();
    }
  };

  const startNewSession = async () => {
    try {
      const data = await api.post<{ session: any }>(`/drawing-chat/chat/${chatId}/start`, {
        title: 'Доска',
      });
      setSessionId(data.session.id);
    } catch (e: any) {
      showError(e.message || 'Ошибка создания сессии');
    }
  };

  const setupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;

    socket.on('drawing:stroke', handleRemoteStroke);
    socket.on('drawing:clear', handleRemoteClear);
    socket.on('drawing:undo', handleRemoteUndo);
    socket.on('drawing:cursor', handleRemoteCursor);
    socket.on('drawing:session_ended', handleSessionEnded);
  };

  const cleanupSocketListeners = () => {
    const socket = getSocket();
    if (!socket) return;
    socket.off('drawing:stroke', handleRemoteStroke);
    socket.off('drawing:clear', handleRemoteClear);
    socket.off('drawing:undo', handleRemoteUndo);
    socket.off('drawing:cursor', handleRemoteCursor);
    socket.off('drawing:session_ended', handleSessionEnded);
  };

  const handleRemoteStroke = useCallback((data: { sessionId: string; stroke: Stroke; userId: string }) => {
    if (data.userId === user?.id) return;
    setStrokes(prev => [...prev, data.stroke]);
  }, [user?.id]);

  const handleRemoteClear = useCallback((data: { sessionId: string; userId: string }) => {
    if (data.userId === user?.id) return;
    setStrokes([]);
  }, [user?.id]);

  const handleRemoteUndo = useCallback((data: { sessionId: string; userId: string }) => {
    if (data.userId === user?.id) return;
    setStrokes(prev => prev.slice(0, -1));
  }, [user?.id]);

  const handleRemoteCursor = useCallback((data: { sessionId: string; userId: string; x: number; y: number }) => {
    if (data.userId === user?.id) return;
    setRemoteCursors(prev => ({ ...prev, [data.userId]: { x: data.x, y: data.y } }));
  }, [user?.id]);

  const handleSessionEnded = useCallback(() => {
    onClose();
  }, [onClose]);

  const loadCanvasFromData = (dataUrl: string) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = new Image();
    img.onload = () => ctx.drawImage(img, 0, 0);
    img.src = dataUrl;
  };

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      drawStroke(ctx, stroke);
    }
  };

  const drawStroke = (ctx: CanvasRenderingContext2D, stroke: Stroke) => {
    ctx.strokeStyle = stroke.tool === 'eraser' ? '#1a1a2e' : stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (stroke.tool === 'pen' || stroke.tool === 'eraser') {
      if (stroke.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    } else if (stroke.tool === 'line' && stroke.startX !== undefined) {
      ctx.beginPath();
      ctx.moveTo(stroke.startX!, stroke.startY!);
      ctx.lineTo(stroke.endX!, stroke.endY!);
      ctx.stroke();
    } else if (stroke.tool === 'rect' && stroke.startX !== undefined) {
      ctx.strokeRect(stroke.startX!, stroke.startY!, stroke.endX! - stroke.startX!, stroke.endY! - stroke.startY!);
    } else if (stroke.tool === 'circle' && stroke.startX !== undefined) {
      const rx = Math.abs(stroke.endX! - stroke.startX!) / 2;
      const ry = Math.abs(stroke.endY! - stroke.startY!) / 2;
      const cx = stroke.startX! + (stroke.endX! - stroke.startX!) / 2;
      const cy = stroke.startY! + (stroke.endY! - stroke.startY!) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  const getCanvasPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getCanvasPos(e);
    startX.current = pos.x;
    startY.current = pos.y;
    setIsDrawing(true);

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentStroke({
        tool,
        color,
        width: lineWidth,
        points: [pos],
      });
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const pos = getCanvasPos(e);

    // Emit cursor position
    const socket = getSocket();
    if (socket && sessionId) {
      socket.emit('drawing:cursor', { chatId, sessionId, x: pos.x, y: pos.y });
    }

    if (!isDrawing) return;

    if (tool === 'pen' || tool === 'eraser') {
      setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos] } : prev);
      // Draw incrementally
      const canvas = canvasRef.current;
      if (canvas && currentStroke) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = tool === 'eraser' ? '#1a1a2e' : color;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          const pts = currentStroke.points;
          if (pts.length > 0) {
            ctx.beginPath();
            ctx.moveTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
            ctx.lineTo(pos.x, pos.y);
            ctx.stroke();
          }
        }
      }
    } else {
      // Shape preview on overlay canvas
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, overlay.width, overlay.height);
          const previewStroke: Stroke = {
            tool,
            color,
            width: lineWidth,
            points: [],
            startX: startX.current,
            startY: startY.current,
            endX: pos.x,
            endY: pos.y,
          };
          drawStroke(ctx, previewStroke);
        }
      }
    }
  };

  const handlePointerUp = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    const pos = getCanvasPos(e);
    let stroke: Stroke;

    if (tool === 'pen' || tool === 'eraser') {
      if (!currentStroke) return;
      stroke = currentStroke;
    } else {
      stroke = {
        tool,
        color,
        width: lineWidth,
        points: [],
        startX: startX.current,
        startY: startY.current,
        endX: pos.x,
        endY: pos.y,
      };
      // Clear overlay
      const overlay = overlayRef.current;
      if (overlay) {
        const ctx = overlay.getContext('2d');
        ctx?.clearRect(0, 0, overlay.width, overlay.height);
      }
    }

    setStrokes(prev => [...prev, stroke]);
    setCurrentStroke(null);

    // Emit to other users
    const socket = getSocket();
    if (socket && sessionId) {
      socket.emit('drawing:stroke', { chatId, sessionId, stroke });
    }
  };

  const handleClear = () => {
    setStrokes([]);
    const socket = getSocket();
    if (socket && sessionId) {
      socket.emit('drawing:clear', { chatId, sessionId });
    }
  };

  const handleUndo = () => {
    setStrokes(prev => prev.slice(0, -1));
    const socket = getSocket();
    if (socket && sessionId) {
      socket.emit('drawing:undo', { chatId, sessionId });
    }
  };

  const handleSave = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const imageDataUrl = canvas.toDataURL('image/png');
      if (sessionId) {
        await api.post(`/drawing-chat/${sessionId}/save`, { imageDataUrl });
      }
      if (onSaveAsMessage) {
        onSaveAsMessage(imageDataUrl);
      }
      success('Рисунок сохранён');
      onClose();
    } catch (e: any) {
      showError(e.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'drawing.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-[#0f0f1a]"
    >
      {/* Toolbar */}
      <div className="flex items-center gap-2 p-3 bg-[#1a1a2e] border-b border-white/10 flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1">
          {([
            { id: 'pen', icon: Pencil, label: 'Кисть' },
            { id: 'eraser', icon: Eraser, label: 'Ластик' },
            { id: 'line', icon: Minus, label: 'Линия' },
            { id: 'rect', icon: Square, label: 'Прямоугольник' },
            { id: 'circle', icon: Circle, label: 'Эллипс' },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTool(t.id as Tool)}
              title={t.label}
              className={`p-2 rounded-lg transition-colors ${tool === t.id ? 'bg-indigo-500 text-white' : 'text-white/50 hover:text-white hover:bg-white/10'}`}
            >
              <t.icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-125' : 'border-transparent'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Line width */}
        <div className="flex items-center gap-1">
          <button onClick={() => setLineWidth(w => Math.max(1, w - 1))} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">
            <Minus className="w-3 h-3" />
          </button>
          <span className="text-xs text-white/50 w-4 text-center">{lineWidth}</span>
          <button onClick={() => setLineWidth(w => Math.min(20, w + 1))} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50">
            <Plus className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1" />

        {/* Actions */}
        <button onClick={handleUndo} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Отменить">
          <Undo2 className="w-4 h-4" />
        </button>
        <button onClick={handleClear} className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors" title="Очистить">
          <Trash2 className="w-4 h-4" />
        </button>
        <button onClick={handleDownload} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors" title="Скачать">
          <Download className="w-4 h-4" />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          {saving ? 'Сохранение...' : 'Отправить'}
        </button>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={1200}
          height={800}
          className="absolute inset-0 w-full h-full touch-none"
          style={{ cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={() => setIsDrawing(false)}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
        />
        {/* Overlay for shape preview */}
        <canvas
          ref={overlayRef}
          width={1200}
          height={800}
          className="absolute inset-0 w-full h-full pointer-events-none"
        />
        {/* Remote cursors */}
        {Object.entries(remoteCursors).map(([uid, pos]) => (
          <div
            key={uid}
            className="absolute w-3 h-3 rounded-full bg-green-400 pointer-events-none transform -translate-x-1/2 -translate-y-1/2"
            style={{
              left: `${(pos.x / 1200) * 100}%`,
              top: `${(pos.y / 800) * 100}%`,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
