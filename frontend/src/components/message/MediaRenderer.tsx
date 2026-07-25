import { useState } from 'react';
import { Video, FileText, Play } from 'lucide-react';
import { normalizeMediaUrl } from '../../lib/mediaUrl';
import { useLang } from '../../lib/i18n';
import VideoPlayer from '../VideoPlayer';
import VideoNotePlayer from '../VideoNotePlayer';
import type { MediaItem, Message } from '../../lib/types';

interface MediaRendererProps {
  message: Message;
  media: MediaItem[];
  isMine: boolean;
  hasImage: boolean;
  hasVideo: boolean;
  hasFile: boolean;
  onOpenLightbox: (url: string) => void;
}

/**
 * Isolated component for video messages — isolates load error state.
 */
function VideoMessage({
  media,
  content,
  isMine,
  sizeStr,
  durStr,
  videoUrl: externalVideoUrl,
  onOpenPlayer,
}: {
  media: MediaItem;
  content: string | null;
  isMine: boolean;
  sizeStr: string;
  durStr: string;
  videoUrl?: string;
  onOpenPlayer: (url: string) => void;
}) {
  const [loadError, setLoadError] = useState(false);
  const videoUrl = externalVideoUrl || normalizeMediaUrl(media.url);
  const posterUrl = normalizeMediaUrl(media.thumbnail);

  return (
    <div className={`${content ? 'mb-2 -mx-3 -mt-2' : ''}`}>
      <div
        className="relative rounded-2xl overflow-hidden bg-black group cursor-pointer shadow-lg"
        onClick={() => !loadError && onOpenPlayer(videoUrl)}
      >
        {!loadError ? (
          <video
            src={videoUrl}
            poster={posterUrl || ''}
            className="w-full max-w-[320px] max-h-64 object-contain"
            preload="metadata"
            crossOrigin="anonymous"
            onError={() => setLoadError(true)}
          />
        ) : (
          <a
            href={videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center w-full max-w-[320px] h-48 bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
            onClick={(e) => e.stopPropagation()}
          >
            <Video size={32} className="mb-2 opacity-50" />
            <span className="text-xs">Не удалось загрузить видео</span>
            <span className="text-[10px] opacity-60 mt-1">Нажмите чтобы открыть в новой вкладке</span>
          </a>
        )}
        {!loadError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-all">
            <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform border border-white/30">
              <Play size={24} className="text-white ml-1" />
            </div>
          </div>
        )}
        {!loadError && (durStr || sizeStr) && (
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            {durStr && (
              <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-xs text-white font-mono">
                {durStr}
              </span>
            )}
            {sizeStr && (
              <span className="px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-sm text-[10px] text-white/70">
                {sizeStr}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MediaRenderer({
  message,
  media,
  isMine,
  hasImage,
  hasVideo,
  hasFile,
  onOpenLightbox,
}: MediaRendererProps) {
  const { t } = useLang();
  const [showVideoPlayer, setShowVideoPlayer] = useState<string | null>(null);

  const hasVoice = message.type === 'voice' || media.some(m => m.type === 'voice');
  const hasAudio = !hasVoice && (message.type === 'audio' || media.some(m => m.type === 'audio'));

  return (
    <>
      {/* Video Note */}
      {(message.type === 'video_note' || media.some(m => m.type === 'video_note')) && (() => {
        const videoNoteMedia = media.find(m => m.type === 'video_note');
        const videoUrl = message.videoUrl || videoNoteMedia?.url;
        if (!videoUrl) return null;
        return (
          <div className="flex justify-center py-2">
            <VideoNotePlayer
              videoUrl={normalizeMediaUrl(videoUrl)}
              duration={message.duration || videoNoteMedia?.duration || 0}
              thumbnail={message.thumbnail ? normalizeMediaUrl(message.thumbnail) : null}
            />
          </div>
        );
      })()}

      {/* Sticker */}
      {(message.type === 'sticker' || media.some(m => m.type === 'sticker')) && (
        <div className="flex justify-center">
          {(() => {
            const stickerMedia = message.type === 'sticker' && message.media?.[0] 
              ? message.media[0] 
              : media.find(m => m.type === 'sticker');
            if (!stickerMedia?.url) return null;
            const stickerUrl = normalizeMediaUrl(stickerMedia.url);
            return (
              <img
                src={stickerUrl}
                alt="sticker"
                className="w-40 h-40 object-contain select-none"
                draggable={false}
                loading="lazy"
              />
            );
          })()}
        </div>
      )}

      {/* GIF */}
      {message.type === 'gif' && message.media?.[0]?.url && (
        <div className="rounded-xl overflow-hidden max-w-[280px]">
          <img
            src={normalizeMediaUrl(message.media[0].url)}
            alt={message.content || 'GIF'}
            className="w-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => onOpenLightbox(normalizeMediaUrl(message.media![0].url))}
          />
          {message.content && (
            <p className="text-xs text-zinc-400 px-2 py-1 truncate">{message.content}</p>
          )}
        </div>
      )}

      {/* Images */}
      {hasImage && (
        <div className="">
          {(() => {
            const images = media.filter((m) => m.type === 'image');
            const isSingle = images.length === 1;
            return (
              <div className={isSingle ? '' : 'grid grid-cols-2 gap-1'}>
                {images.map((m) => {
                  const imageUrl = normalizeMediaUrl(m.url);
                  return (
                    <div key={m.id} className={`relative overflow-hidden rounded-lg bg-black ${isSingle ? 'max-w-[320px]' : 'aspect-square'}`}>
                      <img
                        src={imageUrl}
                        alt=""
                        className={`${isSingle ? 'w-full h-auto max-h-[400px] object-contain' : 'w-full h-full object-cover'} cursor-pointer hover:brightness-90 transition-all select-none`}
                        onClick={() => onOpenLightbox(imageUrl)}
                        draggable={false}
                        loading="lazy"
                        onLoad={(e) => {
                          (e.target as HTMLImageElement).style.opacity = '1';
                        }}
                        onError={(e) => {
                          console.error('[Image] Ошибка загрузки:', imageUrl);
                          const img = e.target as HTMLImageElement;
                          img.style.display = 'none';
                          const parent = img.parentElement;
                          if (parent && !parent.querySelector('.broken-img')) {
                            const div = document.createElement('div');
                            div.className = 'broken-img absolute inset-0 flex flex-col items-center justify-center bg-zinc-800/90 text-zinc-500 gap-2';
                            div.innerHTML = `
                              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <path d="m21 15-5-5L5 21"/>
                              </svg>
                              <span class="text-xs">Ошибка загрузки</span>
                            `;
                            parent.appendChild(div);
                          }
                        }}
                        style={{ opacity: 0, transition: 'opacity 0.3s ease' }}
                      />
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Video */}
      {hasVideo &&
        media
          .filter((m) => m.type === 'video')
          .map((m) => {
            const videoUrl = normalizeMediaUrl(m.url);
            const size = m.size || 0;
            const sizeStr = size > 1024 * 1024 ? `${(size / 1024 / 1024).toFixed(1)} MB` : `${(size / 1024).toFixed(0)} KB`;
            const dur = m.duration || 0;
            const durStr = dur ? `${Math.floor(dur / 60)}:${Math.floor(dur % 60).toString().padStart(2, '0')}` : '';
            return (
              <VideoMessage
                key={m.id}
                media={m}
                content={message.content}
                isMine={isMine}
                sizeStr={sizeStr}
                durStr={durStr}
                videoUrl={videoUrl}
                onOpenPlayer={(url) => setShowVideoPlayer(url)}
              />
            );
          })}

      {/* Video Player Modal */}
      {showVideoPlayer && (
        <VideoPlayer
          src={showVideoPlayer}
          onClose={() => setShowVideoPlayer(null)}
        />
      )}

      {/* Files */}
      {hasFile && (
        <div className={`${message.content ? 'mb-2' : ''} flex flex-wrap gap-2`}>
          {media
            .filter((m) => m.type !== 'image' && m.type !== 'voice' && m.type !== 'video' && m.type !== 'sticker' && m.type !== 'video_note')
            .map((m) => {
              let displayName = m.filename || t('fileLabel');
              if (displayName.length > 25) {
                const lastDot = displayName.lastIndexOf('.');
                if (lastDot > 0) {
                  const ext = displayName.slice(lastDot);
                  const name = displayName.slice(0, 20);
                  displayName = `${name}...${ext}`;
                } else {
                  displayName = `${displayName.slice(0, 20)}...`;
                }
              }
              return (
                <a
                  key={m.id}
                  href={normalizeMediaUrl(m.url)}
                  download={m.filename || 'file'}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={m.filename || undefined}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl ${
                    isMine ? 'bg-white/10 hover:bg-white/15' : 'bg-surface-tertiary hover:bg-surface-hover'
                  } transition-colors`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isMine ? 'bg-white/20' : 'bg-nexo-500/20'
                  }`}>
                    <FileText size={16} className={isMine ? 'text-white' : 'text-nexo-400'} />
                  </div>
                  <div className="flex flex-col min-w-0">
                    <p className="text-xs truncate max-w-[200px]" title={m.filename || undefined}>
                      {displayName}
                    </p>
                    <p className={`text-[10px] ${isMine ? 'text-white/50' : 'text-zinc-500'}`}>
                      {m.size ? `${(m.size / 1024).toFixed(1)} KB` : ''}
                    </p>
                  </div>
                </a>
              );
            })}
        </div>
      )}
    </>
  );
}
