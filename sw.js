// ══════════════════════════════════════════════════════════════
//  YAPS MUSIC — Service Worker  (sw.js)
//  Provides offline support and fast repeat loads.
//  Place this file in the SAME folder as yaps_music.html
// ══════════════════════════════════════════════════════════════

const CACHE_NAME = 'yaps-v1';

// Shell assets to cache on install (adjust paths if hosting elsewhere)
const PRECACHE = [
  './',
  './yaps_music.html',
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Archivo+Narrow:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
];

// ── INSTALL: pre-cache the app shell ──────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Non-fatal: if one CDN asset fails, still install
      return Promise.allSettled(PRECACHE.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

// ── ACTIVATE: clear old caches ────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ── FETCH: network-first for API/audio, cache-first for shell ─
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Always go to network for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Audio files: network-first, no caching (files can be large)
  if (request.destination === 'audio') {
    event.respondWith(fetch(request));
    return;
  }

  // Unsplash images: cache-first with network fallback
  if (url.hostname.includes('unsplash.com') || url.hostname.includes('images.unsplash')) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(resp => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(request, clone));
          }
          return resp;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // App shell & static assets: cache-first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(resp => {
        if (resp.ok && (request.method === 'GET')) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, clone));
        }
        return resp;
      }).catch(() => {
        // Offline fallback: serve the app shell for navigation requests
        if (request.mode === 'navigate') {
          return caches.match('./yaps_music.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
