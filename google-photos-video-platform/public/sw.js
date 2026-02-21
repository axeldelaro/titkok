// Service Worker — minimal cache-first for offline shell
const CACHE_NAME = 'titkok-v1';
const SHELL_ASSETS = ['/', '/index.html'];

self.addEventListener('install', (e) => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    // Network-first for API/Google calls, cache-first for assets
    if (e.request.url.includes('googleapis') || e.request.url.includes('accounts.google')) {
        return; // let network handle auth/API calls
    }
    e.respondWith(
        fetch(e.request)
            .then(res => {
                if (res.ok && e.request.method === 'GET') {
                    const clone = res.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
                }
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
