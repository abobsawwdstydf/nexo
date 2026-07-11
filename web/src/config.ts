// Nexo App Configuration
// In production (same origin), use relative URLs
// In development, use localhost

let _baseUrlFromConfig: string | null = null;

const getStoredServerUrl = (): string => {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('nexo_server_url');
    if (stored) return stored;
  }
  return import.meta.env.VITE_API_URL || '';
};

/**
 * Returns the base URL for API calls (without /api suffix).
 * - For web (via Vite or same origin): empty string (same origin)
 * - For mobile/desktop apps: full URL from base-url.json
 */
export function getApiUrl(): string {
  // В браузере на localhost ВСЕГДА используем относительный путь для работы через Vite Proxy
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '';
  }

  // Для остальных случаев (мобилки, продакшен) берем из конфига или localStorage
  const fromConfig = _baseUrlFromConfig;
  if (fromConfig) return fromConfig;
  return getStoredServerUrl();
}

/**
 * Loads base-url.json and sets the API URL from it.
 * Should be called early in app startup.
 */
export async function loadBaseUrlConfig(): Promise<void> {
  try {
    const res = await fetch('/base-url.json');
    const config = await res.json();
    const url = config.baseUrl || config.productionUrl;
    if (url) {
      _baseUrlFromConfig = url;
      localStorage.setItem('nexo_server_url', url);
    }
  } catch {
    // base-url.json not found, use defaults
  }
}

export const setServerUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('nexo_server_url', url);
    window.location.reload();
  }
};

export const getServerUrl = (): string => {
  return getApiUrl();
};

export const SOCKET_CONFIG = {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
};

export const APP_CONFIG = {
  name: 'Нексо Мессенджер',
  version: '1.0.0',
  maxFileSize: 25 * 1024 * 1024 * 1024,
  maxFilesPerMessage: 10,
};
