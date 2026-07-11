import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Cloud, Upload, Folder, File, Image, Video, Music, FileText,
  Star, StarOff, Trash2, Download, Search, FolderPlus, MoreVertical,
  ChevronRight, Home, HardDrive, RefreshCw, Edit2, Check,
} from 'lucide-react';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import SidePanelWrapper from './SidePanelWrapper';
import { useAuthStore } from '../stores/authStore';

interface CloudFile {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  size: number;
  folder: string;
  isStarred: boolean;
  createdAt: string;
}

interface CloudStats {
  totalFiles: number;
  totalSize: number;
  maxSize: number;
}

interface CloudStorageModalProps {
  onClose: () => void;
  onSelectFile?: (file: CloudFile) => void; // For file picker mode
  embedded?: boolean;
}

export default function CloudStorageModal({ onClose, onSelectFile, embedded }: CloudStorageModalProps) {
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [stats, setStats] = useState<CloudStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentFolder, setCurrentFolder] = useState('/');
  const [search, setSearch] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ file: CloudFile; x: number; y: number } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      else params.set('folder', currentFolder);

      const data = await api.get(`/cloud?${params}`);
      setFiles(data.files || []);
      setStats(data.stats || null);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [currentFolder, search]);

  useEffect(() => {
    const timer = setTimeout(loadFiles, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadFiles, search]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    setUploading(true);
    setUploadProgress(0);

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', currentFolder);

      try {
        await fetch('/api/cloud/upload', {
          method: 'POST',
          credentials: 'include',
          body: formData,
        });
        setUploadProgress(Math.round(((i + 1) / selectedFiles.length) * 100));
      } catch (e) {
        console.error('Upload error:', e);
      }
    }

    setUploading(false);
    setUploadProgress(0);
    loadFiles();
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDelete = async (file: CloudFile) => {
    try {
      await api.delete(`/cloud/${file.id}`);
      setFiles(prev => prev.filter(f => f.id !== file.id));
      setContextMenu(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleStar = async (file: CloudFile) => {
    try {
      const updated = await api.put(`/cloud/${file.id}`, { isStarred: !file.isStarred });
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, isStarred: !f.isStarred } : f));
      setContextMenu(null);
    } catch (e) {
      console.error(e);
    }
  };

  const handleRename = async (file: CloudFile) => {
    if (!renameValue.trim() || renameValue === file.name) {
      setRenamingId(null);
      return;
    }
    try {
      await api.put(`/cloud/${file.id}`, { name: renameValue.trim() });
      setFiles(prev => prev.map(f => f.id === file.id ? { ...f, name: renameValue.trim() } : f));
    } catch (e) {
      console.error(e);
    } finally {
      setRenamingId(null);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await api.post('/cloud/folder', { name: newFolderName.trim(), parent: currentFolder });
      setNewFolderName('');
      setShowNewFolder(false);
      loadFiles();
    } catch (e) {
      console.error(e);
    }
  };

  const getFileIcon = (file: CloudFile) => {
    if (file.mimeType === 'application/x-directory') return <Folder size={20} className="text-yellow-400" />;
    if (file.mimeType.startsWith('image/')) return <Image size={20} className="text-blue-400" />;
    if (file.mimeType.startsWith('video/')) return <Video size={20} className="text-purple-400" />;
    if (file.mimeType.startsWith('audio/')) return <Music size={20} className="text-green-400" />;
    if (file.mimeType.includes('pdf') || file.mimeType.includes('document')) return <FileText size={20} className="text-red-400" />;
    return <File size={20} className="text-zinc-400" />;
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  };

  const usedPercent = stats ? Math.min(100, (stats.totalSize / stats.maxSize) * 100) : 0;

  const breadcrumbs = currentFolder.split('/').filter(Boolean);

  return (
    <SidePanelWrapper
      onClose={onClose}
      embedded={embedded}
      title="Облачное хранилище"
      icon={<Cloud size={15} className="text-nexo-400" />}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06]">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-nexo-500/20 text-nexo-400 hover:bg-nexo-500/30 text-xs font-medium transition-colors disabled:opacity-50"
        >
          <Upload size={14} />
          {uploading ? `${uploadProgress}%` : 'Загрузить'}
        </button>
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
        <button
          onClick={() => setShowNewFolder(!showNewFolder)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
          title="Новая папка"
        >
          <FolderPlus size={16} />
        </button>
        <button
          onClick={loadFiles}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
        >
          <RefreshCw size={16} />
        </button>
      </div>

        {/* Storage bar */}
        {stats && (
          <div className="px-4 py-2 border-b border-white/10">
            <div className="flex items-center justify-between text-xs text-zinc-500 mb-1">
              <span className="flex items-center gap-1"><HardDrive size={12} /> {formatSize(stats.totalSize)} из {formatSize(stats.maxSize)}</span>
              <span>{stats.totalFiles} файлов</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${usedPercent}%`,
                  background: usedPercent > 80 ? '#ef4444' : usedPercent > 60 ? '#f59e0b' : '#6366f1',
                }}
              />
            </div>
          </div>
        )}

        {/* Search + breadcrumbs */}
        <div className="px-3 py-2 flex items-center gap-2 border-b border-white/10">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Поиск файлов..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white placeholder-zinc-500 outline-none"
            />
          </div>
          {!search && (
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <button onClick={() => setCurrentFolder('/')} className="hover:text-white transition-colors">
                <Home size={14} />
              </button>
              {breadcrumbs.map((crumb, i) => (
                <span key={i} className="flex items-center gap-1">
                  <ChevronRight size={12} />
                  <button
                    onClick={() => setCurrentFolder('/' + breadcrumbs.slice(0, i + 1).join('/') + '/')}
                    className="hover:text-white transition-colors"
                  >
                    {crumb}
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* New folder input */}
        <AnimatePresence>
          {showNewFolder && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/10"
            >
              <div className="flex items-center gap-2 px-3 py-2">
                <Folder size={16} className="text-yellow-400 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Название папки..."
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                  className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 outline-none"
                  autoFocus
                />
                <button onClick={handleCreateFolder} className="px-3 py-1.5 rounded-lg bg-nexo-500/20 text-nexo-400 text-xs hover:bg-nexo-500/30 transition-colors">
                  Создать
                </button>
                <button onClick={() => setShowNewFolder(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                <Cloud size={28} className="opacity-40" />
              </div>
              <p className="text-sm">{search ? 'Ничего не найдено' : 'Папка пуста'}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-nexo-400 hover:text-nexo-300 transition-colors"
              >
                Загрузить файлы →
              </button>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {files.map(file => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors group"
                  onContextMenu={e => { e.preventDefault(); setContextMenu({ file, x: e.clientX, y: e.clientY }); }}
                >
                  {/* Icon */}
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                    {file.mimeType.startsWith('image/') && file.url ? (
                      <img src={normalizeMediaUrl(file.url)} alt="" className="w-full h-full object-cover rounded-lg" />
                    ) : getFileIcon(file)}
                  </div>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    {renamingId === file.id ? (
                      <input
                        type="text"
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onBlur={() => handleRename(file)}
                        onKeyDown={e => { if (e.key === 'Enter') handleRename(file); if (e.key === 'Escape') setRenamingId(null); }}
                        className="w-full bg-white/10 border border-nexo-500/50 rounded px-2 py-0.5 text-xs text-white outline-none"
                        autoFocus
                      />
                    ) : (
                      <button
                        onClick={() => {
                          if (file.mimeType === 'application/x-directory') {
                            setCurrentFolder(`${currentFolder}${file.name}/`);
                          } else if (onSelectFile) {
                            onSelectFile(file);
                          }
                        }}
                        className="text-sm text-white truncate text-left w-full hover:text-nexo-400 transition-colors"
                      >
                        {file.name}
                      </button>
                    )}
                    <p className="text-xs text-zinc-500">{formatSize(file.size)}</p>
                  </div>

                  {/* Star */}
                  {file.isStarred && <Star size={14} className="text-yellow-400 flex-shrink-0" />}

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {file.mimeType !== 'application/x-directory' && file.url && (
                      <a
                        href={normalizeMediaUrl(file.url)}
                        download={file.name}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                        onClick={e => e.stopPropagation()}
                      >
                        <Download size={14} />
                      </a>
                    )}
                    <button
                      onClick={() => { setContextMenu({ file, x: 0, y: 0 }); }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                    >
                      <MoreVertical size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-[9999]"
          onClick={() => setContextMenu(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="fixed z-[10000] w-48 rounded-xl bg-[#1a1a24] border border-white/10 shadow-2xl py-1 overflow-hidden"
            style={{
              left: Math.min(contextMenu.x || 200, window.innerWidth - 200),
              top: Math.min(contextMenu.y || 200, window.innerHeight - 200),
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => { setRenamingId(contextMenu.file.id); setRenameValue(contextMenu.file.name); setContextMenu(null); }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/10 transition-colors"
            >
              <Edit2 size={16} /> Переименовать
            </button>
            <button
              onClick={() => handleToggleStar(contextMenu.file)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/10 transition-colors"
            >
              {contextMenu.file.isStarred ? <StarOff size={16} /> : <Star size={16} />}
              {contextMenu.file.isStarred ? 'Убрать из избранного' : 'В избранное'}
            </button>
            {contextMenu.file.url && contextMenu.file.mimeType !== 'application/x-directory' && (
              <a
                href={normalizeMediaUrl(contextMenu.file.url)}
                download={contextMenu.file.name}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-zinc-300 hover:bg-white/10 transition-colors"
                onClick={() => setContextMenu(null)}
              >
                <Download size={16} /> Скачать
              </a>
            )}
            <div className="border-t border-white/10 my-1" />
            <button
              onClick={() => handleDelete(contextMenu.file)}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 size={16} /> Удалить
            </button>
          </motion.div>
        </div>
      )}
    </SidePanelWrapper>
  );
}
