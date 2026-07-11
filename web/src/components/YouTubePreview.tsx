import { useEffect, useState } from 'react';

interface YouTubePreviewProps {
  url: string;
}

// Extract YouTube video ID from various URL formats
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export default function YouTubePreview({ url }: YouTubePreviewProps) {
  const videoId = extractYouTubeId(url);
  const [title, setTitle] = useState<string | null>(null);
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!videoId) {
      setLoading(false);
      return;
    }

    setThumbnail(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);

    // Fetch video title via noembed (free, no API key)
    fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`)
      .then(res => res.json())
      .then(data => {
        if (data.title) setTitle(data.title);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [videoId, url]);

  if (!videoId) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block mt-2 rounded-xl overflow-hidden bg-zinc-800/50 border border-white/5 hover:border-white/10 transition-colors group"
    >
      {/* Thumbnail */}
      <div className="relative aspect-video bg-zinc-900">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-600">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        {/* YouTube play overlay */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
          <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center shadow-lg">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-4 h-4 rounded bg-red-600 flex items-center justify-center flex-shrink-0">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
          <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">YouTube</span>
        </div>
        {loading ? (
          <div className="h-4 bg-white/5 rounded animate-pulse" />
        ) : title ? (
          <p className="text-sm text-zinc-200 line-clamp-2 leading-snug">{title}</p>
        ) : (
          <p className="text-xs text-zinc-500 truncate">{url}</p>
        )}
      </div>
    </a>
  );
}
