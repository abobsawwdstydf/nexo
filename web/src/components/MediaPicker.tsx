import { useState, useEffect, useRef, useCallback } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Smile, Package, Image, Search, Plus, ChevronLeft, Upload, Trash2, Globe, Lock, Check, X } from 'lucide-react';
import { useLang } from '../lib/i18n';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import AnimatedEmoji from './AnimatedEmoji';
import { EMOJI_CATEGORIES } from '../lib/animatedEmojis';

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

interface MediaPickerProps {
  onClose: () => void;
  onSelectEmoji: (emoji: string) => void;
  onSendSticker: (sticker: Sticker) => void;
  onSendGif: (gif: GifItem) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  inline?: boolean;
}

type Tab = 'emoji' | 'stickers' | 'create';
type CreateStep = 'pack' | 'stickers';

export default function MediaPicker({
  onClose,
  onSelectEmoji,
  onSendSticker,
  onSendGif,
  anchorRef,
  inline,
}: MediaPickerProps) {
  const { lang } = useLang();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<Tab>('emoji');
  const [isMobile, setIsMobile] = useState(false);
  const [pos, setPos] = useState<{ bottom: number; left?: number; right?: number; width?: number } | null>(null);
  const [activeEmojiCategory, setActiveEmojiCategory] = useState(0);

  // Stickers state
  const [packs, setPacks] = useState<StickerPack[]>([]);
  const [myPacks, setMyPacks] = useState<StickerPack[]>([]);
  const [selectedPack, setSelectedPack] = useState<StickerPack | null>(null);
  const [packStickers, setPackStickers] = useState<Sticker[]>([]);
  const [loadingPacks, setLoadingPacks] = useState(false);
  const [loadingStickers, setLoadingStickers] = useState(false);
  const [stickerSearch, setStickerSearch] = useState('');
  const stickerSearchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Pagination for packs
  const [packsOffset, setPacksOffset] = useState(0);
  const [hasMorePacks, setHasMorePacks] = useState(true);
  const [loadingMorePacks, setLoadingMorePacks] = useState(false);
  const packsScrollRef = useRef<HTMLDivElement>(null);

  // Pagination for stickers in pack
  const [stickersOffset, setStickersOffset] = useState(0);
  const [hasMoreStickers, setHasMoreStickers] = useState(true);
  const [loadingMoreStickers, setLoadingMoreStickers] = useState(false);
  const stickersScrollRef = useRef<HTMLDivElement>(null);

  // Drag-and-drop state
  const [dragOver, setDragOver] = useState(false);
  const dragCounter = useRef(0);

  // GIF state
  const [gifQuery, setGifQuery] = useState('');
  const [gifs, setGifs] = useState<GifItem[]>([]);
  const [loadingGifs, setLoadingGifs] = useState(false);
  const gifSearchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Compute position for desktop - fill the chat module width
  useEffect(() => {
    if (isMobile) return;
    const update = () => {
      const el = anchorRef?.current ?? document.querySelector('[data-mediapicker-anchor]') as HTMLElement | null;
      if (!el) {
        setPos({ bottom: 80, right: undefined as any });
        return;
      }
      const rect = el.getBoundingClientRect();
      const bottom = window.innerHeight - rect.top + 8;
      // Find the chat container (max-w-3xl or nearest centered parent)
      let container = el.closest('.max-w-3xl') as HTMLElement | null;
      if (!container) container = el.closest('[class*="max-w-"]') as HTMLElement | null;
      if (container) {
        const cr = container.getBoundingClientRect();
        const left = cr.left;
        setPos({ bottom, left, width: cr.width });
      } else {
        const centerX = rect.left + rect.width / 2;
        const right = window.innerWidth - centerX - 768 / 2;
        setPos({ bottom, right, width: 768 });
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [isMobile, anchorRef]);

  // Load sticker packs when tab opens
  useEffect(() => {
    if (tab === 'stickers') loadPacks(true);
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

  const loadPacks = async (reset = false, search = '') => {
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
        api.getStickerPacks(50, offset, search),
        reset && !search ? api.getMyStickerPacks() : Promise.resolve(null),
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
      console.error(e);
    } finally {
      setLoadingPacks(false);
      setLoadingMorePacks(false);
    }
  };

  const handleStickerSearch = (q: string) => {
    setStickerSearch(q);
    if (stickerSearchRef.current) clearTimeout(stickerSearchRef.current);
    stickerSearchRef.current = setTimeout(() => loadPacks(true, q), 300);
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
      console.error(e);
    } finally {
      setLoadingStickers(false);
      setLoadingMoreStickers(false);
    }
  };

  // Infinite scroll handlers
  const handlePacksScroll = useCallback(() => {
    const el = packsScrollRef.current;
    if (!el || loadingMorePacks || !hasMorePacks || loadingPacks) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 100) {
      loadPacks(false);
    }
  }, [loadingMorePacks, hasMorePacks, loadingPacks, packsOffset]);

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
      const d = await api.getTrendingGifs(30);
      setGifs(d || []);
    } catch (e) {
      setGifs([]);
    } finally {
      setLoadingGifs(false);
    }
  };

  const searchGifs = useCallback(async (query: string) => {
    if (!query.trim()) { loadTrendingGifs(); return; }
    setLoadingGifs(true);
    try {
      const d = await api.searchGifs(query);
      setGifs(d || []);
    } catch (e) {
      console.error(e);
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
      const pack = await api.createStickerPack({ name: newPackName.trim(), description: newPackDesc.trim() || undefined, isPublic: newPackPublic });
      setCreatedPack(pack);
      setCreatedStickers([]);
      setCreateStep('stickers');
    } catch (e) {
      console.error(e);
    } finally {
      setCreatingPack(false);
    }
  };

  const handleStickerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setStickerFile(file);
    setStickerPreview(URL.createObjectURL(file));
  };

  const handleStickerDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    dragCounter.current = 0;
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setStickerFile(file);
      setStickerPreview(URL.createObjectURL(file));
    }
  };

  const handleStickerDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleStickerDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    setDragOver(true);
  };

  const handleStickerDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      setDragOver(false);
      dragCounter.current = 0;
    }
  };

  const handleAddSticker = async () => {
    if (!createdPack || !stickerFile) return;
    setAddingSticker(true);
    try {
      const uploadResult = await api.uploadFile(stickerFile);
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
      console.error(e);
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
      console.error(e);
    }
  };

  const allPacks = [...myPacks, ...packs.filter(p => !myPacks.find(mp => mp.id === p.id))];

  const pickerContent = (
    <>
      {!inline && (
        <div className="fixed inset-0 z-[9989]" onClick={(e) => {
          e.stopPropagation();
          onClose();
        }} />
      )}

      <div
        onClick={e => {
          e.stopPropagation();
        }}
        style={
          inline
            ? { width: '100%' } as React.CSSProperties
            : isMobile
              ? { maxHeight: '70vh' } as React.CSSProperties
              : pos
                ? {
                    position: 'fixed' as const,
                    bottom: pos.bottom,
                    ...(pos.left !== undefined ? { left: pos.left } : {}),
                    ...(pos.right !== undefined ? { right: pos.right } : {}),
                    zIndex: 9990,
                    width: pos.width || 360,
                    maxHeight: 480,
                    transform: pos.left !== undefined ? undefined : undefined,
                  }
                : { position: 'fixed' as const, bottom: 80, left: '50%', transform: 'translateX(-50%)', zIndex: 9990, width: 768, maxHeight: 480 }
        }
        className={
          inline
            ? 'flex-1 min-h-0 bg-[#111113] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden'
            : isMobile
              ? 'fixed bottom-0 left-0 right-0 z-[9990] bg-[#111113] border-t border-white/10 rounded-t-2xl shadow-2xl flex flex-col'
              : 'bg-[#111113] border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden'
        }
      >
        {/* Tabs */}
        <div className="flex items-center border-b border-white/10 px-2 pt-2 gap-0.5 flex-shrink-0">
          <TabBtn active={tab === 'emoji'} onClick={() => setTab('emoji')} color="yellow">
            <Smile size={14} />
            Эмодзи
          </TabBtn>
          <TabBtn active={tab === 'stickers'} onClick={() => { setTab('stickers'); setSelectedPack(null); }} color="nexo">
            <Package size={14} />
            Стикеры
          </TabBtn>
          <TabBtn active={tab === 'create'} onClick={() => setTab('create')} color="green">
            <Plus size={14} />
            Создать
          </TabBtn>
          <div className="flex-1" />
          <button onClick={onClose} className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-hidden flex flex-col min-h-0 ${inline ? '' : isMobile ? 'max-h-[60vh]' : 'max-h-[420px]'}`}>

          {/* EMOJI TAB */}
          {tab === 'emoji' && (
            <div className="flex-1 overflow-hidden w-full flex flex-col min-h-0">
              <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-white/[0.06] overflow-x-auto flex-shrink-0 scrollbar-hide">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.name}
                    onClick={() => setActiveEmojiCategory(i)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                      activeEmojiCategory === i
                        ? 'bg-nexo-500/20 text-nexo-400 border border-nexo-500/30'
                        : 'text-zinc-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-2 min-h-0">
                <div className="grid grid-cols-8 gap-0.5">
                  {EMOJI_CATEGORIES[activeEmojiCategory]?.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { onSelectEmoji(emoji); onClose(); }}
                      className="w-full aspect-square rounded-lg hover:bg-white/[0.08] transition-colors flex items-center justify-center p-0.5"
                      title={emoji}
                    >
                      <AnimatedEmoji emoji={emoji} size={28} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STICKERS TAB */}
          {tab === 'stickers' && (
            <div className="flex-1 overflow-hidden flex flex-col min-h-0">
              {selectedPack ? (
                <div className="flex-1 overflow-hidden flex flex-col min-h-0">
                  <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 flex-shrink-0">
                    <button onClick={() => setSelectedPack(null)} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
                      <ChevronLeft size={16} />
                    </button>
                    <span className="text-sm font-medium text-white flex-1 truncate">{selectedPack.name}</span>
                    {selectedPack.creatorId === user?.id && (
                      <button onClick={() => handleDeletePack(selectedPack.id)} className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                  <div
                    ref={stickersScrollRef}
                    onScroll={handleStickersScroll}
                    className="flex-1 overflow-y-auto min-h-0"
                  >
                    {loadingStickers ? (
                      <div className="grid grid-cols-5 gap-0.5 p-0.5">
                        {Array.from({ length: 15 }).map((_, i) => (
                          <div key={i} className="aspect-square rounded-lg bg-white/5 animate-pulse" />
                        ))}
                      </div>
                    ) : packStickers.length === 0 ? (
                      <Empty icon={<Package size={28} />} text="Стикеры не найдены" />
                    ) : (
                      <div className="grid grid-cols-5 gap-0.5 p-0.5">
                        {packStickers.map(sticker => (
                          <button
                            key={sticker.id}
                            onClick={() => { onSendSticker(sticker); onClose(); }}
                            className="aspect-square rounded-lg hover:bg-white/10 transition-colors flex items-center justify-center overflow-hidden"
                            title={sticker.emoji}
                          >
                            <img src={sticker.fileUrl} alt={sticker.emoji} className="w-full h-full object-contain" loading="lazy" />
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
                <div className="flex flex-col flex-1 min-h-0">
                  <div className="px-3 pt-2 pb-1 flex-shrink-0">
                    <div className="relative">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                      <input
                        type="text"
                        value={stickerSearch}
                        onChange={e => handleStickerSearch(e.target.value)}
                        placeholder="Поиск стикеров..."
                        className="w-full pl-7 pr-3 py-1.5 rounded-xl bg-white/[0.06] border border-white/[0.08] text-xs text-white placeholder-zinc-500 outline-none focus:border-nexo-500/40"
                      />
                    </div>
                  </div>
                <div
                  ref={packsScrollRef}
                  onScroll={handlePacksScroll}
                  className="flex-1 overflow-y-auto p-3 min-h-0"
                >
                  {loadingPacks ? (
                    <Spinner />
                  ) : allPacks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 px-4">
                      <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
                        <Package size={32} className="text-zinc-500" />
                      </div>
                      <p className="text-sm font-medium text-zinc-300 mb-1">Пока нет стикер-паков</p>
                      <p className="text-xs text-zinc-500 text-center mb-4 max-w-[200px]">Создай свой пак стикеров и поделись с друзьями</p>
                      <button
                        onClick={() => setTab('create')}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/15 transition-colors"
                      >
                        <Plus size={16} />
                        Создать пак
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {myPacks.length > 0 && <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mb-1">Мои паки</p>}
                      {myPacks.map(pack => (
                        <StickerPackRow key={pack.id} pack={pack} isMine onClick={() => loadPackStickers(pack, true)} onDelete={() => handleDeletePack(pack.id)} />
                      ))}
                      {packs.filter(p => !myPacks.find(mp => mp.id === p.id)).length > 0 && (
                        <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wide mt-3 mb-1">Публичные паки</p>
                      )}
                      {packs.filter(p => !myPacks.find(mp => mp.id === p.id)).map(pack => (
                        <StickerPackRow key={pack.id} pack={pack} isMine={false} onClick={() => loadPackStickers(pack, true)} />
                      ))}
                    </div>
                  )}
                  {loadingMorePacks && (
                    <div className="flex items-center justify-center py-4">
                      <div className="w-5 h-5 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                </div>
              )}
            </div>
          )}

          {/* CREATE TAB */}
          {tab === 'create' && (
            <div className="flex-1 overflow-y-auto p-4">
              {createStep === 'pack' ? (
                <div className="space-y-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white mb-0.5">Создать стикер-пак</h3>
                    <p className="text-xs text-zinc-500">Загрузи свои стикеры и поделись ими</p>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Название *</label>
                    <input type="text" value={newPackName} onChange={e => setNewPackName(e.target.value)} placeholder="Мои стикеры" maxLength={50}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Описание</label>
                    <input type="text" value={newPackDesc} onChange={e => setNewPackDesc(e.target.value)} placeholder="Необязательно" maxLength={200}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-nexo-500/50" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setNewPackPublic(true)} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-xs ${newPackPublic ? 'bg-nexo-500/20 border-nexo-500 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>
                      <Globe size={14} /><span>Публичный</span>{newPackPublic && <Check size={12} className="ml-auto text-nexo-400" />}
                    </button>
                    <button onClick={() => setNewPackPublic(false)} className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all text-xs ${!newPackPublic ? 'bg-nexo-500/20 border-nexo-500 text-white' : 'bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10'}`}>
                      <Lock size={14} /><span>Приватный</span>{!newPackPublic && <Check size={12} className="ml-auto text-nexo-400" />}
                    </button>
                  </div>
                  <button onClick={handleCreatePack} disabled={!newPackName.trim() || creatingPack}
                    className="w-full py-2.5 rounded-xl bg-nexo-500 text-white text-sm font-medium hover:bg-nexo-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
                    {creatingPack ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus size={16} />Создать пак</>}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <button onClick={() => setCreateStep('pack')} className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"><ChevronLeft size={16} /></button>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{createdPack?.name}</h3>
                      <p className="text-xs text-zinc-500">Добавь стикеры в пак</p>
                    </div>
                  </div>
                  {createdStickers.length > 0 && (
                    <div>
                      <p className="text-xs text-zinc-400 mb-1">Добавлено: {createdStickers.length}</p>
                      <div className="grid grid-cols-5 gap-1">
                        {createdStickers.map(s => (
                          <div key={s.id} className="aspect-square p-1 rounded-xl bg-white/5 flex items-center justify-center">
                            <img src={s.fileUrl} alt={s.emoji} className="w-full h-full object-contain" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="bg-white/5 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-medium text-zinc-300">Добавить стикер</p>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleStickerFileChange} className="hidden" />
                    {stickerPreview ? (
                      <div className="relative w-16 h-16 mx-auto">
                        <img src={stickerPreview} alt="preview" className="w-full h-full object-contain rounded-xl" />
                        <button onClick={() => { setStickerFile(null); setStickerPreview(null); }} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"><X size={10} className="text-white" /></button>
                      </div>
                    ) : (
                      <div
                        onDrop={handleStickerDrop}
                        onDragOver={handleStickerDragOver}
                        onDragEnter={handleStickerDragEnter}
                        onDragLeave={handleStickerDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                        className={`w-full h-16 border-2 border-dashed rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors ${
                          dragOver
                            ? 'border-nexo-400 bg-nexo-500/10 text-nexo-300'
                            : 'border-white/20 text-zinc-500 hover:border-nexo-500/50 hover:text-nexo-400'
                        }`}
                      >
                        <Upload size={18} />
                        <span className="text-xs">{dragOver ? 'Отпусти файл' : 'PNG, GIF, WebP или перетащи'}</span>
                      </div>
                    )}
                    <input type="text" value={stickerEmoji} onChange={e => setStickerEmoji(e.target.value)} placeholder="😀"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:outline-none" />
                    <button onClick={handleAddSticker} disabled={!stickerFile || addingSticker}
                      className="w-full py-1.5 rounded-xl bg-nexo-500/20 border border-nexo-500/30 text-nexo-400 text-xs font-medium hover:bg-nexo-500/30 disabled:opacity-50 transition-colors flex items-center justify-center gap-1">
                      {addingSticker ? <div className="w-3 h-3 border-2 border-nexo-400 border-t-transparent rounded-full animate-spin" /> : <><Plus size={12} />Добавить стикер</>}
                    </button>
                  </div>
                  <button onClick={handleFinishCreating} className="w-full py-2.5 rounded-xl bg-nexo-500 text-white text-sm font-medium hover:bg-nexo-600 transition-colors flex items-center justify-center gap-2">
                    <Check size={16} />Готово ({createdStickers.length} стикеров)
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );

  return inline
    ? pickerContent
    : createPortal(pickerContent, document.body);
}

function TabBtn({ active, onClick, color, children }: { active: boolean; onClick: () => void; color: string; children: React.ReactNode }) {
  const colorMap: Record<string, string> = {
    yellow: 'text-yellow-400 border-yellow-500',
    nexo: 'text-nexo-400 border-nexo-500',
    pink: 'text-pink-400 border-pink-500',
    green: 'text-emerald-400 border-emerald-500',
  };
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-2 text-xs font-medium transition-colors ${
        active ? `${colorMap[color]} border-b-2` : 'text-zinc-400 hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex items-center justify-center h-24">
      <div className="w-6 h-6 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function Empty({ icon, text, children }: { icon: React.ReactNode; text: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-24 text-zinc-500 gap-2">
      <div className="opacity-40">{icon}</div>
      <p className="text-sm">{text}</p>
      {children}
    </div>
  );
}

function StickerPackRow({ pack, isMine, onClick, onDelete }: { pack: StickerPack; isMine: boolean; onClick: () => void; onDelete?: () => void }) {
  const thumbnail = pack.stickers?.[0]?.fileUrl || pack.thumbnail;
  return (
    <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-colors group">
      <button onClick={onClick} className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0 overflow-hidden">
          {thumbnail ? <img src={thumbnail} alt={pack.name} className="w-full h-full object-contain p-1" /> : <Package size={18} className="text-zinc-500" />}
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-medium text-white truncate">{pack.name}</p>
          <p className="text-xs text-zinc-500 truncate">{pack.description || (isMine ? 'Мой пак' : 'Публичный пак')}</p>
        </div>
      </button>
      {isMine && onDelete && (
        <button onClick={e => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}
