// Éléments communs : état, aides d'affichage, fenêtres, téléchargement.
import { store } from './store.js';
import { uid } from './logic.js';

export const S = {
  user: null,
  cache: { seniors: [], activites: [], inscriptions: [], seances: [], fiches: [], taches: [], contacts: [], echanges: [], conventions: [], users: [], corbeille: [], journal: [], parametres: [] },
  view: 'home', actId: null, tab: 'inscriptions',
  rules: { moins: true, abs: true, res: false },
  moisPlan: null, nbMois: 1, appel: null, filtreTache: 'Toutes', filtreStatutTache: 'tous', recherche: '', filtreStatut: 'tous', filtreContact: 'Tous',
  stat: { du: '', au: '' }, erreur: '', mdpLongueur: 0, navId: 0, compteurs: {}, compteursNav: -1, pret: new Set()
};

// Les données d'un écran sont-elles arrivées ? (évite d'afficher « Aucune personne » pendant le chargement)
export const pret = (col, cle = 'all') => S.pret.has(col + '|' + cle);
export const chargement = (titre) => `<div class="top"><div><h1>${titre}</h1></div></div><div class="card"><div class="empty" role="status"><div class="spin" aria-hidden="true"></div><br><b>Chargement…</b>Lecture des données en cours.<div class="patient">⏳ Un peu de patience : l'application est gratuite et peut mettre quelques secondes à répondre, surtout au premier affichage.</div></div></div>`;

export const $ = s => document.querySelector(s);
export const $$ = s => [...document.querySelectorAll(s)];
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function aujourdhui() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function ajouterJours(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
export function initiales(nom) { return String(nom || '?').split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase(); }
export const JOURS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
export const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dateLongue(iso) { const d = new Date(iso + 'T12:00:00'); return `${JOURS[d.getDay()]} ${d.getDate()} ${MOIS[d.getMonth()]}`; }

let renderFn = () => {};
export const setRender = f => { renderFn = f; };
export const render = () => renderFn();
export function go(view, opts = {}) {
  S.navId++; S.view = view; S.actId = opts.actId || null; S.partId = opts.partId || null; S.tab = opts.tab || 'inscriptions'; S.appel = null;
  render(); window.scrollTo(0, 0);
  const m = $('#main'); if (m) m.focus({ preventScroll: true });
}

// Lenteur : si une opération dure plus de 3 secondes, un message invite à patienter (disparaît dès qu'elle est finie).
export function patienter(promesse, msg = '⏳ Un instant, patience : cela prend un peu plus de temps que d\'habitude…') {
  const t = setTimeout(() => toast(msg), 3000);
  return Promise.resolve(promesse).finally(() => clearTimeout(t));
}

export function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 3500);
}

export function modal(html) {
  const l = $('#layer');
  l.innerHTML = `<div class="modal-bg" id="mbg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  $('#mbg').onclick = e => { if (e.target.id === 'mbg') closeModal(); };
  const first = l.querySelector('input,select,textarea,button'); if (first) first.focus();
}
export function closeModal() { $('#layer').innerHTML = ''; }

export function confirmer(titre, texte, labelOk, onOk) {
  modal(`<h2>${esc(titre)}</h2><p>${esc(texte)}</p>
    <div class="quick" style="margin-top:14px"><button class="btn" id="cfOk">${esc(labelOk)}</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#cfOk').onclick = async () => { closeModal(); try { await onOk(); } catch (e) { toast('Erreur : ' + e.message); } };
}

export function telecharger(nom, contenu, type = 'text/csv;charset=utf-8') {
  try {
    const blob = new Blob([contenu], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) { toast('Téléchargement impossible : ' + e.message); }
}

export async function copier(texte, ok = 'Texte copié') {
  try { await navigator.clipboard.writeText(texte); toast(ok); } catch (e) { toast('Copie impossible : sélectionnez le texte à la main.'); }
}

export function sauver(col, doc, msg) {
  const nouveau = !doc.id || !(S.cache[col] || []).some(x => x.id === doc.id);
  return patienter(store.save(col, doc), '⏳ Enregistrement en cours… un peu de patience.').then(id => { if (msg) toast(msg); journaliser(nouveau ? 'Créé' : 'Modifié', col, { ...doc, id }); return id; }).catch(e => { toast('Enregistrement impossible : ' + e.message); throw e; });
}

/* ---- Journal des modifications et corbeille (30 jours) ---- */
export const TYPES_OBJET = { seniors: 'Personne', activites: 'Activité', taches: 'Tâche', inscriptions: 'Inscription', seances: 'Appel', fiches: 'Fiche de sortie', users: 'Accès équipe', parametres: 'Paramètres', contacts: 'Contact', echanges: 'Échange avec un partenaire', conventions: 'Convention' };
export function etiquette(col, d) {
  const act = id => (S.cache.activites.find(a => a.id === id) || {}).nom || '';
  if (col === 'seniors') return `${d.prenom || ''} ${d.nom || ''}`.trim();
  if (col === 'activites') return d.nom || '';
  if (col === 'taches') return d.titre || '';
  if (col === 'inscriptions') return `${d.seniorNom || ''} — ${act(d.activiteId)}`;
  if (col === 'seances') return `${act(d.activiteId)} du ${d.date || ''}${d.valide ? ' (validé)' : ''}`;
  if (col === 'fiches') return `${d.seniorNom || ''} — ${act(d.activiteId)}`;
  if (col === 'users') return d.nom || d.email || '';
  if (col === 'parametres') return 'Paramètres généraux';
  if (col === 'contacts') return `${d.nom || ''}${d.precision ? ' · ' + d.precision : ''}${d.categorie ? ' (' + d.categorie + ')' : ''}`;
  if (col === 'echanges') return `${d.objet || ''} — ${d.interne ? 'équipe de la résidence' : d.partenaire || ''}${d.date ? ' (' + d.date + ')' : ''}`;
  if (col === 'conventions') return `${d.intitule || ''} — ${d.partenaire || ''}`;
  return '';
}
export async function journaliser(action, col, d) {
  try {
    if (!S.user || !TYPES_OBJET[col]) return;
    await store.save('journal', { id: uid(), date: new Date().toISOString(), par: S.user.nom, action, type: TYPES_OBJET[col], objet: etiquette(col, d) });
  } catch (e) { /* le journal ne doit jamais empêcher d'enregistrer */ }
}
// Met l'élément à la corbeille AVANT sa suppression. `liens` : éléments liés à restaurer avec lui.
export async function mettreCorbeille(col, doc, liens = {}) {
  await store.save('corbeille', { id: uid(), col, label: etiquette(col, doc), date: new Date().toISOString(), par: S.user.nom, doc, liens });
  journaliser('Supprimé', col, doc);
}

export const peutAdmin = () => S.user && S.user.role === 'admin';
export const seniorDe = id => S.cache.seniors.find(s => s.id === id);
export const actDe = id => S.cache.activites.find(a => a.id === id);
export function validees() { return S.cache.seances.filter(s => s.valide); }
