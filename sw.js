// --- Ficheiro: sw.js ---
const NOME_CACHE = 'leitor-musica-v6'; // Incremente a versão se alterar os ficheiros

// Lista de ficheiros essenciais para funcionar offline
const ARQUIVOS_CACHE = [
    './index.html',
    './manifest.json',
    // Adicione aqui outros ficheiros estáticos essenciais se os tiver localmente:
    // './estilos.css',
    // './script.js',
    // Nota: Ficheiros de CDNs (como Tailwind e FontAwesome) serão cacheados dinamicamente pelo fetch(), mas adicione-os aqui se preferir.
];

// 1. Instalação: Guardar os ficheiros essenciais no cache
self.addEventListener('install', (event) => {
    console.log('SW: A instalar...');
    event.waitUntil(
        caches.open(NOME_CACHE)
            .then((cache) => {
                console.log('SW: A adicionar ficheiros essenciais ao cache');
                return cache.addAll(ARQUIVOS_CACHE);
            })
    );
    // Força o SW a assumir o controlo imediatamente após a instalação
    self.skipWaiting();
});

// 2. Ativação: Limpar caches antigos
self.addEventListener('activate', (event) => {
    console.log('SW: A ativar...');
    event.waitUntil(
        caches.keys().then((chaves) => {
            return Promise.all(
                chaves.filter((chave) => chave !== NOME_CACHE)
                    .map((chave) => {
                        console.log('SW: A remover cache antigo:', chave);
                        return caches.delete(chave);
                    })
            );
        })
    );
    self.clients.claim();
});

// 3. Fetch: Estratégia "Cache First" com fallback para Rede
self.addEventListener('fetch', (event) => {
    // Ignorar pedidos que não sejam HTTP (ex: chrome-extension://)
    if (!event.request.url.startsWith('http')) return;

    event.respondWith(
        caches.match(event.request)
            .then((respostaNoCache) => {
                // Se o ficheiro estiver no cache, retorna-o imediatamente (super rápido, funciona offline)
                if (respostaNoCache) {
                    return respostaNoCache;
                }

                // Se NÃO estiver no cache, tenta buscar na rede
                return fetch(event.request)
                    .then((respostaDaRede) => {
                        // Valida se a resposta da rede é válida (status 200, tipo 'basic')
                        if (!respostaDaRede || respostaDaRede.status !== 200 || respostaDaRede.type !== 'basic') {
                            return respostaDaRede;
                        }

                        // Opcional: Clona a resposta da rede e guarda no cache para a próxima vez
                        let respostaParaCache = respostaDaRede.clone();
                        caches.open(NOME_CACHE).then((cache) => {
                            cache.put(event.request, respostaParaCache);
                        });

                        return respostaDaRede;
                    })
                    .catch(() => {
                        // Se ambos falharem (sem cache E sem rede), mostra uma página de erro padrão OU um fallback de erro
                        // Se o pedido original for para uma página HTML, retorna o index.html (que está em cache)
                        if (event.request.headers.get('accept').includes('text/html')) {
                             return caches.match('./index.html');
                        }
                        // Para outros tipos de ficheiros (imagens, etc.), pode retornar um fallback genérico, se tiver
                        // return caches.match('./offline.svg');
                    });
            })
    );
});
