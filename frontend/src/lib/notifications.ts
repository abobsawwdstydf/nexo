// Web Push notifications manager
import { logger } from './logger';
import type { PushSubscriptionJSON } from './api/realtime';
import { getApiBase } from './api/core';

// VAPID public key (can be overridden from server config)
const FALLBACK_VAPID_PUBLIC_KEY = 'BJ1KtETxqOeTH_9VsXDSRJVyXZExqbWJn_WupTc1a6mm9CdQdtXNzzknTTz4SE4dU78Und4ZTwTXKoWIT02cMrk';

let cachedVapidKey: string | null = null;

/**
 * Fetch the exact VAPID public key used by the backend (falls back to the
 * bundled key when the endpoint is unavailable).
 */
export async function getVapidPublicKey(): Promise<string> {
  if (cachedVapidKey) return cachedVapidKey;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${getApiBase()}/vapid-public-key`, { signal: controller.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      if (data?.publicKey) {
        cachedVapidKey = data.publicKey as string;
        return cachedVapidKey;
      }
    }
  } catch {
    // backend unreachable — fall back below
  }
  cachedVapidKey = FALLBACK_VAPID_PUBLIC_KEY;
  return cachedVapidKey;
}

/**
 * Register notification service worker
 */
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    logger.warn('[Push] Service Worker or Push not supported');
    return null;
  }

  try {
    // Unregister old service workers to avoid conflicts
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      const scriptURL = registration.active?.scriptURL || '';
      if (scriptURL.includes('firebase') || scriptURL.includes('web-push-sw')) {
        logger.log('[Push] Unregistering old service worker:', scriptURL);
        await registration.unregister();
      }
    }

    // Register notification service worker
    const registration = await navigator.serviceWorker.register('/notification-sw.js', {
      scope: '/'
    });

    logger.log('[Push] Service Worker registered:', registration.scope);

    // Wait for service worker to be active
    await navigator.serviceWorker.ready;

    // Additional wait if installing
    if (registration.installing) {
      await new Promise<void>((resolve) => {
        const sw = registration.installing!;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      });
    } else if (registration.waiting) {
      // If there's a waiting worker, activate it
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      await new Promise<void>((resolve) => {
        const sw = registration.waiting!;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'activated') resolve();
        });
      });
    }

    return registration;
  } catch (error) {
    console.error('[Push] Service Worker registration failed:', error);
    return null;
  }
}

/**
 * Request notification permission and subscribe to push
 */
export async function subscribeToNotifications(): Promise<PushSubscription | null> {
  if (!('Notification' in window)) {
    logger.warn('[Push] Notifications not supported in this browser');
    return null;
  }

  try {
    // Check current permission
    if (Notification.permission === 'denied') {
      logger.log('[Push] Notification permission previously denied');
      return null;
    }

    if (Notification.permission === 'default') {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        logger.log('[Push] Notification permission denied by user');
        return null;
      }
      logger.log('[Push] Permission granted');
    }

    // Register service worker
    const registration = await registerNotificationServiceWorker();
    if (!registration) {
      logger.warn('[Push] Service worker not available');
      return null;
    }

    // Ensure service worker is active before subscribing
    if (!registration.active) {
      logger.warn('[Push] Service worker not active yet, waiting...');
      // Wait for service worker to become active
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Service worker activation timeout'));
        }, 10000); // 10 second timeout

        if (registration.installing) {
          registration.installing.addEventListener('statechange', function checkState() {
            if (this.state === 'activated') {
              clearTimeout(timeout);
              resolve();
            }
          });
        } else if (registration.waiting) {
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          registration.waiting.addEventListener('statechange', function checkState() {
            if (this.state === 'activated') {
              clearTimeout(timeout);
              resolve();
            }
          });
        } else {
          clearTimeout(timeout);
          reject(new Error('No service worker available'));
        }
      });
    }

    // Double check that service worker is now active
    if (!registration.active) {
      console.error('[Push] Service worker still not active after waiting');
      return null;
    }

    // Subscribe to push notifications
    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) {
      logger.warn('[Push] No VAPID public key available');
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
    });

    logger.log('[Push] Subscribed successfully');

    // Send subscription to server
    const saved = await sendSubscriptionToServer(subscription);
    if (!saved) {
      logger.warn('[Push] Subscription created but not saved to server');
    }

    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Send push subscription to server (tries WS first, falls back to HTTP)
 */
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  try {
    const { api } = await import('../lib/api');
    await api.pushSubscribeWS(subscription.toJSON() as PushSubscriptionJSON);
    logger.log('[Push] Subscription saved to server');
    return true;
  } catch (error) {
    console.error('[Push] Failed to save subscription:', error);
    return false;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromNotifications(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();

      // Remove from server (WS first, REST fallback — the server removes
      // stale subscriptions on 404/410 anyway).
      try {
        const { api } = await import('./api');
        await api.pushUnsubscribeWS(endpoint);
      } catch (err) {
        console.error('[Push] Failed to remove subscription from server:', err);
      }

      logger.log('[Push] Unsubscribed from push notifications');
      return true;
    }

    return false;
  } catch (error) {
    console.error('[Push] Unsubscribe failed:', error);
    return false;
  }
}

/**
 * Send a test notification
 */
export async function sendTestNotification(): Promise<boolean> {
  const registration = await navigator.serviceWorker.ready;
  if (!registration) return false;

  registration.showNotification('Нексо Мессенджер', {
    body: 'Уведомления работают!',
    icon: '/logo.png',
    badge: '/logo.png'
  } as NotificationOptions);

  return true;
}

/**
 * Helper: Convert VAPID key from base64 string to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  try {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  } catch (error) {
    console.error('[Push] Failed to convert VAPID key:', error);
    return new Uint8Array();
  }
}
