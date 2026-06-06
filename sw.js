// YAPS Music — Service Worker v2
// Adds: Supabase SDK caching, R2 audio stream-through, network-first for API calls

const CACHE_NAME = 'yaps-music-v2';

const SHELL_FILES = [
  './index.html',
  'https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600;700;800;900&family=Archivo+Narrow:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
];

// Install — cache app shell + Supabase SDK
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell + Supabase SDK');
      return cache.addAll(SHELL_FILES).catch(e => {
        console.warn('[SW] Some files failed to cache:', e);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension')) return;

  const url = event.request.url;

  // ── Supabase API & Realtime — network only (auth, db, realtime) ──
  if (url.includes('.supabase.co')) return;

  // ── Anthropic API — network only ──
  if (url.includes('api.anthropic.com')) return;

  // ── Cloudflare R2 audio — network only with range-request support ──
  // R2 bucket URLs stream audio; don't intercept range requests
  if (url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com')) return;

  // ── Audio files (blob / external) — network only ──
  if (/\.(mp3|wav|ogg|opus|m4a|aac|flac)(\?|$)/i.test(url)) return;

  // ── Supabase JS SDK & CDN assets — cache first ──
  if (url.includes('cdn.jsdelivr.net') || url.includes('cdnjs.cloudflare.com') || url.includes('fonts.gstatic.com') || url.includes('fonts.googleapis.com')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response && response.status === 200) {
            const toCache = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
          }
          return response;
        });
      })
    );
    return;
  }

  // ── App shell — cache first, fallback to network ──
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200 && response.type !== 'opaque') {
          const toCache = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
