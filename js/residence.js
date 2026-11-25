// Résidence (nouveau lot, v1.25.0) : personnel et remplacements (§11.1), relations avec les familles (§11.2), relations avec les résidents (§11.3),
// journal de transmissions (§11.4), temps de remplacement (§22), interventions exceptionnelles (§23).
// Tout est écrit pour l'ORGANISATION du service : qui, quoi, quand, où, comment s'organiser. AUCUNE donnée de santé ou assimilée, nulle part, jamais.
// Le module « Personnel et remplacements » n'est SURTOUT PAS un dossier RH : aucune donnée contractuelle, aucun salaire, aucun dossier administratif du personnel.
// Accès : l'administratrice a toujours tout. Un membre de l'équipe (intervenant·e ou bénévole) seulement si la case « Résidence » est cochée sur son profil (Équipe),
// avec une date de fin facultative qui referme l'accès toute seule : cela permet à l'administratrice de déléguer temporairement l'accès en cas d'urgence,
// sans jamais avoir à partager son propre compte. Les partenaires n'ont aucun accès à ce menu.
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { champRecherche, itemPersonne, comboLire, NOUVEAU } from './recherche.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, peutAdmin } from './ui.js';

const ONGLETS = [['personnel', 'Personnel et remplacements'], ['familles', 'Relations familles'], ['residents', 'Relations résidents'], ['journal', 'Journal de transmissions'], ['remplacements', 'Temps de remplacement'], ['interventions', 'Interventions exceptionnelles'], ['stats', 'Chiffres de l\'année']];
const fr = d => L.fmtDate(d);
// ✔/✘ : même composant d'avertissement que les autres écrans (portage.js, liensocial.js), un seul par formulaire, couvrant tous ses champs libres.
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : des éléments d'organisation, par exemple « absente du 3 au 17 août, remplacée par Mme Untel », « appel de la famille pour un rendez-vous le 14 », « transmission à l'équipe du matin ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé ou de situation personnelle sensible. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
export const ongletResidence = () => (ONGLETS.some(o => o[0] === S.ongletRes) ? S.ongletRes : 'personnel');
export const anneeResidence = () => Number(S.anRes) || Number(aujourdhui().slice(0, 4));
export const peutResidence = () => peutAdmin() || L.accesActif(S.user, 'residence', aujourdhui());
const nomResident = id => { const s = S.cache.seniors.find(x => x.id === id); return s ? L.nomAffiche(s) : ''; };
const residents = () => S.cache.seniors.filter(s => s.statut === 'resident');

/* ---------- Écran ---------- */
export function residence() {
  if (!peutResidence()) return '<div class="card"><div class="empty"><b>Accès réservé</b>Cet écran est réservé à l\'administratrice et aux personnes de l\'équipe dont l\'accès « Résidence » est coché (voir Équipe).</div></div>';
  const tab = ongletResidence();
  if (!pret('residencePersonnel')) return chargement('Résidence');
  const ajout = { personnel: ['rp-form', '+ Nouvelle entrée'], familles: ['rf-form', '+ Nouveau contact'], residents: ['rr-form', '+ Nouveau contact'], journal: ['rj-form', '+ Nouvelle entrée'], remplacements: ['re-form', '+ Nouvelle période'], interventions: ['ri-form', '+ Nouvelle intervention'], stats: null }[tab];
  return `<div class="top"><div><h1>${esc(P('residence.nom') || 'Résidence')}</h1><p>Personnel et remplacements, relations avec les familles et les résidents, journal de transmissions, temps de remplacement et interventions exceptionnelles (cahier des charges §11, §22, §23).</p></div>
    <div class="quick">${ajout ? `<button class="btn" data-action="${ajout[0]}">${ajout[1]}</button>` : '<button class="btn sec" data-action="res-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="res-pdf">PDF / Imprimer</button>'}</div></div>
  <div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="res-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
  ${{ personnel: vuePersonnel, familles: vueFamilles, residents: vueResidents, journal: vueJournal, remplacements: vueRemplacements, interventions: vueInterventions, stats: vueStats }[tab]()}`;
}
export function apresResidence() {
  const map = { '#rech-rp': ['rechRP', listePersonnel, '#liste-rp'], '#rech-rf': ['rechRF', listeFamilles, '#liste-rf'], '#rech-rr': ['rechRR', listeResidents, '#liste-rr'], '#rech-rj': ['rechRJ', listeJournal, '#liste-rj'], '#rech-re': ['rechRE', listeRemplacements, '#liste-re'], '#rech-ri': ['rechRI', listeInterventions, '#liste-ri'] };
  for (const [sel, [cle, fn, cible]] of Object.entries(map)) { const el = $(sel); if (el) el.oninput = () => { S[cle] = el.value; $(cible).innerHTML = fn(); }; }
}
const selectAnnee = (chg, an) => { const a0 = Number(aujourdhui().slice(0, 4)); return `<div class="field" style="max-width:140px;margin:0"><label for="res-an">Année</label><select id="res-an" data-change="${chg}">${[a0 + 1, a0, a0 - 1, a0 - 2, a0 - 3].filter((x, i, t) => t.indexOf(x) === i).concat(an).filter((x, i, t) => t.indexOf(x) === i).sort((x, y) => y - x).map(x => `<option ${x === an ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`; };

/* ---------- a. Personnel et remplacements (§11.1) ---------- */
function listePersonnel() {
  const q = L.cleNom(S.rechRP || '');
  const rows = [...S.cache.residencePersonnel].filter(d => !q || L.cleNom([d.agentNom, d.motif, d.remplacantNom, d.transmission].join(' ')).includes(q)).sort((a, b) => (b.dateDebut || '').localeCompare(a.dateDebut || ''));
  return rows.length ? `<p class="sub">${rows.length} entrée${rows.length > 1 ? 's' : ''}</p>${rows.map(ligneRP).join('')}` : '<div class="card"><div class="empty"><b>Aucune entrée</b>Notez ici les absences, congés et indisponibilités de l\'équipe utiles à l\'organisation, et qui remplace qui.</div></div>';
}
function vuePersonnel() {
  return `<div class="card" style="margin-bottom:10px"><p class="sub" style="margin:0"><b>Important</b> : ce module n'est pas un dossier du personnel. Aucune donnée contractuelle, aucun salaire, aucun dossier administratif : uniquement de l'organisation (« qui est absent, du... au..., remplacé par... »).</p></div>
  <input class="search" id="rech-rp" type="search" placeholder="Chercher : agent, motif…" aria-label="Chercher dans le personnel et les remplacements" value="${esc(S.rechRP || '')}" style="margin-bottom:10px">
  <div id="liste-rp">${listePersonnel()}</div>`;
}
function ligneRP(d) {
  const periode = d.dateFin ? `du ${fr(d.dateDebut)} au ${fr(d.dateFin)}` : `depuis le ${fr(d.dateDebut)}`;
  return `<button class="cand" data-action="rp-form" data-id="${esc(d.id)}"><span class="av" aria-hidden="true">${esc(initiales(d.agentNom))}</span>
    <span style="flex:1"><b>${esc(d.agentNom)}</b><span class="why"><span class="pill p-bleu">${esc(periode)}</span><span class="pill p-rose">${esc(d.motif || '')}</span>
    ${d.remplacantNom ? `<span class="pill p-warn">Remplacé·e par ${esc(d.remplacantNom)}</span>` : ''}</span>
    ${d.transmission ? `<span class="sub">${esc(d.transmission.length > 140 ? d.transmission.slice(0, 140) + '…' : d.transmission)}</span>` : ''}</span></button>`;
}
function formRP(id) {
  const d = id ? S.cache.residencePersonnel.find(x => x.id === id) : { dateDebut: aujourdhui() };
  if (id && !d) return;
  const motifs = P('residence.motifsAbsencePersonnel');
  modal(`<h2>${id ? 'Modifier l\'entrée' : 'Nouvelle entrée : personnel et remplacements'}</h2>
  <div class="field"><label for="rp1">Agent concerné</label><input id="rp1" maxlength="120" autocomplete="off" value="${esc(d.agentNom || '')}" placeholder="nom (simple texte, ou tel que dans l'Annuaire ou l'Équipe)"></div>
  <div class="two"><div class="field"><label for="rp2">Début de l'absence ou de l'indisponibilité</label><input id="rp2" type="date" value="${esc(d.dateDebut || aujourdhui())}"></div>
  <div class="field"><label for="rp3">Fin <small class="sub">(facultatif)</small></label><input id="rp3" type="date" value="${esc(d.dateFin || '')}"></div></div>
  <div class="field"><label for="rp4">Motif d'organisation</label><select id="rp4">${motifs.map(m => `<option ${d.motif === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
  <div class="field"><label for="rp5">Remplacé·e par <small class="sub">(facultatif)</small></label><input id="rp5" maxlength="120" autocomplete="off" value="${esc(d.remplacantNom || '')}"></div>
  <div class="field"><label for="rp6">Transmissions <small class="sub">(facultatif)</small></label><textarea id="rp6" rows="3" maxlength="600">${esc(d.transmission || '')}</textarea></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveRP">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delRP" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveRP').onclick = async () => {
    const o = { agentNom: $('#rp1').value.trim(), dateDebut: $('#rp2').value, motif: $('#rp4').value };
    const err = L.erreurPersonnelResidence(o, motifs); if (err) return toast(err);
    await sauver('residencePersonnel', { ...(id ? { id } : {}), ...o, dateFin: $('#rp3').value, remplacantNom: $('#rp5').value.trim(), transmission: $('#rp6').value.trim(), par: d.par || S.user.nom }, 'Entrée enregistrée');
    closeModal();
  };
  if (id && peutAdmin()) $('#delRP').onclick = () => confirmer('Supprimer cette entrée ?', `« ${d.agentNom} » (${fr(d.dateDebut)}) va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('residencePersonnel', d); await store.remove('residencePersonnel', id); closeModal(); toast('Entrée mise à la corbeille'); });
}

/* ---------- b. Relations avec les familles (§11.2) ---------- */
function listeFamilles() {
  const an = anneeResidence(), q = L.cleNom(S.rechRF || '');
  const rows = S.cache.residenceFamilles.filter(c => c.date && c.date.slice(0, 4) === String(an) && (!q || L.cleNom([c.familleNom, nomResident(c.residentId), c.information, c.suite].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} contact${rows.length > 1 ? 's' : ''}</p>${rows.map(ligneRF).join('')}` : '<div class="card"><div class="empty"><b>Aucun contact</b>Notez ici les appels, rendez-vous, visites et demandes des familles et des proches des résident·es.</div></div>';
}
function vueFamilles() {
  if (!pret('residenceFamilles', `an-${anneeResidence()}`)) return chargement('Relations familles');
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee('res-an', anneeResidence())}
    <input class="search" id="rech-rf" type="search" placeholder="Chercher : famille, résident·e…" aria-label="Chercher dans les relations familles" value="${esc(S.rechRF || '')}" style="flex:1;min-width:180px"></div>
  <div id="liste-rf">${listeFamilles()}</div>`;
}
function ligneRF(c) {
  return `<button class="cand" data-action="rf-form" data-id="${esc(c.id)}"><span class="av" aria-hidden="true">${esc(initiales(c.familleNom))}</span>
    <span style="flex:1"><b>${esc(c.familleNom)}</b><span class="why"><span class="pill p-bleu">${esc(fr(c.date))}</span><span class="pill p-rose">${esc(L.TYPES_CONTACT_FAMILLE_RESIDENCE[c.type] || c.type || '')}</span>
    ${c.residentId ? `<span class="pill p-warn">${esc(nomResident(c.residentId))}</span>` : ''}</span>
    ${c.information ? `<span class="sub">${esc(c.information.length > 140 ? c.information.slice(0, 140) + '…' : c.information)}</span>` : ''}</span></button>`;
}
function formRF(id) {
  const c = id ? S.cache.residenceFamilles.find(x => x.id === id) : null;
  const d = c || { type: 'appel', date: aujourdhui() };
  modal(`<h2>${id ? 'Modifier le contact' : 'Nouveau contact avec une famille'}</h2>
  <div class="field"><label for="rf1">Famille ou proche concerné</label><input id="rf1" maxlength="120" autocomplete="off" value="${esc(d.familleNom || '')}" placeholder="ex. famille de Mme Untel"></div>
  ${champRecherche({ id: 'rf2', label: 'Résident·e concerné·e', aide: 'Facultatif : liez ce contact à une fiche si possible.', texte: c && c.residentId ? nomResident(c.residentId) : '', val: c ? c.residentId || '' : '', items: () => residents().map(itemPersonne), mode: 'unique' })}
  <div class="two"><div class="field"><label for="rf3">Type</label><select id="rf3">${Object.entries(L.TYPES_CONTACT_FAMILLE_RESIDENCE).map(([k, l]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="rf4">Date</label><input id="rf4" type="date" value="${esc(d.date || aujourdhui())}"></div></div>
  <div class="field"><label for="rf5">Heure <small class="sub">(facultatif)</small></label><input id="rf5" type="time" value="${esc(d.heure || '')}"></div>
  <div class="field"><label for="rf6">Information transmise <small class="sub">(facultatif)</small></label><textarea id="rf6" rows="3" maxlength="600">${esc(d.information || '')}</textarea></div>
  <div class="field"><label for="rf7">Suite à donner <small class="sub">(facultatif)</small></label><input id="rf7" maxlength="200" value="${esc(d.suite || '')}"></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveRF">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delRF" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveRF').onclick = async () => {
    const choix = comboLire('rf2'), residentId = choix.val === NOUVEAU ? '' : choix.val;
    const o = { familleNom: $('#rf1').value.trim(), residentId, type: $('#rf3').value, date: $('#rf4').value };
    const err = L.erreurContactFamilleResidence(o); if (err) return toast(err);
    await sauver('residenceFamilles', { ...(id ? { id } : {}), ...o, heure: $('#rf5').value, information: $('#rf6').value.trim(), suite: $('#rf7').value.trim(), par: d.par || S.user.nom }, 'Contact enregistré');
    closeModal();
  };
  if (id && peutAdmin()) $('#delRF').onclick = () => confirmer('Supprimer ce contact ?', `Contact du ${fr(d.date)}.`, 'Supprimer', async () => { await mettreCorbeille('residenceFamilles', c); await store.remove('residenceFamilles', id); closeModal(); toast('Contact mis à la corbeille'); });
}

/* ---------- c. Relations avec les résidents (§11.3) ---------- */
function listeResidents() {
  const an = anneeResidence(), q = L.cleNom(S.rechRR || '');
  const rows = S.cache.residenceResidents.filter(c => c.date && c.date.slice(0, 4) === String(an) && (!q || L.cleNom([nomResident(c.residentId), c.texte, c.suivi].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} contact${rows.length > 1 ? 's' : ''}</p>${rows.map(ligneRR).join('')}` : '<div class="card"><div class="empty"><b>Aucun contact</b>Notez ici les demandes, réclamations, difficultés de vie collective et demandes particulières des résident·es.</div></div>';
}
function vueResidents() {
  if (!pret('residenceResidents', `an-${anneeResidence()}`)) return chargement('Relations résidents');
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee('res-an', anneeResidence())}
    <input class="search" id="rech-rr" type="search" placeholder="Chercher : résident·e, texte…" aria-label="Chercher dans les relations résidents" value="${esc(S.rechRR || '')}" style="flex:1;min-width:180px"></div>
  <div id="liste-rr">${listeResidents()}</div>`;
}
function ligneRR(c) {
  return `<button class="cand" data-action="rr-form" data-id="${esc(c.id)}"><span class="av" aria-hidden="true">${esc(initiales(nomResident(c.residentId)))}</span>
    <span style="flex:1"><b>${esc(nomResident(c.residentId) || 'Résident·e')}</b><span class="why"><span class="pill p-bleu">${esc(fr(c.date))}</span><span class="pill p-rose">${esc(L.TYPES_CONTACT_RESIDENT_RESIDENCE[c.type] || c.type || '')}</span></span>
    ${c.texte ? `<span class="sub">${esc(c.texte.length > 140 ? c.texte.slice(0, 140) + '…' : c.texte)}</span>` : ''}</span></button>`;
}
function formRR(id) {
  const c = id ? S.cache.residenceResidents.find(x => x.id === id) : null;
  const d = c || { type: 'demande', date: aujourdhui() };
  modal(`<h2>${id ? 'Modifier le contact' : 'Nouveau contact avec un·e résident·e'}</h2>
  ${champRecherche({ id: 'rr1', label: 'Résident·e concerné·e', aide: 'Tapez un nom ou une date de naissance (liste filtrée aux résident·es).', texte: c ? nomResident(c.residentId) : '', val: c ? c.residentId : '', items: () => residents().map(itemPersonne), mode: 'unique' })}
  <div class="two"><div class="field"><label for="rr2">Type</label><select id="rr2">${Object.entries(L.TYPES_CONTACT_RESIDENT_RESIDENCE).map(([k, l]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="rr3">Date</label><input id="rr3" type="date" value="${esc(d.date || aujourdhui())}"></div></div>
  <div class="field"><label for="rr4">Texte <small class="sub">(facultatif)</small></label><textarea id="rr4" rows="3" maxlength="600">${esc(d.texte || '')}</textarea></div>
  <div class="field"><label for="rr5">Action réalisée <small class="sub">(facultatif)</small></label><input id="rr5" maxlength="200" value="${esc(d.actionRealisee || '')}"></div>
  <div class="field"><label for="rr6">Suivi <small class="sub">(facultatif)</small></label><input id="rr6" maxlength="200" value="${esc(d.suivi || '')}"></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveRR">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delRR" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveRR').onclick = async () => {
    const choix = comboLire('rr1'); if (choix.val === NOUVEAU || !choix.val) return toast('Choisissez le ou la résident·e concerné·e dans la liste.');
    const o = { residentId: choix.val, type: $('#rr2').value, date: $('#rr3').value };
    const err = L.erreurContactResidentResidence(o); if (err) return toast(err);
    await sauver('residenceResidents', { ...(id ? { id } : {}), ...o, texte: $('#rr4').value.trim(), actionRealisee: $('#rr5').value.trim(), suivi: $('#rr6').value.trim(), par: d.par || S.user.nom }, 'Contact enregistré');
    closeModal();
  };
  if (id && peutAdmin()) $('#delRR').onclick = () => confirmer('Supprimer ce contact ?', `Contact du ${fr(d.date)}.`, 'Supprimer', async () => { await mettreCorbeille('residenceResidents', c); await store.remove('residenceResidents', id); closeModal(); toast('Contact mis à la corbeille'); });
}

/* ---------- d. Journal de transmissions (§11.4) ---------- */
function listeJournal() {
  const an = anneeResidence(), seul = S.fJournalRes === 'asuivre', q = L.cleNom(S.rechRJ || '');
  const rows = S.cache.residenceJournal.filter(j => j.date && j.date.slice(0, 4) === String(an) && (!seul || (j.statut === 'a-traiter' || j.statut === 'en-cours')) && (!q || L.cleNom([j.nature, j.personnesConcernees, j.actionRealisee, j.suite].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} entrée${rows.length > 1 ? 's' : ''}</p>${rows.map(ligneRJ).join('')}` : '<div class="card"><div class="empty"><b>Aucune entrée</b>Notez ici ce qui doit être transmis d\'une équipe à l\'autre : nature, personnes concernées, action réalisée, personnes informées, suite à donner, statut.</div></div>';
}
const PILL_STATUT_RJ = { 'a-traiter': 'p-crit', 'en-cours': 'p-warn', 'en-attente': 'p-bleu', cloture: 'p-ok' };
function vueJournal() {
  if (!pret('residenceJournal', `an-${anneeResidence()}`)) return chargement('Journal de transmissions');
  const seul = S.fJournalRes === 'asuivre';
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee('res-an', anneeResidence())}
    <input class="search" id="rech-rj" type="search" placeholder="Chercher : nature, personnes…" aria-label="Chercher dans le journal de transmissions" value="${esc(S.rechRJ || '')}" style="flex:1;min-width:180px">
    <label class="chk" style="margin:0 0 6px"><input type="checkbox" data-change="res-fjournal" ${seul ? 'checked' : ''}> À traiter ou en cours seulement</label></div>
  <div id="liste-rj">${listeJournal()}</div>`;
}
function ligneRJ(j) {
  return `<button class="cand" data-action="rj-form" data-id="${esc(j.id)}"><span class="av" aria-hidden="true">${esc(initiales(j.nature || 'J'))}</span>
    <span style="flex:1"><b>${esc(j.nature || '')}</b><span class="why"><span class="pill p-bleu">${esc(fr(j.date))}${j.heure ? ' ' + esc(j.heure) : ''}</span><span class="pill ${PILL_STATUT_RJ[j.statut] || 'p-bleu'}">${esc(L.STATUTS_JOURNAL_RESIDENCE[j.statut] || j.statut || '')}</span></span>
    ${j.personnesConcernees ? `<span class="sub">${esc(j.personnesConcernees)}</span>` : ''}</span></button>`;
}
function formRJ(id) {
  const j = id ? S.cache.residenceJournal.find(x => x.id === id) : null;
  const natures = P('residence.naturesJournal'), d = j || { nature: natures[0], date: aujourdhui(), statut: 'a-traiter' };
  modal(`<h2>${id ? 'Modifier l\'entrée' : 'Nouvelle entrée du journal de transmissions'}</h2>
  <div class="two"><div class="field"><label for="rj1">Date</label><input id="rj1" type="date" value="${esc(d.date || aujourdhui())}"></div>
  <div class="field"><label for="rj2">Heure <small class="sub">(facultatif)</small></label><input id="rj2" type="time" value="${esc(d.heure || '')}"></div></div>
  <div class="field"><label for="rj3">Nature</label><select id="rj3">${natures.map(n => `<option ${d.nature === n ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
  <div class="field"><label for="rj4">Personnes concernées <small class="sub">(facultatif)</small></label><input id="rj4" maxlength="200" value="${esc(d.personnesConcernees || '')}"></div>
  <div class="field"><label for="rj5">Action réalisée <small class="sub">(facultatif)</small></label><textarea id="rj5" rows="3" maxlength="600">${esc(d.actionRealisee || '')}</textarea></div>
  <div class="field"><label for="rj6">Personnes informées <small class="sub">(facultatif)</small></label><input id="rj6" maxlength="200" value="${esc(d.personnesInformees || '')}"></div>
  <div class="field"><label for="rj7">Suite à donner <small class="sub">(facultatif)</small></label><input id="rj7" maxlength="200" value="${esc(d.suite || '')}"></div>
  <div class="field"><label for="rj8">Statut</label><select id="rj8">${Object.entries(L.STATUTS_JOURNAL_RESIDENCE).map(([k, l]) => `<option value="${k}" ${d.statut === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveRJ">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delRJ" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveRJ').onclick = async () => {
    const o = { date: $('#rj1').value, nature: $('#rj3').value, statut: $('#rj8').value };
    const err = L.erreurJournalResidence(o, natures); if (err) return toast(err);
    await sauver('residenceJournal', { ...(id ? { id } : {}), ...o, heure: $('#rj2').value, personnesConcernees: $('#rj4').value.trim(), actionRealisee: $('#rj5').value.trim(), personnesInformees: $('#rj6').value.trim(), suite: $('#rj7').value.trim(), par: d.par || S.user.nom }, 'Entrée enregistrée');
    closeModal();
  };
  if (id && peutAdmin()) $('#delRJ').onclick = () => confirmer('Supprimer cette entrée ?', `Entrée du ${fr(d.date)} du journal de transmissions.`, 'Supprimer', async () => { await mettreCorbeille('residenceJournal', j); await store.remove('residenceJournal', id); closeModal(); toast('Entrée mise à la corbeille'); });
}

/* ---------- e. Temps de remplacement (§22) ---------- */
function listeRemplacements() {
  const an = anneeResidence(), q = L.cleNom(S.rechRE || '');
  const rows = S.cache.residenceRemplacements.filter(r => r.date && r.date.slice(0, 4) === String(an) && (!q || L.cleNom([r.type, r.remarque].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} période${rows.length > 1 ? 's' : ''}</p>${rows.map(ligneRE).join('')}` : '<div class="card"><div class="empty"><b>Aucune période</b>Notez ici les temps de remplacement : responsable, accueil, ligne téléphonique transférée, disponibilité (« bip »), en distinguant disponibilité et intervention effective.</div></div>';
}
function vueRemplacements() {
  if (!pret('residenceRemplacements', `an-${anneeResidence()}`)) return chargement('Temps de remplacement');
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee('res-an', anneeResidence())}
    <input class="search" id="rech-re" type="search" placeholder="Chercher : type, remarque…" aria-label="Chercher dans les temps de remplacement" value="${esc(S.rechRE || '')}" style="flex:1;min-width:180px"></div>
  <div id="liste-re">${listeRemplacements()}</div>`;
}
function ligneRE(r) {
  return `<button class="cand" data-action="re-form" data-id="${esc(r.id)}"><span class="av" aria-hidden="true">${esc(initiales(r.type || 'R'))}</span>
    <span style="flex:1"><b>${esc(L.TYPES_REMPLACEMENT_RESIDENCE[r.type] || r.type || '')}</b><span class="why"><span class="pill p-bleu">${esc(fr(r.date))}</span><span class="pill p-rose">${esc(L.NATURES_REMPLACEMENT_RESIDENCE[r.nature] || r.nature || '')}</span><span class="pill p-warn">${r.duree || 0} min</span></span>
    ${r.remarque ? `<span class="sub">${esc(r.remarque.length > 140 ? r.remarque.slice(0, 140) + '…' : r.remarque)}</span>` : ''}</span></button>`;
}
function formRE(id) {
  const r = id ? S.cache.residenceRemplacements.find(x => x.id === id) : null;
  const d = r || { date: aujourdhui(), type: 'responsable', nature: 'disponibilite' };
  modal(`<h2>${id ? 'Modifier la période' : 'Nouvelle période de remplacement'}</h2>
  <div class="field"><label for="re1">Date</label><input id="re1" type="date" value="${esc(d.date || aujourdhui())}"></div>
  <div class="two"><div class="field"><label for="re2">Type de remplacement</label><select id="re2">${Object.entries(L.TYPES_REMPLACEMENT_RESIDENCE).map(([k, l]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="re3">Nature</label><select id="re3">${Object.entries(L.NATURES_REMPLACEMENT_RESIDENCE).map(([k, l]) => `<option value="${k}" ${d.nature === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
  <div class="field"><label for="re4">Durée (minutes)</label><input id="re4" type="number" min="1" max="1440" value="${esc(d.duree == null ? '' : d.duree)}"></div>
  <div class="field"><label for="re5">Remarque de clôture <small class="sub">(facultatif)</small></label><textarea id="re5" rows="2" maxlength="400">${esc(d.remarque || '')}</textarea></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveRE">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delRE" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveRE').onclick = async () => {
    const o = { date: $('#re1').value, type: $('#re2').value, nature: $('#re3').value, duree: Number($('#re4').value) };
    const err = L.erreurRemplacementResidence(o); if (err) return toast(err);
    await sauver('residenceRemplacements', { ...(id ? { id } : {}), ...o, remarque: $('#re5').value.trim(), par: d.par || S.user.nom }, 'Période enregistrée');
    closeModal();
  };
  if (id && peutAdmin()) $('#delRE').onclick = () => confirmer('Supprimer cette période ?', `Période du ${fr(d.date)}.`, 'Supprimer', async () => { await mettreCorbeille('residenceRemplacements', r); await store.remove('residenceRemplacements', id); closeModal(); toast('Période mise à la corbeille'); });
}

/* ---------- f. Interventions exceptionnelles (§23) ---------- */
function listeInterventions() {
  const an = anneeResidence(), q = L.cleNom(S.rechRI || '');
  const rows = S.cache.residenceInterventions.filter(i => i.date && i.date.slice(0, 4) === String(an) && (!q || L.cleNom([i.motif, i.intervention, i.suites].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} intervention${rows.length > 1 ? 's' : ''}</p>${rows.map(ligneRI).join('')}` : '<div class="card"><div class="empty"><b>Aucune intervention</b>Notez ici les interventions exceptionnelles : motif, intervention réalisée, temps consacré, déplacement, suites éventuelles.</div></div>';
}
function vueInterventions() {
  if (!pret('residenceInterventions', `an-${anneeResidence()}`)) return chargement('Interventions exceptionnelles');
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee('res-an', anneeResidence())}
    <input class="search" id="rech-ri" type="search" placeholder="Chercher : motif, intervention…" aria-label="Chercher dans les interventions exceptionnelles" value="${esc(S.rechRI || '')}" style="flex:1;min-width:180px"></div>
  <div id="liste-ri">${listeInterventions()}</div>`;
}
function ligneRI(i) {
  return `<button class="cand" data-action="ri-form" data-id="${esc(i.id)}"><span class="av" aria-hidden="true">${esc(initiales(i.motif || 'I'))}</span>
    <span style="flex:1"><b>${esc(i.motif || '')}</b><span class="why"><span class="pill p-bleu">${esc(fr(i.date))}</span>${i.tempsConsacre ? `<span class="pill p-rose">${i.tempsConsacre} min</span>` : ''}${i.deplacement ? '<span class="pill p-warn">Déplacement</span>' : ''}</span>
    ${i.intervention ? `<span class="sub">${esc(i.intervention.length > 140 ? i.intervention.slice(0, 140) + '…' : i.intervention)}</span>` : ''}</span></button>`;
}
function formRI(id) {
  const i = id ? S.cache.residenceInterventions.find(x => x.id === id) : null;
  const motifs = P('residence.motifsIntervention'), d = i || { date: aujourdhui(), motif: motifs[0] };
  modal(`<h2>${id ? 'Modifier l\'intervention' : 'Nouvelle intervention exceptionnelle'}</h2>
  <div class="two"><div class="field"><label for="ri1">Date</label><input id="ri1" type="date" value="${esc(d.date || aujourdhui())}"></div>
  <div class="field"><label for="ri4">Temps consacré (minutes) <small class="sub">(facultatif)</small></label><input id="ri4" type="number" min="0" max="1440" value="${esc(d.tempsConsacre == null ? '' : d.tempsConsacre)}"></div></div>
  <div class="field"><label for="ri2">Motif</label><select id="ri2">${motifs.map(m => `<option ${d.motif === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
  <div class="field"><label for="ri3">Intervention réalisée</label><textarea id="ri3" rows="3" maxlength="600">${esc(d.intervention || '')}</textarea></div>
  <label class="chk" style="margin:4px 0 8px"><input type="checkbox" id="ri5" ${d.deplacement ? 'checked' : ''}> Déplacement</label>
  <div class="field"><label for="ri6">Suites éventuelles <small class="sub">(facultatif)</small></label><textarea id="ri6" rows="2" maxlength="400">${esc(d.suites || '')}</textarea></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveRI">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delRI" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveRI').onclick = async () => {
    const o = { date: $('#ri1').value, motif: $('#ri2').value, intervention: $('#ri3').value.trim() };
    const err = L.erreurInterventionResidence(o, motifs); if (err) return toast(err);
    await sauver('residenceInterventions', { ...(id ? { id } : {}), ...o, tempsConsacre: $('#ri4').value === '' ? '' : Number($('#ri4').value), deplacement: $('#ri5').checked, suites: $('#ri6').value.trim(), par: d.par || S.user.nom }, 'Intervention enregistrée');
    closeModal();
  };
  if (id && peutAdmin()) $('#delRI').onclick = () => confirmer('Supprimer cette intervention ?', `Intervention du ${fr(d.date)}.`, 'Supprimer', async () => { await mettreCorbeille('residenceInterventions', i); await store.remove('residenceInterventions', id); closeModal(); toast('Intervention mise à la corbeille'); });
}

/* ---------- g. Chiffres de l'année (§11.5 et récapitulatif) ---------- */
function vueStats() {
  const an = anneeResidence(), s = L.statsResidence({ familles: S.cache.residenceFamilles, residents: S.cache.residenceResidents, journal: S.cache.residenceJournal, remplacements: S.cache.residenceRemplacements, interventions: S.cache.residenceInterventions }, an);
  const ligne = (l, v) => `<tr><td>${esc(l)}</td><td style="text-align:right"><b>${v}</b></td></tr>`;
  return `<div class="field" style="max-width:140px;margin-bottom:10px">${selectAnnee('res-an', an)}</div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Chiffres ${an}</h2>
  <table class="tbl" style="width:100%">${ligne('Contacts avec des familles', s.contactsFamilles)}${ligne('Contacts avec des résidents', s.contactsResidents)}
  ${ligne('Journal — à traiter', s.parStatutJournal['a-traiter'])}${ligne('Journal — en cours', s.parStatutJournal['en-cours'])}${ligne('Journal — en attente', s.parStatutJournal['en-attente'])}${ligne('Journal — clôturé', s.parStatutJournal.cloture)}
  ${ligne('Temps de disponibilité (minutes)', s.tempsDisponibiliteMinutes)}${ligne('Temps d\'intervention effective (minutes)', s.tempsInterventionMinutes)}${ligne('Temps total de remplacement (minutes)', s.tempsRemplacementMinutes)}
  ${ligne('Interventions exceptionnelles', s.interventionsExceptionnelles)}${ligne('Temps consacré aux interventions exceptionnelles (minutes)', s.tempsInterventionsExceptionnellesMinutes)}</table></div>`;
}
const entete = an => [`Résidence : chiffres ${an} (AniMerci, ${P('nomService')}), édité le ${fr(aujourdhui())}.`, 'Aucune donnée de santé dans ce document.'];
const donneesResidence = () => ({ familles: S.cache.residenceFamilles, residents: S.cache.residenceResidents, journal: S.cache.residenceJournal, remplacements: S.cache.residenceRemplacements, interventions: S.cache.residenceInterventions });

/* ---------- Actions ---------- */
export const actions = {
  'res-tab': el => { S.ongletRes = el.dataset.v; render(); },
  'rp-form': el => { if (peutResidence()) formRP(el.dataset.id); },
  'rf-form': el => { if (peutResidence()) formRF(el.dataset.id); },
  'rr-form': el => { if (peutResidence()) formRR(el.dataset.id); },
  'rj-form': el => { if (peutResidence()) formRJ(el.dataset.id); },
  're-form': el => { if (peutResidence()) formRE(el.dataset.id); },
  'ri-form': el => { if (peutResidence()) formRI(el.dataset.id); },
  'res-xlsx': () => { if (!peutResidence()) return; const an = anneeResidence(); telecharger(`residence-${an}.xlsx`, classeur(L.tableauxResidence(donneesResidence(), an), entete(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'res-pdf': () => { if (!peutResidence()) return; const an = anneeResidence(); imprimer(documentHtml(L.tableauxResidence(donneesResidence(), an), entete(an), `Résidence : chiffres ${an}`)); }
};
export const changes = {
  'res-an': el => { S.anRes = Number(el.value); render(); },
  'res-fjournal': el => { S.fJournalRes = el.checked ? 'asuivre' : ''; render(); }
};
