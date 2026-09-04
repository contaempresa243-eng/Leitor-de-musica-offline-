const NOME_CACHE = 'leitor-musica-v5';
const ARQUIVOS_CACHE = ['./index.html', './manifest.json'];

self.addEventListener('install', (e) => {
    e.waitUntil(caches.open(NOME_CACHE).then(cache => cache.addAll(ARQUIVOS_CACHE)));
    self.skipWaiting();
});

self.addEventListener('activate', (e) => {
    e.waitUntil(caches.keys().then(chaves => Promise.all(
        chaves.filter(c => c !== NOME_CACHE).map(c => caches.delete(c))
    )));
    self.clients.claim();
});

self.addEventListener('fetch', (e) => {
    e.respondWith(
        caches.match(e.request).then(r => r || fetch(e.request).then(novaR => {
            caches.open(NOME_CACHE).then(c => c.put(e.request, novaR.clone()));
            return novaR;
        }))
    );
});
