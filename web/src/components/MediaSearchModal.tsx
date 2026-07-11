import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Image, FileText, Video, Music, Link, Filter, Download } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { useChatStore } from '../stores/chatStore';
import { useMusicPlayerStore } from '../stores/musicPlayerStore';
import BottomSheet from './BottomSheet';
import type { Message } from '../lib/types';

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < breakpoint);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < breakpoint);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [breakpoint]);
  return isMobile;
}

interface MediaSearchModalProps {
  chatId: string;
  onClose: () => void;
}

type MediaTab = 'media' | 'files' | 'links' | 'audio';

export default function MediaSearchModal({ chatId, onClose }: MediaSearchModalProps) {
  const [tab, setTab] = useState<MediaTab>('media');
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const isMobile = useIsMobile();

  const loadItems = useCallback(async (type: MediaTab) => {
    setLoading(true);
    try {
      // Используем новый API для поиска по медиа
      const mediaType = type === 'media' ? 'photo,video' : 
                       type === 'files' ? 'file' :
                       type === 'audio' ? 'audio,voice' : null;
      
      if (mediaType) {
        const data = await api.get(`/media-search/${chatId}?type=${mediaType}&limit=100`);
        // Преобразуем MediaIndex в формат Message для совместимости
        const messages = data.media.map((item: any) => ({
          id: item.messageId,
          content: '',
          sender: { displayName: 'User' },
          media: [{
            id: item.id,
            type: item.mediaType,
            url: item.mediaUrl,
            filename: item.filename,
            size: item.size,
            thumbnail: item.thumbnail,
          }],
        }));
        setItems(messages);
      } else if (type === 'links') {
        // Для ссылок используем старый API
        const data = await api.getSharedMedia(chatId, 'links');
        setItems(data);
      }
    } catch (e) {
      console.error(e);
      // Fallback to old API
      try {
        const apiType = type === 'audio' ? 'files' : type === 'media' ? 'media' : type;
        const data = await api.getSharedMedia(chatId, apiType as 'media' | 'files' | 'links');
        if (type === 'audio') {
          setItems(data.filter(m =>
            m.media?.some(med => med.type === 'audio' || med.filename?.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i))
            || m.type === 'voice'
          ));
        } else {
          setItems(data);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    loadItems(tab);
  }, [tab, loadItems]);

  const filtered = searchQuery.trim()
    ? items.filter(m =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.media?.some(med => med.filename?.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : items;

  const tabs: { id: MediaTab; label: string; icon: typeof Image }[] = [
    { id: 'media', label: 'Медиа', icon: Image },
    { id: 'files', label: 'Файлы', icon: FileText },
    { id: 'links', label: 'Ссылки', icon: Link },
    { id: 'audio', label: 'Аудио', icon: Music },
  ];

  const formatSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <>
      {isMobile ? (
        <BottomSheet isOpen onClose={onClose} showCloseButton={false}>
          <div className="flex flex-col max-h-[85vh]">
            {/* Header with search + close */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Search size={18} className="text-zinc-500" />
              <input
                type="text"
                placeholder="Поиск по медиа..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-zinc-500 text-sm outline-none"
                autoFocus
              />
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    tab === id ? 'text-nexo-400 border-b-2 border-nexo-500' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    {tab === 'media' ? <Image size={28} className="opacity-40" /> :
                     tab === 'files' ? <FileText size={28} className="opacity-40" /> :
                     tab === 'links' ? <Link size={28} className="opacity-40" /> :
                     <Music size={28} className="opacity-40" />}
                  </div>
                  <p className="text-sm">{searchQuery ? 'Ничего не найдено' : 'Нет медиафайлов'}</p>
                </div>
              ) : tab === 'media' ? (
                <div className="grid grid-cols-3 gap-0.5 p-0.5">
                  {filtered.map(msg =>
                    msg.media?.filter(m => m.type === 'image' || m.type === 'video').map(media => (
                      <button
                        key={media.id}
                        onClick={() => setLightboxUrl(normalizeMediaUrl(media.url))}
                        className="aspect-square relative overflow-hidden bg-zinc-800 hover:opacity-90 transition-opacity"
                      >
                        {media.type === 'video' ? (
                          <>
                            {media.thumbnail ? (
                              <img src={normalizeMediaUrl(media.thumbnail)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video size={24} className="text-zinc-500" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                                <Video size={14} className="text-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={normalizeMediaUrl(media.url)} alt="" className="w-full h-full object-cover" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              ) : tab === 'files' ? (
                <div className="divide-y divide-white/5">
                  {filtered.map(msg =>
                    msg.media?.filter(m => m.type === 'file' || m.type === 'document').map(media => (
                      <div key={media.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-nexo-500/20 flex items-center justify-center flex-shrink-0">
                          <FileText size={18} className="text-nexo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{media.filename || 'Файл'}</p>
                          <p className="text-xs text-zinc-500">{formatSize(media.size)}</p>
                        </div>
                        <a
                          href={normalizeMediaUrl(media.url)}
                          download={media.filename || true}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              ) : tab === 'links' ? (
                <div className="divide-y divide-white/5">
                  {filtered.map(msg => {
                    const urlRegex = /https?:\/\/[^\s]+/g;
                    const links = msg.content?.match(urlRegex) || [];
                    return links.map((link, i) => (
                      <a
                        key={`${msg.id}-${i}`}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Link size={18} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-nexo-400 truncate">{link}</p>
                          <p className="text-xs text-zinc-500 truncate">{msg.content?.slice(0, 60)}</p>
                        </div>
                      </a>
                    ));
                  })}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filtered.map(msg => {
                    const audioMedia = msg.media?.filter(m =>
                      m.type === 'audio' || m.filename?.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)
                    );
                    if (msg.type === 'voice') {
                      return (
                        <div key={msg.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <Music size={18} className="text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">Голосовое сообщение</p>
                            <p className="text-xs text-zinc-500">{msg.sender.displayName}</p>
                          </div>
                        </div>
                      );
                    }
                    return audioMedia?.map(media => (
                      <div key={media.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Music size={18} className="text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{media.filename || 'Аудио'}</p>
                          <p className="text-xs text-zinc-500">{formatSize(media.size)}</p>
                        </div>
                        <button
                          onClick={() => {
                            const { playTrack } = useMusicPlayerStore.getState();
                            playTrack({
                              id: media.id,
                              url: media.url,
                              title: media.filename || 'Аудио',
                              artist: msg.sender.displayName,
                            });
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-nexo-400 hover:bg-nexo-500/10 transition-colors"
                        >
                          <Music size={16} />
                        </button>
                      </div>
                    ));
                  })}
                </div>
              )}
            </div>
          </div>
        </BottomSheet>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-lg bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Search size={18} className="text-zinc-500" />
              <input
                type="text"
                placeholder="Поиск по медиа..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="flex-1 bg-transparent text-white placeholder-zinc-500 text-sm outline-none"
                autoFocus
              />
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors">
                <X size={16} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-white/5">
              {tabs.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium transition-colors ${
                    tab === id ? 'text-nexo-400 border-b-2 border-nexo-500' : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  <Icon size={14} />
                  {label}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-zinc-500 gap-3">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                    {tab === 'media' ? <Image size={28} className="opacity-40" /> :
                     tab === 'files' ? <FileText size={28} className="opacity-40" /> :
                     tab === 'links' ? <Link size={28} className="opacity-40" /> :
                     <Music size={28} className="opacity-40" />}
                  </div>
                  <p className="text-sm">{searchQuery ? 'Ничего не найдено' : 'Нет медиафайлов'}</p>
                </div>
              ) : tab === 'media' ? (
                <div className="grid grid-cols-3 gap-0.5 p-0.5">
                  {filtered.map(msg =>
                    msg.media?.filter(m => m.type === 'image' || m.type === 'video').map(media => (
                      <button
                        key={media.id}
                        onClick={() => setLightboxUrl(normalizeMediaUrl(media.url))}
                        className="aspect-square relative overflow-hidden bg-zinc-800 hover:opacity-90 transition-opacity"
                      >
                        {media.type === 'video' ? (
                          <>
                            {media.thumbnail ? (
                              <img src={normalizeMediaUrl(media.thumbnail)} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Video size={24} className="text-zinc-500" />
                              </div>
                            )}
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                                <Video size={14} className="text-white" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <img src={normalizeMediaUrl(media.url)} alt="" className="w-full h-full object-cover" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              ) : tab === 'files' ? (
                <div className="divide-y divide-white/5">
                  {filtered.map(msg =>
                    msg.media?.filter(m => m.type === 'file' || m.type === 'document').map(media => (
                      <div key={media.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-nexo-500/20 flex items-center justify-center flex-shrink-0">
                          <FileText size={18} className="text-nexo-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{media.filename || 'Файл'}</p>
                          <p className="text-xs text-zinc-500">{formatSize(media.size)}</p>
                        </div>
                        <a
                          href={normalizeMediaUrl(media.url)}
                          download={media.filename || true}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                          onClick={e => e.stopPropagation()}
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    ))
                  )}
                </div>
              ) : tab === 'links' ? (
                <div className="divide-y divide-white/5">
                  {filtered.map(msg => {
                    const urlRegex = /https?:\/\/[^\s]+/g;
                    const links = msg.content?.match(urlRegex) || [];
                    return links.map((link, i) => (
                      <a
                        key={`${msg.id}-${i}`}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                          <Link size={18} className="text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-nexo-400 truncate">{link}</p>
                          <p className="text-xs text-zinc-500 truncate">{msg.content?.slice(0, 60)}</p>
                        </div>
                      </a>
                    ));
                  })}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {filtered.map(msg => {
                    const audioMedia = msg.media?.filter(m =>
                      m.type === 'audio' || m.filename?.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)
                    );
                    if (msg.type === 'voice') {
                      return (
                        <div key={msg.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                          <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                            <Music size={18} className="text-purple-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-white">Голосовое сообщение</p>
                            <p className="text-xs text-zinc-500">{msg.sender.displayName}</p>
                          </div>
                        </div>
                      );
                    }
                    return audioMedia?.map(media => (
                      <div key={media.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors">
                        <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center flex-shrink-0">
                          <Music size={18} className="text-purple-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{media.filename || 'Аудио'}</p>
                          <p className="text-xs text-zinc-500">{formatSize(media.size)}</p>
                        </div>
                        <button
                          onClick={() => {
                            const { playTrack } = useMusicPlayerStore.getState();
                            playTrack({
                              id: media.id,
                              url: media.url,
                              title: media.filename || 'Аудио',
                              artist: msg.sender.displayName,
                            });
                          }}
                          className="w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-nexo-400 hover:bg-nexo-500/10 transition-colors"
                        >
                          <Music size={16} />
                        </button>
                      </div>
                    ));
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
            onClick={() => setLightboxUrl(null)}
          >
            <img
              src={lightboxUrl}
              alt=""
              className="max-w-full max-h-full object-contain"
              onClick={e => e.stopPropagation()}
            />
            <button
              onClick={() => setLightboxUrl(null)}
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
