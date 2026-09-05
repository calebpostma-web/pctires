// /video-sw.js — service worker for the Reel Builder, scope /video only.
// Caches the 32 MB ffmpeg engine (versioned CDN URLs) so it survives Safari's cache eviction.
// Bump CACHE when the engine version in video.html changes.
const CACHE = 'rb-engine-0.12.10';
const isEngine = (u) => /\/ffmpeg-core(\.worker)?\.(js|wasm)$/.test(u.pathname);

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const u = new URL(e.request.url);
  if (!isEngine(u)) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(e.request);
    if (hit) return hit;
    const resp = await fetch(e.request);
    if (resp.ok && (resp.type === 'basic' || resp.type === 'cors')) cache.put(e.request, resp.clone()).catch(() => {});
    return resp;
  })());
});
