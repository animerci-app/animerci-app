// Régie (lot D, v1.21.0) : suivi mensuel des opérations de régie (documents à préparer, chèques à transmettre au Trésor public, suivi des modes de
// règlement), avec un statut de rapprochement simple (à transmettre, transmise, rapprochée — sans calcul automatique de concordance : le rapprochement
// réel reste fait par le service financier). Ne remplace pas le logiciel comptable officiel ni les procédures de la collectivité (cahier § 18).
// Accès : l'administratrice, et l'équipe si l'administratrice a coché l'accès « Budgets et régie » (Équipe, même case que l'écran Budgets).
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, peutAdmin } from './ui.js';

export const anneeRegie = () => Number(S.anRegie) || Number(aujourdhui().slice(0, 4));
const fr = d => L.fmtDate(d);
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une information d'organisation, par exemple « chèque n° 1234, à déposer avant le 15 », « document préparé, en attente de signature ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const FILTRES = [['toutes', 'Toutes'], ['a_transmettre', 'À transmettre'], ['transmise', 'Transmises'], ['rapprochee', 'Rapprochées']];
const anneesProposees = () => { const a = Number(aujourdhui().slice(0, 4)); return [a + 1, a, a - 1, a - 2, a - 3].filter((x, i, t) => t.indexOf(x) === i); };
const selectAnnee = courante => `<div class="field" style="max-width:160px"><label for="rg-an">Année</label><select id="rg-an" data-change="rg-an">${[...new Set([...anneesProposees(), courante])].sort((a, b) => b - a).map(a => `<option ${a === courante ? 'selected' : ''}>${a}</option>`).join('')}</select></div>`;

/* ---------- Écran « Régie » ---------- */
export function regie() {
  const an = anneeRegie();
  if (!pret('regie', `an-${an}`)) return chargement('Régie');
  const admin = peutAdmin();
  const al = L.alertesRegie({ regie: S.cache.regie.filter(o => (o.date || '').slice(0, 4) === String(an)), auj: aujourdhui(), joursAlerte: P('regie.alerteJours') });
  const lib = { crit: ['p-crit', 'Urgent'], warn: ['p-warn', 'À regarder'], info: ['p-bleu', 'À faire'] };
  return `<div class="top"><div><h1>Régie</h1><p>Le suivi mensuel des opérations de régie : documents à préparer, chèques à transmettre au Trésor public, échéances. Ce suivi ne remplace pas le logiciel comptable officiel ni les procédures de la collectivité.</p></div>
    <div class="quick"><button class="btn" data-action="rg-form">+ Nouvelle opération</button>${admin ? '<button class="btn sec" data-action="rg-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="rg-pdf">PDF / Imprimer</button>' : ''}</div></div>
  ${al.length ? `<div class="card alertes" style="margin-bottom:14px"><h2 style="margin-top:0">Alertes</h2>${al.map(a => `<div class="row" style="border-top:1px solid var(--ligne)"><span class="pill ${lib[a.niveau][0]}">${lib[a.niveau][1]}</span><div class="grow">${esc(a.texte)}</div></div>`).join('')}</div>` : ''}
  <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee(an)}
    <input class="search" id="rech-rg" type="search" placeholder="Chercher : objet…" aria-label="Chercher une opération" value="${esc(S.rechRegie || '')}" style="flex:1;min-width:200px"></div>
  <div class="filters">${FILTRES.map(([k, l]) => `<button data-action="rg-filtre" data-v="${k}" aria-pressed="${(S.fRegie || 'toutes') === k}">${l}</button>`).join('')}</div>
  <div id="liste-rg">${listeRegie()}</div>`;
}
export function apresRegie() { const r = $('#rech-rg'); if (r) r.oninput = () => { S.rechRegie = r.value; $('#liste-rg').innerHTML = listeRegie(); }; }

function listeRegie() {
  const an = anneeRegie(), f = S.fRegie || 'toutes', q = L.cleNom(S.rechRegie || '');
  const rows = S.cache.regie.filter(o => (o.date || '').slice(0, 4) === String(an) && (f === 'toutes' || o.statut === f) && (!q || L.cleNom([o.objet, o.type, o.commentaire].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!rows.length) return '<div class="card"><div class="empty"><b>Aucune opération</b>Notez ici le suivi mensuel de la régie : documents à préparer, chèques à transmettre, échéances.</div></div>';
  return `<p class="sub">${rows.length} opération${rows.length > 1 ? 's' : ''}</p>` + rows.map(ligneRegie).join('');
}
const PILL_STATUT = { a_transmettre: 'p-warn', transmise: 'p-bleu', rapprochee: 'p-ok' };
function ligneRegie(o) {
  const retard = o.statut !== 'rapprochee' && o.echeance && o.echeance < aujourdhui();
  return `<button class="cand" data-action="rg-form" data-id="${esc(o.id)}"><span class="av">${esc(initiales(o.objet || o.type || '?'))}</span><span style="flex:1"><b>${esc(o.objet || '(sans objet)')}</b><span class="why">
    <span class="pill p-bleu">${esc(fr(o.date))}</span><span class="pill p-rose">${esc(o.type || '')}</span>
    ${o.montant !== '' && o.montant != null ? `<span class="pill p-bleu">${esc(L.fmtMontant(Number(o.montant) || 0))}</span>` : ''}${o.mode ? `<span class="pill p-bleu">${esc(o.mode)}</span>` : ''}
    <span class="pill ${PILL_STATUT[o.statut] || 'p-warn'}">${esc(L.STATUTS_REGIE[o.statut] || o.statut)}</span>${o.echeance ? `<span class="pill ${retard ? 'p-crit' : 'p-bleu'}">Échéance ${esc(fr(o.echeance))}${retard ? ' (dépassée)' : ''}</span>` : ''}</span>
    ${o.commentaire ? `<span class="sub">${esc(o.commentaire.length > 140 ? o.commentaire.slice(0, 140) + '…' : o.commentaire)}</span>` : ''}</span></button>`;
}
function regieForm(id) {
  const o = id ? S.cache.regie.find(x => x.id === id) : { date: aujourdhui(), type: P('regie.types')[0], mode: P('regie.modes')[0], statut: 'a_transmettre', montant: '' };
  if (id && !o) return;
  const admin = peutAdmin();
  modal(`<h2>${id ? 'Modifier l\'opération' : 'Nouvelle opération de régie'}</h2>
  <div class="two"><div class="field"><label for="r1">Type</label><select id="r1">${P('regie.types').map(t => `<option ${t === o.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
  <div class="field"><label for="r2">Date</label><input id="r2" type="date" value="${esc(o.date || '')}"></div></div>
  <div class="field"><label for="r3">Objet</label><input id="r3" maxlength="160" value="${esc(o.objet || '')}" placeholder="Ex. : chèque du banquet de Noël"></div>
  <div class="two"><div class="field"><label for="r4">Montant (€) <small class="sub">(facultatif)</small></label><input id="r4" inputmode="decimal" value="${o.montant === '' || o.montant == null ? '' : esc(L.fmtQte(o.montant))}"></div>
  <div class="field"><label for="r5">Mode de règlement</label><select id="r5">${P('regie.modes').map(m => `<option ${m === (o.mode || '') ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div></div>
  <div class="two"><div class="field"><label for="r6">Statut</label><select id="r6">${L.ORDRE_STATUTS_REGIE.map(s => `<option value="${s}" ${s === (o.statut || 'a_transmettre') ? 'selected' : ''}>${L.STATUTS_REGIE[s]}</option>`).join('')}</select></div>
  <div class="field"><label for="r7">Échéance <small class="sub">(facultatif)</small></label><input id="r7" type="date" value="${esc(o.echeance || '')}"></div></div>
  <div class="field"><label for="r8">Commentaire <small class="sub">(facultatif)</small></label><textarea id="r8" rows="2" maxlength="400">${esc(o.commentaire || '')}</textarea></div>
  ${AVERT}${o.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(o.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveR">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && admin ? '<button class="btn ghost" id="delR" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveR').onclick = async () => {
    const doc = { ...(id ? { id } : {}), type: $('#r1').value, date: $('#r2').value, objet: $('#r3').value.trim(), montant: $('#r4').value.trim() === '' ? '' : L.lireNombre($('#r4').value),
      mode: $('#r5').value, statut: $('#r6').value, echeance: $('#r7').value, commentaire: $('#r8').value.trim(), par: o.par || (S.user && S.user.nom) || '' };
    const err = L.erreurOperationRegie(doc, P('regie.types')); if (err) return toast(err);
    await sauver('regie', doc, 'Opération enregistrée'); closeModal();
  };
  if (id && admin) $('#delR').onclick = () => confirmer('Supprimer cette opération ?', `« ${o.objet || ''} » (${fr(o.date)}) va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('regie', o); await store.remove('regie', id); closeModal(); toast('Opération mise à la corbeille'); });
}
const enteteExport = an => [`Régie : opérations ${an} (AniMerci, ${P('nomService')}), édité le ${fr(aujourdhui())}.`, 'Suivi interne : ne remplace pas le logiciel comptable officiel ni les procédures de la collectivité. Statut de rapprochement simple, sans calcul automatique de concordance.'];

/* ---------- Actions ---------- */
export const actions = {
  'rg-form': el => regieForm(el.dataset.id),
  'rg-filtre': el => { S.fRegie = el.dataset.v; render(); },
  'rg-xlsx': () => { if (!peutAdmin()) return; const an = anneeRegie(); telecharger(`regie-${an}.xlsx`, classeur(L.tableauxRegie(S.cache.regie, an), enteteExport(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'rg-pdf': () => { if (!peutAdmin()) return; const an = anneeRegie(); imprimer(documentHtml(L.tableauxRegie(S.cache.regie, an), enteteExport(an), `Régie — opérations ${an}`)); }
};
export const changes = {
  'rg-an': el => { S.anRegie = Number(el.value); render(); }
};
