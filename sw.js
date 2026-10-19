const CACHE = 'hogar-v11';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './icon-maskable-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network-first for our own files (so updates arrive), cache as offline fallback.
// Supabase and CDN requests are never cached.
const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (e.request.url === LIB) { // librería fija por versión: caché primero
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// ---- Avisos push ----
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) {}
  e.waitUntil(self.registration.showNotification(d.title || 'Nuestro Hogar', {
    body: d.body || '',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    data: { tab: d.tab || 'cal' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const tab = (e.notification.data && e.notification.data.tab) || 'cal';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    if (list.length) { const c = list[0]; c.postMessage({ tab }); return c.focus(); }
    return self.clients.openWindow('./?tab=' + tab);
  }));
});
