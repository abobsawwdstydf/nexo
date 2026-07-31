import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  Smile,
  ChevronDown,
  Mic,
  Image,
  Search,
  BellOff,
  Flag,
  Users,
  Trash2,
  X,
  Reply,
  Forward,
  Pin,
  Check,
  CheckCheck,
  Camera,
  Video,
  MapPin,
  FileText,
  Wallet,
  Circle,
  Play,
  Pause,
  Trash,
  ExternalLink,
} from 'lucide-react';
import {
  Menu,
  CallCalling,
  VideoCircle,
  ArrowLeft2,
  Gallery,
} from 'iconsax-react';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useInitStore } from '../stores/initStore';
import { toast } from '../lib/toast';
import { NOTES_CHAT_ID, getNotesMessages, saveNotesMessage, deleteNotesMessage } from '../lib/api/noteChat';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import type { Chat, Message, Reaction } from '../lib/types';
import { useCallContext } from '../lib/callContext';
import { ChatWallpaper } from './ChatWallpaper';
import { LinkPreview, extractUrls, renderTextWithLinks } from './LinkPreview';
import { e2eManager } from '../lib/e2eSession';
import { tryInitE2EForChat } from '../lib/e2eStore';
import { EncryptionBadge } from './EncryptionBadge';

const EMOJI_CATEGORIES: { name: string; emojis: string[] }[] = [
  { name: 'Лица', emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🫢', '🫣', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '😮', '😯', '😲', '😳', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🫨', '🤗', '🫡', '🤔', '🫣', '🤫', '😶', '😏'] },
  { name: 'Жесты', emojis: ['👍', '👎', '👌', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '👇', '🫵', '☝️', '👋', '🤚', '🖐️', '✋', '🖖', '🫶', '🤲', '👏', '🙌', '🫸', '🫷', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '👀', '👁️', '👅', '👄'] },
  { name: 'Сердца', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💕', '💞', '💗', '💖', '💘', '💝', '❣️', '💟', '🫶', '💌'] },
  { name: 'Реакции', emojis: ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💯', '🙏', '👀', '😍', '🥰', '😎', '🤝', '💪', '🤣', '😭', '😤', '🥳', '🫡'] },
  { name: 'Животные', emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🐦', '🐤', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🪲', '🪳', '🦟', '🦗', '🪰', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🪼', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈'] },
  { name: 'Еда', emojis: ['🍕', '🍔', '🍟', '🌭', '🍿', '🧁', '🍰', '🎂', '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍯', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥝', '🍇', '🍆', '🥑', '🥦', '🥬', '🥒', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🌮', '🌯', '🫔', '🥙', '🧆', '🥚', '🍝', '🥫', '🍦', '🍧', '🍨', '🍩', '🍪', '🎂', '🧁', '🥧', '🍫', '🍬', '🍭', '🍮', '🍯', '☕', '🍵', '🧃', '🥤', '🧋', '🍶', '🍺', '🍻', '🥂', '🍷', '🫗', '🍸', '🍹', '🍾'] },
  { name: 'Природа', emojis: ['🌞', '🌝', '🌛', '🌜', '🌚', '🌕', '🌖', '🌗', '🌘', '🌑', '🌒', '🌓', '🌔', '🌈', '☀️', '⛅', '🌤️', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '💧', '💦', '🫧', '☔', '🌊', '🌸', '💐', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🌿', '☘️', '🍀', '🎍', '🎋', '🍃', '🍂', '🍁', '🪺', '🪹', '🍄', '🌾', '💐', '🌲', '🌳', '🌴', '🌵'] },
  { name: 'Предметы', emojis: ['💻', '📱', '⌚', '💻', '🖥️', '🖨️', '⌨️', '🖱️', '🖲️', '💾', '💿', '📀', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏰', '⌛', '⏳', '📡', '🔋', '🪫', '💡', '🔦', '🕯️', '🪔', '🧯', '🗑️', '🛢️', '💵', '💴', '💶', '💷', '💰', '💳', '💎'] },
  { name: 'Символы', emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚧️', '🚻', '🚹', '🚺', '♿', '🚭', '📵', '🔞', '☢️', '☣️', '⚠️', '🚸', '⛔', '🚫'] },
];

interface StickerPackManifest {
  name: string;
  stickers: { filename: string; fileUrl: string; emoji: string }[];
}

interface StickerPack {
  name: string;
  icon: string;
  stickers: { filename: string; fileUrl: string }[];
}

const ATTACHMENT_OPTIONS = [
  { icon: Image, label: 'Галерея', color: 'text-blue-400' },
  { icon: Camera, label: 'Камера', color: 'text-green-400' },
  { icon: FileText, label: 'Файл', color: 'text-purple-400' },
  { icon: MapPin, label: 'Геопозиция', color: 'text-red-400' },
  { icon: Wallet, label: 'Кошелёк', color: 'text-yellow-400' },
  { icon: Circle, label: 'Кружок', color: 'text-cyan-400' },
];

interface MessageAreaProps {
  chat: Chat;
  onBack: () => void;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';

  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function shouldShowDateSeparator(messages: Message[], index: number): boolean {
  if (index === 0) return true;
  const curr = new Date(messages[index].createdAt);
  const prev = new Date(messages[index - 1].createdAt);
  return (
    curr.getDate() !== prev.getDate() ||
    curr.getMonth() !== prev.getMonth() ||
    curr.getFullYear() !== prev.getFullYear()
  );
}

function VoiceMessagePlayer({ url, isOwn, decryptedUrl }: { url: string; isOwn: boolean; decryptedUrl?: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stop playback and release the audio element when the player unmounts.
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute('src');
        audioRef.current.load();
        audioRef.current = null;
      }
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio(decryptedUrl || normalizeMediaUrl(url));
      audioRef.current.addEventListener('loadedmetadata', () => {
        setDuration(audioRef.current?.duration || 0);
      });
      audioRef.current.addEventListener('timeupdate', () => {
        if (audioRef.current) {
          setProgress((audioRef.current.currentTime / audioRef.current.duration) * 100);
        }
      });
      audioRef.current.addEventListener('ended', () => {
        setPlaying(false);
        setProgress(0);
      });
    }
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const formatDur = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[200px]">
      <button
        onClick={togglePlay}
        className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
          isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-white/10 hover:bg-white/15'
        }`}
      >
        {playing ? <Pause size={14} className="text-white" /> : <Play size={14} className="text-white ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-100 ${isOwn ? 'bg-white/60' : 'bg-blue-400/60'}`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-0.5">
          <span className="text-[9px] text-white/40">{formatDur(duration * (progress / 100))}</span>
          <span className="text-[9px] text-white/40">{formatDur(duration)}</span>
        </div>
      </div>
    </div>
  );
}

function VideoNotePlayer({ url, thumbnail, decryptedUrl }: { url: string; thumbnail?: string | null; decryptedUrl?: string }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  return (
    <div className="relative w-[140px] h-[140px] rounded-full overflow-hidden bg-black/40">
      {decryptedUrl ? (
        <video
          ref={videoRef}
          src={decryptedUrl}
          className="w-full h-full object-cover"
          loop
          playsInline
          onEnded={() => setPlaying(false)}
        />
      ) : thumbnail ? (
        <img src={normalizeMediaUrl(thumbnail)} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-white/5">
          <Video size={24} className="text-white/30" />
        </div>
      )}
      <button
        onClick={togglePlay}
        className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition-colors"
      >
        {playing ? (
          <Pause size={20} className="text-white" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <Play size={16} className="text-white ml-0.5" />
          </div>
        )}
      </button>
    </div>
  );
}

function ImageGallery({ media, isOwn }: { media: Array<{ url: string; thumbnail?: string | null }>; isOwn: boolean }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <>
      <div className={`flex gap-1 ${media.length === 1 ? '' : 'grid grid-cols-2 gap-1'}`}>
        {media.slice(0, 4).map((item, i) => (
          <button
            key={item.url}
            onClick={() => setSelectedImage(item.url)}
            className="relative overflow-hidden rounded-xl group/img"
          >
            <img
              src={normalizeMediaUrl(item.thumbnail || item.url)}
              alt=""
              className="w-full h-auto max-h-[200px] object-cover"
            />
            {i === 3 && media.length > 4 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <span className="text-white text-lg font-semibold">+{media.length - 4}</span>
              </div>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="max-w-full max-h-full"
            >
              <img
                src={normalizeMediaUrl(selectedImage)}
                alt=""
                className="max-w-full max-h-[90vh] object-contain rounded-lg"
              />
            </motion.div>
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <X size={20} className="text-white" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

const MessageBubble = memo(function MessageBubble({
  message,
  isOwn,
  isChannel,
  onReply,
  onReact,
  decryptedMediaUrl,
}: {
  message: Message;
  isOwn: boolean;
  isChannel?: boolean;
  onReply?: (message: Message) => void;
  onReact?: (messageId: string) => void;
  decryptedMediaUrl?: string;
}) {
  const time = formatTime(message.createdAt);
  const showSender = !isOwn && message.sender && (isChannel || message.sender.displayName);
  const hasMedia = message.media && message.media.length > 0;
  const hasVoice = message.type === 'audio' || message.content?.includes('🎤 Голосовое сообщение');
  const hasVideoNote = message.type === 'video_note' || message.videoUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      className={`group relative flex ${isOwn && !isChannel ? 'justify-end' : 'justify-start'} mb-1`}
    >
      <div className={`max-w-[75%] ${hasVideoNote ? 'max-w-[160px]' : ''}`}>
        {/* Reply quote */}
        {message.replyTo && (
          <div
            className={`
              px-3 py-1.5 mb-1 rounded-lg border-l-2 text-xs
              ${isOwn && !isChannel ? 'bg-white/[0.06] border-white/20' : 'bg-black/[0.2] border-white/30'}
            `}
          >
            <p className="font-medium text-white/60 text-[10px]">
              {message.replyTo.sender?.displayName || ''}
            </p>
            <p className="text-white/40 truncate">{message.replyTo.content}</p>
          </div>
        )}

        {/* Forwarded indicator */}
        {message.forwardedFrom && (
          <p className="text-[10px] text-white/30 mb-0.5 flex items-center gap-1">
            <Forward size={10} />
            Переслано от @{message.forwardedFrom.username}
          </p>
        )}

        {/* Video Note (Circle) */}
        {hasVideoNote && (
          <div className="mb-1">
            <VideoNotePlayer
              url={message.videoUrl || message.media?.[0]?.url || ''}
              thumbnail={message.thumbnail || message.media?.[0]?.thumbnail}
              decryptedUrl={decryptedMediaUrl}
            />
          </div>
        )}

        {/* Bubble */}
        <div
          className={`
            ${hasVideoNote ? 'px-2 py-2' : 'px-3.5 py-2'}
            ${isOwn && !isChannel
              ? 'rounded-[18px] rounded-br-[6px] bubble-sent'
              : 'rounded-[18px] rounded-bl-[6px] bubble-received'
            }
          `}
        >
          {showSender && (
            <p className="text-[11px] font-semibold text-blue-400/70 mb-0.5">
              {message.sender.displayName || message.sender.username}
            </p>
          )}

          {/* Image Gallery */}
          {hasMedia && !hasVoice && !hasVideoNote && (
            <div className="mb-1 -mx-1 -mt-0.5">
              <ImageGallery media={message.media} isOwn={isOwn} />
            </div>
          )}

          {/* Voice Message */}
          {hasVoice && hasMedia && (
            <div className="mb-1">
              <VoiceMessagePlayer url={message.media[0].url} isOwn={isOwn} decryptedUrl={decryptedMediaUrl} />
            </div>
          )}

          {/* Text Content with Links */}
          {message.content && !message.content.includes('🎤 Голосовое сообщение') && (
            <div>
              <p className={`text-sm leading-relaxed word-break ${isOwn && !isChannel ? 'text-white/90' : 'text-white/85'}`}>
                {renderTextWithLinks(message.content, isOwn && !isChannel)}
              </p>
              {/* Link Previews */}
              {extractUrls(message.content).slice(0, 2).map((url) => (
                <LinkPreview key={url} url={url} isOwn={isOwn && !isChannel} />
              ))}
            </div>
          )}

          {/* Time & Read Status */}
          <div className={`flex items-center gap-2 mt-1 ${isOwn && !isChannel ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-white/30">{time}</span>
            {isOwn && !isChannel && (
              message.readBy && message.readBy.length > 1 ? (
                <span className="text-[10px] text-blue-400/60 flex items-center gap-0.5">
                  <CheckCheck size={12} />
                </span>
              ) : message._isFailed ? (
                <span className="text-[10px] text-red-400/60">Ошибка</span>
              ) : message._isSending ? (
                <span className="text-[10px] text-white/20">...</span>
              ) : (
                <span className="text-[10px] text-blue-400/50"><CheckCheck size={12} /></span>
              )
            )}
          </div>
        </div>

        {/* Reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className={`flex flex-wrap gap-1 mt-0.5 ${isOwn && !isChannel ? 'justify-end' : 'justify-start'}`}>
            {message.reactions.map((r) => (
              <button
                key={r.id}
                onClick={() => onReact?.(message.id)}
                className="px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.06] text-xs hover:bg-white/[0.1] transition-colors"
              >
                {r.emoji}
              </button>
            ))}
          </div>
        )}

        {/* Hover actions */}
        <div className={`absolute top-0 ${isOwn && !isChannel ? 'left-0 -translate-x-full pl-1' : 'right-0 translate-x-full pr-1'} opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5`}>
          <button
            onClick={() => onReply?.(message)}
            className="p-1 rounded-lg bg-black/40 border border-white/[0.06] hover:bg-white/[0.1] transition-colors"
            title="Ответить"
          >
            <Reply size={12} className="text-white/50" />
          </button>
          <button
            onClick={() => onReact?.(message.id)}
            className="p-1 rounded-lg bg-black/40 border border-white/[0.06] hover:bg-white/[0.1] transition-colors"
            title="Реакция"
          >
            <Smile size={12} className="text-white/50" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});

function DateSeparator({ dateStr }: { dateStr: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <div className="px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.04]">
        <span className="text-[11px] text-white/30 font-medium">
          {formatDate(dateStr)}
        </span>
      </div>
    </div>
  );
}

function ChatHeader({
  chat,
  onBack,
  onSearchToggle,
  pinnedMessages,
  e2eReady,
  e2eFingerprint,
}: {
  chat: Chat;
  onBack: () => void;
  onSearchToggle?: () => void;
  pinnedMessages?: Array<{ id: string; message: Message }>;
  e2eReady?: boolean;
  e2eFingerprint?: string | null;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { startCall } = useCallContext();
  const initials = (chat.name || '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleCall = (type: 'voice' | 'video') => {
    if (chat.otherMember) {
      startCall(chat.otherMember, type, chat.id);
    } else if (chat.members?.[0]?.user) {
      startCall(chat.members[0].user, type, chat.id);
    } else {
      toast.info('Звонки', 'Выберите контакт для звонка');
    }
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClick);
    }
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMenu]);

  return (
    <>
      <div className="flex-shrink-0 flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 min-w-0">
          <motion.button
            onClick={onBack}
            className="md:hidden p-2 -ml-1 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] transition-colors flex-shrink-0 z-10"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <ArrowLeft2 size={20} className="text-white/70" />
          </motion.button>

          {chat.avatar ? (
            <img
              src={chat.avatar}
              alt={chat.name || ''}
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
            />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-medium text-white/50">{initials}</span>
            </div>
          )}

          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-white/90 truncate">
              {chat.name || 'Без названия'}
            </h2>
            <div className="flex items-center gap-2">
              <p className="text-[11px] text-white/30">
                {chat.type === 'personal'
                  ? 'Личный чат'
                  : chat.type === 'group'
                  ? `${chat.members?.length || 0} участников`
                  : chat.type === 'channel'
                  ? 'Канал'
                  : chat.type === 'secret'
                  ? 'Секретный чат'
                  : ''}
              </p>
              <EncryptionBadge
                chatId={chat.id}
                isE2E={chat.isE2E}
                isSecret={chat.isSecret}
                isChannel={chat.type === 'channel'}
                e2eReady={e2eReady}
                e2eFingerprint={e2eFingerprint}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Pinned indicator */}
          {pinnedMessages && pinnedMessages.length > 0 && (
            <motion.button
              onClick={() => setShowPinned(v => !v)}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors relative"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Закреплённые сообщения"
            >
              <Pin size={14} className="text-white/30" />
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-white/15 flex items-center justify-center">
                <span className="text-[8px] text-white/60">{pinnedMessages.length}</span>
              </span>
            </motion.button>
          )}

          <motion.button
            onClick={() => handleCall('voice')}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors relative group/callbtn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Голосовой звонок"
          >
            <CallCalling size={16} className="text-white/40 group-hover/callbtn:text-green-400 transition-colors" />
          </motion.button>
          <motion.button
            onClick={() => handleCall('video')}
            className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors relative group/callbtn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            title="Видеозвонок"
          >
            <VideoCircle size={16} className="text-white/40 group-hover/callbtn:text-blue-400 transition-colors" />
          </motion.button>

          <div className="relative" ref={menuRef}>
            <motion.button
              onClick={() => setShowMenu(v => !v)}
              className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Menu size={16} className="text-white/40" />
            </motion.button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-1 w-48 py-1.5 rounded-xl liquid-glass-strong z-50"
                >
                  <ChatMenuItem icon={Search} label="Поиск" onClick={onSearchToggle} />
                  <ChatMenuItem icon={BellOff} label="Отключить звук" />
                  <ChatMenuItem icon={Image} label="Медиафайлы" />
                  {chat.type === 'group' && <ChatMenuItem icon={Users} label="Участники" />}
                  <div className="mx-3 my-1 h-px bg-white/[0.06]" />
                  <ChatMenuItem icon={Flag} label="Пожаловаться" className="text-red-400/70" />
                  <ChatMenuItem icon={Trash2} label="Удалить чат" className="text-red-400/70" />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Pinned messages bar */}
      <AnimatePresence>
        {showPinned && pinnedMessages && pinnedMessages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]"
          >
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                <Pin size={10} />
                <span>Закреплённые сообщения</span>
              </div>
              {pinnedMessages.map(pm => (
                <div key={pm.id} className="flex items-start gap-2 px-2 py-1 rounded-lg bg-white/[0.03]">
                  <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Pin size={8} className="text-white/30" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-white/50 font-medium truncate">
                      {pm.message.sender.displayName}
                    </p>
                    <p className="text-xs text-white/40 truncate">{pm.message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function ChatMenuItem({
  icon: Icon,
  label,
  onClick,
  className = '',
}: {
  icon: typeof Search;
  label: string;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors ${className}`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function MessageInput({
  onSend,
  replyTo,
  onCancelReply,
  chatId,
  e2eReady,
}: {
  onSend: (text: string, options?: { replyToId?: string; media?: any[]; isEncrypted?: boolean; encryptedContent?: string }) => void;
  replyTo?: { id: string; content: string; sender: string } | null;
  onCancelReply?: () => void;
  chatId: string;
  e2eReady?: boolean;
}) {
  const [text, setText] = useState('');
  const [showAttach, setShowAttach] = useState(false);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [emojiTab, setEmojiTab] = useState<'emoji' | 'stickers' | 'gif'>('emoji');
  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<'voice' | 'video'>('voice');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingError, setRecordingError] = useState('');
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [showPremium, setShowPremium] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileAllInputRef = useRef<HTMLInputElement>(null);
  const draftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Draft: restore saved text
  useEffect(() => {
    try {
      const draft = localStorage.getItem(`nexo_draft_${chatId}`);
      if (draft) setText(draft);
    } catch {}
  }, [chatId]);

  // Load sticker packs from manifest
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    fetch('/stickers/manifest.json', { signal: controller.signal })
      .then(r => r.json())
      .then((data: StickerPackManifest[]) => {
        setStickerPacks(data.map(pack => ({
          name: pack.name,
          icon: pack.stickers[0]?.emoji?.replace(/:/g, '')?.slice(0, 2) || '📦',
          stickers: pack.stickers.map(s => ({ filename: s.filename, fileUrl: s.fileUrl }))
        })));
      })
      .catch(() => {})
      .finally(() => clearTimeout(timeout));
  }, []);

  // Draft: save on change (debounced to avoid a localStorage write per keystroke)
  useEffect(() => {
    if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    draftTimerRef.current = setTimeout(() => {
      try {
        if (text.trim()) {
          localStorage.setItem(`nexo_draft_${chatId}`, text);
        } else {
          localStorage.removeItem(`nexo_draft_${chatId}`);
        }
      } catch {}
    }, 300);
    return () => {
      if (draftTimerRef.current) clearTimeout(draftTimerRef.current);
    };
  }, [text, chatId]);

  // Clean up any in-progress recording (camera/mic stream, timer) on unmount.
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        chunksRef.current = [];
        mediaRecorderRef.current.stop();
      }
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 100);
    return () => clearTimeout(t);
  }, [replyTo]);

  const handleSubmit = (media?: any[]) => {
    const trimmed = text.trim();
    if (!trimmed && (!media || media.length === 0)) return;
    onSend(trimmed, { replyToId: replyTo?.id, media });
    setText('');
    onCancelReply?.();
    setPreviewImages([]);
    setSelectedFiles([]);
    localStorage.removeItem(`nexo_draft_${chatId}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPreviews: string[] = [];
    const newFiles: File[] = [];

    for (const file of files.slice(0, 10)) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          newPreviews.push(ev.target?.result as string);
          setPreviewImages([...newPreviews]);
        };
        reader.readAsDataURL(file);
      }
      newFiles.push(file);
    }

    setSelectedFiles(prev => [...prev, ...newFiles]);
    setShowAttach(false);
  };

  const removePreview = (index: number) => {
    setPreviewImages(prev => prev.filter((_, i) => i !== index));
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileAllSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const file of files.slice(0, 5)) {
      try {
        const media = await api.uploadFile(file);
        onSend(file.name, { media: [media] });
      } catch (err) {
        console.error('[File] Failed to upload:', err);
        toast.error('Ошибка загрузки файла');
      }
    }
    e.target.value = '';
  };

  const shareLocation = async () => {
    if (!navigator.geolocation) {
      toast.error('Геолокация не поддерживается');
      return;
    }
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 10000 })
      );
      const { latitude, longitude } = pos.coords;
      const link = `https://maps.google.com/maps?q=${latitude},${longitude}`;
      onSend(`📍 Местоположение: ${link}`);
    } catch (err) {
      toast.error('Не удалось определить местоположение');
    }
  };

  // GIF state and handlers
  const [gifs, setGifs] = useState<any[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [gifQuery, setGifQuery] = useState('');
  const [emojiCategory, setEmojiCategory] = useState(0);
  const gifSearchRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Clear pending GIF search debounce on unmount
  useEffect(() => () => {
    if (gifSearchRef.current) clearTimeout(gifSearchRef.current);
  }, []);

  useEffect(() => {
    if (showEmojiPanel && emojiTab === 'gif' && gifs.length === 0 && !gifQuery) {
      loadTrendingGifs();
    }
  }, [showEmojiPanel, emojiTab]);

  const loadTrendingGifs = async () => {
    setGifLoading(true);
    try {
      const data = await api.getTrendingGifs(30);
      setGifs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[GIF] Failed to load trending:', err);
    } finally {
      setGifLoading(false);
    }
  };

  const searchGifs = async (query: string) => {
    if (!query.trim()) { loadTrendingGifs(); return; }
    setGifLoading(true);
    try {
      const data = await api.searchGifs(query, 30);
      setGifs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[GIF] Search failed:', err);
    } finally {
      setGifLoading(false);
    }
  };

  const handleGifSelect = async (gif: any) => {
    try {
      const gifUrl = gif.url || gif.originalUrl;
      if (!gifUrl) return;
      const response = await fetch(gifUrl);
      const blob = await response.blob();
      const file = new File([blob], `gif_${Date.now()}.gif`, { type: 'image/gif' });
      const media = await api.uploadFile(file);
      onSend('', { media: [media] });
      setShowEmojiPanel(false);
    } catch (err) {
      console.error('[GIF] Failed to send:', err);
      toast.error('Ошибка отправки GIF');
    }
  };

  const handleGifSearchInput = useCallback((value: string) => {
    setGifQuery(value);
    if (gifSearchRef.current) clearTimeout(gifSearchRef.current);
    gifSearchRef.current = setTimeout(() => searchGifs(value), 500);
  }, []);

  const sendImages = async () => {
    if (selectedFiles.length === 0) return;

    try {
      const uploadedMedia = [];
      for (const file of selectedFiles) {
        const media = await api.uploadFile(file);
        uploadedMedia.push(media);
      }
      handleSubmit(uploadedMedia);
    } catch (err) {
      console.error('[Image] Failed to upload:', err);
      toast.error('Ошибка загрузки изображений');
    }
  };

  const startRecording = async (type: 'voice' | 'video') => {
    try {
      setRecordingError('');
      setRecordingType(type);

      if (type === 'video') {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 360, height: 360, facingMode: 'user' },
          audio: true
        });
        streamRef.current = stream;

        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }

        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' });
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          if (chunksRef.current.length === 0) return;

          const blob = new Blob(chunksRef.current, { type: 'video/webm' });

          try {
            let uploadBlob = blob;
            let encMime = '';
            if (e2eReady) {
              const encBlob = await e2eManager.encryptChatMedia(chatId, blob);
              if (encBlob) {
                uploadBlob = encBlob;
                encMime = 'video/webm';
              }
            }
            const file = new File([uploadBlob], `video_note_${Date.now()}.webm`, { type: 'video/webm' });
            const media = await api.uploadFile(file);
            const opts: any = { replyToId: replyTo?.id, media: [media] };
            if (encMime) {
              opts.isEncrypted = true;
              opts.encryptedContent = encMime;
            }
            onSend('📹 Видеокружок', opts);
          } catch (err) {
            console.error('[VideoNote] Failed to upload:', err);
            setRecordingError('Ошибка отправки');
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(250);
        setIsRecording(true);
        setRecordingDuration(0);
        recordTimerRef.current = setInterval(() => {
          setRecordingDuration(d => {
            if (d >= 60) {
              stopRecording();
              return 60;
            }
            return d + 1;
          });
        }, 1000);
      } else {
        // Voice recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
        chunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          streamRef.current = null;
          if (chunksRef.current.length === 0) return;

          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });

          try {
            let uploadBlob = blob;
            let encMime = '';
            if (e2eReady) {
              const encBlob = await e2eManager.encryptChatMedia(chatId, blob);
              if (encBlob) {
                uploadBlob = encBlob;
                encMime = 'audio/webm';
              }
            }
            const file = new File([uploadBlob], `voice_${Date.now()}.webm`, { type: 'audio/webm' });
            const media = await api.uploadFile(file);
            const opts: any = { replyToId: replyTo?.id, media: [media] };
            if (encMime) {
              opts.isEncrypted = true;
              opts.encryptedContent = encMime;
            }
            onSend('🎤 Голосовое сообщение', opts);
          } catch (err) {
            console.error('[Voice] Failed to upload:', err);
            setRecordingError('Ошибка отправки');
          }
        };

        mediaRecorderRef.current = recorder;
        recorder.start(250);
        setIsRecording(true);
        setRecordingDuration(0);
        recordTimerRef.current = setInterval(() => {
          setRecordingDuration(d => d + 1);
        }, 1000);
      }
    } catch (err) {
      console.error('[Record] Access denied:', err);
      setRecordingError(type === 'video' ? 'Нет доступа к камере' : 'Нет доступа к микрофону');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingDuration(0);
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
  };

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const toggleRecType = () => {
    setRecordingType(prev => prev === 'voice' ? 'video' : 'voice');
  };

  const handleRecordHold = () => {
    startRecording(recordingType);
  };

  const handleRecordRelease = () => {
    stopRecording();
  };

  return (
    <div className="flex-shrink-0 border-t border-white/[0.06]">
      {/* Reply preview bar */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/[0.03] border-b border-white/[0.04]"
          >
            <Reply size={12} className="text-white/30 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-white/50 font-medium">{replyTo.sender}</p>
              <p className="text-[11px] text-white/30 truncate">{replyTo.content}</p>
            </div>
            <motion.button
              onClick={onCancelReply}
              className="p-1 rounded-lg hover:bg-white/[0.08] transition-colors flex-shrink-0"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <X size={12} className="text-white/40" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Image Preview */}
      <AnimatePresence>
        {previewImages.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-2 border-b border-white/[0.04]"
          >
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {previewImages.map((src, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <img src={src} alt="" className="h-20 w-20 object-cover rounded-lg" />
                  <button
                    onClick={() => removePreview(i)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-end mt-2">
              <button
                onClick={sendImages}
                className="px-4 py-1.5 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
              >
                Отправить ({selectedFiles.length})
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording UI */}
      <AnimatePresence>
        {isRecording && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-3 py-3"
          >
            {recordingType === 'video' && (
              <div className="flex justify-center mb-3">
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-24 h-24 rounded-full object-cover bg-black/40"
                />
              </div>
            )}
            <div className="flex items-center gap-3">
              <motion.button
                onClick={cancelRecording}
                className="p-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Trash size={16} className="text-red-400" />
              </motion.button>

              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-3 h-3 rounded-full bg-red-400 flex-shrink-0"
              />

              <div className="flex flex-col items-center">
                <span className="text-sm text-white/70 font-mono min-w-[40px]">
                  {formatDuration(recordingDuration)}
                </span>
                {recordingError && (
                  <span className="text-[10px] text-red-400 mt-0.5">{recordingError}</span>
                )}
              </div>

              <motion.button
                onClick={stopRecording}
                className="p-3 rounded-full bg-blue-500 hover:bg-blue-600 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send size={18} className="text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Input Area */}
      {!isRecording && (
        <div className="px-3 py-3">
          <div className="flex items-center gap-2">
            {/* Emoji/Attach Button */}
            <div className="relative">
              <motion.button
                onClick={() => setShowEmojiPanel(!showEmojiPanel)}
                className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Smile size={18} className={showEmojiPanel ? 'text-blue-400' : 'text-white/40'} />
              </motion.button>
            </div>

            {/* Text Input */}
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Сообщение..."
                className="w-full h-10 px-4 pr-10 text-sm bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/80 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20 focus:bg-white/[0.06]"
              />
            </div>

            {/* Attach Button */}
            <div className="relative">
              <motion.button
                onClick={() => setShowAttach(!showAttach)}
                className="p-2 rounded-xl hover:bg-white/[0.06] transition-colors flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Paperclip size={18} className={showAttach ? 'text-blue-400 rotate-45' : 'text-white/40'} />
              </motion.button>

              {/* Attachment Panel */}
              <AnimatePresence>
                {showAttach && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 10 }}
                    transition={{ duration: 0.15 }}
                    className="absolute bottom-full right-0 mb-2 p-2 rounded-xl liquid-glass-strong z-50 min-w-[200px]"
                  >
                    {ATTACHMENT_OPTIONS.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => {
                          if (opt.label === 'Галерея') {
                            fileInputRef.current?.click();
                          } else if (opt.label === 'Файл') {
                            fileAllInputRef.current?.click();
                          } else if (opt.label === 'Камера' || opt.label === 'Кружок') {
                            setRecordingType('video');
                            startRecording('video');
                          } else if (opt.label === 'Геопозиция') {
                            shareLocation();
                          } else if (opt.label === 'Кошелёк') {
                            setShowPremium(true);
                          }
                          setShowAttach(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/[0.06] transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-full bg-white/[0.06] flex items-center justify-center ${opt.color}`}>
                          <opt.icon size={16} />
                        </div>
                        <span className="text-xs text-white/70">{opt.label}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Send / Mic / Video Button */}
            {text.trim() || selectedFiles.length > 0 ? (
              <motion.button
                onClick={() => selectedFiles.length > 0 ? sendImages() : handleSubmit()}
                className="p-2.5 rounded-xl bg-blue-500/80 hover:bg-blue-500 transition-colors flex-shrink-0"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send size={16} className="text-white" />
              </motion.button>
            ) : (
              <motion.button
                onClick={toggleRecType}
                onMouseDown={handleRecordHold}
                onMouseUp={handleRecordRelease}
                onMouseLeave={() => { if (isRecording) stopRecording(); }}
                onTouchStart={handleRecordHold}
                onTouchEnd={handleRecordRelease}
                className="p-2.5 rounded-xl bg-white/[0.06] hover:bg-white/10 transition-colors flex-shrink-0 relative"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={recordingType === 'voice' ? 'Голосовое (нажмите для переключения)' : 'Видеокружок (нажмите для переключения)'}
              >
                {recordingType === 'voice' ? (
                  <Mic size={16} className="text-white/40" />
                ) : (
                  <Camera size={16} className="text-white/40" />
                )}
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-white/20" />
              </motion.button>
            )}
          </div>
        </div>
      )}

      {/* Emoji/Sticker Panel */}
      <AnimatePresence>
        {showEmojiPanel && !isRecording && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-white/[0.06] overflow-hidden"
          >
            {/* Tab Bar */}
            <div className="flex items-center gap-1 px-3 pt-2">
              {(['emoji', 'stickers', 'gif'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setEmojiTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    emojiTab === tab
                      ? 'bg-white/10 text-white/90'
                      : 'text-white/40 hover:text-white/60'
                  }`}
                >
                  {tab === 'emoji' ? 'Эмодзи' : tab === 'stickers' ? 'Стикеры' : 'GIF'}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="p-3 max-h-[250px] overflow-y-auto">
              {emojiTab === 'emoji' && (
                <div>
                  <div className="flex gap-0.5 mb-2 overflow-x-auto scrollbar-hide">
                    {EMOJI_CATEGORIES.map((cat, i) => (
                      <button
                        key={cat.name}
                        onClick={() => setEmojiCategory(i)}
                        className={`flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
                          emojiCategory === i
                            ? 'bg-white/10 text-white/80'
                            : 'text-white/30 hover:text-white/50'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-8 gap-1">
                    {EMOJI_CATEGORIES[emojiCategory].emojis.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => {
                          setText(prev => prev + emoji);
                          inputRef.current?.focus();
                        }}
                        className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors text-xl"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {emojiTab === 'stickers' && (
                <div className="space-y-3">
                  {stickerPacks.length === 0 && (
                    <p className="text-xs text-white/30 text-center py-4">Загрузка стикеров...</p>
                  )}
                  {stickerPacks.map((pack) => (
                    <div key={pack.name}>
                      <p className="text-[10px] text-white/30 mb-1.5 flex items-center gap-1">
                        <span>{pack.icon}</span> {pack.name}
                      </p>
                      <div className="grid grid-cols-4 gap-1">
                        {pack.stickers.map((sticker) => (
                          <button
                            key={sticker.filename}
                            onClick={() => {
                              setText(prev => prev + `[sticker:${pack.name}:${sticker.filename}]`);
                              inputRef.current?.focus();
                            }}
                            className="aspect-square rounded-lg hover:bg-white/[0.08] transition-colors overflow-hidden"
                          >
                            <img
                              src={sticker.fileUrl}
                              alt={sticker.filename}
                              className="w-full h-full object-contain p-0.5"
                              loading="lazy"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {emojiTab === 'gif' && (
                <div>
                  <div className="relative mb-2">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                    <input
                      type="text"
                      value={gifQuery}
                      onChange={e => handleGifSearchInput(e.target.value)}
                      placeholder="Поиск GIF..."
                      className="w-full h-8 pl-9 pr-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none"
                    />
                  </div>
                  {gifLoading ? (
                    <div className="flex items-center justify-center h-20">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    </div>
                  ) : gifs.length === 0 ? (
                    <div className="flex items-center justify-center h-20">
                      <p className="text-xs text-white/30">GIF не найдены</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {gifs.map((gif, i) => (
                        <button
                          key={gif.id || i}
                          onClick={() => handleGifSelect(gif)}
                          className="relative aspect-video rounded-lg overflow-hidden hover:ring-2 hover:ring-blue-500/50 transition-all bg-white/[0.03]"
                        >
                          <img
                            src={gif.thumbnailUrl || gif.previewUrl || gif.url}
                            alt="GIF"
                            className="w-full h-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Premium purchase modal */}
      <AnimatePresence>
        {showPremium && (
          <PremiumPurchaseModal onClose={() => setShowPremium(false)} />
        )}
      </AnimatePresence>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={fileAllInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileAllSelect}
      />
    </div>
  );
}

function AttachItem({ icon: Icon, label }: { icon: typeof Image; label: string }) {
  return (
    <button className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-white/60 hover:text-white/90 hover:bg-white/[0.06] transition-colors">
      <Icon size={14} />
      {label}
    </button>
  );
}

function EmojiPicker({
  onSelect,
  onClose,
}: {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}) {
  const reactions = EMOJI_CATEGORIES.find(c => c.name === 'Реакции')?.emojis || ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉', '💯', '🙏', '👀', '😍', '🥰', '😎', '🤝', '💪'];
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 5 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 5 }}
      className="p-2 rounded-xl liquid-glass-strong z-50"
      onClick={e => e.stopPropagation()}
    >
      <div className="grid grid-cols-4 gap-1">
        {reactions.map(emoji => (
          <button
            key={emoji}
            onClick={() => { onSelect(emoji); onClose(); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/[0.08] transition-colors text-lg"
          >
            {emoji}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function ForwardModal({
  onClose,
  onForward,
}: {
  onClose: () => void;
  onForward: (chatId: string) => void;
}) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const { chats: initChats, loaded } = useInitStore.getState();
    if (loaded && initChats.length > 0) {
      setChats(initChats);
      setLoading(false);
    } else {
      api.getChats()
        .then(data => {
          const chatArray: Chat[] = Array.isArray(data) ? data : ((data as any)?.chats ?? []);
          setChats(chatArray);
        })
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, []);

  const filtered = search
    ? chats.filter(c => c.name?.toLowerCase().includes(search.toLowerCase()))
    : chats;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-sm rounded-2xl liquid-glass-strong overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <h3 className="text-sm font-semibold text-white/90">Переслать</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-white/[0.08] transition-colors">
            <X size={14} className="text-white/40" />
          </button>
        </div>

        <div className="px-3 pt-2 pb-1">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск чатов..."
            className="w-full h-8 px-3 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none"
          />
        </div>

        <div className="max-h-72 overflow-y-auto px-2 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-white/30 text-center py-8">Нет чатов</p>
          ) : (
            filtered.map(c => (
              <button
                key={c.id}
                onClick={() => onForward(c.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-white/[0.06] border border-white/[0.05] flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-medium text-white/50">
                    {(c.name || '?').slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <span className="text-sm text-white/70 truncate">{c.name || 'Без названия'}</span>
              </button>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function TypingDots({ names }: { names: string[] }) {
  const label = names.length === 1
    ? `${names[0]} печатает`
    : names.length === 2
    ? `${names[0]} и ${names[1]} печатают`
    : `${names[0]} и ещё ${names.length - 1} печатают`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 5 }}
      className="flex items-center gap-2 px-4 py-1.5"
    >
      <div className="flex items-center gap-1">
        {[0, 1, 2].map(i => (
          <motion.span
            key={i}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
            className="w-1.5 h-1.5 rounded-full bg-white/30 block"
          />
        ))}
      </div>
      <span className="text-[11px] text-white/30">{label}</span>
    </motion.div>
  );
}

export function MessageArea({ chat, onBack }: MessageAreaProps) {
  const { user } = useAuthStore();
  const { startCall } = useCallContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [linkConfirmUrl, setLinkConfirmUrl] = useState<string | null>(null);
  const [e2eReady, setE2eReady] = useState(false);
  const [e2eFingerprint, setE2eFingerprint] = useState<string | null>(null);
  const e2eInitRef = useRef(false);
  const e2eReadyRef = useRef(false);
  const [decryptedMediaUrls, setDecryptedMediaUrls] = useState<Record<string, string>>({});
  const decryptedMediaUrlsRef = useRef<Record<string, string>>({});

  // Feature states
  const [replyTo, setReplyTo] = useState<{ id: string; content: string; sender: string } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);
  const [showForward, setShowForward] = useState<Message | null>(null);
  const [forwardingMsg, setForwardingMsg] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  // Decrypt loaded messages
  const decryptLoadedMessages = useCallback(async (msgs: Message[]) => {
    const decrypted = await Promise.all(msgs.map(async (msg) => {
      if (msg.isEncrypted && msg.encryptedContent && msg.encryptedIv) {
        const plaintext = await e2eManager.decryptChatMessage(chat.id, msg.encryptedContent, msg.encryptedIv);
        if (plaintext) {
          return { ...msg, content: plaintext };
        }
      }
      return msg;
    }));
    return decrypted;
  }, [chat.id]);

  // Decrypt media for a message and store the ObjectURL
  const decryptMessageMedia = useCallback(async (msg: Message) => {
    if (!msg.isEncrypted || !msg.encryptedContent || !msg.media?.[0]?.url) return;
    if (decryptedMediaUrlsRef.current[msg.id]) return;
    try {
      const mimeType = msg.encryptedContent;
      const response = await fetch(normalizeMediaUrl(msg.media[0].url));
      const encryptedBlob = await response.blob();
      const decrypted = await e2eManager.decryptChatMedia(chat.id, encryptedBlob, mimeType);
      if (decrypted) {
        const url = URL.createObjectURL(decrypted);
        decryptedMediaUrlsRef.current[msg.id] = url;
        setDecryptedMediaUrls(prev => ({ ...prev, [msg.id]: url }));
      }
    } catch (err) {
      console.error('[E2E] Failed to decrypt media:', err);
    }
  }, [chat.id]);

  const isChannel = chat.type === 'channel';
  const pinnedMessages = chat.pinnedMessages || [];

  // Listen for link confirmation events
  useEffect(() => {
    const handler = (e: CustomEvent) => {
      setLinkConfirmUrl(e.detail.url);
    };
    window.addEventListener('open-link-confirm', handler as EventListener);
    return () => window.removeEventListener('open-link-confirm', handler as EventListener);
  }, []);

  // Fetch messages
  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        if (chat.id === NOTES_CHAT_ID) {
          if (!cancelled) setMessages(getNotesMessages());
        } else {
          const { getSocket } = await import('../lib/socket');
          let data;
          if (getSocket()?.connected) {
            const resp = await api.fetchMessagesWS(chat.id);
            data = resp.messages;
          } else {
            data = await api.getMessages(chat.id);
          }
          if (data && e2eReadyRef.current) {
            data = await decryptLoadedMessages(data);
          }
          if (!cancelled) setMessages(data || []);
        }
      } catch (err) {
        console.error('Failed to load messages:', err);
        if (!cancelled) setMessages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [chat.id]);

  // E2E initialization
  useEffect(() => {
    if (e2eInitRef.current || !user || chat.id === NOTES_CHAT_ID) return;
    const isSecret = chat.isSecret || chat.isE2E || false;
    if (!isSecret) return;

    e2eInitRef.current = true;
    const otherUserId = chat.otherMember?.id || chat.members?.find(m => m.userId !== user.id)?.userId || null;

    (async () => {
      const status = await tryInitE2EForChat(user.id, chat.id, otherUserId, isSecret);
      setE2eReady(status.isReady);
      e2eReadyRef.current = status.isReady;
      setE2eFingerprint(status.keyFingerprint);
      if (status.isReady) {
        const stored = await import('../lib/e2e').then(m => m.getSessionInfo(chat.id));
        if (stored) setE2eFingerprint(stored.keyFingerprint);
      }
    })();
  }, [chat.id, chat.isSecret, chat.isE2E, user]);

  // Sync e2eReadyRef whenever e2eReady changes
  useEffect(() => {
    e2eReadyRef.current = e2eReady;
  }, [e2eReady]);

  // Decrypt media for encrypted media messages (only process newly added messages)
  const processedMediaIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!e2eReady) return;
    for (const msg of messages) {
      if (msg.isEncrypted && msg.media?.[0]?.url && msg.encryptedContent && !processedMediaIdsRef.current.has(msg.id)) {
        processedMediaIdsRef.current.add(msg.id);
        decryptMessageMedia(msg);
      }
    }
  }, [messages, e2eReady, decryptMessageMedia]);

  // Auto-scroll (instant for incoming messages; smooth is only used by the "jump to bottom" button)
  useEffect(() => {
    if (autoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [messages, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const threshold = 100;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setAutoScroll(isNearBottom);
  }, []);

  // Send message
  const handleSend = useCallback(async (text: string, options?: { replyToId?: string; media?: any[]; isEncrypted?: boolean; encryptedContent?: string }) => {
    try {
      const optimisticId = `opt_${Date.now()}`;
      const media = options?.media;
      const hasMedia = media && media.length > 0;
      const msgType = hasMedia ? (media[0]?.type?.startsWith('video') ? 'video_note' : media[0]?.type?.startsWith('audio') ? 'audio' : 'photo') : 'text';

      let finalText = text || (hasMedia ? (msgType === 'video_note' ? '📹 Видеокружок' : msgType === 'audio' ? '🎤 Голосовое сообщение' : '') : '');
      let isEncrypted = options?.isEncrypted || false;
      let encryptedContent = options?.encryptedContent || '';
      let encryptedIv = '';

      if (!isEncrypted && e2eReady && finalText && !hasMedia) {
        const encResult = await e2eManager.encryptChatMessage(chat.id, finalText);
        if (encResult) {
          encryptedContent = encResult.encryptedContent;
          encryptedIv = encResult.iv;
          isEncrypted = true;
          finalText = '🔒 Зашифрованное сообщение';
        }
      }

      const optimisticMsg: Message = {
        id: optimisticId,
        chatId: chat.id,
        senderId: user?.id || '',
        content: finalText,
        type: msgType,
        replyToId: options?.replyToId || null,
        isEdited: false,
        isDeleted: false,
        isEncrypted,
        createdAt: new Date().toISOString(),
        sender: {
          id: user?.id || '',
          username: user?.username || '',
          displayName: user?.displayName || '',
          avatar: user?.avatar || null,
        },
        media: options?.media || [],
        reactions: [],
        readBy: [{ userId: user?.id || '' }],
        _isSending: true,
      };

      setMessages(prev => [...prev, optimisticMsg]);
      setAutoScroll(true);

      if (chat.id === NOTES_CHAT_ID) {
        const savedMsg = { ...optimisticMsg, _isSending: false };
        saveNotesMessage(savedMsg);
        setMessages(prev =>
          prev.map(m => (m.id === optimisticId ? savedMsg : m))
        );
      } else {
        const result = await api.sendMessageWS(chat.id, finalText, {
          ...options,
          type: msgType,
          isEncrypted,
          encryptedContent,
          encryptedIv,
        });
        setMessages(prev =>
          prev.map(m =>
            m.id === optimisticId
              ? { ...m, id: result.messageId, createdAt: result.createdAt, _isSending: false }
              : m
          )
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev =>
        prev.map(m =>
          m.id.startsWith('opt_') && m._isSending
            ? { ...m, _isSending: false, _isFailed: true }
            : m
        )
      );
    }
  }, [chat.id, user, e2eReady]);

  // Toggle reaction
  const handleReact = useCallback(async (messageId: string, emoji: string) => {
    try {
      // Check if already reacted - find our reaction
      const msg = messages.find(m => m.id === messageId);
      const existingReaction = msg?.reactions?.find(
        r => r.emoji === emoji && r.userId === user?.id
      );

      if (existingReaction) {
        await api.removeReaction(messageId, emoji);
      } else {
        await api.addReaction(messageId, emoji);
      }

      // Update local state
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== messageId) return m;
          const reactions = [...(m.reactions || [])];
          if (existingReaction) {
            return { ...m, reactions: reactions.filter(r => r !== existingReaction) };
          }
          reactions.push({
            id: `optimistic-${Date.now()}`,
            emoji,
            userId: user?.id || '',
            user: { id: user?.id || '', username: user?.username || '', displayName: user?.displayName || '' },
          });
          return { ...m, reactions };
        })
      );
    } catch (err) {
      console.error('[React] Failed:', err);
    }
    setShowEmojiPicker(null);
  }, [messages, user]);

  // Typing indicator
  useEffect(() => {
    if (chat.id === NOTES_CHAT_ID) return;
    let cancelled = false;
    const listeners: { event: string; handler: (...args: any[]) => void }[] = [];

    function addListener(event: string, handler: (...args: any[]) => void) {
      listeners.push({ event, handler });
    }

    async function initTyping() {
      try {
        const { getSocket } = await import('../lib/socket');
        const socket = getSocket();
        if (!socket?.connected) return;

        const typingHandler = (data: { chatId: string; userId: string; username: string }) => {
          if (cancelled || data.chatId !== chat.id || data.userId === user?.id) return;
          setTypingUsers(prev => prev.includes(data.username) ? prev : [...prev, data.username]);
          setTimeout(() => {
            setTypingUsers(prev => prev.filter(u => u !== data.username));
          }, 3000);
        };
        socket.on('typing', typingHandler);
        addListener('typing', typingHandler);

        const stopTypingHandler = (data: { chatId: string; userId: string }) => {
          if (cancelled || data.chatId !== chat.id) return;
          setTypingUsers([]);
        };
        socket.on('stop_typing', stopTypingHandler);
        addListener('stop_typing', stopTypingHandler);

        const newMessageHandler = (data: { message?: Message }) => {
          if (cancelled) return;
          const msg = data.message;
          if (!msg || msg.chatId !== chat.id) return;

          (async () => {
            let decryptedMsg = { ...msg };
            if (msg.isEncrypted && msg.encryptedContent && msg.encryptedIv && e2eReadyRef.current) {
              const plaintext = await e2eManager.decryptChatMessage(chat.id, msg.encryptedContent, msg.encryptedIv);
              if (plaintext) {
                decryptedMsg.content = plaintext;
              }
            }

            // Decrypt media for encrypted media messages
            if (msg.isEncrypted && msg.media?.[0]?.url && msg.encryptedContent) {
              decryptMessageMedia(decryptedMsg);
            }

            setMessages(prev => {
              if (prev.some(m => m.id === decryptedMsg.id)) return prev;
              const now = Date.now();
              const isDuplicateOptimistic = prev.some(m =>
                m.id.startsWith('opt_') &&
                m.senderId === decryptedMsg.senderId &&
                m.content === decryptedMsg.content &&
                now - new Date(m.createdAt).getTime() < 5000
              );
              if (isDuplicateOptimistic) {
                return prev.map(m =>
                  m.id.startsWith('opt_') &&
                  m.senderId === decryptedMsg.senderId &&
                  m.content === decryptedMsg.content &&
                  now - new Date(m.createdAt).getTime() < 5000
                    ? decryptedMsg
                    : m
                );
              }
              return [...prev, decryptedMsg];
            });
            setAutoScroll(true);
          })();
        };
        socket.on('message:new', newMessageHandler);
        addListener('message:new', newMessageHandler);
      } catch {}
    }
    initTyping();
    return () => {
      cancelled = true;
      import('../lib/socket').then(({ getSocket }) => {
        const socket = getSocket();
        if (socket) {
          for (const { event, handler } of listeners) {
            socket.off(event, handler);
          }
        }
      });
    };
  }, [chat.id, user?.id]);

  // Search
  useEffect(() => {
    if (!searchMode || searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const data = await api.request<{ items?: Message[] }>(
          `/messages/search?q=${encodeURIComponent(searchQuery)}&chatId=${chat.id}`
        );
        if (cancelled) return;
        const results = data.items || [];
        if (e2eReadyRef.current) {
          const decrypted = await decryptLoadedMessages(results);
          if (cancelled) return;
          setSearchResults(decrypted);
        } else {
          setSearchResults(results);
        }
      } catch (err) {
        console.error('[Search] Failed:', err);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, searchMode, chat.id, decryptLoadedMessages]);

  const handleForward = useCallback(async (targetChatId: string) => {
    if (!forwardingMsg) return;
    try {
      let content = forwardingMsg.content || '';
      if (forwardingMsg.isEncrypted && forwardingMsg.encryptedContent && forwardingMsg.encryptedIv) {
        const decrypted = await e2eManager.decryptChatMessage(chat.id, forwardingMsg.encryptedContent, forwardingMsg.encryptedIv);
        if (decrypted) content = decrypted;
      }
      await api.sendMessageWS(targetChatId, `📩 Переслано: ${content}`);
    } catch (err) {
      console.error('[Forward] Failed:', err);
    }
    setShowForward(null);
    setForwardingMsg(null);
  }, [forwardingMsg, chat.id]);

  const handleReplyTo = useCallback((msg: Message) => {
    setReplyTo({
      id: msg.id,
      content: msg.content || '',
      sender: msg.sender?.displayName || msg.sender?.username || '',
    });
  }, []);

  const handleToggleEmojiPicker = useCallback((msgId: string) => {
    setShowEmojiPicker(prev => (prev === msgId ? null : msgId));
  }, []);

  return (
    <ChatWallpaper chatId={chat.id}>
      <ChatHeader
        chat={chat}
        onBack={onBack}
        onSearchToggle={() => setSearchMode(v => !v)}
        pinnedMessages={pinnedMessages}
        e2eReady={e2eReady}
        e2eFingerprint={e2eFingerprint}
      />

      {/* Search bar */}
      <AnimatePresence>
        {searchMode && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="flex-shrink-0 overflow-hidden border-b border-white/[0.06]"
          >
            <div className="px-3 py-2">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск в чате..."
                  autoFocus
                  className="w-full h-8 pl-9 pr-8 text-xs bg-white/[0.04] border border-white/[0.06] rounded-xl text-white/70 placeholder:text-white/20 outline-none transition-all duration-200 focus:border-white/20"
                />
                {searchQuery && (
                  <button
                    onClick={() => { setSearchQuery(''); setSearchMode(false); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X size={12} className="text-white/30 hover:text-white/60" />
                  </button>
                )}
              </div>

              {/* Search results */}
              {searchQuery.length >= 2 && (
                <div className="mt-2 max-h-40 overflow-y-auto space-y-0.5">
                  {searching ? (
                    <p className="text-xs text-white/30 text-center py-3">Поиск...</p>
                  ) : searchResults.length === 0 ? (
                    <p className="text-xs text-white/20 text-center py-3">Ничего не найдено</p>
                  ) : (
                    searchResults.slice(0, 10).map(msg => (
                      <button
                        key={msg.id}
                        onClick={() => {
                          setSearchQuery('');
                          setSearchMode(false);
                        }}
                        className="w-full flex items-start gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.04] transition-colors text-left"
                      >
                        <Search size={10} className="text-white/20 mt-1 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] text-white/40">{msg.sender?.displayName || msg.sender?.username || 'Пользователь'}</p>
                          <p className="text-xs text-white/50 truncate">{msg.content}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-3 py-2"
      >
        {loading ? (
          <div className="flex flex-col gap-3 pt-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`flex ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="h-12 w-48 rounded-2xl skeleton-shimmer bg-white/[0.03]"
                  style={{ borderRadius: i % 2 === 0 ? '16px 16px 4px 16px' : '16px 16px 16px 4px' }}
                />
              </div>
            ))}
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <p className="text-sm text-white/30">Нет сообщений</p>
            <p className="text-xs text-white/20 mt-1">Напишите первое сообщение</p>
          </div>
        ) : (
          <div className="min-h-full flex flex-col justify-end">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <div key={msg.id}>
                  {shouldShowDateSeparator(messages, idx) && (
                    <DateSeparator dateStr={msg.createdAt} />
                  )}
                  <div className="relative">
                    <MessageBubble
                      message={msg}
                      isOwn={msg.senderId === user?.id}
                      isChannel={isChannel}
                      onReply={handleReplyTo}
                      onReact={handleToggleEmojiPicker}
                      decryptedMediaUrl={decryptedMediaUrls[msg.id]}
                    />
                    {/* Emoji picker for this message */}
                    <AnimatePresence>
                      {showEmojiPicker === msg.id && (
                        <div className={`absolute top-0 z-40 ${msg.senderId === user?.id ? 'left-0 -translate-x-full pl-2' : 'right-0 translate-x-full pr-2'}`}>
                          <EmojiPicker
                            onSelect={(emoji) => handleReact(msg.id, emoji)}
                            onClose={() => setShowEmojiPicker(null)}
                          />
                        </div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              ))}
            </AnimatePresence>
            <div ref={messagesEndRef} />
          </div>
        )}

        {!autoScroll && messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => {
              messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              setAutoScroll(true);
            }}
            className="absolute bottom-20 left-1/2 -translate-x-1/2 p-2 rounded-full liquid-glass-subtle shadow-lg"
          >
            <ChevronDown size={16} className="text-white/50" />
          </motion.button>
        )}
      </div>

      {/* Typing indicator */}
      <AnimatePresence>
        {typingUsers.length > 0 && <TypingDots names={typingUsers} />}
      </AnimatePresence>

      <MessageInput
        onSend={handleSend}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        chatId={chat.id}
        e2eReady={e2eReady}
      />

      {/* Forward modal */}
      <AnimatePresence>
        {showForward && (
          <ForwardModal
            onClose={() => { setShowForward(null); setForwardingMsg(null); }}
            onForward={handleForward}
          />
        )}
      </AnimatePresence>

      {/* Link confirm dialog */}
      <AnimatePresence>
        {linkConfirmUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setLinkConfirmUrl(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 20 }}
              className="w-full max-w-sm rounded-2xl liquid-glass-strong overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-5 text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-blue-500/20 border border-blue-500/20 flex items-center justify-center">
                  <ExternalLink size={22} className="text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-white/90 mb-1">Открыть ссылку?</h3>
                <p className="text-xs text-white/50 mb-4 break-all">{linkConfirmUrl}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setLinkConfirmUrl(null)}
                    className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/70 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={() => {
                      window.open(linkConfirmUrl, '_blank', 'noopener,noreferrer');
                      setLinkConfirmUrl(null);
                    }}
                    className="flex-1 py-2.5 rounded-xl bg-blue-500/80 hover:bg-blue-500 text-xs text-white font-medium transition-colors"
                  >
                    Открыть
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </ChatWallpaper>
  );
}

function PremiumPurchaseModal({ onClose }: { onClose: () => void }) {
  const [prices, setPrices] = useState<Record<number, number>>({});
  const [currency, setCurrency] = useState('RUB');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    api.getPremiumPrices()
      .then(data => {
        setPrices(data.prices || {});
        setCurrency(data.currency || 'RUB');
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePurchase = async () => {
    if (!selected) return;
    setPaying(true);
    try {
      const result = await api.createPayment({ type: 'premium', premiumMonths: selected });
      toast.success('Перенаправление на оплату...');
      if (result.confirmationUrl) {
        window.open(result.confirmationUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      console.error('[Premium] Payment error:', err);
      toast.error('Ошибка создания платежа');
    } finally {
      setPaying(false);
    }
  };

  const months = [1, 3, 6, 12];
  const currencySymbol = currency === 'RUB' ? '₽' : currency === 'USD' ? '$' : currency;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-sm rounded-2xl liquid-glass-strong overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 pt-5 pb-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white/90">Нексо Премиум</h3>
              <p className="text-xs text-white/40 mt-0.5">Разблокируйте все возможности</p>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors">
              <X size={16} className="text-white/40" />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 mb-2">
            {[
              { icon: '🎨', label: 'Уникальные темы' },
              { icon: '📎', label: 'Файлы до 2 ГБ' },
              { icon: '🏆', label: 'Особый значок' },
              { icon: '🎮', label: 'Эксклюзивные стикеры' },
              { icon: '☁️', label: 'Облако 100 ГБ' },
              { icon: '👑', label: 'Приоритетная поддержка' },
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06]">
                <span className="text-sm">{feat.icon}</span>
                <span className="text-[10px] text-white/60 whitespace-nowrap">{feat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 mb-4">
                {months.map(m => {
                  const price = prices[m];
                  const isSelected = selected === m;
                  const monthlyPrice = price ? (price / m) : null;
                  return (
                    <button
                      key={m}
                      onClick={() => setSelected(m)}
                      className={`relative p-3 rounded-xl border transition-all text-left ${
                        isSelected
                          ? 'border-blue-500/50 bg-blue-500/10'
                          : 'border-white/[0.06] bg-white/[0.03] hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="text-sm font-medium text-white/80">{m} {m === 1 ? 'месяц' : m < 5 ? 'месяца' : 'месяцев'}</span>
                      {price && (
                        <div className="mt-1">
                          <span className="text-lg font-bold text-white/90">{price} {currencySymbol}</span>
                          {monthlyPrice && (
                            <span className="text-[10px] text-white/30 ml-1">
                              {monthlyPrice} {currencySymbol}/мес
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={handlePurchase}
                disabled={!selected || paying}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {paying ? 'Создание платежа...' : selected ? `Купить за ${prices[selected]} ${currencySymbol}` : 'Выберите тариф'}
              </button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
