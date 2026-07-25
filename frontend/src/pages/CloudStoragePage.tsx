import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cloud, Upload, Trash2, Download, FileImage, FileVideo, FileAudio, FileText, File, HardDrive, Loader2, Crown, Eye, RefreshCw } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { fadeInUp } from '../lib/animations';

interface CloudFile {
  id: string;
  filename: string;
  url: string;
  size: number;
  type: string;
  mimeType: string;
  createdAt: string;
}

interface CloudStoragePageProps {
  onClose: () => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Б';
  const k = 1024;
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(type: string) {
  switch (type) {
    case 'image': return <FileImage size={18} className="text-emerald-400" />;
    case 'video': return <FileVideo size={18} className="text-blue-400" />;
    case 'audio': return <FileAudio size={18} className="text-purple-400" />;
    case 'document': return <FileText size={18} className="text-amber-400" />;
    default: return <File size={18} className="text-zinc-400" />;
  }
}

function getFileColor(type: string): string {
  switch (type) {
    case 'image': return 'from-emerald-500/20 to-emerald-600/10 border-emerald-500/20';
    case 'video': return 'from-blue-500/20 to-blue-600/10 border-blue-500/20';
    case 'audio': return 'from-purple-500/20 to-purple-600/10 border-purple-500/20';
    case 'document': return 'from-amber-500/20 to-amber-600/10 border-amber-500/20';
    default: return 'from-zinc-500/20 to-zinc-600/10 border-zinc-500/20';
  }
}

export default function CloudStoragePage({ onClose }: CloudStoragePageProps) {
  const { user } = useAuthStore();
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [totalSize, setTotalSize] = useState(0);
  const [filter, setFilter] = useState<string>('all');
  const [previewFile, setPreviewFile] = useState<CloudFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isPremium = useAuthStore(state => state.isPremium());

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      setLoading(true);
      const data = await api.cloudList();
      setFiles(data.files || []);
      setTotalSize(data.totalSize || 0);
    } catch (error) {
      console.error('Failed to load cloud files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      await api.cloudUpload(file);
      await loadFiles();
    } catch (error: any) {
      alert(error.message || 'Ошибка загрузки');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Удалить файл?')) return;

    try {
      setDeleting(fileId);
      await api.cloudDelete(fileId);
      await loadFiles();
      if (previewFile?.id === fileId) setPreviewFile(null);
    } catch (error: any) {
      alert(error.message || 'Ошибка удаления');
    } finally {
      setDeleting(null);
    }
  };

  const filteredFiles = filter === 'all' ? files : files.filter(f => f.type === filter);

  const typeCounts = files.reduce((acc, f) => {
    acc[f.type] = (acc[f.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!isPremium) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
        onClick={onClose}
      >
        <motion.div
          {...fadeInUp}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md glass-strong rounded-3xl p-6 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center mx-auto mb-4">
            <Crown size={28} className="text-white" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Облачное хранилище</h2>
          <p className="text-sm text-zinc-400 mb-6">
            Доступно только для пользователей с подпиской «Нексо НУче»
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white transition-colors"
          >
            Закрыть
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={onClose}
    >
      <motion.div
        {...fadeInUp}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl max-h-[90vh] overflow-hidden glass-strong rounded-3xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-white/10">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center">
            <Cloud size={20} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-white">Облачное хранилище</h2>
            <p className="text-xs text-zinc-400">
              {files.length} файлов · {formatFileSize(totalSize)}
            </p>
          </div>
          <button
            onClick={loadFiles}
            className="w-9 h-9 rounded-xl glass-btn text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl glass-btn text-zinc-400 hover:text-white transition-colors flex items-center justify-center"
          >
            <X size={18} />
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-white/5 overflow-x-auto">
          {[
            { key: 'all', label: 'Все', count: files.length },
            { key: 'image', label: 'Изображения', count: typeCounts['image'] || 0 },
            { key: 'video', label: 'Видео', count: typeCounts['video'] || 0 },
            { key: 'audio', label: 'Аудио', count: typeCounts['audio'] || 0 },
            { key: 'document', label: 'Документы', count: typeCounts['document'] || 0 },
          ].map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                filter === key
                  ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                  : 'text-zinc-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {label}
              {count > 0 && (
                <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px]">{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-blue-400" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                <HardDrive size={28} className="text-zinc-500" />
              </div>
              <p className="text-sm text-zinc-400 mb-1">
                {filter === 'all' ? 'Хранилище пусто' : 'Нет файлов этого типа'}
              </p>
              <p className="text-xs text-zinc-500">
                Загрузите файлы, они появятся здесь
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <AnimatePresence>
                {filteredFiles.map((file) => (
                  <motion.div
                    key={file.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`relative group rounded-xl border bg-gradient-to-br p-3 transition-all hover:scale-[1.02] ${getFileColor(file.type)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-black/20 flex items-center justify-center flex-shrink-0">
                        {getFileIcon(file.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate" title={decodeURIComponent(file.filename)}>
                          {decodeURIComponent(file.filename)}
                        </p>
                        <p className="text-xs text-zinc-400 mt-0.5">
                          {formatFileSize(file.size)} · {new Date(file.createdAt).toLocaleDateString('ru-RU')}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {(file.type === 'image' || file.type === 'video') && (
                        <button
                          onClick={() => setPreviewFile(file)}
                          className="w-7 h-7 rounded-lg bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      )}
                      <a
                        href={file.url}
                        download
                        className="w-7 h-7 rounded-lg bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-colors"
                      >
                        <Download size={14} />
                      </a>
                      <button
                        onClick={() => handleDelete(file.id)}
                        disabled={deleting === file.id}
                        className="w-7 h-7 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-400 flex items-center justify-center transition-colors disabled:opacity-50"
                      >
                        {deleting === file.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Upload bar */}
        <div className="px-6 py-4 border-t border-white/10">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            className="hidden"
            disabled={uploading}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 font-medium transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Загрузка...
              </>
            ) : (
              <>
                <Upload size={18} />
                Загрузить файл
              </>
            )}
          </button>
        </div>
      </motion.div>

      {/* Preview modal */}
      <AnimatePresence>
        {previewFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[10000] p-4"
            onClick={() => setPreviewFile(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-4xl max-h-[85vh] relative"
            >
              {previewFile.type === 'image' ? (
                <img
                  src={previewFile.url}
                  alt={decodeURIComponent(previewFile.filename)}
                  className="max-w-full max-h-[80vh] rounded-2xl object-contain"
                />
              ) : previewFile.type === 'video' ? (
                <video
                  src={previewFile.url}
                  controls
                  autoPlay
                  className="max-w-full max-h-[80vh] rounded-2xl"
                />
              ) : null}
              <button
                onClick={() => setPreviewFile(null)}
                className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
              >
                <X size={20} />
              </button>
              <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                <p className="text-sm text-white/80 truncate">{decodeURIComponent(previewFile.filename)}</p>
                <a
                  href={previewFile.url}
                  download
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                >
                  <Download size={14} />
                  Скачать
                </a>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
