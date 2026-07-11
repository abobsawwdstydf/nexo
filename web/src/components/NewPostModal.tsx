import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, Image, Video, Mic, Loader2, Type, Music, File as FileIcon } from 'lucide-react';
import { api } from '../lib/api';
import { useToastStore } from '../stores/toastStore';
import BottomSheet from './BottomSheet';

interface NewPostModalProps {
  onClose: () => void;
  onPostCreated: (post: any) => void;
}

export default function NewPostModal({ onClose, onPostCreated }: NewPostModalProps) {
  const { error: showError } = useToastStore();
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [voice, setVoice] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [fontStyle, setFontStyle] = useState<string>('normal');
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (photos.length + newFiles.length > 2) {
      showError('Максимум 2 фото');
      return;
    }
    setPhotos(prev => [...prev, ...newFiles].slice(0, 2));
  };

  const handleVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024 * 1024) {
      showError('Максимальный размер видео 3 ГБ');
      return;
    }
    setAudio(null);
    setFiles([]);
    setVoice(null);
    setVideo(file);
  };

  const handleAudioSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setVideo(null);
    setFiles([]);
    setVoice(null);
    setAudio(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || []);
    if (files.length + newFiles.length > 5) {
      showError('Максимум 5 файлов');
      return;
    }
    setVideo(null);
    setAudio(null);
    setVoice(null);
    setFiles(prev => [...prev, ...newFiles].slice(0, 5));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        setVideo(null);
        setAudio(null);
        setFiles([]);
        setVoice(file);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
      showError('Ошибка доступа к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && photos.length === 0 && !video && !audio && files.length === 0 && !voice) {
      showError('Добавьте текст или медиа');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('fontStyle', fontStyle);

      photos.forEach(photo => {
        formData.append('photos', photo);
      });

      if (video) {
        formData.append('videos', video);
      }

      if (audio) {
        formData.append('audios', audio);
      }

      files.forEach(file => {
        formData.append('files', file);
      });

      if (voice) {
        formData.append('voice', voice);
      }

      const newPost = await api.post('/wall/post', formData);
      onPostCreated(newPost);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Неизвестная ошибка';
      console.error('Error creating post:', err, msg);
      showError('Ошибка создания поста: ' + msg);
    } finally {
      setUploading(false);
    }
  };

  const editorContent = (
    <div className="p-4 space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Type size={16} className="text-zinc-400" />
          <span className="text-sm text-zinc-400">Текст (поддерживаются #хэштеги и @упоминания)</span>
          <select
            value={fontStyle}
            onChange={e => setFontStyle(e.target.value)}
            className="ml-auto px-2 py-1 rounded-lg bg-surface-tertiary text-sm text-white border border-border"
          >
            <option value="normal">Обычный</option>
            <option value="bold">Жирный</option>
            <option value="italic">Курсив</option>
            <option value="monospace">Моноширинный</option>
          </select>
        </div>
        <textarea
          value={content}
          onChange={e => {
            setContent(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
          }}
          placeholder="Что нового? Используйте #хэштеги и @упоминания"
          className="w-full min-h-[80px] px-4 py-3 rounded-xl bg-surface-tertiary text-white placeholder-zinc-500 border border-border focus:border-accent resize-none transition-colors"
          style={{
            fontWeight: fontStyle === 'bold' ? 'bold' : 'normal',
            fontStyle: fontStyle === 'italic' ? 'italic' : 'normal',
            fontFamily: fontStyle === 'monospace' ? 'monospace' : 'inherit'
          }}
        />
      </div>

      {photos.length > 0 && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">Фото ({photos.length}/2)</p>
          <div className={`grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
            {photos.map((photo, i) => (
              <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-surface-tertiary">
                <img src={URL.createObjectURL(photo)} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setPhotos(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 p-1 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
                >
                  <X size={14} className="text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {video && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">Видео</p>
          <div className="relative rounded-lg overflow-hidden bg-surface-tertiary">
            <video src={URL.createObjectURL(video)} controls className="w-full" />
            <button
              onClick={() => setVideo(null)}
              className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
            >
              <X size={16} className="text-white" />
            </button>
          </div>
        </div>
      )}

      {audio && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">Аудио</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-tertiary">
            <Music size={16} className="text-nexo-400" />
            <span className="text-sm text-white flex-1">{audio.name}</span>
            <button onClick={() => setAudio(null)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X size={14} className="text-zinc-400" />
            </button>
          </div>
        </div>
      )}

      {files.length > 0 && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">Файлы ({files.length}/5)</p>
          <div className="space-y-2">
            {files.map((file, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-surface-tertiary">
                <FileIcon size={16} className="text-nexo-400" />
                <span className="text-sm text-white flex-1 truncate">{file.name}</span>
                <span className="text-xs text-zinc-500">{(file.size / 1024).toFixed(1)} KB</span>
                <button
                  onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))}
                  className="p-1 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <X size={14} className="text-zinc-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {voice && (
        <div>
          <p className="text-sm text-zinc-400 mb-2">Голосовое сообщение</p>
          <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-tertiary">
            <Mic size={16} className="text-nexo-400" />
            <span className="text-sm text-white flex-1">{voice.name}</span>
            <button onClick={() => setVoice(null)} className="p-1 rounded-lg hover:bg-white/5 transition-colors">
              <X size={14} className="text-zinc-400" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const footerContent = (
    <div className="p-3 border-t border-white/5 space-y-2">
      <div className="flex items-center gap-1.5 flex-wrap">
        <input ref={photoInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
        <button
          onClick={() => photoInputRef.current?.click()}
          disabled={photos.length >= 2}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-tertiary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Image size={16} className="text-nexo-400" />
          <span className="text-xs text-white">Фото</span>
        </button>

        <input ref={videoInputRef} type="file" accept="video/*" onChange={handleVideoSelect} className="hidden" />
        <button
          onClick={() => videoInputRef.current?.click()}
          disabled={!!video || !!audio || files.length > 0 || !!voice}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-tertiary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Только 1 видео (исключает аудио/файлы/голосовое)"
        >
          <Video size={16} className="text-nexo-400" />
          <span className="text-xs text-white">Видео</span>
        </button>

        <input ref={audioInputRef} type="file" accept="audio/*" onChange={handleAudioSelect} className="hidden" />
        <button
          onClick={() => audioInputRef.current?.click()}
          disabled={!!audio || !!video || files.length > 0 || !!voice}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-tertiary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="Только 1 аудио (исключает видео/файлы/голосовое)"
        >
          <Music size={16} className="text-nexo-400" />
          <span className="text-xs text-white">Аудио</span>
        </button>

        <input ref={fileInputRef} type="file" multiple onChange={handleFileSelect} className="hidden" />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={files.length >= 5 || !!video || !!audio || !!voice}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-surface-tertiary hover:bg-surface-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          title="До 5 файлов (исключает видео/аудио/голосовое)"
        >
          <FileIcon size={16} className="text-nexo-400" />
          <span className="text-xs text-white">Файлы</span>
        </button>

        <button
          onClick={recording ? stopRecording : startRecording}
          disabled={!!voice || !!video || !!audio || files.length > 0}
          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors ${
            recording
              ? 'bg-red-500/20 hover:bg-red-500/30'
              : 'bg-surface-tertiary hover:bg-surface-hover'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Только 1 голосовое (исключает видео/аудио/файлы)"
        >
          <Mic size={16} className={recording ? 'text-red-400' : 'text-nexo-400'} />
          <span className="text-xs text-white">
            {recording ? 'Остановить' : 'Голосовое'}
          </span>
        </button>
      </div>

      <button
        onClick={handleSubmit}
        disabled={uploading || (!content.trim() && photos.length === 0 && !video && !audio && files.length === 0 && !voice)}
        className="w-full py-3 rounded-xl bg-nexo-500 hover:bg-nexo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors flex items-center justify-center gap-2"
      >
        {uploading ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Публикация...</span>
          </>
        ) : (
          <span>Опубликовать</span>
        )}
      </button>
    </div>
  );

  if (isMobile) {
    return (
      <BottomSheet isOpen onClose={onClose} title="Новый пост">
        {editorContent}
        {footerContent}
      </BottomSheet>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={e => e.stopPropagation()}
        className="bg-[#1a1a1a] rounded-2xl border border-white/5 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-lg font-semibold text-white">Новый пост</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {editorContent}
        </div>

        {footerContent}
      </motion.div>
    </motion.div>
  );
}
