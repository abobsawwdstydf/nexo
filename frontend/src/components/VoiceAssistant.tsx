import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Loader, Volume2, Clock, Trash2, Settings, X, Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface VoiceAssistantProps {
  onClose: () => void;
}

interface VoiceCommand {
  id: string;
  text: string;
  result: string;
  timestamp: string;
}

export default function VoiceAssistant({ onClose }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState('');
  const [history, setHistory] = useState<VoiceCommand[]>([]);
  const [wakeWord, setWakeWord] = useState('Hey Nexo');
  const [showSettings, setShowSettings] = useState(false);
  const [processing, setProcessing] = useState(false);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error('Распознавание речи не поддерживается');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: any) => {
      const t = Array.from(event.results).map((r: any) => r[0].transcript).join('');
      setTranscript(t);
      if (event.results[0].isFinal) {
        processCommand(t);
      }
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setTranscript('');
    setResult('');
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const processCommand = useCallback(async (text: string) => {
    setProcessing(true);
    try {
      const res = await api.aiChat([
        { role: 'system', content: 'Ты голосовой ассистент Нексо. Отвечай кратко на русском. Если пользователь просит действие — выполни его (отправь сообщение, найди контакт и т.д.).' },
        { role: 'user', content: text },
      ]);
      const cmd: VoiceCommand = {
        id: Date.now().toString(),
        text,
        result: res.text,
        timestamp: new Date().toISOString(),
      };
      setResult(res.text);
      setHistory(prev => [cmd, ...prev].slice(0, 30));
    } catch {
      setResult('Не удалось обработать команду');
    } finally {
      setProcessing(false);
    }
  }, []);

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center">
            <Mic size={15} className="text-emerald-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Голосовой ассистент</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => setShowSettings(v => !v)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Settings size={15} className="text-white/40" />
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-3 space-y-2">
              <label className="text-xs font-semibold text-white/40 uppercase tracking-wider">Ключевое слово</label>
              <input type="text" value={wakeWord} onChange={e => setWakeWord(e.target.value)}
                className="w-full h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 outline-none focus:border-white/20" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {/* Mic button */}
        <div className="flex flex-col items-center py-6">
          <motion.button onClick={isListening ? stopListening : startListening}
            className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-colors ${isListening ? 'bg-red-500/20 border-2 border-red-400/40' : 'bg-emerald-500/10 border-2 border-emerald-400/30 hover:bg-emerald-500/20'}`}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            {isListening && (
              <>
                <motion.div className="absolute inset-0 rounded-full border-2 border-red-400/30" animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }} />
                <motion.div className="absolute inset-0 rounded-full border-2 border-red-400/20" animate={{ scale: [1, 1.7, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
              </>
            )}
            {isListening ? <MicOff size={24} className="text-red-400" /> : <Mic size={24} className="text-emerald-400/70" />}
          </motion.button>
          <p className="text-xs text-white/30 mt-3">
            {isListening ? 'Нажмите для остановки' : 'Нажмите для начала'}
          </p>
        </div>

        {/* Transcript */}
        <AnimatePresence>
          {transcript && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3">
              <p className="text-[10px] text-white/30 uppercase mb-1">Распознано:</p>
              <p className="text-xs text-white/60">{transcript}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Processing */}
        {processing && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 py-4">
            <Loader size={14} className="text-emerald-400/60 animate-spin" />
            <span className="text-xs text-white/30">Обработка...</span>
          </motion.div>
        )}

        {/* Result */}
        <AnimatePresence>
          {result && !processing && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Zap size={10} className="text-emerald-400/50" />
                <span className="text-[10px] text-emerald-400/50">Результат:</span>
              </div>
              <p className="text-xs text-white/60 leading-relaxed">{result}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History */}
        {history.length > 0 && (
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-2 px-1">История команд</p>
            <div className="space-y-1">
              {history.map(cmd => (
                <div key={cmd.id} className="px-3 py-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-xs text-white/50 truncate">{cmd.text}</p>
                  <p className="text-[10px] text-white/25 mt-0.5 truncate">{cmd.result}</p>
                  <p className="text-[10px] text-white/15 mt-0.5">{new Date(cmd.timestamp).toLocaleTimeString('ru-RU')}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}