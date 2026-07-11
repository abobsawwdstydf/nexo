import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send,
  Paperclip,
  X,
  Reply,
  Pencil,
  FileText,
  Check,
  Video,
} from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { useAuthStore } from '../stores/authStore';
import { api } from '../lib/api';
import { getSocket } from '../lib/socket';
import { useLang } from '../lib/i18n';
import { AUDIO_EXTENSIONS, MAX_FILE_SIZE } from '../lib/types';
import { playSendSound } from '../lib/sounds';
import type { Attachment } from './input/types';
import VoiceRecorder from './input/VoiceRecorder';
import AttachmentBar from './input/AttachmentBar';
import SchedulePicker from './input/SchedulePicker';
import MentionSuggestions from './input/MentionSuggestions';

import CameraModal from './CameraModal';
import AttachMenu from './AttachMenu';
import PollModal from './PollModal';
import LocationModal from './LocationModal';
import VideoNoteRecorder from './VideoNoteRecorder';
import MediaPicker from './MediaPicker';
import StickerPicker from './StickerPicker';
import ContactCardModal from './ContactCardModal';
import TemplatesModal from './TemplatesModal';
import QuickReplyModal from './QuickReplyModal';
import { hasAnimatedEmoji, convertEmojisToStickerCodes } from '../lib/animatedEmojis';

interface MessageInputProps {
  chatId: string;
}

export default function MessageInput({ chatId }: MessageInputProps) {
  const { user } = useAuthStore();
  const { t } = useLang();
  const { replyTo, editingMessage, setReplyTo, setEditingMessage, getDraft, setDraft, chats } = useChatStore();
  const [text, setText] = useState(() => getDraft(chatId));

  const chat = chats.find(c => c.id === chatId);
  const chatMembers = (chat?.members || []).filter((m) => m.user.id !== user?.id);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [showSchedule, setShowSchedule] = useState(false);
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleHour, setScheduleHour] = useState('12');
  const [scheduleMinute, setScheduleMinute] = useState('00');
  const [scheduleCalDate, setScheduleCalDate] = useState('');
  const [scheduleCalMonth, setScheduleCalMonth] = useState(new Date().getMonth());
  const [scheduleCalYear, setScheduleCalYear] = useState(new Date().getFullYear());
  const [scheduleToast, setScheduleToast] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [showAttachMenu, setShowAttachMenuState] = useState(false);
  const [showPoll, setShowPoll] = useState(false);
  const [showLocation, setShowLocation] = useState(false);
  const [showContactCard, setShowContactCard] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showStickers, setShowStickers] = useState(false);
  const attachmentsScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showGrammarCheck, setShowGrammarCheck] = useState(false);
  const [grammarResult, setGrammarResult] = useState<{ corrected: string; hasChanges: boolean; original: string } | null>(null);
  const [showQuickReplies, setShowQuickReplies] = useState(false);

  const [recordMode, setRecordMode] = useState<'voice' | 'video'>('voice');
  const [showVideoRecorder, setShowVideoRecorder] = useState(false);
  const [pressTimer, setPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [isRecording, setIsRecording] = useState(false);

  const filteredMembers = mentionQuery !== null && (chat?.type === 'group')
    ? chatMembers.filter((m) => {
        const q = mentionQuery.toLowerCase();
        return m.user.displayName.toLowerCase().includes(q) || m.user.username.toLowerCase().includes(q);
      }).slice(0, 6)
    : [];

  const insertMention = (member: { user: { username: string } }) => {
    const el = inputRef.current;
    if (!el) return;
    const cursorPos = el.selectionStart;
    const before = text.substring(0, cursorPos);
    const after = text.substring(cursorPos);
    const atIdx = before.lastIndexOf('@');
    if (atIdx === -1) return;
    const newText = before.substring(0, atIdx) + `@${member.user.username} ` + after;
    setText(newText);
    setDraft(chatId, newText);
    setMentionQuery(null);
    setMentionIndex(0);
    setTimeout(() => {
      el.focus();
      const newPos = atIdx + member.user.username.length + 2;
      el.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const emojiAnchorRef = useRef<HTMLButtonElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const el = inputRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 150) + 'px';
    }
  }, [text]);

  useEffect(() => {
    if (editingMessage?.content) {
      setText(editingMessage.content);
      inputRef.current?.focus();
    }
  }, [editingMessage]);

  useEffect(() => {
    if (!editingMessage) {
      setText(getDraft(chatId));
    }
  }, [chatId]);

  useEffect(() => {
    return () => {
      attachments.forEach(att => {
        if (att.preview) URL.revokeObjectURL(att.preview);
      });
    };
  }, []);

  const emitTyping = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('typing_start', chatId);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing_stop', chatId);
    }, 2000);
  }, [chatId]);

  const handleSend = async (scheduledAt?: string) => {
    const trimmed = text.trim();
    const hasAttachments = attachments.length > 0;

    if (!trimmed && !hasAttachments) return;
    if (isSending) return;

    playSendSound();

    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing_stop', chatId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

    if (editingMessage) {
      socket.emit('edit_message', {
        messageId: editingMessage.id,
        content: trimmed,
        chatId,
      });
      setEditingMessage(null);
      setText('');
      setDraft(chatId, '');
      return;
    }

    const genTempId = () => `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const makeSender = () => ({
      id: user?.id || '',
      username: user?.username || '',
      displayName: user?.displayName || '',
      avatar: user?.avatar || null,
    });

    if (hasAttachments) {
      const tempId = genTempId();
      const tempMedia = attachments.map(att => ({
        type: att.type || 'file',
        url: '',
        filename: att.file.name,
        size: att.file.size,
      }));

      const tempMessage = {
        id: tempId,
        chatId,
        senderId: user?.id || '',
        sender: makeSender(),
        content: trimmed || null,
        type: attachments.length > 1 ? 'album' : (attachments[0].type || 'file'),
        replyToId: replyTo?.id || null,
        quote: replyTo?.quote || null,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        readBy: [],
        media: tempMedia,
        reactions: [],
        _isSending: true,
        _uploadProgress: 0,
      } as any;

      useChatStore.getState().addMessage(tempMessage);
      setText('');
      setDraft(chatId, '');
      setReplyTo(null);

      setIsSending(true);
      try {
        const uploadPromises = attachments.map(att => api.uploadFile(att.file));
        const results = await Promise.all(uploadPromises);

        for (let i = 0; i < results.length; i++) {
          if (!results[i] || !results[i].url) {
            throw new Error(`Файл ${attachments[i].file.name} не загрузился`);
          }
        }

        const firstResult = results[0];
        const mediaType = firstResult.mimetype.startsWith('image/') ? 'image'
          : firstResult.mimetype.startsWith('video/') ? 'video'
          : firstResult.mimetype.startsWith('audio/') ? 'audio'
          : 'file';

        const media = results.map((result, index) => ({
          type: result.mimetype.startsWith('image/') ? 'image'
            : result.mimetype.startsWith('video/') ? 'video'
            : result.mimetype.startsWith('audio/') ? 'audio'
            : 'file',
          url: result.url,
          filename: result.filename || attachments[index].file.name,
          size: result.size || attachments[index].file.size,
          duration: result.duration,
        }));

        useChatStore.getState().replaceMessage(tempId, {
          ...tempMessage,
          _isSending: true,
          media,
          type: attachments.length > 1 ? 'album' : mediaType,
        } as any);

        socket.emit('send_message', {
          chatId,
          content: trimmed || null,
          type: attachments.length > 1 ? 'album' : mediaType,
          mediaUrl: firstResult.url,
          mediaType: mediaType,
          fileName: firstResult.filename || attachments[0].file.name,
          fileSize: firstResult.size || attachments[0].file.size,
          replyToId: replyTo?.id || null,
          quote: replyTo?.quote || null,
          albumCount: attachments.length,
          media: attachments.length > 1 ? media : undefined,
          _tempId: tempId,
          ...(scheduledAt ? { scheduledAt } : {}),
        });

        clearAttachments();
      } catch (e) {
        console.error('Ошибка загрузки файлов:', e);
        useChatStore.getState().markMessageFailed(tempId, chatId);
        alert('Ошибка загрузки файлов: ' + (e instanceof Error ? e.message : 'Неизвестная ошибка'));
      } finally {
        setIsSending(false);
      }
    } else {
      // Convert emoji characters to [sticker:emoji:URL] codes for animated rendering
      const contentToSend = convertEmojisToStickerCodes(trimmed);

      const stickerRegex = /\[sticker:([^:\]]+):([^\]]+)\]/g;
      const stickerMatches = [...contentToSend.matchAll(stickerRegex)];
      const textWithoutStickers = contentToSend.replace(stickerRegex, '').trim();
      const hasOnlyStickers = stickerMatches.length > 0 && textWithoutStickers.length === 0;

      const tempId = genTempId();

      // Always send as text message — sticker codes render inline as animated GIFs
      const tempMessage = {
        id: tempId,
        chatId,
        senderId: user?.id || '',
        sender: makeSender(),
        content: contentToSend,
        type: 'text' as const,
        replyToId: replyTo?.id || null,
        quote: replyTo?.quote || null,
        isEdited: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
        readBy: [],
        media: [],
        reactions: [],
        _isSending: true,
      } as any;

      useChatStore.getState().addMessage(tempMessage);
      setReplyTo(null);
      setText('');
      setDraft(chatId, '');

      socket.emit('send_message', {
        chatId,
        content: contentToSend,
        type: 'text',
        replyToId: replyTo?.id || null,
        quote: replyTo?.quote || null,
        _tempId: tempId,
        ...(scheduledAt ? { scheduledAt } : {}),
      });
    }
  };

  const handleSendSticker = (sticker: any) => {
    const socket = getSocket();
    if (!socket) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMessage = {
      id: tempId,
      chatId,
      senderId: user?.id || '',
      sender: {
        id: user?.id || '',
        username: user?.username || '',
        displayName: user?.displayName || '',
        avatar: user?.avatar || null,
      },
      content: null,
      type: 'sticker' as const,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      readBy: [],
      media: [{ url: sticker.fileUrl || sticker.url, type: 'sticker', filename: `sticker_${sticker.id}.${sticker.isAnimated ? 'gif' : 'png'}`, size: sticker.fileSize || 0 }],
      reactions: [],
      _isSending: true,
    } as any;

    useChatStore.getState().addMessage(tempMessage);

    socket.emit('send_message', {
      chatId,
      content: null,
      type: 'sticker',
      mediaUrl: sticker.fileUrl || sticker.url,
      mediaType: 'sticker',
      fileName: `sticker_${sticker.id}.${sticker.isAnimated ? 'gif' : 'png'}`,
      fileSize: sticker.fileSize || 0,
      replyToId: replyTo?.id || null,
      _tempId: tempId,
    });

    setReplyTo(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.ctrlKey && e.key >= '1' && e.key <= '9') {
      e.preventDefault();
      setShowQuickReplies(true);
      return;
    }

    if (e.key === '/' && text === '') {
      e.preventDefault();
      setShowQuickReplies(true);
      return;
    }

    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionIndex(i => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionIndex(i => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredMembers[mentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionQuery(null);
        return;
      }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearAttachments = () => {
    attachments.forEach(att => {
      if (att.preview) URL.revokeObjectURL(att.preview);
    });
    setAttachments([]);
  };

  const removeAttachment = (index: number) => {
    const att = attachments[index];
    if (att.preview) URL.revokeObjectURL(att.preview);
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const addAttachment = (file: File, type: 'image' | 'video' | 'file' | 'audio', preview?: string) => {
    setAttachments(prev => {
      if (prev.length >= 1200) {
        alert(t('tooManyFiles'));
        return prev;
      }
      return [...prev, { file, preview, type }];
    });
  };

  const handleCameraCapture = (file: File, type: 'image' | 'video') => {
    const preview = type === 'image' ? URL.createObjectURL(file) : undefined;
    addAttachment(file, type, preview);
    setShowCamera(false);
  };

  const handlePollSend = (poll: { question: string; options: string[]; multiple: boolean; quiz: boolean }) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('send_message', {
        chatId,
        content: JSON.stringify(poll),
        type: 'poll',
        replyToId: replyTo?.id || null,
      });
      setReplyTo(null);
    }
  };

  const handleLocationSend = (location: { lat: number; lng: number; accuracy: number; name?: string }) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('send_message', {
        chatId,
        content: JSON.stringify(location),
        type: 'location',
        replyToId: replyTo?.id || null,
      });
      setReplyTo(null);
    }
  };

  const handleContactSend = (contact: { userId: string; name: string; phone?: string; position?: string; avatarUrl?: string }) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('send_message', {
        chatId,
        content: JSON.stringify(contact),
        type: 'contact',
        replyToId: replyTo?.id || null,
      });
      setReplyTo(null);
    }
  };

  const handleTemplateInsert = (templateText: string) => {
    setText(prev => prev + templateText);
    setDraft(chatId, text + templateText);
    setShowTemplates(false);
    inputRef.current?.focus();
  };

  const handleStickerInsert = (sticker: any) => {
    const hasContent = text.trim().length > 0;

    if (!hasContent) {
      handleStickerSend(sticker);
      setShowStickers(false);
      return;
    }

    // Check if this is an animated emoji sticker — insert the emoji character
    if (sticker.emoji && hasAnimatedEmoji(sticker.emoji)) {
      const emoji = sticker.emoji;
      const cursorPos = inputRef.current?.selectionStart || text.length;
      const newText = text.slice(0, cursorPos) + emoji + text.slice(cursorPos);
      setText(newText);
      setDraft(chatId, newText);
      inputRef.current?.focus();
      setTimeout(() => {
        if (inputRef.current) {
          const newPos = cursorPos + emoji.length;
          inputRef.current.setSelectionRange(newPos, newPos);
        }
      }, 0);
      return;
    }

    // For non-animated stickers, insert [sticker:ID:URL] code
    const stickerCode = `[sticker:${sticker.id}:${sticker.fileUrl}]`;
    const cursorPos = inputRef.current?.selectionStart || text.length;
    const newText = text.slice(0, cursorPos) + stickerCode + text.slice(cursorPos);
    setText(newText);
    setDraft(chatId, newText);
    inputRef.current?.focus();
    setTimeout(() => {
      if (inputRef.current) {
        const newPos = cursorPos + stickerCode.length;
        inputRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  };

  const handleStickerSend = async (sticker: any) => {
    const socket = getSocket();
    if (!socket) return;
    const url = sticker.fileUrl || sticker.url;
    if (!url) return;

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tempMessage = {
      id: tempId,
      chatId,
      senderId: user?.id || '',
      sender: { id: user?.id || '', username: user?.username || '', displayName: user?.displayName || '', avatar: user?.avatar || null },
      content: null,
      type: 'sticker',
      replyToId: replyTo?.id || null,
      quote: replyTo?.quote || null,
      isEdited: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      readBy: [],
      media: [{ type: 'sticker', url, filename: sticker.emoji || 'sticker', size: sticker.fileSize || 0 }],
      reactions: [],
      _isSending: true,
    } as any;

    useChatStore.getState().addMessage(tempMessage);
    setReplyTo(null);

    socket.emit('send_message', {
      chatId,
      content: null,
      type: 'sticker',
      mediaUrl: url,
      mediaType: 'sticker',
      fileName: sticker.emoji || 'sticker',
      fileSize: sticker.fileSize || 0,
      replyToId: replyTo?.id || null,
      quote: replyTo?.quote || null,
      _tempId: tempId,
    });
  };

  const handleGifSend = async (gif: any) => {
    const socket = getSocket();
    if (socket) {
      socket.emit('send_message', {
        chatId,
        content: gif.title || null,
        type: 'gif',
        mediaUrl: gif.url,
        mediaType: 'gif',
        fileName: `gif_${gif.id}.gif`,
        fileSize: 0,
        replyToId: replyTo?.id || null,
      });
      setReplyTo(null);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      if (file.size > MAX_FILE_SIZE) {
        alert(t('fileTooLarge'));
        return;
      }
      const isAudio = file.type.startsWith('audio/') || AUDIO_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
      addAttachment(file, isAudio ? 'audio' : 'file');
    });
    e.target.value = '';
    setShowAttachMenuState(false);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const isVideo = file.type.startsWith('video/');
      const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      addAttachment(file, isVideo ? 'video' : 'image', preview);
    });
    e.target.value = '';
    setShowAttachMenuState(false);
  };

  const startVoiceRecording = () => {
    setIsRecording(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];

      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name}: файл слишком большой (макс. ${(MAX_FILE_SIZE / 1024 / 1024 / 1024).toFixed(1)} ГБ)`);
        return;
      }

      const isVideo = file.type.startsWith('video/');
      const isImage = file.type.startsWith('image/');
      const audioExts = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.wma', '.opus'];
      const isAudio = file.type.startsWith('audio/') || audioExts.some(ext => file.name.toLowerCase().endsWith(ext));

      const type = isImage ? 'image' : isVideo ? 'video' : isAudio ? 'audio' : 'file';
      const preview = isImage ? URL.createObjectURL(file) : undefined;

      addAttachment(file, type, preview);
      inputRef.current?.focus();
    }
  };

  const hasContent = text.trim() || attachments.length > 0;

  const checkGrammar = async () => {
    if (!text.trim()) return;

    setShowGrammarCheck(true);
    try {
      const response = await api.checkGrammar(text);
      setGrammarResult(response);
    } catch (error) {
      console.error('Ошибка проверки грамматики:', error);
      setGrammarResult(null);
    }
  };

  const applyGrammarFix = () => {
    if (grammarResult?.corrected) {
      setText(grammarResult.corrected);
      setDraft(chatId, grammarResult.corrected);
    }
    setShowGrammarCheck(false);
    setGrammarResult(null);
  };

  return (
    <div
      className="z-10 px-2 sm:px-4 pt-2 pb-2 sm:pb-4 flex-shrink-0 bg-transparent relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 rounded-[2rem] mx-6 mb-6 mt-2 bg-nexo-500/10 border-2 border-dashed border-nexo-400 backdrop-blur-sm flex items-center justify-center pointer-events-none"
          >
            <div className="flex flex-col items-center gap-2 text-nexo-300">
              <FileText size={32} className="animate-bounce" />
              <p className="font-semibold">{t('dropFileHere')}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(replyTo || editingMessage) && (
          <motion.div
            initial={{ height: 0, opacity: 0, y: 10, scale: 0.95 }}
            animate={{ height: 'auto', opacity: 1, y: 0, scale: 1 }}
            exit={{ height: 0, opacity: 0, y: 10, scale: 0.95 }}
            className="mb-2 max-w-3xl mx-auto overflow-hidden px-1.5"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl relative shadow-xl" style={{ background: 'rgba(30, 30, 30, 0.6)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', border: '1px solid rgba(60, 60, 70, 0.3)' }}>
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-3/5 bg-[#6ab2f2] rounded-r-md" />
              <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0">
                {editingMessage ? (
                  <Pencil size={12} className="text-nexo-400" />
                ) : (
                  <Reply size={12} className="text-nexo-400" />
                )}
              </div>
              <div className="flex-1 min-w-0 flex flex-col justify-center">
                <p className="text-xs font-semibold text-nexo-400 mb-0.5">
                  {editingMessage
                    ? t('editing')
                    : `${t('replyTo')} ${replyTo?.sender?.displayName || replyTo?.sender?.username || ''}`}
                </p>
                <div className="text-xs text-zinc-300 truncate opacity-80 border-l border-white/20 pl-2 ml-1">
                  {replyTo?.quote ? `«${replyTo.quote}»` : (editingMessage || replyTo)?.content || t('media') || 'Медиа'}
                </div>
              </div>
              <button
                onClick={() => {
                  setReplyTo(null);
                  setEditingMessage(null);
                  setText('');
                }}
                className="w-7 h-7 rounded-full flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {attachments.length > 0 && (
          <AttachmentBar
            attachments={attachments}
            isSending={isSending}
            onRemove={removeAttachment}
            t={t as (key: string) => string}
          />
        )}
      </AnimatePresence>

      {isRecording ? (
        <VoiceRecorder
          chatId={chatId}
          replyToId={replyTo?.id}
          onSent={() => setIsRecording(false)}
          onCancel={() => setIsRecording(false)}
        />
      ) : (
        <>
          {/* Inline sticker/emoji panel — instant, no animation */}
          {showStickerPanel && (
            <div className="w-full mb-2 h-[400px] flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111113]">
              <MediaPicker
                inline
                onClose={() => setShowStickerPanel(false)}
                onSelectEmoji={(emoji) => {
                  const el = inputRef.current;
                  if (!el) return;
                  const cursorPos = el.selectionStart;
                  const before = text.substring(0, cursorPos);
                  const after = text.substring(cursorPos);
                  setText(before + emoji + after);
                  setTimeout(() => {
                    el.focus();
                    const newPos = cursorPos + emoji.length;
                    el.setSelectionRange(newPos, newPos);
                  }, 0);
                }}
                onSendSticker={(sticker) => {
                  // If it's an animated emoji sticker, insert the emoji character
                  if (sticker.emoji && hasAnimatedEmoji(sticker.emoji)) {
                    const emoji = sticker.emoji;
                    const el = inputRef.current;
                    if (!el) return;
                    const cursorPos = el.selectionStart;
                    const before = text.substring(0, cursorPos);
                    const after = text.substring(cursorPos);
                    setText(before + emoji + after);
                    setTimeout(() => {
                      el.focus();
                      const newPos = cursorPos + emoji.length;
                      el.setSelectionRange(newPos, newPos);
                    }, 0);
                  } else {
                    const stickerCode = `[sticker:${sticker.id}:${sticker.fileUrl}]`;
                    const el = inputRef.current;
                    if (!el) return;
                    const cursorPos = el.selectionStart;
                    const before = text.substring(0, cursorPos);
                    const after = text.substring(cursorPos);
                    setText(before + stickerCode + after);
                    setTimeout(() => {
                      el.focus();
                      const newPos = cursorPos + stickerCode.length;
                      el.setSelectionRange(newPos, newPos);
                    }, 0);
                  }
                }}
                onSendGif={handleGifSend}
              />
            </div>
          )}

          {/* Formatting toolbar — visible when typing */}
          {text.length > 0 && (
            <div className="max-w-3xl mx-auto px-4 pb-1 flex items-center gap-0.5 overflow-x-auto scrollbar-hide">
              {[
                { label: 'B', title: 'Жирный', prefix: '**', suffix: '**', mono: true },
                { label: 'I', title: 'Курсив', prefix: '*', suffix: '*', mono: true },
                { label: 'S', title: 'Зачёркнутый', prefix: '~', suffix: '~', mono: true },
                { label: 'C', title: 'Код', prefix: '`', suffix: '`', mono: true },
                { label: 'H', title: 'Заголовок', prefix: '## ', suffix: '' },
                { label: '—', title: 'Линия', insert: '\n---\n' },
                { label: '> ', title: 'Цитата', prefix: '> ', suffix: '' },
                { label: '- ', title: 'Список', prefix: '- ', suffix: '' },
                { label: '1.', title: 'Нумерованный', prefix: '1. ', suffix: '' },
                { label: '⊞', title: 'Таблица', insert: '| Колонка 1 | Колонка 2 |\n|----------|----------|\n| Ячейка 1 | Ячейка 2 |' },
              ].map(({ label, title, prefix, suffix, insert, mono }) => (
                <button
                  key={title}
                  onClick={() => {
                    const el = inputRef.current;
                    if (!el) return;
                    const start = el.selectionStart;
                    const end = el.selectionEnd;
                    const selected = text.substring(start, end);
                    if (insert) {
                      setText(text.substring(0, start) + insert + text.substring(end));
                      setTimeout(() => { el.focus(); el.setSelectionRange(start + insert.length, start + insert.length); }, 0);
                      return;
                    }
                    const before = text.substring(0, start);
                    const after = text.substring(end);
                    const newText = before + (prefix || '') + (selected || 'текст') + (suffix || '') + after;
                    setText(newText);
                    setTimeout(() => {
                      el.focus();
                      if (selected) {
                        el.setSelectionRange(start + (prefix || '').length, start + (prefix || '').length + selected.length);
                      } else {
                        el.setSelectionRange(start + (prefix || '').length, start + (prefix || '').length + 4);
                      }
                    }, 0);
                  }}
                  title={title}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium text-white/40 hover:text-white/70 hover:bg-white/5 transition-colors flex-shrink-0 ${mono ? 'font-mono' : ''}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Liquid Glass Input Bar */}
          <div className="max-w-3xl mx-auto px-0 sm:px-0 pb-1 sm:pb-0">
            <div className="flex items-center justify-center gap-3 w-full">
              {/* Кнопка «Скрепка» */}
              <button
                onClick={() => setShowAttachMenuState(true)}
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-[0.94]"
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  background: 'rgba(30, 30, 30, 0.6)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(60, 60, 70, 0.5)',
                }}
                title="Прикрепить"
              >
                <Paperclip size={22} className="text-white" />
              </button>

              {/* Поле ввода со смайликом внутри */}
              <div
                className="flex-1 min-w-0 flex items-center gap-3 rounded-full px-[18px] h-[52px] transition-all duration-200 focus-within:border-[#6ab2f2]/30"
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  background: 'rgba(30, 30, 30, 0.6)',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
                  border: '1px solid rgba(60, 60, 70, 0.3)',
                }}
              >
                <textarea
                  ref={inputRef}
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    setDraft(chatId, e.target.value);
                    emitTyping();
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={t('message')}
                  rows={1}
                  className="flex-1 min-w-0 bg-transparent text-white resize-none outline-none text-[17px] font-normal leading-normal max-h-[120px] overflow-y-auto scrollbar-hide py-[8px]"
                  style={{ letterSpacing: '0.3px' }}
                />
                <button
                  ref={emojiAnchorRef}
                  onClick={() => setShowStickerPanel(prev => !prev)}
                  data-mediapicker-anchor
                  className="w-6 h-6 flex-shrink-0 flex items-center justify-center transition-colors"
                  style={{ color: showStickerPanel ? '#6ab2f2' : 'rgba(255,255,255,0.45)' }}
                  title="Эмодзи, стикеры и GIF"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="4" ry="4" stroke="currentColor" />
                    <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="15.5" cy="8.5" r="1.5" fill="currentColor" stroke="none" />
                    <path d="M8 15c1.5 2 4.5 2 6 0" stroke="currentColor" />
                  </svg>
                </button>
              </div>

              {/* Кнопка «Микрофон / Отправить» */}
              <button
                onMouseDown={() => {
                  if (hasContent) return;
                  const timer = setTimeout(() => {
                    setRecordMode(prev => prev === 'voice' ? 'video' : 'voice');
                  }, 1300);
                  setPressTimer(timer);
                }}
                onMouseUp={() => {
                  if (pressTimer) {
                    clearTimeout(pressTimer);
                    setPressTimer(null);
                  }
                }}
                onTouchStart={() => {
                  if (hasContent) return;
                  const timer = setTimeout(() => {
                    setRecordMode(prev => prev === 'voice' ? 'video' : 'voice');
                  }, 1300);
                  setPressTimer(timer);
                }}
                onTouchEnd={() => {
                  if (pressTimer) {
                    clearTimeout(pressTimer);
                    setPressTimer(null);
                  }
                }}
                onClick={() => {
                  if (hasContent) {
                    handleSend();
                  } else if (recordMode === 'video') {
                    setShowVideoRecorder(true);
                  } else {
                    startVoiceRecording();
                  }
                }}
                disabled={isSending || (!hasContent && isRecording)}
                className="w-[52px] h-[52px] rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200 active:scale-[0.94] disabled:opacity-40"
                style={{
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  background: hasContent ? '#6ab2f2' : 'rgba(30, 30, 30, 0.6)',
                  boxShadow: hasContent ? '0 4px 20px rgba(106, 178, 242, 0.2)' : '0 4px 20px rgba(0, 0, 0, 0.2)',
                  border: hasContent ? 'none' : '1px solid rgba(60, 60, 70, 0.5)',
                }}
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : hasContent ? (
                  <Send size={20} className="text-white" />
                ) : recordMode === 'video' ? (
                  <Video size={20} className="text-white" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Mention Suggestions */}
          {mentionQuery !== null && (
            <MentionSuggestions
              members={filteredMembers}
              mentionIndex={mentionIndex}
              onSelect={insertMention}
            />
          )}
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="*/*"
        multiple
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={handleImageChange}
      />

      <AnimatePresence>
        {showSchedule && (
          <SchedulePicker
            calDate={scheduleCalDate}
            setCalDate={setScheduleCalDate}
            calMonth={scheduleCalMonth}
            setCalMonth={setScheduleCalMonth}
            calYear={scheduleCalYear}
            setCalYear={setScheduleCalYear}
            hour={scheduleHour}
            setHour={setScheduleHour}
            minute={scheduleMinute}
            setMinute={setScheduleMinute}
            onSend={(iso) => {
              handleSend(iso);
              setShowSchedule(false);
              setScheduleToast('Сообщение запланировано');
              setTimeout(() => setScheduleToast(null), 3000);
            }}
            t={t}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scheduleToast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-emerald-500 text-white text-sm font-medium shadow-lg z-50 flex items-center gap-2"
          >
            <Check size={16} />
            {scheduleToast}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCamera && (
          <CameraModal
            onClose={() => setShowCamera(false)}
            onCapture={handleCameraCapture}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAttachMenu && (
          <AttachMenu
            onClose={() => setShowAttachMenuState(false)}
            onSelectFile={() => fileInputRef.current?.click()}
            onSelectImage={() => imageInputRef.current?.click()}
            onSelectCamera={() => setShowCamera(true)}
            onSelectPoll={() => setShowPoll(true)}
            onSelectLocation={() => setShowLocation(true)}
            onSelectSticker={() => { setShowStickers(true); setShowAttachMenuState(false); }}
            onSelectContact={() => setShowContactCard(true)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showStickers && (
          <StickerPicker
            onClose={() => setShowStickers(false)}
            onSendSticker={(sticker) => {
              handleSendSticker(sticker);
              setShowStickers(false);
            }}
            onInsertSticker={(sticker) => {
              handleStickerInsert(sticker);
              setShowStickers(false);
            }}
            onSendGif={(gif) => {
              handleGifSend(gif);
              setShowStickers(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showPoll && (
          <PollModal
            onClose={() => setShowPoll(false)}
            onSend={handlePollSend}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLocation && (
          <LocationModal
            onClose={() => setShowLocation(false)}
            onSend={handleLocationSend}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showContactCard && (
          <ContactCardModal
            chatId={chatId}
            onClose={() => setShowContactCard(false)}
            onSend={(contact) => {
              handleContactSend({
                userId: contact.contact?.id || contact.id,
                name: contact.contact?.displayName || contact.displayName || '',
                phone: contact.contact?.phone || contact.phone,
                avatarUrl: contact.contact?.avatar || contact.avatar,
              });
              setShowContactCard(false);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTemplates && (
          <TemplatesModal
            onClose={() => setShowTemplates(false)}
            onSelect={handleTemplateInsert}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showQuickReplies && (
          <QuickReplyModal
            onClose={() => setShowQuickReplies(false)}
            onSelect={(message) => {
              setText(message);
              setDraft(chatId, message);
              inputRef.current?.focus();
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGrammarCheck && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            onClick={() => {
              setShowGrammarCheck(false);
              setGrammarResult(null);
            }}
          >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg rounded-2xl bg-surface-secondary border border-white/10 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <h3 className="text-lg font-semibold text-white">Проверка грамматики</h3>
                </div>
                <button
                  onClick={() => {
                    setShowGrammarCheck(false);
                    setGrammarResult(null);
                  }}
                  className="p-2 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-white"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-4">
                {!grammarResult ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-12 h-12 border-4 border-nexo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-zinc-400">Проверяю текст...</p>
                  </div>
                ) : grammarResult.hasChanges ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Исходный текст:</label>
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-zinc-300">
                        {grammarResult.original}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-zinc-500 mb-1 block">Исправленный текст:</label>
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-sm text-white">
                        {grammarResult.corrected}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={applyGrammarFix}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-medium transition-colors"
                      >
                        Применить исправления
                      </button>
                      <button
                        onClick={() => {
                          setShowGrammarCheck(false);
                          setGrammarResult(null);
                        }}
                        className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium transition-colors"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <Check size={24} className="text-emerald-400" />
                    </div>
                    <p className="text-sm text-zinc-300">Ошибок не найдено!</p>
                    <button
                      onClick={() => {
                        setShowGrammarCheck(false);
                        setGrammarResult(null);
                      }}
                      className="mt-2 px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white font-medium transition-colors"
                    >
                      Закрыть
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVideoRecorder && (
          <VideoNoteRecorder
            chatId={chatId}
            onClose={() => setShowVideoRecorder(false)}
            onSent={() => {
              setShowVideoRecorder(false);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
