// Service worker: habilita instalación PWA + cache mínimo, sin riesgo de servir
// una versión vieja de la app. Dos estrategias, todo lo demás (Supabase, dolarapi,
// coinbase, /api/quote) pasa directo a red sin cachear, igual que antes.
const CACHE_NAME = 'finanzas-shell-v1';
const CDN_HOSTS = ['cdnjs.cloudflare.com', 'cdn.jsdelivr.net'];

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)));
    await clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return; // no interceptar escrituras (Supabase, etc.)
  const url = new URL(e.request.url);

  // CDN scripts versionados con hash SRI (Chart.js, supabase-js, canvas-confetti,
  // lucide) — inmutables por definición, cache-first sin riesgo de servir versión vieja.
  if (CDN_HOSTS.includes(url.hostname)) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  // Shell de la app (el index.html en sí): siempre intenta red primero, para que un
  // deploy nuevo se vea al instante con conexión — solo cae al cache si falla la red.
  if (e.request.mode === 'navigate' || (url.origin === self.location.origin && url.pathname === '/')) {
    e.respondWith(
      fetch(e.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Todo lo demás (Supabase, dolarapi, coinbase, /api/quote): sin cachear, como antes.
  e.respondWith(fetch(e.request));
});
