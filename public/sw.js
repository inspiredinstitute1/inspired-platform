// Retire the old GitHub Pages public-shell worker during the domain migration.
// Only that site's named caches are removed; learner storage is untouched.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith('inspired-cache-'))
      .map(name => caches.delete(name)));
    await self.clients.claim();
    await self.registration.unregister();
  })());
});
