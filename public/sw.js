const CACHE_NAME = 'corner-erp-v2';
const STATIC_ASSETS = ['/', '/pos', '/menu', '/stock', '/repairs'];

// Install: cache critical pages
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.url.includes('/api/')) {
    // Network first for API calls
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
  } else {
    // Cache first for pages/assets
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});
