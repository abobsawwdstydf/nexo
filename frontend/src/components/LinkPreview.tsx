import { useState, useEffect } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { api } from '../lib/api';

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

interface LinkPreviewProps {
  url: string;
}

export default function LinkPreview({ url }: LinkPreviewProps) {
  const [preview, setPreview] = useState<LinkPreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    loadPreview();
  }, [url]);

  const loadPreview = async () => {
    try {
      setLoading(true);
      setError(false);
      const data = await api.get<LinkPreviewData>(`/link-preview?url=${encodeURIComponent(url)}`);
      setPreview(data);
    } catch (e) {
      console.error('Failed to load link preview:', e);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-tertiary/50 border border-white/5">
        <Loader2 size={14} className="animate-spin text-zinc-500" />
        <span className="text-xs text-zinc-500">Загрузка превью...</span>
      </div>
    );
  }

  if (error || !preview) {
    return null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group block mt-2 rounded-xl overflow-hidden border border-white/10 hover:border-nexo-500/30 bg-surface-tertiary/50 hover:bg-surface-tertiary transition-all"
      onClick={e => e.stopPropagation()}
    >
      {/* Image */}
      {preview.image && (
        <div className="relative w-full aspect-video bg-surface-secondary overflow-hidden">
          <img
            src={preview.image}
            alt=""
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        {/* Site name */}
        {preview.siteName && (
          <p className="text-xs text-nexo-400 font-medium mb-1 flex items-center gap-1.5">
            <ExternalLink size={10} />
            {preview.siteName}
          </p>
        )}

        {/* Title */}
        {preview.title && (
          <h4 className="text-sm font-semibold text-white mb-1 line-clamp-2 group-hover:text-nexo-300 transition-colors">
            {preview.title}
          </h4>
        )}

        {/* Description */}
        {preview.description && (
          <p className="text-xs text-zinc-500 line-clamp-2">
            {preview.description}
          </p>
        )}

        {/* URL */}
        <p className="text-xs text-zinc-600 mt-2 truncate">
          {new URL(url).hostname}
        </p>
      </div>
    </a>
  );
}
