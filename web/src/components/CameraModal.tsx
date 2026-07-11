import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Camera, Video, FlipHorizontal, Check, Loader2 } from 'lucide-react';
import BottomSheet from './BottomSheet';

interface CameraModalProps {
  onClose: () => void;
  onCapture: (file: File, type: 'image' | 'video') => void;
}

export default function CameraModal({ onClose, onCapture }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 640);

  const timerRef = useRef<ReturnType<typeof setInterval>>(undefined);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [facingMode]);

  const startCamera = async () => {
    try {
      setCameraError(null);
      stopCamera();

      const isMobile = window.innerWidth < 640;
      
      // Try with ideal constraints first, then fallback to simpler ones
      let stream: MediaStream | null = null;
      
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode,
            width: isMobile ? { ideal: 720 } : { ideal: 1280 },
            height: isMobile ? { ideal: 1280 } : { ideal: 720 },
          },
          audio: mode === 'video',
        });
      } catch (e) {
        // Fallback: try without resolution constraints
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode,
            },
            audio: mode === 'video',
          });
        } catch (e2) {
          // Last fallback: try any video device
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: mode === 'video',
            });
          } catch (e3) {
            console.error('All camera attempts failed:', e3);
            setCameraError('Не удалось открыть камеру. Проверьте разрешения браузера.');
            return;
          }
        }
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setIsReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      setCameraError('Не удалось открыть камеру');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsReady(false);
  };

  const flipCamera = () => setFacingMode(prev => prev === 'user' ? 'environment' : 'user');

  const takePhoto = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (facingMode === 'user') { ctx.translate(canvas.width, 0); ctx.scale(-1, 1); }
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `photo_${Date.now()}.jpg`, { type: 'image/jpeg' }), 'image');
    }, 'image/jpeg', 0.95);
  }, [facingMode, onCapture]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      if (mediaRecorderRef.current?.state === 'recording') mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    } else {
      startRecording();
    }
  }, [isRecording]);

  const startRecording = () => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      onCapture(new File([blob], `video_${Date.now()}.webm`, { type: mimeType }), 'video');
    };
    recorder.start();
    setIsRecording(true);
    setRecordingTime(0);
    timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  const cameraContent = (
    <>
      {/* Camera view */}
      <div className="relative bg-black">
        <div className={`${isMobile ? 'aspect-[9/16] max-h-[60vh] mx-auto' : 'aspect-video'} relative`}>
          {cameraError ? (
            <div className="flex items-center justify-center h-full text-white p-4 text-center">
              <div><Camera size={32} className="mx-auto mb-2 opacity-50" /><p className="text-sm">{cameraError}</p></div>
            </div>
          ) : !isReady ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 size={32} className="text-white animate-spin" />
            </div>
          ) : (
            <>
              <video ref={videoRef} autoPlay playsInline muted
                className={`w-full h-full object-cover ${facingMode === 'user' ? '-scale-x-100' : ''}`} />
              <canvas ref={canvasRef} className="hidden" />
              {isRecording && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-red-500/90 px-3 py-1 rounded-full flex items-center gap-2">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  <span className="text-white font-mono text-xs">{formatTime(recordingTime)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      {!cameraError && (
        <div className="p-4 flex items-center justify-center gap-8 bg-black/10">
          <button
            onClick={mode === 'photo' ? takePhoto : toggleRecording}
            disabled={!isReady}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all disabled:opacity-40 ${
              mode === 'photo' ? 'bg-white hover:bg-white/90' : isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-white hover:bg-white/90'
            }`}
          >
            {mode === 'photo' ? <div className="w-12 h-12 rounded-full border-4 border-black/20" />
              : isRecording ? <div className="w-6 h-6 rounded-sm bg-white" />
              : <div className="w-12 h-12 rounded-full border-4 border-red-500" />}
          </button>
        </div>
      )}

      <p className="text-center text-white/40 text-xs pb-3">
        {mode === 'photo' ? 'Нажмите для снимка' : isRecording ? 'Нажмите для остановки' : 'Нажмите для записи'}
      </p>
    </>
  );

  const headerContent = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
        <X size={16} />
      </button>

      <div className="flex gap-1 bg-white/5 rounded-full p-0.5">
        <button
          onClick={() => setMode('photo')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'photo' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
        >
          <Camera size={12} /> Фото
        </button>
        <button
          onClick={() => setMode('video')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-colors ${mode === 'video' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white'}`}
        >
          <Video size={12} /> Видео
        </button>
      </div>

      <button onClick={flipCamera} className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20">
        <FlipHorizontal size={16} />
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={true} onClose={onClose} showCloseButton={false} maxHeight="95vh">
        {headerContent}
        {cameraContent}
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg bg-[#1a1a1a] rounded-2xl overflow-hidden shadow-2xl border border-white/10"
      >
        {headerContent}
        {cameraContent}
      </motion.div>
    </motion.div>
  );
}
