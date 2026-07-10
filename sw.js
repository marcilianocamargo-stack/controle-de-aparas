const CACHE = 'aparas-v1';
const SHARE_CACHE = 'aparas-share-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE && k !== SHARE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Recebe o PDF compartilhado direto do WhatsApp (Web Share Target).
  // Como o site é estático (sem servidor), guardamos o arquivo no Cache Storage
  // e a página lê ele assim que abre com ?shared=1.
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-pdf')) {
    e.respondWith((async () => {
      try {
        const formData = await e.request.formData();
        const file = formData.get('pdf');
        if (file) {
          const cache = await caches.open(SHARE_CACHE);
          await cache.put('./shared-pdf', new Response(file, { headers: { 'Content-Type': file.type || 'application/pdf' } }));
        }
      } catch (err) { /* segue mesmo se der erro, usuário anexa manualmente */ }
      return Response.redirect('./index.html?shared=1', 303);
    })());
    return;
  }

  const isHtml = e.request.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname.endsWith('/');

  if (isHtml) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const clone = resp.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
