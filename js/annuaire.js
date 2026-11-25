// Annuaire : intervenants, partenaires, bénévoles, collègues… saisis UNE fois, ensuite choisis dans une liste déroulante.
// Rien n'est figé : les catégories et la liste qui alimente chaque rubrique se règlent dans Paramètres (annuaire.*).
// Les bénéficiaires restent dans l'écran « Personnes » (déjà proposés dans « Inscrire quelqu'un »).
import { store } from './store.js';
import { P } from './parametres.js';
import { JOURS_PORTAGE, cleNom, libelleContact, trouverContact, nomComplet, nomAffiche, comparerPatronyme, normContact, separerNom, filtrer } from './logic.js';
import { champRecherche, comboLire, comboFixer, itemContact, NOUVEAU } from './recherche.js';
import { S, pret, chargement, $, esc, initiales, modal, closeModal, toast, confirmer, sauver, mettreCorbeille, render, aujourdhui } from './ui.js';
const anCourant = () => Number(aujourdhui().slice(0, 4));

const AVERT_PART = '<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une information d\'organisation (« projets : dictée avec les CM2 », « à relancer en janvier »).<br><b>✘ À ne pas écrire</b> : toute information de santé, et le nom d\'une personne accompagnée.</div>';

// Rubriques de l'outil où l'on choisit une personne de l'annuaire : collection et champ où le nom est gardé.
// La catégorie qui alimente chaque rubrique est un paramètre (P('annuaire.rubriques.<clé>')).
// Depuis la 1.4.1 le lien se fait par IDENTIFIANT (champ + 'Id') : deux personnes de même nom restent distinctes ;
// le champ texte garde le libellé « Nom · précision » (lisible dans les sauvegardes et pour les intervenants).
export const RUBRIQUES = {
  activiteIntervenant: { col: 'activites', champ: 'interv', label: 'Intervenant·e' },
  activitePartenaire: { col: 'activites', champ: 'partenaire', label: 'Partenaire' },
  activiteBenevole: { col: 'activites', champ: 'benevole', label: 'Bénévole référent·e' },
  tacheResponsable: { col: 'taches', champ: 'responsable', label: 'Responsable' }
};
const ANCIEN = '__ancien__';
const trier = rows => [...rows].sort(comparerPatronyme);   // par patronyme, puis prénom
export const contactsDe = categorie => trier(S.cache.contacts.map(normContact).filter(c => c.categorie === categorie));

/* ---------- Champ « tapez pour chercher + ajout » à placer dans un formulaire ---------- */
// id : identifiant du champ ; rubrique : clé de RUBRIQUES ; valeur / valeurId : libellé et identifiant déjà enregistrés
export function champListe(id, rubrique, valeur, valeurId) {
  const cat = P('annuaire.rubriques.' + rubrique), liste = contactsDe(cat), v = (valeur || '').trim();
  const courant = trouverContact(liste, v, valeurId);
  const ambigu = v && !courant && liste.filter(c => cleNom(nomComplet(c)) === cleNom(v)).length > 1;
  const horsListe = v && !courant && !ambigu;
  return champRecherche({ id, label: `${esc(RUBRIQUES[rubrique].label)} <small class="sub">(liste : ${esc(cat)})</small>`,
    texte: courant ? nomAffiche(courant) : horsListe ? v : '', val: courant ? courant.id : horsListe ? ANCIEN : '',
    aide: ambigu ? `Plusieurs personnes portent le nom « ${v} » : tapez pour choisir la bonne.` : horsListe ? 'Ce nom sera ajouté à la liste à l\'enregistrement. Nouvelle personne : tapez « Prénom Nom ».' : 'Tapez un nom, un prénom ou un métier. Nouvelle personne : tapez « Prénom Nom ».',
    items: () => contactsDe(cat).map(itemContact), recents: 'c-' + cat,
    ajout: t => t ? `+ Ajouter « ${t} » à la liste « ${cat} »` : null });
}
// Lit le champ. Renvoie les deux champs à enregistrer { <champ>: libellé, <champ>Id: id } (valeurs vides si le champ est vide),
// ou null si la saisie est à compléter (un message est alors affiché : l'enregistrement ne doit pas continuer).
// Une personne absente de la liste y est ajoutée automatiquement. Si un homonyme existe, on demande s'il s'agit de la même personne.
export async function lireChamp(id, rubrique) {
  const { champ } = RUBRIQUES[rubrique], vide = { [champ]: '', [champ + 'Id']: '' };
  const lien = c => ({ [champ]: libelleContact(c), [champ + 'Id']: c.id });
  const { val, texte } = comboLire(id); if (!val && !texte) return vide;
  const cat = P('annuaire.rubriques.' + rubrique);
  // lecture dans la base (liste petite) : évite un doublon si la liste n'était pas encore arrivée à l'écran
  const existants = (await store.lire('contacts', ['categorie', '==', cat])).map(normContact);
  if (val && val !== NOUVEAU && val !== ANCIEN) {
    const c = existants.find(x => x.id === val);
    if (c) return lien(c);
    toast('Cette personne n\'est plus dans l\'annuaire : choisissez-en une autre.'); return null;
  }
  const nom = texte; if (!nom) return vide;
  const cle = cleNom(nom), memes = existants.filter(x => cleNom(nomComplet(x)) === cle || cleNom(nomAffiche(x)) === cle);
  const creer = async precision => {
    const sep = separerNom(nom), doc = { categorie: cat, nom: sep.nom, prenom: sep.prenom, ...(sep.organisme ? { organisme: true } : {}), ...(precision ? { precision } : {}) };
    const nid = await sauver('contacts', doc, `${libelleContact(doc)} ajouté·e à la liste « ${cat} »`);
    const c = { ...doc, id: nid }; comboFixer(id, itemContact(c)); return lien(c);
  };
  if (!memes.length) return creer('');
  // homonyme(s) : la réponse se donne dans le formulaire (encadré), puis on enregistre à nouveau
  const panel = $('#' + id).closest('.combo').querySelector('.hom') || (() => { const d = document.createElement('div'); d.className = 'hom'; $('#' + id).closest('.combo').appendChild(d); return d; })();
  const r = panel.querySelector(`input[name="${id}-h-r"]:checked`);
  if (panel.dataset.nom === cle && r) {
    if (r.value !== 'autre') { const c = memes.find(x => x.id === r.value); if (c) { comboFixer(id, itemContact(c)); panel.innerHTML = ''; return lien(c); } }
    else {
      const prec = panel.querySelector('.hom-p').value.trim();
      if (!prec) { toast('Précisez ce qui les distingue (fonction, organisme, ville…).'); panel.querySelector('.hom-p').focus(); return null; }
      if (memes.some(x => cleNom(x.precision) === cleNom(prec))) { toast('Une personne porte déjà ce nom avec cette précision : choisissez-la dans la liste.'); return null; }
      panel.innerHTML = ''; return creer(prec);
    }
  }
  panel.dataset.nom = cle;
  panel.innerHTML = `<div class="note" style="margin-top:8px"><b>« ${esc(nom)} » existe déjà dans la liste « ${esc(cat)} ».</b> Est-ce la même personne ?
    ${memes.map(c => `<label class="chk"><input type="radio" name="${id}-h-r" value="${esc(c.id)}"> Oui : ${esc(libelleContact(c, memes))}${c.tel ? ' (' + esc(c.tel) + ')' : ''}</label>`).join('')}
    <label class="chk"><input type="radio" name="${id}-h-r" value="autre"> Non, c'est une autre personne</label>
    <input class="hom-p" placeholder="Ce qui la distingue (fonction, organisme, ville…)" autocomplete="off" style="margin-top:6px"></div>`;
  toast('Un homonyme existe : indiquez s\'il s\'agit de la même personne.');
  return null;
}

/* ---------- Écran « Annuaire » ---------- */
function listeContacts() {
  const f = S.filtreContact || 'Tous', q = (S.rechAnn || '').trim();
  let rows = trier(S.cache.contacts.map(normContact)).filter(c => f === 'Tous' || c.categorie === f);
  if (q) { const ids = new Set(filtrer(rows.map(itemContact), q, 100000).liste.map(x => x.id)); rows = rows.filter(c => ids.has(c.id)); }
  if (!rows.length) return `<div class="card"><div class="empty"><b>${q ? 'Aucun résultat' : 'Aucun contact ici'}</b>${q ? 'Essayez un autre nom, un prénom ou un métier.' : 'Ajoutez-en avec le bouton, importez une liste, ou ajoutez directement depuis un formulaire (activité, tâche).'}</div></div>`;
  return rows.map(c => `<button class="cand" data-action="contact-form" data-id="${esc(c.id)}"><span class="av">${esc(initiales(nomComplet(c)))}</span>
    <span style="flex:1"><b>${esc(nomAffiche(c))}</b><span class="why">${c.precision ? `<span class="pill p-rose">${esc(c.precision)}</span>` : ''}${!c.organisme && !c.nom ? '<span class="pill p-warn">À compléter (nom)</span>' : ''}${c._derive ? '<span class="pill p-warn">à vérifier</span>' : ''}${c.service ? `<span class="pill p-ok">${esc(c.service)}</span>` : ''}${c.tel ? `<span class="pill p-bleu">${esc(c.tel)}</span>` : ''}${c.email ? `<span class="pill p-rose">${esc(c.email)}</span>` : ''}${c.note ? `<span class="sub">${esc(c.note)}</span>` : ''}${c.inactif ? '<span class="pill p-rose">inactif</span>' : ''}${(c.dispoJours || []).length ? `<span class="pill p-ok">${esc(c.dispoJours.slice().sort((x, y) => x - y).map(k => JOURS_PORTAGE[k].slice(0, 3).toLowerCase() + '.').join(' '))}</span>` : ''}${c.competences ? `<span class="sub">${esc(c.competences)}</span>` : ''}</span></span>
    <span class="pill p-warn">${esc(c.categorie || '—')}</span></button>`).join('');
}
export function annuaire() {
  if (!pret('contacts')) return chargement('Annuaire');
  const cats = P('annuaire.categories'), f = S.filtreContact || 'Tous';
  const autres = [...new Set(S.cache.contacts.map(c => c.categorie).filter(c => c && !cats.includes(c)))];
  const toutes = [...cats, ...autres];
  const n = c => S.cache.contacts.filter(x => x.categorie === c).length;
  const aVerifier = S.cache.contacts.map(normContact).filter(c => c._derive).length;
  return `<div class="top"><div><h1>Annuaire</h1><p>Saisissez chaque personne une seule fois : elle se retrouve ensuite en tapant quelques lettres. Les bénéficiaires sont dans « Personnes ».</p></div>
    <div class="quick"><button class="btn" data-action="contact-form">+ Ajouter</button><button class="btn sec" data-action="importer" data-cible="contacts">Importer une liste</button></div></div>
  ${aVerifier ? `<div class="note">${aVerifier} contact${aVerifier > 1 ? 's' : ''} date${aVerifier > 1 ? 'nt' : ''} d'une ancienne version : le prénom et le nom ont été séparés automatiquement (étiquette « à vérifier »). Ouvrez la fiche et enregistrez pour valider.</div>` : ''}
  <input class="search" id="rech-ann" type="search" placeholder="Chercher : nom, prénom, métier, organisme…" aria-label="Chercher dans l'annuaire" value="${esc(S.rechAnn || '')}">
  <div class="filters">${['Tous', ...toutes].map(c => `<button data-action="filtre-contact" data-v="${esc(c)}" aria-pressed="${f === c}">${esc(c)}${c === 'Tous' ? '' : ' (' + n(c) + ')'}</button>`).join('')}</div>
  <div id="liste-ann">${listeContacts()}</div>`;
}
export function apresAnnuaire() { const r = $('#rech-ann'); if (r) r.oninput = () => { S.rechAnn = r.value; $('#liste-ann').innerHTML = listeContacts(); }; }

// Options d'une liste de Paramètres (la valeur déjà enregistrée reste proposée même si elle a été retirée de la liste)
const optionsListe = (chemin, courant) => { const l = P(chemin); return ['', ...(courant && !l.includes(courant) ? [courant] : []), ...l].map(s => `<option value="${esc(s)}" ${s === (courant || '') ? 'selected' : ''}>${s ? esc(s) : '(aucun)'}</option>`).join(''); };
const AVERT_BEN = '<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : des éléments d\'organisation, par exemple « aime animer les jeux de société », « disponible le mardi après-midi », « peut conduire pour les sorties ».<br><b>✘ À ne pas écrire</b> : toute information de santé ou de situation personnelle sensible. Un champ libre ne peut pas être contrôlé par l\'outil : la règle vaut pour tous.</div>';
function contactForm(id) {
  const cats = P('annuaire.categories'), brut = id ? S.cache.contacts.find(x => x.id === id) : null;
  const c = brut ? normContact(brut) : { categorie: S.filtreContact && S.filtreContact !== 'Tous' ? S.filtreContact : cats[0], prenom: '' };
  if (id && !brut) return;
  const toutes = cats.includes(c.categorie) || !c.categorie ? cats : [...cats, c.categorie];
  modal(`<h2>${id ? 'Modifier le contact' : 'Nouveau contact'}</h2>
  ${c._derive ? '<div class="note">Le prénom et le nom ont été séparés automatiquement : vérifiez-les puis enregistrez.</div>' : ''}
  <div class="two"><div class="field"><label for="c1">Nom <small class="sub">(patronyme)</small></label><input id="c1" value="${esc(c.nom || '')}" autocomplete="off"></div>
  <div class="field" id="c7z"><label for="c7">Prénom</label><input id="c7" value="${esc(c.prenom || '')}" autocomplete="off"></div></div>
  <p class="sub" id="c1z">Vous pouvez n'indiquer que le nom ou que le prénom pour l'instant (par exemple si le nom de famille n'est pas encore connu), et compléter l'autre dès que possible.</p>
    <label class="chk" style="margin:0 0 8px"><input type="checkbox" id="c8" ${c.organisme ? 'checked' : ''}> C'est un organisme (association, entreprise…) : pas de prénom</label>
  <div class="field"><label for="c6">Métier, activité ou organisme <small class="sub">(précision ; obligatoire si une autre personne porte le même nom)</small></label><input id="c6" value="${esc(c.precision || '')}" placeholder="Fleuriste, musicien, association…" autocomplete="off"></div>
  <div class="field"><label for="c2">Catégorie</label><select id="c2">${toutes.map(k => `<option ${c.categorie === k ? 'selected' : ''}>${esc(k)}</option>`).join('')}</select></div>
  <div class="two"><div class="field"><label for="c3">Téléphone</label><input id="c3" type="tel" value="${esc(c.tel || '')}"></div>
  <div class="field"><label for="c4">E-mail</label><input id="c4" type="email" value="${esc(c.email || '')}"></div></div>
  <div class="field"><label for="c5">Remarque</label><input id="c5" value="${esc(c.note || '')}"></div>
  <details class="field" id="blocBen" ${c.competences || (c.dispoJours || []).length || c.dispoPrecision || c.benMissions || c.reunions || (c.remerciements || []).length || c.inactif ? 'open' : ''}><summary><b>Bénévolat</b> <small class="sub">(facultatif : compétences, disponibilités, missions, remerciement)</small></summary>
    <div class="field" style="margin-top:8px"><label for="c14">Compétences et goûts</label><input id="c14" maxlength="200" value="${esc(c.competences || '')}" placeholder="Ex. : jeux de société, couture, conduite"></div>
    <div class="field"><label>Disponibilités habituelles</label><div class="row" style="flex-wrap:wrap;gap:4px 14px">${JOURS_PORTAGE.map((j, k) => `<label class="chk" style="margin:0"><input type="checkbox" class="ben-jour" value="${k}" ${(c.dispoJours || []).includes(k) ? 'checked' : ''}> ${j}</label>`).join('')}</div>
      <input id="c15" maxlength="160" value="${esc(c.dispoPrecision || '')}" placeholder="Précision (ex. : après-midi seulement, hors vacances)" style="margin-top:6px"></div>
    <div class="field"><label for="c16">Missions confiées</label><input id="c16" maxlength="300" value="${esc(c.benMissions || '')}" placeholder="Ex. : accueil du jeudi, accompagnement des sorties"></div>
    <div class="field"><label for="c17">Réunions de bénévoles</label><input id="c17" maxlength="200" value="${esc(c.reunions || '')}" placeholder="Ex. : participe à la réunion de rentrée"></div>
    <div class="field"><label>Remerciement annuel (cocher l'année où la personne a été remerciée)</label><div class="row" style="flex-wrap:wrap;gap:4px 14px">${[0, 1, 2].map(k => anCourant() - k).map(a => `<label class="chk" style="margin:0"><input type="checkbox" class="ben-rem" value="${a}" ${(c.remerciements || []).includes(a) ? 'checked' : ''}> ${a}</label>`).join('')}</div></div>
    <label class="chk" style="margin:0 0 6px"><input type="checkbox" id="c18" ${c.inactif ? 'checked' : ''}> Ne plus compter comme bénévole actif (la fiche est conservée)</label>${AVERT_BEN}</details>
  <details class="field" ${c.service || c.partenariat || c.referent || c.projets || c.suite ? 'open' : ''}><summary><b>Suivi du partenariat</b> <small class="sub">(facultatif)</small></summary>
    <div class="two" style="margin-top:8px"><div class="field"><label for="c9">Service ou structure</label><select id="c9">${optionsListe('partenaires.services', c.service)}</select></div>
    <div class="field"><label for="c10">Type de partenariat</label><select id="c10">${optionsListe('partenaires.types', c.partenariat)}</select></div></div>
    <div class="field"><label for="c11">Référent <small class="sub">(personne à contacter)</small></label><input id="c11" maxlength="120" value="${esc(c.referent || '')}"></div>
    <div class="field"><label for="c12">Projets communs</label><input id="c12" maxlength="300" value="${esc(c.projets || '')}"></div>
    <div class="field"><label for="c13">Suite à donner</label><input id="c13" maxlength="200" value="${esc(c.suite || '')}"></div>${AVERT_PART}</details>
  <div class="quick" style="margin-top:14px"><button class="btn" id="saveC">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id ? '<button class="btn sec" data-action="part-fiche" data-id="' + esc(id) + '">Voir le suivi (échanges, conventions)</button><button class="btn ghost" id="delC" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  const maj = () => { $('#c7z').style.display = $('#c8').checked ? 'none' : ''; $('#c1z').style.display = $('#c8').checked ? 'none' : ''; $('#blocBen').style.display = $('#c2').value === P('annuaire.rubriques.activiteBenevole') ? '' : 'none'; }; $('#c8').onchange = maj; $('#c2').onchange = maj; maj();
  $('#saveC').onclick = async () => {
    const organisme = $('#c8').checked, nom = $('#c1').value.trim(), prenom = organisme ? '' : $('#c7').value.trim();
        if (organisme && !nom) return toast('Le nom de l\'organisme est nécessaire.');
        if (!organisme && !nom && !prenom) return toast('Le nom ou le prénom est nécessaire : complétez au moins l\'un des deux.');
    const categorie = $('#c2').value, precision = $('#c6').value.trim(), cle = cleNom(nomComplet({ nom, prenom }));
    // homonymes : même nom complet dans la même catégorie → la précision est obligatoire et doit les distinguer
    const memes = (await store.lire('contacts', ['categorie', '==', categorie])).map(normContact).filter(x => x.id !== id && cleNom(nomComplet(x)) === cle);
    if (memes.length && !precision) return toast(`Une autre personne porte déjà ce nom dans « ${categorie} » : ajoutez une précision (métier, organisme, ville…).`);
    if (memes.some(x => cleNom(x.precision) === cleNom(precision))) return toast(`${libelleContact({ nom, prenom, precision })} est déjà dans la liste « ${categorie} ».`);
    const doc = { ...(id ? { id } : {}), nom, prenom, organisme, precision, categorie, tel: $('#c3').value.trim(), email: $('#c4').value.trim(), note: $('#c5').value.trim(),
      service: $('#c9').value, partenariat: $('#c10').value, referent: $('#c11').value.trim(), projets: $('#c12').value.trim(), suite: $('#c13').value.trim() };
    // Bénévolat (lot E) : lu seulement si la catégorie est celle des bénévoles ; sinon les valeurs déjà enregistrées sont conservées telles quelles
    if (categorie === P('annuaire.rubriques.activiteBenevole')) {
      const an = anCourant(), gardees = (c.remerciements || []).filter(a => a < an - 2 || a > an);
      Object.assign(doc, { competences: $('#c14').value.trim(), dispoJours: [...document.querySelectorAll('.ben-jour:checked')].map(x => Number(x.value)), dispoPrecision: $('#c15').value.trim(), benMissions: $('#c16').value.trim(), reunions: $('#c17').value.trim(),
        remerciements: [...gardees, ...[...document.querySelectorAll('.ben-rem:checked')].map(x => Number(x.value))].sort((x, y) => x - y), inactif: $('#c18').checked });
    } else for (const k of ['competences', 'dispoJours', 'dispoPrecision', 'benMissions', 'reunions', 'remerciements', 'inactif']) if (c[k] !== undefined) doc[k] = c[k];
    const nid = await sauver('contacts', doc, 'Contact enregistré');
    if (id && libelleContact(c) !== libelleContact(doc)) await propager(c, { ...doc, id: nid });
    closeModal();
  };
  if (id) $('#delC').onclick = () => confirmer('Supprimer ce contact ?', `${libelleContact(c)} sort de la liste. Les activités et tâches où ce nom est déjà inscrit le gardent (historique).`, 'Supprimer', async () => {
    await mettreCorbeille('contacts', brut); await store.remove('contacts', id); toast('Contact mis à la corbeille');
  });
}
// Renommer un contact (ou changer sa précision) corrige aussi les rubriques où il est déjà inscrit : lien par identifiant ;
// pour les anciennes données (avant la 1.4.1, nom seul), on reprend le nom seulement s'il n'est partagé avec personne d'autre.
async function propager(ancien, nouveau) {
  const lib = libelleContact(nouveau), uniqueNom = S.cache.contacts.map(normContact).filter(x => x.categorie === ancien.categorie && cleNom(nomComplet(x)) === cleNom(nomComplet(ancien))).length <= 1;
  for (const r of Object.keys(RUBRIQUES)) {
    if (P('annuaire.rubriques.' + r) !== ancien.categorie) continue;
    const { col, champ } = RUBRIQUES[r], cleId = champ + 'Id';
    for (const d of await store.lire(col, [cleId, '==', ancien.id])) await store.save(col, { id: d.id, [champ]: lib });
  if (uniqueNom) for (const d of (await store.lire(col, [champ, '==', libelleContact(ancien)])).filter(x => !x[cleId])) await store.save(col, { id: d.id, [champ]: lib, [cleId]: ancien.id });
  }
  // échanges et conventions des partenaires : le nom affiché suit la fiche (lien par identifiant)
  for (const col of ['echanges', 'conventions']) for (const d of await store.lire(col, ['partenaireId', '==', ancien.id])) await store.save(col, { id: d.id, partenaire: lib });
}

export const actions = {
  'contact-form': el => contactForm(el.dataset.id),
  'filtre-contact': el => { S.filtreContact = el.dataset.v; render(); }
};
export const changes = {};
