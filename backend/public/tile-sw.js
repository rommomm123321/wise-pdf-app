// Service Worker for tile caching — Redlines PDF Viewer
// Cache name — bump version to force refresh
const CACHE_NAME = 'redlines-tiles-v3';
// Tile URLs to intercept
const TILE_URL_PATTERNS = ['/tiles/', '/thumbnail/'];
// Max age for cached tiles (7 days in milliseconds)
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
// Max cached entries — prevents disk bloat (~15KB avg × 10000 = ~150MB)
const MAX_ENTRIES = 10000;

// On activate: claim clients and purge stale entries older than 7 days
self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();

      const cache = await caches.open(CACHE_NAME);
      const keys = await cache.keys();
      const now = Date.now();
      const deletePromises = [];

      for (const request of keys) {
        const response = await cache.match(request);
        if (response) {
          const cachedAt = response.headers.get('x-sw-cached-at');
          if (cachedAt) {
            const age = now - parseInt(cachedAt, 10);
            if (age > MAX_AGE_MS) {
              deletePromises.push(cache.delete(request));
            }
          } else {
            deletePromises.push(cache.delete(request));
          }
        }
      }

      await Promise.all(deletePromises);
    })()
  );
});

self.addEventListener('install', event => {
  self.skipWaiting();
});

function isTileRequest(url) {
  return TILE_URL_PATTERNS.some(pattern => url.includes(pattern));
}

// Evict oldest entries when cache exceeds MAX_ENTRIES
async function evictIfNeeded(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_ENTRIES) return;

  // Collect entries with timestamps
  const entries = [];
  for (const request of keys) {
    const response = await cache.match(request);
    const cachedAt = response?.headers.get('x-sw-cached-at');
    entries.push({ request, time: cachedAt ? parseInt(cachedAt, 10) : 0 });
  }

  // Sort oldest first, remove 20% to avoid evicting every request
  entries.sort((a, b) => a.time - b.time);
  const target = Math.floor(MAX_ENTRIES * 0.8);
  const toRemove = entries.length - target;
  for (let i = 0; i < toRemove; i++) {
    await cache.delete(entries[i].request);
  }
}

// Cache-first strategy with timestamp injection
self.addEventListener('fetch', event => {
  const url = event.request.url;
  if (!isTileRequest(url)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // 1. Cache-first
      const cached = await cache.match(event.request);
      if (cached) {
        const cachedAt = cached.headers.get('x-sw-cached-at');
        if (cachedAt) {
          const age = Date.now() - parseInt(cachedAt, 10);
          if (age <= MAX_AGE_MS) {
            return cached;
          }
          await cache.delete(event.request);
        } else {
          return cached;
        }
      }

      // 2. Network fetch
      const networkResponse = await fetch(event.request);

      if (networkResponse.ok) {
        const clonedBody = await networkResponse.clone().arrayBuffer();
        const headers = new Headers(networkResponse.headers);
        headers.set('x-sw-cached-at', Date.now().toString());

        const cachedResponse = new Response(clonedBody, {
          status: networkResponse.status,
          statusText: networkResponse.statusText,
          headers,
        });

        cache.put(event.request, cachedResponse);

        // Async eviction — don't block the response
        evictIfNeeded(cache).catch(() => {});
      }

      return networkResponse;
    })()
  );
});
