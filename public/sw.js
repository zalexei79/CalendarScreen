const CACHE_NAME = 'atj-cache-v3';

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-32.png'
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
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, clone);
              cache.put('/', clone.clone());
              cache.put('/index.html', clone.clone());
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
