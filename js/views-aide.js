// Écran « Aide » (menu Aide, v1.33.0) : le Mode d'emploi + FAQ d'AniMerci consultable directement dans l'outil, avec sommaire et recherche.
// Contenu : voir js/aide-contenu.js, généré depuis claude/MODE-EMPLOI-FAQ.md par scripts/generer-aide.js — à régénérer après toute mise à jour de ce document, jamais à modifier à la main ici.
// Accès : l'administratrice, toujours. Un ou une bénévole, seulement si l'administratrice a coché son accès dans l'onglet « Qui a accès » (jamais les intervenant·es ni les partenaires : voir logic.js, accesActif).
import { S, pret, chargement, $, esc, initiales, peutAdmin, render, sauver } from './ui.js';
import { AIDE } from './aide-contenu.js';

const sansAccent = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const texteBrut = html => String(html || '').replace(/<[^>]+>/g, ' ');
const libelleGroupe = g => g.replace(/^\d+\.\s*/, '').replace(/\s*\(FAQ\)\s*$/, '');

const ONGLETS = [['contenu', "Mode d'emploi et FAQ"], ['acces', 'Qui a accès']];
export const ongletAide = () => (peutAdmin() && ONGLETS.some(o => o[0] === S.ongletAide) ? S.ongletAide : 'contenu');

/* ---------- Onglet « Mode d'emploi et FAQ » : sommaire + contenu, filtrés ensemble par la recherche ---------- */
function articlesFiltres(q) {
  const n = sansAccent(q || '');
  if (!n) return AIDE;
  return AIDE.filter(a => sansAccent(a.titre).includes(n) || sansAccent(texteBrut(a.html)).includes(n));
}
function sommaireEtContenu(q) {
  const arts = articlesFiltres(q);
  if (!arts.length) return '<div class="empty"><b>Aucun résultat</b>Essayez un autre mot, ou un mot plus court.</div>';
  const groupes = [...new Set(arts.map(a => a.groupe))];
  const som = `<nav class="aide-som" aria-label="Sommaire">${groupes.map(g => `<div class="aide-som-groupe"><b>${esc(libelleGroupe(g))}</b>
    <ul>${arts.filter(a => a.groupe === g).map(a => `<li><a href="#art-${esc(a.id)}">${esc(a.titre)}</a></li>`).join('')}</ul></div>`).join('')}</nav>`;
  const corps = `<div class="aide-corps">${groupes.map(g => `<h2>${esc(libelleGroupe(g))}</h2>
    ${arts.filter(a => a.groupe === g).map(a => `<div class="card" id="art-${esc(a.id)}" style="margin-bottom:12px"><h3 style="margin-top:0">${esc(a.titre)}</h3>${a.html}</div>`).join('')}`).join('')}</div>`;
  return som + corps;
}

/* ---------- Onglet « Qui a accès » (administratrice seule) ---------- */
function quiAAcces() {
  if (!pret('users')) return chargement('Aide');
  const benevoles = S.cache.users.filter(u => u.role === 'benevole').sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
  const liste = benevoles.length ? benevoles.map(u => `<label class="cand" style="cursor:pointer">
    <span class="av">${esc(initiales(u.nom || u.email))}</span>
    <span style="flex:1"><b>${esc(u.nom || u.email)}</b></span>
    <input type="checkbox" class="aide-chk" data-id="${esc(u.id)}" ${u.acces && u.acces.aide ? 'checked' : ''} aria-label="${esc(u.nom || u.email)} a accès à l'Aide">
  </label>`).join('') : '<div class="empty"><b>Aucun bénévole</b>Créez d\'abord un accès « Bénévole » dans Équipe.</div>';
  return `<div class="card" style="margin-bottom:14px"><p class="sub" style="margin:0">Cochez les bénévoles qui peuvent consulter ce menu Aide. Les intervenant·es et les partenaires n'y ont jamais accès, même cochés par erreur ailleurs.</p></div>${liste}`;
}

/* ---------- Écran ---------- */
export function aide() {
  const tab = ongletAide();
  const barre = peutAdmin() ? `<div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="aide-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>` : '';
  if (tab === 'acces') return `<div class="top"><div><h1>Aide</h1><p>Mode d'emploi d'AniMerci et questions fréquentes, directement dans l'outil.</p></div></div>${barre}${quiAAcces()}`;
  return `<div class="top"><div><h1>Aide</h1><p>Mode d'emploi d'AniMerci et questions fréquentes, directement dans l'outil.</p></div></div>${barre}
    <input class="search" id="rechAide" type="search" placeholder="Chercher dans l'aide…" aria-label="Chercher dans l'aide" value="${esc(S.rechAide || '')}">
    <div id="aideCorps">${sommaireEtContenu(S.rechAide)}</div>`;
}

export function apresAide() {
  const r = $('#rechAide');
  if (r) r.oninput = () => { S.rechAide = r.value; $('#aideCorps').innerHTML = sommaireEtContenu(S.rechAide); };
  document.querySelectorAll('.aide-chk').forEach(c => {
    c.onchange = async () => {
      const id = c.dataset.id, u = S.cache.users.find(x => x.id === id); if (!u) return;
      c.disabled = true;
      try { await sauver('users', { id, acces: { ...(u.acces || {}), aide: c.checked } }, c.checked ? 'Accès à l\'Aide accordé' : 'Accès à l\'Aide retiré'); }
      finally { c.disabled = false; }
    };
  });
}

export const actions = { 'aide-tab': el => { S.ongletAide = el.dataset.v; render(); } };
