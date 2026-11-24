// Bibliothèque des voyages et sorties (lot J, v1.22.0) : une fiche par sortie (destination, date, programme, prestataire et
// transporteur choisis dans l'Annuaire, nombre de participants, coût, budget, emplacement du document, retours des participants).
// Recherche par destination déjà visitée ; comparaison d'une année sur l'autre (nombre de sorties, coût total, coût moyen par
// participant). Exports Excel et PDF. Aucune photo (le stockage de fichiers est payant) : seul l'emplacement du document est noté.
// Accès : administratrice uniquement (aucun accès équipe).
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, peutAdmin } from './ui.js';

const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une information d'organisation, par exemple « car à quai à 8h », « prévoir un pique-nique », « très appréciée, à reconduire ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const fr = d => L.fmtDate(d);

export function voyages() {
  if (!pret('voyages')) return chargement('Voyages et sorties');
  const comp = L.comparaisonVoyages(S.cache.voyages);
  return `<div class="top"><div><h1>Bibliothèque des voyages et sorties</h1><p>Une fiche par sortie : destination, programme, prestataire, coût et retours des participants.</p></div>
    <div class="quick"><button class="btn" data-action="vy-form">+ Nouvelle sortie</button><button class="btn sec" data-action="vy-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="vy-pdf">PDF / Imprimer</button></div></div>
  ${comp.length ? `<div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Comparaison d'une année sur l'autre</h2><div style="overflow:auto"><table class="tbl" style="width:100%"><thead><tr><th style="text-align:left">Année</th><th style="text-align:left">Nombre de sorties</th><th style="text-align:left">Coût total</th><th style="text-align:left">Coût moyen par participant</th></tr></thead>
    <tbody>${comp.map(e => `<tr><td>${esc(e.an)}</td><td>${e.nb}</td><td>${esc(L.fmtMontant(e.cout))}</td><td>${esc(L.fmtMontant(e.coutMoyenParticipant))}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
  <input class="search" id="rech-vy" type="search" placeholder="Chercher une destination déjà visitée…" aria-label="Chercher une destination" value="${esc(S.rechVoyages || '')}" style="width:100%;max-width:420px;margin-bottom:10px">
  <div id="liste-vy">${listeVoyages()}</div>`;
}
export function apresVoyages() { const r = $('#rech-vy'); if (r) r.oninput = () => { S.rechVoyages = r.value; $('#liste-vy').innerHTML = listeVoyages(); }; }

function listeVoyages() {
  const q = L.cleNom(S.rechVoyages || '');
  const rows = S.cache.voyages.filter(v => !q || L.cleNom(v.destination || '').includes(q)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (!rows.length) return '<div class="card"><div class="empty"><b>Aucune sortie</b>Ajoutez-en une avec « + Nouvelle sortie ».</div></div>';
  return `<p class="sub">${rows.length} sortie${rows.length > 1 ? 's' : ''}</p>` + rows.map(ligneVoyage).join('');
}
function ligneVoyage(v) {
  return `<button class="cand" data-action="vy-form" data-id="${esc(v.id)}"><span class="av">${esc(initiales(v.destination || '?'))}</span><span style="flex:1"><b>${esc(v.destination || '(sans destination)')}</b>
    <span class="why"><span class="pill p-bleu">${esc(fr(v.date))}</span>${v.participants ? `<span class="pill p-rose">${esc(v.participants)} participant${v.participants > 1 ? 's' : ''}</span>` : ''}
    ${v.cout !== '' && v.cout != null ? `<span class="pill p-ok">${esc(L.fmtMontant(Number(v.cout) || 0))}</span>` : ''}${v.budget ? `<span class="pill p-bleu">${esc(v.budget)}</span>` : ''}</span>
    ${v.prestataireNom ? `<span class="sub">Prestataire : ${esc(v.prestataireNom)}</span>` : ''}</span></button>`;
}

function voyageForm(id) {
  const v = id ? S.cache.voyages.find(x => x.id === id) : { date: aujourdhui(), participants: '', cout: '', budget: '' };
  if (id && !v) return;
  const admin = peutAdmin();
  const contacts = [...S.cache.contacts].map(c => L.normContact(c)).sort(L.comparerPatronyme);
  const activites = [...S.cache.activites].sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
  const budgets = P('listes.budgets');
  const selContact = (idSel, idField) => `<select id="${idField}"><option value="">(aucun)</option>${contacts.map(c => `<option value="${esc(c.id)}" ${c.id === idSel ? 'selected' : ''}>${esc(L.libelleContact(c, contacts))}${c.categorie ? ' (' + esc(c.categorie) + ')' : ''}</option>`).join('')}</select>`;
  modal(`<h2>${id ? 'Modifier la sortie' : 'Nouvelle sortie'}</h2>
  <div class="two"><div class="field"><label for="v1">Destination</label><input id="v1" maxlength="160" value="${esc(v.destination || '')}" placeholder="Ex. : marché de Noël de Bruxelles"></div>
  <div class="field"><label for="v2">Date</label><input id="v2" type="date" value="${esc(v.date || '')}"></div></div>
  <div class="field"><label for="v3">Programme <small class="sub">(facultatif)</small></label><textarea id="v3" rows="3" maxlength="600" placeholder="Déroulé de la sortie, horaires, points de rendez-vous…">${esc(v.programme || '')}</textarea></div>
  <div class="two"><div class="field"><label for="v4">Prestataire <small class="sub">(Annuaire)</small></label>${selContact(v.prestataireId, 'v4')}</div>
  <div class="field"><label for="v5">Transporteur <small class="sub">(Annuaire)</small></label>${selContact(v.transporteurId, 'v5')}</div></div>
  <div class="field"><label for="v6">Activité ou événement lié <small class="sub">(facultatif)</small></label><select id="v6"><option value="">(aucun)</option>${activites.map(a => `<option value="${esc(a.id)}" ${a.id === v.activiteId ? 'selected' : ''}>${esc(a.nom)}</option>`).join('')}</select></div>
  <div class="two"><div class="field"><label for="v7">Nombre de participants</label><input id="v7" inputmode="numeric" value="${esc(v.participants === '' || v.participants == null ? '' : v.participants)}"></div>
  <div class="field"><label for="v8">Coût (€)</label><input id="v8" inputmode="decimal" value="${v.cout === '' || v.cout == null ? '' : esc(L.fmtQte(v.cout))}"></div></div>
  <div class="field"><label for="v9">Budget lié <small class="sub">(facultatif)</small></label><select id="v9"><option value="">(aucun)</option>${budgets.map(b => `<option ${b === v.budget ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>
  <div class="field"><label for="v10">Où se trouve le document (programme, devis…) ? <small class="sub">(facultatif, emplacement en texte seulement)</small></label><input id="v10" maxlength="160" value="${esc(v.documentOu || '')}" placeholder="Ex. : classeur « Sorties », bureau"></div>
  <div class="field"><label for="v11">Retours des participants <small class="sub">(facultatif)</small></label><textarea id="v11" rows="2" maxlength="400">${esc(v.retours || '')}</textarea></div>
  ${AVERT}${v.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(v.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveV">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && admin ? '<button class="btn ghost" id="delV" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveV').onclick = async () => {
    const presta = contacts.find(c => c.id === $('#v4').value), transp = contacts.find(c => c.id === $('#v5').value), act = activites.find(a => a.id === $('#v6').value);
    const doc = { ...(id ? { id } : {}), destination: $('#v1').value.trim(), date: $('#v2').value, programme: $('#v3').value.trim(),
      prestataireId: presta ? presta.id : '', prestataireNom: presta ? L.libelleContact(presta, contacts) : '', transporteurId: transp ? transp.id : '', transporteurNom: transp ? L.libelleContact(transp, contacts) : '',
      activiteId: act ? act.id : '', activiteNom: act ? act.nom : '', participants: $('#v7').value.trim() === '' ? '' : Math.max(0, Math.round(L.lireNombre($('#v7').value)) || 0),
      cout: $('#v8').value.trim() === '' ? '' : L.lireNombre($('#v8').value), budget: $('#v9').value, documentOu: $('#v10').value.trim(), retours: $('#v11').value.trim(), par: v.par || (S.user && S.user.nom) || '' };
    const err = L.erreurVoyage(doc); if (err) return toast(err);
    await sauver('voyages', doc, 'Sortie enregistrée'); closeModal();
  };
  if (id && admin) $('#delV').onclick = () => confirmer('Supprimer cette sortie ?', `« ${v.destination || ''} » (${fr(v.date)}) va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('voyages', v); await store.remove('voyages', id); closeModal(); toast('Sortie mise à la corbeille'); });
}

const enteteExport = () => [`Bibliothèque des voyages et sorties (AniMerci, ${P('nomService')}), éditée le ${fr(aujourdhui())}.`, 'Aucune donnée de santé dans ce document.'];

export const actions = {
  'vy-form': el => voyageForm(el.dataset.id),
  'vy-xlsx': () => { if (!peutAdmin()) return; telecharger('voyages-et-sorties.xlsx', classeur(L.tableauxVoyages(S.cache.voyages), enteteExport()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'vy-pdf': () => { if (!peutAdmin()) return; imprimer(documentHtml(L.tableauxVoyages(S.cache.voyages), enteteExport(), 'Bibliothèque des voyages et sorties')); }
};
export const changes = {};
