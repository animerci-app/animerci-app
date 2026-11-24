// Paramètres modifiables par l'administratrice (rien n'est figé dans le code).
// Les valeurs enregistrées (collection « parametres », document « general ») l'emportent sur ces valeurs par défaut.
// Pour ajouter un paramètre : l'ajouter dans DEFAUTS, l'utiliser avec P('section.nom'), l'afficher dans le formulaire ci-dessous.
import { S, $, esc, toast, confirmer, sauver, render, peutAdmin } from './ui.js';
import { store } from './store.js';
import * as L from './logic.js';

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
  // Portage de repas (lot B) : nom de l'entreprise de restauration (jamais dans le code) et motifs d'organisation proposés pour une interruption ou un arrêt. Aucun motif de santé.
  portage: {
    prestataire: '',
    motifs: ['Absence temporaire (vacances ou autre)', 'Changement de rythme de livraison', 'Demande de la personne ou de ses proches', 'Changement de lieu de vie', 'Fin du service à l\'initiative de la personne', 'Fin du service à l\'initiative du service', 'Autre motif d\'organisation']
  },
  // Accueils (lot E) : jeunes adultes (bourse), services civiques, stagiaires. « États du dossier » = suivi administratif de la bourse (aucune information de santé).
  accueils: {
    etatsDossier: ['Dossier à constituer', 'Dossier déposé', 'Dossier validé', 'Bourse versée'],
    objectifHeures: 50, montantBourse: 500, seuilRetardHeures: 10, alerteJours: 30
  },
  // Budgets et dépenses (lot D) : les budgets eux-mêmes sont « listes.budgets » (déjà utilisés sur la fiche d'activité). Dispositifs de financement, seuil d'alerte « budget bientôt épuisé ».
  budgets: { dispositifs: ['Aucun', 'Forfait autonomie', 'Subvention CCAS', 'Autre dispositif'], seuilAlertePourcent: 10 },
  // Régie (lot D) : types d'opérations et modes de règlement réglables (aucune intégration technique de la future borne de paiement par carte : seulement un choix dans la liste).
  regie: { types: ['Chèque à transmettre au Trésor public', 'Dépôt d\'espèces', 'Document à préparer', 'Suivi mensuel', 'Autre opération'], modes: ['Espèces', 'Chèque', 'Virement', 'Carte (borne)', 'Autre'], alerteJours: 15 },
  // Questionnaires et sondages (lot J) : thèmes proposés. Diffusion papier ou e-mail (texte à copier-coller) ; aucun lien en ligne.
  questionnaires: { themes: ['Satisfaction des animations', 'Attentes des seniors', 'Portage de repas', 'Sorties', 'Banquet', 'Programme annuel', 'Événements'] },
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
  modules: { taches: true, bilans: true, portage: true, accueils: true, budgets: true, questionnaires: true, voyages: true }
};
// Bornes acceptées pour les nombres (une valeur hors bornes est ignorée au profit de la valeur par défaut)
const BORNES = { 'accueils.objectifHeures': [1, 1000], 'accueils.montantBourse': [0, 10000], 'accueils.seuilRetardHeures': [1, 200], 'accueils.alerteJours': [1, 365], 'adhesion.montantDefaut': [0, 1000], 'adhesion.relanceMois': [1, 12], 'verification.mois': [1, 36], 'securite.joursCorbeille': [1, 365], 'securite.joursJournal': [30, 1095], 'securite.rappelSauvegardeJours': [1, 365], 'securite.motDePasseMin': [8, 64], 'securite.horizonEmargementJours': [1, 90], 'partenaires.alerteJours': [1, 365], 'materiel.alertePeremptionJours': [1, 365], 'budgets.seuilAlertePourcent': [1, 100], 'regie.alerteJours': [1, 365] };

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
  // Catégories d'activités (v1.23.0) : affichées par ordre alphabétique (accents français), comme les sections de l'écran Activités qui s'y réfèrent.
  const listeTriee = (id, ch, lab, aide) => `<div class="field"><label for="${id}">${lab}</label><textarea id="${id}" rows="6">${esc(P(ch).slice().sort(L.comparerTexte).join('\n'))}</textarea><small class="sub">${aide}</small></div>`;
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
    ${listeTriee('p-cats', 'listes.categories', 'Catégories d\'activités', 'Une par ligne, affichées par ordre alphabétique (ordre repris dans les sections de l\'écran Activités). Les activités déjà créées gardent leur catégorie.')}
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
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Portage de repas</h2>
    <div class="field"><label for="p-pgp">Entreprise de restauration (prestataire)</label><input id="p-pgp" value="${esc(P('portage.prestataire'))}" placeholder="nom de l'entreprise qui livre les repas"><small class="sub">Proposé automatiquement dans les échanges avec le prestataire (Portage › Échanges). Il peut être corrigé échange par échange.</small></div>
    ${liste('p-pgm', 'portage.motifs', 'Motifs d\'interruption ou d\'arrêt', '<b>Une par ligne.</b> <b>✔ À mettre</b> : des motifs d\'organisation (« absence temporaire », « changement de rythme de livraison », « demande de la personne »). <b>✘ À ne pas mettre</b> : tout motif de santé (hospitalisation, maladie, décès…). L\'outil organise le service, il ne suit pas les soins.')}</div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Accueils (jeunes adultes, services civiques, stagiaires)</h2>
    ${liste('p-aed', 'accueils.etatsDossier', 'États du dossier de la bourse', 'Une par ligne, dans l\'ordre de la démarche (ex. dossier à constituer, déposé, validé, bourse versée). Suivi administratif seulement.')}
    <div class="two">${num('p-aoh', 'accueils.objectifHeures', 'Objectif d\'heures proposé (bourse)')}
    ${num('p-amb', 'accueils.montantBourse', 'Montant de la bourse proposé (€)')}
    ${num('p-ash', 'accueils.seuilRetardHeures', 'Alerte « en retard » à partir de (heures d\'écart)', 'Écart entre les heures validées et les heures attendues à ce jour (au prorata de la période de mission).')}
    ${num('p-aaj', 'accueils.alerteJours', 'Alerte conventions et bilans avant l\'échéance (jours)')}</div>
    <p class="sub" style="margin:0">✔ <b>À écrire</b> : des éléments d'organisation (missions, horaires, lieux, rendez-vous de suivi). ✘ <b>À ne pas écrire</b> : toute information de santé ou de situation personnelle sensible.</p></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Budgets et dépenses</h2>
    <p class="sub" style="margin:0 0 8px">Les budgets eux-mêmes (ville, résidence, forfait autonomie…) se règlent dans « Listes de choix » ci-dessus (liste « Budgets »), car ils sont aussi proposés sur la fiche d'une activité. Le montant initial de chaque budget se règle directement dans l'écran Budgets.</p>
    ${liste('p-bdi', 'budgets.dispositifs', 'Dispositifs de financement', 'Une par ligne (ex. forfait autonomie, subvention CCAS, aucun).')}
    <div class="two">${num('p-bse', 'budgets.seuilAlertePourcent', 'Alerte « budget bientôt épuisé » (pourcentage restant)')}</div>
    <p class="sub" style="margin:0">Ce suivi est interne : il ne remplace pas le logiciel comptable officiel ni les procédures de la collectivité (à faire valider par le service financier).</p></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Régie</h2>
    ${liste('p-rty', 'regie.types', 'Types d\'opérations de régie', 'Une par ligne (ex. chèque à transmettre au Trésor public, dépôt d\'espèces, document à préparer, suivi mensuel).')}
    ${liste('p-rmo', 'regie.modes', 'Modes de règlement', 'Une par ligne. « Carte (borne) » est prévu pour la future borne de paiement : aucune intégration technique pour l\'instant.')}
    <div class="two">${num('p-raj', 'regie.alerteJours', 'Alerte « échéance proche » (jours avant la date)')}</div></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Questionnaires et sondages</h2>
    ${liste('p-qth', 'questionnaires.themes', 'Thèmes proposés', 'Une par ligne (ex. satisfaction des animations, attentes des seniors, sorties, banquet…). Proposés à la création d\'un questionnaire.')}
    <p class="sub" style="margin:0">Diffusion papier (impression) ou e-mail (texte à copier-coller) : aucun envoi automatique, aucun lien en ligne. Les réponses reçues (papier, e-mail ou orales) sont saisies une par une par l'administratrice.</p></div>
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
    <label class="chk" style="margin:4px 0"><input type="checkbox" id="p-m-portage" ${moduleActif('portage') ? 'checked' : ''}> Portage de repas (accessible à l'administratrice et à l'équipe)</label>
    <label class="chk" style="margin:4px 0"><input type="checkbox" id="p-m-accueils" ${moduleActif('accueils') ? 'checked' : ''}> Accueils : jeunes adultes (bourse), services civiques, stagiaires (administratrice seule)</label>
    <label class="chk" style="margin:4px 0"><input type="checkbox" id="p-m-budgets" ${moduleActif('budgets') ? 'checked' : ''}> Budgets et régie (accessible à l'administratrice et à l'équipe si l'accès est coché)</label>
    <label class="chk" style="margin:4px 0"><input type="checkbox" id="p-m-questionnaires" ${moduleActif('questionnaires') ? 'checked' : ''}> Questionnaires et sondages (administratrice seule)</label>
    <label class="chk" style="margin:4px 0"><input type="checkbox" id="p-m-voyages" ${moduleActif('voyages') ? 'checked' : ''}> Bibliothèque des voyages et sorties (administratrice seule)</label>
    <p class="sub" style="margin:6px 0 0">Un module désactivé disparaît du menu ; ses données restent conservées.</p></div>
  <div class="quick"><button class="btn" data-action="param-save">Enregistrer les paramètres</button><button class="btn ghost" data-action="param-reset">Revenir aux valeurs d'origine</button></div>`;
}
const val = (id, ch) => { const v = Number($(id).value); const [a, b] = BORNES[ch]; if (!isFinite(v) || v < a || v > b) throw new Error(`Valeur à corriger : entre ${a} et ${b}.`); return v; };
export const actions = {
  'param-save': async () => {
    if (!peutAdmin()) return;
    const cats = lignes('#p-cats'), bud = lignes('#p-bud'), mob = lignes('#p-mob'), ann = lignes('#p-ann'), psv = lignes('#p-psv'), pty = lignes('#p-pty');
    const aed = lignes('#p-aed'), mdr = lignes('#p-mdr'), mca = lignes('#p-mca'), mcr = lignes('#p-mcr'), mem = lignes('#p-mem'), msa = lignes('#p-msa'), mun = lignes('#p-mun'), pgm = lignes('#p-pgm');
    const bdi = lignes('#p-bdi'), rty = lignes('#p-rty'), rmo = lignes('#p-rmo'), qth = lignes('#p-qth');
    if (!cats.length || !bud.length || !mob.length || !ann.length || !psv.length || !pty.length || !mca.length || !mcr.length || !mem.length || !msa.length || !mun.length || !mdr.length || !pgm.length || !aed.length || !bdi.length || !rty.length || !rmo.length || !qth.length) return toast('Chaque liste doit contenir au moins un choix.');
    await sauver('parametres', {
      id: 'general', nomOutil: $('#p-nom').value.trim() || DEFAUTS.nomOutil, nomService: $('#p-svc').value.trim() || DEFAUTS.nomService,
      affiche: { lieu: $('#p-aff-l').value.trim(), pied: $('#p-aff-p').value.trim() || DEFAUTS.affiche.pied },
      residence: { nom: $('#p-res').value.trim(), adresse: $('#p-resadr').value.trim() }, commune: { defaut: $('#p-com').value.trim() },
      listes: { categories: cats, budgets: bud, mobilites: mob },
      annuaire: { categories: ann, rubriques: Object.fromEntries(Object.keys(RUBR_LABELS).map(k => [k, ann.includes($('#p-r-' + k).value) ? $('#p-r-' + k).value : ann[0]])) },
      adhesion: { montantDefaut: val('#p-cot', 'adhesion.montantDefaut'), relanceMois: val('#p-rel', 'adhesion.relanceMois'), modes: mdr },
      verification: { mois: val('#p-ver', 'verification.mois') },
      partenaires: { services: psv, types: pty, reunionMensuelle: $('#p-reu').value.trim() || DEFAUTS.partenaires.reunionMensuelle, alerteJours: val('#p-pal', 'partenaires.alerteJours') },
      portage: { prestataire: $('#p-pgp').value.trim(), motifs: pgm },
      accueils: { etatsDossier: aed, objectifHeures: val('#p-aoh', 'accueils.objectifHeures'), montantBourse: val('#p-amb', 'accueils.montantBourse'), seuilRetardHeures: val('#p-ash', 'accueils.seuilRetardHeures'), alerteJours: val('#p-aaj', 'accueils.alerteJours') },
      materiel: { categories: mca, categoriesReserves: mcr, emplacements: mem, saisons: msa, unites: mun, alertePeremptionJours: val('#p-mpe', 'materiel.alertePeremptionJours') },
      budgets: { dispositifs: bdi, seuilAlertePourcent: val('#p-bse', 'budgets.seuilAlertePourcent') },
      regie: { types: rty, modes: rmo, alerteJours: val('#p-raj', 'regie.alerteJours') },
      questionnaires: { themes: qth },
      securite: { motDePasseMin: val('#p-pw', 'securite.motDePasseMin'), joursCorbeille: val('#p-corb', 'securite.joursCorbeille'), joursJournal: val('#p-jour', 'securite.joursJournal'), rappelSauvegardeJours: val('#p-rap', 'securite.rappelSauvegardeJours'), horizonEmargementJours: val('#p-hor', 'securite.horizonEmargementJours') },
      modules: { taches: $('#p-m-taches').checked, bilans: $('#p-m-bilans').checked, portage: $('#p-m-portage').checked, accueils: $('#p-m-accueils').checked, budgets: $('#p-m-budgets').checked, questionnaires: $('#p-m-questionnaires').checked, voyages: $('#p-m-voyages').checked }
    }, 'Paramètres enregistrés');
    render();
  },
  'param-reset': () => confirmer('Revenir aux valeurs d\'origine ?', 'Tous les paramètres retrouvent leur valeur par défaut. Vos données (personnes, activités…) ne changent pas.', 'Rétablir', async () => { await store.remove('parametres', 'general'); toast('Valeurs d\'origine rétablies'); })
};
