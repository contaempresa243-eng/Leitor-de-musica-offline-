// Versão do cache
const NOME_CACHE = 'leitor-musica-v37';
const ARQUIVOS_CACHE = [
    './manifest.json',
    './icon.svg'
    // NÃO incluímos o index.html aqui — ele vai ser sempre da rede
];

// Instalação
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(NOME_CACHE).then(async (cache) => {
            const resultados = await Promise.allSettled(
                ARQUIVOS_CACHE.map(url => cache.add(url))
            );
            resultados.forEach((r, i) => {
                if (r.status === 'rejected') {
                    console.warn('SW: falhou ao cachear', ARQUIVOS_CACHE[i], r.reason);
                }
            });
        })
    );
    self.skipWaiting();
});

// Ativação
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((chaves) => {
            return Promise.all(
                chaves.filter((chave) => chave !== NOME_CACHE)
                    .map((chave) => caches.delete(chave))
            );
        })
    );
    self.clients.claim();
});

// Fetch
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ESTRATÉGIA CRÍTICA: HTML e JS e CSS vêm SEMPRE da rede (network-first).
    // Só os assets estáticos é que vêm do cache.
    if (
        event.request.mode === 'navigate' ||
        url.pathname.endsWith('.html') ||
        url.pathname.endsWith('.js') ||
        url.pathname.endsWith('.css') ||
        url.pathname.endsWith('.json')
    ) {
        event.respondWith(
            fetch(event.request)
                .then((resp) => {
                    // Atualiza o cache em segundo plano
                    if (resp && resp.status === 200 && resp.type === 'basic') {
                        const clone = resp.clone();
                        caches.open(NOME_CACHE).then(c => c.put(event.request, clone));
                    }
                    return resp;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Assets (ícones, imagens, fontes, etc.): cache-first
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((resp) => {
                if (resp && resp.status === 200) {
                    const clone = resp.clone();
                    caches.open(NOME_CACHE).then(c => c.put(event.request, clone));
                }
                return resp;
            });
        })
    );
});