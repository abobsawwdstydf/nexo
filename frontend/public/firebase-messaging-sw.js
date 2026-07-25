/* eslint-disable no-restricted-globals */
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Firebase config
firebase.initializeApp({
  apiKey: "AIzaSyDPczsmF7yM8cn3SDL718P9NuH4doqFrIM",
  authDomain: "нексо-37853.firebaseapp.com",
  projectId: "нексо-37853",
  storageBucket: "нексо-37853.firebasestorage.app",
  messagingSenderId: "979414131131",
  appId: "1:979414131131:web:89c5fc0aac103678e4649e",
  measurementId: "G-TG4FSTP5ZY"
});

const messaging = firebase.messaging();

// Background message handler
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  const { title, body, icon, badge, data } = payload.notification || {};
  const callData = data || payload.data;

  const notificationOptions = {
    body: body || 'Новое уведомление',
    icon: icon || '/logo.png',
    badge: badge || '/badge.png',
    vibrate: [200, 100, 200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
      ...callData
    },
    requireInteraction: true,
    silent: false,
    actions: [
      { action: 'accept', title: 'Ответить', icon: '/icons/accept.png' },
      { action: 'decline', title: 'Отклонить', icon: '/icons/decline.png' }
    ]
  };

  self.registration.showNotification(title || 'Нексо', notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification click:', event);
  
  event.notification.close();

  const { action, data } = event;
  
  if (action === 'accept') {
    // Accept call - open app with call action
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        // If app is already open, focus it
        for (const client of windowClients) {
          if (client.url.includes(window.location.origin)) {
            client.postMessage({ type: 'accept_call', data });
            return client.focus();
          }
        }
        // Otherwise open new window
        return clients.openWindow(`/?call_action=accept&callerId=${data?.callerId}`);
      })
    );
  } else if (action === 'decline') {
    // Decline call
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(window.location.origin)) {
            client.postMessage({ type: 'decline_call', data });
            return client.focus();
          }
        }
        return clients.openWindow(`/?call_action=decline&callerId=${data?.callerId}`);
      })
    );
  } else {
    // Open app normally
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(window.location.origin)) {
            return client.focus();
          }
        }
        return clients.openWindow('/');
      })
    );
  }
});

// Handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[firebase-messaging-sw.js] Message received:', event);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
