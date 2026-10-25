// ==========================================
// PetShop Manager - Service Worker (sw.js)
// Suporte PWA Offline-First e Cache Estratégico
// ==========================================

const CACHE_NAME = 'petshop-manager-v2.0';

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

// Instalação do Service Worker e Cache dos Ativos Principais
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('Alguns ativos não puderam ser pré-cacheados:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Ativação e Limpeza de Caches Antigos
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Interceptação de Requisições de Rede (Offline-First)
self.addEventListener('fetch', (event) => {
  // Ignora requisições não-GET e extensões/esquemas especiais
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Retorna do cache imediatamente e tenta atualizar em background (Stale-While-Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse);
            });
          }
        }).catch(() => {/* modo offline */});

        return cachedResponse;
      }

      // Se não estiver no cache, busca na rede
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        // Clona e salva cópia no cache
        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      }).catch(() => {
        // Se a rede falhar e for navegação de página, retorna index.html cacheado
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
