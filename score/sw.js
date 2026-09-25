// Volleyball Scoreboard Service Worker
// Caches everything on install so the app runs 100% offline forever after first load.

const CACHE_NAME = 'vb-scoreboard-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function(event) {
  // Cache-first: serve local copies whenever we have them.
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      return cached || fetch(event.request).then(function(resp){
        // Cache anything else fetched (belt & suspenders)
        var respClone = resp.clone();
        caches.open(CACHE_NAME).then(function(cache){
          try { cache.put(event.request, respClone); } catch(e) {}
        });
        return resp;
      }).catch(function(){
        // Offline and not in cache — fall back to index for navigation requests.
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
