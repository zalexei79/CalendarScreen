const CACHE_NAME = 'atj-cache-v21-offline-startup';

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
  const proNotificationId = data.type === 'pro_granted' && uuid(data.proNotificationId) ? data.proNotificationId : '';
  // Compatible with the existing sender and already queued reminder payloads.
  const eventTitle = typeof data.title === 'string' && data.title.trim() && data.title.length < 90 ? data.title.trim() : '';
  // The OS already identifies the app (including "from DAYRIS" on Watch).
  // Use this space for the event, not another copy of the brand. These are
  // reminders, not proof that a payment arrived or an expense was completed.
  const title = eventTitle || 'Напоминание';
  const body = typeof data.body === 'string' && data.body.trim() && data.body.length <= 160
    ? data.body.trim().replace(/\s+/g, ' ')
    : 'Откройте календарь и отметьте выполнение.';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icon-192.png?v=20260920-desktop-v4',
    tag: deliveryId ? 'dayris-' + deliveryId : 'dayris-reminder',
    data: { reminderId, ...(proNotificationId ? { proNotificationId } : {}) },
    actions: proNotificationId ? [] : [
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
  if (typeof id === 'string' && id) target.searchParams.set('reminder', id);
  if (id && ['completed', 'missed', 'amount'].includes(event.action)) target.searchParams.set('action', event.action);
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
  '/apple-touch-icon-152-v7.png',
  '/apple-touch-icon-167-v7.png',
  '/apple-touch-icon-180-v7.png',
  '/icon-192.png?v=20260920-desktop-v4',
  '/icon-512.png?v=20260920-desktop-v4',
  '/icon-maskable-192-v5.png',
  '/icon-maskable-512-v5.png'
];

async function cacheAppShell(cache, response, request = '/index.html') {
  // Never save new HTML without its matching hashed JS/CSS. Otherwise the
  // next offline launch can display a loader but cannot mount the calendar.
  const html = await response.clone().text();
  const assets = [...new Set(html.match(/\/assets\/[^"'\s<>]+\.(?:js|css)/g) || [])];
  if (!assets.length) throw new Error('App bundle missing from shell');
  const missing = [];
  for (const asset of assets) if (!await cache.match(asset)) missing.push(asset);
  if (missing.length) await cache.addAll(missing);
  await Promise.all([
    cache.put(request, response.clone()),
    cache.put('/', response.clone()),
    cache.put('/index.html', response.clone()),
  ]);
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const response = await fetch('/index.html', { cache: 'reload' });
    if (!response.ok) throw new Error('App shell unavailable');
    // Failure here leaves the previous worker/cache active and usable.
    await cacheAppShell(cache, response);
    await cache.addAll(PRECACHE_ASSETS.filter(asset => asset !== '/' && asset !== '/index.html')).catch(err => {
      console.warn('[sw] Optional icon precache warning:', err);
    });
    await self.skipWaiting();
  })());
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
    url.pathname === '/metatrader/DAYRIS-MT5.exe' ||
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
        .then(async (response) => {
          if (response && response.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            try {
              if (isAppShellNavigation) await cacheAppShell(cache, response, event.request);
              else await cache.put(event.request, response.clone());
            } catch (err) { console.warn('[sw] Shell cache update postponed:', err); }
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

  const fetchPromise = fetch(event.request)
        .then(async (networkResponse) => {
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            const cache = await caches.open(CACHE_NAME);
            if (url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/install') {
              try { await cacheAppShell(cache, networkResponse, event.request); }
              catch (err) { console.warn('[sw] Shell cache update postponed:', err); }
            } else await cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => null);
  event.waitUntil(fetchPromise.then(() => {}));
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
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
