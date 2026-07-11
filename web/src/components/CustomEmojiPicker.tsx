import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Upload, Pencil, Trash2, Search, Smile, Image as ImageIcon, Sparkles } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import EmojiPaintEditor from './EmojiPaintEditor';

interface CustomEmoji {
  id: string;
  name: string;
  url: string;
  shortcode: string;
  createdAt: string;
}

interface CustomEmojiPickerProps {
  onSelect: (emoji: CustomEmoji) => void;
  onClose: () => void;
}

export default function CustomEmojiPicker({ onSelect, onClose }: CustomEmojiPickerProps) {
  const [emojis, setEmojis] = useState<CustomEmoji[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showPaint, setShowPaint] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadName, setUploadName] = useState('');
  const [uploadShortcode, setUploadShortcode] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEmojis();
  }, []);

  const loadEmojis = async () => {
    setLoading(true);
    try {
      const data = await api.get('/custom-emojis');
      setEmojis(data || []);
    } catch {
      setEmojis([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setUploadPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    // Auto-fill name from filename
    const name = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Zа-яА-Я0-9_\s]/g, '');
    setUploadName(name);
    setUploadShortcode(name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));
  };

  const handleUpload = async () => {
    if (!uploadFile || !uploadName.trim() || !uploadShortcode.trim()) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', uploadFile);
      formData.append('name', uploadName.trim());
      formData.append('shortcode', uploadShortcode.trim());

      const response = await fetch('/api/custom-emojis', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      await loadEmojis();
      setShowUpload(false);
      setUploadFile(null);
      setUploadPreview(null);
      setUploadName('');
      setUploadShortcode('');
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handlePaintSave = async (dataUrl: string, name: string) => {
    setUploading(true);
    try {
      // Convert dataUrl to blob
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], `${name}.png`, { type: 'image/png' });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);
      formData.append('shortcode', name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''));

      const response = await fetch('/api/custom-emojis', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!response.ok) throw new Error('Upload failed');
      await loadEmojis();
      setShowPaint(false);
    } catch (e) {
      console.error(e);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/custom-emojis/${id}`);
      setEmojis(prev => prev.filter(e => e.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = search.trim()
    ? emojis.filter(e =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.shortcode.toLowerCase().includes(search.toLowerCase())
      )
    : emojis;

  if (showPaint) {
    return (
      <AnimatePresence>
        <EmojiPaintEditor
          onSave={handlePaintSave}
          onClose={() => setShowPaint(false)}
          size={512}
        />
      </AnimatePresence>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[99990] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 10 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-[#0a0a0f]/95 backdrop-blur-3xl rounded-3xl border border-white/[0.12] shadow-[0_8px_32px_rgba(0,0,0,0.5),0_0_80px_rgba(99,102,241,0.08)] overflow-hidden flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-white/[0.06] flex-shrink-0 bg-white/[0.02]">
          <div className="w-7 h-7 rounded-lg bg-white/[0.06] flex items-center justify-center flex-shrink-0">
            <Smile size={15} className="text-nexo-400" />
          </div>
          <h2 className="text-sm font-semibold text-white flex-1">Кастомные эмодзи</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Search + actions */}
        <div className="px-3 py-2.5 flex items-center gap-2 border-b border-white/[0.06]">
          <div className="flex-1 relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
            <input
              type="text"
              placeholder="Поиск..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-sm text-white placeholder-zinc-500 outline-none focus:border-nexo-500/40 transition-colors"
            />
          </div>
          <button
            onClick={() => setShowPaint(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-nexo-500/15 text-nexo-400 hover:bg-nexo-500/25 text-xs font-medium transition-colors border border-nexo-500/20"
            title="Нарисовать"
          >
            <Pencil size={13} />
            Paint
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.06] text-zinc-400 hover:bg-white/[0.1] hover:text-white text-xs font-medium transition-colors border border-white/[0.08]"
            title="Загрузить"
          >
            <Upload size={13} />
          </button>
        </div>

        {/* Upload form */}
        <AnimatePresence>
          {showUpload && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden border-b border-white/[0.06]"
            >
              <div className="p-3 space-y-2">
                <p className="text-xs text-zinc-500 font-medium">Загрузить эмодзи (PNG, GIF, SVG, WebP)</p>
                <div className="flex items-center gap-3">
                  <label className="w-14 h-14 rounded-xl border-2 border-dashed border-white/[0.15] flex items-center justify-center cursor-pointer hover:border-nexo-500/40 transition-colors overflow-hidden flex-shrink-0 bg-white/[0.03]">
                    {uploadPreview ? (
                      <img src={uploadPreview} alt="" className="w-full h-full object-contain" />
                    ) : (
                      <Plus size={18} className="text-zinc-500" />
                    )}
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                  </label>
                  <div className="flex-1 space-y-1.5">
                    <input
                      type="text"
                      placeholder="Название"
                      value={uploadName}
                      onChange={e => setUploadName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-white placeholder-zinc-500 outline-none focus:border-nexo-500/40"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-zinc-500">:</span>
                      <input
                        type="text"
                        placeholder="shortcode"
                        value={uploadShortcode}
                        onChange={e => setUploadShortcode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="flex-1 px-2.5 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-white placeholder-zinc-500 outline-none font-mono focus:border-nexo-500/40"
                      />
                      <span className="text-xs text-zinc-500">:</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowUpload(false); setUploadFile(null); setUploadPreview(null); }} className="flex-1 py-1.5 rounded-xl text-xs text-zinc-400 hover:bg-white/[0.06] transition-colors">
                    Отмена
                  </button>
                  <button
                    onClick={handleUpload}
                    disabled={!uploadFile || !uploadName.trim() || uploading}
                    className="flex-1 py-1.5 rounded-xl text-xs bg-nexo-500 text-white hover:bg-nexo-400 transition-colors disabled:opacity-50"
                  >
                    {uploading ? 'Загрузка...' : 'Загрузить'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Emoji grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500 gap-3">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.04] flex items-center justify-center">
                <Smile size={24} className="opacity-40" />
              </div>
              <p className="text-sm">{search ? 'Ничего не найдено' : 'Нет кастомных эмодзи'}</p>
              <p className="text-xs text-zinc-600 text-center">Нарисуйте в Paint или загрузите PNG/GIF/SVG</p>
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {filtered.map(emoji => (
                <div key={emoji.id} className="relative group">
                  <button
                    onClick={() => onSelect(emoji)}
                    className="w-full aspect-square rounded-xl hover:bg-white/[0.08] transition-colors flex items-center justify-center p-1.5 border border-transparent hover:border-white/[0.08]"
                    title={`:${emoji.shortcode}:`}
                  >
                    <img
                      src={normalizeMediaUrl(emoji.url)}
                      alt={emoji.name}
                      className="w-full h-full object-contain"
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(emoji.id)}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  >
                    <X size={8} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-white/[0.06] bg-white/[0.01]">
          <p className="text-[10px] text-zinc-600 text-center">
            Используйте :shortcode: в сообщениях · {emojis.length} эмодзи
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
