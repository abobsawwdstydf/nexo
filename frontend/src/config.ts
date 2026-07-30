// Nexo App Configuration — PRODUCTION MODE
// Backend API URL for production: https://neexxoo.hakerone.ru
// Frontend builds on Cloudflare Pages, connects to backend via VITE_API_URL

const CUSTOM_SERVER_KEY = 'nexo_custom_server_url';

let _baseUrlFromConfig: string | null = null;

export function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(CUSTOM_SERVER_KEY);
    if (custom) return custom;
  }

  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl !== '') {
    return envUrl.replace(/\/+$/, '');
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return '';
  }

  return _baseUrlFromConfig || '';
}

export async function loadBaseUrlConfig(): Promise<void> {
  try {
    const res = await fetch('/base-url.json');
    const config = await res.json();
    const url = config.baseUrl || config.productionUrl;
    if (url) {
      _baseUrlFromConfig = url;
    }
  } catch {
    // base-url.json not available — using defaults
  }

  if (typeof window !== 'undefined') {
    try { localStorage.removeItem('nexo_server_url'); } catch { /* ignore */ }
  }
}

export const setServerUrl = (url: string): void => {
  if (typeof window !== 'undefined') {
    if (url) {
      localStorage.setItem(CUSTOM_SERVER_KEY, url);
    } else {
      localStorage.removeItem(CUSTOM_SERVER_KEY);
    }
    window.location.reload();
  }
};

export const getServerUrl = (): string => {
  return getApiUrl();
};

export const APP_CONFIG = {
  name: 'Нексо Мессенджер',
  version: '1.0.0',
  maxFileSize: 25 * 1024 * 1024 * 1024,
  maxFilesPerMessage: 10,
};
