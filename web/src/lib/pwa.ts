import { registerSW } from 'virtual:pwa-register';

/**
 * Register service worker for PWA
 */
export function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    const updateSW = registerSW({
      onNeedRefresh() {
        console.log('[PWA] New content available, please refresh.');
        // Show update notification to user
        if (confirm('New version available! Reload to update?')) {
          updateSW(true);
        }
      },
      onOfflineReady() {
        console.log('[PWA] App ready to work offline');
      },
      onRegistered(registration: any) {
        console.log('[PWA] Service Worker registered:', registration);
      },
      onRegisterError(error: any) {
        console.error('[PWA] Service Worker registration failed:', error);
      }
    });
  }
}
