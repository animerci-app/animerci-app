// Saisie des inscriptions reçues sur papier ou par téléphone (lot E, v1.20.0).
// Réservé aux bénévoles dont l'administratrice a coché « Saisie des inscriptions » (Équipe), avec une date de fin facultative. Les intervenant·es ne le peuvent pas.
// Ces bénévoles ne lisent pas les fiches des personnes : ils consultent une copie restreinte « seniorsLite » (nom, prénom, nom de jeune fille, statut, année de naissance, cotisation à régler),
// sans téléphone ni adresse. Cette copie est tenue à jour par l'administratrice à chaque ouverture de « Personnes » (une écriture par fiche modifiée, aucune lecture en plus).
// Chaque inscription saisie garde « saisi par » et reste modifiable par l'administratrice seule (statut, suppression).
import { store } from './store.js';
import * as L from './logic.js';
import { S, pret, chargement, $, esc, aujourdhui, render, toast, sauver, peutAdmin } from './ui.js';

const SOURCES = ['Téléphone', 'Bulletin papier', 'Accueil de la mairie', 'Sur place'];
const RETENUS = ['inscrit', 'invite'];
const STATUTS = { inscrit: 'Inscrit·e', invite: 'Invité·e', attente: 'En attente', refuse: 'Refusé·e', annule: 'Annulé·e' };

/* ---------- Copie restreinte des personnes : mise en accord par l'administratrice ---------- */
let enCours = false;
export async function synchroLite() {
  if (!peutAdmin() || S.view !== 'seniors' || enCours || S.liteErreur) return;
  if (!pret('seniors') || !pret('parametres')) return;
  const table = (S.cache.parametres.find(x => x.id === 'lite') || {}).h || {};
  const plan = L.planSynchroLite(S.cache.seniors, table);
  if (!plan.ecrire.length && !plan.supprimer.length) return;
  enCours = true;
  try {
    for (const d of plan.ecrire) await store.save('seniorsLite', d);
    for (const id of plan.supprimer) await store.remove('seniorsLite', id);
    await store.save('parametres', { id: 'lite', h: plan.table, le: new Date().toISOString() });
  } catch (e) { S.liteErreur = true; toast('Mise à jour de la liste restreinte impossible : ' + e.message); } finally { enCours = false; }
}

/* ---------- Écran « Inscriptions » ---------- */
const actDe = id => S.cache.activites.find(a => a.id === id);
const inscrDe = id => S.cache.inscriptions.filter(i => i.activiteId === id);
export function inscrire() {
  if (!pret('activites') || !pret('seniorsLite')) return chargement('Inscriptions');
  const acts = [...S.cache.activites].sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr')), a = S.inscrActId ? actDe(S.inscrActId) : null;
  const entete = `<div class="top"><div><h1>Inscriptions</h1><p>Enregistrer une demande reçue sur papier ou par téléphone. Vous voyez seulement le nom, le prénom, le statut et la cotisation à régler. Chaque inscription garde votre nom.</p></div></div>`;
  const choix = `<div class="field" style="max-width:420px;min-width:0"><label for="ins-act">Activité</label><select id="ins-act" data-change="ins-act" style="width:100%;max-width:100%"><option value="">— Choisir une activité —</option>${acts.map(x => `<option value="${esc(x.id)}" ${a && a.id === x.id ? 'selected' : ''}>${esc(x.nom)}${x.date ? ' (' + esc(L.fmtDate(x.date)) + ')' : ''}</option>`).join('')}</select></div>`;
  if (!a) return entete + `<div class="card">${choix}<p class="sub">Choisissez d'abord l'activité concernée.</p></div>`;
  if (!pret('inscriptions', a.id)) return entete + `<div class="card">${choix}</div>` + chargement('Inscriptions');
  const retenus = inscrDe(a.id).filter(i => RETENUS.includes(i.statut)).length, reste = Math.max(0, (Number(a.cap) || 0) - retenus);
  return entete + `<div class="card" style="margin-bottom:14px">${choix}
    <p class="sub" style="margin:0">${reste > 0 ? `Il reste <b>${reste}</b> place${reste > 1 ? 's' : ''} sur ${esc(a.cap)}.` : `<b>L'activité est complète</b> : la personne sera mise en liste d'attente.`}</p>
    <div class="field" style="max-width:300px;margin-top:10px"><label for="ins-src">Demande reçue par</label><select id="ins-src">${SOURCES.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
    <input class="search" id="ins-q" type="search" placeholder="Tapez un nom, un prénom ou un nom de jeune fille…" aria-label="Chercher une personne" autocomplete="off" value="${esc(S.inscrQ || '')}" style="margin-top:6px"></div>
  <div id="ins-liste">${liste()}</div>`;
}
function liste() {
  const a = actDe(S.inscrActId); if (!a) return '';
  const q = String(S.inscrQ || '').trim();
  if (q.length < 2) return '<div class="card"><div class="empty"><b>Cherchez une personne</b>Tapez au moins deux lettres de son nom ou de son prénom.</div></div>';
  const items = S.cache.seniorsLite.map(l => ({ ...l, champs: [l.nom, l.prenom, l.nomNaissance], dates: [] })), { liste: res, total } = L.filtrer(items, q, 10);
  if (!res.length) return '<div class="card"><div class="empty"><b>Aucune personne trouvée</b>La personne n\'a peut-être pas encore de fiche : prévenez l\'administratrice.</div></div>';
  const an = Number(aujourdhui().slice(0, 4)), deja = id => inscrDe(a.id).find(i => i.seniorId === id);
  return (total > res.length ? `<p class="sub">${total} personnes : affinez la recherche (10 affichées).</p>` : '') + res.map(l => {
    const d = deja(l.id), cot = L.cotisationAReglerLite(l, an);
    return `<div class="card" style="margin-bottom:8px"><div class="row" style="align-items:center;gap:10px"><div class="grow"><b>${esc(L.nomLite(l, S.cache.seniorsLite))}</b>
      <div class="sub">${esc(L.libelleStatut(l.statut))}${l.nomNaissance ? ' · née ' + esc(l.nomNaissance) : ''}${l.anneeNaissance ? ' · ' + esc(l.anneeNaissance) : ''}${cot ? ' · <span class="pill p-warn">Cotisation à régler</span>' : ''}</div></div>
      ${d ? `<span class="pill p-ok">Déjà ${esc((STATUTS[d.statut] || d.statut).toLowerCase())}</span>` : `<button class="btn" data-action="ins-go" data-id="${esc(l.id)}">Inscrire</button>`}</div></div>`;
  }).join('');
}
export function apresInscrire() {
  const q = $('#ins-q'); if (q) q.oninput = () => { S.inscrQ = q.value; $('#ins-liste').innerHTML = liste(); };
}
async function inscrireUn(id) {
  const a = actDe(S.inscrActId), l = S.cache.seniorsLite.find(x => x.id === id); if (!a || !l) return;
  if (inscrDe(a.id).some(i => i.seniorId === id)) return toast('Cette personne est déjà inscrite à cette activité.');
  const plein = inscrDe(a.id).filter(i => RETENUS.includes(i.statut)).length >= (Number(a.cap) || 0), source = ($('#ins-src') || {}).value || SOURCES[0];
  await sauver('inscriptions', { activiteId: a.id, seniorId: l.id, seniorNom: L.nomLite(l, S.cache.seniorsLite), statut: plein ? 'attente' : 'inscrit', dateDemande: aujourdhui(), source, par: S.user.nom },
    plein ? 'Activité complète : mise en liste d\'attente' : 'Inscription enregistrée');
  render();
}
export const actions = { 'ins-go': el => inscrireUn(el.dataset.id) };
export const changes = { 'ins-act': el => { S.inscrActId = el.value || null; S.inscrQ = ''; render(); } };
