const CACHE_NAME = 'atj-cache-v13-push-actions';

// The existing registration/cache lifecycle remains the only service worker.
self.addEventListener('message', (event) => {
  if (event.data?.type === 'DAYRIS_PUSH_VERSION') event.ports[0]?.postMessage({ version: 1 });
});
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { /* show safe fallback */ }
  const uuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '');
  const reminderId = uuid(data.reminderId) ? data.reminderId : '';
  const deliveryId = uuid(data.deliveryId) ? data.deliveryId : '';
  const title = typeof data.title === 'string' && data.title.trim() && data.title.length < 90 ? data.title.trim() : 'DAYRIS · напоминание';
  const body = typeof data.body === 'string' && data.body.trim() && data.body.length < 180 ? data.body.trim() : 'Открой DAYRIS и отметь план.';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png?v=20260920-desktop-v4',
    tag: deliveryId ? 'dayris-' + deliveryId : 'dayris-reminder',
    data: { reminderId },
    actions: [
      { action: 'completed', title: 'Подтвердилось' },
      { action: 'missed', title: 'Не получилось' },
      { action: 'amount', title: 'Указать сумму' },
    ],
  }));
});
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL('/', self.location.origin);
  const id = event.notification.data?.reminderId;
  if (typeof id === 'string') target.searchParams.set('reminder', id);
  if (['completed', 'missed', 'amount'].includes(event.action)) target.searchParams.set('action', event.action);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      try { const navigated = await existing.navigate(target.href); if (navigated) { await navigated.focus(); return; } } catch { /* open fallback */ }
    }
    await self.clients.openWindow(target.href);
  })());
});

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/brand-mark-192.png?v=20260920-transparent-v2',
  '/icon-16.png?v=20260920-favicon-v3',
  '/icon-32.png?v=20260920-favicon-v3',
  '/icon-48.png?v=20260920-favicon-v3',
  '/apple-touch-icon.png',
  '/apple-touch-icon-152-v5.png',
  '/apple-touch-icon-167-v5.png',
  '/apple-touch-icon-180-v5.png',
  '/icon-192.png?v=20260920-desktop-v4',
  '/icon-512.png?v=20260920-desktop-v4',
  '/icon-maskable-192-v5.png',
  '/icon-maskable-512-v5.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('[sw] Precache warning:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key.startsWith('atj-cache-') && key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Never cache Supabase, backend API, or OAuth calls
  if (
    url.hostname.includes('supabase.co') ||
    url.pathname.startsWith('/rest/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.startsWith('/functions/')
  ) {
    return;
  }

  // Handle navigation requests (opening the app or refreshing)
  if (event.request.mode === 'navigate') {
    const isAppShellNavigation = url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/install';
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
              // Only the app shell may become the offline fallback for `/`.
              // Pages such as /privacy.html must not replace the cached app.
              if (isAppShellNavigation) {
                cache.put('/', clone.clone());
                cache.put('/index.html', clone.clone());
              }
            });
          }
          return response;
        })
        .catch(async () => {
          const cached = (await caches.match(event.request))
            || (await caches.match('/'))
            || (await caches.match('/index.html'));
          if (cached) return cached;
          return new Response('<h1>Офлайн</h1><p>Нет подключения к интернету.</p>', {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        })
    );
    return;
  }

  // Only handle same-origin static assets and Tailwind CDN
  const isSameOrigin = url.origin === self.location.origin;
  const isCdn = url.hostname === 'cdn.tailwindcss.com';

  if (!isSameOrigin && !isCdn) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => null);

      if (cachedResponse) {
        return cachedResponse;
      }

      return fetchPromise.then((networkResponse) => {
        if (networkResponse) return networkResponse;
        // In Safari, respondWith must NEVER resolve to null/undefined!
        return new Response('', { status: 408, statusText: 'Offline asset not cached' });
      });
    })
  );
});
