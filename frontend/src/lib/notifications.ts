// Web Push notifications manager
import { getApiUrl } from '../config';

// VAPID public key (can be overridden from server config)
const VAPID_PUBLIC_KEY = 'BPVXBg4HHqwRgo2rX4fnScnnL1bD0AgeSyAiufQluXGctTM0WsSD8VqJx5DUsUsev4uP1pCH42qRGFg8PsrbDd0';

/**
 * Register notification service worker
 */
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Service Worker or Push not supported');
    return null;
  }

  try {
    // Unregister old service workers to avoid conflicts
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      const scriptURL = registration.active?.scriptURL || '';
      if (scriptURL.includes('firebase') || scriptURL.includes('web-push-sw')) {
        console.log('[Push] Unregistering old service worker:', scriptURL);
        await registration.unregister();
      }
    }

    // Register notification service worker
    const registration = await navigator.serviceWorker.register('/notification-sw.js', {
      scope: '/'
    });

    console.log('[Push] Service Worker registered:', registration.scope);

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
    console.warn('[Push] Notifications not supported in this browser');
    return null;
  }

  try {
    // Check current permission
    if (Notification.permission === 'denied') {
      console.log('[Push] Notification permission previously denied');
      return null;
    }

    if (Notification.permission === 'default') {
      // Request permission
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.log('[Push] Notification permission denied by user');
        return null;
      }
      console.log('[Push] Permission granted');
    }

    // Register service worker
    const registration = await registerNotificationServiceWorker();
    if (!registration) {
      console.warn('[Push] Service worker not available');
      return null;
    }

    // Ensure service worker is active before subscribing
    if (!registration.active) {
      console.warn('[Push] Service worker not active yet, waiting...');
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
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource
    });

    console.log('[Push] Subscribed successfully');

    // Send subscription to server
    const saved = await sendSubscriptionToServer(subscription);
    if (!saved) {
      console.warn('[Push] Subscription created but not saved to server');
    }

    return subscription;
  } catch (error) {
    console.error('[Push] Subscription failed:', error);
    return null;
  }
}

/**
 * Send push subscription to server
 */
async function sendSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  try {
    const response = await fetch(`${getApiUrl()}/api/users/push-subscription`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Push] Server rejected subscription:', response.status, errorText);
      return false;
    }

    console.log('[Push] Subscription saved to server');
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
      await subscription.unsubscribe();
      
      // Remove from server
      await fetch(`${getApiUrl()}/api/users/push-subscription`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      console.log('[Push] Unsubscribed from push notifications');
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
