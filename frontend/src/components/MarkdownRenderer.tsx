import React, { memo } from 'react';
import { parseAnimatedEmojis } from './AnimatedEmoji';

interface MarkdownRendererProps {
  content: string;
  isOwn?: boolean;
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content, isOwn }: MarkdownRendererProps) {
  if (!content) return null;

  // Check if content contains a Markdown Table: lines starting and ending with | or containing |
  const lines = content.split('\n');
  const hasTable = lines.some(line => line.trim().startsWith('|') && line.trim().endsWith('|'));

  if (hasTable) {
    return <TableAndMarkdownParser content={content} isOwn={isOwn} />;
  }

  return <InlineMarkdownParser text={content} isOwn={isOwn} />;
});

function InlineMarkdownParser({ text, isOwn }: { text: string; isOwn?: boolean }) {
  // Simple inline markdown parsing: code blocks ```, inline code `, bold **, italic *, strikethrough ~~
  const codeBlockRegex = /```([a-z]*)\n?([\s\S]*?)```/g;
  const blocks: React.ReactNode[] = [];
  let lastIdx = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      blocks.push(
        <span key={`text-${lastIdx}`}>
          {parseInlineFormatting(text.substring(lastIdx, match.index), isOwn)}
        </span>
      );
    }

    const codeContent = match[2];
    blocks.push(
      <div
        key={`code-${match.index}`}
        className="my-1.5 p-3 rounded-xl bg-black/40 border border-white/10 font-mono text-xs text-blue-200 overflow-x-auto select-text"
      >
        <pre className="whitespace-pre-wrap break-words">{codeContent}</pre>
      </div>
    );
    lastIdx = match.index + match[0].length;
  }

  if (lastIdx < text.length) {
    blocks.push(
      <span key={`text-end`}>
        {parseInlineFormatting(text.substring(lastIdx), isOwn)}
      </span>
    );
  }

  return <div className="leading-relaxed break-words select-text">{blocks}</div>;
}

function parseInlineFormatting(str: string, isOwn?: boolean): React.ReactNode[] {
  // Parse lines for quotes or bullet points first
  const lines = str.split('\n');
  return lines.map((line, lIdx) => {
    let lineContent: React.ReactNode = line;

    if (line.startsWith('> ')) {
      lineContent = (
        <blockquote className="pl-2.5 my-1 border-l-2 border-accent/60 italic text-white/70 bg-white/[0.04] py-0.5 rounded-r-lg">
          {parseInlineStyles(line.slice(2))}
        </blockquote>
      );
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      lineContent = (
        <div className="flex items-start gap-1.5 my-0.5 pl-1">
          <span className="text-accent font-bold">•</span>
          <span>{parseInlineStyles(line.slice(2))}</span>
        </div>
      );
    } else {
      lineContent = parseInlineStyles(line);
    }

    return (
      <React.Fragment key={lIdx}>
        {lineContent}
        {lIdx < lines.length - 1 && <br />}
      </React.Fragment>
    );
  });
}

function parseInlineStyles(text: string): React.ReactNode[] {
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

function TableAndMarkdownParser({ content, isOwn }: { content: string; isOwn?: boolean }) {
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
                    {parseInlineStyles(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bodyRows.map((r, rIdx) => (
                <tr key={rIdx} className="border-b border-white/[0.04] hover:bg-white/[0.04] transition-colors">
                  {r.map((c, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-white/80">
                      {parseInlineStyles(c)}
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
      renderedElements.push(<InlineMarkdownParser key={`line-${index}`} text={line} isOwn={isOwn} />);
    }
  });

  if (tableRows.length > 0) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{renderedElements}</div>;
}
