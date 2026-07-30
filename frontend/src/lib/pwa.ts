import { registerSW } from 'virtual:pwa-register';
import { logger } from './logger';

let _updateSW: (() => Promise<void>) | null = null;

/**
 * Apply pending PWA update (called from UI toast/button, not blocking confirm)
 */
export function applyPendingUpdate() {
  if (_updateSW) {
    _updateSW();
    _updateSW = null;
  }
}

/**
 * Register service worker for PWA
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
      onNeedRefresh() {
        logger.log('[PWA] New content available, please refresh.');
        _updateSW = updateSW;
        // Dispatch a custom event so the UI can show a non-blocking update banner
        window.dispatchEvent(new CustomEvent('pwa-update-available'));
      },
      onOfflineReady() {
        logger.log('[PWA] App ready to work offline');
      },
      onRegistered(registration: any) {
        logger.log('[PWA] Service Worker registered:', registration);
      },
      onRegisterError(error: any) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    });
  }
}
