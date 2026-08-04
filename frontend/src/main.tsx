import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadBaseUrlConfig } from './config';
import { scheduleAssetPrewarm } from './lib/assetPreloader';
import { subscribeToNotifications } from './lib/notifications';
import { ErrorBoundary } from './components/ErrorBoundary';

// Load base URL from base-url.json (for mobile/desktop apps)
loadBaseUrlConfig();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('[main] #root element not found — cannot mount the app');
}

ReactDOM.createRoot(rootElement).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

// Register service worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
  // VitePWA использует skipWaiting+clientsClaim: при активации новой версии
  // старые ленивые чанки исчезают из кэша, и динамический импорт падает с
  // "Failed to fetch dynamically imported module". Перезагружаем страницу,
  // чтобы новый HTML и чанки загрузились синхронно.
  // Guard: перезагружаем не чаще одного раза за сессию, чтобы сбой активации
  // новой версии SW не превратился в бесконечный цикл перезагрузок.
  const SW_RELOAD_KEY = 'nexo_sw_reloaded';
  if (!sessionStorage.getItem(SW_RELOAD_KEY)) {
    sessionStorage.setItem(SW_RELOAD_KEY, '1');
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });
  }
}

// Subscribe to push notifications on first visit
if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
  window.addEventListener('load', () => {
    setTimeout(() => subscribeToNotifications(), 5000);
  });
}

// Background pre-warm of static app assets (logos, icons, sounds) so
// subsequent visits don't show loading placeholders. Runs only on good
// connections, in idle time, with throttled concurrency.
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    scheduleAssetPrewarm();
  });
}
