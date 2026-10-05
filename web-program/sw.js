/* GovWatch service worker: app-shell caching, API always live.
   Installs from /sw.js so its scope (/) covers every page. */
const CACHE = 'govwatch-v3';
const CORE = [
  '/login.html',
  '/dashboard.html',
  '/field.html',
  '/cctv_feed.html',
  '/ai_anomaly.html',
  '/institutes_directory.html',
  '/inspections.html',
  '/video_verification.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
];
// API + auth + health backend routes must never be cached.
const LIVE_PREFIXES = [
  '/auth', '/inspections', '/users', '/projects', '/institutes',
  '/anomalies', '/media', '/analytics', '/cctv', '/health', '/api', '/metrics',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(CORE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  if (LIVE_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + '/'))) return;
  // Page navigations: network first so updates show immediately;
  // cached copy is only the offline fallback.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(event.request)),
    );
    return;
  }
  // Static assets: cache first for speed.
  event.respondWith(
    caches.match(event.request).then(
      (hit) =>
        hit ||
        fetch(event.request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return res;
        }),
    ),
  );
});
