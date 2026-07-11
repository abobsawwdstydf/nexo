import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ExternalLink, Globe } from 'lucide-react';

interface LinkEmbedPreviewProps {
  content: string;
}

/**
 * Извлекает URL из текста сообщения
 */
function extractUrls(text: string): string[] {
  const urlPattern = /https?:\/\/[^\s<]+[^<.,:;")'\]\s]/g;
  return text.match(urlPattern) || [];
}

/**
 * Получит домен из URL для отображения
 */
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Embed preview для ссылок в каналах
 * Показывает первую ссылку в сообщении с иконкой и доменом
 */
export default function LinkEmbedPreview({ content }: LinkEmbedPreviewProps) {
  const [hovered, setHovered] = useState(false);
  const urls = extractUrls(content);

  // Пропускаем YouTube ссылки - они обрабатываются отдельно
  const nonYoutubeUrls = urls.filter(url =>
    !url.includes('youtube.com') && !url.includes('youtu.be')
  );

  if (nonYoutubeUrls.length === 0) return null;

  // Показываем только первую ссылку
  const url = nonYoutubeUrls[0];
  const domain = getDomain(url);

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="block mt-2 rounded-xl glass-subtle overflow-hidden group cursor-pointer"
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Иконка сайта */}
        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
          <img
            src={`https://www.google.com/s2/favicons?domain=${domain}&sz=64`}
            alt=""
            className="w-5 h-5 object-contain"
            onError={(e) => {
              // Если favicon не загрузился, показываем Globe
              (e.target as HTMLImageElement).style.display = 'none';
              const parent = (e.target as HTMLImageElement).parentElement;
              if (parent && !parent.querySelector('svg')) {
                parent.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-zinc-500"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>';
              }
            }}
          />
        </div>

        {/* Информация о ссылке */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-white/90 truncate">
            {domain}
          </p>
          <p className="text-[10px] text-zinc-500 truncate">
            {url.length > 50 ? url.slice(0, 50) + '...' : url}
          </p>
        </div>

        {/* Иконка внешней ссылки */}
        <ExternalLink
          size={14}
          className={`flex-shrink-0 transition-all duration-200 ${
            hovered ? 'text-nexo-400 translate-x-0.5' : 'text-zinc-600'
          }`}
        />
      </div>
    </motion.a>
  );
}
