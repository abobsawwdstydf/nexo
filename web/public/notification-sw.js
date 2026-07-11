/* eslint-disable no-restricted-globals */

// Unified Notification Service Worker with Offline Support
// Works with both Firebase (mobile) and Web Push (desktop)

const CACHE_NAME = 'нексо-v2';
const RUNTIME_CACHE = 'нексо-runtime-v2';
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const PRECACHE_ASSETS = [
  '/',
  '/logo.png',
  '/no_bg.png',
  '/manifest.json'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  // НЕ вызываем skipWaiting() — это вызывало перезагрузку страницы
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );
  // НЕ вызываем clients.claim() — это вызывало перезагрузку всех открытых вкладок
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;
  
  // Skip chrome extensions
  if (event.request.url.startsWith('chrome-extension://')) return;
  
  const { request } = event;
  const url = new URL(request.url);
  
  // API requests - network only with offline fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Return cached response if available
          return caches.match(request).then((cached) => {
            if (cached) {
              return cached;
            }
            // Return offline response for API
            return new Response(
              JSON.stringify({ error: 'Offline', offline: true }),
              {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              }
            );
          });
        })
    );
    return;
  }
  
  // Static assets - cache first, fallback to network
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) {
          return cached;
        }
        
        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
  
  // HTML pages - network first, fallback to cache
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(request).then((cached) => {
          return cached || caches.match('/');
        });
      })
  );
});

// Background Sync - queue messages when offline
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-messages') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  try {
    // Get pending messages from IndexedDB
    const db = await openDB();
    const tx = db.transaction('pending_messages', 'readonly');
    const store = tx.objectStore('pending_messages');
    const messages = await store.getAll();
    
    // Send each message
    for (const msg of messages) {
      try {
        const response = await fetch('/api/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${msg.token}`
          },
          body: JSON.stringify(msg.data)
        });
        
        if (response.ok) {
          // Remove from pending
          const deleteTx = db.transaction('pending_messages', 'readwrite');
          const deleteStore = deleteTx.objectStore('pending_messages');
          await deleteStore.delete(msg.id);
        }
      } catch (err) {
        console.error('[SW] Failed to sync message:', err);
      }
    }
  } catch (err) {
    console.error('[SW] Sync failed:', err);
  }
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('нексо-offline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('pending_messages')) {
        db.createObjectStore('pending_messages', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// Handle push events
self.addEventListener('push', (event) => {
  console.log('[Notification SW] Push received:', event);

  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch (e) {
      try {
        const text = event.data.text();
        payload = JSON.parse(text);
      } catch {
        payload = { notification: { title: 'Нексо', body: event.data.text() } };
      }
    }
  }

  // Extract notification and data from payload
  const notification = payload.notification || {};
  const notificationData = payload.data || notification.data || {};
  const { title, body, icon, badge, image, tag, requireInteraction } = notification;

  // Determine notification type and actions
  let actions = [];
  const notificationType = notificationData?.type || 'message';

  if (notificationType === 'message') {
    // Message notification - add Reply action
    actions = [
      { action: 'reply', title: 'Ответить', icon: '/logo.png' },
      { action: 'open', title: 'Открыть', icon: '/logo.png' }
    ];
  } else if (notificationType === 'call' || notificationType === 'incoming_call') {
    // Call notification - add Accept/Decline actions
    actions = [
      { action: 'accept_call', title: 'Принять', icon: '/logo.png' },
      { action: 'decline_call', title: 'Отклонить', icon: '/logo.png' }
    ];
  } else if (notificationType === 'friend_request') {
    // Friend request - add Accept/Decline actions
    actions = [
      { action: 'accept_friend', title: 'Принять', icon: '/logo.png' },
      { action: 'decline_friend', title: 'Отклонить', icon: '/logo.png' }
    ];
  } else {
    // Default actions
    actions = [
      { action: 'open', title: 'Открыть', icon: '/logo.png' },
      { action: 'dismiss', title: 'Закрыть' }
    ];
  }

  const notificationOptions = {
    body: body || 'Новое сообщение',
    icon: icon || '/logo.png',
    badge: badge || '/logo.png',
    image: image || undefined,
    vibrate: notificationType === 'call' || notificationType === 'incoming_call' ? [300, 200, 300, 200, 300, 200, 300] : [200, 100, 200],
    tag: tag || notificationData?.chatId || notificationData?.callerId || 'нексо-default',
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: Date.now(),
      ...notificationData
    },
    requireInteraction: requireInteraction || notificationType === 'call' || notificationType === 'incoming_call', // Calls require interaction
    silent: false,
    actions: actions,
    // Add sound for calls on mobile
    sound: notificationType === 'call' || notificationType === 'incoming_call' ? '/sounds/call_sound.mp3' : undefined
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Нексо', notificationOptions)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Notification SW] Notification click:', event);
  event.notification.close();

  const { action } = event;
  const data = event.notification.data;
  let url = '/';

  // Handle different actions
  if (action === 'reply') {
    // Reply to message - open chat
    if (data?.chatId) {
      url = `/?chat=${data.chatId}&reply=true`;
    }
  } else if (action === 'accept_call') {
    // Accept incoming call
    url = `/?call_action=accept&callerId=${data.callerId || ''}&callType=${data.callType || 'voice'}`;
  } else if (action === 'decline_call') {
    // Decline call - send message to app to decline
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin)) {
            client.postMessage({
              type: 'decline_call',
              callerId: data.callerId,
              callType: data.callType
            });
            return;
          }
        }
      })
    );
    return; // Don't open window for decline
  } else if (action === 'accept_friend') {
    // Accept friend request
    url = `/?friend_action=accept&friendRequestId=${data.friendRequestId || data.requesterId || ''}`;
  } else if (action === 'decline_friend') {
    // Decline friend request
    url = `/?friend_action=decline&friendRequestId=${data.friendRequestId || data.requesterId || ''}`;
  } else if (action === 'dismiss') {
    // Just close notification
    return;
  } else if (action === 'open' || !action) {
    // Default open action - build URL based on notification type
    if (data?.type === 'call' || data?.type === 'incoming_call') {
      url = `/?call_action=incoming&callerId=${data.callerId || ''}&callType=${data.callType || 'voice'}`;
    } else if (data?.chatId) {
      url = `/?chat=${data.chatId}`;
    } else if (data?.friendRequestId || data?.requesterId) {
      url = `/?friend_request=${data.friendRequestId || data.requesterId}`;
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Try to focus existing visible window
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && client.visibilityState === 'visible') {
          client.postMessage({
            type: 'notification_click',
            action,
            data
          });
          return client.focus();
        }
      }

      // Focus any existing window
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus().then(() => {
            client.postMessage({
              type: 'notification_click',
              action,
              data
            });
          });
        }
      }

      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME)
    );
  }
});
