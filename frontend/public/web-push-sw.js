/* eslint-disable no-restricted-globals */

// Web Push Service Worker
self.addEventListener('push', (event) => {
  console.log('[Web Push SW] Push received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Нексо', body: event.data.text() };
    }
  }

  const { title, body, icon, badge, data: notificationData, actions } = data;

  const notificationOptions = {
    body: body || 'Новое уведомление',
    icon: icon || '/logo.png',
    badge: badge || '/badge.png',
    vibrate: [200, 100, 200],
    data: notificationData || {},
    requireInteraction: true,
    silent: false,
    actions: actions || [
      { action: 'open', title: 'Открыть' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title || 'Нексо', notificationOptions)
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Web Push SW] Notification click:', event);
  
  event.notification.close();

  const { action, data } = event;
  
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      let url = '/';
      
      if (action === 'accept' || action === 'reply') {
        url = `/?call_action=${action}&callerId=${data?.callerId || ''}`;
      } else if (action === 'decline') {
        url = `/?call_action=decline&callerId=${data?.callerId || ''}`;
      } else if (data?.chatId) {
        url = `/?chat=${data.chatId}`;
      } else if (data?.requesterId) {
        url = `/?friend_request=${data.requesterId}`;
      }

      // If app is already open, focus it and send message
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin)) {
          client.postMessage({ type: 'notification_click', action, data });
          return client.focus();
        }
      }
      
      // Otherwise open new window
      return clients.openWindow(url);
    })
  );
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[Web Push SW] Message received:', event);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
