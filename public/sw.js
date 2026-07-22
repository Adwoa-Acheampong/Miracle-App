// MODULE 2 — Service Worker
//
// Strategy as of v23+:
//   · CSS/JS/HTML (same-origin) → network-first with cache fallback.
//     Reason: cache-first on module files means a deploy that changes mood.js
//     (or any module other than main.js) won't reach already-installed clients
//     until the user clears storage. Network-first keeps the offline fallback
//     while ensuring fresh code propagates on every successful request.
//   · Assets (svg, png, woff2, …) → cache-first (these are immutable per deploy
//     when long-cached on the server, and rarely change).
//   · Google Fonts → cache-first (third-party, won't change).
//   · Navigation requests offline → fall back to cached index.html.
//
// CACHE_VERSION's literal `__BUILD__` is rewritten by the backend on every fetch
// of sw.js (see server.js sendWithBuildToken). Every deploy gets a distinct SW
// cache → activate() purges previous caches → old assets gone.

const CACHE_VERSION = 'miracle-__BUILD__';

const PRECACHE_ASSETS = [
  '../assets/favicon.svg',
  '../assets/icon-192.png',
  '../assets/icon-512.png',
  '../assets/apple-touch-icon.png',
  '../assets/miracle-mark.svg',
  '../assets/wordmark.svg',
  '../assets/brand/pattern-bird.jpg',
  '../assets/brand/pattern-diamond.jpg',
  '../assets/brand/pattern-heart.jpg',
  '../assets/brand/pattern-ohemaa.jpg',
  '../assets/brand/pattern-target.jpg',
  '../vendor/three.module.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Background sync: process queued writes when back online.
self.addEventListener('sync', e => {
  if (e.tag === 'miracle-write-queue') e.waitUntil(processWriteQueue());
});
async function processWriteQueue() {
  const clients = await self.clients.matchAll();
  for (const c of clients) c.postMessage({ type: 'flush-queue' });
}
self.addEventListener('message', e => {
  if (e.data?.type === 'queue-sync' && self.registration.sync) {
    self.registration.sync.register('miracle-write-queue').catch(() => {});
  }
});

// ─── Fetch routing ────────────────────────────────────────────────
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);

  // Third-party: cache-first (Google Fonts etc.)
  if (url.origin !== location.origin) {
    if (url.hostname.includes('googleapis.com') || url.hostname.includes('gstatic.com')) {
      e.respondWith(cacheFirst(e.request));
    }
    return; // other cross-origin → let the network handle it directly
  }

  // Same-origin: pick by extension
  const ext = url.pathname.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  const isImmutableAsset = ext && /^(svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot)$/.test(ext);

  if (isImmutableAsset) {
    e.respondWith(cacheFirst(e.request));
  } else {
    // JS, CSS, HTML, JSON, navigation → network-first
    e.respondWith(networkFirst(e.request));
  }
});

function cacheFirst(request) {
  return caches.match(request).then(cached =>
    cached || fetch(request).then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(request, clone));
      }
      return resp;
    })
  );
}

function networkFirst(request) {
  return fetch(request)
    .then(resp => {
      if (resp.ok) {
        const clone = resp.clone();
        caches.open(CACHE_VERSION).then(c => c.put(request, clone));
      }
      return resp;
    })
    .catch(() => caches.match(request).then(cached =>
      cached || (request.mode === 'navigate'
        ? caches.match('./index.html')
        : new Response('', { status: 504, statusText: 'offline + uncached' }))
    ));
}
