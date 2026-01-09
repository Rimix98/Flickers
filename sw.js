const CACHE_NAME = 'flickers-v2';
const urlsToCache = [
  '/',
  '/index.html',
  '/icon.png',
  '/icon-128.png',
  '/icon-256.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Активация
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch - сначала сеть, потом кэш
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Кэшируем успешные ответы
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, responseClone));
        }
        return response;
      })
      .catch(() => {
        // Если сеть недоступна - берём из кэша
        return caches.match(event.request);
      })
  );
});

// ========== PUSH УВЕДОМЛЕНИЯ ==========

// Получение push-уведомления
self.addEventListener('push', event => {
  let data = {
    title: 'Flickers',
    body: 'Новое сообщение',
    icon: '/icon-128.png',
    badge: '/icon-128.png',
    tag: 'message',
    data: {}
  };
  
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/icon-128.png',
    badge: data.badge || '/icon-128.png',
    tag: data.tag || 'message',
    data: data.data || {},
    vibrate: [200, 100, 200],
    requireInteraction: false,
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'close') return;
  
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(windowClients => {
        // Ищем уже открытое окно
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Отправляем данные в окно
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              data: event.notification.data
            });
            return client.focus();
          }
        }
        // Если окна нет - открываем новое
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Получение сообщений от основного скрипта
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data } = event.data;
    
    self.registration.showNotification(title || 'Flickers', {
      body: body || 'Новое сообщение',
      icon: icon || '/icon-128.png',
      badge: '/icon-128.png',
      tag: tag || 'message-' + Date.now(),
      data: data || {},
      vibrate: [200, 100, 200],
      requireInteraction: false,
      silent: false
    });
  }
});
