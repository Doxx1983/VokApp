const V = 'woerter-sammler-v55';
const FILES = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable-512.png', './fonts/nunito.woff', './fonts/baloo2.woff', ...Array.from({length:10},(_,i)=>'./backs/'+(i+1)+'.svg')];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== V && k !== 'share-inbox').map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Netzwerk zuerst, damit Updates ankommen; ohne Netz kommt die gespeicherte Version.
self.addEventListener('fetch', e => {
  const req = e.request;
  // Abgleich-Datei über das Teilen-Menü (Web Share Target): zwischenspeichern und App öffnen
  if (req.method === 'POST' && new URL(req.url).searchParams.has('share-target')) {
    e.respondWith((async () => {
      try {
        const f = (await req.formData()).get('file');
        if (f) await (await caches.open('share-inbox')).put('./shared-file', new Response(f));
      } catch (err) {}
      return Response.redirect('./index.html?shared=1', 303);
    })());
    return;
  }
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => {
        const copy = res.clone();
        caches.open(V).then(c => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then(m => m || caches.match('./index.html')))
  );
});
