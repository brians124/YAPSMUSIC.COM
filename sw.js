// YAPS Music — minimal service worker
// Purpose: satisfy Chrome's PWA installability requirement and provide
// basic offline fallback for the app shell. Keep this simple — audio/
// artwork files are large and streamed, so we don't cache media here.

const CACHE_NAME = 'yaps-music-shell-v1';
const SHELL_FILES = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_FILES))
      .catch((e) => console.log('[YAPS SW] Pre-cache skipped:', e))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

// Network-first for navigation/app shell, falling back to cache when offline.
// Everything else (audio, API calls, Supabase requests) just passes through
// to the network untouched.
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Only handle same-origin app-shell requests; let media/Supabase/CDN
  // requests go straight to the network.
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || request.url.endsWith('index.html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
  }
});
