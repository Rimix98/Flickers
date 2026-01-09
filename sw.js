const CACHE_NAME = 'flickers-v3'; // Обновлена версия для принудительного обновления
const urlsToCache = [
  '/',
  '/index.html',
  '/icon.png',
  '/icon-128.png',
  '/icon-256.png'
];

// Установка Service Worker
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

// Активация
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
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

// Сообщение SKIP_WAITING
self.addEventListener('message', event => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, tag, data } = event.data;
    console.log('[SW] Showing notification:', title, body);
    
    self.registration.showNotification(title || 'Flickers', {
      body: body || 'Новое сообщение',
      icon: icon || '/icon-128.png',
      badge: '/icon-128.png',
      tag: tag || 'message-' + Date.now(),
      data: data || {},
      vibrate: [200, 100, 200],
      requireInteraction: false,
      silent: false
    }).then(() => {
      console.log('[SW] Notification shown successfully');
    }).catch(err => {
      console.error('[SW] Notification error:', err);
    });
  }
});

// Fetch - сначала сеть, потом кэш
// НЕ кэшируем внешние ресурсы (Firebase, CDN и т.д.)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Пропускаем внешние запросы - не кэшируем их
  if (url.origin !== self.location.origin) {
    return; // Браузер сам обработает запрос
  }
  
  // Пропускаем не-GET запросы
  if (event.request.method !== 'GET') {
    return;
  }
  
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Кэшируем только успешные ответы для локальных ресурсов
        if (response && response.status === 200 && response.type === 'basic') {
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
