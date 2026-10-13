// InspirED Institute: public-shell caching only. Never cache student/payment APIs.
const CACHE_PREFIX = 'inspired-cache-';
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const APP_SCOPE = self.registration.scope;
const HOME_URL = new URL('index.html', APP_SCOPE).href;
const PUBLIC_ASSET_URLS = [
  HOME_URL,
  new URL('LOGO.jpeg', APP_SCOPE).href,
  new URL('manifest.json', APP_SCOPE).href
];

// Allow only the public homepage and these known static assets into Cache Storage.
const PUBLIC_CACHE_KEYS = new Map(
  PUBLIC_ASSET_URLS.map(url => [new URL(url).pathname, url])
);
PUBLIC_CACHE_KEYS.set(new URL('./', APP_SCOPE).pathname, HOME_URL);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PUBLIC_ASSET_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Do not intercept account callbacks, URL parameters, or authenticated calls.
  if (url.search || request.headers.has('Authorization')) return;
  const cacheKey = PUBLIC_CACHE_KEYS.get(url.pathname);
  if (!cacheKey) return; // Leave all future account, test, payment and API routes alone.

  event.respondWith((async () => {
    try {
      // Revalidate public resources online; never serve stale content first.
      const response = await fetch(request, { cache: 'no-cache' });
      const cacheControl = response.headers.get('Cache-Control') || '';
      if (response.ok && response.type === 'basic' && !/\b(?:private|no-store)\b/i.test(cacheControl)) {
        try {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(cacheKey, response.clone());
        } catch (_) {
          // A full/unavailable cache must not break otherwise successful requests.
        }
      }
      return response;
    } catch (_) {
      // Offline fallback is restricted to the known public files only.
      const cache = await caches.open(CACHE_NAME);
      return (await cache.match(cacheKey)) || Response.error();
    }
  })());
});
