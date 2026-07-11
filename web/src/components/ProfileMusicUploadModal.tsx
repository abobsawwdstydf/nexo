import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Music, Upload, FileAudio, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import BottomSheet from './BottomSheet';

interface ProfileMusicUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploaded: (track: { id: string; name: string; url: string; duration: number; uploadedAt: string }) => void;
}

export default function ProfileMusicUploadModal({ isOpen, onClose, onUploaded }: ProfileMusicUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleFile = useCallback((file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('audio/')) {
      setErrorMsg('Пожалуйста, выберите аудиофайл');
      return;
    }
    setErrorMsg(null);
    setSelectedFile(file);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0] || null);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setErrorMsg(null);
    try {
      const audio = new Audio();
      audio.src = URL.createObjectURL(selectedFile);
      await new Promise<void>((resolve, reject) => {
        audio.onloadedmetadata = () => resolve();
        audio.onerror = () => reject(new Error('Не удалось определить длительность'));
        setTimeout(() => reject(new Error('Таймаут')), 10000);
      });
      const duration = Math.round(audio.duration);
      const newTrack = await api.uploadProfileMusic(selectedFile, duration);
      onUploaded(newTrack);
      setSelectedFile(null);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setDragActive(false);
    setErrorMsg(null);
    onClose();
  };

  const modalHeader = (
    <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 flex items-center justify-center">
          <Music size={14} className="text-violet-400" />
        </div>
        <span className="text-sm font-semibold text-white">Добавить музыку</span>
      </div>
      <button
        onClick={handleClose}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-all"
      >
        <X size={15} />
      </button>
    </div>
  );

  const modalContent = (
    <>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center gap-2.5 p-5 rounded-xl border-2 border-dashed transition-all cursor-pointer select-none ${
          dragActive
            ? 'border-violet-500/60 bg-violet-500/10'
            : selectedFile
            ? 'border-violet-500/40 bg-violet-500/5'
            : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          onChange={handleChange}
          className="hidden"
        />

        {selectedFile ? (
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <FileAudio size={18} className="text-violet-400" />
            </div>
            <div className="text-left min-w-0">
              <p className="text-sm text-white font-medium truncate">{selectedFile.name}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                {(selectedFile.size / 1024 / 1024).toFixed(2)} МБ
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="w-11 h-11 rounded-full bg-white/5 flex items-center justify-center">
              <Upload size={20} className="text-zinc-400" />
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-300">Нажмите или перетащите файл</p>
              <p className="text-xs text-zinc-600 mt-0.5">MP3, WAV, OGG, M4A · до 20 МБ</p>
            </div>
          </>
        )}
      </div>

      {/* Error */}
      {errorMsg && (
        <p className="text-xs text-red-400 text-center px-1">{errorMsg}</p>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleClose}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
        >
          Отмена
        </button>
        <button
          onClick={handleUpload}
          disabled={!selectedFile || uploading}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Загрузка...
            </>
          ) : (
            <>
              <Music size={14} />
              Загрузить
            </>
          )}
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen={isOpen} onClose={handleClose} title="Добавить музыку">
        <div className="p-4 space-y-3">
          {modalContent}
        </div>
      </BottomSheet>
    );
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-sm z-[10000]"
          >
            <div className="bg-[#1a1a1a] backdrop-blur-2xl rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              {modalHeader}
              <div className="p-4 space-y-3">
                {modalContent}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
