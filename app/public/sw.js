const CACHE_NAME = 'mototaxi-sc-cache-v3';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// Install Event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching core PWA assets');
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) => {
          return cache.add(url).catch((err) => {
            console.warn(`[Service Worker] Failed to cache: ${url}`, err);
          });
        })
      );
    }).then(() => self.skipWaiting())
  );
});

// Activate Event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event
self.addEventListener('fetch', (event) => {
  // Avoid caching backend API calls, live tracking/firestore, or firebase connections
  if (
    event.request.url.includes('/api/') || 
    event.request.url.includes('firestore.googleapis.com') ||
    event.request.url.includes('firebase')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Cache newly requested JS, CSS or assets on the fly
        const isSameOrigin = event.request.url.startsWith(self.location.origin);
        if (
          isSameOrigin &&
          response && 
          response.status === 200 && 
          response.type === 'basic' &&
          (event.request.url.endsWith('.js') || 
           event.request.url.endsWith('.css') || 
           event.request.url.includes('/assets/'))
        ) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch((err) => {
        console.warn('[Service Worker] Network request failed:', err);
        // Fallback to offline index.html for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
