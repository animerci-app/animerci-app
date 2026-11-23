// Partenaires (lot C, v1.16.0) : journal des échanges, réunions, conventions, comptage annuel, fiche d'un partenaire.
// Le journal se remplit par l'administratrice : les partenaires n'ont pas besoin de compte. Chaque échange est rattaché à un partenaire de l'Annuaire
// (ou marqué « interne » pour les réunions de l'équipe de la résidence) et garde le nom de la personne qui l'a saisi (« saisi par »),
// pour que l'accès puisse s'ouvrir plus tard à l'équipe sans refaire les données (droits : firestore.rules).
// Aucune donnée de santé : chaque champ libre porte l'avertissement ✔ / ✘.
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { champRecherche, comboLire, itemContact, NOUVEAU } from './recherche.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, ajouterJours, initiales, go, render, toast, modal, closeModal, confirmer, telecharger, copier, sauver, mettreCorbeille, patienter, journaliser } from './ui.js';

const ONGLETS = [['echanges', 'Échanges'], ['reunions', 'Réunions'], ['conventions', 'Conventions'], ['comptage', 'Comptage annuel']];
export const anneePart = () => Number(S.anPart) || Number(aujourdhui().slice(0, 4));
export const ongletPart = () => (ONGLETS.some(o => o[0] === S.ongletPart) ? S.ongletPart : 'echanges');
const fr = d => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : d || '');
const nomInterne = () => (P('residence.nom') ? `Équipe de ${P('residence.nom')}` : 'Équipe de la résidence');
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une information d'organisation, par exemple « appel pour confirmer la salle du 12 », « convention à renvoyer signée avant le 15 ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé, et le nom d'une personne accompagnée. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const contactsTous = () => [...S.cache.contacts.map(c => L.normContact(c))].sort(L.comparerPatronyme);
const contactDe = id => contactsTous().find(c => c.id === id);
const libPart = e => (e.interne ? nomInterne() : e.partenaire || '(partenaire non précisé)');
let memoRef = null, memoMap = {};
const serviceDe = e => { if (memoRef !== S.cache.contacts) { memoRef = S.cache.contacts; memoMap = Object.fromEntries(S.cache.contacts.map(c => [c.id, c])); } return L.serviceEchange(e, memoMap, nomInterne()); };

/* ---------- Champ « Partenaire » : choix dans l'Annuaire, ou ajout d'un nouveau partenaire ---------- */
function champPartenaire(id, valeur, valeurId) {
  const tous = contactsTous(), c = valeurId ? tous.find(x => x.id === valeurId) : null, cat = P('annuaire.rubriques.activitePartenaire');
  return champRecherche({ id, label: 'Partenaire <small class="sub">(choisi dans l\'Annuaire)</small>', texte: c ? L.libelleContact(c, tous) : (valeur || ''), val: c ? c.id : '',
    aide: 'Tapez quelques lettres. Un nouveau partenaire peut être ajouté à l\'Annuaire depuis ce champ ; pour une personne précise, créez d\'abord sa fiche dans l\'Annuaire.',
    items: () => contactsTous().map(x => ({ ...itemContact(x), sous: [x.categorie, x.service, x.precision].filter(Boolean).join(' · ') })), recents: 'part',
    ajout: t => (t ? `+ Ajouter « ${t} » à l'Annuaire (catégorie « ${cat} »)` : null) });
}
// Renvoie { id, libelle, service } ou null (un message est alors affiché : l'enregistrement ne doit pas continuer).
async function lirePartenaire(id, ancien) {
  const { val, texte } = comboLire(id);
  if (!val && !texte) { toast('Choisissez le partenaire concerné : chaque échange est rattaché à un partenaire.'); return null; }
  const tous = contactsTous(), lien = c => ({ id: c.id, libelle: L.libelleContact(c, tous), service: c.service || '' });
  if (val && val !== NOUVEAU) { const c = tous.find(x => x.id === val); if (c) return lien(c); toast('Ce partenaire n\'est plus dans l\'Annuaire : choisissez-en un autre.'); return null; }
  if (!val && ancien && ancien.partenaireId && texte === ancien.partenaire) return { id: ancien.partenaireId, libelle: ancien.partenaire, service: ancien.service || '' };
  const cle = L.cleNom(texte), memes = tous.filter(x => [L.nomAffiche(x), L.nomComplet(x), L.libelleContact(x)].some(n => L.cleNom(n) === cle));
  if (memes.length === 1) return lien(memes[0]);
  if (memes.length > 1) { toast('Plusieurs fiches portent ce nom : choisissez la bonne dans la liste.'); return null; }
  const doc = { categorie: P('annuaire.rubriques.activitePartenaire'), nom: texte, prenom: '', organisme: true };
  const nid = await sauver('contacts', doc, `« ${texte} » ajouté à l'Annuaire`);
  return { id: nid, libelle: texte, service: '' };
}
const optionsServices = courant => { const l = P('partenaires.services'); return ['', ...(courant && !l.includes(courant) ? [courant] : []), ...l].map(s => `<option value="${esc(s)}" ${s === (courant || '') ? 'selected' : ''}>${s ? esc(s) : '(aucun)'}</option>`).join(''); };

/* ---------- Écran « Partenaires » ---------- */
export function partenaires() {
  const an = anneePart();
  if (!pret('contacts') || !pret('conventions') || !pret('echanges', 'an-' + an)) return chargement('Partenaires');
  if (S.partId) return pret('echanges', 'p-' + S.partId) ? fichePartenaire(S.partId) : chargement('Partenaires');
  const tab = ongletPart();
  const annees = []; for (let a = Number(aujourdhui().slice(0, 4)) + 1; a >= Number(aujourdhui().slice(0, 4)) - 6; a--) annees.push(a);
  const choixAn = tab === 'conventions' ? '' : `<div class="field" style="max-width:200px;margin:0 0 10px"><label for="p-an">Année</label><select id="p-an" data-change="part-an">${annees.map(a => `<option ${a === an ? 'selected' : ''}>${a}</option>`).join('')}</select></div>`;
  return `<div class="top"><div><h1>Partenaires</h1><p>Le suivi des relations avec les partenaires : échanges, réunions, conventions, comptage annuel. Tout peut être saisi ici par l'administratrice : les partenaires n'ont pas besoin de compte (un accès « Partenaire » peut être ouvert dans Équipe).</p></div>
    <div class="quick"><button class="btn" data-action="echange-form">+ Nouvel échange</button></div></div>
  <div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="part-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
  ${choixAn}${tab === 'echanges' ? vueEchanges(an) : tab === 'reunions' ? vueReunions(an) : tab === 'conventions' ? vueConventions() : vueComptage(an)}`;
}
const delAn = an => S.cache.echanges.filter(e => e.date && e.date.slice(0, 4) === String(an));
function ligneEchange(e, avecPart = true) {
  const sv = serviceDe(e);
  return `<button class="cand" data-action="echange-form" data-id="${esc(e.id)}"><span class="av">${esc(initiales(libPart(e)))}</span>
    <span style="flex:1"><b>${esc(e.objet || '(sans objet)')}</b><span class="why"><span class="pill p-bleu">${esc(fr(e.date))}${e.heure ? ' · ' + esc(e.heure) : ''}</span><span class="pill p-rose">${esc(L.TYPES_ECHANGE[e.type] || e.type)}</span>
    ${avecPart ? `<span class="pill p-rose">${esc(libPart(e))}</span>` : ''}${sv ? `<span class="pill p-bleu">${esc(sv)}</span>` : ''}${e.etat === 'prevu' ? '<span class="pill p-warn">Prévu</span>' : ''}${e.parUid ? '<span class="pill p-ok">Saisi par le partenaire</span>' : ''}
    ${e.suiteAFaire ? `<span class="pill ${e.suiteDate && e.suiteDate < aujourdhui() ? 'p-crit' : 'p-warn'}">Suite à donner${e.suiteDate ? ' : ' + esc(fr(e.suiteDate)) : ''}</span>` : ''}</span>
    ${e.resume ? `<span class="sub">${esc(e.resume.length > 140 ? e.resume.slice(0, 140) + '…' : e.resume)}</span>` : ''}</span></button>`;
}
function filtresEchanges() {
  const sv = S.fServ || '', ty = S.fType || '';
  return `<div class="two" style="margin-bottom:6px"><div class="field"><label for="f-sv">Service ou structure</label><select id="f-sv" data-change="part-fserv"><option value="">Tous</option>${P('partenaires.services').concat(nomInterne()).map(s => `<option ${s === sv ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    <div class="field"><label for="f-ty">Type</label><select id="f-ty" data-change="part-ftype"><option value="">Tous</option>${Object.entries(L.TYPES_ECHANGE).map(([k, l]) => `<option value="${k}" ${k === ty ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
    <input class="search" id="rech-part" type="search" placeholder="Chercher : partenaire, objet…" aria-label="Chercher dans les échanges" value="${esc(S.rechPart || '')}">`;
}
function listeEchanges(an) {
  const q = L.cleNom(S.rechPart || ''), sv = S.fServ || '', ty = S.fType || '';
  const rows = delAn(an).filter(e => (!ty || e.type === ty) && (!sv || serviceDe(e) === sv) && (!q || L.cleNom([libPart(e), e.objet, e.resume].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || '') || String(b.heure || '').localeCompare(String(a.heure || '')));
  return rows.length ? `<p class="sub">${rows.length} échange${rows.length > 1 ? 's' : ''}</p>` + rows.map(e => ligneEchange(e)).join('') : '<div class="card"><div class="empty"><b>Aucun échange</b>Ajoutez-en un avec « + Nouvel échange » : appel, courriel, réunion, contact physique, invitation ou relance.</div></div>';
}
function vueEchanges(an) { return `${filtresEchanges()}<div id="liste-part">${listeEchanges(an)}</div>`; }
export function apresPartenaires() {
  const r = $('#rech-part'); if (r) r.oninput = () => { S.rechPart = r.value; $('#liste-part').innerHTML = listeEchanges(anneePart()); };
}
function vueReunions(an) {
  const re = delAn(an).filter(e => e.type === 'reunion'), prevues = re.filter(e => e.etat === 'prevu').sort((a, b) => a.date.localeCompare(b.date)), tenues = re.filter(e => e.etat !== 'prevu').sort((a, b) => b.date.localeCompare(a.date));
  return `<div class="card" style="margin-bottom:14px"><p class="sub" style="margin:0 0 8px">Les réunions avec les partenaires et la réunion mensuelle de l'équipe de la résidence (échange « interne »). Une réunion « prévue » ne compte dans les statistiques qu'une fois confirmée comme tenue.</p>
    <div class="quick"><button class="btn" data-action="echange-form" data-type="reunion">+ Nouvelle réunion</button><button class="btn sec" data-action="serie-form">Planifier la série mensuelle</button></div></div>
  <h2>À tenir ou à confirmer (${prevues.length})</h2>${prevues.length ? prevues.map(e => ligneEchange(e)).join('') : '<div class="card"><div class="empty">Aucune réunion prévue pour cette année.</div></div>'}
  <h2>Tenues (${tenues.length})</h2>${tenues.length ? tenues.map(e => ligneEchange(e)).join('') : '<div class="card"><div class="empty">Aucune réunion tenue enregistrée pour cette année.</div></div>'}`;
}
function vueConventions() {
  const auj = aujourdhui(), rows = [...S.cache.conventions].sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999') || String(a.partenaire).localeCompare(String(b.partenaire), 'fr'));
  return `<div class="card" style="margin-bottom:14px"><p class="sub" style="margin:0 0 8px">Les conventions avec les partenaires : état, date de signature, échéance. L'outil ne garde pas les documents eux-mêmes : notez « où se trouve le document » (dossier, classeur…). Une alerte apparaît à l'accueil ${P('partenaires.alerteJours')} jours avant l'échéance.</p>
    <div class="quick"><button class="btn" data-action="convention-form">+ Nouvelle convention</button></div></div>` +
    (rows.length ? rows.map(c => `<button class="cand" data-action="convention-form" data-id="${esc(c.id)}"><span class="av">${esc(initiales(c.partenaire || '?'))}</span><span style="flex:1"><b>${esc(c.intitule || '(sans intitulé)')}</b>
      <span class="why"><span class="pill p-rose">${esc(c.partenaire || '')}</span><span class="pill ${c.statut === 'signee' ? 'p-ok' : c.statut === 'terminee' ? 'p-bleu' : 'p-warn'}">${esc(L.STATUTS_CONVENTION[c.statut] || c.statut || '')}</span>
      ${c.echeance ? `<span class="pill ${c.statut !== 'terminee' && c.echeance < auj ? 'p-crit' : 'p-bleu'}">Échéance ${esc(fr(c.echeance))}</span>` : ''}</span>${c.emplacement ? `<span class="sub">Document : ${esc(c.emplacement)}</span>` : ''}</span></button>`).join('')
    : '<div class="card"><div class="empty"><b>Aucune convention</b>Ajoutez-en une avec le bouton ci-dessus.</div></div>');
}

/* ---------- Comptage annuel (15.4) ---------- */
function donneesComptage(an) {
  return L.comptageEchanges(S.cache.echanges, S.cache.contacts, { an, service: S.cService || '', partenaireId: S.cPart || '', interne: nomInterne() });
}
function vueComptage(an) {
  const c = donneesComptage(an), types = Object.entries(L.TYPES_ECHANGE), sv = S.cService || '';
  const partenairesAn = [...new Map(delAn(an).filter(e => !e.interne && e.partenaireId).map(e => [e.partenaireId, e.partenaire])).entries()].sort((a, b) => String(a[1]).localeCompare(String(b[1]), 'fr'));
  const th = 'text-align:left;border-bottom:2px solid #000;padding:6px', td = 'padding:5px 6px;border-bottom:1px solid #ccc';
  const tab = (cols, lignes) => `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${cols.map(x => `<th style="${th}">${esc(x)}</th>`).join('')}</tr></thead><tbody>${lignes.map(r => `<tr>${r.map(v => `<td style="${td}">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  return `<div class="two" style="margin-bottom:6px"><div class="field"><label for="c-sv">Service ou structure</label><select id="c-sv" data-change="part-cserv"><option value="">Tous</option>${P('partenaires.services').concat(nomInterne()).map(s => `<option ${s === sv ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></div>
    <div class="field"><label for="c-pa">Partenaire</label><select id="c-pa" data-change="part-cpart"><option value="">Tous</option>${partenairesAn.map(([i, n]) => `<option value="${esc(i)}" ${i === S.cPart ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div></div>
  <div class="grid tiles"><div class="tile" style="cursor:default"><span class="n">${c.total}</span><span class="l">Échanges en ${an}</span></div><div class="tile" style="cursor:default"><span class="n">${c.partenairesDistincts}</span><span class="l">Partenaires distincts</span></div></div>
  <p class="sub">Seuls les échanges tenus sont comptés (les réunions « prévues » ne le sont pas). Un partenaire contacté dix fois compte pour dix échanges et un seul partenaire distinct.</p>
  <div class="card" style="margin:12px 0"><h2 style="margin-top:0">Par type d'échange</h2>${tab(['Type', 'Nombre'], types.map(([k, l]) => [l, c.parType[k]]).concat([['Total', c.total]]))}</div>
  <div class="card" style="margin-bottom:12px"><h2 style="margin-top:0">Par mois</h2>${tab(['Mois', ...types.map(t => t[1]), 'Total'], c.parMois.map((m, i) => [['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'][i], ...types.map(([k]) => m[k]), types.reduce((n, [k]) => n + m[k], 0)]))}</div>
  <div class="card" style="margin-bottom:12px"><h2 style="margin-top:0">Par service ou structure</h2>${c.parService.length ? tab(['Service', ...types.map(t => t[1]), 'Total'], c.parService.map(s => [s.nom, ...types.map(([k]) => s[k]), s.n])) : '<div class="empty">Aucun échange.</div>'}</div>
  <div class="card" style="margin-bottom:12px"><h2 style="margin-top:0">Par partenaire</h2>${c.parPartenaire.length ? tab(['Partenaire', 'Service', ...types.map(t => t[1]), 'Total'], c.parPartenaire.map(s => [s.nom, s.service || '', ...types.map(([k]) => s[k]), s.n])) : '<div class="empty">Aucun échange.</div>'}</div>
  <div class="quick"><button class="btn" data-action="comptage-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="comptage-pdf">PDF / Imprimer</button></div>`;
}
function tableauxComptage(an) {
  const c = donneesComptage(an), types = Object.entries(L.TYPES_ECHANGE), mois = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'], colsT = types.map(t => t[1]);
  return [
    { nom: 'Par type', titre: `Échanges ${an} par type`, cols: ['Type', 'Nombre'], rows: types.map(([k, l]) => [l, c.parType[k]]).concat([['Total', c.total], ['Partenaires distincts', c.partenairesDistincts]]) },
    { nom: 'Par mois', titre: `Échanges ${an} par mois`, cols: ['Mois', ...colsT, 'Total'], rows: c.parMois.map((m, i) => [mois[i], ...types.map(([k]) => m[k]), types.reduce((n, [k]) => n + m[k], 0)]) },
    { nom: 'Par service', titre: `Échanges ${an} par service ou structure`, cols: ['Service', ...colsT, 'Total'], rows: c.parService.map(s => [s.nom, ...types.map(([k]) => s[k]), s.n]) },
    { nom: 'Par partenaire', titre: `Échanges ${an} par partenaire`, cols: ['Partenaire', 'Service', ...colsT, 'Total'], rows: c.parPartenaire.map(s => [s.nom, s.service || '', ...types.map(([k]) => s[k]), s.n]) },
    { nom: 'Détail', titre: `Liste des échanges ${an}`, cols: ['Date', 'Type', 'Partenaire', 'Service', 'Objet', 'Résumé', 'Suite à donner', 'Saisi par'],
      rows: c.lignes.map(e => [fr(e.date), L.TYPES_ECHANGE[e.type] || e.type, e._part, e._service, e.objet, e.resume, e.suite, e.par]) }
  ];
}
function enteteComptage(an) {
  return [`Comptage des échanges avec les partenaires, année ${an} (AniMerci, ${P('nomService')}).`, `Filtres : ${S.cService ? 'service « ' + S.cService + ' »' : 'tous les services'}${S.cPart ? ', un partenaire' : ''}.`,
    'Seuls les échanges tenus sont comptés. Aucune donnée de santé ni nom de personne accompagnée dans ce document.'];
}

/* ---------- Espace d'un compte « Partenaire » (accès ouvert par l'administratrice, par exemple pour un essai) ---------- */
// Le compte voit et saisit uniquement ses propres échanges avec le service ; il ne voit ni l'Annuaire, ni les personnes, ni les autres échanges.
export function espacePartenaire() {
  if (!pret('echanges', 'mes')) return chargement('Mes échanges');
  const mes = [...S.cache.echanges].filter(e => e.parUid === S.user.uid).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return `<div class="top"><div><h1>Mes échanges</h1><p>${esc(S.user.partenaireNom || S.user.nom)} : les échanges que vous avez avec ${esc(P('nomService'))}. Notez ici une prise de contact, une proposition ou une demande d'organisation.</p></div>
    <div class="quick"><button class="btn" data-action="mespart-form">+ Nouvel échange</button></div></div>
  <div class="note" style="margin-bottom:12px"><b>✔ À écrire</b> : une information d'organisation (date, salle, projet, demande). <b>✘ À ne pas écrire</b> : toute information de santé, et le nom d'une personne accompagnée.</div>
  ${mes.length ? mes.map(e => `<button class="cand" data-action="mespart-form" data-id="${esc(e.id)}"><span style="flex:1"><b>${esc(e.objet || '(sans objet)')}</b><span class="why"><span class="pill p-bleu">${esc(fr(e.date))}</span><span class="pill p-rose">${esc(L.TYPES_ECHANGE[e.type] || e.type)}</span>${e.etat === 'prevu' ? '<span class="pill p-warn">Prévu</span>' : ''}</span>${e.resume ? `<span class="sub">${esc(e.resume.length > 140 ? e.resume.slice(0, 140) + '…' : e.resume)}</span>` : ''}</span></button>`).join('')
  : '<div class="card"><div class="empty"><b>Aucun échange</b>Ajoutez le premier avec « + Nouvel échange ».</div></div>'}`;
}
function echangePartForm(id) {
  const e = id ? S.cache.echanges.find(x => x.id === id && x.parUid === S.user.uid) : { type: 'courriel', date: aujourdhui(), etat: 'realise' };
  if (id && !e) return;
  modal(`<h2>${id ? 'Modifier l\'échange' : 'Nouvel échange'}</h2>
  <div class="two"><div class="field"><label for="m1">Type</label><select id="m1">${Object.entries(L.TYPES_ECHANGE).filter(([k]) => k !== 'reunion').map(([k, l]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="m2">Date</label><input id="m2" type="date" value="${esc(e.date || '')}"></div></div>
  <div class="field"><label for="m3">Objet</label><input id="m3" maxlength="120" value="${esc(e.objet || '')}" placeholder="Ex. : proposition d'un atelier en mars"></div>
  <div class="field"><label for="m4">Résumé <small class="sub">(facultatif)</small></label><textarea id="m4" rows="3" maxlength="600">${esc(e.resume || '')}</textarea></div>
  ${AVERT}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveM">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#saveM').onclick = async () => {
    const type = $('#m1').value, date = $('#m2').value, objet = $('#m3').value.trim(), err = L.erreurEchange({ date, objet, type, interne: false, partenaire: 'x' }); if (err) return toast(err);
    await sauver('echanges', { ...(id ? { id } : {}), type: type, date, heure: '', etat: date > aujourdhui() ? 'prevu' : 'realise', interne: false, partenaireId: S.user.partenaireId, partenaire: S.user.partenaireNom || S.user.nom, service: '', objet, resume: $('#m4').value.trim(),
      participants: '', odj: '', decisions: '', suite: '', suiteDate: '', suiteFaite: false, suiteAFaire: false, parUid: S.user.uid, par: S.user.nom }, 'Échange enregistré');
    closeModal();
  };
}

/* ---------- Fiche d'un partenaire ---------- */
function fichePartenaire(id) {
  const c = contactDe(id); if (!c) { S.partId = null; return partenaires(); }
  const ech = S.cache.echanges.filter(e => e.partenaireId === id).sort((a, b) => (b.date || '').localeCompare(a.date || '')), conv = S.cache.conventions.filter(x => x.partenaireId === id);
  const acts = S.cache.activites.filter(a => a.partenaireId === id || a.intervId === id || a.benevoleId === id);
  const ligne = (l, v) => (v ? `<p style="margin:3px 0"><b>${l} :</b> ${esc(v)}</p>` : '');
  return `<div class="top"><div><button class="btn ghost" data-action="part-retour">← Tous les partenaires</button><h1 style="margin-top:8px">${esc(L.libelleContact(c))}</h1><p>${esc(c.categorie || '')}${c.service ? ' · ' + esc(c.service) : ''}</p></div>
    <div class="quick"><button class="btn" data-action="echange-form" data-part="${esc(id)}">+ Échange</button><button class="btn sec" data-action="convention-form" data-part="${esc(id)}">+ Convention</button><button class="btn ghost" data-action="contact-form" data-id="${esc(id)}">Modifier la fiche</button></div></div>
  <div class="card" style="margin-bottom:14px">${ligne('Type de partenariat', c.partenariat)}${ligne('Référent', c.referent)}${ligne('Téléphone', c.tel)}${ligne('E-mail', c.email)}${ligne('Projets communs', c.projets)}${ligne('Suite à donner', c.suite)}${ligne('Remarque', c.note)}
    ${!(c.partenariat || c.referent || c.tel || c.email || c.projets || c.suite || c.note) ? '<p class="sub" style="margin:0">Fiche à compléter : « Modifier la fiche ».</p>' : ''}</div>
  <h2>Activités et événements liés (${acts.length})</h2>${acts.length ? acts.map(a => `<button class="row" style="width:100%;background:none;border:0;border-top:1px solid var(--ligne);text-align:left" data-action="open-act" data-id="${esc(a.id)}"><div class="grow"><b>${esc(a.nom)}</b><small>${esc([a.jour, a.date && fr(a.date), a.lieu].filter(Boolean).join(' · '))}</small></div></button>`).join('') : '<div class="card"><div class="empty">Aucune activité liée à ce partenaire.</div></div>'}
  <h2>Conventions (${conv.length})</h2>${conv.length ? conv.map(x => `<button class="cand" data-action="convention-form" data-id="${esc(x.id)}"><span style="flex:1"><b>${esc(x.intitule)}</b><span class="why"><span class="pill p-warn">${esc(L.STATUTS_CONVENTION[x.statut] || '')}</span>${x.echeance ? `<span class="pill p-bleu">Échéance ${esc(fr(x.echeance))}</span>` : ''}</span></span></button>`).join('') : '<div class="card"><div class="empty">Aucune convention.</div></div>'}
  <h2>Historique des échanges (${ech.length})</h2>${ech.length ? ech.map(e => ligneEchange(e, false)).join('') : '<div class="card"><div class="empty">Aucun échange enregistré avec ce partenaire.</div></div>'}`;
}

/* ---------- Formulaire d'un échange ---------- */
function echangeForm(id, pre = {}) {
  const e = id ? S.cache.echanges.find(x => x.id === id) : { type: pre.type || 'appel-sortant', date: aujourdhui(), etat: 'realise', partenaireId: pre.partenaireId || '', partenaire: '' };
  if (id && !e) return;
  const c0 = !id && e.partenaireId ? contactDe(e.partenaireId) : null;
  const tous = contactsTous();
  modal(`<h2>${id ? 'Modifier l\'échange' : 'Nouvel échange'}</h2>
  <div class="two"><div class="field"><label for="e1">Type</label><select id="e1">${Object.entries(L.TYPES_ECHANGE).map(([k, l]) => `<option value="${k}" ${e.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="e2">Date</label><input id="e2" type="date" value="${esc(e.date || '')}"></div></div>
  <div class="two"><div class="field"><label for="e3">Heure <small class="sub">(facultatif)</small></label><input id="e3" type="time" value="${esc(e.heure || '')}"></div>
  <div class="field"><label class="chk" style="margin-top:26px"><input type="checkbox" id="e4" ${e.etat === 'prevu' ? 'checked' : ''}> Prévu (n'a pas encore eu lieu)</label></div></div>
  <div id="e6z"><label class="chk" style="margin:0 0 8px"><input type="checkbox" id="e6" ${e.interne ? 'checked' : ''}> Réunion de l'équipe de la résidence (interne : pas de partenaire)</label></div>
  <div id="e5z">${champPartenaire('e5', c0 ? L.libelleContact(c0, tous) : e.partenaire, c0 ? c0.id : e.partenaireId)}</div>
  <div class="field"><label for="e7">Objet</label><input id="e7" maxlength="120" value="${esc(e.objet || '')}" placeholder="Ex. : confirmer la salle pour le banquet"></div>
  <div class="field"><label for="e8">Résumé <small class="sub">(facultatif)</small></label><textarea id="e8" rows="3" maxlength="600">${esc(e.resume || '')}</textarea></div>
  <div id="e9z"><div class="field"><label for="e9">Participants <small class="sub">(réunion : noms ou fonctions, facultatif)</small></label><input id="e9" maxlength="300" value="${esc(e.participants || '')}"></div>
  <div class="field"><label for="e10">Ordre du jour <small class="sub">(facultatif)</small></label><textarea id="e10" rows="2" maxlength="600">${esc(e.odj || '')}</textarea></div>
  <div class="field"><label for="e11">Décisions <small class="sub">(facultatif)</small></label><textarea id="e11" rows="2" maxlength="600">${esc(e.decisions || '')}</textarea></div></div>
  <div class="two"><div class="field"><label for="e12">Suite à donner <small class="sub">(facultatif)</small></label><input id="e12" maxlength="200" value="${esc(e.suite || '')}" placeholder="Ex. : relancer pour la convention"></div>
  <div class="field"><label for="e13">Pour le</label><input id="e13" type="date" value="${esc(e.suiteDate || '')}"></div></div>
  <label class="chk" style="margin:0 0 8px"><input type="checkbox" id="e14" ${e.suiteFaite ? 'checked' : ''}> Suite faite</label>
  ${AVERT}
  ${e.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(e.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveE">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>
  <button class="btn sec" id="tacheE">Créer une tâche</button><button class="btn sec" id="msgE">Message à copier</button>${id ? '<button class="btn ghost" id="delE" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  const maj = () => { const r = $('#e1').value === 'reunion', i = r && $('#e6').checked; $('#e6z').style.display = r ? '' : 'none'; $('#e9z').style.display = r ? '' : 'none'; $('#e5z').style.display = i ? 'none' : ''; };
  $('#e1').onchange = maj; $('#e6').onchange = maj; maj();
  const lire = async () => {
    const type = $('#e1').value, date = $('#e2').value, interne = type === 'reunion' && $('#e6').checked, objet = $('#e7').value.trim();
    let part = null; if (!interne) { if (!comboLire('e5').val && !comboLire('e5').texte) { toast('Choisissez le partenaire concerné : chaque échange est rattaché à un partenaire.'); return null; } }
    const err = L.erreurEchange({ date, objet, type, interne, partenaire: interne ? '' : 'x' }); if (err) { toast(err); return null; }
    if (!interne) { part = await lirePartenaire('e5', e); if (!part) return null; }
    const suite = $('#e12').value.trim(), faite = !!suite && $('#e14').checked, reunion = type === 'reunion';
    return { ...(id ? { id } : {}), type, date, heure: $('#e3').value, etat: $('#e4').checked ? 'prevu' : 'realise', interne, partenaireId: interne ? '' : part.id, partenaire: interne ? '' : part.libelle, service: interne ? '' : part.service,
      objet, resume: $('#e8').value.trim(), participants: reunion ? $('#e9').value.trim() : '', odj: reunion ? $('#e10').value.trim() : '', decisions: reunion ? $('#e11').value.trim() : '',
      suite, suiteDate: suite ? $('#e13').value : '', suiteFaite: faite, suiteAFaire: !!suite && !faite, par: e.par || (S.user && S.user.nom) || '' };
  };
  $('#saveE').onclick = async () => { const d = await lire(); if (!d) return; await sauver('echanges', d, 'Échange enregistré'); closeModal(); };
  $('#tacheE').onclick = async () => {
    const d = await lire(); if (!d) return; if (!d.suite) return toast('Notez d\'abord la « suite à donner » : elle devient l\'intitulé de la tâche.');
    await sauver('echanges', d); await sauver('taches', { titre: `${d.interne ? nomInterne() : d.partenaire} : ${d.suite}`.slice(0, 150), cat: 'Partenaires', echeance: d.suiteDate || ajouterJours(aujourdhui(), 7), done: false, statut: 'a-faire', priorite: 'normale', responsable: '', responsableId: '' }, 'Tâche créée');
    closeModal();
  };
  $('#msgE').onclick = () => {
    const type = $('#e1').value, objet = $('#e7').value.trim(), cm = comboLire('e5'), c = cm.val ? contactDe(cm.val) : null;
    copier(L.texteMessagePartenaire({ type: type === 'invitation' ? 'invitation' : 'relance', referent: c && c.referent, objet, quand: $('#e2').value ? fr($('#e2').value) : '', signature: P('nomService') }), 'Message copié : à coller dans votre messagerie');
  };
  if (id) $('#delE').onclick = () => confirmer('Supprimer cet échange ?', `« ${e.objet || ''} » (${fr(e.date)}) va à la corbeille ; il ne sera plus compté dans les statistiques.`, 'Supprimer', async () => { await mettreCorbeille('echanges', e); await store.remove('echanges', id); toast('Échange mis à la corbeille'); });
}

/* ---------- Série mensuelle (réunion de l'équipe de la résidence) ---------- */
function serieForm() {
  const nom = P('partenaires.reunionMensuelle');
  modal(`<h2>Planifier la série mensuelle</h2><p class="sub">Crée une réunion « interne » par mois, marquée « prévue » : « ${esc(nom)} ». Chaque réunion se modifie ensuite séparément (date, heure, ordre du jour).</p>
  <div class="two"><div class="field"><label for="s1">Date de la première réunion</label><input id="s1" type="date" value="${esc(aujourdhui())}"></div>
  <div class="field"><label for="s2">Nombre de mois</label><input id="s2" type="number" min="1" max="24" value="12"></div></div>
  <div class="field"><label for="s3">Heure <small class="sub">(facultatif)</small></label><input id="s3" type="time"></div>
  <p class="sub">Même jour du mois chaque mois (le 31 devient le dernier jour des mois plus courts). Les dates déjà occupées par une réunion interne ne sont pas recréées.</p>
  <div class="quick" style="margin-top:14px"><button class="btn" id="saveS">Créer la série</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#saveS').onclick = async () => {
    const d = $('#s1').value, n = Number($('#s2').value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return toast('Indiquez la date de la première réunion.');
    if (!Number.isInteger(n) || n < 1 || n > 24) return toast('Le nombre de mois doit être compris entre 1 et 24.');
    const dates = L.datesSerieMensuelle(d, n), existantes = new Set(S.cache.echanges.filter(e => e.interne && e.type === 'reunion').map(e => e.date)), serie = L.uid();
    let crees = 0;
    await patienter((async () => {
      for (const date of dates) {
        if (existantes.has(date)) continue;
        await store.save('echanges', { type: 'reunion', date, heure: $('#s3').value, etat: 'prevu', interne: true, partenaireId: '', partenaire: '', service: '', objet: nom, resume: '', participants: '', odj: '', decisions: '', suite: '', suiteDate: '', suiteFaite: false, suiteAFaire: false, serie, par: S.user.nom });
        crees++;
      }
    })());
    journaliser('Créé', 'echanges', { objet: `${crees} réunions mensuelles`, partenaire: nomInterne(), date: d });
    closeModal(); toast(`${crees} réunion${crees > 1 ? 's' : ''} planifiée${crees > 1 ? 's' : ''}${crees < dates.length ? ` (${dates.length - crees} déjà présente${dates.length - crees > 1 ? 's' : ''})` : ''}`);
  };
}

/* ---------- Formulaire d'une convention ---------- */
function conventionForm(id, pre = {}) {
  const k = id ? S.cache.conventions.find(x => x.id === id) : { statut: 'a-preparer', partenaireId: pre.partenaireId || '', partenaire: '' };
  if (id && !k) return;
  const tous = contactsTous(), c0 = !id && k.partenaireId ? contactDe(k.partenaireId) : null;
  modal(`<h2>${id ? 'Modifier la convention' : 'Nouvelle convention'}</h2>
  ${champPartenaire('v1', c0 ? L.libelleContact(c0, tous) : k.partenaire, c0 ? c0.id : k.partenaireId)}
  <div class="field"><label for="v2">Intitulé</label><input id="v2" maxlength="150" value="${esc(k.intitule || '')}" placeholder="Ex. : convention de partenariat 2027"></div>
  <div class="two"><div class="field"><label for="v3">État</label><select id="v3">${Object.entries(L.STATUTS_CONVENTION).map(([x, l]) => `<option value="${x}" ${k.statut === x ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="v4">Date de signature</label><input id="v4" type="date" value="${esc(k.signature || '')}"></div></div>
  <div class="field"><label for="v5">Échéance ou renouvellement</label><input id="v5" type="date" value="${esc(k.echeance || '')}"></div>
  <div class="field"><label for="v6">Où se trouve le document ? <small class="sub">(facultatif)</small></label><input id="v6" maxlength="200" value="${esc(k.emplacement || '')}" placeholder="Ex. : classeur « Conventions », bureau"></div>
  <div class="field"><label for="v7">Remarque <small class="sub">(facultatif)</small></label><input id="v7" maxlength="300" value="${esc(k.note || '')}"></div>
  ${AVERT}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveV">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id ? '<button class="btn ghost" id="delV" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveV').onclick = async () => {
    const intitule = $('#v2').value.trim(); if (!intitule) return toast('Donnez un intitulé à la convention.');
    const part = await lirePartenaire('v1', k); if (!part) return;
    await sauver('conventions', { ...(id ? { id } : {}), partenaireId: part.id, partenaire: part.libelle, intitule, statut: $('#v3').value, signature: $('#v4').value, echeance: $('#v5').value, emplacement: $('#v6').value.trim(), note: $('#v7').value.trim(), par: k.par || (S.user && S.user.nom) || '' }, 'Convention enregistrée');
    closeModal();
  };
  if (id) $('#delV').onclick = () => confirmer('Supprimer cette convention ?', `« ${k.intitule || ''} » va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('conventions', k); await store.remove('conventions', id); toast('Convention mise à la corbeille'); });
}

/* ---------- Actions ---------- */
export const actions = {
  'part-tab': el => { S.ongletPart = el.dataset.v; render(); },
  'part-retour': () => { S.partId = null; render(); },
  'echange-form': el => echangeForm(el.dataset.id, { type: el.dataset.type, partenaireId: el.dataset.part }),
  'serie-form': () => serieForm(),
  'mespart-form': el => echangePartForm(el.dataset.id),
  'convention-form': el => conventionForm(el.dataset.id, { partenaireId: el.dataset.part }),
  'part-fiche': el => { closeModal(); go('partenaires', { partId: el.dataset.id }); },
  'comptage-xlsx': () => { const an = anneePart(); telecharger(`comptage-partenaires-${an}.xlsx`, classeur(tableauxComptage(an), enteteComptage(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'comptage-pdf': () => { const an = anneePart(); imprimer(documentHtml(tableauxComptage(an), enteteComptage(an), `Échanges avec les partenaires — ${an}`)); }
};
export const changes = {
  'part-an': el => { S.anPart = Number(el.value); S.cPart = ''; render(); },
  'part-fserv': el => { S.fServ = el.value; render(); },
  'part-ftype': el => { S.fType = el.value; render(); },
  'part-cserv': el => { S.cService = el.value; render(); },
  'part-cpart': el => { S.cPart = el.value; render(); }
};
