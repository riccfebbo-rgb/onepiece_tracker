/* Anime Tracker — service worker
   Strategia scelta apposta per non "congelare" le tue modifiche:
   - HTML  -> network-first: quando aggiorni index.html su GitHub Pages, la nuova
              versione arriva subito; la copia in cache serve solo se sei offline.
   - resto -> stale-while-revalidate: veloce, ma si aggiorna in background.
   Le chiamate a Firebase e a Jikan NON passano mai dalla cache. */

const VERSION = 'at-v3.0.0';
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;
const PRECACHE = ['./', './index.html', './manifest.json', './icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL && k !== ASSETS).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // niente cache per API, autenticazione e sorgenti dinamiche
  if (/gstatic\.com|googleapis\.com\/identitytoolkit|firestore|jikan\.moe|onepiecepower/.test(url.href)
      && !/fonts\.(googleapis|gstatic)\.com/.test(url.href)) return;

  // 1) navigazioni e HTML -> rete prima, cache come rete di salvataggio
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 2) tutto il resto -> risposta immediata dalla cache, aggiornata in background
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.status === 200 && (res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(ASSETS).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
