// Installation de AniMerci sur l'appareil (application web installable) et mises à jour.
// Android / PC / Mac (Chrome, Edge) : bouton « Installer » ; iPhone / iPad (Safari) : explication « Sur l’écran d’accueil ».
import { $, modal, render } from './ui.js';

let invite = null, miseAJourDemandee = false;
const autonome = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); invite = e; render(); });
window.addEventListener('appinstalled', () => { invite = null; render(); });

// Bouton affiché dans le menu et sur l'écran de connexion tant que l'appli n'est pas installée
export function boutonInstaller(clair = false) {
  if (autonome()) return '';
  return clair ? `<p style="margin:14px 0 0;text-align:center"><button class="btn ghost" data-action="pwa-installer">Installer l'application sur cet appareil</button></p>`
    : `<button class="nav-btn" style="padding:6px 0;font-size:13px" data-action="pwa-installer">Installer l'application</button>`;
}

function aide() {
  modal(`<h2>Installer l'application</h2>
  <p>L'installation est gratuite et ajoute une icône sur l'appareil, comme une application. Elle ne passe pas par un magasin d'applications.</p>
  <h3>iPhone et iPad (Safari)</h3><p>Touchez le bouton <b>Partager</b> (carré avec une flèche), puis <b>Sur l'écran d'accueil</b>, puis <b>Ajouter</b>.</p>
  <h3>Android (téléphone ou tablette, Chrome)</h3><p>Menu <b>⋮</b>, puis <b>Installer l'application</b> (ou « Ajouter à l'écran d'accueil »).</p>
  <h3>PC ou Mac (Chrome ou Edge)</h3><p>Cliquez sur l'icône d'installation à droite de la barre d'adresse, ou menu <b>⋮</b> puis <b>Installer</b>. Sur Mac avec Safari : menu <b>Fichier</b>, puis <b>Ajouter au Dock</b>.</p>
  <div class="quick" style="margin-top:12px"><button class="btn" data-action="close">Fermer</button></div>`);
}

export const actions = {
  'pwa-installer': async () => {
    if (invite) {
      const p = invite; invite = null;
      try { await p.prompt(); await p.userChoice; } catch (e) { /* refus ou fenêtre fermée */ }
      render();
    } else aide();
  }
};

function proposerMiseAJour(worker) {
  if ($('#maj')) return;
  const b = document.createElement('div');
  b.id = 'maj'; b.setAttribute('role', 'status');
    b.innerHTML = `<span style="flex:1">Une nouvelle version de l'application est disponible.</span><button class="btn" id="maj-ok" style="white-space:nowrap">Mettre à jour</button><button class="btn ghost" id="maj-non" aria-label="Plus tard" style="color:#fff">✕</button>`;
  document.body.appendChild(b);
  $('#maj-ok').onclick = () => { miseAJourDemandee = true; worker.postMessage('SKIP_WAITING'); };
  $('#maj-non').onclick = () => b.remove();
}

export function enregistrer() {
  if (!('serviceWorker' in navigator) || !(location.protocol === 'https:' || location.hostname === 'localhost')) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (miseAJourDemandee) location.reload(); });
  navigator.serviceWorker.register('sw.js').then(reg => {
    const surveiller = w => w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) proposerMiseAJour(w); });
    if (reg.waiting && navigator.serviceWorker.controller) proposerMiseAJour(reg.waiting);
    reg.addEventListener('updatefound', () => { if (reg.installing) surveiller(reg.installing); });
    const verifier = () => reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verifier(); });
    setInterval(verifier, 60 * 60 * 1000);
  }).catch(() => {});
}
