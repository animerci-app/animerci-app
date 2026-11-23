// Paramètres modifiables par l'administratrice (rien n'est figé dans le code).
// Les valeurs enregistrées (collection « parametres », document « general ») l'emportent sur ces valeurs par défaut.
// Pour ajouter un paramètre : l'ajouter dans DEFAUTS, l'utiliser avec P('section.nom'), l'afficher dans le formulaire ci-dessous.
import { S, $, esc, toast, confirmer, sauver, render, peutAdmin } from './ui.js';
import { store } from './store.js';

export const DEFAUTS = {
  nomOutil: 'AniMerci',
  nomService: 'Service socioculturel',
  // Texte de l'affiche de la semaine (modifiable dans Paramètres)
  affiche: { lieu: '', pied: 'Inscriptions : renseignez-vous auprès du service' },
  listes: {
    categories: ['Créatif', 'Mémoire', 'Bien-être', 'Culture', 'Sortie', 'Événement', 'Activité physique', 'Repas'],
    budgets: ['Budget ville', 'Budget résidence', 'Forfait autonomie'],
    // Le PREMIER choix désigne « aucune difficulté » (non signalé sur les listes d'urgence)
    mobilites: ['Aucune difficulté', 'Besoin d\'un accompagnement', 'Transport à organiser']
  },
  // Annuaire : catégories de personnes, et quelle liste alimente quelle rubrique (voir RUBRIQUES dans annuaire.js)
  annuaire: {
    categories: ['Intervenant·e', 'Intervenant·e ponctuel·le', 'Intervenant·e religieux·se', 'Partenaire', 'Association partenaire', 'Partenaire institutionnel', 'Bénévole', 'Conduites et accompagnements', 'Collègue'],
    rubriques: { activiteIntervenant: 'Intervenant·e', activitePartenaire: 'Partenaire', activiteBenevole: 'Bénévole', tacheResponsable: 'Collègue' }
  },
  // Partenaires (lot C) : services et types proposés sur la fiche d'un partenaire, nom de la réunion mensuelle de l'équipe, délai d'alerte des conventions
  partenaires: {
    services: ['Halte-garderie municipale', 'Service jeunesse et CMJ', 'Service communication', 'Médiathèque', 'Services techniques', 'Accueil de la mairie', 'CCAS', 'Ressources humaines'],
    types: ['Service municipal', 'Association locale', 'Association extérieure', 'Autre commune', 'Partenaire institutionnel', 'Établissement ou structure', 'Prestataire', 'Organisme de formation', 'Intervenant·e'],
    reunionMensuelle: 'Réunion mensuelle de l\'équipe de la résidence',
    alerteJours: 30
  },
  // Matériel (lot A) : listes de choix, unités, délai d'alerte de péremption. Les « états » (bon, usé, à réparer, manquant, hors d'usage) sont fixes : les alertes en dépendent.
  materiel: {
    categories: ['Vaisselle', 'Assiettes', 'Verres', 'Tasses', 'Bols', 'Couverts', 'Plateaux', 'Nappes', 'Décorations', 'Matériel créatif', 'Matériel de loisirs', 'Équipements'],
    categoriesReserves: ['Café', 'Thé', 'Sucre', 'Eau', 'Jus', 'Biscuits', 'Denrées non périssables', 'Fournitures pour événements'],
    emplacements: ['Armoire de la salle d\'activités', 'Local de rangement', 'Cuisine', 'Réserve'],
    saisons: ['Noël', 'Printemps', 'Été', 'Automne', 'Banquet', 'Repas festifs'],
    unites: ['unité(s)', 'kg', 'g', 'L', 'cl', 'boîte(s)', 'paquet(s)', 'sachet(s)', 'bouteille(s)', 'rouleau(x)', 'lot(s)'],
    alertePeremptionJours: 30
  },
  // Lieux de vie : le nom de la résidence (pour les résident·es) et la commune proposée à l'inscription d'un·e adhérent·e
  residence: { nom: '', adresse: '' },
  commune: { defaut: '' },
  adhesion: { montantDefaut: 40, relanceMois: 12, modes: ['Espèces', 'Chèque', 'Virement', 'Autre'] },
  verification: { mois: 12 },
  securite: { joursCorbeille: 30, joursJournal: 365, rappelSauvegardeJours: 30, motDePasseMin: 12, horizonEmargementJours: 14 },
  // Modules facultatifs (le planning, les activités et les personnes sont toujours actifs)
  modules: { taches: true, bilans: true }
};
// Bornes acceptées pour les nombres (une valeur hors bornes est ignorée au profit de la valeur par défaut)
const BORNES = { 'adhesion.montantDefaut': [0, 1000], 'adhesion.relanceMois': [1, 12], 'verification.mois': [1, 36], 'securite.joursCorbeille': [1, 365], 'securite.joursJournal': [30, 1095], 'securite.rappelSauvegardeJours': [1, 365], 'securite.motDePasseMin': [8, 64], 'securite.horizonEmargementJours': [1, 90], 'partenaires.alerteJours': [1, 365], 'materiel.alertePeremptionJours': [1, 365] };

const lire = (obj, chemin) => chemin.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
export function P(chemin) {
  const defaut = lire(DEFAUTS, chemin), stocke = lire(S.cache.parametres.find(x => x.id === 'general') || {}, chemin);
  if (stocke === undefined || stocke === null) return defaut;
  if (Array.isArray(defaut)) return Array.isArray(stocke) && stocke.length && stocke.every(x => typeof x === 'string' && x.trim()) ? stocke : defaut;
  if (typeof defaut === 'number') { const [a, b] = BORNES[chemin] || [-Infinity, Infinity]; return typeof stocke === 'number' && isFinite(stocke) && stocke >= a && stocke <= b ? stocke : defaut; }
  if (typeof defaut === 'boolean') return typeof stocke === 'boolean' ? stocke : defaut;
  return typeof stocke === 'string' && stocke.trim() ? stocke.trim() : defaut;
}
export const moduleActif = nom => P('modules.' + nom) !== false;

const RUBR_LABELS = { activiteIntervenant: 'Activité : intervenant·e', activitePartenaire: 'Activité : partenaire', activiteBenevole: 'Activité : bénévole référent·e', tacheResponsable: 'Tâche : responsable' };
const lignes = id => [...new Set($(id).value.split('\n').map(x => x.trim()).filter(Boolean))];
export function parametres() {
  const num = (id, ch, lab, aide) => `<div class="field"><label for="${id}">${lab}</label><input id="${id}" type="number" value="${esc(P(ch))}" min="${BORNES[ch][0]}" max="${BORNES[ch][1]}">${aide ? `<small class="sub">${aide}</small>` : ''}</div>`;
  const liste = (id, ch, lab, aide) => `<div class="field"><label for="${id}">${lab}</label><textarea id="${id}" rows="6">${esc(P(ch).join('\n'))}</textarea><small class="sub">${aide}</small></div>`;
  return `<div class="top"><div><h1>Paramètres</h1><p>Adapter l'outil sans toucher au programme. Les changements s'appliquent à toute l'équipe.</p></div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Noms</h2><div class="two">
    <div class="field"><label for="p-nom">Nom de l'outil</label><input id="p-nom" value="${esc(P('nomOutil'))}"></div>
    <div class="field"><label for="p-svc">Nom du service</label><input id="p-svc" value="${esc(P('nomService'))}"></div>
    <div class="field"><label for="p-aff-l">Affiche de la semaine : ligne sous le titre</label><input id="p-aff-l" value="${esc(P('affiche.lieu'))}" placeholder="ex. nom du service et de la commune"></div>
    <div class="field"><label for="p-aff-p">Affiche de la semaine : bas de page</label><input id="p-aff-p" value="${esc(P('affiche.pied'))}"></div></div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Lieux de vie</h2><div class="two">
    <div class="field"><label for="p-res">Nom de la résidence</label><input id="p-res" value="${esc(P('residence.nom'))}" placeholder="où habitent les résident·es"><small class="sub">Les résident·es n'ont ni adresse ni commune à saisir : leur lieu de vie est cette résidence.</small></div>
    <div class="field"><label for="p-resadr">Adresse de la résidence</label><input id="p-resadr" value="${esc(P('residence.adresse'))}" placeholder="numéro, rue, code postal, commune"><small class="sub">À l'import d'une liste, une personne qui habite cette adresse est classée « Résident·e » automatiquement.</small></div>
    <div class="field"><label for="p-com">Commune proposée à l'inscription</label><input id="p-com" value="${esc(P('commune.defaut'))}" placeholder="commune du service"><small class="sub">Proposée sur la fiche d'un·e adhérent·e, modifiable pour les personnes d'autres communes.</small></div></div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Listes de choix</h2>
    ${liste('p-cats', 'listes.categories', 'Catégories d\'activités', 'Une par ligne. Les activités déjà créées gardent leur catégorie.')}
    ${liste('p-bud', 'listes.budgets', 'Budgets', 'Une par ligne.')}
    ${liste('p-mob', 'listes.mobilites', 'Déplacements (fiche de sortie)', 'Une par ligne. <b>Le premier choix</b> signifie « aucune difficulté ». <b>✔ À mettre</b> : des choix d\'organisation (« transport à organiser », « besoin d\'un accompagnement »). <b>✘ À ne pas mettre</b> : toute information de santé (maladie, handicap, matériel médical…).')}</div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Annuaire</h2>
    ${liste('p-ann', 'annuaire.categories', 'Catégories de l\'annuaire', 'Une par ligne (ex. Intervenant·e, Partenaire, Bénévole, Collègue, Fournisseur…). Les contacts déjà créés gardent leur catégorie ; renommer une catégorie ne les déplace pas.')}
    <p class="sub" style="margin:0 0 8px">Quelle liste alimente quelle rubrique ? (Enregistrez d'abord les catégories, puis choisissez.)</p><div class="two">
    ${Object.entries(RUBR_LABELS).map(([k, l]) => `<div class="field"><label for="p-r-${k}">${l}</label><select id="p-r-${k}">${P('annuaire.categories').concat(P('annuaire.rubriques.' + k)).filter((v, i, t) => t.indexOf(v) === i).map(c => `<option ${P('annuaire.rubriques.' + k) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`).join('')}</div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Partenaires</h2>
    ${liste('p-psv', 'partenaires.services', 'Services et structures', 'Une par ligne (services municipaux, associations…). Proposés sur la fiche d\'un partenaire et dans les filtres du comptage annuel.')}
    ${liste('p-pty', 'partenaires.types', 'Types de partenariat', 'Une par ligne.')}
    <div class="two"><div class="field"><label for="p-reu">Nom de la réunion mensuelle de l'équipe</label><input id="p-reu" value="${esc(P('partenaires.reunionMensuelle'))}"><small class="sub">Utilisé par « Planifier la série mensuelle » (écran Partenaires › Réunions).</small></div>
    ${num('p-pal', 'partenaires.alerteJours', 'Alerte « convention » avant l\'échéance (jours)')}</div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Matériel et réserves</h2>
    ${liste('p-mca', 'materiel.categories', 'Catégories du matériel (inventaire)', 'Une par ligne. Les articles déjà créés gardent leur catégorie.')}
    ${liste('p-mcr', 'materiel.categoriesReserves', 'Catégories des réserves', 'Une par ligne (café, thé, boissons, fournitures…).')}
    ${liste('p-mem', 'materiel.emplacements', 'Emplacements proposés', 'Une par ligne (armoire, local, étagère…). Proposés en tapant ; un autre emplacement peut toujours être écrit à la main.')}
    ${liste('p-msa', 'materiel.saisons', 'Saisons et occasions des caisses de décorations', 'Une par ligne (Noël, Printemps, Banquet…).')}
    ${liste('p-mun', 'materiel.unites', 'Unités des réserves', 'Une par ligne (kg, L, boîte(s)…).')}
    <div class="two">${num('p-mpe', 'materiel.alertePeremptionJours', 'Alerte « péremption proche » (jours avant la date)')}</div>
    <p class="sub" style="margin:0">✔ <b>À écrire</b> : des noms d'objets et de lieux de rangement. ✘ <b>À ne pas écrire</b> : toute information de santé. Les états du matériel (bon état, usé, à réparer, manquant, hors d'usage) ne se modifient pas : les alertes en dépendent.</p></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Adhésion, vérification des fiches et sécurité</h2>
    ${liste('p-mdr', 'adhesion.modes', 'Modes de règlement de la cotisation', 'Une par ligne (espèces, chèque, virement…).')}<div class="two">
    ${num('p-cot', 'adhesion.montantDefaut', 'Montant de la cotisation proposé (€)')}
    ${num('p-rel', 'adhesion.relanceMois', 'Début des relances de renouvellement (mois, 1 à 12)', 'À partir du 1er de ce mois, l\'accueil signale les adhésions à renouveler pour l\'année suivante. 12 = décembre. Une adhésion couvre l\'année civile.')}
    ${num('p-ver', 'verification.mois', 'Vérification des fiches après (mois)', 'Une fiche non vérifiée depuis ce délai apparaît dans « Personnes » → Vérification.')}
    ${num('p-pw', 'securite.motDePasseMin', 'Longueur minimale du mot de passe', 'Au moins 8. Une personne dont le mot de passe est plus court est invitée à le changer à la connexion.')}
    ${num('p-corb', 'securite.joursCorbeille', 'Durée de la corbeille (jours)')}
    ${num('p-jour', 'securite.joursJournal', 'Durée de conservation du journal (jours)')}
    ${num('p-rap', 'securite.rappelSauvegardeJours', 'Rappel de sauvegarde après (jours)')}
    ${num('p-hor', 'securite.horizonEmargementJours', 'Feuilles de présence : horizon (jours)')}</div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Modules</h2>
    <label class="chk" style="margin:4px 0"><input type="checkbox" id="p-m-taches" ${moduleActif('taches') ? 'checked' : ''}> Tâches et rappels</label>
    <label class="chk" style="margin:4px 0"><input type="checkbox" id="p-m-bilans" ${moduleActif('bilans') ? 'checked' : ''}> Bilans et statistiques</label>
    <p class="sub" style="margin:6px 0 0">Un module désactivé disparaît du menu ; ses données restent conservées.</p></div>
  <div class="quick"><button class="btn" data-action="param-save">Enregistrer les paramètres</button><button class="btn ghost" data-action="param-reset">Revenir aux valeurs d'origine</button></div>`;
}
const val = (id, ch) => { const v = Number($(id).value); const [a, b] = BORNES[ch]; if (!isFinite(v) || v < a || v > b) throw new Error(`Valeur à corriger : entre ${a} et ${b}.`); return v; };
export const actions = {
  'param-save': async () => {
    if (!peutAdmin()) return;
    const cats = lignes('#p-cats'), bud = lignes('#p-bud'), mob = lignes('#p-mob'), ann = lignes('#p-ann'), psv = lignes('#p-psv'), pty = lignes('#p-pty');
    const mdr = lignes('#p-mdr'), mca = lignes('#p-mca'), mcr = lignes('#p-mcr'), mem = lignes('#p-mem'), msa = lignes('#p-msa'), mun = lignes('#p-mun');
    if (!cats.length || !bud.length || !mob.length || !ann.length || !psv.length || !pty.length || !mca.length || !mcr.length || !mem.length || !msa.length || !mun.length || !mdr.length) return toast('Chaque liste doit contenir au moins un choix.');
    await sauver('parametres', {
      id: 'general', nomOutil: $('#p-nom').value.trim() || DEFAUTS.nomOutil, nomService: $('#p-svc').value.trim() || DEFAUTS.nomService,
      affiche: { lieu: $('#p-aff-l').value.trim(), pied: $('#p-aff-p').value.trim() || DEFAUTS.affiche.pied },
      residence: { nom: $('#p-res').value.trim(), adresse: $('#p-resadr').value.trim() }, commune: { defaut: $('#p-com').value.trim() },
      listes: { categories: cats, budgets: bud, mobilites: mob },
      annuaire: { categories: ann, rubriques: Object.fromEntries(Object.keys(RUBR_LABELS).map(k => [k, ann.includes($('#p-r-' + k).value) ? $('#p-r-' + k).value : ann[0]])) },
      adhesion: { montantDefaut: val('#p-cot', 'adhesion.montantDefaut'), relanceMois: val('#p-rel', 'adhesion.relanceMois'), modes: mdr },
      verification: { mois: val('#p-ver', 'verification.mois') },
      partenaires: { services: psv, types: pty, reunionMensuelle: $('#p-reu').value.trim() || DEFAUTS.partenaires.reunionMensuelle, alerteJours: val('#p-pal', 'partenaires.alerteJours') },
      materiel: { categories: mca, categoriesReserves: mcr, emplacements: mem, saisons: msa, unites: mun, alertePeremptionJours: val('#p-mpe', 'materiel.alertePeremptionJours') },
      securite: { motDePasseMin: val('#p-pw', 'securite.motDePasseMin'), joursCorbeille: val('#p-corb', 'securite.joursCorbeille'), joursJournal: val('#p-jour', 'securite.joursJournal'), rappelSauvegardeJours: val('#p-rap', 'securite.rappelSauvegardeJours'), horizonEmargementJours: val('#p-hor', 'securite.horizonEmargementJours') },
      modules: { taches: $('#p-m-taches').checked, bilans: $('#p-m-bilans').checked }
    }, 'Paramètres enregistrés');
    render();
  },
  'param-reset': () => confirmer('Revenir aux valeurs d\'origine ?', 'Tous les paramètres retrouvent leur valeur par défaut. Vos données (personnes, activités…) ne changent pas.', 'Rétablir', async () => { await store.remove('parametres', 'general'); toast('Valeurs d\'origine rétablies'); })
};
