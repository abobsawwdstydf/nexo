import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, AlertTriangle } from 'lucide-react';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';

interface LinkMeta {
  url: string;
  title: string;
  description: string;
  image: string;
  favicon: string;
  domain: string;
}

interface LinkPreviewProps {
  url: string;
  isOwn?: boolean;
}

const linkCache = new Map<string, LinkMeta>();

function extractDomain(url: string): string {
  try {
    const u = new URL(url);
    return u.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

async function fetchLinkMeta(url: string): Promise<LinkMeta | null> {
  if (linkCache.has(url)) return linkCache.get(url)!;

  try {
    const data = await api.request<{
      title?: string;
      description?: string;
      image?: string;
      favicon?: string;
      domain?: string;
    }>(`/features/link-preview?url=${encodeURIComponent(url)}`);
    const meta: LinkMeta = {
      url,
      title: data.title || extractDomain(url),
      description: data.description || '',
      image: data.image || '',
      favicon: data.favicon || '',
      domain: data.domain || extractDomain(url),
    };
    linkCache.set(url, meta);
    return meta;
  } catch {}

  const fallback: LinkMeta = {
    url,
    title: extractDomain(url),
    description: '',
    image: '',
    favicon: '',
    domain: extractDomain(url),
  };
  linkCache.set(url, fallback);
  return fallback;
}

function isProbablySafe(url: string): boolean {
  try {
    const u = new URL(url);
    const safe = ['https:', 'http:'];
    if (!safe.includes(u.protocol)) return false;
    const unsafe = ['danger', 'hack', 'phish', 'malware', 'trojan', 'virus', 'worm', 'exploit', '0day'];
    const host = u.hostname.toLowerCase();
    if (unsafe.some(s => host.includes(s))) return false;
    return true;
  } catch {
    return false;
  }
}

function ConfirmDialog({ url, onConfirm, onCancel }: { url: string; onConfirm: () => void; onCancel: () => void }) {
  const safe = isProbablySafe(url);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        className="w-full max-w-sm rounded-2xl liquid-glass-strong overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 text-center">
          {safe ? (
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-green-500/20 border border-green-500/20 flex items-center justify-center">
              <ExternalLink size={22} className="text-green-400" />
            </div>
          ) : (
            <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-red-500/20 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle size={22} className="text-red-400" />
            </div>
          )}
          <h3 className="text-sm font-semibold text-white/90 mb-1">
            {safe ? 'Открыть ссылку?' : 'Подозрительная ссылка'}
          </h3>
          <p className="text-xs text-white/50 mb-3 break-all">{url}</p>
          {!safe && (
            <p className="text-[10px] text-red-400/60 mb-3 flex items-center justify-center gap-1">
              <AlertTriangle size={10} />
              Эта ссылка может быть опасной
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-xs text-white/70 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              className={`flex-1 py-2.5 rounded-xl text-xs text-white font-medium transition-colors ${
                safe ? 'bg-accent/80 hover:bg-accent' : 'bg-red-500/80 hover:bg-red-500'
              }`}
            >
              Открыть
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function LinkPreview({ url, isOwn }: LinkPreviewProps) {
  const [meta, setMeta] = useState<LinkMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchLinkMeta(url).then(m => {
      if (!cancelled) {
        setMeta(m);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, [url]);

  const handleClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirm = useCallback(() => {
    setShowConfirm(false);
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [url]);

  const handleCancel = useCallback(() => {
    setShowConfirm(false);
  }, []);

  if (loading) {
    return (
      <div className={`mt-1.5 rounded-xl overflow-hidden ${isOwn ? 'bg-white/[0.04]' : 'bg-black/[0.15]'}`}>
        <div className="h-24 skeleton-shimmer" />
      </div>
    );
  }

  if (!meta) return null;

  return (
    <>
      <motion.button
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={handleClick}
        className={`mt-1.5 rounded-xl overflow-hidden text-left w-full transition-all hover:scale-[1.02] active:scale-[0.98] ${
          isOwn ? 'bg-white/[0.06] hover:bg-white/[0.08]' : 'bg-black/[0.2] hover:bg-black/[0.25]'
        }`}
        style={{ backdropFilter: 'blur(8px)' }}
      >
        {meta.image && (
          <div className="relative w-full h-28 overflow-hidden">
            <img
              src={meta.image}
              alt=""
              className="w-full h-full object-cover"
              onError={e => { (e.target as HTMLElement).style.display = 'none'; }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          </div>
        )}
        <div className="p-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            {meta.favicon && (
              <img src={meta.favicon} alt="" className="w-3.5 h-3.5 rounded" onError={e => { (e.target as HTMLElement).style.display = 'none'; }} />
            )}
            <span className="text-[10px] text-white/40 truncate">{meta.domain}</span>
          </div>
          <p className={`text-xs font-medium leading-snug line-clamp-2 ${isOwn ? 'text-white/80' : 'text-white/70'}`}>
            {meta.title || meta.domain}
          </p>
          {meta.description && (
            <p className="text-[10px] text-white/40 mt-0.5 line-clamp-1">{meta.description}</p>
          )}
        </div>
      </motion.button>

      <AnimatePresence>
        {showConfirm && (
          <ConfirmDialog
            url={url}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
          />
        )}
      </AnimatePresence>
    </>
  );
}

const URL_REGEX = /(https?:\/\/[^\s<]+[^\s<.,:;!?'")}\]>])/gi;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

const STICKER_REGEX = /\[sticker:([^\]]+?):([^\]]+?)\]/g;
const MY_STICKER_REGEX = /\[mysticker:([^\]]+?):([^\]]+?)\]/g;
const MY_EMOJI_REGEX = /\[myemoji:([^\]]+?):([^\]]+?)\]/g;

export function renderTextWithLinks(text: string, isOwn: boolean): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,:;!?'")}\]>])/gi;

  let urlMatches: { index: number; url: string }[] = [];
  while ((match = urlRegex.exec(text)) !== null) {
    urlMatches.push({ index: match.index, url: match[0] });
  }

  let stickerMatches: { index: number; pack: string; filename: string }[] = [];
  STICKER_REGEX.lastIndex = 0;
  while ((match = STICKER_REGEX.exec(text)) !== null) {
    stickerMatches.push({ index: match.index, pack: match[1], filename: match[2] });
  }

  let myStickerMatches: { index: number; pack: string; filename: string }[] = [];
  MY_STICKER_REGEX.lastIndex = 0;
  while ((match = MY_STICKER_REGEX.exec(text)) !== null) {
    myStickerMatches.push({ index: match.index, pack: match[1], filename: match[2] });
  }

  let myEmojiMatches: { index: number; pack: string; filename: string }[] = [];
  MY_EMOJI_REGEX.lastIndex = 0;
  while ((match = MY_EMOJI_REGEX.exec(text)) !== null) {
    myEmojiMatches.push({ index: match.index, pack: match[1], filename: match[2] });
  }

  const allTokens = [
    ...urlMatches.map(m => ({ ...m, type: 'url' as const })),
    ...stickerMatches.map(m => ({ ...m, type: 'sticker' as const })),
    ...myStickerMatches.map(m => ({ ...m, type: 'mysticker' as const })),
    ...myEmojiMatches.map(m => ({ ...m, type: 'myemoji' as const })),
  ].sort((a, b) => a.index - b.index);

  for (const token of allTokens) {
    if (token.index > lastIndex) {
      parts.push(
        <span key={`t${lastIndex}`}>{text.slice(lastIndex, token.index)}</span>
      );
    }

    if (token.type === 'url') {
      const url = token.url.startsWith('http://') || token.url.startsWith('https://') ? token.url : 'about:blank';
      const domain = extractDomain(url);
      parts.push(
        <a
          key={`l${token.index}`}
          href={url}
          onClick={e => {
            e.preventDefault();
            const el = e.currentTarget.closest('[data-link-preview]');
            if (el) return;
            const event = new CustomEvent('open-link-confirm', { detail: { url, isOwn } });
            window.dispatchEvent(event);
          }}
          className={`inline-flex items-center gap-0.5 font-medium underline underline-offset-2 decoration-1 ${
            isOwn ? 'text-white/70 decoration-white/30 hover:decoration-white/70' : 'text-accent decoration-accent/40 hover:decoration-accent'
          } transition-all`}
          target="_blank"
          rel="noopener noreferrer"
          data-link-preview
        >
          {domain}
          <ExternalLink size={10} className="opacity-60" />
        </a>
      );
      lastIndex = token.index + url.length;
    } else if (token.type === 'sticker') {
      const t = token as typeof stickerMatches[0];
      parts.push(
        <img
          key={`s${token.index}`}
          src={normalizeMediaUrl(`/stickers/proxy/${t.filename}`)}
          alt={t.filename}
          className="max-w-[128px] max-h-[128px] rounded-lg my-1"
          loading="lazy"
        />
      );
      lastIndex = token.index + `[sticker:${t.pack}:${t.filename}]`.length;
    } else if (token.type === 'mysticker') {
      const t = token as typeof myStickerMatches[0];
      parts.push(
        <img
          key={`ms${token.index}`}
          src={normalizeMediaUrl(`/uploads/stickers/${t.pack}/${t.filename}`)}
          alt="стикер"
          className="max-w-[128px] max-h-[128px] rounded-lg my-1"
          loading="lazy"
          draggable={false}
        />
      );
      lastIndex = token.index + `[mysticker:${t.pack}:${t.filename}]`.length;
    } else if (token.type === 'myemoji') {
      const t = token as typeof myEmojiMatches[0];
      parts.push(
        <img
          key={`me${token.index}`}
          src={normalizeMediaUrl(`/uploads/stickers/${t.pack}/${t.filename}`)}
          alt="эмодзи"
          className="inline-block w-[1.3em] h-[1.3em] align-[-0.25em] mx-[1px] object-contain"
          loading="lazy"
          draggable={false}
        />
      );
      lastIndex = token.index + `[myemoji:${t.pack}:${t.filename}]`.length;
    }
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>);
  }

  return parts;
}
