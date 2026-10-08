// Leitor Offline — Service Worker v52 (tudo local; GitHub Pages: no-cache evita os 10 min de cache HTTP)
const CACHE_APP = 'leitor-app-v52';

const APP_SHELL = [
    './', './index.html', './manifest.json', './icon.svg',
    './politica-privacidade.html', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png',
    './vendor/jsmediatags.min.js',
    './vendor/font-awesome/css/font-awesome.min.css',
    './vendor/font-awesome/fonts/fontawesome-webfont.woff2'
];
const TIMEOUT_REDE_MS = 3000;

// Respostas redirecionadas não podem servir navegações: reconstruir
async function limpar(resp) {
    if (!resp.redirected) return resp;
    const corpo = await resp.blob();
    return new Response(corpo, { status: 200, statusText: 'OK', headers: resp.headers });
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_APP);
        await Promise.allSettled(APP_SHELL.map(async u => {
            const r = await fetch(u, { cache: 'reload' });
            if (!r.ok) throw new Error(u);
            await cache.put(u, await limpar(r));
        }));
    })());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(chaves =>
            Promise.all(chaves.filter(c => c !== CACHE_APP).map(c => caches.delete(c)))
        ).then(() => self.clients.claim())
    );
});

function redeComTimeout(req, ms) {
    return new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('timeout')), ms);
        fetch(req, { cache: 'no-cache' }).then(r => { clearTimeout(t); resolve(r); },
                        e => { clearTimeout(t); reject(e); });
    });
}

async function redePrimeiro(event) {
    const req = event.request;
    try {
        const resp = await redeComTimeout(req, TIMEOUT_REDE_MS);
        if (resp && resp.status === 200 && resp.type === 'basic') {
            const copia = await limpar(resp.clone());
            event.waitUntil(caches.open(CACHE_APP).then(c => c.put(req, copia)));
        }
        return resp;
    } catch (e) {
        const guardada = await caches.match(req, { ignoreSearch: true });
        if (guardada) return guardada;
        if (req.mode === 'navigate') {
            return (await caches.match('./index.html')) || (await caches.match('./')) ||
                   new Response('Sem ligação e sem cópia guardada.', { status: 503 });
        }
        return Response.error();
    }
}

async function cachePrimeiro(req) {
    const guardada = await caches.match(req);
    if (guardada) return guardada;
    const resp = await fetch(req);
    if (resp && resp.ok && resp.type === 'basic') {
        const copia = resp.clone();
        caches.open(CACHE_APP).then(c => c.put(req, copia));
    }
    return resp;
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;

    const rede = req.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname);
    event.respondWith(rede ? redePrimeiro(event) : cachePrimeiro(req));
});
