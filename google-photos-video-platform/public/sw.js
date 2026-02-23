// Service Worker — shell + media thumbnail caching for offline use
const CACHE_VERSION = 'titkok-v3';
const SHELL_ASSETS = ['/', '/index.html'];
// Google Photos thumbnail sizes we want to cache for offline
const PHOTO_CACHE = 'titkok-photos-v1';
const VIDEO_CACHE = 'titkok-videos-v1';

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_VERSION).then(cache => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(k => k !== CACHE_VERSION && k !== PHOTO_CACHE && k !== VIDEO_CACHE)
                    .map(k => caches.delete(k))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    const url = e.request.url;

    // Skip OAuth / API write calls
    if (url.includes('accounts.google') || url.includes('oauth')) return;
    if (e.request.method !== 'GET') return;

    // Google Photos media thumbnails → cache-first with network fallback
    if (url.includes('lh3.googleusercontent.com') || url.includes('photos.google.com')) {
        e.respondWith(
            caches.open(url.includes('=dv') ? VIDEO_CACHE : PHOTO_CACHE).then(async cache => {
                const cached = await cache.match(e.request);
                if (cached) return cached;
                try {
                    const res = await fetch(e.request);
                    if (res.ok) cache.put(e.request, res.clone());
                    return res;
                } catch {
                    return cached || new Response('', { status: 504 });
                }
            })
        );
        return;
    }

    // Google Photos API calls → network-first, no cache
    if (url.includes('photoslibrary.googleapis.com')) return;

    // JS/CSS/font assets → cache-first
    e.respondWith(
        caches.open(CACHE_VERSION).then(async cache => {
            const cached = await cache.match(e.request);
            if (cached) return cached;
            try {
                const res = await fetch(e.request);
                if (res.ok) cache.put(e.request, res.clone());
                return res;
            } catch {
                return cached || new Response('Offline', { status: 503 });
            }
        })
    );
});

// Clean up old photo cache entries when quota is needed
self.addEventListener('message', (e) => {
    if (e.data?.type === 'CLEAR_MEDIA_CACHE') {
        Promise.all([
            caches.delete(PHOTO_CACHE),
            caches.delete(VIDEO_CACHE)
        ]).then(() => {
            e.source?.postMessage({ type: 'MEDIA_CACHE_CLEARED' });
        });
    }
});
