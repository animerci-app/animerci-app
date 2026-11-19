// Écran « Sécurité » : Sauvegarde, Corbeille (30 jours), Journal des modifications, listes d'émargement papier.
import { store } from './store.js';
import * as L from './logic.js';
import { S, esc, render, toast, aujourdhui, ajouterJours, journaliser, TYPES_OBJET } from './ui.js';
import { P } from './parametres.js';
import { sauvegarde, brancher as brancherSauvegarde, actions as actionsSauvegarde, imprimer } from './backup.js';

const JOURS_CORBEILLE = () => P('securite.joursCorbeille'), JOURS_JOURNAL = () => P('securite.joursJournal');
const frDate = d => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '');
const frHeure = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); };
const jours = iso => Math.floor((Date.now() - new Date(iso)) / 864e5);
let onglet = 'sauvegarde';
export const ongletCourant = () => onglet;

export function securite() {
  const T = [['sauvegarde', 'Sauvegarde'], ['corbeille', 'Corbeille'], ['journal', 'Journal']];
  const corps = onglet === 'corbeille' ? vueCorbeille() : onglet === 'journal' ? vueJournal() : sauvegarde() + secoursPapier();
  return `<div class="top"><div><h1>Sécurité</h1><p>Protéger vos données : copies, récupération d'une erreur, historique.</p></div></div>
  <div class="filters" role="tablist">${T.map(([k, l]) => `<button role="tab" data-action="sec-tab" data-v="${k}" aria-pressed="${onglet === k}">${esc(l)}</button>`).join('')}</div>${corps}`;
}
export function apresSecurite() { if (onglet === 'sauvegarde') brancherSauvegarde(); }

/* ---------- Corbeille ---------- */
function vueCorbeille() {
  const rows = [...S.cache.corbeille].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="card" style="margin-bottom:14px"><p class="sub" style="margin:0">Ce que vous supprimez est gardé ${JOURS_CORBEILLE()} jours ici, puis effacé définitivement. Les <b>fiches de sortie</b> (santé) ne passent jamais par la corbeille : elles sont effacées pour de bon.</p></div>` +
    (rows.length ? rows.map(e => {
      const reste = Math.max(0, JOURS_CORBEILLE() - jours(e.date)), n = Object.values(e.liens || {}).reduce((t, l) => t + l.length, 0);
      return `<div class="cand" style="cursor:default"><span style="flex:1"><b>${esc(e.label || '(sans nom)')}</b>
        <span class="why"><span class="pill p-rose">${esc(TYPES_OBJET[e.col] || e.col)}</span><span class="pill p-bleu">Supprimé le ${esc(frHeure(e.date))}${e.par ? ' par ' + esc(e.par) : ''}</span>${n ? `<span class="pill p-rose">+ ${n} élément${n > 1 ? 's' : ''} lié${n > 1 ? 's' : ''}</span>` : ''}<span class="pill p-warn">Effacé définitivement dans ${reste} jour${reste > 1 ? 's' : ''}</span></span></span>
        <button class="btn" data-action="corbeille-restaurer" data-id="${esc(e.id)}">Restaurer</button></div>`;
    }).join('') : '<div class="empty"><b>La corbeille est vide</b>Les personnes, activités, tâches et inscriptions supprimées apparaîtront ici.</div>');
}
async function restaurer(id) {
  const e = S.cache.corbeille.find(x => x.id === id); if (!e) return;
  await store.save(e.col, e.doc);
  for (const [col, liste] of Object.entries(e.liens || {})) for (const r of liste) await store.save(col, r);
  await store.remove('corbeille', id);
  journaliser('Restauré', e.col, e.doc);
  toast('Restauré : ' + (e.label || ''));
}

/* ---------- Journal ---------- */
function vueJournal() {
  const rows = [...S.cache.journal].sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="card" style="margin-bottom:14px"><p class="sub" style="margin:0">Qui a créé, modifié, supprimé ou restauré quoi, et quand (conservé ${JOURS_JOURNAL()} jours). Pour retrouver l'origine d'une erreur. Les 150 dernières lignes sont affichées.</p></div>` +
    (rows.length ? `<div class="card" style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${['Date et heure', 'Par', 'Action', 'Type', 'Élément'].map(c => `<th style="text-align:left;border-bottom:2px solid #000;padding:6px">${c}</th>`).join('')}</tr></thead><tbody>${rows.slice(0, 150).map(j => `<tr>${[frHeure(j.date), j.par, j.action, j.type, j.objet].map(v => `<td style="border-bottom:1px solid #ccc;padding:6px;vertical-align:top">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`
      : '<div class="empty"><b>Journal vide</b>Les créations, modifications et suppressions seront notées ici.</div>');
}

/* ---------- Secours papier : listes d'émargement ---------- */
function secoursPapier() {
  return `<div class="card" style="margin-top:14px"><h2 style="margin-top:0">3. Secours papier</h2>
    <p class="sub">Si l'outil ne fonctionne plus, les activités continuent avec des feuilles de présence à signer. À ressaisir ensuite dans l'outil.</p>
    <div class="quick"><button class="btn sec" data-action="emargement-semaines">Imprimer les listes des ${P('securite.horizonEmargementJours')} prochains jours</button></div></div>`;
}
export const emargementBouton = () => '<button class="btn sec" data-action="emargement-activite">Imprimer la liste d\'émargement</button>';
// Repère imprimé après le nom (si les fiches sont chargées) : public, et cotisation à régler
function repere(i) {
  const sn = i.seniorId ? S.cache.seniors.find(x => x.id === i.seniorId) : null;
  if (!sn) return '';
  return ` <small>(${esc(L.libelleStatut(sn.statut))}${L.cotisationARegler(sn) ? ' · cotisation à régler' : ''})</small>`;
}
function listeHtml(a, inscriptions) {
  const ins = inscriptions.filter(i => ['inscrit', 'invite'].includes(i.statut)).sort((x, y) => (x.seniorNom || '').localeCompare(y.seniorNom || '', 'fr'));
  const vides = Array.from({ length: 4 }, () => ({ seniorNom: '' }));
  const lignes = ins.concat(vides).map((i, k) => `<tr><td class="n">${k + 1}</td><td class="nom">${esc(i.seniorNom)}${repere(i)}</td><td class="c">☐</td><td class="c">☐</td><td class="c">☐</td><td class="sig"></td></tr>`).join('');
  return `<section><h1>Feuille de présence</h1><h2>${esc(a.nom)}</h2>
    <p>Date : ${a.date ? esc(frDate(a.date)) : '____ / ____ / ________'} &nbsp; ${a.jour ? '· ' + esc(a.jour) : ''} &nbsp; ${a.lieu ? '· Lieu : ' + esc(a.lieu) : ''} &nbsp; ${a.interv ? '· Intervenant·e : ' + esc(a.interv) : ''}</p>
    <table><thead><tr><th>N°</th><th>Nom et prénom</th><th>Présent·e</th><th>Absent·e</th><th>Excusé·e</th><th>Signature</th></tr></thead><tbody>${lignes}</tbody></table>
    <p class="pied">Les 4 dernières lignes servent aux personnes non inscrites. Imprimé le ${esc(frDate(aujourdhui()))}. À ressaisir dans l'outil : Activités &gt; Faire l'appel.</p></section>`;
}
async function impression(acts) {
  if (!acts.length) return toast('Aucune activité à imprimer.');
  // inscriptions lues à la demande (seulement celles des activités imprimées)
  const listes = [];
  for (const a of acts) listes.push(await store.lire('inscriptions', ['activiteId', '==', a.id]));
  imprimer(`<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>Feuilles de présence</title><style>@page{size:A4 portrait;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#000}
  section{page-break-after:always}section:last-child{page-break-after:auto}h1{font-size:18pt;margin:0}h2{font-size:14pt;margin:2pt 0 8pt}
  table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:7pt 5pt;text-align:left}th{background:#d9d9d9}td.n{width:28pt;text-align:center}td.c{width:56pt;text-align:center;font-size:14pt}td.sig{width:130pt}.pied{font-size:9pt;margin-top:8pt}</style></head><body>${acts.map((a, k) => listeHtml(a, listes[k])).join('')}</body></html>`);
}

export const actions = {
  ...actionsSauvegarde,
  'sec-tab': el => { onglet = el.dataset.v; render(); },
  'corbeille-restaurer': el => restaurer(el.dataset.id),
  'emargement-activite': () => impression(S.cache.activites.filter(a => a.id === S.actId)),
  'emargement-semaines': () => { const auj = aujourdhui(), fin = ajouterJours(auj, P('securite.horizonEmargementJours')); impression(S.cache.activites.filter(a => a.date && a.date >= auj && a.date <= fin).sort((a, b) => a.date.localeCompare(b.date))); }
};

// Nettoyage automatique (administratrice) : corbeille > 30 jours, journal > 365 jours
export async function purger() {
  if (!S.user || S.user.role !== 'admin') return;
  try {
    // une fois par jour et par appareil (chaque vérification coûte au moins une lecture)
    const j = aujourdhui(); if (localStorage.getItem('animerci-purge') === j) return;
    await store.supprimerAvant('corbeille', 'date', new Date(Date.now() - JOURS_CORBEILLE() * 864e5).toISOString());
    await store.supprimerAvant('journal', 'date', new Date(Date.now() - JOURS_JOURNAL() * 864e5).toISOString());
    localStorage.setItem('animerci-purge', j);
  } catch (e) { console.warn('purge', e); }
}
