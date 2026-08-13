import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ImagePlus, Type, Send, Lock } from 'lucide-react';
import {
  generateGroupSymmetricKey,
  importGroupKey,
  encryptMessage,
  saveStoryKey,
  wrapGroupKeyFor,
  computeSharedSecret,
  loadIdentityKeyPair,
} from '../lib/e2e';
import { e2eManager } from '../lib/e2eSession';
import { api } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { useInitStore } from '../stores/initStore';
import type { StoryGroup } from '../lib/types';
import { normalizeMediaUrl } from '../lib/mediaUrl';
import { toast } from '../lib/toast';

const BG_COLORS = [
  '#1e1b4b', '#4c1d95', '#9d174d', '#7f1d1d',
  '#134e4a', '#1e3a8a', '#374151', '#111827',
];

interface StoryCreateModalProps {
  onClose: () => void;
  onCreated: (group: StoryGroup) => void;
}

export function StoryCreateModal({ onClose, onCreated }: StoryCreateModalProps) {
  const user = useAuthStore(s => s.user);
  const setStories = useInitStore(s => s.setStories);
  const stories = useInitStore(s => s.stories);
  const [tab, setTab] = useState<'text' | 'photo'>('text');
  const [content, setContent] = useState('');
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoCaption, setPhotoCaption] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secret, setSecret] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoPick = async (file: File | null) => {
    if (!file) return;
    setError(null);
    try {
      const media = await api.uploadFile(file);
      setPhotoUrl(media.url ?? null);
    } catch (err) {
      console.error('Failed to upload photo:', err);
      setError('Не удалось загрузить фото. Попробуй ещё раз.');
    }
  };

  const handleCreate = async () => {
    if (sending) return;
    if (!user) return;
    if (tab === 'text' && !content.trim()) {
      setError('Введи текст истории');
      return;
    }
    if (tab === 'photo' && !photoUrl) {
      setError('Выбери фото');
      return;
    }

    setSending(true);
    setError(null);
    let contentPayload: string | undefined =
      tab === 'photo' ? (photoCaption.trim() || undefined) : content.trim();
    let isEncrypted = false;
    let encryptedContent: string | undefined;
    let encryptedIv: string | undefined;
    let myWrappedKey: string | undefined;
    let wrappedKeys: Array<{ userId: string; wrappedKey: string }> | undefined;
    let rawKey: string | null = null;

    if (secret && contentPayload) {
      try {
        await e2eManager.initialize(user.id);
        const keyPair = loadIdentityKeyPair(user.id);
        if (!keyPair) throw new Error('no keypair');

        rawKey = generateGroupSymmetricKey();
        const storyKey = await importGroupKey(rawKey);
        const enc = await encryptMessage(storyKey, contentPayload);
        encryptedContent = enc.ciphertext;
        encryptedIv = enc.iv;

        const selfSecret = await computeSharedSecret(keyPair.privateKey, keyPair.publicKey);
        myWrappedKey = await wrapGroupKeyFor(selfSecret, rawKey);

        try {
          const friends = await api.getFriends();
          wrappedKeys = [];
          for (const f of friends) {
            try {
              const resp = await api.fetchKeyBundle(f.id);
              const identity = resp.bundles?.[0]?.identityKey;
              if (!identity) continue;
              const secret = await computeSharedSecret(keyPair.privateKey, identity);
              wrappedKeys.push({ userId: f.id, wrappedKey: await wrapGroupKeyFor(secret, rawKey) });
            } catch {
              // друг без key-бандла — пропускаем
            }
          }
        } catch (err) {
          console.error('Failed to wrap story key for friends:', err);
          wrappedKeys = undefined;
        }

        isEncrypted = true;
        contentPayload = undefined;
      } catch (err) {
        console.error('Failed to encrypt secret story:', err);
        setError('Не удалось зашифровать историю');
        setSending(false);
        return;
      }
    }

    try {
      const story = await api.createStory({
        type: tab === 'photo' ? 'photo' : 'text',
        mediaUrl: tab === 'photo' ? photoUrl ?? undefined : undefined,
        content: contentPayload,
        bgColor: tab === 'text' ? bgColor : undefined,
        expiresIn: 24,
        isEncrypted,
        encryptedContent,
        encryptedIv,
        myWrappedKey,
        wrappedKeys,
      });

      if (rawKey) saveStoryKey(story.id, rawKey);

      const meGroup: StoryGroup = {
        user: { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar ?? null },
        stories: [story],
        hasUnviewed: false,
      };
      const updatedGroups = [meGroup, ...stories.filter(g => g.user.id !== user.id)];
      onCreated(updatedGroups[0]);
      setStories(updatedGroups);
      toast.success('История опубликована');
      onClose();
    } catch (err) {
      console.error('Failed to create story:', err);
      setError('Не удалось опубликовать историю');
      setSending(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        className="relative w-full max-w-md rounded-3xl liquid-glass-strong border border-white/[0.1] shadow-2xl p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white">Новая история</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-white/70 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-4">
          {([
            { id: 'text' as const, label: 'Текст', icon: Type },
            { id: 'photo' as const, label: 'Фото', icon: ImagePlus },
          ]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                tab === t.id
                  ? 'bg-white/[0.12] text-white border border-white/[0.1]'
                  : 'bg-white/[0.04] text-white/50 hover:text-white/70 border border-transparent'
              }`}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'text' ? (
          <div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={500}
              placeholder="Что у тебя нового?"
              className="w-full h-32 resize-none bg-white/[0.05] border border-white/[0.08] rounded-2xl p-3 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-colors"
            />
            <div className="text-right text-[11px] text-white/30 mt-1">{content.length}/500</div>
            <div className="flex items-center gap-2 mt-3">
              {BG_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                    bgColor === c ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
            <div
              className="mt-4 rounded-2xl h-40 flex items-center justify-center p-4"
              style={{ backgroundColor: bgColor }}
            >
              <p className="text-white text-lg text-center font-medium whitespace-pre-wrap break-words max-h-full overflow-hidden">
                {content || 'Предпросмотр...'}
              </p>
            </div>
          </div>
        ) : (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => handlePhotoPick(e.target.files?.[0] ?? null)}
            />
            {photoUrl ? (
              <div className="relative rounded-2xl overflow-hidden h-64 bg-black/40">
                <img src={normalizeMediaUrl(photoUrl)} alt="" className="w-full h-full object-contain" />
                <button
                  onClick={() => { setPhotoUrl(null); }}
                  className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileRef.current?.click()}
                className="w-full h-64 rounded-2xl border-2 border-dashed border-white/[0.15] hover:border-white/[0.3] hover:bg-white/[0.03] flex flex-col items-center justify-center gap-2 text-white/50 transition-colors"
              >
                <ImagePlus size={28} />
                <span className="text-xs">Выбери фото</span>
              </button>
            )}
            <input
              value={photoCaption}
              onChange={e => setPhotoCaption(e.target.value)}
              maxLength={120}
              placeholder="Подпись к фото (необязательно)"
              className="w-full mt-3 bg-white/[0.05] border border-white/[0.08] rounded-2xl px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-white/20 transition-colors"
            />
          </div>
        )}

        {error && (
          <p className="text-xs text-red-400 mt-3">{error}</p>
        )}

        <button
          onClick={() => setSecret(v => !v)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-2xl border text-xs font-medium transition-colors mb-3 ${
            secret
              ? 'bg-accent/15 border-accent/40 text-accent'
              : 'bg-white/[0.04] border-white/[0.08] text-white/60 hover:text-white/80'
          }`}
        >
          <span className="flex items-center gap-2">
            <Lock size={14} />
            Секретная история
          </span>
          <span className={`relative w-8 h-4.5 rounded-full transition-colors ${secret ? 'bg-accent' : 'bg-white/15'}`}>
            <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-all ${secret ? 'translate-x-3.5' : ''}`} />
          </span>
        </button>
        {secret && (
          <p className="text-[11px] text-white/40 -mt-1 mb-2">
            Текст будет зашифрован (AES-256-GCM). Ключ получат только твои друзья.
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={sending}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-accent hover:bg-accent/90 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {sending ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={14} />
          )}
          {sending ? 'Публикация...' : 'Опубликовать'}
        </button>
      </motion.div>
    </motion.div>
  );
}