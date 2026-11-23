// Service worker de AniMerci : permet l'installation et le démarrage même hors connexion.
// IMPORTANT (confidentialité) : seuls les fichiers du PROGRAMME (même adresse) et le SDK Firebase sont gardés en cache.
// Les données (Firestore, authentification) ne passent jamais par ce cache : elles sont gérées par Firebase.
// Garder VERSION identique à js/version.js (un test le vérifie).
const VERSION = '1.20.0';
const CACHE = 'animerci-' + VERSION;
const COQUILLE = ['./', 'index.html', 'manifest.webmanifest', 'favicon.svg', 'css/style.css', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-192.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/favicon-32.png', 'js/annuaire.js','js/accueils.js','js/app.js','js/backup.js','js/config.js','js/donnees.js','js/fusion.js','js/import-logic.js', 'js/prenoms.js','js/importer.js','js/inscrire.js','js/logic.js','js/materiel.js', 'js/adhesions.js','js/portage.js','js/parametres.js', 'js/partenaires.js','js/pwa.js','js/recherche.js','js/securite.js','js/seeds.js','js/store.js','js/ui.js','js/version.js','js/views-activites.js','js/views-core.js','js/views-equipe.js'];

self.addEventListener('install', e => {
  // Pas de skipWaiting automatique : la mise à jour s'applique quand l'utilisateur l'accepte (message SKIP_WAITING).
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(COQUILLE.map(u => c.add(u).catch(() => {})))));
});
self.addEventListener('message', e => { if (e.data === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('animerci-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const memeSite = url.origin === self.location.origin;
  const sdk = url.origin === 'https://www.gstatic.com' && url.pathname.startsWith('/firebasejs/');
  if (!memeSite && !sdk) return; // données Firebase, polices, etc. : jamais interceptées
  if (sdk) { // fichiers versionnés du SDK : cache d'abord
    e.respondWith(caches.open(CACHE).then(async c => { const h = await c.match(req); if (h) return h; const r = await fetch(req); if (r.ok) c.put(req, r.clone()); return r; }));
    return;
  }
  // Fichiers du programme : réseau d'abord (toujours à jour), cache en secours hors connexion
  e.respondWith((async () => {
    try {
      const r = await fetch(req, { cache: 'no-cache' });
      if (r.ok && r.type === 'basic') { const c = await caches.open(CACHE); c.put(req, r.clone()); }
      return r;
    } catch (err) {
      const c = await caches.open(CACHE);
      return (await c.match(req)) || (req.mode === 'navigate' ? await c.match('index.html') : Response.error());
    }
  })());
});
