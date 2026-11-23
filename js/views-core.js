// Écrans : accueil, séniors, tâches, planning, bilans.
import * as L from './logic.js';
import { rappelSauvegarde, alerteLectures } from './backup.js';
import { P, moduleActif } from './parametres.js';
import * as pg from './portage.js';
import { champListe, lireChamp } from './annuaire.js';
import { itemPersonne } from './recherche.js';
import { fusionForm } from './fusion.js';
import * as adhs from './adhesions.js';
import { store } from './store.js';
import { S, pret, chargement, $, esc, aujourdhui, ajouterJours, initiales, dateLongue, JOURS, MOIS, go, render, toast, modal, closeModal, confirmer, telecharger, copier, sauver, mettreCorbeille, seniorDe, actDe, validees } from './ui.js';

const CATS_TACHE = ['Événements', 'Communication', 'Régie', 'Bénévoles', 'Adhésions', 'Jeunes', 'Partenaires', 'Administratif', 'Autre'];

/* ============ ACCUEIL ============ */
// Alertes calculées sur les données déjà chargées (aucune lecture en plus) : tâches en retard ou prioritaires, places en attente, appels à valider
function alertesCard() {
  const al = L.alertesAccueil({ activites: S.cache.activites, inscriptions: S.cache.inscriptions, seances: S.cache.seances, taches: S.cache.taches, auj: aujourdhui(), echanges: S.cache.echanges, conventions: S.cache.conventions, fiches: S.compteursFiches || null, portages: moduleActif('portage') ? S.cache.portage : [], echangesPortage: moduleActif('portage') ? S.cache.portageEchanges : [], joursConv: P('partenaires.alerteJours'), materiel: S.cache.materiel, emprunts: S.cache.emprunts.filter(e => !e.rendu), joursPeremption: P('materiel.alertePeremptionJours'), accueils: moduleActif('accueils') ? S.cache.accueils : [], benevoles: S.cache.contacts, categorieBenevole: P('annuaire.rubriques.activiteBenevole'), seuilHeures: P('accueils.seuilRetardHeures') });
  const lib = { crit: ['p-crit', 'Urgent'], warn: ['p-warn', 'À regarder'], info: ['p-bleu', 'À faire'] };
  return `<div class="card alertes" style="margin-top:16px"><h2>Alertes</h2>${al.length ? al.map(a => `<button class="row" style="width:100%;background:none;border:0;border-top:1px solid var(--ligne);text-align:left" data-action="${a.act ? 'open-act' : 'nav'}" ${a.act ? `data-id="${a.act}"` : `data-v="${a.vue}"${a.tab ? ` data-tab="${a.tab}"` : ''}`}>
    <span class="pill ${lib[a.niveau][0]}">${lib[a.niveau][1]}</span><div class="grow">${esc(a.texte)}</div></button>`).join('') : '<div class="empty"><b>Aucune alerte</b>Tout est à jour.</div>'}</div>`;
}
export function accueil() {
  const auj = aujourdhui(), sem = ajouterJours(auj, 7);
  const attente = S.cache.inscriptions.filter(i => i.statut === 'attente').length;
  const aValider = S.cache.seances.filter(s => !s.valide).length;
  const retard = S.cache.taches.filter(t => !t.done && t.echeance && t.echeance < auj);
  const prochaines = S.cache.activites.filter(a => a.date && a.date >= auj).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const taches = S.cache.taches.filter(t => !t.done).sort((a, b) => (a.echeance || '9').localeCompare(b.echeance || '9')).slice(0, 5);
  const sansFiche = S.cache.activites.filter(a => a.type === 'sortie' && a.date >= auj).reduce((n, a) => {
    const ins = S.cache.inscriptions.filter(i => i.activiteId === a.id && ['inscrit', 'invite'].includes(i.statut));
    return n + ins.filter(i => { const f = S.cache.fiches.find(x => x.id === ficheId(a.id, i.seniorId)); return !(f && f.contact && f.tel); }).length;
  }, 0);
  const h = new Date().getHours();
  return `
  <div class="top"><div><h1>${h < 18 ? 'Bonjour' : 'Bonsoir'} ${esc(S.user.nom.split(' ')[0])}</h1><p>${esc(dateLongue(auj))}. Voici l'essentiel.</p></div></div>
  ${alerteLectures()}${rappelSauvegarde()}
  <div class="grid tiles">
    <button class="tile ${attente ? 'alert' : ''}" data-action="nav" data-v="activites"><span class="n">${attente}</span><span class="l">Personnes en attente d'une place</span></button>
    <button class="tile" data-action="nav" data-v="activites"><span class="n">${S.cache.activites.filter(a => a.date >= auj && a.date <= sem).length}</span><span class="l">Activités dans les 7 jours</span></button>
    <button class="tile ${aValider ? 'alert' : ''}" data-action="nav" data-v="activites"><span class="n">${aValider}</span><span class="l">Appels à valider</span></button>
    <button class="tile ${retard.length ? 'alert' : ''}" data-action="nav" data-v="taches"><span class="n">${retard.length}</span><span class="l">Tâches en retard</span></button>
  </div>
  ${alertesCard()}
  <div class="card" style="margin-top:16px"><h2>Que voulez-vous faire ?</h2><div class="quick">
    <button class="btn" data-action="senior-form">+ Nouvelle personne</button>
    <button class="btn blue" data-action="nav" data-v="activites">Activités et appel</button>
    <button class="btn sec" data-action="nav" data-v="planning">Planning et affiche</button>
    <button class="btn sec" data-action="nav" data-v="bilans">Bilans</button></div></div>
  <div class="cols">
    <div class="card"><h2>À venir</h2>${prochaines.length ? prochaines.map(a => `
      <button class="row" style="width:100%;background:none;border:0;border-top:1px solid var(--ligne);text-align:left" data-action="open-act" data-id="${a.id}">
        <div class="date"><span>${JOURS[new Date(a.date + 'T12:00:00').getDay()]}</span><em>${a.date.slice(8)}</em></div>
        <div class="grow"><b>${esc(a.nom)}</b><small>${esc(a.lieu || '')}</small></div></button>`).join('') : '<div class="empty"><b>Rien de prévu</b>Ajoutez une activité avec une date.</div>'}</div>
    <div class="card"><h2>À ne pas oublier</h2>
      ${sansFiche ? `<div class="row"><span class="pill p-bleu">Sortie</span><div class="grow"><b>${sansFiche} fiche${sansFiche > 1 ? 's' : ''} de sortie à compléter</b></div></div>` : ''}
      ${taches.length ? taches.map(t => `<div class="row"><span class="pill ${t.echeance && t.echeance < auj ? 'p-crit' : 'p-rose'}">${t.echeance ? L.fmtDate(t.echeance).slice(0, 5) : '—'}</span><div class="grow"><b>${esc(t.titre)}</b><small>${esc(t.cat || '')}</small></div></div>`).join('') : '<div class="empty"><b>Tout est à jour</b></div>'}
    </div>
  </div>`;
}
export const ficheId = (actId, seniorId) => `${actId}_${seniorId}`;

/* ============ SÉNIORS ============ */
function listeSeniors() {
  const q = S.recherche.trim();
  let rows = S.cache.seniors.filter(s => S.filtreStatut === 'tous' || (S.filtreStatut === 'portage' ? !!s.portage : s.statut === S.filtreStatut));
  // recherche au fil de la frappe : nom, prénom, nom de jeune fille, date de naissance (jj/mm/aaaa, aaaa…)
  if (q) { const ids = new Set(L.filtrer(rows.map(itemPersonne), q, 100000).liste.map(x => x.id)); rows = rows.filter(s => ids.has(s.id)); }
  rows.sort(L.comparerPatronyme);
  if (!rows.length) return `<div class="empty"><b>${S.cache.seniors.length ? 'Aucun résultat' : 'Aucune personne enregistrée'}</b>${S.cache.seniors.length ? 'Essayez un autre nom.' : 'Ajoutez la première personne avec le bouton en haut.'}</div>`;
  return rows.map(s => {
    const a = L.age(s.naissance), ok = L.adhesionAJour(s);
    return `<button class="cand" data-action="senior-form" data-id="${s.id}">
      <span class="av">${esc(initiales(s.prenom + ' ' + s.nom))}</span>
      <span style="flex:1"><b>${esc(L.nomAffiche(s))}</b><span class="why">
        ${s.nomNaissance ? `<span class="pill p-bleu">née ${esc(s.nomNaissance)}</span>` : ''}
        ${a != null ? `<span class="pill p-rose">${a} ans</span>` : ''}
        <span class="pill ${s.statut === 'resident' ? 'p-bleu' : 'p-rose'}">${L.libelleStatut(s.statut)}</span>
        ${s.appartement && s.statut === 'resident' ? `<span class="pill">Appt ${esc(s.appartement)}</span>` : ''}
        ${s.prenomAConfirmer ? '<span class="pill p-warn">Prénom à confirmer</span>' : ''}
        ${s.portage ? `<span class="pill p-bleu">Portage : ${esc(L.libelleFrequence(s.portage))}</span>` : ''}
        ${L.lieuDeVie(s, P('residence.nom')) ? `<span class="pill">${esc(L.lieuDeVie(s, P('residence.nom')))}</span>` : ''}
        ${ok ? '' : '<span class="pill p-warn">Adhésion à renouveler</span>'}</span></span>
      <span class="sub">${esc(s.tel || '')}</span></button>`;
  }).join('');
}
export function seniors() {
  if (!pret('seniors')) return chargement('Personnes');
  if (adhs.ongletSen() === 'adhesions') return enteteSeniors() + adhs.barreOnglets() + adhs.vueAdhesions();
  if (adhs.ongletSen() === 'verification') return enteteSeniors() + adhs.barreOnglets() + adhs.vueVerification();
  return seniorsListe();
}
function enteteSeniors() { return `<div class="top"><div><h1>Personnes</h1><p>Adhésions par année civile et vérification annuelle des fiches.</p></div><div class="quick"><button class="btn" data-action="senior-form">+ Nouvelle personne</button></div></div>`; }
function seniorsListe() {
  const adh = S.cache.seniors.filter(s => !L.adhesionAJour(s)).length;
  return `<div class="top"><div><h1>Personnes</h1><p>${S.cache.seniors.length} fiche${S.cache.seniors.length > 1 ? 's' : ''}${adh ? ` · ${adh} adhésion${adh > 1 ? 's' : ''} à renouveler` : ''}</p></div>
    <div class="quick"><button class="btn" data-action="senior-form">+ Nouvelle personne</button><button class="btn sec" data-action="importer" data-cible="seniors">Importer une liste</button><button class="btn sec" data-action="export-seniors">Exporter (Excel)</button></div></div>
  ${adhs.barreOnglets()}
  <input class="search" id="rech" type="search" placeholder="Chercher : nom, prénom, nom de jeune fille, date de naissance (jj/mm/aaaa ou année)…" aria-label="Chercher une personne" value="${esc(S.recherche)}">
  <div class="filters">${[['tous', 'Tous'], ['adherent', 'Adhérents'], ['resident', 'Résidents'], ['autre', 'Autres'], ['portage', 'Portage de repas']].map(([k, l]) => `<button data-action="filtre-statut" data-v="${k}" aria-pressed="${S.filtreStatut === k}">${l}</button>`).join('')}</div>
  <div id="liste">${listeSeniors()}</div>`;
}
export function afterSeniors() { adhs.migrer(); adhs.apresAdhesions(); const r = $('#rech'); if (r) r.oninput = () => { S.recherche = r.value; $('#liste').innerHTML = listeSeniors(); }; }

function seniorForm(id) {
  const s = id ? seniorDe(id) : { statut: 'adherent', sexe: '', commune: P('commune.defaut') };
  const anCour = Number(aujourdhui().slice(0, 4)), histo = L.adhesionsDe(s), tel = L.telephones(s), prox = L.prochesDe(s);
  const annees = [...new Set([...histo.map(a => a.annee), anCour, L.anneeCible(aujourdhui(), P('adhesion.relanceMois'))])].sort((a, b) => b - a);
  const adhDe = an => histo.find(a => a.annee === an) || { annee: an, date: aujourdhui(), montant: P('adhesion.montantDefaut'), paye: false, mode: '', datePaiement: '' };
  const adh = adhDe(anCour), modes = P('adhesion.modes');
  modal(`<h2>${id ? 'Fiche de ' + esc(s.prenom) : 'Nouvelle personne'}</h2>
  <div class="two"><div class="field"><label for="n1">Prénom</label><input id="n1" value="${esc(s.prenom || '')}" autocomplete="off"></div>
  <div class="field"><label for="n2">Nom</label><input id="n2" value="${esc(s.nom || '')}" autocomplete="off"></div></div>
  <div class="field"><label for="n10">Nom de jeune fille <small class="sub">(facultatif, pour les dames)</small></label><input id="n10" value="${esc(s.nomNaissance || '')}" autocomplete="off"></div>
  <div class="two"><div class="field"><label for="n3">Date de naissance</label><input id="n3" type="date" value="${esc(s.naissance || '')}"></div>
  <div class="field"><label for="n4">Sexe (pour les statistiques)</label><select id="n4"><option value="" ${!s.sexe ? 'selected' : ''}>Non précisé</option><option value="F" ${s.sexe === 'F' ? 'selected' : ''}>Femme</option><option value="H" ${s.sexe === 'H' ? 'selected' : ''}>Homme</option></select></div></div>
  <div class="field"><label for="n5">Statut</label><select id="n5"><option value="adherent" ${s.statut === 'adherent' ? 'selected' : ''}>Adhérent·e</option><option value="resident" ${s.statut === 'resident' ? 'selected' : ''}>Résident·e (adhésion comprise dans le loyer)</option><option value="autre" ${s.statut === 'autre' ? 'selected' : ''}>Autre public</option></select></div>
  <div id="blocAdr"><div class="field"><label for="n6">Adresse</label><input id="n6" value="${esc(s.adresse || '')}"></div>
  <div class="field"><label for="n11">Commune</label><input id="n11" value="${esc(s.commune || '')}" autocomplete="off"></div></div>
  <div id="infoRes" style="display:none"><p class="sub">Lieu de vie : ${esc(P('residence.nom') || 'la résidence')}. Aucune adresse à saisir.</p>
  <div class="field"><label for="n15">Appartement <small class="sub">(numéro)</small></label><input id="n15" value="${esc(s.appartement || '')}" autocomplete="off" inputmode="numeric"></div></div>
  <label class="chk" style="margin:6px 0"><input type="checkbox" id="n12" ${s.prenomAConfirmer ? 'checked' : ''}> Prénom à confirmer</label>
  <label class="chk" style="margin:6px 0"><input type="checkbox" id="n13" ${s.portage ? 'checked' : ''}> Reçoit le portage de repas à domicile</label>
  <div id="blocPortage" style="display:none"><fieldset class="field" style="border:0;padding:0;margin:0"><legend class="sub">Jours de livraison</legend>
    <div class="filters">${L.JOURS_PORTAGE.map((j, i) => `<label class="chk" style="margin-right:10px"><input type="checkbox" class="pj" value="${i}" ${s.portage && (s.portage.jours || []).includes(i) ? 'checked' : ''}> ${j}</label>`).join('')}</div></fieldset>
    <div class="field"><label for="n14">Précision <small class="sub">(facultatif, ex. « au choix », « sauf jours fériés »)</small></label><input id="n14" value="${esc(s.portage ? s.portage.precision || '' : '')}" autocomplete="off"></div></div>
  <div class="two"><div class="field"><label for="n7">Téléphone fixe</label><input id="n7" type="tel" value="${esc(tel.fixe)}"></div>
  <div class="field"><label for="n16">Téléphone portable</label><input id="n16" type="tel" value="${esc(tel.portable)}"></div></div>
  <div class="field"><label for="n17">Adresse e-mail <small class="sub">(facultatif)</small></label><input id="n17" type="email" value="${esc(s.email || '')}" autocomplete="off"></div>
  <div class="two"><div class="field"><label for="n18">Quartier ou secteur <small class="sub">(facultatif, pour organiser les trajets)</small></label><input id="n18" value="${esc(s.quartier || '')}" autocomplete="off"></div>
  <div class="field"><label for="n19">Date d'entrée dans le service <small class="sub">(facultatif)</small></label><input id="n19" type="date" value="${esc(s.entreeLe || '')}"></div></div>
  <fieldset class="field" style="border:0;padding:0;margin:0"><legend class="sub">Proches à prévenir (3 au plus : nom, lien, téléphone)</legend>
    ${[0, 1, 2].map(k => { const p = prox[k] || {}; return `<div class="two" style="grid-template-columns:2fr 1.2fr 1.4fr"><input id="pr${k}n" aria-label="Proche ${k + 1} : nom" placeholder="Prénom et nom" value="${esc(p.nom || '')}" autocomplete="off"><input id="pr${k}l" aria-label="Proche ${k + 1} : lien" placeholder="Lien (fille, voisin…)" value="${esc(p.lien || '')}" autocomplete="off"><input id="pr${k}t" type="tel" aria-label="Proche ${k + 1} : téléphone" placeholder="Téléphone" value="${esc(p.tel || '')}"></div>`; }).join('')}</fieldset>
  <div class="field"><label for="n20">Informations d'organisation <small class="sub">(facultatif)</small></label><textarea id="n20" rows="2">${esc(s.infosOrga || '')}</textarea>
    <div class="note" style="margin:4px 0 0"><b>✔ À écrire</b> : une information d'organisation, par exemple « préfère les activités l'après-midi », « vient avec une voisine », « à appeler avant de passer ».<br><b>✘ À ne pas écrire</b> : toute information de santé (maladie, handicap, médicament, allergie, perte d'autonomie). Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div></div>
  <div id="blocAdh"><h3 style="margin:12px 0 4px">Adhésion (année civile)</h3>
  <div class="two"><div class="field"><label for="a4">Année</label><select id="a4">${annees.map(a => `<option value="${a}" ${a === anCour ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
  <div class="field"><label for="a1">Date d'adhésion</label><input id="a1" type="date" value="${esc(adh.date || '')}"></div></div>
  <div class="two"><div class="field"><label for="a2">Montant (€)</label><input id="a2" type="number" min="0" step="1" value="${esc(adh.montant != null ? adh.montant : P('adhesion.montantDefaut'))}"></div>
  <div class="field"><label for="a5">Mode de règlement</label><select id="a5"><option value="">—</option>${modes.map(m => `<option ${adh.mode === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div></div>
  <label class="chk" style="margin:6px 0"><input type="checkbox" id="a3" ${adh.paye ? 'checked' : ''}> Cotisation réglée</label>
  <div class="field" id="blocReg"><label for="a6">Réglée le</label><input id="a6" type="date" value="${esc(adh.datePaiement || '')}"></div>
  <p class="sub" id="histAdh">${histo.length ? 'Historique : ' + histo.slice().reverse().map(a => `${a.annee} ${a.paye ? 'réglée' : 'à régler'}`).join(' · ') : 'Aucune adhésion enregistrée.'}</p></div>
  <p class="sub">Ne notez ici aucune information de santé : AniMerci n'en contient pas (ni allergie, ni maladie, ni médicament, ni handicap).</p>
  <div class="quick" style="margin-top:14px"><button class="btn" id="saveSenior">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>
  ${id ? '<button class="btn ghost" id="fusSenior">Fusionner avec un doublon…</button><button class="btn ghost" id="delSenior" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  if (id) $('#fusSenior').onclick = () => fusionForm(id);
  const maj = () => { const r = $('#n5').value === 'resident'; $('#blocAdh').style.display = $('#n5').value === 'adherent' ? 'block' : 'none'; $('#blocAdr').style.display = r ? 'none' : 'block'; $('#infoRes').style.display = r ? 'block' : 'none'; };
  $('#n5').onchange = maj; maj();
  let anChoisie = anCour, edit = { [anCour]: { ...adh } }; const touche = new Set();
  for (const k of ['a1', 'a2', 'a3', 'a5', 'a6']) $('#' + k).addEventListener('change', () => touche.add(anChoisie));
  const lireAdh = () => ({ annee: anChoisie, date: $('#a1').value, montant: $('#a2').value, paye: $('#a3').checked, mode: $('#a5').value, datePaiement: $('#a6').value });
  const majReg = () => { $('#blocReg').style.display = $('#a3').checked ? 'block' : 'none'; };
  $('#a3').onchange = () => { if ($('#a3').checked && !$('#a6').value) $('#a6').value = aujourdhui(); majReg(); }; majReg();
  $('#a4').onchange = () => {
    edit[anChoisie] = lireAdh(); anChoisie = Number($('#a4').value); const a = edit[anChoisie] || adhDe(anChoisie);
    $('#a1').value = a.date || ''; $('#a2').value = a.montant != null ? a.montant : P('adhesion.montantDefaut'); $('#a3').checked = !!a.paye; $('#a5').value = a.mode || ''; $('#a6').value = a.datePaiement || ''; majReg();
  };
  const majPortage = () => { $('#blocPortage').style.display = $('#n13').checked ? 'block' : 'none'; };
  $('#n13').onchange = majPortage; majPortage();
  $('#saveSenior').onclick = async () => {
    const nom = $('#n2').value.trim(), prenom = $('#n1').value.trim();
    if (!nom || !prenom) return toast('Le prénom et le nom sont nécessaires.');
    const statut = $('#n5').value, naissance = $('#n3').value;
    // homonymes : même prénom + nom qu'une autre fiche → la date de naissance les distingue (obligatoire)
    const autres = S.cache.seniors.filter(x => x.id !== id), nomNaissance = $('#n10').value.trim(), memes = L.homonymes({ id, prenom, nom, nomNaissance }, autres);
    if (memes.length && !naissance) return toast('Une autre personne porte le même nom : renseignez la date de naissance pour les distinguer.');
    if (memes.some(x => x.naissance && x.naissance === naissance)) return toast(`${prenom} ${nom}, née le ${L.fmtDate(naissance)}, est déjà enregistrée. Si ce sont bien deux personnes différentes, ajoutez par exemple un second prénom au nom pour les distinguer.`);
    const doc = { ...(id ? { id } : {}), nom, nomNaissance, prenom, naissance, sexe: $('#n4').value, statut, adresse: statut === 'resident' ? '' : $('#n6').value.trim(), commune: statut === 'resident' ? '' : $('#n11').value.trim(), prenomAConfirmer: $('#n12').checked, appartement: statut === 'resident' ? $('#n15').value.trim() : '', portage: $('#n13').checked ? { jours: [...document.querySelectorAll('.pj:checked')].map(c => Number(c.value)), precision: $('#n14').value.trim() } : null, telFixe: $('#n7').value.trim(), telPortable: $('#n16').value.trim(), email: $('#n17').value.trim(), quartier: $('#n18').value.trim(), entreeLe: $('#n19').value, infosOrga: $('#n20').value.trim(),
      proches: [0, 1, 2].map(k => ({ nom: $(`#pr${k}n`).value, lien: $(`#pr${k}l`).value, tel: $(`#pr${k}t`).value })),
      verifieLe: s.verifieLe || '', verifiePar: s.verifiePar || '',
      adhesions: histo };
    if (statut === 'adherent') {
      edit[anChoisie] = lireAdh();
      for (const an of Object.keys(edit)) {
        const a = edit[an]; if (!histo.some(x => x.annee === Number(an)) && !touche.has(Number(an)) && !(!id && Number(an) === anCour)) continue; // année simplement consultée : rien à créer
        if (a.paye && !a.datePaiement) a.datePaiement = a.date || aujourdhui();
        const err = L.erreurAdhesion({ ...a, annee: Number(an) }); if (err) return toast(`Adhésion ${an} : ${err}`);
        doc.adhesions = L.avecAdhesion({ ...doc, adhesions: doc.adhesions }, { ...a, annee: Number(an) });
      }
    }
    Object.assign(doc, L.champsCalcules(doc));
    const nid = await sauver('seniors', doc, 'Fiche enregistrée');
    await pg.apresFiche(id ? s : null, { ...doc, id: nid }); // portage : nom, jours, case « Reçoit le portage » cochée ou décochée
    // met à jour le nom recopié dans les inscriptions et fiches (les intervenants ne voient que ces copies) :
    // pour la personne, et pour ses homonymes (leur libellé « (né·e en …) » change selon qu'un·e homonyme existe ou non)
    const apres = autres.concat([{ ...doc, id: nid }]);
    const concernes = [{ ...doc, id: nid }, ...memes, ...(id && s ? L.homonymes(s, autres) : [])];
    for (const p of new Map(concernes.map(x => [x.id, x])).values()) {
      const nomAff = L.nomSenior(p, apres);
      for (const col of ['inscriptions', 'fiches']) for (const r of (await store.lire(col, ['seniorId', '==', p.id])).filter(x => x.seniorNom !== nomAff)) await store.save(col, { id: r.id, seniorNom: nomAff });
    }
    closeModal();
  };
  if (id) $('#delSenior').onclick = () => confirmer('Supprimer cette fiche ?', `${s.prenom} ${s.nom} sera retiré·e de la liste, de ses inscriptions et de ses fiches de sortie. Les appels déjà validés restent dans les bilans.`, 'Supprimer', async () => {
    const liens = {}; for (const col of ['inscriptions', 'fiches']) liens[col] = await store.lire(col, ['seniorId', '==', id]);
    let docsPortage = []; try { docsPortage = await store.lire('portage', ['seniorId', '==', id]); } catch (e) { /* module portage non encore autorisé par les règles : rien à retirer */ }
    await mettreCorbeille('seniors', s, { inscriptions: liens.inscriptions, portage: docsPortage });
    for (const col of ['inscriptions', 'fiches']) for (const r of liens[col]) await store.remove(col, r.id);
    for (const r of docsPortage) await store.remove('portage', r.id);
    await store.remove('seniors', id);
    // ses homonymes n'ont plus besoin du complément « (né·e en …) »
    const reste = S.cache.seniors.filter(x => x.id !== id);
    for (const p of L.homonymes(s, reste)) { const nomAff = L.nomSenior(p, reste); for (const col of ['inscriptions', 'fiches']) for (const r of (await store.lire(col, ['seniorId', '==', p.id])).filter(x => x.seniorNom !== nomAff)) await store.save(col, { id: r.id, seniorNom: nomAff }); }
    toast(`Fiche mise à la corbeille (récupérable ${P('securite.joursCorbeille')} jours)`);
  });
}

function exportSeniors() {
  const cols = [
    { label: 'Nom', get: s => s.nom }, { label: 'Nom de jeune fille', get: s => s.nomNaissance }, { label: 'Prénom', get: s => s.prenom }, { label: 'Sexe', get: s => s.sexe || 'Non précisé' },
    { label: 'Date de naissance', get: s => L.fmtDate(s.naissance) }, { label: 'Âge', get: s => L.age(s.naissance) },
    { label: 'Statut', get: s => L.libelleStatut(s.statut) }, { label: 'Lieu de vie', get: s => L.lieuDeVie(s, P('residence.nom')) }, { label: 'Appartement', get: s => s.appartement }, { label: 'Adresse', get: s => s.adresse }, { label: 'Tél. fixe', get: s => L.telephones(s).fixe }, { label: 'Tél. portable', get: s => L.telephones(s).portable }, { label: 'E-mail', get: s => s.email }, { label: 'Quartier', get: s => s.quartier },
    { label: 'Proches', get: s => L.prochesDe(s).map(p => [p.nom, p.lien, p.tel].filter(Boolean).join(', ')).join(' ; ') }, { label: 'Dernière vérification', get: s => L.fmtDate(s.verifieLe) },
    { label: 'Adhésion ' + new Date().getFullYear() + ' réglée', get: s => s.statut === 'adherent' ? (L.adhesionAJour(s) ? 'oui' : 'non') : '' },
    { label: 'Adhésion à jour', get: s => L.adhesionAJour(s) ? 'oui' : 'non' }
  ];
  telecharger('personnes.csv', L.toCSV(cols, S.cache.seniors));
}

/* ============ TÂCHES ============ */
export function taches() {
  const auj = aujourdhui();
  const cats = ['Toutes', ...new Set(S.cache.taches.map(t => t.cat).filter(Boolean))];
  const rows = S.cache.taches.filter(t => S.filtreTache === 'Toutes' || t.cat === S.filtreTache)
    .filter(t => S.filtreStatutTache === 'tous' || (t.statut || 'a-faire') === S.filtreStatutTache)
    .sort(L.comparerTaches);
  return `<div class="top"><div><h1>Mes tâches</h1><p>Cochez pour terminer. Les tâches qui se répètent se recréent toutes seules.</p></div><button class="btn" data-action="tache-form">+ Nouvelle tâche</button></div>
  <div class="filters">${cats.map(c => `<button data-action="filtre-tache" data-v="${esc(c)}" aria-pressed="${S.filtreTache === c}">${esc(c)}</button>`).join('')}</div>
  <div class="filters" aria-label="Filtrer par statut">${[['tous', 'Tous les statuts'], ...Object.entries(L.STATUTS_TACHE)].map(([k, l]) => `<button data-action="filtre-statut-tache" data-v="${k}" aria-pressed="${S.filtreStatutTache === k}">${l}</button>`).join('')}</div>
  <div class="card">${rows.length ? rows.map(t => `<div class="task ${t.done ? 'done' : ''}">
    <input type="checkbox" data-action="tache-done" data-id="${t.id}" ${t.done ? 'checked' : ''} aria-label="Terminer : ${esc(t.titre)}">
    <button style="flex:1;background:none;border:0;text-align:left;padding:0" data-action="tache-form" data-id="${t.id}"><span class="t">${esc(t.titre)}</span><br><small class="sub">${esc(t.cat || '')}${t.responsable ? ' · ' + esc(t.responsable) : ''}${t.echeance ? ' · ' + L.fmtDate(t.echeance) : ''}${t.repete ? ' · se répète' : ''}</small></button>
    ${!t.done && t.priorite === 'haute' ? '<span class="pill p-crit">Priorité haute</span>' : ''}${!t.done && t.statut === 'en-cours' ? '<span class="pill p-bleu">En cours</span>' : ''}${!t.done && t.statut === 'en-attente' ? '<span class="pill p-warn">En attente</span>' : ''}
    ${t.done ? '<span class="pill p-ok">Fait</span>' : t.echeance && t.echeance < auj ? '<span class="pill p-crit">En retard</span>' : t.echeance && t.echeance <= ajouterJours(auj, 7) ? '<span class="pill p-warn">Cette semaine</span>' : '<span class="pill p-rose">À venir</span>'}</div>`).join('')
    : '<div class="empty"><b>Aucune tâche</b>Ajoutez la première avec le bouton en haut.</div>'}</div>`;
}
function tacheForm(id) {
  const t = id ? S.cache.taches.find(x => x.id === id) : { cat: 'Événements', echeance: ajouterJours(aujourdhui(), 7), repete: '' };
  const st = t.statut || 'a-faire', pr = t.priorite || 'normale';
  modal(`<h2>${id ? 'Modifier la tâche' : 'Nouvelle tâche'}</h2>
  <div class="field"><label for="t1">Intitulé</label><input id="t1" value="${esc(t.titre || '')}"></div>
  <div class="two"><div class="field"><label for="t2">Catégorie</label><input id="t2" list="cats" value="${esc(t.cat || '')}"><datalist id="cats">${CATS_TACHE.map(c => `<option value="${c}">`).join('')}</datalist></div>
  <div class="field"><label for="t3">Échéance</label><input id="t3" type="date" value="${esc(t.echeance || '')}"></div></div>
  <div class="two"><div class="field"><label for="t6">Statut</label><select id="t6">${Object.entries(L.STATUTS_TACHE).map(([k, l]) => `<option value="${k}" ${st === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="t7">Priorité</label><select id="t7">${Object.entries(L.PRIORITES_TACHE).map(([k, l]) => `<option value="${k}" ${pr === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
  ${champListe('t5', 'tacheResponsable', t.responsable, t.responsableId)}
  <div class="field"><label for="t4">Se répète</label><select id="t4">${[['', 'Jamais'], ['semaine', 'Chaque semaine'], ['mois', 'Chaque mois'], ['an', 'Chaque année']].map(([k, l]) => `<option value="${k}" ${(t.repete || '') === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="quick" style="margin-top:14px"><button class="btn" id="saveT">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id ? '<button class="btn ghost" id="delT" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveT').onclick = async () => {
    const titre = $('#t1').value.trim(); if (!titre) return toast('Donnez un intitulé à la tâche.');
    const resp = await lireChamp('t5', 'tacheResponsable'); if (!resp) return;
    await sauver('taches', { ...(id ? { id } : { done: false }), titre, cat: $('#t2').value.trim(), echeance: $('#t3').value, repete: $('#t4').value, statut: $('#t6').value, priorite: $('#t7').value, ...resp }, 'Tâche enregistrée'); closeModal();
  };
  if (id) $('#delT').onclick = async () => { await mettreCorbeille('taches', t); await store.remove('taches', id); closeModal(); toast('Tâche mise à la corbeille'); };
}
export function prochaineEcheance(iso, repete) {
  const d = new Date(iso + 'T12:00:00');
  const jour = d.getDate();
  if (repete === 'semaine') d.setDate(jour + 7);
  else if (repete === 'mois' || repete === 'an') { // le 31 janvier + 1 mois = 28 février (et non le 3 mars)
    d.setDate(1); d.setMonth(d.getMonth() + (repete === 'mois' ? 1 : 12));
    d.setDate(Math.min(jour, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  }
  return d.toISOString().slice(0, 10);
}
async function tacheDone(el) {
  const t = S.cache.taches.find(x => x.id === el.dataset.id); if (!t) return;
  await store.save('taches', { id: t.id, done: el.checked });
  if (el.checked && t.repete && t.echeance) await store.save('taches', { titre: t.titre, cat: t.cat, repete: t.repete, done: false, statut: 'a-faire', priorite: t.priorite || 'normale', responsable: t.responsable || '', responsableId: t.responsableId || '', echeance: prochaineEcheance(t.echeance, t.repete) });
}

/* ============ PLANNING ============ */
function evenementsDuJour(iso) {
  const ev = [];
  S.cache.activites.filter(a => a.date === iso).forEach(a => ev.push({ txt: a.nom, cls: classeCat(a.cat), id: a.id }));
  S.cache.seances.filter(s => s.date === iso).forEach(s => { const a = actDe(s.activiteId); if (a && a.date !== iso) ev.push({ txt: a.nom, cls: classeCat(a.cat), id: a.id }); });
  S.cache.taches.filter(t => t.echeance === iso && !t.done).forEach(t => ev.push({ txt: t.titre, cls: 't' }));
  return ev;
}
export function classeCat(cat) { return ({ 'Créatif': 'c1', 'Mémoire': 'c2', 'Culture': 'c3', 'Bien-être': 'c4', 'Événement': 'c5', 'Sortie': 'c1' })[cat] || 'c2'; }
// Grille d'un mois (a : année, m : mois de 0 à 11)
function grilleMois(a, m, auj) {
  const premier = new Date(a, m, 1), nb = new Date(a, m + 1, 0).getDate(), decal = (premier.getDay() + 6) % 7;
  let cells = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(n => `<div class="h">${n}</div>`).join('') + '<div class="d off"></div>'.repeat(decal);
  for (let d = 1; d <= nb; d++) {
    const iso = `${a}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells += `<div class="d ${iso === auj ? 'today' : ''}"><b>${d}</b>${evenementsDuJour(iso).map(e => `<button class="ev ${e.cls}" ${e.id ? `data-action="open-act" data-id="${e.id}"` : ''} title="${esc(e.txt)}">${esc(e.txt)}</button>`).join('')}</div>`;
  }
  return `<div class="cal-mois">${S.nbMois > 1 ? `<h3 style="margin:0 0 8px;font-size:22px">${MOIS[m]} ${a}</h3>` : ''}<div class="cal">${cells}</div></div>`;
}
export function planning() {
  if (!S.moisPlan) { const d = new Date(); S.moisPlan = { a: d.getFullYear(), m: d.getMonth() }; }
  const { a, m } = S.moisPlan, auj = aujourdhui(), nbm = S.nbMois || 1;
  const fin = new Date(a, m + nbm - 1, 1);
  const titre = nbm === 1 ? `${MOIS[m]} ${a}` : `${MOIS[m]} ${a} – ${MOIS[fin.getMonth()]} ${fin.getFullYear()}`;
  let grilles = ''; for (let k = 0; k < nbm; k++) { const d = new Date(a, m + k, 1); grilles += grilleMois(d.getFullYear(), d.getMonth(), auj); }
  const admin = S.user.role === 'admin';
  return `<div class="top"><div><h1>Planning</h1><p>Une seule saisie : ce que vous ajoutez dans les activités apparaît ici.</p></div>
    ${admin ? '<div class="quick"><button class="btn" data-action="affiche">Créer l\'affiche de la semaine</button><button class="btn sec" data-action="programme">Programme à imprimer</button></div>' : ''}</div>
  <div class="card"><div class="filters noprint" aria-label="Nombre de mois affichés">${[1, 2, 3].map(n => `<button data-action="nb-mois" data-v="${n}" aria-pressed="${nbm === n}">${n} mois</button>`).join('')}</div>
    <div class="quick" style="justify-content:space-between;align-items:center;margin-bottom:12px">
    <button class="btn sec sm" data-action="mois" data-v="-1" aria-label="Période précédente">← Précédent</button><h2 style="margin:0;text-align:center">${titre}</h2><button class="btn sec sm" data-action="mois" data-v="1" aria-label="Période suivante">Suivant →</button></div>
    ${grilles}
    <div class="legend"><span class="pill c1">Créatif et sorties</span><span class="pill c2">Mémoire</span><span class="pill c3">Culture</span><span class="pill c4">Bien-être</span><span class="pill c5">Événement</span><span class="pill p-rose">Tâche (pointillés)</span></div></div>`;
}
// Programme d'une période : activités datées par mois, puis activités régulières ; à imprimer ou à copier
function programmeTexte(du, au) {
  const pg = L.programme(S.cache.activites, du, au);
  const ligne = a => `${dateLongue(a.date)}${a.jour ? ' · ' + a.jour.split('·').pop().trim() : ''} : ${a.nom}${a.lieu ? ' (' + a.lieu + ')' : ''}${a.cout ? ' · ' + a.cout : ''}`;
  const reg = a => `${a.nom} : ${[a.jour, a.frequence].filter(Boolean).join(' · ')}${a.lieu ? ' (' + a.lieu + ')' : ''}`;
  return { pg, ligne, reg, texte: [`Programme du ${L.fmtDate(du)} au ${L.fmtDate(au)}`, ...pg.mois.flatMap(mm => ['', MOIS[Number(mm.mois.slice(5)) - 1].toUpperCase() + ' ' + mm.mois.slice(0, 4), ...mm.items.map(ligne)]), ...(pg.regulieres.length ? ['', 'ACTIVITÉS RÉGULIÈRES', ...pg.regulieres.map(reg)] : [])].join('\n') };
}
function programme() {
  const auj = aujourdhui(), d0 = new Date(), fin0 = new Date(d0.getFullYear(), d0.getMonth() + 3, 0), p2 = n => String(n).padStart(2, '0');
  modal(`<h2>Programme à imprimer</h2><p class="sub noprint">Choisissez la période : le programme reprend les activités qui ont une date, puis les activités régulières.</p>
  <div class="two noprint"><div class="field"><label for="pg1">Du</label><input id="pg1" type="date" value="${auj}"></div><div class="field"><label for="pg2">Au</label><input id="pg2" type="date" value="${fin0.getFullYear()}-${p2(fin0.getMonth() + 1)}-${p2(fin0.getDate())}"></div></div>
  <div id="pg-zone"></div>
  <div class="quick noprint" style="margin-top:14px"><button class="btn" id="pg-imp">Imprimer</button><button class="btn sec" id="pg-cp">Copier le texte</button><button class="btn ghost" data-action="close">Fermer</button></div>`);
  const maj = () => {
    const du = $('#pg1').value, au = $('#pg2').value; if (!du || !au || du > au) { $('#pg-zone').innerHTML = '<p class="sub">Choisissez une période valide.</p>'; return; }
    const { pg, ligne, reg } = programmeTexte(du, au);
    $('#pg-zone').innerHTML = `<div class="feuille"><h3>Programme</h3><div class="sub">${esc(P('affiche.lieu') || P('nomService'))} · du ${L.fmtDate(du)} au ${L.fmtDate(au)}</div>
      ${pg.mois.map(mm => `<h4>${MOIS[Number(mm.mois.slice(5)) - 1]} ${mm.mois.slice(0, 4)}</h4><ul>${mm.items.map(a => `<li>${esc(ligne(a))}</li>`).join('')}</ul>`).join('')}
      ${pg.regulieres.length ? `<h4>Activités régulières</h4><ul>${pg.regulieres.map(a => `<li>${esc(reg(a))}</li>`).join('')}</ul>` : ''}
      ${!pg.mois.length && !pg.regulieres.length ? '<p>Aucune activité sur cette période.</p>' : ''}<p class="sub" style="margin-top:12px">${esc(P('affiche.pied'))}</p></div>`;
  };
  $('#pg1').onchange = maj; $('#pg2').onchange = maj; maj();
  $('#pg-imp').onclick = () => window.print();
  $('#pg-cp').onclick = () => { const du = $('#pg1').value, au = $('#pg2').value; if (du && au && du <= au) copier(programmeTexte(du, au).texte, 'Programme copié'); };
}
function affiche() {
  const debut = aujourdhui(), fin = ajouterJours(debut, 7);
  const items = S.cache.activites.filter(a => a.date >= debut && a.date <= fin).sort((a, b) => a.date.localeCompare(b.date));
  const lignes = items.map(a => `${dateLongue(a.date)} · ${a.jour ? a.jour.split('·').pop().trim() + ' · ' : ''}${a.nom}${a.lieu ? ' (' + a.lieu + ')' : ''}`);
  modal(`<h2>Affiche de la semaine</h2>
  <div class="poster"><h3>Cette semaine avec vous</h3><div class="sub">${esc(P('affiche.lieu') || P('nomService'))}</div>
  ${lignes.length ? `<ul>${lignes.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p>Aucune activité datée dans les 7 prochains jours.</p>'}
  <div class="pf">${esc(P('affiche.pied'))}</div></div>
  <div class="quick noprint" style="margin-top:14px"><button class="btn" id="imp">Imprimer</button><button class="btn sec" id="cp">Copier le texte</button><button class="btn ghost" data-action="close">Fermer</button></div>`);
  $('#imp').onclick = () => window.print();
  $('#cp').onclick = () => copier('Cette semaine avec vous\n' + lignes.join('\n'));
}

/* ============ BILANS ============ */
export function bilans() {
  const an = new Date().getFullYear();
  const du = S.stat.du || `${an}-01-01`, au = S.stat.au || `${an}-12-31`;
  const st = L.statistiques(S.cache.seances, S.cache.seniors, S.cache.activites, { du, au });
  const mx = Math.max(1, ...Object.values(st.parCat)), mxm = Math.max(1, ...Object.values(st.parMois));
  const mois = Object.keys(st.parMois).sort();
  return `<div class="top"><div><h1>Bilans</h1><p>Calculés à partir des appels validés. Une personne présente à 10 séances compte pour 1 personne et 10 participations.</p></div>
    <div class="quick noprint"><button class="btn sec" data-action="export-bilan">Exporter (Excel)</button><button class="btn sec" data-action="imprimer">Imprimer</button></div></div>
  <div class="card noprint" style="margin-bottom:16px"><div class="two"><div class="field"><label for="b1">Du</label><input id="b1" type="date" value="${du}" data-change="periode"></div><div class="field"><label for="b2">Au</label><input id="b2" type="date" value="${au}" data-change="periode"></div></div></div>
  <div class="grid tiles"><div class="tile"><span class="n">${st.personnesUniques}</span><span class="l">Personnes différentes</span></div>
  <div class="tile"><span class="n">${st.participations}</span><span class="l">Participations</span></div>
  <div class="tile"><span class="n">${st.tauxPresence == null ? '—' : st.tauxPresence + ' %'}</span><span class="l">Taux de présence</span></div>
  <div class="tile"><span class="n">${st.seances}</span><span class="l">Séances</span></div></div>
  ${st.seances ? `<div class="cols"><div class="card"><h2>Participations par mois</h2><div class="vbars">${mois.map(k => `<div><em>${st.parMois[k]}</em><i style="height:${st.parMois[k] / mxm * 80}%"></i><span>${MOIS[Number(k.slice(5)) - 1].slice(0, 4)}.</span></div>`).join('')}</div></div>
  <div class="card"><h2>Par catégorie</h2>${Object.entries(st.parCat).sort((x, y) => y[1] - x[1]).map(([c, n]) => `<div class="stat-row"><span class="lab">${esc(c)}</span><div class="bar"><i style="width:${n / mx * 100}%"></i></div><span class="v">${n}</span></div>`).join('')}</div></div>
  <div class="cols"><div class="card"><h2>Public</h2>
    <div class="stat-row"><span class="lab">Femmes</span><span class="v">${st.publics.femmes}</span></div><div class="stat-row"><span class="lab">Hommes</span><span class="v">${st.publics.hommes}</span></div>${st.publics.autre ? `<div class="stat-row"><span class="lab">Sexe non précisé</span><span class="v">${st.publics.autre}</span></div>` : ''}
    <div class="stat-row"><span class="lab">Adhérent·es</span><span class="v">${st.publics.adherents}</span></div><div class="stat-row"><span class="lab">Résident·es</span><span class="v">${st.publics.residents}</span></div></div>
  <div class="card"><h2>Tranches d'âge</h2>${Object.entries(st.tranches).map(([t, n]) => `<div class="stat-row"><span class="lab">${esc(t)}</span><span class="v">${n}</span></div>`).join('') || '<p class="sub">Pas de date de naissance renseignée.</p>'}
    <p class="sub">Absences non excusées : ${st.absents} · excusées : ${st.excuses} · désistements : ${st.desistements}</p></div></div>`
  : '<div class="card"><div class="empty"><b>Aucune séance validée sur cette période</b>Faites l\'appel dans une activité puis validez-le : les chiffres apparaissent ici.</div></div>'}`;
}
function exportBilan() {
  const an = new Date().getFullYear(), du = S.stat.du || `${an}-01-01`, au = S.stat.au || `${an}-12-31`;
  const lignes = validees().filter(s => s.date >= du && s.date <= au).sort((a, b) => a.date.localeCompare(b.date)).map(s => {
    const v = Object.values(s.presences || {}), n = x => v.filter(y => y === x).length, a = actDe(s.activiteId) || {};
    return { date: s.date, act: a.nom || '', cat: a.cat || '', p: n('p'), a: n('a'), j: n('j'), d: n('d') };
  });
  telecharger('bilan-seances.csv', L.toCSV([
    { label: 'Date', get: r => L.fmtDate(r.date) }, { label: 'Activité', get: r => r.act }, { label: 'Catégorie', get: r => r.cat },
    { label: 'Présents', get: r => r.p }, { label: 'Absents', get: r => r.a }, { label: 'Excusés', get: r => r.j }, { label: 'Désistements', get: r => r.d }
  ], lignes));
}

/* ============ ACTIONS ============ */
export const actions = {
  nav: el => { if (el.dataset.tab) { if (el.dataset.v === 'materiel') S.ongletMat = el.dataset.tab; else if (el.dataset.v === 'seniors') S.ongletSen = el.dataset.tab; else if (el.dataset.v === 'portage') S.ongletPortage = el.dataset.tab; else if (el.dataset.v === 'accueils') S.ongletAccueils = el.dataset.tab; else S.ongletPart = el.dataset.tab; } go(el.dataset.v); },
  'senior-form': el => seniorForm(el.dataset.id),
  'export-seniors': () => exportSeniors(),
  'filtre-statut': el => { S.filtreStatut = el.dataset.v; render(); },
  'tache-form': el => tacheForm(el.dataset.id),
  'filtre-tache': el => { S.filtreTache = el.dataset.v; render(); },
  'filtre-statut-tache': el => { S.filtreStatutTache = el.dataset.v; render(); },
  // « Précédent » et « Suivant » avancent d'autant de mois que ceux affichés (1, 2 ou 3)
  mois: el => { const d = new Date(S.moisPlan.a, S.moisPlan.m + Number(el.dataset.v) * (S.nbMois || 1), 1); S.moisPlan = { a: d.getFullYear(), m: d.getMonth() }; render(); },
  'nb-mois': el => { S.nbMois = Number(el.dataset.v) || 1; render(); },
  programme: () => programme(),
  affiche: () => affiche(),
  'export-bilan': () => exportBilan(),
  imprimer: () => window.print()
};
export const changes = { 'tache-done': tacheDone, periode: () => { S.stat.du = $('#b1').value; S.stat.au = $('#b2').value; render(); } };
