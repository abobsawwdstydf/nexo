import { useState, useEffect, useRef, useCallback } from 'react';
import { Plus, ImagePlus, Trash2, X, Smile, Sticker, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import type { UserStickerPack } from '../lib/api/userStickers';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { toast } from '../lib/toast';

interface MyStickersPanelProps {
  onPick: (token: string) => void;
  packType: 'sticker' | 'emoji';
  onClose?: () => void;
}

/**
 * User-created sticker & emoji packs. Photos from the gallery are cropped to a
 * square on a canvas and uploaded to the file server; stickers render as
 * [mysticker:packId:filename], emoji as [myemoji:packId:filename].
 */
export function MyStickersPanel({ onPick, packType, onClose }: MyStickersPanelProps) {
  const [packs, setPacks] = useState<UserStickerPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newPackName, setNewPackName] = useState('');
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activePackRef = useRef<string | null>(null);

  const loadPacks = useCallback(async () => {
    try {
      const data = await api.getMyStickerPacks();
      setPacks(data.filter(p => p.type === packType));
    } catch (e: any) {
      toast.error(e?.message || 'Не удалось загрузить паки');
    } finally {
      setLoading(false);
    }
  }, [packType]);

  useEffect(() => {
    loadPacks();
  }, [loadPacks]);

  const handleCreatePack = async () => {
    const name = newPackName.trim();
    if (!name) return;
    setCreating(true);
    try {
      await api.createUserStickerPack(name, packType);
      setNewPackName('');
      await loadPacks();
      toast.success(packType === 'emoji' ? 'Эмодзи-пак создан!' : 'Стикер-пак создан!');
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка создания');
    } finally {
      setCreating(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const packId = activePackRef.current;
    const files = e.target.files;
    if (!packId || !files || files.length === 0) return;
    setUploading(packId);
    try {
      for (const file of Array.from(files)) {
        const cropped = await cropToSquare(file);
        if (!cropped) continue;
        const sticker = await api.uploadUserSticker(packId, cropped);
        if (packType === 'emoji') {
          onPick(`[myemoji:${packId}:${sticker.id}]`);
        } else {
          onPick(`[mysticker:${packId}:${sticker.id}]`);
        }
      }
      await loadPacks();
      toast.success('Добавлено!');
    } catch (err: any) {
      toast.error(err?.message || 'Ошибка загрузки');
    } finally {
      setUploading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePack = async (packId: string) => {
    if (!window.confirm('Удалить пак и все его стикеры?')) return;
    try {
      await api.deleteUserStickerPack(packId);
      setPacks(prev => prev.filter(p => p.id !== packId));
      toast.success('Пак удалён');
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка удаления');
    }
  };

  const handleDeleteSticker = async (stickerId: string) => {
    try {
      await api.deleteUserSticker(stickerId);
      setPacks(prev => prev.map(p => ({
        ...p,
        stickers: p.stickers.filter(s => s.id !== stickerId),
      })));
    } catch (e: any) {
      toast.error(e?.message || 'Ошибка удаления');
    }
  };

  return (
    <div>
      {/* Create pack */}
      <div className="flex gap-1.5 mb-2">
        <input
          type="text"
          value={newPackName}
          onChange={e => setNewPackName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreatePack(); }}
          placeholder={packType === 'emoji' ? 'Название эмодзи-пака...' : 'Название стикер-пака...'}
          className="flex-1 h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none"
        />
        <button
          onClick={handleCreatePack}
          disabled={creating || !newPackName.trim()}
          className="h-8 px-3 rounded-xl bg-accent hover:bg-accent/90 disabled:opacity-40 flex items-center gap-1 text-xs font-medium text-white transition-colors"
        >
          {creating ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
          {packType === 'emoji' ? 'Эмодзи-пак' : 'Стикер-пак'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-20">
          <Loader2 size={18} className="text-white/30 animate-spin" />
        </div>
      ) : packs.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-12 h-12 mx-auto mb-2 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center">
            {packType === 'emoji' ? <Smile size={20} className="text-white/30" /> : <Sticker size={20} className="text-white/30" />}
          </div>
          <p className="text-xs text-white/40">
            Создайте свой {packType === 'emoji' ? 'эмодзи-пак' : 'стикер-пак'} из фото
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[240px] overflow-y-auto pr-1">
          {packs.map(pack => (
            <div key={pack.id} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
              <div className="flex items-center gap-2 mb-1.5">
                <p className="flex-1 text-[11px] font-medium text-white/60 truncate">
                  {pack.name}
                  <span className="ml-1.5 text-[9px] text-white/25">
                    {pack.stickers.length} / 100
                  </span>
                </p>
                <button
                  onClick={() => {
                    activePackRef.current = pack.id;
                    fileInputRef.current?.click();
                  }}
                  className="p-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] transition-colors"
                  title="Добавить стикер из фото"
                >
                  <ImagePlus size={13} className="text-white/60" />
                </button>
                <button
                  onClick={() => handleDeletePack(pack.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors"
                  title="Удалить пак"
                >
                  <Trash2 size={13} className="text-red-400/60" />
                </button>
              </div>

              {uploading === pack.id && (
                <div className="flex items-center gap-1.5 text-[10px] text-accent/70 mb-1.5">
                  <Loader2 size={11} className="animate-spin" /> Обработка фото...
                </div>
              )}

              {pack.stickers.length === 0 ? (
                <p className="text-[10px] text-white/25 text-center py-2">
                  Нажмите на иконку фото, чтобы добавить стикер
                </p>
              ) : (
                <div className="grid grid-cols-4 gap-1">
                  {pack.stickers.map(sticker => (
                    <div
                      key={sticker.id}
                      className="relative group aspect-square rounded-lg overflow-hidden bg-white/[0.03]"
                    >
                      <button
                        onClick={() => {
                          if (packType === 'emoji') {
                            onPick(`[myemoji:${pack.id}:${sticker.id}]`);
                          } else {
                            onPick(`[mysticker:${pack.id}:${sticker.id}]`);
                          }
                        }}
                        className="w-full h-full p-0.5"
                        title={sticker.emoji}
                      >
                        <img
                          src={normalizeMediaUrl(sticker.fileUrl)}
                          alt={sticker.emoji}
                          className={`w-full h-full object-contain ${packType === 'emoji' ? 'rounded-sm' : ''}`}
                          loading="lazy"
                        />
                      </button>
                      <button
                        onClick={() => handleDeleteSticker(sticker.id)}
                        className="absolute top-0.5 right-0.5 p-0.5 rounded-md bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Удалить"
                      >
                        <X size={9} className="text-white/70" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={handleFileChange}
      />
      {onClose && (
        <div className="mt-2 text-right">
          <button onClick={onClose} className="text-[10px] text-white/30 hover:text-white/60 transition-colors">
            Готово
          </button>
        </div>
      )}
    </div>
  );
}

/** Crop an image to a centered square (512×512) on a canvas → PNG File. */
async function cropToSquare(file: File): Promise<File | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = Math.min(bitmap.width, bitmap.height, 512);
    const sx = (bitmap.width - size) / 2;
    const sy = (bitmap.height - size) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, size, size);

    const blob: Blob | null = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', 0.9));
    bitmap.close();
    if (!blob) return null;
    return new File([blob], `sticker-${Date.now()}.webp`, { type: 'image/webp' });
  } catch {
    return null;
  }
}
