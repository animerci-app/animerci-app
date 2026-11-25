// Portage de repas à domicile (lot B, v1.19.0) : bénéficiaires (interruptions, reprises, arrêts), échanges avec le prestataire, statistiques annuelles.
// Tout est écrit pour l'ORGANISATION du service (qui reçoit le portage, quels jours, depuis quand) : aucun motif ni champ de santé.
// Accès : l'administratrice et l'équipe (intervenant·es, bénévoles) consultent et saisissent ; chaque événement garde « saisi par ». La suppression, l'initialisation et les exports restent à l'administratrice.
// L'équipe ne lit pas les fiches des personnes : un document « portage » par bénéficiaire recopie le strict nécessaire (nom, sexe, année de naissance, jours de livraison).
// Les calculs (états, statistiques, alertes) sont dans logic.js ; ici : les écrans, les formulaires et la mise en accord avec les fiches.
import { store } from './store.js';
import * as L from './logic.js';
import { P, moduleActif } from './parametres.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, peutAdmin } from './ui.js';

const ONGLETS = [['beneficiaires', 'Bénéficiaires'], ['journal', 'Journal de suivi'], ['echanges', 'Échanges avec le prestataire'], ['stats', 'Statistiques annuelles']];
export const ongletPortage = () => (ONGLETS.some(o => o[0] === S.ongletPortage) ? S.ongletPortage : 'beneficiaires');
export const anneePortage = () => Number(S.anPortage) || Number(aujourdhui().slice(0, 4));
const fr = d => L.fmtDate(d);
const nomDe = d => `${d.prenom || ''} ${d.nom || ''}`.trim() || 'Personne';
const maintenant = () => new Date().toISOString();
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une information d'organisation, par exemple « absente du 3 au 17 août », « livraison à décaler au jeudi », « repas à déposer chez la voisine ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé (maladie, hospitalisation, décès, régime médical…). Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const etatDe = d => L.champsPortage(d).etat;
const PILL = { encours: 'p-ok', interrompu: 'p-warn', arrete: 'p-rose' };
// Le document « initialisation » (parametres/portage) existe dès que l'administratrice a ouvert le Portage une première fois : les bénéficiaires déjà présents ont alors été notés « avant 2026 ».
export const initialise = () => S.cache.parametres.some(x => x.id === 'portage' && x.initialise);

/* ---------- Mise en accord avec les fiches (administratrice) ---------- */
// Une fois par ouverture de l'écran : crée le document des bénéficiaires qui n'en ont pas, recopie les changements de nom ou de jours. Ne change jamais l'état d'un bénéficiaire.
export async function synchroniser() {
  if (!peutAdmin() || S.view !== 'portage' || !moduleActif('portage')) return;
  if (!pret('portage') || !pret('seniors') || !pret('parametres')) return;
  if (S.portageSyncNav === S.navId) return;
  S.portageSyncNav = S.navId;
  const premiere = !initialise();
  const plan = L.planSynchroPortage(S.cache.seniors, S.cache.portage, { auj: aujourdhui(), par: S.user.nom, le: maintenant(), premiere });
  try {
    for (const d of plan) await store.save('portage', d);
    if (premiere) await store.save('parametres', { id: 'portage', initialise: maintenant() });
  } catch (e) { toast('Mise en accord du portage impossible : ' + e.message); }
}
// Après l'enregistrement d'une fiche : recopie le nom et les jours, et applique la case « Reçoit le portage » cochée ou décochée. `avant` : la fiche avant modification (null pour une nouvelle fiche).
export async function apresFiche(avant, senior) {
  try {
    if (!peutAdmin() || !moduleActif('portage') || !initialise()) return; // tant que le Portage n'a jamais été ouvert, l'initialisation s'en chargera
    const existants = await store.lire('portage', ['seniorId', '==', senior.id]), ctx = { auj: aujourdhui(), par: S.user.nom, le: maintenant() };
    let d = L.planSynchroPortage([senior], existants, ctx)[0] || existants[0] || null, change = !!L.planSynchroPortage([senior], existants, ctx).length;
    const t = d && L.evenementFichePortage(d, { avant: !!(avant && avant.portage), apres: !!senior.portage }, ctx);
    if (t) { d = t; change = true; }
    if (d && change) await store.save('portage', d);
  } catch (e) { console.warn('portage : mise en accord avec la fiche', e); }
}

/* ---------- Écran « Portage » ---------- */
export function portage() {
  if (!pret('portage')) return chargement('Portage de repas');
  const tab = ongletPortage(), admin = peutAdmin();
  const ajout = { beneficiaires: null, journal: ['pg-jo-form', '+ Nouvelle entrée'], echanges: ['pg-ech-form', '+ Nouvel échange'], stats: null }[tab];
  return `<div class="top"><div><h1>Portage de repas</h1><p>Les personnes qui reçoivent le portage à domicile : jours de livraison, interruptions, reprises et arrêts, journal de suivi, échanges avec l'entreprise de restauration et chiffres de l'année.</p></div>
    <div class="quick">${ajout ? `<button class="btn" data-action="${ajout[0]}">${ajout[1]}</button>` : ''}${tab === 'stats' && admin ? '<button class="btn sec" data-action="pg-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="pg-pdf">PDF / Imprimer</button>' : ''}</div></div>
  <div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="pg-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
  ${tab === 'journal' ? vueJournal() : tab === 'echanges' ? vueEchanges() : tab === 'stats' ? vueStats() : vueBeneficiaires()}`;
}
export function apresPortage() {
  const r = $('#rech-pg'); if (r) r.oninput = () => { S.rechPortage = r.value; $('#liste-pg').innerHTML = listeBeneficiaires(); };
  const e = $('#rech-ech'); if (e) e.oninput = () => { S.rechEchPortage = e.value; $('#liste-ech').innerHTML = listeEchanges(); };
  const j = $('#rech-jo'); if (j) j.oninput = () => { S.rechJoPortage = j.value; $('#liste-jo').innerHTML = listeJournal(); };
}

/* ---------- Bénéficiaires ---------- */
const FILTRES = [['actifs', 'En service'], ['encours', 'En cours'], ['interrompu', 'Interrompus'], ['arrete', 'Arrêtés'], ['tous', 'Tous']];
const docsPortage = () => S.cache.portage.filter(d => L.evenementsPortage(d).length);
function vueBeneficiaires() {
  const docs = docsPortage(), n = k => k === 'tous' ? docs.length : k === 'actifs' ? docs.filter(d => etatDe(d) !== 'arrete').length : docs.filter(d => etatDe(d) === k).length;
  const f = FILTRES.some(x => x[0] === S.fPortage) ? S.fPortage : 'actifs';
  return `<div class="filters">${FILTRES.map(([k, l]) => `<button data-action="pg-filtre" data-v="${k}" aria-pressed="${f === k}">${l} (${n(k)})</button>`).join('')}</div>
  <input class="search" id="rech-pg" type="search" placeholder="Chercher une personne…" aria-label="Chercher un bénéficiaire" value="${esc(S.rechPortage || '')}" style="margin-bottom:10px">
  <div id="liste-pg">${listeBeneficiaires()}</div>
  <p class="sub" style="margin-top:12px">Les jours de livraison se modifient dans la fiche de la personne (Personnes › case « Reçoit le portage de repas »). Une interruption est temporaire : la personne reste bénéficiaire. Un arrêt met fin au service ; il peut être suivi d'un nouveau début.</p>`;
}
function listeBeneficiaires() {
  const f = FILTRES.some(x => x[0] === S.fPortage) ? S.fPortage : 'actifs', q = L.cleNom(S.rechPortage || ''), auj = aujourdhui();
  const rows = docsPortage().filter(d => (f === 'tous' || (f === 'actifs' ? etatDe(d) !== 'arrete' : etatDe(d) === f)) && (!q || L.cleNom(nomDe(d)).includes(q)))
    .sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr') || String(a.prenom || '').localeCompare(String(b.prenom || ''), 'fr'));
  if (!rows.length) return `<div class="card"><div class="empty"><b>Aucun bénéficiaire ici</b>${docsPortage().length ? 'Essayez un autre filtre.' : peutAdmin() ? 'Cochez « Reçoit le portage de repas » dans la fiche d\'une personne : elle apparaît ici.' : 'L\'administratrice n\'a pas encore ouvert cet écran : la liste apparaîtra après sa première visite.'}</div></div>`;
  return `<p class="sub">${rows.length} personne${rows.length > 1 ? 's' : ''}</p>` + rows.map(d => ligneBeneficiaire(d, auj)).join('');
}
function ligneBeneficiaire(d, auj) {
  const c = L.champsPortage(d), ev = L.evenementsPortage(d), der = ev[ev.length - 1], jours = L.libelleFrequence({ jours: d.jours, precision: d.precision });
  const retard = c.etat === 'interrompu' && c.reprisePrevue && c.reprisePrevue < auj;
  const detail = c.etat === 'interrompu' ? `Interrompu depuis le ${esc(fr(der.date))}${c.reprisePrevue ? ` · <span class="pill ${retard ? 'p-crit' : 'p-bleu'}">Reprise prévue le ${esc(fr(c.reprisePrevue))}${retard ? ' (dépassée)' : ''}</span>` : ' · reprise non datée'} · ${esc(der.motif || '')}${der.precision ? ' (' + esc(der.precision) + ')' : ''}`
    : c.etat === 'arrete' ? `Arrêté le ${esc(fr(der.date))} · ${esc(der.motif || '')}${der.precision ? ' (' + esc(der.precision) + ')' : ''}` : '';
  const boutons = c.etat === 'encours' ? `<button class="btn sec" data-action="pg-evt" data-id="${esc(d.id)}" data-type="interruption">Interrompre</button><button class="btn sec" data-action="pg-evt" data-id="${esc(d.id)}" data-type="arret">Arrêter</button>`
    : c.etat === 'interrompu' ? `<button class="btn" data-action="pg-evt" data-id="${esc(d.id)}" data-type="reprise">Reprendre</button><button class="btn sec" data-action="pg-evt" data-id="${esc(d.id)}" data-type="arret">Arrêter</button>`
      : `<button class="btn sec" data-action="pg-evt" data-id="${esc(d.id)}" data-type="debut">Recommencer le service</button>`;
  return `<div class="card" style="margin-bottom:8px"><div class="row" style="align-items:flex-start;gap:10px"><span class="av" aria-hidden="true">${esc(initiales(nomDe(d)))}</span>
    <div class="grow"><b>${esc(nomDe(d))}</b> <span class="pill ${PILL[c.etat]}">${L.ETATS_PORTAGE[c.etat]}</span>
    <div class="sub">${esc(jours)} · début : ${esc(L.libelleDebutPortage(d))}</div>${detail ? `<div class="sub">${detail}</div>` : ''}</div></div>
    <div class="quick" style="margin-top:8px">${boutons}<button class="btn ghost" data-action="pg-histo" data-id="${esc(d.id)}">Historique</button></div></div>`;
}

/* ---------- Interrompre, reprendre, arrêter, recommencer ---------- */
const TITRES = { interruption: 'Interrompre le portage', reprise: 'Reprendre le portage', arret: 'Arrêter définitivement le portage', debut: 'Recommencer le service' };
const MESSAGES = { interruption: 'Interruption enregistrée', reprise: 'Reprise enregistrée', arret: 'Arrêt enregistré', debut: 'Service recommencé' };
function evtForm(id, type) {
  const d = S.cache.portage.find(x => x.id === id); if (!d || !TITRES[type]) return;
  const motifs = P('portage.motifs'), avecMotif = type === 'interruption' || type === 'arret';
  modal(`<h2>${TITRES[type]}</h2><p class="sub" style="margin:0 0 10px"><b>${esc(nomDe(d))}</b> · ${esc(L.libelleFrequence({ jours: d.jours, precision: d.precision }))}</p>
  ${type === 'arret' ? '<div class="note" style="margin:0 0 10px">Un <b>arrêt définitif</b> met fin au service. Pour une absence qui se terminera, choisissez plutôt <b>Interrompre</b> : la personne reste bénéficiaire.</div>' : ''}
  <div class="two"><div class="field"><label for="g1">${type === 'interruption' ? 'Début de l\'interruption' : type === 'reprise' ? 'Date de reprise' : type === 'debut' ? 'Date de reprise du service' : 'Date de l\'arrêt'}</label><input id="g1" type="date" value="${esc(aujourdhui())}"></div>
  ${type === 'interruption' ? '<div class="field"><label for="g2">Reprise prévue <small class="sub">(facultatif)</small></label><input id="g2" type="date"></div>' : ''}</div>
  ${avecMotif ? `<div class="field"><label for="g3">Motif</label><select id="g3"><option value="">— Choisir —</option>${motifs.map(m => `<option>${esc(m)}</option>`).join('')}</select></div>
  <div class="field"><label for="g4">Précision <small class="sub">(facultatif)</small></label><input id="g4" maxlength="200" autocomplete="off" placeholder="Ex. : absente du 3 au 17 août"></div>${AVERT}` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveG">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#saveG').onclick = async () => {
    const ev = { type, date: $('#g1').value, reprise: type === 'interruption' ? $('#g2').value : '', motif: avecMotif ? $('#g3').value : '', precision: avecMotif ? $('#g4').value : '' };
    const err = L.erreurEvenementPortage(d, ev, motifs); if (err) return toast(err);
    await sauver('portage', L.avecEvenementPortage(d, { ...ev, par: S.user.nom, le: maintenant() }), MESSAGES[type]);
    closeModal();
  };
}
function histoForm(id) {
  const d = S.cache.portage.find(x => x.id === id); if (!d) return;
  const ev = L.evenementsPortage(d);
  modal(`<h2>Historique du portage</h2><p class="sub" style="margin:0 0 10px"><b>${esc(nomDe(d))}</b> · ${esc(L.libelleFrequence({ jours: d.jours, precision: d.precision }))}</p>
  ${ev.map(e => `<div class="row" style="border-top:1px solid var(--ligne);padding:8px 0;align-items:flex-start"><span class="pill p-bleu">${e.avant ? 'avant ' + L.ANNEE_REFERENCE_PORTAGE : esc(fr(e.date))}</span><div class="grow"><b>${esc(L.TYPES_EVENEMENT_PORTAGE[e.type])}</b>
    ${e.reprise ? `<div class="sub">Reprise prévue le ${esc(fr(e.reprise))}</div>` : ''}${e.motif ? `<div class="sub">${esc(e.motif)}${e.precision ? ' · ' + esc(e.precision) : ''}</div>` : ''}
    <div class="sub">${e.par ? 'Saisi par ' + esc(e.par) : ''}${e.le ? ' le ' + esc(fr(e.le.slice(0, 10))) : ''}${e.corrigePar ? ` · date corrigée par ${esc(e.corrigePar)}` : ''}</div></div></div>`).join('')}
  <div class="quick" style="margin-top:12px"><button class="btn sec" data-action="pg-debut" data-id="${esc(d.id)}">Corriger la date de début</button><button class="btn ghost" data-action="close">Fermer</button></div>`);
}
function debutForm(id) {
  const d = S.cache.portage.find(x => x.id === id); if (!d) return;
  const premier = L.evenementsPortage(d).find(e => e.type === 'debut'); if (!premier) return toast('Aucun début de service à corriger.');
  modal(`<h2>Date de début du portage</h2><p class="sub" style="margin:0 0 10px"><b>${esc(nomDe(d))}</b></p>
  <label class="chk" style="margin:0 0 8px"><input type="checkbox" id="h2" ${premier.avant ? 'checked' : ''}> Bénéficiaire avant ${L.ANNEE_REFERENCE_PORTAGE} (déjà présent à la mise en service de l'outil, date exacte inconnue)</label>
  <div class="field" id="h1z"><label for="h1">Date de début</label><input id="h1" type="date" value="${esc(premier.avant ? '' : premier.date)}"></div>
  <p class="sub">Cette date sert aux statistiques : bénéficiaires au 1er janvier, nouveaux bénéficiaires de l'année.</p>
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveH">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  const maj = () => { $('#h1z').style.display = $('#h2').checked ? 'none' : ''; }; $('#h2').onchange = maj; maj();
  $('#saveH').onclick = async () => {
    const o = { date: $('#h1').value, avant: $('#h2').checked }, err = L.erreurDebutPortage(d, o); if (err) return toast(err);
    await sauver('portage', L.avecDebutPortage(d, { ...o, par: S.user.nom, le: maintenant() }), 'Date de début enregistrée');
    closeModal();
  };
}

/* ---------- Journal de suivi (cahier §9.3, lot B second temps, v1.24.0) ---------- */
// Appels du bénéficiaire ou d'un proche, modifications de livraison, problèmes rencontrés, demandes, actions réalisées : un journal lié à un bénéficiaire du portage.
// Mêmes accès que le reste du Portage (équipe si l'accès est coché), même avertissement ✔/✘ : aucune donnée de santé.
function listeJournal() {
  const an = anneePortage(), seul = S.fJoPortage === 'asuivre', q = L.cleNom(S.rechJoPortage || '');
  const nomBenef = id => { const d = S.cache.portage.find(x => x.id === id); return d ? nomDe(d) : 'Bénéficiaire'; };
  const rows = S.cache.portageJournal.filter(j => j.date && j.date.slice(0, 4) === String(an) && (!seul || j.suiteAFaire) && (!q || L.cleNom([nomBenef(j.portageId), j.resume, j.suite].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} entrée${rows.length > 1 ? 's' : ''}</p>` + rows.map(j => ligneJournal(j, nomBenef(j.portageId))).join('')
    : '<div class="card"><div class="empty"><b>Aucune entrée</b>Notez ici les appels du bénéficiaire ou d\'un proche, les modifications de livraison, les problèmes rencontrés, les demandes et les actions réalisées.</div></div>';
}
function vueJournal() {
  const an = anneePortage();
  if (!pret('portageJournal', `an-${an}`)) return chargement('Journal de suivi');
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee('pg-an', an)}
    <input class="search" id="rech-jo" type="search" placeholder="Chercher : personne, résumé…" aria-label="Chercher dans le journal de suivi" value="${esc(S.rechJoPortage || '')}" style="flex:1;min-width:180px">
    <label class="chk" style="margin:0 0 6px"><input type="checkbox" data-change="pg-fjo" ${S.fJoPortage === 'asuivre' ? 'checked' : ''}> Suites à donner seulement</label></div>
  <div id="liste-jo">${listeJournal()}</div>`;
}
function ligneJournal(j, nomBenef) {
  const retard = j.suiteAFaire && j.suiteDate && j.suiteDate < aujourdhui();
  return `<button class="cand" data-action="pg-jo-form" data-id="${esc(j.id)}"><span class="av" aria-hidden="true">${esc(initiales(nomBenef))}</span>
    <span style="flex:1"><b>${esc(nomBenef)}</b><span class="why"><span class="pill p-bleu">${esc(fr(j.date))}</span><span class="pill p-rose">${esc(j.type || '')}</span>
    ${j.suiteAFaire ? `<span class="pill ${retard ? 'p-crit' : 'p-warn'}">Suite à donner${j.suiteDate ? ' : ' + esc(fr(j.suiteDate)) : ''}</span>` : ''}</span>
    ${j.resume ? `<span class="sub">${esc(j.resume.length > 140 ? j.resume.slice(0, 140) + '…' : j.resume)}</span>` : ''}</span></button>`;
}
function journalForm(id) {
  const j = id ? S.cache.portageJournal.find(x => x.id === id) : null;
  const docs = docsPortage().slice().sort((a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr'));
  if (!docs.length) return toast('Aucun bénéficiaire à qui rattacher une entrée du journal.');
  const types = P('portage.journalTypes'), d = j || { type: types[0], date: aujourdhui(), portageId: docs[0].id };
  modal(`<h2>${id ? 'Modifier l\'entrée' : 'Nouvelle entrée du journal de suivi'}</h2>
  <div class="field"><label for="j1">Bénéficiaire</label><select id="j1" ${id ? 'disabled' : ''}>${docs.map(x => `<option value="${esc(x.id)}" ${d.portageId === x.id ? 'selected' : ''}>${esc(nomDe(x))}</option>`).join('')}</select></div>
  <div class="two"><div class="field"><label for="j2">Type</label><select id="j2">${types.map(t => `<option ${d.type === t ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
  <div class="field"><label for="j3">Date</label><input id="j3" type="date" value="${esc(d.date || aujourdhui())}"></div></div>
  <div class="field"><label for="j4">Résumé <small class="sub">(facultatif)</small></label><textarea id="j4" rows="3" maxlength="600">${esc(d.resume || '')}</textarea></div>
  <div class="two"><div class="field"><label for="j5">Suite à donner <small class="sub">(facultatif)</small></label><input id="j5" maxlength="200" value="${esc(d.suite || '')}" placeholder="Ex. : rappeler pour confirmer le nouveau jour"></div>
  <div class="field"><label for="j6">Pour le</label><input id="j6" type="date" value="${esc(d.suiteDate || '')}"></div></div>
  <label class="chk" style="margin:0 0 8px"><input type="checkbox" id="j7" ${d.suiteFaite ? 'checked' : ''}> Suite faite (clos)</label>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveJ">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delJ" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveJ').onclick = async () => {
    const o = { portageId: id ? d.portageId : $('#j1').value, type: $('#j2').value, date: $('#j3').value };
    const err = L.erreurJournalPortage(o, types); if (err) return toast(err);
    const suite = $('#j5').value.trim(), faite = !!suite && $('#j7').checked;
    await sauver('portageJournal', { ...(id ? { id } : {}), ...o, resume: $('#j4').value.trim(), suite, suiteDate: suite ? $('#j6').value : '', suiteFaite: faite, suiteAFaire: !!suite && !faite, par: d.par || S.user.nom }, 'Entrée enregistrée');
    closeModal();
  };
  if (id && peutAdmin()) $('#delJ').onclick = () => confirmer('Supprimer cette entrée ?', `Entrée du ${fr(d.date)} du journal de suivi.`, 'Supprimer', async () => { await mettreCorbeille('portageJournal', j); await store.remove('portageJournal', id); closeModal(); toast('Entrée mise à la corbeille'); });
}

/* ---------- Échanges avec le prestataire ---------- */
const anneesProposees = () => { const a = Number(aujourdhui().slice(0, 4)); return [a + 1, a, a - 1, a - 2, a - 3].filter((x, i, t) => t.indexOf(x) === i); };
const selectAnnee = (id, courante) => `<div class="field" style="max-width:160px"><label for="${id}">Année</label><select id="${id}" data-change="pg-an">${[...new Set([...anneesProposees(), courante])].sort((a, b) => b - a).map(a => `<option ${a === courante ? 'selected' : ''}>${a}</option>`).join('')}</select></div>`;
function listeEchanges() {
  const an = anneePortage(), seul = S.fEchPortage === 'asuivre', q = L.cleNom(S.rechEchPortage || '');
  const rows = S.cache.portageEchanges.filter(e => e.date && e.date.slice(0, 4) === String(an) && (!seul || e.suiteAFaire) && (!q || L.cleNom([e.objet, e.resume, e.suite, e.prestataire].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} échange${rows.length > 1 ? 's' : ''}</p>` + rows.map(ligneEchange).join('') : '<div class="card"><div class="empty"><b>Aucun échange</b>Notez ici les appels et messages avec l\'entreprise de restauration : modification de commande, problème de livraison, réclamation, demande particulière, réponse apportée.</div></div>';
}
function vueEchanges() {
  const an = anneePortage();
  if (!pret('portageEchanges', `an-${an}`)) return chargement('Échanges avec le prestataire');
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee('pg-an', an)}
    <input class="search" id="rech-ech" type="search" placeholder="Chercher : objet, résumé…" aria-label="Chercher dans les échanges" value="${esc(S.rechEchPortage || '')}" style="flex:1;min-width:180px">
    <label class="chk" style="margin:0 0 6px"><input type="checkbox" data-change="pg-fech" ${S.fEchPortage === 'asuivre' ? 'checked' : ''}> Suites à donner seulement</label></div>
  <div id="liste-ech">${listeEchanges()}</div>`;
}
function ligneEchange(e) {
  const retard = e.suiteAFaire && e.suiteDate && e.suiteDate < aujourdhui();
  return `<button class="cand" data-action="pg-ech-form" data-id="${esc(e.id)}"><span class="av" aria-hidden="true">${esc(initiales(e.prestataire || 'Prestataire'))}</span>
    <span style="flex:1"><b>${esc(e.objet || '(sans objet)')}</b><span class="why"><span class="pill p-bleu">${esc(fr(e.date))}</span><span class="pill p-rose">${esc(L.TYPES_ECHANGE_PORTAGE[e.type] || e.type)}</span>${e.prestataire ? `<span class="pill p-bleu">${esc(e.prestataire)}</span>` : ''}
    ${e.suiteAFaire ? `<span class="pill ${retard ? 'p-crit' : 'p-warn'}">Suite à donner${e.suiteDate ? ' : ' + esc(fr(e.suiteDate)) : ''}</span>` : ''}</span>
    ${e.resume ? `<span class="sub">${esc(e.resume.length > 140 ? e.resume.slice(0, 140) + '…' : e.resume)}</span>` : ''}</span></button>`;
}
function echangeForm(id) {
  const e = id ? S.cache.portageEchanges.find(x => x.id === id) : { type: 'appel', date: aujourdhui(), prestataire: P('portage.prestataire') };
  if (!e) return;
  modal(`<h2>${id ? 'Modifier l\'échange' : 'Nouvel échange avec le prestataire'}</h2>
  <div class="two"><div class="field"><label for="x1">Type</label><select id="x1">${Object.entries(L.TYPES_ECHANGE_PORTAGE).map(([k, l]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="x2">Date</label><input id="x2" type="date" value="${esc(e.date || '')}"></div></div>
  <div class="field"><label for="x3">Prestataire</label><input id="x3" maxlength="120" value="${esc(e.prestataire || '')}" placeholder="entreprise de restauration" autocomplete="off"></div>
  <div class="field"><label for="x4">Objet</label><input id="x4" maxlength="120" value="${esc(e.objet || '')}" placeholder="Ex. : repas supplémentaires pour le banquet du 12"></div>
  <div class="field"><label for="x5">Résumé <small class="sub">(facultatif)</small></label><textarea id="x5" rows="3" maxlength="600">${esc(e.resume || '')}</textarea></div>
  <div class="two"><div class="field"><label for="x6">Suite à donner <small class="sub">(facultatif)</small></label><input id="x6" maxlength="200" value="${esc(e.suite || '')}" placeholder="Ex. : relancer pour confirmer la commande"></div>
  <div class="field"><label for="x7">Pour le</label><input id="x7" type="date" value="${esc(e.suiteDate || '')}"></div></div>
  <label class="chk" style="margin:0 0 8px"><input type="checkbox" id="x8" ${e.suiteFaite ? 'checked' : ''}> Suite faite (échange clos)</label>
  ${AVERT}${e.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(e.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveX">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id && peutAdmin() ? '<button class="btn ghost" id="delX" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveX').onclick = async () => {
    const d = { type: $('#x1').value, date: $('#x2').value, prestataire: $('#x3').value.trim(), objet: $('#x4').value.trim() }, err = L.erreurEchangePortage(d); if (err) return toast(err);
    const suite = $('#x6').value.trim(), faite = !!suite && $('#x8').checked;
    await sauver('portageEchanges', { ...(id ? { id } : {}), ...d, resume: $('#x5').value.trim(), suite, suiteDate: suite ? $('#x7').value : '', suiteFaite: faite, suiteAFaire: !!suite && !faite, statut: suite && !faite ? 'ouvert' : 'clos', par: e.par || S.user.nom }, 'Échange enregistré');
    closeModal();
  };
  if (id && peutAdmin()) $('#delX').onclick = () => confirmer('Supprimer cet échange ?', `« ${e.objet || ''} » (${fr(e.date)}) va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('portageEchanges', e); await store.remove('portageEchanges', id); closeModal(); toast('Échange mis à la corbeille'); });
}

/* ---------- Statistiques annuelles ---------- */
const tableau = (cols, lignes) => `<table class="tbl" style="width:100%"><thead><tr>${cols.map(c => `<th style="text-align:left">${esc(c)}</th>`).join('')}</tr></thead><tbody>${lignes.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
function vueStats() {
  const an = anneePortage(), T = L.tableauxPortage(docsPortage(), an), s = L.statsPortage(docsPortage(), an);
  return `<div style="margin-bottom:10px">${selectAnnee('pg-an', an)}</div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">${esc(T[0].titre)}</h2>${tableau(T[0].cols, T[0].rows)}
    <p class="sub" style="margin:8px 0 0">${an - 1 < L.ANNEE_REFERENCE_PORTAGE ? `Pas de comparaison : l'année ${an - 1} n'a pas été suivie dans l'outil. ` : ''}Un bénéficiaire « interrompu » reste bénéficiaire ; seul l'arrêt définitif le fait sortir. Les « nouveaux » sont ceux dont le service a commencé (ou recommencé après un arrêt) dans l'année ; les bénéficiaires d'avant ${L.ANNEE_REFERENCE_PORTAGE} ne sont pas comptés comme nouveaux. Ces chiffres comptent les bénéficiaires actuellement en service ; le filtre « Portage de repas » de l'écran Personnes compte, lui, toutes les fiches cochées, y compris un service arrêté.</p></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">${esc(T[1].titre)}</h2>${T[1].rows.length ? tableau(T[1].cols, T[1].rows) : '<div class="empty"><b>Aucune interruption ni sortie</b>Rien à signaler cette année.</div>'}</div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">${esc(T[2].titre)}</h2>${s.beneficiairesAnnee ? tableau(T[2].cols, T[2].rows) : '<div class="empty"><b>Aucun bénéficiaire cette année</b></div>'}</div>
  <div class="card"><h2 style="margin-top:0">${esc(T[3].titre)}</h2>${tableau(T[3].cols, T[3].rows)}<p class="sub" style="margin:8px 0 0">Livraisons par semaine (somme des jours de tous les bénéficiaires au 31 décembre) : <b>${s.livraisonsParSemaine}</b>.</p></div>`;
}
const enteteExport = an => [`Portage de repas : statistiques ${an} (AniMerci, ${P('nomService')}), édité le ${fr(aujourdhui())}.`, 'Aucune donnée de santé dans ce document. Un bénéficiaire interrompu temporairement reste compté ; seul l\'arrêt définitif le fait sortir. Ces chiffres comptent les bénéficiaires en service, à distinguer du filtre « Portage de repas » de l\'écran Personnes (toutes les fiches cochées).'];

/* ---------- Actions ---------- */
export const actions = {
  'pg-tab': el => { S.ongletPortage = el.dataset.v; render(); },
  'pg-filtre': el => { S.fPortage = el.dataset.v; render(); },
  'pg-evt': el => evtForm(el.dataset.id, el.dataset.type),
  'pg-histo': el => histoForm(el.dataset.id),
  'pg-debut': el => debutForm(el.dataset.id),
  'pg-ech-form': el => echangeForm(el.dataset.id),
  'pg-jo-form': el => journalForm(el.dataset.id),
  'pg-xlsx': async () => { if (!peutAdmin()) return; const an = anneePortage(); telecharger(`portage-${an}.xlsx`, classeur(L.tableauxPortage(docsPortage(), an), enteteExport(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'pg-pdf': () => { if (!peutAdmin()) return; const an = anneePortage(); imprimer(documentHtml(L.tableauxPortage(docsPortage(), an), enteteExport(an), `Portage de repas : statistiques ${an}`)); }
};
export const changes = {
  'pg-an': el => { S.anPortage = Number(el.value); render(); },
  'pg-fech': el => { S.fEchPortage = el.checked ? 'asuivre' : 'tous'; render(); },
  'pg-fjo': el => { S.fJoPortage = el.checked ? 'asuivre' : 'tous'; render(); }
};
