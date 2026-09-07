// Versão do cache (mude isto quando alterar os ficheiros do site)
const NOME_CACHE = 'leitor-musica-v6';
const ARQUIVOS_CACHE = [
    './index.html',
    './manifest.json',
    // Adicione aqui outros ficheiros essenciais se necessário, como CSS ou JS externos
    // Exemplo: 'https://cdn.tailwindcss.com',
    // Exemplo: 'https://cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.min.css'
];

// Evento de Instalação: O Service Worker é registado e os ficheiros são guardados no cache.
self.addEventListener('install', (event) => {
    console.log('SW: A instalar...');
    event.waitUntil(
        caches.open(NOME_CACHE)
            .then((cache) => {
                console.log('SW: A abrir cache e adicionar ficheiros');
                return cache.addAll(ARQUIVOS_CACHE)
                    .catch((erro) => {
                        console.error('SW: Falha ao adicionar ficheiros ao cache:', erro);
                    });
            })
    );
    // Força o SW a passar para o estado de ativação imediatamente após a instalação.
    self.skipWaiting();
});

// Evento de Ativação: O Service Worker antigo é removido e o novo assume o controlo.
self.addEventListener('activate', (event) => {
    console.log('SW: A ativar...');
    event.waitUntil(
        caches.keys().then((chaves) => {
            return Promise.all(
                chaves.filter((chave) => chave !== NOME_CACHE) // Remove caches antigos
                    .map((chave) => {
                        console.log('SW: A remover cache antigo:', chave);
                        return caches.delete(chave);
                    })
            );
        })
    );
    // O SW assume o controlo de todas as páginas abertas imediatamente.
    self.clients.claim();
});

// Evento de Fetch: Intercepta pedidos de rede e serve do cache se estiver disponível.
self.addEventListener('fetch', (event) => {
    // Estratégia: Cache-first, com fallback para rede.
    event.respondWith(
        caches.match(event.request)
            .then((respostaNoCache) => {
                // Se encontrar no cache, retorna a resposta.
                if (respostaNoCache) {
                    return respostaNoCache;
                }

                // Se não encontrar, tenta buscar na rede.
                return fetch(event.request).then((respostaDaRede) => {
                    // Valida a resposta da rede.
                    if (!respostaDaRede || respostaDaRede.status !== 200 || respostaDaRede.type !== 'basic') {
                        return respostaDaRede;
                    }

                    // Opcional: Clona a resposta da rede e guarda no cache para a próxima vez.
                    let respostaParaCache = respostaDaRede.clone();
                    caches.open(NOME_CACHE)
                        .then((cache) => {
                            cache.put(event.request, respostaParaCache);
                        });

                    return respostaDaRede;
                });
            })
            .catch(() => {
                // Opcional: Se ambos falharem (sem cache e sem rede), pode retornar um fallback, como uma página de "sem conexão".
                // return caches.match('./offline.html'); 
            })
    );
});
