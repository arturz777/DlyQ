const VERSION      = 'v1.0.4';
const STATIC_CACHE = `static-${VERSION}`;
const API_CACHE    = `api-${VERSION}`;
const IMG_CACHE    = `img-${VERSION}`;

const IS_DEV = ['localhost','127.0.0.1'].includes(self.location.hostname);

const API_BASE = 'https://api.dlyq.ee';

const PREWARM_API = IS_DEV ? [] : [
  `${API_BASE}/api/type`,
  `${API_BASE}/api/subtype`,
  `${API_BASE}/api/brand`,
  `${API_BASE}/api/device/filter?page=1&limit=24`,
];

const API_ORIGINS = [ self.location.origin, API_BASE ];
const API_ALLOWLIST = [
  '/api/type',
  '/api/subtype',
  '/api/device/filter',
  '/api/device',
  '/api/device/make',
  '/api/device/model',
  '/api/brand',
];

const PRECACHE = ['/', '/index.html'];

const shouldCacheResponse = (res) =>
  res && res.ok && (res.type === 'basic' || res.type === 'cors');

async function trimCache(name, maxEntries = 300) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  if (keys.length > maxEntries) {
    await Promise.all(keys.slice(0, keys.length - maxEntries).map(k => cache.delete(k)));
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const res = await fetch(request);
    if (shouldCacheResponse(res)) {
      try { await cache.put(request, res.clone()); trimCache(cacheName); } catch {}
    }
    return res;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener('message', (e) => {
  const { type, match } = e.data || {};
  if (type === 'PURGE_API' && match) {
    caches.open(API_CACHE).then(cache => {
      cache.keys().then(keys => {
        keys.forEach(req => {
          if (req.url.includes(match)) cache.delete(req);
        });
      });
    });
  }
});

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    try {
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.addAll(PRECACHE);

      if (!IS_DEV && PREWARM_API.length) {
        const apiCache = await caches.open(API_CACHE);
        await Promise.all(PREWARM_API.map(async (u) => {
          try {
            const res = await fetch(u, { mode: 'cors' });
            if (shouldCacheResponse(res)) await apiCache.put(u, res.clone());
          } catch {}
        }));
      }
    } catch {}
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter(n => ![STATIC_CACHE, API_CACHE, IMG_CACHE].includes(n))
        .map(n => caches.delete(n))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (IS_DEV && (url.pathname.startsWith('/sockjs') || url.pathname.includes('hot-update'))) {
    return; 
  }

  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        if ((res.headers.get('content-type') || '').includes('text/html')) {
          const cache = await caches.open(STATIC_CACHE);
          cache.put('/index.html', res.clone());
        }
        return res;
      } catch {
        const cache = await caches.open(STATIC_CACHE);
        const fallback = await cache.match('/index.html');
        return fallback || new Response('Offline', { status: 503 });
      }
    })());
    return;
  }

  if (!IS_DEV && /\.(?:js|css)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  if (/\.(?:woff2?|ttf|otf|eot)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, STATIC_CACHE));
    return;
  }

  if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(url.pathname)) {
    event.respondWith(cacheFirst(req, IMG_CACHE));
    return;
  }

  const isAllowedApiOrigin = API_ORIGINS.includes(url.origin);
  const isAllowedApiPath   = API_ALLOWLIST.some(p => url.pathname.startsWith(p));
  if (isAllowedApiOrigin && isAllowedApiPath) {
    event.respondWith((async () => {
      const cache = await caches.open(API_CACHE);
      const cached = await cache.match(req);
      if (cached) {
        event.waitUntil(fetch(req).then(res => {
          if (res && res.ok) cache.put(req, res.clone());
        }).catch(() => {}));
        return cached;
      }
      try {
        const res = await fetch(req);
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return new Response('Offline', { status: 503 });
      }
    })());
    return;
  }
});
