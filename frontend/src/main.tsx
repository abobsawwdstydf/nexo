import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { loadBaseUrlConfig } from './config';
import { scheduleAssetPrewarm } from './lib/assetPreloader';
import { subscribeToNotifications } from './lib/notifications';

// Load base URL from base-url.json (for mobile/desktop apps)
loadBaseUrlConfig();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
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
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload();
  });
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
