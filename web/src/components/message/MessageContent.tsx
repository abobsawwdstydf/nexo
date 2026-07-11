import { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, Clock, Eye, MapPin, BarChart3, Loader2, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useChatStore } from '../../stores/chatStore';
import { getSocket } from '../../lib/socket';
import { useLang } from '../../lib/i18n';
import { normalizeMediaUrl } from '../../lib/mediaUrl';
import { api } from '../../lib/api';
import { hasAnimatedEmoji, getAnimatedEmojiUrl } from '../../lib/animatedEmojis';
import CodeBlock from '../CodeBlock';
import LaTeXRenderer, { parseLatex } from '../LaTeXRenderer';
import LinkPreview from '../LinkPreview';
import YouTubePreview from '../YouTubePreview';
import LinkEmbedPreview from '../LinkEmbedPreview';
import PlaylistEmbedPreview from '../PlaylistEmbedPreview';
import type { Message } from '../../lib/types';

interface MessageContentProps {
  message: Message;
  isMine: boolean;
  timeStr: string;
  isRead: boolean;
  isChannel: boolean;
  tags: string[];
  onOpenContextMenu: (e: React.MouseEvent) => void;
  onReply: () => void;
}

// ─── Poll Renderer ──────────────────────────────────────────────────────

function PollRenderer({ message, isMine }: { message: Message; isMine: boolean }) {
  const { user } = useAuthStore();
  const { messages } = useChatStore();
  const [userVote, setUserVote] = useState<number | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<number, number>>({});

  useEffect(() => {
    const chatMessages = messages[message.chatId] || [];
    const currentMsg = chatMessages.find(m => m.id === message.id);
    const pollVotes = (currentMsg as any)?.pollVotes || [];
    const counts: Record<number, number> = {};
    let myVote: number | null = null;
    pollVotes.forEach((v: any) => {
      counts[v.optionIndex] = (counts[v.optionIndex] || 0) + 1;
      if (v.userId === user?.id) myVote = v.optionIndex;
    });
    setVoteCounts(counts);
    setUserVote(myVote);
  }, [message.id, message.chatId, messages, user?.id]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    const handlePollUpdate = (data: {
      messageId: string;
      voteCounts: Record<number, number>;
      hasVoted: boolean;
      userId: string;
      optionIndex: number;
      removed?: boolean;
    }) => {
      if (data.messageId !== message.id) return;
      setVoteCounts(data.voteCounts);
      if (data.userId === user?.id) {
        setUserVote(data.removed ? null : data.optionIndex);
      }
    };
    socket.on('poll_updated', handlePollUpdate);
    return () => { socket.off('poll_updated', handlePollUpdate); };
  }, [message.id, user?.id]);

  const isPoll = message.type === 'poll' || (message.content && message.content.startsWith('{"question"'));
  if (!isPoll || !message.content) return null;

  let poll: { question: string; options: string[]; multiple?: boolean; quiz?: boolean; correctAnswer?: number };
  try {
    poll = JSON.parse(message.content);
    if (!poll.question || !Array.isArray(poll.options)) return null;
  } catch { return null; }

  const totalVotes = Object.values(voteCounts).reduce((sum, c) => sum + c, 0);
  const hasVoted = userVote !== null || totalVotes > 0;

  const handleVote = (optionIndex: number) => {
    if (userVote === optionIndex && !poll.multiple) return;
    const socket = getSocket();
    if (!socket) return;
    if (userVote !== null && !poll.multiple) {
      socket.emit('unvote_poll', { messageId: message.id, chatId: message.chatId, optionIndex: userVote });
      setTimeout(() => {
        socket.emit('vote_poll', { messageId: message.id, chatId: message.chatId, optionIndex });
      }, 50);
    } else {
      socket.emit('vote_poll', { messageId: message.id, chatId: message.chatId, optionIndex });
    }
  };

  return (
    <div className="min-w-[280px] max-w-[340px]">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className={isMine ? 'text-white/60' : 'text-nexo-400'} />
        <span className="text-xs font-medium opacity-60">
          {poll.quiz ? 'Викторина' : 'Опрос'}
        </span>
        {totalVotes > 0 && (
          <span className="text-xs opacity-50">
            {totalVotes} {totalVotes === 1 ? 'голос' : totalVotes < 5 ? 'голоса' : 'голосов'}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold mb-3 leading-snug">{poll.question}</p>
      <div className="space-y-2">
        {poll.options.map((option: string, i: number) => {
          const optionVotes = voteCounts[i] || 0;
          const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
          const isCorrect = poll.quiz && poll.correctAnswer === i;
          const isMyVote = userVote === i;
          return (
            <button
              key={i}
              disabled={hasVoted && !poll.multiple}
              onClick={() => handleVote(i)}
              className={`relative w-full px-3 py-2.5 rounded-xl text-sm transition-all duration-300 ${
                hasVoted && !poll.multiple
                  ? isMine ? 'bg-white/10 cursor-default' : 'bg-nexo-500/10 cursor-default'
                  : isMine
                    ? 'bg-white/15 hover:bg-white/25 active:scale-[0.98] cursor-pointer'
                    : 'bg-nexo-500/15 hover:bg-nexo-500/25 active:scale-[0.98] cursor-pointer'
              }`}
            >
              {hasVoted && (
                <div
                  className={`absolute inset-0 rounded-xl transition-all duration-500 ease-out ${
                    isCorrect
                      ? 'bg-emerald-500/30'
                      : isMyVote
                        ? isMine ? 'bg-white/40' : 'bg-nexo-500/50'
                        : isMine ? 'bg-white/20' : 'bg-nexo-500/30'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {hasVoted && isMyVote && <span className="text-nexo-400 text-xs flex-shrink-0">✓</span>}
                  {isCorrect && hasVoted && <span className="text-emerald-400 text-xs flex-shrink-0">✓</span>}
                  <span className="flex-1 truncate text-left">{option}</span>
                </div>
                {hasVoted && (
                  <span className="text-xs font-medium opacity-80 flex-shrink-0 tabular-nums">
                    {percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {poll.multiple && (
        <div className="mt-2 text-xs opacity-50 flex items-center gap-1">
          <span>Можно выбрать несколько</span>
        </div>
      )}
      {!hasVoted && (
        <div className="mt-2 text-xs opacity-40 text-center">Выберите вариант</div>
      )}
    </div>
  );
}

// ─── Markdown rendering helpers ─────────────────────────────────────────

// Emoji regex that matches most Unicode emojis
const EMOJI_REGEX = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|\p{Emoji_Component}|\u200d\u20e3|[\u2600-\u27BF]|[\uD83C-\uDBFF][\uDC00-\uDFFF])/gu;

function renderTextWithAnimatedEmojis(text: string, baseKey: string): React.ReactNode {
  const parts = text.split(EMOJI_REGEX);
  if (parts.length <= 1) return text;
  return parts.map((part, i) => {
    const url = getAnimatedEmojiUrl(part);
    if (url) {
      return (
        <img
          key={`${baseKey}-emoji-${i}`}
          src={url}
          alt={part}
          className="inline-block w-[1.2em] h-[1.2em] object-contain align-middle mx-px"
          style={{ imageRendering: 'auto' }}
          loading="lazy"
          draggable={false}
        />
      );
    }
    return part;
  });
}

function processTextForUrlsAndMarkdown(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s<]+)/gi;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(
      <a key={`url-${match.index}`} href={match[0]} target="_blank" rel="noopener noreferrer"
        className="text-sky-400 hover:text-sky-300 hover:underline cursor-pointer break-all" onClick={(e) => e.stopPropagation()}>
        {match[0]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  if (parts.length === 0) return renderTextWithAnimatedEmojis(text, 'full');

  return parts.map((part, i) => {
    if (typeof part === 'string') {
      const tokens = part.split(/(\*\*[\s\S]*?\*\*|\*[\s\S]*?\*|_[\s\S]*?_|~[\s\S]*?~|`[\s\S]*?`|@\w+)/g);
      return tokens.map((t, j) => {
        const key = `${i}-${j}`;
        if (t.startsWith('**') && t.endsWith('**')) return <strong key={key}>{renderTextWithAnimatedEmojis(t.slice(2, -2), `${key}-b`)}</strong>;
        if ((t.startsWith('_') && t.endsWith('_')) || (t.startsWith('*') && t.endsWith('*'))) return <em key={key}>{renderTextWithAnimatedEmojis(t.slice(1, -1), `${key}-i`)}</em>;
        if (t.startsWith('~') && t.endsWith('~')) return <del key={key}>{renderTextWithAnimatedEmojis(t.slice(1, -1), `${key}-d`)}</del>;
        if (t.startsWith('`') && t.endsWith('`')) return <code key={key} className="font-mono text-[13px] bg-black/20 px-1 py-0.5 rounded">{t.slice(1, -1)}</code>;
        if (t.startsWith('@') && t.length > 1) {
          const mentionUsername = t.slice(1);
          return (
            <span key={key} className="font-semibold text-sky-300 cursor-pointer hover:underline"
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const channels = await api.searchChannels(mentionUsername);
                  const channel = channels.find(c => c.username === mentionUsername);
                  if (channel) { window.dispatchEvent(new CustomEvent('open-channel-by-username', { detail: { channel } })); return; }
                  const users = await api.searchUsers(mentionUsername);
                  const user = users.find(u => u.username === mentionUsername);
                  if (user) window.dispatchEvent(new CustomEvent('open-chat-by-username', { detail: { user } }));
                } catch (err) { console.error('Failed to open mention:', err); }
              }}>{t}</span>
          );
        }
        return <span key={key}>{renderTextWithAnimatedEmojis(t, `${key}-t`)}</span>;
      });
    }
    return part;
  });
}

function renderInlineMarkdownText(text: string): React.ReactNode {
  const stickerRegex = /\[sticker:([^:]+):([^\]]+)\]/g;
  const stickerParts: React.ReactNode[] = [];
  let lastStickerIndex = 0;
  let stickerMatch;

  while ((stickerMatch = stickerRegex.exec(text)) !== null) {
    if (stickerMatch.index > lastStickerIndex) {
      stickerParts.push(text.slice(lastStickerIndex, stickerMatch.index));
    }
    stickerParts.push(
      <img
        key={`sticker-${stickerMatch.index}`}
        src={stickerMatch[2]}
        alt="sticker"
        className="inline-block w-6 h-6 object-contain align-middle mx-0.5 rounded"
        loading="lazy"
      />
    );
    lastStickerIndex = stickerMatch.index + stickerMatch[0].length;
  }
  if (lastStickerIndex < text.length) {
    stickerParts.push(text.slice(lastStickerIndex));
  }
  if (stickerParts.length > 1) {
    return stickerParts.map((part, idx) => {
      if (typeof part === 'string') {
        return <span key={`sp-${idx}`}>{processTextForUrlsAndMarkdown(part)}</span>;
      }
      return part;
    });
  }
  return processTextForUrlsAndMarkdown(text);
}

function renderInlineMarkdown(text: string): React.ReactNode {
  const latexParts = parseLatex(text);
  if (latexParts.some(p => p.type !== 'text')) {
    return latexParts.map((part, i) => {
      if (part.type === 'latex-block') return <LaTeXRenderer key={i} formula={part.content} display />;
      if (part.type === 'latex-inline') return <LaTeXRenderer key={i} formula={part.content} />;
      return <span key={i}>{renderInlineMarkdownText(part.content)}</span>;
    });
  }
  return renderInlineMarkdownText(text);
}

function renderFormattedText(text: string): React.ReactNode {
  if (!text) return text;
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  const segments: React.ReactNode[] = [];
  let lastIdx = 0;
  let cbMatch;
  let hasCodeBlocks = false;
  const tempText = text;
  while ((cbMatch = codeBlockRegex.exec(tempText)) !== null) {
    hasCodeBlocks = true;
    if (cbMatch.index > lastIdx) {
      segments.push(renderInlineMarkdown(tempText.slice(lastIdx, cbMatch.index)));
    }
    const lang = cbMatch[1] || '';
    const code = cbMatch[2].trimEnd();
    segments.push(<CodeBlock key={`cb-${cbMatch.index}`} language={lang} code={code} />);
    lastIdx = cbMatch.index + cbMatch[0].length;
  }
  if (hasCodeBlocks) {
    if (lastIdx < text.length) segments.push(renderInlineMarkdown(text.slice(lastIdx)));
    return segments;
  }
  return renderInlineMarkdown(text);
}

// ─── Rich Block Rendering ────────────────────────────────────────────────

function RichText({ text }: { text: string }): React.ReactNode {
  return <>{processTextForUrlsAndMarkdown(text)}</>;
}

function renderTable(rows: string[][]): React.ReactNode {
  if (rows.length === 0) return null;
  const header = rows[0];
  const body = rows.slice(1);
  const isSeparator = (row: string[]) => row.every(c => /^\s*:?-{2,}:?\s*$/.test(c));
  const startIdx = body.length > 0 && isSeparator(body[0]) ? 1 : 0;
  const dataRows = body.slice(startIdx);

  return (
    <div className="overflow-x-auto my-2 -mx-1 px-1">
      <table className="border-collapse text-xs w-full rounded-xl overflow-hidden shadow-lg shadow-black/20">
        <thead>
          <tr className="bg-gradient-to-r from-nexo-600/30 to-nexo-500/20">
            {header.map((cell, i) => (
              <th key={i} className={`px-3 py-2 font-semibold text-left text-white/90 border-b border-white/10 ${i === 0 ? 'rounded-tl-xl' : ''} ${i === header.length - 1 ? 'rounded-tr-xl' : ''}`}>
                <RichText text={cell.trim()} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} className={`${ri % 2 === 0 ? 'bg-white/[0.03]' : 'bg-white/[0.06]'} hover:bg-white/[0.08] transition-colors`}>
              {header.map((_, ci) => (
                <td key={ci} className="px-3 py-2 border-b border-white/[0.06] text-white/80">
                  <RichText text={(row[ci] || '').trim()} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlockquote(lines: string[]): React.ReactNode {
  return (
    <div className="border-l-2 border-nexo-500/60 pl-3 my-1 py-0.5 text-sm opacity-80 italic">
      {lines.map((line, i) => (
        <div key={i}>
          <RichText text={line.replace(/^>\s?/, '')} />
        </div>
      ))}
    </div>
  );
}

function renderList(lines: string[], ordered: boolean): React.ReactNode {
  const items = lines.map(l => l.replace(/^(\d+\.\s?|[-*+]\s?)/, '').trim());
  const Tag = ordered ? 'ol' : 'ul';
  return (
    <Tag className={`my-1 pl-4 space-y-0.5 text-sm ${ordered ? 'list-decimal' : 'list-disc'}`}>
      {items.map((item, i) => (
        <li key={i} className="pl-1"><RichText text={item} /></li>
      ))}
    </Tag>
  );
}

function renderRichBlocks(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Horizontal rule: ---, ***, ___
    if (/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(line)) {
      blocks.push(<hr key={`hr-${i}`} className="border-white/10 my-2" />);
      i++;
      continue;
    }

    // Headings: # H1, ## H2, ### H3, etc.
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const sizes = ['text-xl font-bold', 'text-lg font-bold', 'text-base font-semibold', 'text-sm font-semibold', 'text-xs font-semibold', 'text-xs font-semibold'];
      blocks.push(
        <div key={`h-${i}`} className={`mt-2 mb-1 ${sizes[level - 1]}`}>
          <RichText text={headingMatch[2]} />
        </div>
      );
      i++;
      continue;
    }

    // Blockquote: > line
    if (/^\s{0,3}>/.test(line)) {
      const quoteLines: string[] = [];
      while (i < lines.length && /^\s{0,3}>/.test(lines[i])) {
        quoteLines.push(lines[i]);
        i++;
      }
      blocks.push(<div key={`bq-${blocks.length}`}>{renderBlockquote(quoteLines)}</div>);
      continue;
    }

    // Table: | col | col |
    if (/^\s{0,3}\|/.test(line)) {
      const tableRows: string[][] = [];
      while (i < lines.length && /^\s{0,3}\|/.test(lines[i])) {
        const row = lines[i].replace(/^\s{0,3}\|/, '').replace(/\|\s{0,3}$/, '').split('|');
        tableRows.push(row);
        i++;
      }
      blocks.push(<div key={`tbl-${blocks.length}`}>{renderTable(tableRows)}</div>);
      continue;
    }

    // Unordered list: - item, * item, + item
    if (/^\s{0,3}[-*+]\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\s{0,3}[-*+]\s/.test(lines[i])) {
        listLines.push(lines[i]);
        i++;
      }
      blocks.push(<div key={`ul-${blocks.length}`}>{renderList(listLines, false)}</div>);
      continue;
    }

    // Ordered list: 1. item, 2. item
    if (/^\s{0,3}\d+\.\s/.test(line)) {
      const listLines: string[] = [];
      while (i < lines.length && /^\s{0,3}\d+\.\s/.test(lines[i])) {
        listLines.push(lines[i]);
        i++;
      }
      blocks.push(<div key={`ol-${blocks.length}`}>{renderList(listLines, true)}</div>);
      continue;
    }

    // Empty line — skip
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Normal text paragraph — collect consecutive non-special lines
    const textLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^\s{0,3}#{1,6}\s/.test(lines[i]) &&
      !/^\s{0,3}>/.test(lines[i]) &&
      !/^\s{0,3}\|/.test(lines[i]) &&
      !/^\s{0,3}[-*+]\s/.test(lines[i]) &&
      !/^\s{0,3}\d+\.\s/.test(lines[i]) &&
      !/^\s{0,3}([-*_])\s*(?:\1\s*){2,}$/.test(lines[i])
    ) {
      textLines.push(lines[i]);
      i++;
    }
    if (textLines.length > 0) {
      blocks.push(
        <p key={`p-${blocks.length}`} className="whitespace-pre-wrap break-all word-break my-0.5">
          {renderFormattedText(textLines.join('\n'))}
        </p>
      );
    }
  }

  return blocks;
}

// ─── Main component ─────────────────────────────────────────────────────

export default function MessageContent({
  message,
  isMine,
  timeStr,
  isRead,
  isChannel,
  tags,
  onOpenContextMenu,
  onReply,
}: MessageContentProps) {
  const { t } = useLang();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showCollapse, setShowCollapse] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (contentRef.current) {
      const height = contentRef.current.scrollHeight;
      setShowCollapse(height > 300);
      if (height > 300) setIsCollapsed(true);
    }
  }, [message.content]);

  if (!message.content || message.type === 'poll' || message.type === 'location' || message.type === 'voice' || message.type === 'call' || message.type === 'sticker') {
    return null;
  }

  // Location rendering
  if (message.type === 'location') {
    return null; // handled in parent
  }

  const hasRichBlocks = message.content && (
    /^\s{0,3}(#{1,6}\s|>\s|\||[-*+]\s|\d+\.\s|([-*_])\1{2,})/m.test(message.content)
  );

  return (
    <>
      <div ref={contentRef} className="flex items-end gap-2">
        <div className={`text-sm flex-1 leading-relaxed overflow-hidden ${isCollapsed ? 'max-h-[300px]' : ''}`}>
          {hasRichBlocks ? (
            <div className="space-y-0.5">
              {renderRichBlocks(message.content)}
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-all word-break">
              {renderFormattedText(message.content)}
            </p>
          )}
        </div>
        {showCollapse && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="text-[10px] text-nexo-400 hover:text-nexo-300 transition-colors flex-shrink-0 self-end"
          >
            {isCollapsed ? '▼' : '▲'}
          </button>
        )}
        <span className={`text-[10px] flex-shrink-0 flex items-center gap-0.5 self-end select-none ${isMine ? 'text-white/50' : 'text-zinc-500'}`}>
          {message.isEdited && <span>{t('edited')}</span>}
          {message.scheduledAt && <Clock size={11} className="text-amber-400 mr-0.5" />}
          {timeStr}
          {!message.scheduledAt && (
            (message as any)._isFailed ? (
              <span className="flex items-center gap-0.5 ml-0.5">
                <AlertCircle size={12} className="text-red-400" />
              </span>
            ) : (message as any)._isSending ? (
              <span className="flex items-center gap-0.5 ml-0.5">
                <Loader2 size={12} className="text-white/40 animate-spin" />
              </span>
            ) : isChannel ? (
              <span className="flex items-center gap-1 ml-0.5 text-xs">
                <Eye size={11} className="text-zinc-400" />
                {message.viewCount || 0}
              </span>
            ) : isMine && isRead ? (
              <CheckCheck size={13} className="text-sky-300 ml-0.5" />
            ) : isMine ? (
              <Check size={13} className="ml-0.5" />
            ) : null
          )}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenContextMenu(e);
          }}
          className={`flex-shrink-0 self-end p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-white/10 transition-all ${isMine ? 'text-white/50 hover:text-white' : 'text-zinc-500 hover:text-white'}`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
      </div>

      {/* Message tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {tags.map(tag => (
            <span key={tag} className="px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[9px] font-medium">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Link Previews for all URLs */}
      {(() => {
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = message.content.match(urlRegex);
        if (urls && urls.length > 0) {
          const ytPattern = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)/;
          const nonYtUrls = urls.filter(url => !ytPattern.test(url));
          if (nonYtUrls.length > 0) {
            return (
              <div className="space-y-2 mt-2">
                {Array.from(new Set(nonYtUrls)).slice(0, 3).map((url, i) => (
                  <LinkPreview key={i} url={url} />
                ))}
              </div>
            );
          }
        }
        return null;
      })()}

      {/* YouTube Preview */}
      {isChannel && (() => {
        const ytPattern = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/g;
        const ytUrls = message.content.match(ytPattern);
        if (ytUrls && ytUrls.length > 0) {
          return (
            <>
              {Array.from(new Set(ytUrls)).map((url, i) => (
                <YouTubePreview key={i} url={url} />
              ))}
            </>
          );
        }
        return null;
      })()}

      {/* Link Embed Preview for channels */}
      {isChannel && <LinkEmbedPreview content={message.content} />}

      {/* Playlist Embed Preview */}
      {(() => {
        const playlistPattern = /(?:https?:\/\/)?(?:www\.)?[^\/\s]+\/\?playlist=([a-zA-Z0-9_-]+)/g;
        const matches = [...message.content.matchAll(playlistPattern)];
        if (matches.length > 0) {
          return (
            <>
              {matches.map((match, i) => (
                <PlaylistEmbedPreview key={i} playlistId={match[1]} />
              ))}
            </>
          );
        }
        return null;
      })()}

      {/* Time for media without text */}
    </>
  );
}

export { PollRenderer, renderFormattedText };
