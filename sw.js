// Service worker do Sistema TFD.
// Guarda em cache o "esqueleto" do app (HTML + bibliotecas externas) para abrir mesmo sem internet.
// Importante: os DADOS (pacientes, motoristas etc.) vêm do Supabase e exigem conexão —
// o app abre offline, mas para ver/editar dados novos é preciso estar conectado.

const CACHE_NAME = "tfd-shell-v2";
const ARQUIVOS_PARA_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.5/babel.min.js",
  "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        ARQUIVOS_PARA_CACHE.map((url) =>
          cache.add(url).catch(() => {}) // não trava a instalação se algum arquivo externo falhar
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((nomes) =>
      Promise.all(nomes.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // Nunca cachear chamadas ao Supabase (dados precisam vir sempre da rede, ao vivo)
  if (event.request.url.includes("supabase.co")) return;

  const ehPaginaPrincipal = event.request.mode === "navigate" || event.request.url.endsWith("/index.html");

  if (ehPaginaPrincipal) {
    // Página principal: tenta sempre a rede primeiro, pra nunca travar numa versão antiga.
    // Só usa o cache se estiver realmente sem internet.
    event.respondWith(
      fetch(event.request)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return resposta;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Demais arquivos (bibliotecas externas, ícones): cache primeiro, já que raramente mudam
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copia));
          }
          return resposta;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
