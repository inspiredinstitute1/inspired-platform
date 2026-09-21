const CACHE_NAME = 'inspired-cache-v1';
const urlsToCache = [
  './index.html',
  './LOGO.jpeg',
  './manifest.json'
];

// Install the service worker and cache the files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Serve cached content when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached file if found, otherwise fetch from the network
        return response || fetch(event.request);
      })
  );
});