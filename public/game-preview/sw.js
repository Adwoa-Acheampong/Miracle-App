const CACHE = 'miracle-game-__BUILD__';
const CORE = [
  './',
  './index.html',
  './game.css?v=__BUILD__',
  './glass-system.css?v=__BUILD__',
  './game.js?v=__BUILD__',
  './house-ui.js?v=__BUILD__',
  './rhythm-bible-ui.js?v=__BUILD__',
  './bible-plan.js?v=__BUILD__',
  './notifications.js?v=__BUILD__',
  './data.js?v=__BUILD__',
  './features.js?v=__BUILD__',
  './game-icons.js?v=__BUILD__',
  './auth-ui.js?v=__BUILD__',
  './pwa.js?v=__BUILD__',
  './manifest.json?v=__BUILD__',
  './bible/web-c/manifest.json',
  '../store.js?v=__BUILD__',
  '../auth.js?v=__BUILD__',
  '../nes-client.js?v=__BUILD__',
  '../attach.js?v=__BUILD__',
  '../icons.js?v=__BUILD__',
  '../pages/bitmoji.js?v=__BUILD__',
  '../user.js',
  '../util/esc.js?v=__BUILD__',
  '../vendor/three.module.js',
  '../assets/favicon.svg',
  '../assets/icon-192.png',
  '../assets/icon-512.png',
  ...Array.from({ length: 14 }, (_, index) => `./bible/web-c/TOB/${String(index + 1).padStart(3, '0')}.json`),
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('miracle-game-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'queue-sync' && self.registration.sync) {
    self.registration.sync.register('miracle-write-queue').catch(() => {});
  }
});

self.addEventListener('sync', event => {
  if (event.tag !== 'miracle-write-queue') return;
  event.waitUntil(self.clients.matchAll().then(clients => clients.forEach(client => client.postMessage({ type: 'flush-queue' }))));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data?.json() || {}; } catch { payload = { body: event.data?.text() || '' }; }
  const title = String(payload.title || 'Miracle');
  const options = {
    body: String(payload.body || 'A chosen practice is waiting in the Living House.'),
    icon: '../assets/icon-192.png',
    badge: '../assets/icon-192.png',
    tag: String(payload.tag || 'miracle-daily-rhythm'),
    renotify: false,
    data: { url: String(payload.url || './?open=rhythm') },
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    self.navigator?.setAppBadge?.(Number(payload.badge || 1)) || Promise.resolve(),
  ]));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './?open=rhythm', self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients.find(item => item.url.startsWith(self.registration.scope));
    if (client) {
      if ('navigate' in client) await client.navigate(target);
      return client.focus();
    }
    return self.clients.openWindow(target);
  }));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;
  const immutable = /\.(?:png|jpg|jpeg|webp|svg|woff2?)$/i.test(url.pathname);
  event.respondWith(immutable ? cacheFirst(event.request) : networkFirst(event.request));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
  return response;
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) (await caches.open(CACHE)).put(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return caches.match('./index.html');
    return new Response('', { status: 504, statusText: 'Offline and uncached' });
  }
}
