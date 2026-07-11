import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Plus, Package, Smile, Image as ImageIcon, ChevronLeft, Upload, Trash2, Globe, Lock, Check, Scissors, Pencil } from 'lucide-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import StickerCropper from './StickerCropper';
import BottomSheet from './BottomSheet';

interface Sticker {
  id: string;
  packId: string;
  emoji: string;
  fileUrl: string;
  fileSize: number;
  width: number | null;
  height: number | null;
  isAnimated: boolean;
  order: number;
}

interface StickerPack {
  id: string;
  name: string;
  description: string | null;
  creatorId: string;
  thumbnail: string | null;
  isPublic: boolean;
  isAnimated: boolean;
  createdAt: string;
  stickers: Sticker[];
}

interface GifItem {
  id: string;
  url: string;
  title: string;
  width: number;
  height: number;
  previewUrl?: string;
}

interface StickerPickerProps {
  onSendSticker: (sticker: Sticker) => void;
  onInsertSticker?: (sticker: Sticker) => void;
  onSendGif: (gif: GifItem) => void;
  onClose: () => void;
}

type Tab = 'emojis' | 'stickers' | 'gifs' | 'create';
type CreateStep = 'pack' | 'stickers';

export default function StickerPicker({ onSendSticker, onInsertSticker, onSendGif, onClose }: StickerPickerProps) {
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('stickers');
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [myPacks, setMyPacks] = useState<StickerPack[]>([]);
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null);
  const [packStickers, setPackStickers] = useState<Sticker[]>([]);
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const gifSearchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Pagination state for packs
  const [packsOffset, setPacksOffset] = useState(0);
  const [hasMorePacks, setHasMorePacks] = useState(true);
  const [loadingMorePacks, setLoadingMorePacks] = useState(false);
  const packsScrollRef = useRef<HTMLDivElement>(null);

  // Pagination state for stickers in pack
  const [stickersOffset, setStickersOffset] = useState(0);
  const [hasMoreStickers, setHasMoreStickers] = useState(true);
  const [loadingMoreStickers, setLoadingMoreStickers] = useState(false);
  const stickersScrollRef = useRef<HTMLDivElement>(null);

  // Create pack state
  const [createStep, setCreateStep] = useState<CreateStep>('pack');
  const [newPackName, setNewPackName] = useState('');
  const [newPackDesc, setNewPackDesc] = useState('');
  const [newPackPublic, setNewPackPublic] = useState(true);
  const [creatingPack, setCreatingPack] = useState(false);
  const [createdPack, setCreatedPack] = useState<StickerPack | null>(null);
  const [stickerEmoji, setStickerEmoji] = useState('😀');
  const [stickerFile, setStickerFile] = useState<File | null>(null);
  const [stickerPreview, setStickerPreview] = useState<string | null>(null);
  const [addingSticker, setAddingSticker] = useState(false);
  const [createdStickers, setCreatedStickers] = useState<Sticker[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCropper, setShowCropper] = useState(false);
  const [pendingStickerFile, setPendingStickerFile] = useState<File | null>(null);

  // Load public packs
  useEffect(() => {
    if (tab === 'stickers') {
      loadPacks(true);
    }
  }, [tab]);

  // Preload sticker thumbnails in background
  useEffect(() => {
    if (packs.length === 0) return;
    const urls = packs.slice(0, 50).map(p => p.stickers?.[0]?.fileUrl).filter(Boolean) as string[];
    for (const url of urls) {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = url;
      link.as = 'image';
      document.head.appendChild(link);
    }
  }, [packs]);

  // Load trending GIFs on open
  useEffect(() => {
    if (tab === 'gifs') {
      loadTrendingGifs();
    }
  }, [tab]);

  const loadPacks = async (reset = false) => {
    if (reset) {
      setLoadingPacks(true);
      setPacksOffset(0);
      setHasMorePacks(true);
    } else {
      setLoadingMorePacks(true);
    }
    try {
      const offset = reset ? 0 : packsOffset;
      const [publicResult, userPacks] = await Promise.all([
        api.getStickerPacks(50, offset),
        reset ? api.getMyStickerPacks() : Promise.resolve(null),
      ]);
      if (reset) {
        setPacks(publicResult.packs || []);
        if (userPacks) setMyPacks(userPacks || []);
      } else {
        setPacks(prev => [...prev, ...(publicResult.packs || [])]);
      }
      setHasMorePacks(publicResult.hasMore);
      setPacksOffset(offset + 50);
    } catch (e) {
      console.error('Failed to load sticker packs:', e);
    } finally {
      setLoadingPacks(false);
      setLoadingMorePacks(false);
    }
  };

  const loadPackStickers = async (pack: StickerPack, reset = false) => {
    setSelectedPack(pack);
    if (reset) {
      setLoadingStickers(true);
      setStickersOffset(0);
      setHasMoreStickers(true);
    } else {
      setLoadingMoreStickers(true);
    }
    try {
      const offset = reset ? 0 : stickersOffset;
      const result = await api.getPackStickers(pack.id, 100, offset);
      if (reset) {
        setPackStickers(result.stickers || []);
      } else {
        setPackStickers(prev => [...prev, ...(result.stickers || [])]);
      }
      setHasMoreStickers(result.hasMore);
      setStickersOffset(offset + 100);
    } catch (e) {
      console.error('Failed to load stickers:', e);
    } finally {
      setLoadingStickers(false);
      setLoadingMoreStickers(false);
    }
  };

  // Infinite scroll for packs list
  const handlePacksScroll = useCallback(() => {
    const el = packsScrollRef.current;
    if (!el || loadingMorePacks || !hasMorePacks || loadingPacks) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      loadPacks(false);
    }
  }, [loadingMorePacks, hasMorePacks, loadingPacks, packsOffset]);

  // Infinite scroll for stickers in pack
  const handleStickersScroll = useCallback(() => {
    const el = stickersScrollRef.current;
    if (!el || loadingMoreStickers || !hasMoreStickers || loadingStickers) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      loadPackStickers(selectedPack!, false);
    }
  }, [loadingMoreStickers, hasMoreStickers, loadingStickers, stickersOffset, selectedPack]);

  const loadTrendingGifs = async () => {
    setLoadingGifs(true);
    try {
      const data = await api.getTrendingGifs(30);
      setGifs(data || []);
    } catch (e) {
      console.error('Failed to load GIFs:', e);
      // Fallback: show empty state
      setGifs([]);
    } finally {
      setLoadingGifs(false);
    }
  };

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) {
      loadTrendingGifs();
      return;
    }
    setLoadingGifs(true);
    try {
      const data = await api.searchGifs(query);
      setGifs(data || []);
    } catch (e) {
      console.error('Failed to search GIFs:', e);
    } finally {
      setLoadingGifs(false);
    }
  }, []);

  const handleGifSearch = (q: string) => {
    setGifQuery(q);
    if (gifSearchTimeout.current) clearTimeout(gifSearchTimeout.current);
    gifSearchTimeout.current = setTimeout(() => searchGifs(q), 400);
  };

  const handleCreatePack = async () => {
    if (!newPackName.trim()) return;
    setCreatingPack(true);
    try {
      const pack = await api.createStickerPack({
        name: newPackName.trim(),
        description: newPackDesc.trim() || undefined,
        isPublic: newPackPublic,
      });
      setCreatedPack(pack);
      setCreatedStickers([]);
      setCreateStep('stickers');
    } catch (e) {
      console.error('Failed to create pack:', e);
    } finally {
      setCreatingPack(false);
    }
  };

  const handleStickerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPendingStickerFile(file);
    setShowCropper(true);
  };

  const handleCropDone = async (blob: Blob, fileName: string) => {
    setShowCropper(false);
    const url = URL.createObjectURL(blob);
    setStickerPreview(url);

    const croppedFile = new File([blob], fileName, { type: 'image/webp' });
    setStickerFile(croppedFile);
    setPendingStickerFile(null);
  };

  const handleCropCancel = () => {
    setShowCropper(false);
    setPendingStickerFile(null);
  };

  const handleAddSticker = async () => {
    if (!createdPack || !stickerFile) return;
    setAddingSticker(true);
    try {
      // Upload file first
      const uploadResult = await api.uploadFile(stickerFile);
      // Add sticker to pack
      const sticker = await api.addStickerToPack(createdPack.id, {
        emoji: stickerEmoji,
        fileUrl: uploadResult.url,
        isAnimated: stickerFile.type === 'image/gif' || stickerFile.name.endsWith('.tgs'),
      });
      setCreatedStickers(prev => [...prev, sticker]);
      setStickerFile(null);
      setStickerPreview(null);
      setStickerEmoji('😀');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      console.error('Failed to add sticker:', e);
    } finally {
      setAddingSticker(false);
    }
  };

  const handleFinishCreating = () => {
    setTab('stickers');
    setCreateStep('pack');
    setNewPackName('');
    setNewPackDesc('');
    setCreatedPack(null);
    setCreatedStickers([]);
    loadPacks();
  };

  const handleDeletePack = async (packId: string) => {
    try {
      await api.deleteStickerPack(packId);
      setMyPacks(prev => prev.filter(p => p.id !== packId));
      setPacks(prev => prev.filter(p => p.id !== packId));
    } catch (e) {
      console.error('Failed to delete pack:', e);
    }
  };

  const allPacks = [...myPacks, ...packs.filter(p => !myPacks.find(mp => mp.id === p.id))];

  // Определяем мобильное устройство
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const pickerContent = (
    <>
      {/* Header with search */}
      <div className="flex items-center border-b border-white/10 px-3 py-2 gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Поиск..."
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-white/5 text-sm text-white placeholder-zinc-500 border border-white/10 focus:border-nexo-500/50 outline-none"
          />
        </div>
        {!isMobile && (
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {/* EMOJI TAB */}
        {tab === 'emojis' && (
          <div className="flex-1 overflow-y-auto p-3">
            <CustomEmojiSection onSelect={(emojiUrl) => {
              if (onInsertSticker) {
                onInsertSticker({ id: 'custom-emoji', packId: 'custom', emoji: '', fileUrl: emojiUrl, fileSize: 0, width: 32, height: 32, isAnimated: false, order: 0 });
              }
            }} />
            <EmojiGrid onSelect={(emoji) => {
              if (onInsertSticker) {
                onInsertSticker({ id: 'emoji', packId: 'emojis', emoji, fileUrl: '', fileSize: 0, width: null, height: null, isAnimated: false, order: 0 });
              }
            }} />
          </div>
        )}

        {/* STICKERS TAB */}
        {tab === 'stickers' && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {selectedPack ? (
              // Pack stickers view
              <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10">
                  <button
                    onClick={() => setSelectedPack(null)}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span className="text-sm font-medium text-white">{selectedPack.name}</span>
                  {selectedPack.creatorId === user?.id && (
                    <button
                      onClick={() => handleDeletePack(selectedPack.id)}
                      className="ml-auto p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                      title="Удалить пак"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div
                  ref={stickersScrollRef}
                  onScroll={handleStickersScroll}
                  className="flex-1 overflow-y-auto p-2 min-h-0"
                >
                  {loadingStickers ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : packStickers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                      <Package size={32} className="mb-2 opacity-40" />
                      <p className="text-sm">Стикеры не найдены</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-1">
                      {packStickers.map(sticker => (
                        <button
                          key={sticker.id}
                          onClick={() => { 
                            if (onInsertSticker) {
                              onInsertSticker(sticker);
                            } else {
                              onSendSticker(sticker);
                              onClose();
                            }
                          }}
                          className="aspect-square p-1 rounded-xl liquid-glass-subtle transition-all flex items-center justify-center w-full relative group"
                          title={sticker.emoji}
                        >
                          <img
                            src={sticker.fileUrl}
                            alt={sticker.emoji}
                            className="w-full h-full object-contain rounded-2xl"
                            loading="lazy"
                          />
                          {sticker.isAnimated && (
                            <span className="absolute top-0.5 right-0.5 text-[8px] bg-black/60 text-white px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">GIF</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  {loadingMoreStickers && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-5 h-5 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              // Pack list view
              <div
                ref={packsScrollRef}
                onScroll={handlePacksScroll}
                className="flex-1 overflow-y-auto p-3 min-h-0"
              >
                {loadingPacks ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : allPacks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                    <Package size={32} className="mb-2 opacity-40" />
                    <p className="text-sm">Нет стикер-паков</p>
                    <button
                      onClick={() => setTab('create')}
                      className="mt-2 text-xs text-nexo-400 hover:underline"
                    >
                      Создать первый пак
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {myPacks.length > 0 && (
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mb-2">Мои паки</p>
                    )}
                    {myPacks.map(pack => (
                      <StickerPackRow
                        key={pack.id}
                        pack={pack}
                        isMine
                        onClick={() => loadPackStickers(pack, true)}
                        onDelete={() => handleDeletePack(pack.id)}
                      />
                    ))}
                    {packs.filter(p => !myPacks.find(mp => mp.id === p.id)).length > 0 && (
                      <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide mt-3 mb-2">Публичные паки</p>
                    )}
                    {packs.filter(p => !myPacks.find(mp => mp.id === p.id)).map(pack => (
                      <StickerPackRow
                        key={pack.id}
                        pack={pack}
                        isMine={false}
                        onClick={() => loadPackStickers(pack, true)}
                      />
                    ))}
                  </div>
                )}
                {loadingMorePacks && (
                  <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* GIF TAB */}
        {tab === 'gifs' && (
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="px-3 py-2 border-b border-white/10">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={gifQuery}
                  onChange={e => handleGifSearch(e.target.value)}
                  placeholder="Поиск GIF..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loadingGifs ? (
                <div className="flex items-center justify-center h-32">
                  <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : gifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-zinc-500">
                  <ImageIcon size={32} className="mb-2 opacity-40" />
                  <p className="text-sm">{gifQuery ? 'GIF не найдены' : 'Нет трендовых GIF'}</p>
                </div>
              ) : (
                <div className="columns-2 gap-1 space-y-1">
                  {gifs.map(gif => (
                    <button
                      key={gif.id}
                      onClick={() => { onSendGif(gif); onClose(); }}
                      className="w-full rounded-xl overflow-hidden hover:opacity-80 transition-opacity block"
                    >
                      <img
                        src={gif.previewUrl || gif.url}
                        alt={gif.title}
                        className="w-full object-cover"
                        loading="lazy"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* CREATE TAB */}
        {tab === 'create' && (
          <div className="flex-1 overflow-y-auto p-4">
            {showCropper ? (
              <StickerCropper onDone={handleCropDone} onCancel={handleCropCancel} />
            ) : createStep === 'pack' ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white mb-1">Создать стикер-пак</h3>
                  <p className="text-xs text-zinc-500">Загрузи свои стикеры и поделись ими с другими</p>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Название пака *</label>
                  <input
                    type="text"
                    value={newPackName}
                    onChange={e => setNewPackName(e.target.value)}
                    placeholder="Мои стикеры"
                    maxLength={50}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Описание</label>
                  <input
                    type="text"
                    value={newPackDesc}
                    onChange={e => setNewPackDesc(e.target.value)}
                    placeholder="Необязательно"
                    maxLength={200}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">Видимость</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setNewPackPublic(true)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                        newPackPublic
                          ? 'bg-nexo-500/20 border-nexo-500 text-white'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      <Globe size={16} />
                      <div className="text-left">
                        <div className="text-xs font-medium">Публичный</div>
                        <div className="text-[10px] opacity-60">Все могут использовать</div>
                      </div>
                      {newPackPublic && <Check size={14} className="ml-auto text-nexo-400" />}
                    </button>
                    <button
                      onClick={() => setNewPackPublic(false)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                        !newPackPublic
                          ? 'bg-nexo-500/20 border-nexo-500 text-white'
                          : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'
                      }`}
                    >
                      <Lock size={16} />
                      <div className="text-left">
                        <div className="text-xs font-medium">Приватный</div>
                        <div className="text-[10px] opacity-60">Только для тебя</div>
                      </div>
                      {!newPackPublic && <Check size={14} className="ml-auto text-nexo-400" />}
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleCreatePack}
                  disabled={!newPackName.trim() || creatingPack}
                  className="w-full py-2.5 rounded-xl bg-nexo-500 text-white text-sm font-medium hover:bg-nexo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {creatingPack ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} />
                      Создать пак
                    </>
                  )}
                </button>
              </div>
            ) : (
              // Add stickers step
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCreateStep('pack')}
                    className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{createdPack?.name}</h3>
                    <p className="text-xs text-zinc-500">Добавь стикеры в пак</p>
                  </div>
                </div>

                {/* Added stickers preview */}
                {createdStickers.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-400 mb-2">Добавлено: {createdStickers.length}</p>
                    <div className="grid grid-cols-5 gap-1">
                      {createdStickers.map(s => (
                        <div key={s.id} className="aspect-square p-1 rounded-xl bg-white/5 flex items-center justify-center">
                          <img src={s.fileUrl} alt={s.emoji} className="w-full h-full object-contain" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add sticker form */}
                <div className="bg-white/5 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-medium text-zinc-300">Добавить стикер</p>

                  {/* File upload */}
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleStickerFileChange}
                      className="hidden"
                    />
                    {stickerPreview ? (
                      <div className="relative w-20 h-20 mx-auto">
                        <img src={stickerPreview} alt="preview" className="w-full h-full object-contain rounded-xl" />
                        <button
                          onClick={() => { setStickerFile(null); setStickerPreview(null); }}
                          className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                        >
                          <X size={10} className="text-white" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex-1 h-20 border-2 border-dashed border-white/20 rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-500 hover:border-nexo-500/50 hover:text-nexo-400 transition-colors"
                        >
                          <Upload size={20} />
                          <span className="text-xs">Загрузить</span>
                        </button>
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="h-20 w-20 border-2 border-dashed border-nexo-500/30 rounded-xl flex flex-col items-center justify-center gap-1 text-nexo-400 hover:bg-nexo-500/10 transition-colors"
                          title="Обрезать перед загрузкой"
                        >
                          <Scissors size={18} />
                          <span className="text-[9px]">Кроп</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Emoji */}
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Эмодзи</label>
                    <input
                      type="text"
                      value={stickerEmoji}
                      onChange={e => setStickerEmoji(e.target.value)}
                      placeholder="😀"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50"
                    />
                  </div>

                  <button
                    onClick={handleAddSticker}
                    disabled={!stickerFile || addingSticker}
                    className="w-full py-2 rounded-xl bg-nexo-500/20 border border-nexo-500/30 text-nexo-400 text-xs font-medium hover:bg-nexo-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1"
                  >
                    {addingSticker ? (
                      <div className="w-3 h-3 border-2 border-nexo-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Plus size={12} />
                        Добавить стикер
                      </>
                    )}
                  </button>
                </div>

                <button
                  onClick={handleFinishCreating}
                  className="w-full py-2.5 rounded-xl bg-nexo-500 text-white text-sm font-medium hover:bg-nexo-600 transition-colors flex items-center justify-center gap-2"
                >
                  <Check size={16} />
                  Готово ({createdStickers.length} стикеров)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom tabs - Telegram style */}
      <div className="flex items-center justify-around border-t border-white/10 px-1 py-1.5">
        <button
          onClick={() => { setTab('emojis'); setSelectedPack(null); }}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 ${
            tab === 'emojis' ? 'text-[#6ab2f2] bg-[#6ab2f2]/10' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Smile size={20} />
          <span className="text-[10px] font-medium">Эмодзи</span>
        </button>
        <button
          onClick={() => setTab('gifs')}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 ${
            tab === 'gifs' ? 'text-[#6ab2f2] bg-[#6ab2f2]/10' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <ImageIcon size={20} />
          <span className="text-[10px] font-medium">GIF</span>
        </button>
        <button
          onClick={() => { setTab('stickers'); setSelectedPack(null); }}
          className={`flex flex-col items-center gap-0.5 py-1.5 px-3 rounded-xl transition-all duration-150 ${
            tab === 'stickers' ? 'text-[#6ab2f2] bg-[#6ab2f2]/10' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Package size={20} />
          <span className="text-[10px] font-medium">Стикеры</span>
        </button>
      </div>
    </>
  );

  // Мобильная версия — шторка
  if (isMobile) {
    return (
      <BottomSheet isOpen={true} onClose={onClose} title="Стикеры и эмодзи" maxHeight="75vh">
        {pickerContent}
      </BottomSheet>
    );
  }

  // Десктоп — popup
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 8 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full mb-2 w-[360px] h-[480px] liquid-glass-strong rounded-2xl shadow-2xl overflow-hidden flex flex-col z-[9999] left-1/2 -translate-x-1/2"
      onClick={e => e.stopPropagation()}
    >
      {pickerContent}
    </motion.div>
  );
}

// Custom emoji section
function CustomEmojiSection({ onSelect }: { onSelect: (url: string) => void }) {
  const [emojis, setEmojis] = useState<Array<{ id: string; name: string; url: string; shortcode: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [showPaint, setShowPaint] = useState(false);

  useEffect(() => {
    api.get('/custom-emojis').then((data: any) => {
      setEmojis(data || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading || emojis.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-zinc-500 font-medium uppercase tracking-wide">Кастомные эмодзи</p>
        <button
          onClick={() => setShowPaint(!showPaint)}
          className="p-1 rounded-lg text-zinc-500 hover:text-[#6ab2f2] hover:bg-white/5 transition-colors"
          title="Создать эмодзи"
        >
          <Pencil size={14} />
        </button>
      </div>
      {showPaint && (
        <div className="mb-2 p-2 rounded-xl bg-white/5 border border-white/10">
          <p className="text-xs text-zinc-400 mb-2">Создайте кастомный эмодзи</p>
          <a href="/emoji-editor" target="_blank" className="text-xs text-[#6ab2f2] hover:underline">
            Открыть редактор →
          </a>
        </div>
      )}
      <div className="grid grid-cols-8 gap-0.5">
        {emojis.map((emoji) => (
          <button
            key={emoji.id}
            onClick={() => onSelect(emoji.url)}
            className="w-9 h-9 flex items-center justify-center hover:bg-white/10 rounded-lg transition-colors p-0.5"
            title={`:${emoji.shortcode}:`}
          >
            <img src={emoji.url} alt={emoji.shortcode} className="w-7 h-7 object-contain" />
          </button>
        ))}
      </div>
    </div>
  );
}

// Emoji grid component
function EmojiGrid({ onSelect }: { onSelect: (emoji: string) => void }) {
  const emojiCategories = [
    { name: 'Часто используемые', emojis: ['😀', '😂', '😍', '🥰', '😊', '😎', '🤔', '😅', '😭', '🥺', '😡', '👍', '👎', '❤️', '🔥', '✨', '🎉', '💯', '🙏', '👏'] },
    { name: 'Смайлики', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥'] },
    { name: 'Жесты', emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏'] },
    { name: 'Животные', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐻‍❄️', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞'] },
    { name: 'Еда', emojis: ['🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄'] },
  ];

  return (
    <div className="space-y-4">
      {emojiCategories.map((category) => (
        <div key={category.name}>
          <p className="text-xs text-zinc-500 font-medium mb-2 uppercase tracking-wide">{category.name}</p>
          <div className="grid grid-cols-8 gap-0.5">
            {category.emojis.map((emoji, i) => (
              <button
                key={`${category.name}-${i}`}
                onClick={() => onSelect(emoji)}
                className="w-9 h-9 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Pack row component
function StickerPackRow({
  pack,
  isMine,
  onClick,
  onDelete,
}: {
  pack: StickerPack;
  isMine: boolean;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const thumbnail = pack.stickers?.[0]?.fileUrl || pack.thumbnail;

  return (
    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl liquid-glass-subtle flex items-center justify-center flex-shrink-0 overflow-hidden">
          {thumbnail ? (
            <img src={thumbnail} alt={pack.name} className="w-full h-full object-contain p-1" />
          ) : (
            <Package size={20} className="text-zinc-500" />
          )}
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{pack.name}</p>
          <p className="text-xs text-zinc-500 truncate">
            {pack.description || (isMine ? 'Мой пак' : 'Публичный пак')}
          </p>
        </div>
      </button>
      {isMine && onDelete && (
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
