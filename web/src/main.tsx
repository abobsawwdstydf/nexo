import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { loadBaseUrlConfig } from './config';
import { scheduleAssetPrewarm } from './lib/assetPreloader';

// Load base URL from base-url.json (for mobile/desktop apps)
loadBaseUrlConfig();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
);

// Register service worker for offline support
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
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
