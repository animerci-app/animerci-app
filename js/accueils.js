// Accueils (lot E, v1.20.0) : jeunes adultes (bourse), services civiques, stagiaires.
// Écran réservé à l'administratrice. Tout est écrit pour l'ORGANISATION du service (qui est accueilli, quand, pour quelles missions, où est la convention) : aucune donnée de santé.
// Les conventions ne sont pas stockées dans l'outil (pas de fichier) : on suit leur état, leur échéance et l'endroit où se trouve le document.
// Les heures de mission de la bourse sont saisies par l'administratrice seule. Les calculs (heures restantes, retard, alertes, chiffres) sont dans logic.js.
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, peutAdmin } from './ui.js';

const ONGLETS = [...Object.entries(L.ONGLETS_ACCUEIL), ['chiffres', 'Chiffres de l\'année']];
export const ongletAccueils = () => (ONGLETS.some(o => o[0] === S.ongletAccueils) ? S.ongletAccueils : 'bourse');
const fr = d => L.fmtDate(d);
const nombre = n => String(n).replace('.', ',');
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : des éléments d'organisation, par exemple « accompagne l'atelier créatif le mardi », « point de suivi fixé au 12 », « horaires à revoir avec le tuteur ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé ou de situation personnelle sensible. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const PILL_STATUT = { avenir: 'p-bleu', encours: 'p-ok', termine: 'p-warn', clos: 'p-rose' };
const PILL_CONV = { sans: 'p-bleu', asigner: 'p-warn', signee: 'p-ok' };
const liste = () => S.cache.accueils;
const accueilDe = id => liste().find(x => x.id === id);

/* ---------- Écran ---------- */
export function accueils() {
  if (!pret('accueils')) return chargement('Accueils');
  const tab = ongletAccueils(), nouveau = tab !== 'chiffres';
  return `<div class="top"><div><h1>Accueils</h1><p>Jeunes adultes de la bourse, services civiques et stagiaires accueillis par le service : dates, missions, convention, suivi et heures.</p></div>
    <div class="quick">${nouveau ? `<button class="btn" data-action="ac-form" data-type="${tab}">+ Nouvelle fiche</button>` : '<button class="btn sec" data-action="ac-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="ac-pdf">PDF / Imprimer</button>'}</div></div>
  <div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="ac-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
  ${tab === 'chiffres' ? vueChiffres() : vueListe(tab)}`;
}
function vueListe(type) {
  const auj = aujourdhui(), tous = liste().filter(d => d.type === type), clos = tous.filter(d => d.clos).length, voir = S.acClos === true;
  const rows = tous.filter(d => voir || !d.clos).sort((a, b) => (a.clos ? 1 : 0) - (b.clos ? 1 : 0) || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
  return `${clos ? `<label class="chk" style="margin:0 0 10px"><input type="checkbox" data-change="ac-clos" ${voir ? 'checked' : ''}> Afficher aussi les fiches closes (${clos})</label>` : ''}
  ${rows.length ? `<p class="sub">${rows.length} fiche${rows.length > 1 ? 's' : ''}</p>${rows.map(d => ligne(d, auj)).join('')}` : `<div class="card"><div class="empty"><b>Aucune fiche</b>Ajoutez la première avec « + Nouvelle fiche ».</div></div>`}`;
}
function ligne(d, auj) {
  const st = L.statutAccueil(d, auj), conv = (d.convention && d.convention.etat) || 'sans', H = d.type === 'bourse' ? L.bilanHeures(d, auj) : null;
  const periode = [d.debut && 'du ' + fr(d.debut), d.fin && 'au ' + fr(d.fin)].filter(Boolean).join(' ');
  const barre = H && H.objectif ? `<div class="sub">Heures : <b>${nombre(H.validees)}</b> / ${nombre(H.objectif)} h · restantes ${nombre(H.restantes)} h${H.aValider ? ` · à valider ${nombre(H.aValider)} h` : ''}${H.retard > P('accueils.seuilRetardHeures') && st === 'encours' ? ` · <span class="pill p-warn">En retard de ${nombre(H.retard)} h</span>` : ''}</div>` : '';
  return `<button class="cand" data-action="ac-detail" data-id="${esc(d.id)}"><span class="av" aria-hidden="true">${esc(initiales(L.nomAccueil(d)))}</span>
    <span style="flex:1"><b>${esc(L.nomAccueil(d))}</b><span class="why"><span class="pill ${PILL_STATUT[st]}">${L.LIBELLES_STATUT_ACCUEIL[st]}</span><span class="pill ${PILL_CONV[conv]}">${L.ETATS_CONVENTION[conv]}</span>${d.type === 'bourse' && d.etatDossier ? `<span class="pill p-bleu">${esc(d.etatDossier)}</span>` : ''}</span>
    ${periode ? `<span class="sub">${esc(periode)}</span>` : ''}${barre}</span></button>`;
}

/* ---------- Fiche (consultation) ---------- */
// `d` : la fiche à afficher (celle qu'on vient d'enregistrer, sans attendre que la liste se rafraîchisse)
function detail(id, d = accueilDe(id)) {
  if (!d) return;
  const auj = aujourdhui(), st = L.statutAccueil(d, auj), conv = d.convention || {}, H = d.type === 'bourse' ? L.bilanHeures(d, auj) : null;
  const ligneInfo = (l, v) => (v ? `<div class="row" style="padding:3px 0"><span class="sub" style="min-width:150px">${l}</span><span class="grow">${esc(v)}</span></div>` : '');
  const heures = L.heuresDe(d), rdv = (Array.isArray(d.rdv) ? d.rdv : []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  modal(`<h2>${esc(L.nomAccueil(d))}</h2><p class="sub" style="margin:0 0 8px">${L.TYPES_ACCUEIL[d.type]} · <span class="pill ${PILL_STATUT[st]}">${L.LIBELLES_STATUT_ACCUEIL[st]}</span></p>
  ${ligneInfo('Période', [d.debut && 'du ' + fr(d.debut), d.fin && 'au ' + fr(d.fin)].filter(Boolean).join(' '))}${ligneInfo('Téléphone', d.tel)}${ligneInfo('E-mail', d.email)}
  ${ligneInfo('Établissement', d.etablissement)}${ligneInfo('Référent·e', d.referent)}${ligneInfo('Missions', d.missions)}${ligneInfo('Objectifs', d.objectifs)}${ligneInfo('Points d\'organisation à revoir', d.pointsOrganisation)}
  ${ligneInfo('Convention', L.ETATS_CONVENTION[conv.etat || 'sans'] + (conv.echeance ? ' · échéance ' + fr(conv.echeance) : '') + (conv.ou ? ' · document : ' + conv.ou : ''))}
  ${d.type === 'bourse' ? ligneInfo('Dossier', [d.etatDossier, d.valideLe && 'validé le ' + fr(d.valideLe), d.verseLe && 'bourse de ' + nombre(d.montant || 0) + ' € versée le ' + fr(d.verseLe)].filter(Boolean).join(' · ')) + ligneInfo('Montant prévu', d.montant != null && d.montant !== '' ? nombre(d.montant) + ' €' : '') : ''}
  ${ligneInfo('Bilan', d.bilan)}
  ${H ? `<h3 style="margin:14px 0 6px">Heures de mission : ${nombre(H.validees)} / ${nombre(H.objectif)} h <small class="sub">(restantes ${nombre(H.restantes)} h${H.attendues != null ? ` · attendues à ce jour ${nombre(H.attendues)} h` : ''})</small></h3>
    ${heures.length ? heures.map(h => `<div class="row" style="border-top:1px solid var(--ligne);padding:5px 0;align-items:center"><span class="pill p-bleu">${esc(fr(h.date))}</span><div class="grow"><b>${nombre(h.heures)} h</b>${h.mission ? ' · ' + esc(h.mission) : ''}${h.validee === false ? ' <span class="pill p-warn">à valider</span>' : ''}<div class="sub">${h.par ? 'Saisi par ' + esc(h.par) : ''}</div></div>
      <button class="btn ghost" data-action="ac-h-val" data-id="${esc(d.id)}" data-h="${esc(h.id)}">${h.validee === false ? 'Valider' : 'Dévalider'}</button><button class="btn ghost" data-action="ac-h-del" data-id="${esc(d.id)}" data-h="${esc(h.id)}" aria-label="Supprimer cette ligne d'heures">✕</button></div>`).join('') : '<p class="sub">Aucune heure saisie.</p>'}
    <div class="two" style="margin-top:8px"><div class="field"><label for="h1">Date</label><input id="h1" type="date" value="${esc(auj)}"></div><div class="field"><label for="h2">Durée (heures)</label><input id="h2" type="number" step="0.25" min="0.25" max="24" placeholder="2,5"></div></div>
    <div class="field"><label for="h3">Mission <small class="sub">(facultatif)</small></label><input id="h3" maxlength="120" autocomplete="off" placeholder="Ex. : atelier créatif du mardi"></div>
    <label class="chk" style="margin:0 0 8px"><input type="checkbox" id="h4" checked> Heures validées</label><button class="btn sec" data-action="ac-h-add" data-id="${esc(d.id)}">Ajouter ces heures</button>
    <div class="quick" style="margin-top:12px"><button class="btn sec" data-action="ac-dossier" data-id="${esc(d.id)}" data-v="valide">${d.valideLe ? 'Corriger la date de validation' : 'Noter la validation du dossier'}</button><button class="btn sec" data-action="ac-dossier" data-id="${esc(d.id)}" data-v="verse">${d.verseLe ? 'Corriger le versement' : 'Noter le versement de la bourse'}</button></div>` : ''}
  ${d.type !== 'bourse' ? `<h3 style="margin:14px 0 6px">Rendez-vous de suivi</h3>${rdv.length ? rdv.map(r => `<div class="row" style="border-top:1px solid var(--ligne);padding:5px 0;align-items:center"><span class="pill p-bleu">${esc(fr(r.date))}</span><div class="grow">${esc(r.objet || 'Rendez-vous de suivi')}</div><button class="btn ghost" data-action="ac-r-del" data-id="${esc(d.id)}" data-r="${esc(r.id)}" aria-label="Supprimer ce rendez-vous">✕</button></div>`).join('') : '<p class="sub">Aucun rendez-vous noté.</p>'}
    <div class="two" style="margin-top:8px"><div class="field"><label for="r1">Date</label><input id="r1" type="date"></div><div class="field"><label for="r2">Objet <small class="sub">(facultatif)</small></label><input id="r2" maxlength="120" autocomplete="off" placeholder="Ex. : point à mi-parcours"></div></div><button class="btn sec" data-action="ac-r-add" data-id="${esc(d.id)}">Ajouter ce rendez-vous</button>` : ''}
  <div class="quick" style="margin-top:16px"><button class="btn" data-action="ac-form" data-id="${esc(d.id)}">Modifier la fiche</button><button class="btn sec" data-action="ac-clore" data-id="${esc(d.id)}">${d.clos ? 'Rouvrir' : 'Clore la fiche'}</button><button class="btn ghost" data-action="close">Fermer</button><button class="btn ghost" data-action="ac-suppr" data-id="${esc(d.id)}" style="margin-left:auto">Supprimer</button></div>`);
}

/* ---------- Formulaire ---------- */
function formulaire(id, type) {
  const e = id ? accueilDe(id) : { type, convention: { etat: 'asigner' }, objectifHeures: P('accueils.objectifHeures'), montant: P('accueils.montantBourse'), etatDossier: P('accueils.etatsDossier')[0] };
  if (!e) return; type = e.type; const conv = e.convention || {};
  modal(`<h2>${id ? esc(L.nomAccueil(e)) : 'Nouvelle fiche : ' + L.TYPES_ACCUEIL[type]}</h2>
  <div class="two"><div class="field"><label for="a1">Nom</label><input id="a1" maxlength="80" autocomplete="off" value="${esc(e.nom || '')}"></div><div class="field"><label for="a2">Prénom</label><input id="a2" maxlength="80" autocomplete="off" value="${esc(e.prenom || '')}"></div></div>
  <div class="two"><div class="field"><label for="a3">Téléphone <small class="sub">(facultatif)</small></label><input id="a3" type="tel" maxlength="30" autocomplete="off" value="${esc(e.tel || '')}"></div><div class="field"><label for="a4">E-mail <small class="sub">(facultatif)</small></label><input id="a4" type="email" maxlength="120" autocomplete="off" value="${esc(e.email || '')}"></div></div>
  <div class="two"><div class="field"><label for="a5">Début</label><input id="a5" type="date" value="${esc(e.debut || '')}"></div><div class="field"><label for="a6">Fin</label><input id="a6" type="date" value="${esc(e.fin || '')}"></div></div>
  ${type === 'stagiaire' ? `<div class="two"><div class="field"><label for="a7">Établissement</label><input id="a7" maxlength="120" autocomplete="off" value="${esc(e.etablissement || '')}"></div><div class="field"><label for="a8">Référent·e (tuteur ou tutrice)</label><input id="a8" maxlength="120" autocomplete="off" value="${esc(e.referent || '')}"></div></div>` : ''}
  ${type === 'bourse' ? `<div class="two"><div class="field"><label for="a9">Objectif d'heures</label><input id="a9" type="number" min="1" max="1000" value="${esc(e.objectifHeures || '')}"></div><div class="field"><label for="a10">Montant de la bourse (€)</label><input id="a10" type="number" min="0" max="100000" step="1" value="${esc(e.montant == null ? '' : e.montant)}"></div></div>
    <div class="field"><label for="a11">État du dossier</label><select id="a11">${[...new Set([...P('accueils.etatsDossier'), e.etatDossier].filter(Boolean))].map(x => `<option ${e.etatDossier === x ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></div>` : ''}
  <div class="field"><label for="a12">Missions confiées</label><textarea id="a12" rows="3" maxlength="600">${esc(e.missions || '')}</textarea></div>
  ${type === 'civique' ? `<div class="field"><label for="a13">Objectifs de la mission</label><textarea id="a13" rows="2" maxlength="600">${esc(e.objectifs || '')}</textarea></div>
    <div class="field"><label for="a14">Points d'organisation à revoir <small class="sub">(facultatif)</small></label><textarea id="a14" rows="2" maxlength="600">${esc(e.pointsOrganisation || '')}</textarea></div>` : ''}
  <div class="two"><div class="field"><label for="a15">Convention</label><select id="a15">${Object.entries(L.ETATS_CONVENTION).map(([k, l]) => `<option value="${k}" ${(conv.etat || 'sans') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="a16">Échéance de la convention</label><input id="a16" type="date" value="${esc(conv.echeance || '')}"></div></div>
  <div class="field"><label for="a17">Où se trouve le document de la convention ?</label><input id="a17" maxlength="160" autocomplete="off" value="${esc(conv.ou || '')}" placeholder="Ex. : classeur du bureau, dossier « stagiaires 2026 »"><small class="sub">L'outil ne conserve pas le document : il garde seulement son emplacement.</small></div>
  <div class="field"><label for="a18">Bilan <small class="sub">(facultatif, en fin de mission)</small></label><textarea id="a18" rows="3" maxlength="1000">${esc(e.bilan || '')}</textarea></div>
  ${AVERT}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveAc">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  const v = k => { const el = $('#' + k); return el ? el.value.trim() : undefined; };
  $('#saveAc').onclick = async () => {
    const d = { ...(id ? { id } : {}), type, clos: !!e.clos, nom: v('a1'), prenom: v('a2'), tel: v('a3'), email: v('a4'), debut: v('a5'), fin: v('a6'), missions: v('a12'), bilan: v('a18'),
      convention: { etat: v('a15'), echeance: v('a16'), ou: v('a17') } };
    if (type === 'stagiaire') { d.etablissement = v('a7'); d.referent = v('a8'); }
    if (type === 'bourse') { d.objectifHeures = Number(v('a9')); d.montant = v('a10') === '' ? '' : Number(v('a10')); d.etatDossier = v('a11'); }
    if (type === 'civique') { d.objectifs = v('a13'); d.pointsOrganisation = v('a14'); }
    const err = L.erreurAccueil(d); if (err) return toast(err);
    const nid = await sauver('accueils', d, 'Fiche enregistrée');
    closeModal(); detail(nid, { ...(id ? e : {}), ...d, id: nid });
  };
}

/* ---------- Modifications d'une fiche existante ---------- */
async function maj(id, f, msg) { const d = accueilDe(id); if (!d) return; const n = f(d); await sauver('accueils', n, msg); detail(id, n); }
function ajouterHeures(id) {
  const h = { date: $('#h1').value, heures: Number($('#h2').value), mission: $('#h3').value.trim(), validee: $('#h4').checked, par: S.user.nom }, err = L.erreurHeure(h); if (err) return toast(err);
  return maj(id, d => L.avecHeure(d, h), 'Heures enregistrées');
}
function ajouterRdv(id) {
  const r = { date: $('#r1').value, objet: $('#r2').value.trim() }; if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date)) return toast('Indiquez la date du rendez-vous.');
  return maj(id, d => L.avecRdv(d, r), 'Rendez-vous noté');
}
function dateDossier(id, quoi) {
  const d = accueilDe(id); if (!d) return; const verse = quoi === 'verse';
  modal(`<h2>${verse ? 'Versement de la bourse' : 'Validation du dossier'}</h2><p class="sub" style="margin:0 0 10px"><b>${esc(L.nomAccueil(d))}</b></p>
  <div class="field"><label for="v1">${verse ? 'Date du versement' : 'Date de validation'}</label><input id="v1" type="date" value="${esc((verse ? d.verseLe : d.valideLe) || aujourdhui())}"></div>
  ${verse ? `<div class="field"><label for="v2">Montant versé (€)</label><input id="v2" type="number" min="0" max="100000" value="${esc(d.montant == null || d.montant === '' ? P('accueils.montantBourse') : d.montant)}"></div>` : ''}
  <label class="chk" style="margin:0 0 8px"><input type="checkbox" id="v3"> Effacer cette date</label>
  <div class="quick"><button class="btn" id="saveV">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#saveV').onclick = async () => {
    const effacer = $('#v3').checked, date = effacer ? '' : $('#v1').value;
    if (!effacer && !/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('Indiquez la date.');
    const patch = verse ? { verseLe: date, ...(effacer ? {} : { montant: Number($('#v2').value) || 0 }) } : { valideLe: date };
    if (verse && !effacer && !(Number($('#v2').value) >= 0)) return toast('Le montant est invalide.');
    const etats = P('accueils.etatsDossier'), suivant = effacer ? null : etats[verse ? etats.length - 1 : Math.min(2, etats.length - 1)];
    const n = { ...d, ...patch, ...(suivant ? { etatDossier: suivant } : {}) };
    await sauver('accueils', n, 'Dossier mis à jour'); closeModal(); detail(id, n);
  };
}

/* ---------- Chiffres de l'année ---------- */
export const anneeAccueils = () => Number(S.anAccueils) || Number(aujourdhui().slice(0, 4));
const benevoles = () => S.cache.contacts;
const tableaux = an => L.tableauxAccueils(liste(), an, benevoles(), P('annuaire.rubriques.activiteBenevole'), aujourdhui());
const tableau = (cols, lignes) => `<table class="tbl" style="width:100%"><thead><tr>${cols.map(c => `<th style="text-align:left">${esc(c)}</th>`).join('')}</tr></thead><tbody>${lignes.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
function vueChiffres() {
  if (!pret('contacts')) return chargement('Chiffres de l\'année');
  const an = anneeAccueils(), a0 = Number(aujourdhui().slice(0, 4)), T = tableaux(an);
  return `<div class="field" style="max-width:160px;margin-bottom:10px"><label for="ac-an">Année</label><select id="ac-an" data-change="ac-an">${[a0 + 1, a0, a0 - 1, a0 - 2, a0 - 3].filter((x, i, t) => t.indexOf(x) === i).concat(an).filter((x, i, t) => t.indexOf(x) === i).sort((x, y) => y - x).map(x => `<option ${x === an ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">${esc(T[0].titre)}</h2>${tableau(T[0].cols, T[0].rows)}<p class="sub" style="margin:8px 0 0">Les bénévoles actifs sont ceux de l'Annuaire (catégorie « ${esc(P('annuaire.rubriques.activiteBenevole'))} ») non marqués inactifs. Les remerciements se notent sur leur fiche.</p></div>
  <div class="card"><h2 style="margin-top:0">${esc(T[1].titre)}</h2>${T[1].rows.length ? tableau(T[1].cols, T[1].rows) : '<div class="empty"><b>Aucun accueil cette année</b></div>'}</div>`;
}
const entete = an => [`Accueils : chiffres ${an} (AniMerci, ${P('nomService')}), édité le ${fr(aujourdhui())}.`, 'Aucune donnée de santé dans ce document.'];

/* ---------- Actions ---------- */
export const actions = {
  'ac-tab': el => { S.ongletAccueils = el.dataset.v; render(); },
  'ac-form': el => { if (peutAdmin()) formulaire(el.dataset.id, el.dataset.type); },
  'ac-detail': el => detail(el.dataset.id),
  'ac-h-add': el => peutAdmin() && ajouterHeures(el.dataset.id),
  'ac-h-val': el => peutAdmin() && maj(el.dataset.id, d => { const h = L.heuresDe(d).find(x => x.id === el.dataset.h); return h ? L.avecHeureValidee(d, h.id, h.validee === false) : d; }, 'Heures mises à jour'),
  'ac-h-del': el => peutAdmin() && maj(el.dataset.id, d => L.sansHeure(d, el.dataset.h), 'Ligne supprimée'),
  'ac-r-add': el => peutAdmin() && ajouterRdv(el.dataset.id),
  'ac-r-del': el => peutAdmin() && maj(el.dataset.id, d => L.sansRdv(d, el.dataset.r), 'Rendez-vous supprimé'),
  'ac-dossier': el => peutAdmin() && dateDossier(el.dataset.id, el.dataset.v),
  'ac-clore': el => peutAdmin() && maj(el.dataset.id, d => ({ ...d, clos: !d.clos }), 'Fiche mise à jour'),
  'ac-suppr': el => { const d = accueilDe(el.dataset.id); if (!d || !peutAdmin()) return; confirmer('Supprimer cette fiche ?', `« ${L.nomAccueil(d)} » va à la corbeille (restaurable pendant ${P('securite.joursCorbeille')} jours).`, 'Supprimer', async () => { await mettreCorbeille('accueils', d); await store.remove('accueils', d.id); closeModal(); toast('Fiche mise à la corbeille'); }); },
  'ac-xlsx': () => { if (!peutAdmin()) return; const an = anneeAccueils(); telecharger(`accueils-${an}.xlsx`, classeur(tableaux(an), entete(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'ac-pdf': () => { if (!peutAdmin()) return; const an = anneeAccueils(); imprimer(documentHtml(tableaux(an), entete(an), `Accueils : chiffres ${an}`)); }
};
export const changes = {
  'ac-an': el => { S.anAccueils = Number(el.value); render(); },
  'ac-clos': el => { S.acClos = el.checked; render(); }
};
