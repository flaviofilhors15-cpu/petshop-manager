// ==========================================
// PetShop Manager - Service Worker (sw.js)
// Estratégia Network-First Segura (Evita ERR_FAILED)
// ==========================================

const CACHE_NAME = 'petshop-manager-v2.11';

const ASSETS_TO_CACHE = [
  './',
  './login.html',
  './admin.html',
  './index.html',
  './agenda.html',
  './clientes.html',
  './vendas.html',
  './estoque.html',
  './financeiro.html',
  './funcionarios.html',
  './relatorios.html',
  './configuracoes.html',
  './css/styles.css',
  './js/app.js',
  './js/auth.js',
  './js/admin.js',
  './js/dashboard.js',
  './js/agenda.js',
  './js/clientes.js',
  './js/vendas.js',
  './js/estoque.js',
  './js/financeiro.js',
  './js/funcionarios.js',
  './js/relatorios.js',
  './js/configuracoes.js',
  './manifest.json',
  './icons/icon.svg'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => self.clients.claim())
  );
});

// Estratégia Network-First: Sempre busca da internet primeiro. Se offline, busca cache.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('./login.html') || caches.match('./index.html');
          }
        });
      })
  );
});
