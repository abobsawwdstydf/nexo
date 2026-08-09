import React, { memo, useEffect, useMemo, useState } from 'react';
import { parseAnimatedEmojis } from './AnimatedEmoji';
import { api } from '../lib/api';
import { normalizeMediaUrl } from '../lib/mediaUrl';

interface MarkdownRendererProps {
  content: string;
  isOwn?: boolean;
  /** РћС‚РїСЂР°РІРёС‚РµР»СЊ СЃРѕРѕР±С‰РµРЅРёСЏ вЂ” РЅСѓР¶РµРЅ, С‡С‚РѕР±С‹ РїРѕРґРіСЂСѓР·РёС‚СЊ РµРіРѕ Р»РёС‡РЅС‹Рµ СЃС‚РёРєРµСЂ/СЌРјРѕРґР·Рё-РїР°РєРё */
  senderId?: string;
}

// Token в†’ URL for sticker/emoji blocks. Sticker packs come from the bundle
// manifest; user packs come from the sender's profile (fetched on demand).
const STICKER_TOKEN_RE = /\[(sticker|mysticker|myemoji):([^:\]]+):([^:\]]+)\]/g;

let manifestPromise: Promise<Map<string, string>> | null = null;

/** [{pack}.{filename}] в†’ real URL from /stickers/manifest.json (bundle packs). */
function loadStickerManifest(): Promise<Map<string, string>> {
  if (manifestPromise) return manifestPromise;
  manifestPromise = fetch('/stickers/manifest.json')
    .then(r => (r.ok ? r.json() : []))
    .then((packs: Array<{ name: string; stickers: Array<{ filename: string; fileUrl: string }> }>) => {
      const map = new Map<string, string>();
      for (const pack of packs || []) {
        for (const s of pack.stickers || []) {
          if (s?.fileUrl) map.set(`${pack.name}\u0000${s.filename}`, s.fileUrl);
        }
      }
      return map;
    })
    .catch(() => new Map<string, string>())
    .finally(() => {
      // keep resolved value cacheable via manifestCache
    });
  return manifestPromise;
}

const userPacksCache = new Map<string, Promise<Record<string, string>>>();
function loadUserStickerPacks(senderId: string): Promise<Record<string, string>> {
  let p = userPacksCache.get(senderId);
  if (!p) {
    p = api
      .getUserStickerPacks(senderId)
      .then(packs => {
        const map: Record<string, string> = {};
        for (const pack of packs || []) {
          for (const s of pack.stickers || []) {
            if (s.fileUrl && s.id) map[s.id] = s.fileUrl;
          }
        }
        return map;
      })
      .catch(() => ({}));
    userPacksCache.set(senderId, p);
    // Cache busting: drop stale entries after 10 minutes so deletions propagate.
    p.finally(() => setTimeout(() => userPacksCache.delete(senderId), 600_000));
  }
  return p;
}

const USER_STICKER_STYLES = {
  sticker: 'w-40 h-40 max-w-full object-contain m-1',
  emoji: 'w-16 h-16 object-contain m-1',
};

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, isOwn, senderId }: MarkdownRendererProps) {
  const [stickerUrls, setStickerUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    const tokens = Array.from(content.matchAll(STICKER_TOKEN_RE));
    if (tokens.length === 0) {
      setStickerUrls({});
      return;
    }
    (async () => {
      const map: Record<string, string> = {};
      const bundle = await loadStickerManifest();
      let userPacks: Record<string, string> | null = null;
      if (senderId && tokens.some(t => t[1] !== 'sticker')) {
        userPacks = await loadUserStickerPacks(senderId);
      }
      for (const t of tokens) {
        const kind = t[1];
        const key1 = t[2];
        const key2 = t[3];
        let url = '';
        if (kind === 'sticker') {
          url = bundle.get(`${key1}\u0000${key2}`) || `/stickers/proxy/${encodeURIComponent(key2)}`;
        } else if (userPacks) {
          const pack = (userPacks as Record<string, string>);
          url = pack[key2] || '';
        }
        if (url) map[t[0]] = normalizeMediaUrl(url);
      }
      if (!cancelled) setStickerUrls(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [content, senderId]);

  const parsed = useMemo(() => {
    return renderContent(content, isOwn, stickerUrls);
  }, [content, isOwn, stickerUrls]);

  return <>{parsed}</>;
});

function renderContent(content: string, isOwn: boolean | undefined, stickerUrls: Record<string, string>): React.ReactNode {
  if (!content) return null;

  const lines = content.split('\n');
  const hasTable = lines.some(line => line.trim().startsWith('|') && line.trim().endsWith('|'));

  if (hasTable) {
    return <TableAndMarkdownParser content={content} isOwn={isOwn} stickerUrls={stickerUrls} />;
  }

  return <InlineMarkdownParser text={content} isOwn={isOwn} stickerUrls={stickerUrls} />;
}

function renderStickerInline(token: string, stickerUrls: Record<string, string>): React.ReactNode | null {
  const url = stickerUrls[token];
  if (!url) return null;
  const match = token.match(STICKER_TOKEN_RE);
  const kind = match?.[1] || 'sticker';
  const style = kind === 'myemoji' ? USER_STICKER_STYLES.emoji : USER_STICKER_STYLES.sticker;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      draggable={false}
      className={style}
    />
  );
}

function InlineMarkdownParser({ text, isOwn, stickerUrls }: { text: string; isOwn: boolean | undefined; stickerUrls: Record<string, string> }) {
  // Simple inline markdown parsing: code blocks ```, inline code `, bold **, italic *, strikethrough ~~
  const codeBlockRegex = /```([a-z]*)\n?([\s\S]*?)```/g;
  const blocks: React.ReactNode[] = [];
  let lastIdx = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      blocks.push(
        <span key={`text-${lastIdx}`}>
          {parseInlineFormatting(text.substring(lastIdx, match.index), isOwn, stickerUrls)}
        </span>
      );
    }

    const codeContent = match[2];
    blocks.push(
      <div
        key={`code-${match.index}`}
        className="my-1.5 p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-accent/90 overflow-x-auto select-text"
      >
        <pre className="whitespace-pre-wrap break-words">{codeContent}</pre>
      </div>
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    blocks.push(
      <span key={`text-end`}>
        {parseInlineFormatting(text.substring(lastIdx), isOwn, stickerUrls)}
      </span>
    );
  }

  return <div className="leading-relaxed break-words select-text">{blocks}</div>;
}

function parseInlineFormatting(str: string, isOwn: boolean | undefined, stickerUrls: Record<string, string>): React.ReactNode[] {
  // Parse lines for quotes or bullet points first
  const lines = str.split('\n');
  return lines.map((line, lIdx) => {
    let lineContent: React.ReactNode = line;

    if (line.startsWith('> ')) {
      lineContent = (
        <blockquote className="pl-2.5 my-1 border-l-2 border-accent/60 italic text-white/70 bg-white/[0.04] py-0.5 rounded-r-lg">
          {parseInlineStyles(line.slice(2), isOwn, stickerUrls)}
        </blockquote>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      lineContent = (
        <div className="flex items-start gap-1.5 my-0.5 pl-1">
          <span className="text-accent font-bold">вЂў</span>
          <span>{parseInlineStyles(line.slice(2), isOwn, stickerUrls)}</span>
        </div>
      );
    } else {
      lineContent = parseInlineStyles(line, isOwn, stickerUrls);
    }

    return (
      <React.Fragment key={lIdx}>
        {lineContent}
        {lIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function parseInlineStyles(text: string, isOwn: boolean | undefined, stickerUrls: Record<string, string>): React.ReactNode[] {
  // Split inline code `...`
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|~~[^~]+~~)/g);

  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          className="px-1.5 py-0.5 mx-0.5 rounded-md bg-white/[0.1] border border-white/[0.1] font-mono text-[11px] text-amber-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    const stickerNode = renderStickerInline(part, stickerUrls);
    if (stickerNode) return <React.Fragment key={i}>{stickerNode}</React.Fragment>;
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-white">
          {parseAnimatedEmojis(part.slice(2, -2))}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return (
        <em key={i} className="italic opacity-90">
          {parseAnimatedEmojis(part.slice(1, -1))}
        </em>
      );
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return (
        <del key={i} className="line-through opacity-60">
          {parseAnimatedEmojis(part.slice(2, -2))}
        </del>
      );
    }
    return <React.Fragment key={i}>{parseAnimatedEmojis(part)}</React.Fragment>;
  });
}

function TableAndMarkdownParser({ content, isOwn, stickerUrls }: { content: string; isOwn: boolean | undefined; stickerUrls: Record<string, string> }) {
  const lines = content.split('\n');
  const renderedElements: React.ReactNode[] = [];
  let tableRows: string[] = [];

  const flushTable = (key: number) => {
    if (tableRows.length === 0) return;

    // Filter separator row (|---|---|)
    const validRows = tableRows.filter(r => !r.match(/^\|?[\s:-|-]+\|?$/));
    if (validRows.length > 0) {
      const headers = validRows[0]
        .split('|')
        .map(cell => cell.trim())
        .filter(c => c !== '');
      const bodyRows = validRows.slice(1).map(row =>
        row
          .split('|')
          .map(cell => cell.trim())
          .filter((_, idx, arr) => idx > 0 && idx < arr.length - 1 || arr.length <= 2)
      );

      renderedElements.push(
        <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded-xl border border-white/[0.12] liquid-glass-strong p-1 shadow-lg">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-white/[0.08] border-b border-white/[0.1]">
                {headers.map((h, hIdx) => (
                  <th key={hIdx} className="px-3 py-2 font-semibold text-white/90">
                    {parseInlineStyles(h, isOwn, stickerUrls)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((r, rIdx) => (
                <tr key={rIdx} className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                  {r.map((c, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-white/80">
                      {parseInlineStyles(c, isOwn, stickerUrls)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableRows = [];
  };

  lines.forEach((line, index) => {
    if (line.trim().startsWith('|')) {
      tableRows.push(line);
    } else {
      if (tableRows.length > 0) {
        flushTable(index);
      }
      renderedElements.push(<InlineMarkdownParser key={`line-${index}`} text={line} isOwn={isOwn} stickerUrls={stickerUrls} />);
    }
  });

  if (tableRows.length > 0) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{renderedElements}</div>;
}