// ============================================================
// STOPTRACK - SERVICE WORKER
// ETAPA 2: CACHE LOCAL + OFFLINE + VERSIONAMENTO
// ============================================================

// Versão explícita do cache.
// Incremente em conjunto com o versionamento dos arquivos
// estáticos no index.html para forçar uma nova instalação.
const CACHE_NAME = "stoptrack-cache-v2";

const VERSAO_ARQUIVOS = "20260922";

// ÚNICOS arquivos estáticos locais realmente utilizados pelo
// STOPTRACK. O index.html, o script.js e o style.css fazem
// referência somente aos recursos desta lista.
const ARQUIVOS_OFFLINE = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js?v=" + VERSAO_ARQUIVOS,
    "./manifest.json",
    "./assets/stoptrack-icon-512_043602.png",
    "./assets/file_000000004764820eb8f0f51f624efbd6.jpg"
];


// ============================================================
// INSTALAR
// ============================================================

self.addEventListener("install", function(evento) {

    evento
        .waitUntil(
            caches
                .open(CACHE_NAME)
                .then(function(cache) {

                    console.log(
                        "SW: instalando cache " +
                        CACHE_NAME
                    );

                    return cache.addAll(ARQUIVOS_OFFLINE);
                })
                .then(function() {

                    // Ativa a nova versão sem esperar
                    // o fechamento das abas antigas.
                    return self.skipWaiting();
                })
        );
});


// ============================================================
// ATIVAR
// ============================================================

self.addEventListener("activate", function(evento) {

    event
        .waitUntil(
            caches
                .keys()
                .then(function(nomesCaches) {

                    return Promise.all(
                        nomesCaches
                            .filter(function(nome) {

                                return (
                                    nome !== CACHE_NAME &&
                                    nome.indexOf("stoptrack-cache-") === 0
                                );
                            })
                            .map(function(nome) {

                                console.log(
                                    "SW: removendo cache antigo " +
                                    nome
                                );

                                return caches.delete(nome);
                            })
                    );
                })
                .then(function() {

                    // Assume o controle das páginas
                    // já abertas quando apropriado.
                    return self.clients.claim();
                })
        );
});


// ============================================================
// INTERCEPTAR REQUISIÇÕES
// ============================================================

self.addEventListener("fetch", function(evento) {

    var requisicao = evento.request;

    if (requisicao.method !== "GET") {
        return;
    }

    var url = new URL(requisicao.url);

    // REQUISIÇÕES EXTERNAS (CDNs, Supabase, APIs):
    // passam normalmente pela rede. O Service Worker
    // NÃO bloqueia nem armazena essas respostas no cache.
    if (url.origin !== self.location.origin) {
        return;
    }

    // ========================================================
    // NAVEGAÇÃO (index.html)
    // Estratégia: NETWORK FIRST, cache como reserva offline.
    // Garante que o HTML sempre acompanhe a versão mais nova,
    // sem quebrar o uso offline.
    // ========================================================

    if (requisicao.mode === "navigate") {

        event
            .respondWith(
                fetch(requisicao)
                    .then(function(respostaRede) {

                        if (respostaRede && respostaRede.ok) {

                            var copia =
                                respostaRede.clone();

                            caches
                                .open(CACHE_NAME)
                                .then(function(cache) {

                                    cache.put(
                                        "./index.html",
                                        copia
                                    );
                                });
                        }

                        return respostaRede;
                    })
                    .catch(function() {

                        return caches
                            .match("./index.html")
                            .then(function(respostaCache) {

                                if (respostaCache) {
                                    return respostaCache;
                                }

                                return caches.match("./");
                            });
                    })
            );

        return;
    }

    // ========================================================
    // ARQUIVOS ESTÁTICOS LOCAIS
    // Estratégia: CACHE FIRST com revalidação silenciosa.
    // Se estiver online, atualiza o cache em segundo plano.
    // ========================================================

    event
        .respondWith(
            caches
                .match(requisicao)
                .then(function(respostaCache) {

                    var buscarRede =
                        fetch(requisicao)
                            .then(function(respostaRede) {

                                if (
                                    respostaRede &&
                                    respostaRede.ok &&
                                    respostaRede.type === "basic"
                                ) {

                                    var copia =
                                        respostaRede.clone();

                                    caches
                                        .open(CACHE_NAME)
                                        .then(function(cache) {

                                            cache.put(
                                                requisicao,
                                                copia
                                            );
                                        });
                                }

                                return respostaRede;
                            })
                            .catch(function() {

                                return respostaCache;
                            });

                    if (respostaCache) {
                        return respostaCache;
                    }

                    return buscarRede;
                })
        );
});