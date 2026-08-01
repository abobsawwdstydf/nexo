import { getApiUrl } from '../config';

declare const __APP_VERSION__: string | undefined;
declare const __GIT_COMMIT__: string | undefined;
declare const __BUILD_TIME__: string | undefined;

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
export const BUILD_COMMIT = typeof __GIT_COMMIT__ !== 'undefined' ? __GIT_COMMIT__ : 'dev';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

export interface BackendVersion {
  app: string;
  version: string;
  commit: string;
  buildTime: string;
}

export async function getBackendVersion(): Promise<BackendVersion | null> {
  try {
    const res = await fetch(`${getApiUrl()}/api/version`, { method: 'GET' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
