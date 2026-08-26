/* Glide HTPC Remote — Service Worker
 *
 * Strategy: cache-first for all static assets so the app shell loads
 * instantly even on a slow LAN.  WebSocket connections and the dynamic
 * /qr.png pass through unchanged — the SW never intercepts them.
 *
 * Bump CACHE_VERSION whenever static files change (the old cache is
 * deleted automatically during activate).
 */

const CACHE_VERSION = 'glide-v5';

const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/static/glide-tokens.css',
  '/static/ws.js',
  '/static/glide-ui.jsx',
  '/static/glide-connect.jsx',
  '/static/glide-controller.jsx',
  '/static/glide-setup.jsx',
  '/static/react.min.js',
  '/static/react-dom.min.js',
  '/static/babel.min.js',
  '/static/icons/icon-192.png',
  '/static/icons/icon-512.png',
  '/static/icons/icon.svg',
  '/static/icons/apple-touch-icon.png',
];

/* ── Install: pre-cache all static assets ─────────────────────────────────── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())   // activate immediately, don't wait for tabs to close
  );
});

/* ── Activate: delete stale caches from previous versions ─────────────────── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take control of open tabs immediately
  );
});

/* ── Fetch: cache-first for static assets, pass-through for everything else ─ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept: WebSocket upgrades, QR image (regenerated per session),
  // health check, or cross-origin requests.
  if (
    request.headers.get('upgrade') === 'websocket' ||
    url.pathname === '/qr.png' ||
    url.pathname === '/health' ||
    url.pathname === '/devices' ||          // live state, never cache
    url.pathname.startsWith('/setup') ||    // credentials + config, never cache
    request.method !== 'GET' ||
    url.origin !== self.location.origin
  ) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;

      // Not in cache — fetch from network and store for next time.
      return fetch(request).then((response) => {
        if (request.method === 'GET' && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
