// Budgets et dépenses (lot D, v1.21.0) : suivi interne des dépenses par budget (ville, résidence, forfait autonomie… — liste réglable dans Paramètres),
// rattachées à une activité ou un événement (ou « Autre », en texte libre). Ne remplace pas le logiciel comptable officiel ni les procédures de la
// collectivité (cahier § 18) : suivi interne, à faire valider par le service financier avant un usage réel.
// Accès : l'administratrice, et l'équipe (intervenant·es, bénévoles) si l'administratrice a coché l'accès « Budgets et régie » (Équipe). Chaque ligne
// garde « saisi par ». La suppression, le montant initial de chaque budget et les exports restent à l'administratrice.
// Aucune pièce justificative n'est stockée (le stockage de fichiers est payant) : seul son emplacement est noté.
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, peutAdmin } from './ui.js';

const ONGLETS = [['depenses', 'Dépenses'], ['chiffres', 'Chiffres']];
export const ongletBudgets = () => (ONGLETS.some(o => o[0] === S.ongletBudgets) ? S.ongletBudgets : 'depenses');
export const anneeBudgets = () => Number(S.anBudgets) || Number(aujourdhui().slice(0, 4));
const fr = d => L.fmtDate(d);
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une information d'organisation, par exemple « facture n° 4521, classeur du bureau », « devis signé le 3 mars », « reste 2 lots à commander ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const initiauxDe = an => { const d = S.cache.parametres.find(x => x.id === `budgets-${an}`); return (d && d.initiaux) || {}; };
const anneesProposees = () => { const a = Number(aujourdhui().slice(0, 4)); return [a + 1, a, a - 1, a - 2, a - 3].filter((x, i, t) => t.indexOf(x) === i); };
const selectAnnee = courante => `<div class="field" style="max-width:160px"><label for="bd-an">Année</label><select id="bd-an" data-change="bd-an">${[...new Set([...anneesProposees(), courante])].sort((a, b) => b - a).map(a => `<option ${a === courante ? 'selected' : ''}>${a}</option>`).join('')}</select></div>`;

/* ---------- Écran « Budgets » ---------- */
export function budgets() {
  const an = anneeBudgets();
  if (!pret('depenses', `an-${an}`)) return chargement('Budgets');
  const tab = ongletBudgets(), admin = peutAdmin();
  const al = L.alertesBudgets({ depenses: S.cache.depenses, budgets: P('listes.budgets'), initiaux: initiauxDe(an), seuilPourcent: P('budgets.seuilAlertePourcent') });
  const lib = { crit: ['p-crit', 'Urgent'], warn: ['p-warn', 'À regarder'], info: ['p-bleu', 'À faire'] };
  return `<div class="top"><div><h1>Budgets</h1><p>Le suivi interne des dépenses par budget, activité et événement. Ce suivi ne remplace pas le logiciel comptable officiel ni les procédures de la collectivité ; il est à faire valider par le service financier avant un usage réel.</p></div>
    <div class="quick">${tab === 'depenses' ? '<button class="btn" data-action="bd-form">+ Nouvelle dépense</button>' : ''}${tab === 'chiffres' && admin ? '<button class="btn sec" data-action="bd-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="bd-pdf">PDF / Imprimer</button>' : ''}</div></div>
  ${al.length ? `<div class="card alertes" style="margin-bottom:14px"><h2 style="margin-top:0">Alertes</h2>${al.map(a => `<div class="row" style="border-top:1px solid var(--ligne)"><span class="pill ${lib[a.niveau][0]}">${lib[a.niveau][1]}</span><div class="grow">${esc(a.texte)}</div></div>`).join('')}</div>` : ''}
  <div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="bd-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
  <div style="margin:10px 0">${selectAnnee(an)}</div>
  ${tab === 'chiffres' ? vueChiffres(an) : vueDepenses()}`;
}
export function apresBudgets() { const r = $('#rech-bd'); if (r) r.oninput = () => { S.rechBudgets = r.value; $('#liste-bd').innerHTML = listeDepenses(); }; }

/* ---------- Dépenses ---------- */
function vueDepenses() {
  const an = anneeBudgets(), budgets = P('listes.budgets');
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">
    <div class="field" style="max-width:220px"><label for="bd-fb">Budget</label><select id="bd-fb" data-change="bd-fbudget"><option value="">Tous</option>${budgets.map(b => `<option ${S.fBudget === b ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
    <input class="search" id="rech-bd" type="search" placeholder="Chercher : fournisseur, nature…" aria-label="Chercher une dépense" value="${esc(S.rechBudgets || '')}" style="flex:1;min-width:200px">
    <span class="sub">Année ${an}</span></div>
  <div id="liste-bd">${listeDepenses()}</div>`;
}
function listeDepenses() {
  const an = anneeBudgets(), q = L.cleNom(S.rechBudgets || '');
  const rows = S.cache.depenses.filter(d => (d.date || '').slice(0, 4) === String(an) && (!S.fBudget || d.budget === S.fBudget)
    && (!q || L.cleNom([d.fournisseur, d.nature, d.activiteNom, d.activiteLibre, d.libre, d.dispositif].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!rows.length) return '<div class="card"><div class="empty"><b>Aucune dépense</b>Ajoutez-en une avec « + Nouvelle dépense ».</div></div>';
  return `<p class="sub">${rows.length} dépense${rows.length > 1 ? 's' : ''}</p>` + rows.map(ligneDepense).join('');
}
function ligneDepense(d) {
  const activite = d.activiteNom || d.activiteLibre || d.libre || '(sans activité)';
  return `<button class="cand" data-action="bd-form" data-id="${esc(d.id)}"><span class="av">${esc(initiales(d.fournisseur || d.nature || '?'))}</span><span style="flex:1"><b>${esc(d.nature || '(dépense)')}</b><span class="why">
    <span class="pill p-bleu">${esc(fr(d.date))}</span><span class="pill p-rose">${esc(d.budget || '')}</span><span class="pill p-bleu">${esc(activite)}</span>
    ${d.dispositif ? `<span class="pill p-bleu">${esc(d.dispositif)}</span>` : ''}<span class="pill p-ok">Payé ${L.fmtMontant(Number(d.montantPaye) || 0)}</span></span>
    ${d.fournisseur ? `<span class="sub">Fournisseur : ${esc(d.fournisseur)}</span>` : ''}</span></button>`;
}
function depForm(id) {
  const d = id ? S.cache.depenses.find(x => x.id === id) : { budget: P('listes.budgets')[0], date: aujourdhui(), dispositif: P('budgets.dispositifs')[0], montantPrevu: '', montantEngage: '', montantPaye: '' };
  if (id && !d) return;
  const admin = peutAdmin(), budgets = P('listes.budgets'), activites = [...S.cache.activites].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
  modal(`<h2>${id ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
  <div class="two"><div class="field"><label for="d1">Budget</label><select id="d1">${budgets.map(b => `<option ${b === d.budget ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
  <div class="field"><label for="d2">Date</label><input id="d2" type="date" value="${esc(d.date || '')}"></div></div>
  <div class="two"><div class="field"><label for="d3">Fournisseur</label><input id="d3" maxlength="120" value="${esc(d.fournisseur || '')}" placeholder="Ex. : papeterie Dupont"></div>
  <div class="field"><label for="d4">Nature de la dépense</label><input id="d4" maxlength="160" value="${esc(d.nature || '')}" placeholder="Ex. : fournitures pour l'atelier créatif"></div></div>
  <div class="field"><label for="d5">Activité ou événement</label><select id="d5"><option value="">— Autre (texte libre) —</option>${activites.map(a => `<option value="${esc(a.id)}" ${a.id === d.activiteId ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></div>
  <div class="field" id="d6z"><label for="d6">Préciser</label><input id="d6" maxlength="160" value="${esc(d.activiteLibre || d.libre || '')}" placeholder="Ex. : marché de Noël 2026"></div>
  <div class="field"><label for="d7">Dispositif de financement</label><select id="d7">${P('budgets.dispositifs').map(x => `<option ${x === (d.dispositif || '') ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>
  <div class="two"><div class="field"><label for="d8">Montant prévisionnel (€)</label><input id="d8" inputmode="decimal" value="${d.montantPrevu === '' || d.montantPrevu == null ? '' : esc(L.fmtQte(d.montantPrevu))}"></div>
  <div class="field"><label for="d9">Montant engagé (€)</label><input id="d9" inputmode="decimal" value="${d.montantEngage === '' || d.montantEngage == null ? '' : esc(L.fmtQte(d.montantEngage))}"></div></div>
  <div class="field"><label for="d10">Montant payé (€)</label><input id="d10" inputmode="decimal" value="${d.montantPaye === '' || d.montantPaye == null ? '' : esc(L.fmtQte(d.montantPaye))}" style="max-width:200px"></div>
  <div class="field"><label for="d11">Où se trouve la pièce justificative ? <small class="sub">(facultatif)</small></label><input id="d11" maxlength="160" value="${esc(d.justificatifOu || '')}" placeholder="Ex. : classeur « Factures 2026 », bureau"></div>
  <div class="field"><label for="d12">Commentaire <small class="sub">(facultatif)</small></label><textarea id="d12" rows="2" maxlength="400">${esc(d.commentaire || '')}</textarea></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveD">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && admin ? '<button class="btn ghost" id="delD" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  const maj = () => { $('#d6z').style.display = $('#d5').value ? 'none' : ''; }; $('#d5').onchange = maj; maj();
  $('#saveD').onclick = async () => {
    const actId = $('#d5').value, activite = activites.find(a => a.id === actId);
    const doc = { ...(id ? { id } : {}), budget: $('#d1').value, date: $('#d2').value, fournisseur: $('#d3').value.trim(), nature: $('#d4').value.trim(),
      activiteId: actId, activiteNom: activite ? activite.nom : '', libre: actId ? '' : $('#d6').value.trim(), dispositif: $('#d7').value,
      montantPrevu: $('#d8').value.trim() === '' ? '' : L.lireNombre($('#d8').value), montantEngage: $('#d9').value.trim() === '' ? '' : L.lireNombre($('#d9').value), montantPaye: $('#d10').value.trim() === '' ? '' : L.lireNombre($('#d10').value),
      justificatifOu: $('#d11').value.trim(), commentaire: $('#d12').value.trim(), par: d.par || (S.user && S.user.nom) || '' };
    const err = L.erreurDepense(doc, budgets); if (err) return toast(err);
    await sauver('depenses', doc, 'Dépense enregistrée'); closeModal();
  };
  if (id && admin) $('#delD').onclick = () => confirmer('Supprimer cette dépense ?', `« ${d.nature || ''} » (${fr(d.date)}) va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('depenses', d); await store.remove('depenses', id); closeModal(); toast('Dépense mise à la corbeille'); });
}

/* ---------- Chiffres ---------- */
function vueChiffres(an) {
  const T = L.tableauxBudgets(S.cache.depenses, an, P('listes.budgets'), initiauxDe(an), aujourdhui()), admin = peutAdmin();
  const tableau = (cols, lignes) => `<div style="overflow:auto"><table class="tbl" style="width:100%"><thead><tr>${cols.map(c => `<th style="text-align:left">${esc(c)}</th>`).join('')}</tr></thead><tbody>${lignes.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">${esc(T[0].titre)}</h2>${tableau(T[0].cols, T[0].rows)}
    ${admin ? `<div class="quick" style="margin-top:10px">${P('listes.budgets').map(b => `<button class="btn sec sm" data-action="bd-initial" data-v="${esc(b)}">Montant initial — ${esc(b)}</button>`).join('')}</div>` : ''}</div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">${esc(T[1].titre)}</h2>${T[1].rows.length ? tableau(T[1].cols, T[1].rows) : '<div class="empty"><b>Aucune dépense</b>Rien à afficher pour cette année.</div>'}</div>`;
}
function initialForm(budget) {
  if (!peutAdmin()) return;
  const an = anneeBudgets(), init = initiauxDe(an);
  modal(`<h2>Montant initial — ${esc(budget)}</h2><p class="sub" style="margin:0 0 10px">Pour l'année ${an}. Sert à calculer le budget restant.</p>
  <div class="field"><label for="i1">Montant initial (€)</label><input id="i1" inputmode="decimal" value="${init[budget] ? esc(L.fmtQte(init[budget])) : ''}"></div>
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveI">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#saveI').onclick = async () => {
    const v = L.lireNombre($('#i1').value); if (!isFinite(v) || v < 0) return toast('Indiquez un montant positif ou nul.');
    await sauver('parametres', { id: `budgets-${an}`, initiaux: { ...init, [budget]: v } }, 'Montant initial enregistré'); closeModal();
  };
}
const enteteExport = an => [`Budgets et dépenses : chiffres ${an} (AniMerci, ${P('nomService')}), édité le ${fr(aujourdhui())}.`, 'Suivi interne : ne remplace pas le logiciel comptable officiel ni les procédures de la collectivité. Aucune donnée de santé dans ce document.'];

/* ---------- Actions ---------- */
export const actions = {
  'bd-tab': el => { S.ongletBudgets = el.dataset.v; S.rechBudgets = ''; S.fBudget = ''; render(); },
  'bd-form': el => depForm(el.dataset.id),
  'bd-initial': el => initialForm(el.dataset.v),
  'bd-xlsx': () => { if (!peutAdmin()) return; const an = anneeBudgets(); telecharger(`budgets-${an}.xlsx`, classeur(L.tableauxBudgets(S.cache.depenses, an, P('listes.budgets'), initiauxDe(an), aujourdhui()), enteteExport(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'bd-pdf': () => { if (!peutAdmin()) return; const an = anneeBudgets(); imprimer(documentHtml(L.tableauxBudgets(S.cache.depenses, an, P('listes.budgets'), initiauxDe(an), aujourdhui()), enteteExport(an), `Budgets — chiffres ${an}`)); }
};
export const changes = {
  'bd-an': el => { S.anBudgets = Number(el.value); render(); },
  'bd-fbudget': el => { S.fBudget = el.value; render(); }
};
