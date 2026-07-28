import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Video, Circle, Square, Pause, Play, Send, X, Settings, Clock, Loader,
  Monitor, Mic, Camera,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface ScreenRecordingProps {
  onClose: () => void;
  onSend?: (blob: Blob) => void;
}

type RecordingState = 'idle' | 'recording' | 'paused' | 'preview';

export default function ScreenRecording({ onClose, onSend }: ScreenRecordingProps) {
  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [quality, setQuality] = useState<'720p' | '1080p' | '4k'>('1080p');
  const [includeAudio, setIncludeAudio] = useState(true);
  const [history, setHistory] = useState<Array<{ id: string; duration: number; size: string; timestamp: string }>>([
    { id: '1', duration: 45, size: '12.3 MB', timestamp: '2025-01-10T14:30:00' },
    { id: '2', duration: 120, size: '34.1 MB', timestamp: '2025-01-12T09:15:00' },
  ]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' } as any,
        audio: includeAudio,
      });
      streamRef.current = stream;

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
      chunksRef.current = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        setPreviewUrl(URL.createObjectURL(blob));
        setState('preview');
        setHistory(prev => [{
          id: Date.now().toString(),
          duration,
          size: `${(blob.size / (1024 * 1024)).toFixed(1)} MB`,
          timestamp: new Date().toISOString(),
        }, ...prev]);
      };

      stream.getVideoTracks()[0].onended = () => stopRecording();
      recorder.start(1000);
      recorderRef.current = recorder;
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch {
      toast.error('Не удалось начать запись');
    }
  }, [includeAudio, duration]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (state === 'recording') setState('idle');
  }, [state]);

  const pauseRecording = useCallback(() => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.pause();
      if (timerRef.current) clearInterval(timerRef.current);
      setState('paused');
    }
  }, []);

  const resumeRecording = useCallback(() => {
    if (recorderRef.current?.state === 'paused') {
      recorderRef.current.resume();
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      setState('recording');
    }
  }, []);

  const handleSend = useCallback(() => {
    if (previewUrl && onSend) {
      fetch(previewUrl).then(r => r.blob()).then(b => onSend(b));
      toast.success('Запись отправлена');
    }
    setPreviewUrl(null);
    setState('idle');
    setDuration(0);
  }, [previewUrl, onSend]);

  const handleDiscard = useCallback(() => {
    setPreviewUrl(null);
    setState('idle');
    setDuration(0);
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
            <Video size={15} className="text-red-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Запись экрана</h2>
        </div>
        <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <X size={15} className="text-white/40" />
        </motion.button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* Recording area */}
        {state === 'idle' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center py-8">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
              <Monitor size={28} className="text-red-400/60" />
            </div>
            <p className="text-sm text-white/40 mb-1">Запись экрана</p>
            <p className="text-xs text-white/20 mb-6">Нажмите для начала записи</p>
            <motion.button onClick={startRecording}
              className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-400/40 flex items-center justify-center hover:bg-red-500/30 transition-colors"
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Circle size={24} className="text-red-400 fill-red-400/30" />
            </motion.button>
          </motion.div>
        )}

        {(state === 'recording' || state === 'paused') && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8">
            <motion.div className="w-20 h-20 rounded-full bg-red-500/10 border-2 border-red-400/30 flex items-center justify-center mb-4" animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
              {state === 'recording' ? (
                <div className="w-6 h-6 rounded-sm bg-red-400/80" />
              ) : (
                <Pause size={24} className="text-red-400/80" />
              )}
            </motion.div>
            <p className="text-lg font-mono text-white/70 mb-1">{formatDuration(duration)}</p>
            <p className="text-xs text-red-400/50 mb-6">{state === 'recording' ? 'Запись...' : 'Пауза'}</p>
            <div className="flex gap-3">
              {state === 'recording' ? (
                <motion.button onClick={pauseRecording} className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors" whileTap={{ scale: 0.95 }}>
                  <Pause size={18} className="text-white/60" />
                </motion.button>
              ) : (
                <motion.button onClick={resumeRecording} className="p-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors" whileTap={{ scale: 0.95 }}>
                  <Play size={18} className="text-white/60 ml-0.5" />
                </motion.button>
              )}
              <motion.button onClick={stopRecording} className="p-3 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors" whileTap={{ scale: 0.95 }}>
                <Square size={18} className="text-red-400" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {state === 'preview' && previewUrl && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <video src={previewUrl} controls className="w-full rounded-xl border border-white/[0.06]" />
            <div className="flex gap-2">
              <motion.button onClick={handleDiscard}
                className="flex-1 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.06] text-xs text-white/50 hover:bg-white/[0.08] transition-colors"
                whileTap={{ scale: 0.98 }}>Отмена</motion.button>
              <motion.button onClick={handleSend}
                className="flex-1 py-2.5 rounded-xl bg-indigo-500/20 border border-indigo-500/20 text-xs text-indigo-400/80 font-medium hover:bg-indigo-500/30 transition-colors flex items-center justify-center gap-1.5"
                whileTap={{ scale: 0.98 }}>
                <Send size={12} />Отправить
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Settings */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Settings size={12} className="text-white/30" />
            <span className="text-xs text-white/50 font-medium">Настройки</span>
          </div>
          <div>
            <label className="text-[10px] text-white/30 block mb-1">Качество</label>
            <div className="flex gap-1">
              {(['720p', '1080p', '4k'] as const).map(q => (
                <button key={q} onClick={() => setQuality(q)}
                  className={`px-3 py-1 rounded-lg text-[10px] transition-colors ${quality === q ? 'bg-white/[0.1] text-white/70 border border-white/[0.08]' : 'text-white/30 hover:bg-white/[0.04]'}`}>
                  {q}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/30">Звук</span>
            <div onClick={() => setIncludeAudio(v => !v)} className={`w-8 h-4.5 rounded-full transition-colors relative cursor-pointer ${includeAudio ? 'bg-red-500/40' : 'bg-white/[0.08]'}`}
              style={{ width: 32, height: 18 }}>
              <motion.div animate={{ x: includeAudio ? 14 : 2 }} transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="w-3.5 h-3.5 rounded-full bg-white/80 absolute" style={{ top: 1 }} />
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 px-1">История</p>
            <div className="space-y-1">
              {history.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <Video size={12} className="text-white/20 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/40">Запись · {formatDuration(h.duration)} · {h.size}</p>
                    <p className="text-[9px] text-white/20">{new Date(h.timestamp).toLocaleString('ru-RU')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}