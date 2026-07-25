import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Loader2, RotateCcw } from 'lucide-react';
import { api } from '../lib/api';

interface VideoNoteRecorderProps {
  chatId: string;
  onClose: () => void;
  onSent: () => void;
}

export default function VideoNoteRecorder({ chatId, onClose, onSent }: VideoNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  const startCamera = async () => {
    // Останавливаем предыдущий стрим
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode,
          width: { ideal: 480 },
          height: { ideal: 480 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: true, // нужен звук для видео-кружка
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
          setCameraReady(true);
        };
      }
    } catch (err: any) {
      console.error('[VideoNote] Camera error:', err);
      if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('Камера не найдена');
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Разрешите доступ к камере и микрофону');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Камера занята другим приложением');
      } else if (err.name === 'OverconstrainedError') {
        // Пробуем без ограничений
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play().catch(() => {});
              setCameraReady(true);
            };
          }
        } catch {
          setError('Не удалось запустить камеру');
        }
      } else {
        setError('Ошибка камеры: ' + (err.message || err.name));
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const toggleCamera = () => {
    if (isRecording) return;
    setFacingMode(prev => (prev === 'user' ? 'environment' : 'user'));
  };

  const startRecording = () => {
    if (!streamRef.current || !cameraReady) return;
    chunksRef.current = [];

    try {
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : '';

      const options: MediaRecorderOptions = { videoBitsPerSecond: 750000 };
      if (mimeType) options.mimeType = mimeType;

      const mediaRecorder = new MediaRecorder(streamRef.current, options);

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => sendVideoNote();

      mediaRecorder.start(100); // собираем чанки каждые 100мс
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration(prev => {
          if (prev + 1 >= 90) {
            stopRecording();
            return 90;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.error('[VideoNote] Recording error:', err);
      setError('Ошибка записи: ' + (err.message || err.name));
    }
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const sendVideoNote = async () => {
    setIsSending(true);
    try {
      if (chunksRef.current.length === 0) {
        setError('Видео не записано');
        setIsSending(false);
        return;
      }

      const mimeType = chunksRef.current[0]?.type || 'video/webm';
      const blob = new Blob(chunksRef.current, { type: mimeType });

      if (blob.size < 100) {
        setError('Видео слишком короткое');
        setIsSending(false);
        return;
      }

      if (blob.size > 10 * 1024 * 1024) {
        setError('Видео слишком большое (макс. 10 МБ)');
        setIsSending(false);
        return;
      }

      const file = new File([blob], `video-note-${Date.now()}.webm`, { type: mimeType });

      const formData = new FormData();
      formData.append('video', file);
      formData.append('chatId', chatId);
      formData.append('duration', String(Math.min(duration, 90)));

      const result = await api.uploadVideoNote(formData);

      chunksRef.current = [];
      onSent();
      onClose();
    } catch (err: any) {
      console.error('[VideoNote] Send error:', err);
      setError('Ошибка отправки: ' + (err.message || 'неизвестная ошибка'));
      setIsSending(false);
    }
  };

  const handleCancel = () => {
    if (isRecording) stopRecording();
    chunksRef.current = [];
    onClose();
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return createPortal(
    <AnimatePresence>
      {/* Overlay — z-index выше всего чата */}
      <motion.div
        key="video-note-overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center"
        style={{ zIndex: 99999 }}
        onClick={handleCancel}
      >
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.85, opacity: 0 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="relative flex flex-col items-center"
          style={{ width: 'min(280px, 80vw)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Кнопка закрыть */}
          <button
            onClick={handleCancel}
            className="absolute -top-14 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X size={20} className="text-white" />
          </button>

          {/* Таймер */}
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 text-white text-sm font-bold mb-3"
            >
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {formatTime(duration)} / 01:30
            </motion.div>
          )}

          {/* Видео-кружок */}
          <div className="relative w-full aspect-square mb-4">
            <div className="w-full h-full rounded-full overflow-hidden ring-2 ring-white/20 shadow-2xl bg-zinc-900">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
              />
              {/* Заглушка пока камера не готова */}
              {!cameraReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 rounded-full">
                  <Loader2 size={28} className="text-zinc-500 animate-spin" />
                </div>
              )}
            </div>

            {/* Прогресс-кольцо */}
            {isRecording && (
              <svg
                className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                viewBox="0 0 100 100"
              >
                <circle cx="50" cy="50" r="48" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2" />
                <circle
                  cx="50"
                  cy="50"
                  r="48"
                  fill="none"
                  stroke="#ef4444"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(duration / 90) * 301.6} 301.6`}
                  style={{ transition: 'stroke-dasharray 1s linear' }}
                />
              </svg>
            )}

            {/* Кнопка смены камеры */}
            <button
              onClick={toggleCamera}
              disabled={isRecording}
              className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 hover:bg-black/70 flex items-center justify-center disabled:opacity-40 transition-colors"
            >
              <RotateCcw size={14} className="text-white" />
            </button>
          </div>

          {/* Ошибка */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/40 text-red-200 text-xs text-center mb-3 max-w-full"
            >
              {error}
              <button
                onClick={() => { setError(null); startCamera(); }}
                className="block mx-auto mt-1 text-red-300 hover:text-white underline text-xs"
              >
                Попробовать снова
              </button>
            </motion.div>
          )}

          {/* Кнопка записи */}
          {!isSending && !error && (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              disabled={!cameraReady}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-2xl disabled:opacity-40 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600'
                  : 'bg-white hover:bg-gray-100'
              }`}
            >
              {isRecording ? (
                <div className="w-6 h-6 rounded-md bg-white" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-red-500" />
              )}
            </button>
          )}

          {/* Отправка */}
          {isSending && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-white"
            >
              <Loader2 size={18} className="animate-spin" />
              <span className="text-sm">Отправка...</span>
            </motion.div>
          )}

          {/* Подсказка */}
          {!isRecording && !error && !isSending && cameraReady && (
            <p className="mt-3 text-white/40 text-xs text-center">Нажмите для записи • макс. 1:30</p>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
