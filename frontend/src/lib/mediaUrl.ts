import { getApiUrl } from '../config';

/**
 * Нормализует медиа URL.
 * Если URL относительный (начинается с /) — добавляет API_URL.
 * Если уже полный (http/https) или data URI — возвращает как есть.
 */
const STICKER_CDN = 'https://stickers.darkheavens.ru/';

export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
  // Стикеры с внешнего CDN недоступны части пользователей (домен блокируется
  // сетями). Проксируем их через бэкенд /stickers/proxy/:name, который кэширует
  // файлы и отдаёт с рабочего API-домена.
  if (url.startsWith(STICKER_CDN)) {
    const name = url.slice(STICKER_CDN.length);
    const apiUrl = getApiUrl();
    const base = apiUrl ? apiUrl.replace(/\/$/, '') : '';
    return `${base}/stickers/proxy/${encodeURIComponent(name)}`;
  }
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  
  // Преобразуем старые пути /uploads/files/ в новые /api/files/
  let path = url.startsWith('/') ? url : `/${url}`;
  if (path.startsWith('/uploads/files/')) {
    const fileId = path.replace('/uploads/files/', '');
    path = `/api/files/${fileId}/download`;
  }
  
  // Если это local_ файл без /api/files/, добавляем правильный путь
  if (path.includes('local_') && !path.startsWith('/api/files/')) {
    const fileId = path.replace(/^\//, ''); // Убираем начальный /
    path = `/api/files/${fileId}/download`;
  }
  
  // Относительный путь — добавляем API_URL или оставляем как есть (same origin)
  const apiUrl = getApiUrl();
  const base = apiUrl ? apiUrl.replace(/\/$/, '') : '';

  // /uploads/* файлы теперь защищены токеном доступа на сервере —
  // подставляем его в query, чтобы медиа продолжали загружаться
  if (path.startsWith('/uploads/')) {
    try {
      const token = localStorage.getItem('nexo_access_token');
      if (token) {
        path += (path.includes('?') ? '&' : '?') + 'token=' + encodeURIComponent(token);
      }
    } catch { /* localStorage not available */ }
  }

  return `${base}${path}`;
}
