// Leitor Offline — Service Worker v39 (GitHub Pages: no-cache evita os 10 min de cache HTTP)
const CACHE_APP = 'leitor-app-v39';
const CACHE_CDN = 'leitor-cdn-v1'; // persiste entre versões da app
const MANTER = [CACHE_APP, CACHE_CDN];

const APP_SHELL = [
    './', './index.html', './manifest.json', './icon.svg',
    './icon-192.png', './icon-512.png', './icon-maskable-512.png', './apple-touch-icon.png'
];
const CDN_CSS = 'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css';
const CDN_JS  = ['https://cdn.jsdelivr.net/npm/jsmediatags@3.9.7/dist/jsmediatags.min.js'];
const TIMEOUT_REDE_MS = 3000;

// Respostas redirecionadas não podem servir navegações: reconstruir
async function limpar(resp) {
    if (!resp.redirected) return resp;
    const corpo = await resp.blob();
    return new Response(corpo, { status: 200, statusText: 'OK', headers: resp.headers });
}

async function guardar(cache, url, opts) {
    const resp = await fetch(url, opts);
    if (!resp.ok) throw new Error(url + ' ' + resp.status);
    await cache.put(url, await limpar(resp.clone()));
    return resp;
}

async function precacheCDN() {
    const cache = await caches.open(CACHE_CDN);
    await Promise.allSettled(CDN_JS.map(u => guardar(cache, u, { mode: 'cors' })));
    try {
        const css = await guardar(cache, CDN_CSS, { mode: 'cors' });
        const texto = await css.text();
        const fontes = new Set();
        for (const m of texto.matchAll(/url\(([^)]+)\)/g)) {
            const bruto = m[1].replace(/['"]/g, '').trim();
            if (bruto.startsWith('data:')) continue;
            fontes.add(new URL(bruto, CDN_CSS).href.split('#')[0]);
        }
        await Promise.allSettled([...fontes].map(u => guardar(cache, u, { mode: 'cors' })));
    } catch (e) { console.warn('SW: falhou CSS/fontes do CDN', e); }
}

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        const cache = await caches.open(CACHE_APP);
        await Promise.allSettled(APP_SHELL.map(async u => {
            const r = await fetch(u, { cache: 'reload' });
            if (!r.ok) throw new Error(u);
            await cache.put(u, await limpar(r));
        }));
        await precacheCDN();
    })());
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(chaves =>
            Promise.all(chaves.filter(c => !MANTER.includes(c)).map(c => caches.delete(c)))
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

async function cachePrimeiro(req, nomeCache) {
    const guardada = await caches.match(req);
    if (guardada) return guardada;
    const resp = await fetch(req);
    if (resp && resp.ok) {
        const copia = resp.clone();
        caches.open(nomeCache).then(c => c.put(req, copia));
    }
    return resp;
}

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    if (url.origin !== self.location.origin) {
        if (url.hostname === 'cdn.jsdelivr.net') {
            event.respondWith(cachePrimeiro(req, CACHE_CDN));
        }
        return;
    }

    const rede = req.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname);
    event.respondWith(rede ? redePrimeiro(event) : cachePrimeiro(req, CACHE_APP));
});
