// ══════════════════════════════════════════
//  YAPS MUSIC — Service Worker v1.0
//  Enables offline support + PWA install
// ══════════════════════════════════════════

const CACHE_NAME = 'yaps-music-v1';
const OFFLINE_PAGE = '/YAPSMUSIC.COM/';

// Files to cache immediately on install
const PRECACHE_URLS = [
  '/YAPSMUSIC.COM/',
  '/YAPSMUSIC.COM/index.html',
  '/YAPSMUSIC.COM/manifest.json',
  '/YAPSMUSIC.COM/icons/icon-192.png',
  '/YAPSMUSIC.COM/icons/icon-512.png',
  '/YAPSMUSIC.COM/icons/apple-touch-icon.png',
];

// ── INSTALL: cache core files ──
self.addEventListener('install', event => {
  console.log('[YAPS SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[YAPS SW] Pre-caching app shell');
      // Use individual adds so one failure doesn't block the rest
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(e => console.warn('[YAPS SW] Could not cache:', url, e)))
      );
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clean up old caches ──
self.addEventListener('activate', event => {
  console.log('[YAPS SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => {
            console.log('[YAPS SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: Network-first for HTML/API, Cache-first for assets ──
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests (Supabase, fonts, CDNs)
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // For navigation requests (HTML pages) — network first, fallback to cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Clone and store fresh copy in cache
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return response;
        })
        .catch(() => {
          // Offline — serve cached index
          return caches.match(OFFLINE_PAGE) || caches.match('/YAPSMUSIC.COM/index.html');
        })
    );
    return;
  }

  // For static assets — cache first, then network
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Only cache valid responses
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Return nothing for missing assets — don't break the app
        return new Response('', { status: 404 });
      });
    })
  );
});

// ── PUSH NOTIFICATIONS (future use) ──
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  self.registration.showNotification(data.title || 'YAPS Music', {
    body: data.body || 'New music is waiting for you 🎵',
    icon: '/YAPSMUSIC.COM/icons/icon-192.png',
    badge: '/YAPSMUSIC.COM/icons/icon-96.png',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/YAPSMUSIC.COM/' }
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/YAPSMUSIC.COM/')
  );
});

console.log('[YAPS SW] Service Worker loaded ✅');
