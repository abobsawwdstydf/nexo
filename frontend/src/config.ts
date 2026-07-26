// Nexo App Configuration
//
// HOW API URL IS RESOLVED:
// 1. Manual override via setServerUrl() → uses custom URL (highest priority)
// 2. VITE_API_URL env var → used for production builds on separate domains
// 3. Browser on ANY host → same origin (empty string = relative /api)
// 4. Mobile/Electron (non-browser) → base-url.json
//
// For Cloudflare Pages deployment, set VITE_API_URL=https://neexoobeec.hakerone.ru
// For local dev, leave VITE_API_URL unset (defaults to same-origin).

const CUSTOM_SERVER_KEY = 'nexo_custom_server_url';

let _baseUrlFromConfig: string | null = null;

/**
 * Returns the base URL for API calls (without /api suffix).
 *
 * Priority: localStorage override > VITE_API_URL env > same origin > base-url.json
 */
export function getApiUrl(): string {
  // 1. Manual override (set by user in settings)
  if (typeof window !== 'undefined') {
    const custom = localStorage.getItem(CUSTOM_SERVER_KEY);
    if (custom) return custom;

    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return '';
    }
  }

  // 2. VITE_API_URL env var — for production on separate domain
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl !== '') {
    return envUrl.replace(/\/+$/, '');
  }

  // 3. Browser → same origin
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return '';
  }

  // 4. Non-browser (mobile/electron) → from base-url.json
  return _baseUrlFromConfig || '';
}

/**
 * Loads base-url.json.
 * In non-browser builds, stores the URL for getApiUrl() to use.
 * In browsers, this is a no-op (same origin is always used).
 */
export async function loadBaseUrlConfig(): Promise<void> {
  try {
    const res = await fetch('/base-url.json');
    const config = await res.json();
    const url = config.baseUrl || config.productionUrl;
    if (url) {
      _baseUrlFromConfig = url;
    }
  } catch {
    // base-url.json not found, use defaults
  }

  // Cleanup: remove old poisoned localStorage key from previous versions
  // (it was auto-persisted by base-url.json, causing requests to go to cloudpub.ru
  // even when browsing from a LAN IP)
  if (typeof window !== 'undefined') {
    try { localStorage.removeItem('nexo_server_url'); } catch {}
  }
}

/**
 * Manually set a custom server URL. Only use this when user explicitly
 * wants to connect to a different server (e.g. from settings).
 */
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
