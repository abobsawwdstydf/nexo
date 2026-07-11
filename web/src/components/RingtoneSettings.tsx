import { useState, useRef, useEffect } from 'react';
import { Music, Upload, Play, Pause, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import CustomFilePicker from './CustomFilePicker';
import { api } from '../lib/api';

interface RingtoneSettingsProps {
  onClose: () => void;
}

export default function RingtoneSettings({ onClose }: RingtoneSettingsProps) {
  const [ringtone, setRingtone] = useState<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    loadRingtone();
  }, []);

  const loadRingtone = async () => {
    try {
      const settings = await api.getUserSettings();
      setRingtone(settings.ringtone);
    } catch (error) {
      console.error('Failed to load ringtone:', error);
    }
  };

  const handleFileSelect = async (files: FileList) => {
    const file = files[0];
    if (!file) return;

    // Validate audio file
    if (!file.type.startsWith('audio/')) {
      alert('Пожалуйста, выберите аудио файл');
      return;
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Файл слишком большой. Максимум 10MB');
      return;
    }

    try {
      setIsUploading(true);

      // Upload file
      const formData = new FormData();
      formData.append('files', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');

      const data = await response.json();
      const uploadedFile = data.files[0];

      // Get audio duration
      const audio = new Audio(uploadedFile.url);
      await new Promise((resolve) => {
        audio.addEventListener('loadedmetadata', resolve);
      });

      const newRingtone = {
        id: uploadedFile.id,
        name: file.name,
        url: uploadedFile.url,
        duration: Math.floor(audio.duration),
        uploadedAt: new Date().toISOString(),
        isRingtone: true,
      };

      // Save to settings
      await api.updateUserSettings({ ringtone: newRingtone });
      setRingtone(newRingtone);
    } catch (error) {
      console.error('Failed to upload ringtone:', error);
      alert('Ошибка загрузки файла');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveRingtone = async () => {
    try {
      await api.updateUserSettings({ ringtone: null });
      setRingtone(null);
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
    } catch (error) {
      console.error('Failed to remove ringtone:', error);
      alert('Ошибка удаления рингтона');
    }
  };

  const togglePlay = () => {
    if (!audioRef.current || !ringtone) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999]"
        onClick={onClose}
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md z-[10000]"
      >
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <Music className="text-nexo-500" size={24} />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Рингтон</h3>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {ringtone ? (
              <div className="space-y-4">
                {/* Current ringtone */}
                <div className="p-4 bg-nexo-500/10 dark:bg-nexo-500/20 rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={togglePlay}
                        className="p-2 rounded-full bg-nexo-500 hover:bg-nexo-600 transition-colors flex-shrink-0"
                      >
                        {isPlaying ? (
                          <Pause size={20} className="text-white" />
                        ) : (
                          <Play size={20} className="text-white ml-0.5" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 dark:text-white truncate">
                          {ringtone.name}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {Math.floor(ringtone.duration / 60)}:{String(ringtone.duration % 60).padStart(2, '0')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRemoveRingtone}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-red-500 transition-colors flex-shrink-0"
                    >
                      <X size={20} />
                    </button>
                  </div>
                </div>

                <audio
                  ref={audioRef}
                  src={ringtone.url}
                  onEnded={() => setIsPlaying(false)}
                />

                {/* Change button */}
                <button
                  onClick={() => setShowFilePicker(true)}
                  disabled={isUploading}
                  className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-xl font-medium transition-colors disabled:opacity-50"
                >
                  {isUploading ? 'Загрузка...' : 'Изменить рингтон'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-center text-gray-500 dark:text-gray-400">
                  Рингтон не установлен. Выберите аудио файл для звонков.
                </p>

                <button
                  onClick={() => setShowFilePicker(true)}
                  disabled={isUploading}
                  className="w-full py-3 px-4 bg-nexo-500 hover:bg-nexo-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={20} />
                  {isUploading ? 'Загрузка...' : 'Загрузить рингтон'}
                </button>
              </div>
            )}

            <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
              Поддерживаются форматы: MP3, WAV, OGG. Максимум 10MB.
            </p>
          </div>
        </div>
      </motion.div>

      <CustomFilePicker
        isOpen={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        onFileSelect={handleFileSelect}
        accept="audio/*"
        title="Выберите аудио файл"
      />
    </>
  );
}
