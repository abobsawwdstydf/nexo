import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, X, Loader2, ScanLine } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState('');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const detectorRef = useRef<any>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    setIsActive(false);
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      streamRef.current = stream;
      setHasPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsActive(true);

        // Try BarcodeDetector API first (Chrome/Edge)
        if ('BarcodeDetector' in window) {
          try {
            detectorRef.current = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          } catch {
            detectorRef.current = null;
          }
        }

        scanFrame();
      }
    } catch (err: any) {
      setHasPermission(false);
      if (err.name === 'NotAllowedError') {
        setError('Доступ к камере запрещён. Разрешите доступ в настройках.');
      } else if (err.name === 'NotFoundError') {
        setError('Камера не найдена');
      } else {
        setError('Не удалось открыть камеру');
      }
    }
  }, []);

  const scanFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animFrameRef.current = requestAnimationFrame(scanFrame);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    // Method 1: BarcodeDetector API
    if (detectorRef.current) {
      detectorRef.current.detect(canvas).then((barcodes: any[]) => {
        if (barcodes.length > 0) {
          const data = barcodes[0].rawValue;
          if (data) {
            onScan(data);
            stopCamera();
            return;
          }
        }
        animFrameRef.current = requestAnimationFrame(scanFrame);
      }).catch(() => {
        animFrameRef.current = requestAnimationFrame(scanFrame);
      });
      return;
    }

    // Method 2: Canvas pixel analysis fallback (basic scan line detection)
    // For full QR decoding without a library, we rely on BarcodeDetector
    animFrameRef.current = requestAnimationFrame(scanFrame);
  }, [onScan, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80 backdrop-blur-xl z-10">
        <button onClick={() => { stopCamera(); onClose(); }} className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors">
          <X size={20} />
        </button>
        <h2 className="text-sm font-semibold text-white">Сканирование QR-кода</h2>
        <div className="w-9" />
      </div>

      {/* Camera preview */}
      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          playsInline
          muted
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Scan overlay */}
        {isActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            {/* Dimmed corners */}
            <div className="absolute inset-0">
              <div className="absolute inset-0 bg-black/40" />
              {/* Clear center square */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 bg-transparent" />
            </div>

            {/* Scan frame border */}
            <div className="relative w-56 h-56">
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-lg" />

              {/* Animated scan line */}
              <motion.div
                className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-nexo-400 to-transparent"
                animate={{ top: ['8%', '88%', '8%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
              />
            </div>

            {/* Hint text */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="absolute bottom-20 left-0 right-0 text-center text-sm text-white/70 drop-shadow-lg"
            >
              Наведите камеру на QR-код
            </motion.p>
          </div>
        )}

        {/* Loading state */}
        {!isActive && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
            <Loader2 size={32} className="text-white animate-spin mb-3" />
            <p className="text-sm text-zinc-400">Запуск камеры...</p>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 px-6">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
              <Camera size={28} className="text-red-400" />
            </div>
            <p className="text-sm text-white text-center mb-4">{error}</p>
            <button
              onClick={startCamera}
              className="px-6 py-2.5 rounded-xl bg-nexo-500 text-white text-sm font-medium hover:bg-nexo-600 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        )}

        {/* No BarcodeDetector support hint */}
        {isActive && !detectorRef.current && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-4 left-4 right-4 p-3 rounded-xl bg-amber-500/20 border border-amber-500/30 backdrop-blur-sm"
          >
            <p className="text-xs text-amber-300 text-center">
              QR-сканирование недоступно в этом браузере. Используйте Chrome или Edge.
            </p>
          </motion.div>
        )}
      </div>

      {/* Bottom hint */}
      <div className="px-4 py-4 bg-black/80 backdrop-blur-xl">
        <div className="flex items-center justify-center gap-2 text-zinc-500">
          <ScanLine size={16} />
          <span className="text-xs">Сканируйте QR-код для входа на другом устройстве</span>
        </div>
      </div>
    </motion.div>
  );
}
