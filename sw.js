// Ragnarok eSports - Service Worker. Precarga ligera y caché de imágenes al visitarlas.
const CACHE = 'ragnarok-esports-v15';
const CORE = ['./', './index.html', './script.js', './manifest.webmanifest', './icons/icon.svg', './imagenes/ragnarok-emblema.png', './imagenes/jugador1.png', './imagenes/juego1.jpeg', './imagenes/juego2.jpeg', './imagenes/logogamer.jpeg'];
const CDN = ['https://code.jquery.com/jquery-3.7.1.min.js', 'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.6/purify.min.js', 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4'];
const CDN_HOSTS = ['code.jquery.com', 'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  await Promise.allSettled([
    ...CORE.map(url => cache.add(url)),
    ...CDN.map(url => fetch(new Request(url, { mode: 'no-cors' })).then(res => cache.put(url, res)))
  ]);
  await self.skipWaiting();
})()));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));
const store = (req, res) => { if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return res; };
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) {
    if (!CDN_HOSTS.includes(url.hostname)) return;
    event.respondWith(caches.match(req).then(cached => { const net = fetch(req).then(res => store(req, res)).catch(() => cached); return cached || net; }));
    return;
  }
  if (req.destination === 'image') {
    event.respondWith(caches.match(req).then(cached => cached || fetch(req).then(res => store(req, res)).catch(() => Response.error())));
    return;
  }
  event.respondWith(fetch(req).then(res => store(req, res)).catch(() => caches.match(req).then(c => c || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))));
});
