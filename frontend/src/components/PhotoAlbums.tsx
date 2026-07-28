import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Images, Plus, X, Check, Upload, Camera, Share2, Trash2, Eye, Edit3,
  ChevronLeft, ChevronRight, Loader, Image,
} from 'lucide-react';
import { api } from '../lib/api';
import { toast } from '../lib/toast';

interface PhotoAlbumsProps {
  onClose: () => void;
}

interface Album {
  id: string;
  name: string;
  photoCount: number;
  coverUrl: string | null;
  createdAt: string;
  photos: Photo[];
}

interface Photo {
  id: string;
  url: string;
  caption: string;
  addedAt: string;
}

export default function PhotoAlbums({ onClose }: PhotoAlbumsProps) {
  const [albums, setAlbums] = useState<Album[]>([
    { id: '1', name: 'Отпуск 2024', photoCount: 12, coverUrl: null, createdAt: '2024-08-15', photos: [
      { id: 'p1', url: '', caption: 'Пляж', addedAt: '2024-08-15' },
      { id: 'p2', url: '', caption: 'Закат', addedAt: '2024-08-16' },
    ]},
    { id: '2', name: 'Рабочие моменты', photoCount: 5, coverUrl: null, createdAt: '2024-10-01', photos: [] },
    { id: '3', name: 'Семья', photoCount: 20, coverUrl: null, createdAt: '2024-12-25', photos: [] },
  ]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [viewPhoto, setViewPhoto] = useState<Photo | null>(null);
  const [caption, setCaption] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const handleCreate = useCallback(() => {
    if (!newName.trim()) return;
    setAlbums(prev => [...prev, {
      id: Date.now().toString(),
      name: newName.trim(),
      photoCount: 0,
      coverUrl: null,
      createdAt: new Date().toISOString(),
      photos: [],
    }]);
    setNewName('');
    setShowCreate(false);
    toast.success('Альбом создан');
  }, [newName]);

  const handleDelete = useCallback((id: string) => {
    setAlbums(prev => prev.filter(a => a.id !== id));
    setSelectedAlbum(null);
    toast.success('Альбом удалён');
  }, []);

  const handleAddPhoto = useCallback((albumId: string) => {
    fileRef.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedAlbum) return;
    const newPhotos: Photo[] = Array.from(files).map((f, i) => ({
      id: `new-${Date.now()}-${i}`,
      url: URL.createObjectURL(f),
      caption: '',
      addedAt: new Date().toISOString(),
    }));
    setAlbums(prev => prev.map(a => a.id === selectedAlbum.id ? { ...a, photos: [...a.photos, ...newPhotos], photoCount: a.photoCount + newPhotos.length } : a));
    setSelectedAlbum(prev => prev ? { ...prev, photos: [...prev.photos, ...newPhotos], photoCount: prev.photoCount + newPhotos.length } : null);
    toast.success(`Добавлено ${newPhotos.length} фото`);
    e.target.value = '';
  }, [selectedAlbum]);

  const handleSaveCaption = useCallback(() => {
    if (!viewPhoto || !selectedAlbum) return;
    setAlbums(prev => prev.map(a => a.id === selectedAlbum.id ? { ...a, photos: a.photos.map(p => p.id === viewPhoto.id ? { ...p, caption } : p) } : a));
    setSelectedAlbum(prev => prev ? { ...prev, photos: prev.photos.map(p => p.id === viewPhoto.id ? { ...p, caption } : p) } : null);
    toast.success('Подпись обновлена');
  }, [viewPhoto, caption, selectedAlbum]);

  return (
    <div className="h-full flex flex-col">
      <input type="file" ref={fileRef} accept="image/*" multiple onChange={handleFileChange} className="hidden" />

      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          {selectedAlbum ? (
            <motion.button onClick={() => setSelectedAlbum(null)} className="p-1 rounded-lg hover:bg-white/[0.06]" whileTap={{ scale: 0.9 }}>
              <ChevronLeft size={16} className="text-white/40" />
            </motion.button>
          ) : (
            <div className="w-8 h-8 rounded-xl bg-rose-500/20 border border-rose-500/20 flex items-center justify-center">
              <Images size={15} className="text-rose-400/70" />
            </div>
          )}
          <h2 className="text-sm font-semibold text-white/90">{selectedAlbum?.name || 'Фотоальбомы'}</h2>
        </div>
        <div className="flex items-center gap-1">
          {!selectedAlbum ? (
            <motion.button onClick={() => setShowCreate(v => !v)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
              <Plus size={15} className="text-white/40" />
            </motion.button>
          ) : (
            <motion.button onClick={() => handleAddPhoto(selectedAlbum.id)} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
              <Upload size={15} className="text-white/40" />
            </motion.button>
          )}
          <motion.button onClick={onClose} className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors" whileTap={{ scale: 0.95 }}>
            <X size={15} className="text-white/40" />
          </motion.button>
        </div>
      </div>

      {/* Create form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]">
            <div className="px-3 py-3 flex gap-2">
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название альбома..."
                className="flex-1 h-9 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none focus:border-white/20"
                onKeyDown={e => e.key === 'Enter' && handleCreate()} autoFocus />
              <motion.button onClick={handleCreate} disabled={!newName.trim()}
                className="px-3 h-9 rounded-xl bg-rose-500/20 border border-rose-500/20 text-xs text-rose-400/70 disabled:opacity-40"
                whileTap={{ scale: 0.95 }}><Check size={14} /></motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        {!selectedAlbum ? (
          /* Album grid */
          <div className="grid grid-cols-2 gap-2">
            {albums.map(album => (
              <motion.button key={album.id} onClick={() => setSelectedAlbum(album)}
                className="aspect-square rounded-xl bg-white/[0.04] border border-white/[0.06] overflow-hidden relative group hover:bg-white/[0.06] transition-colors"
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                {album.coverUrl ? (
                  <img src={album.coverUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Images size={24} className="text-white/10" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                  <p className="text-[10px] text-white/80 font-medium">{album.name}</p>
                  <p className="text-[9px] text-white/40">{album.photoCount} фото</p>
                </div>
              </motion.button>
            ))}
          </div>
        ) : (
          /* Photo grid */
          <div className="space-y-3">
            {selectedAlbum.photos.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Camera size={24} className="text-white/15 mb-3" />
                <p className="text-sm text-white/30">Нет фото</p>
                <button onClick={() => handleAddPhoto(selectedAlbum.id)} className="mt-2 text-xs text-rose-400/60 hover:text-rose-400/80">Добавить фото</button>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1.5">
                {selectedAlbum.photos.map(photo => (
                  <motion.button key={photo.id} onClick={() => { setViewPhoto(photo); setCaption(photo.caption); }}
                    className="aspect-square rounded-lg bg-white/[0.04] border border-white/[0.06] overflow-hidden relative group"
                    whileHover={{ scale: 1.02 }}>
                    {photo.url ? (
                      <img src={photo.url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Image size={16} className="text-white/10" /></div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <Eye size={16} className="text-white/80" />
                    </div>
                    {photo.caption && (
                      <div className="absolute bottom-0 left-0 right-0 px-1 py-0.5 bg-black/50">
                        <p className="text-[8px] text-white/60 truncate">{photo.caption}</p>
                      </div>
                    )}
                  </motion.button>
                ))}
              </div>
            )}
            <button onClick={() => handleDelete(selectedAlbum.id)} className="w-full py-2 rounded-xl bg-red-500/10 text-xs text-red-400/50 hover:bg-red-500/20 transition-colors flex items-center justify-center gap-1.5">
              <Trash2 size={11} />Удалить альбом
            </button>
          </div>
        )}
      </div>

      {/* Photo viewer */}
      <AnimatePresence>
        {viewPhoto && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-black/90 backdrop-blur-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3">
              <button onClick={() => setViewPhoto(null)} className="p-1.5 rounded-lg hover:bg-white/[0.1]"><ChevronLeft size={16} className="text-white/60" /></button>
              <div className="flex gap-1.5">
                <motion.button onClick={() => { navigator.clipboard.writeText(viewPhoto.url || ''); toast.success('Скопировано'); }}
                  className="p-1.5 rounded-lg hover:bg-white/[0.1]" whileTap={{ scale: 0.9 }}>
                  <Share2 size={14} className="text-white/40" />
                </motion.button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center px-4">
              {viewPhoto.url ? (
                <img src={viewPhoto.url} alt="" className="max-w-full max-h-full object-contain rounded-xl" />
              ) : (
                <div className="w-48 h-48 rounded-xl bg-white/[0.04] flex items-center justify-center"><Image size={40} className="text-white/10" /></div>
              )}
            </div>
            <div className="px-4 py-3 flex gap-2">
              <input type="text" value={caption} onChange={e => setCaption(e.target.value)} placeholder="Подпись..."
                className="flex-1 h-8 px-3 text-xs bg-white/[0.06] border border-white/[0.08] rounded-xl text-white/70 placeholder:text-white/30 outline-none" />
              <motion.button onClick={handleSaveCaption} className="px-3 h-8 rounded-xl bg-white/[0.08] text-[10px] text-white/60 hover:bg-white/[0.12]" whileTap={{ scale: 0.95 }}>
                <Check size={12} />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}