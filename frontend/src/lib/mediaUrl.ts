import { getApiUrl } from '../config';

/**
 * Нормализует медиа URL.
 * Если URL относительный (начинается с /) — добавляет API_URL.
 * Если уже полный (http/https) или data URI — возвращает как есть.
 */
export function normalizeMediaUrl(url: string | null | undefined): string {
  if (!url) return '';
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
  return `${base}${path}`;
}
