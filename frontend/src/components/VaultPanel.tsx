import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock, Upload, Download, Trash2, X, Search, File, HardDrive, Shield, Eye, EyeOff,
  Check, Loader, AlertTriangle, Info, Key,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface VaultPanelProps {
  onClose: () => void;
}

interface VaultFile {
  id: string;
  name: string;
  size: string;
  encrypted: boolean;
  uploadedAt: string;
  checksum: string;
}

export default function VaultPanel({ onClose }: VaultPanelProps) {
  const [files, setFiles] = useState<VaultFile[]>([
    { id: '1', name: 'Документы.pdf', size: '2.4 MB', encrypted: true, uploadedAt: '2025-01-10T14:30:00', checksum: 'a1b2c3d4' },
    { id: '2', name: 'Фото_отпуск.zip', size: '156 MB', encrypted: true, uploadedAt: '2025-01-12T09:15:00', checksum: 'e5f6g7h8' },
    { id: '3', name: 'Заметки.txt', size: '12 KB', encrypted: false, uploadedAt: '2025-01-13T16:45:00', checksum: 'i9j0k1l2' },
  ]);
  const [search, setSearch] = useState('');
  const [storage] = useState({ used: 158.4, total: 500, unit: 'MB' });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = files.filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList) return;
    setUploading(true);
    try {
      for (const file of Array.from(fileList)) {
        const newFile: VaultFile = {
          id: Date.now().toString() + Math.random().toString(36).slice(2),
          name: file.name,
          size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
          encrypted: true,
          uploadedAt: new Date().toISOString(),
          checksum: Math.random().toString(36).slice(2, 10),
        };
        setFiles(prev => [newFile, ...prev]);
      }
      toast.success('Файлы загружены');
    } catch {
      toast.error('Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
    setConfirmDelete(null);
    setSelectedFile(null);
    toast.success('Файл удалён');
  }, []);

  const formatStorage = () => {
    const pct = (storage.used / storage.total) * 100;
    return { pct, color: pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-green-500' };
  };

  const storageInfo = formatStorage();

  return (
    <div className="h-full flex flex-col">
      <input type="file" ref={fileRef} onChange={handleUpload} multiple className="hidden" />

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center">
            <Lock size={15} className="text-emerald-400/70" />
          </div>
          <h2 className="text-sm font-semibold text-white/90">Хранилище</h2>
        </div>
        <div className="flex items-center gap-1">
          <motion.button onClick={() => fileRef.current?.click()} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }} title="Загрузить">
            {uploading ? <Loader size={15} className="text-white/40 animate-spin" /> : <Upload size={15} className="text-white/40" />}
          </motion.button>
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Storage bar */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] text-white/30 flex items-center gap-1"><HardDrive size={10} />Хранилище</span>
          <span className="text-[10px] text-white/40">{storage.used} / {storage.total} {storage.unit}</span>
        </div>
        <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div initial={{ width: 0 }} animate={{ width: `${storageInfo.pct}%` }} transition={{ duration: 0.5 }}
            className={`h-full rounded-full ${storageInfo.color}`} />
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 pt-2 pb-1">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск файлов..."
            className="w-full h-8 pl-9 pr-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20" />
        </div>
      </div>

      {/* Files */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Lock size={24} className="text-white/15 mb-3" />
            <p className="text-sm text-white/30">Нет файлов</p>
            <button onClick={() => fileRef.current?.click()} className="mt-2 text-xs text-emerald-400/60 hover:text-emerald-400/80">Загрузить первый файл</button>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(file => (
              <motion.div key={file.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors group">
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${file.encrypted ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/[0.04] border border-white/[0.06]'}`}>
                    {file.encrypted ? <Shield size={14} className="text-emerald-400/60" /> : <File size={14} className="text-white/30" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white/70 font-medium truncate">{file.name}</p>
                    <div className="flex items-center gap-2 text-[10px] text-white/25 mt-0.5">
                      <span>{file.size}</span>
                      <span>·</span>
                      <span>{new Date(file.uploadedAt).toLocaleDateString('ru-RU')}</span>
                      {file.encrypted && <span className="flex items-center gap-0.5 text-emerald-400/40"><Key size={8} />E2E</span>}
                    </div>
                    <p className="text-[9px] text-white/15 mt-0.5 font-mono">SHA: {file.checksum}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <motion.button className="p-1.5 rounded-lg hover:bg-white/[0.08]" whileTap={{ scale: 0.9 }}>
                      <Download size={12} className="text-white/30" />
                    </motion.button>
                    {confirmDelete === file.id ? (
                      <div className="flex gap-1">
                        <button onClick={() => handleDelete(file.id)} className="px-2 py-1 rounded-lg bg-red-500/20 text-[10px] text-red-400/70">Да</button>
                        <button onClick={() => setConfirmDelete(null)} className="px-2 py-1 rounded-lg bg-white/[0.04] text-[10px] text-white/40">Нет</button>
                      </div>
                    ) : (
                      <motion.button onClick={() => setConfirmDelete(file.id)} className="p-1.5 rounded-lg hover:bg-white/[0.08]" whileTap={{ scale: 0.9 }}>
                        <Trash2 size={12} className="text-red-400/40" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}