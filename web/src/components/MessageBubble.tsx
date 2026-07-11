import { useState, useRef, useEffect, memo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  CheckCheck,
  Clock,
  Eye,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useChatStore } from '../stores/chatStore';
import { useLang } from '../lib/i18n';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { api } from '../lib/api';
import type { Message } from '../lib/types';
import ImageLightbox from './ImageLightbox';
import AIAssistantModal from './AIAssistantModal';
import ForwardModal from './ForwardModal';
import MessageTagModal from './MessageTagModal';
import Avatar from './Avatar';
import VerifiedBadge from './VerifiedBadge';

import CallMessage from './message/CallMessage';
import MediaRenderer from './message/MediaRenderer';
import AudioPlayer from './message/AudioPlayer';
import ReactionBar from './message/ReactionBar';
import ContextMenu from './message/ContextMenu';
import MessageContent, { PollRenderer } from './message/MessageContent';

interface MessageBubbleProps {
  message: Message;
  isMine: boolean;
  showAvatar: boolean;
  onViewProfile?: (userId: string) => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  onStartSelectionMode?: (id: string) => void;
}

function MessageBubble({
  message,
  isMine,
  showAvatar,
  onViewProfile,
  selectionMode,
  isSelected,
  onToggleSelect,
  onStartSelectionMode
}: MessageBubbleProps) {
  const { user } = useAuthStore();
  const { pinnedMessages, chats, messages } = useChatStore();
  const chatMessages = messages[message.chatId] || [];
  const chat = chats.find(c => c.id === message.chatId);
  const isChannel = chat?.type === 'channel';
  const { t, lang } = useLang();

  const senderName = isChannel ? (chat?.name || chat?.username || 'Канал') : (message.sender?.displayName || message.sender?.username || '');
  const senderAvatar = isChannel ? chat?.avatar : message.sender?.avatar;

  const [showContext, setShowContext] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [showForwardModal, setShowForwardModal] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [showAddToProfileModal, setShowAddToProfileModal] = useState(false);
  const [audioToAddUrl, setAudioToAddUrl] = useState<string | null>(null);
  const [showTagModal, setShowTagModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [messageTags, setMessageTags] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`nexo_msg_tags_${message.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const bubbleRef = useRef<HTMLDivElement>(null);
  const [quotedText, setQuotedText] = useState<string | null>(null);

  const isRead = message.readBy?.some((r) => r.userId !== user?.id);

  const timeStr = new Date(message.createdAt).toLocaleTimeString(lang === 'ru' ? 'ru-RU' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const isPinned = pinnedMessages[message.chatId]?.id === message.id;

  const media = message.media || [];
  const hasImage = media.some((m) => m.type === 'image');
  const hasVoice = message.type === 'voice' || media.some((m) => m.type === 'voice');
  const hasAudio = !hasVoice && (message.type === 'audio' || media.some((m) => m.type === 'audio'));
  const hasFile = media.some((m) => m.type !== 'image' && m.type !== 'voice' && m.type !== 'video' && m.type !== 'audio' && m.type !== 'sticker' && m.type !== 'video_note');
  const hasVideo = media.some((m) => m.type === 'video');

  // Context menu handler
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (selectionMode) {
      onToggleSelect?.(message.id);
      return;
    }
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;

    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && bubbleRef.current?.contains(selection?.anchorNode || null)) {
      setQuotedText(text);
    } else {
      setQuotedText(null);
    }

    const menuWidth = 208;
    const menuHeight = 350;
    let x = e.clientX;
    let y = e.clientY;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 8;
    setContextPos({ x, y });
    setShowContext(true);
  };

  const handleReply = () => {
    useChatStore.getState().setReplyTo({ ...message, quote: quotedText });
    setShowContext(false);
    setQuotedText(null);
  };

  // Deleted message — auto-hide after 5 seconds
  const [deletedVisible, setDeletedVisible] = useState(true);
  useEffect(() => {
    if (message.isDeleted) {
      const timer = setTimeout(() => setDeletedVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [message.isDeleted]);

  if (message.isDeleted) {
    if (!deletedVisible) return null;
    return (
      <motion.div
        initial={{ opacity: 1, height: 'auto' }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, height: 0 }}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}
      >
        <div className="px-4 py-2 rounded-2xl text-sm italic text-zinc-600 bg-surface-tertiary/50">
          {t('messageDeleted')}
        </div>
      </motion.div>
    );
  }

  // Helper for user tag styles
  const getTagStyle = (color?: string | null, style?: string | null): React.CSSProperties => {
    const c = color || '#6366f1';
    const s = style || 'solid';
    const hexToRgb = (hex: string) => {
      const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return r ? `${parseInt(r[1], 16)}, ${parseInt(r[2], 16)}, ${parseInt(r[3], 16)}` : '99, 102, 241';
    };
    const rgb = hexToRgb(c);
    switch (s) {
      case 'outline': return { background: 'transparent', border: `1px solid ${c}`, color: c };
      case 'gradient': return { background: `linear-gradient(135deg, ${c}, ${c}aa)`, color: '#fff', border: 'none' };
      case 'glow': return { background: `rgba(${rgb}, 0.2)`, border: `1px solid rgba(${rgb}, 0.5)`, color: c, boxShadow: `0 0 6px rgba(${rgb}, 0.4)` };
      default: return { background: c, color: '#fff', border: 'none' };
    }
  };

  const handleAddAudioToProfile = async () => {
    if (!audioToAddUrl) return;
    try {
      const voiceMedia = message.media?.find((m) => m.type === 'voice');
      const audioMedia = message.media?.find((m) => m.type === 'audio');
      const media = voiceMedia || audioMedia;
      const audioName = media?.filename || `Audio ${new Date().toLocaleTimeString()}`;

      const response = await fetch(audioToAddUrl);
      const blob = await response.blob();
      const result = await api.uploadFile(new File([blob], 'audio.wav', { type: blob.type }));
      if (!result || !result.url) throw new Error('Не получен URL файла');

      const profileRes = await fetch('/api/profile-music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          url: result.url,
          filename: audioName,
          duration: 0,
        }),
      });

      if (!profileRes.ok) {
        const error = await profileRes.json();
        throw new Error(error.message || 'Ошибка добавления в профиль');
      }
      alert('Аудио добавлено в профиль!');
      setShowAddToProfileModal(false);
      setAudioToAddUrl(null);
    } catch (error) {
      console.error('Failed to add audio to profile:', error);
      alert('Ошибка при добавлении аудио в профиль: ' + (error instanceof Error ? error.message : 'неизвестная ошибка'));
    }
  };

  return (
    <>
      <div
        ref={bubbleRef}
        className={`flex ${isMine ? 'justify-end' : 'justify-start'} group mb-0.5 relative transition-colors duration-200 ${selectionMode ? 'px-4 -mx-4 cursor-pointer hover:bg-white/5 rounded-xl' : ''
          } ${isSelected ? 'bg-nexo-500/10 hover:bg-nexo-500/20' : ''}`}
        onClick={() => {
          if (selectionMode) onToggleSelect?.(message.id);
        }}
        onContextMenu={handleContextMenu}
      >
        {/* Selection Checkbox */}
        {selectionMode && (
          <div className="absolute left-1 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border border-white/30 flex items-center justify-center transition-colors">
            {isSelected && <div className="w-5 h-5 rounded-full bg-nexo-500 flex items-center justify-center">
              <Check size={12} className="text-white" />
            </div>}
          </div>
        )}

        {/* Avatar spacing for others */}
        {!isMine && (
          <div className={`${showAvatar ? 'w-8 mr-2' : 'w-0 mr-0'} flex-shrink-0 self-end transition-all`}>
            {showAvatar ? (
              <button onClick={() => {
                if (isChannel) {
                  window.dispatchEvent(new CustomEvent('open-channel-profile', { detail: { channelId: message.chatId } }));
                } else {
                  onViewProfile?.(message.senderId);
                }
              }} className="relative inline-block">
                <Avatar 
                  src={senderAvatar} 
                  name={senderName} 
                  size="sm"
                  isVerified={message.sender?.isVerified}
                  verifiedBadgeUrl={message.sender?.verifiedBadgeUrl}
                  verifiedBadgeType={message.sender?.verifiedBadgeType}
                />
              </button>
            ) : null}
          </div>
        )}

        {/* Avatar spacing for own messages */}
        {isMine && <div className="w-0 flex-shrink-0 ml-0 self-end" />}

        <div className={`${hasVoice ? 'max-w-[85%]' : 'max-w-[65%]'} ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
          {/* Name */}
          {!isMine && showAvatar && (
            <div className="flex items-center gap-1.5 ml-3 mb-0.5">
              <button
                className="text-xs font-medium text-nexo-400 hover:underline flex items-center gap-1"
                onClick={() => onViewProfile?.(message.senderId)}
              >
                {senderName}
                {!isChannel && message.sender?.isVerified && (
                  <span className="inline-flex items-center justify-center flex-shrink-0">
                    <VerifiedBadge
                      size="xs"
                      verifiedBadgeUrl={message.sender.verifiedBadgeUrl}
                      verifiedBadgeType={message.sender.verifiedBadgeType}
                    />
                  </span>
                )}
              </button>
              {!isChannel && message.sender?.tagText && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded-md font-bold tracking-wide uppercase select-none flex-shrink-0"
                  style={getTagStyle(message.sender.tagColor, message.sender.tagStyle)}
                >
                  {message.sender.tagText}
                </span>
              )}
            </div>
          )}

          {/* Reply */}
          {message.replyTo && (() => {
            const repliedMsg = chatMessages.find(m => m.id === message.replyToId);
            const replyType = repliedMsg?.type;
            const replyMedia = repliedMsg?.media || [];
            
            let attachmentLabel = '';
            if (replyType === 'location' && repliedMsg?.content) {
              try {
                const loc = JSON.parse(repliedMsg.content);
                attachmentLabel = loc.name || `${loc.lat?.toFixed(4)}, ${loc.lng?.toFixed(4)}`;
              } catch { attachmentLabel = 'Геолокация'; }
            } else if (replyType === 'poll') {
              attachmentLabel = 'Опрос';
            } else if (replyType === 'call') {
              attachmentLabel = repliedMsg?.callType === 'video' ? 'Видеозвонок' : 'Аудиозвонок';
            } else if (replyType === 'voice' || replyMedia.some((m: any) => m.type === 'voice')) {
              attachmentLabel = 'Голосовое';
            } else if (replyType === 'audio' || replyMedia.some((m: any) => m.type === 'audio')) {
              attachmentLabel = 'Аудио';
            } else if (replyMedia.some((m: any) => m.type === 'video')) {
              attachmentLabel = 'Видео';
            } else if (replyMedia.some((m: any) => m.type === 'image')) {
              attachmentLabel = 'Фото';
            } else if (replyMedia.some((m: any) => m.type === 'sticker')) {
              attachmentLabel = 'Стикер';
            } else if (replyType === 'video_note') {
              attachmentLabel = 'Видеосообщение';
            }
            
            return (
              <button
                className={`w-full mx-3 mb-1 px-3 py-1.5 rounded-lg border-l-2 border-nexo-500 bg-nexo-500/10 max-w-full text-left hover:bg-nexo-500/20 transition-colors group`}
                onClick={(e) => {
                  e.stopPropagation();
                  const el = document.getElementById(`msg-${message.replyTo!.id}`);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    el.classList.add('bg-nexo-500/30', 'ring-2', 'ring-nexo-500');
                    setTimeout(() => el.classList.remove('bg-nexo-500/30', 'ring-2', 'ring-nexo-500'), 2000);
                  }
                }}
              >
                <p className="text-xs font-medium text-nexo-400 truncate">
                  {message.replyTo.sender?.displayName || message.replyTo.sender?.username}
                </p>
                <div className="flex items-center gap-1.5">
                  {attachmentLabel && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-nexo-500/20 text-nexo-300 flex-shrink-0 font-medium">
                      {attachmentLabel}
                    </span>
                  )}
                  <p className="text-xs text-zinc-400 truncate">{message.quote || message.replyTo.content || t('media')}</p>
                </div>
              </button>
            );
          })()}

          {/* Bubble */}
          <div
            onContextMenu={handleContextMenu}
            onDoubleClick={handleReply}
            title={t('reply') ? `${t('reply')} (Double Click)` : 'Double click to reply'}
            className={`cursor-pointer rounded-[1.15rem] overflow-hidden transition-all duration-300 ${
              hasImage && !message.content
                ? 'p-0 shadow-none border-none bg-transparent'
                : message.type === 'sticker' && !message.content
                  ? 'p-0 shadow-none border-none bg-transparent'
                  : isMine
                    ? 'bubble-sent text-white shadow-sm px-[13px] py-[7px] hover:shadow-md'
                    : 'bubble-received text-[#f5f5f5] shadow-sm px-[13px] py-[7px] hover:shadow-md'
            } ${(message as any)._isSending ? 'opacity-70' : ''} ${(message as any)._isFailed ? 'ring-1 ring-red-500/40' : ''}`}
          >
            {/* Forwarded message header */}
            {message.forwardedFrom && (
              <div className="mb-2 text-xs opacity-90 border-l-[3px] border-white/30 pl-2">
                <span className="font-medium">{t('forwardedFrom')}: </span>
                {message.forwardedFrom.displayName || message.forwardedFrom.username}
              </div>
            )}

            {/* Call Message */}
            <CallMessage message={message} isMine={isMine} />

            {/* Media (Video Note, Sticker, GIF, Images, Video, Files) */}
            <MediaRenderer
              message={message}
              media={media}
              isMine={isMine}
              hasImage={hasImage}
              hasVideo={hasVideo}
              hasFile={hasFile}
              onOpenLightbox={(url) => setLightboxUrl(url)}
            />

            {/* Poll */}
            <PollRenderer message={message} isMine={isMine} />

            {/* Location */}
            {message.type === 'location' && message.content && (() => {
              try {
                const loc = JSON.parse(message.content);
                if (loc.lat && loc.lng) {
                  return (
                    <div className="min-w-[260px]">
                      <div className="flex items-center gap-2 mb-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={isMine ? 'text-white/60' : 'text-nexo-400'}>
                          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span className="text-xs font-medium opacity-60">Геолокация</span>
                      </div>
                      {loc.name && <p className="text-xs mb-2 opacity-80">{loc.name}</p>}
                      <a
                        href={`https://www.openstreetmap.org/?mlat=${loc.lat}&mlon=${loc.lng}#map=16/${loc.lat}/${loc.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block p-3 rounded-lg ${isMine ? 'bg-white/10 hover:bg-white/15' : 'bg-nexo-500/10 hover:bg-nexo-500/20'} transition-colors`}
                      >
                        <p className="text-xs font-mono">
                          {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
                        </p>
                        {loc.accuracy && (
                          <p className="text-xs opacity-60 mt-1">
                            Точность: ±{loc.accuracy < 1000 ? `${Math.round(loc.accuracy)} м` : `${(loc.accuracy / 1000).toFixed(1)} км`}
                          </p>
                        )}
                      </a>
                    </div>
                  );
                }
              } catch { /* ignore */ }
              return null;
            })()}

            {/* Audio / Voice */}
            {hasVoice && (() => {
              const voiceMedia = media.find((m) => m.type === 'voice');
              if (!voiceMedia?.url) return null;
              return (
                <AudioPlayer
                  voiceMedia={voiceMedia}
                  messageId={message.id}
                  chatId={message.chatId}
                  isMine={isMine}
                  userId={user?.id}
                  message={message}
                  onOpenProfileModal={(url) => {
                    setAudioToAddUrl(url);
                    setShowAddToProfileModal(true);
                  }}
                />
              );
            })()}

            {hasAudio && (() => {
              const audioMedia = media.find((m) => m.type === 'audio');
              if (!audioMedia?.url) return null;
              return (
                <AudioPlayer
                  audioMedia={audioMedia}
                  messageId={message.id}
                  chatId={message.chatId}
                  isMine={isMine}
                  userId={user?.id}
                  message={message}
                />
              );
            })()}

            {/* Text content */}
            {message.content && message.type !== 'poll' && message.type !== 'location' && message.type !== 'voice' && message.type !== 'call' && message.type !== 'sticker' && (
              <MessageContent
                message={message}
                isMine={isMine}
                timeStr={timeStr}
                isRead={isRead}
                isChannel={isChannel}
                tags={messageTags}
                onOpenContextMenu={handleContextMenu}
                onReply={handleReply}
              />
            )}

            {/* Time for media without text */}
            {!message.content && (hasImage || hasVideo) && (
              <div className={`flex justify-end px-3 py-1 ${hasImage ? '-mt-8 relative z-10' : ''}`}>
                <span className="text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur-sm select-none">
                  {timeStr}
                  {(message as any)._isFailed ? (
                    <AlertCircle size={12} className="text-red-400" />
                  ) : (message as any)._isSending ? (
                    <Loader2 size={12} className="text-white/50 animate-spin" />
                  ) : isChannel ? (
                    <span className="flex items-center gap-1">
                      <Eye size={11} className="text-zinc-400" />
                      {message.viewCount || 0}
                    </span>
                  ) : isMine ? (
                    isRead ? <CheckCheck size={13} className="text-sky-300" /> : <Check size={13} />
                  ) : null}
                </span>
              </div>
            )}
          </div>

          {/* Reactions */}
          <ReactionBar
            reactions={message.reactions}
            userId={user?.id}
            messageId={message.id}
            chatId={message.chatId}
            isMine={isMine}
          />
        </div>

        {/* Own avatar hidden */}
        {isMine && <div className="w-0 flex-shrink-0 ml-0 self-end" />}
      </div>

      {/* Context Menu */}
      <ContextMenu
        show={showContext}
        position={contextPos}
        onClose={() => { setShowContext(false); }}
        message={message}
        userId={user?.id}
        isMine={isMine}
        isPinned={isPinned}
        quotedText={quotedText}
        setQuotedText={setQuotedText}
        hasVoice={hasVoice}
        hasAudio={hasAudio}
        chat={chat}
        onStartSelectionMode={onStartSelectionMode}
        onOpenAIModal={() => setShowAIModal(true)}
        onOpenTagModal={() => setShowTagModal(true)}
        onOpenAddToProfile={(url) => {
          setAudioToAddUrl(url);
          setShowAddToProfileModal(true);
        }}
        onOpenForwardModal={() => setShowForwardModal(true)}
      />

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxUrl && (
          <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
        )}
      </AnimatePresence>

      {/* Forward Modal */}
      {showForwardModal && (
        <ForwardModal
          messages={[message]}
          onClose={() => setShowForwardModal(false)}
        />
      )}

      {/* Message Tag Modal */}
      {showTagModal && (
        <MessageTagModal
          isOpen={showTagModal}
          messageId={message.id}
          onClose={() => setShowTagModal(false)}
          existingTags={messageTags}
          onSave={(tags) => {
            setMessageTags(tags);
            try { localStorage.setItem(`nexo_msg_tags_${message.id}`, JSON.stringify(tags)); } catch {}
          }}
        />
      )}

      {/* AI Assistant Modal */}
      <AnimatePresence>
        {showAIModal && (
          <AIAssistantModal
            onClose={() => setShowAIModal(false)}
            messageContext={message.content || undefined}
            messageId={message.id}
            chatId={message.chatId}
          />
        )}
      </AnimatePresence>

      {/* Add to Profile Modal */}
      <AnimatePresence>
        {showAddToProfileModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={() => { setShowAddToProfileModal(false); setAudioToAddUrl(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-secondary/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl p-6 max-w-sm w-full mx-4"
              onClick={e => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-white mb-2">Добавить в профиль?</h2>
              <p className="text-sm text-zinc-400 mb-6">
                Это аудио будет добавлено в вашу музыку профиля. Другие пользователи смогут его слушать.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddToProfileModal(false); setAudioToAddUrl(null); }}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors border border-white/10"
                >
                  Отмена
                </button>
                <button
                  onClick={handleAddAudioToProfile}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-nexo-500 hover:bg-nexo-600 text-white text-sm font-medium transition-colors"
                >
                  Добавить
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default memo(MessageBubble);
