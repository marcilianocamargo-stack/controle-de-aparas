const CACHE = 'aparas-v2';
const SHARE_CACHE = 'aparas-share-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
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

  // Recebe o(s) arquivo(s) JSON/TXT extraídos no NotebookLM, compartilhados direto
  // (Web Share Target). Suporta compartilhar vários de uma vez.
  // Como o site é estático (sem servidor), guardamos os arquivos no Cache Storage
  // e a página lê eles assim que abre com ?shared=1.
  if (e.request.method === 'POST' && url.pathname.endsWith('/share-ocr')) {
    e.respondWith((async () => {
      try {
        const formData = await e.request.formData();
        const files = formData.getAll('ocr');
        const cache = await caches.open(SHARE_CACHE);
        const antigos = await cache.keys();
        await Promise.all(antigos.filter(r => r.url.includes('/shared-ocr-')).map(r => cache.delete(r)));
        await Promise.all(files.map((file, i) =>
          cache.put('./shared-ocr-' + i, new Response(file, { headers: { 'Content-Type': file.type || 'text/plain' } }))
        ));
      } catch (err) { /* segue mesmo se der erro, usuário importa manualmente */ }
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
