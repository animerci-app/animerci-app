// Quelles données charger, selon l'écran ouvert ? (économie du quota gratuit de lectures Firestore)
// Règle : on ne lit que ce que l'écran affiche. Les listes déjà chargées restent en mémoire pendant la session.
// Fonction pure (sans accès à Firebase) : elle décrit les « abonnements » souhaités, app.js les crée une seule fois.

// Premier et dernier jour d'un mois (AAAA-MM-JJ), mois de 0 à 11
export function bornesMois(a, m) {
  const p = n => String(n).padStart(2, '0');
  return [`${a}-${p(m + 1)}-01`, `${a}-${p(m + 1)}-${p(new Date(a, m + 1, 0).getDate())}`];
}

// c : { anPart (année affichée dans Partenaires), partId (fiche d'un partenaire ouverte), nbMois (planning : 1 à 3), horizonSorties (date limite pour l'alerte « fiches de sortie à compléter »), role, view, actId, mois:{a,m}, stat:{du,au}, onglet, auj, activites:[], mesActivites:[],
//      acces ({materiel, portage, inscriptions} : accès actifs de l'équipe), inscrActId (activité choisie à l'écran de saisie des inscriptions), ongletAccueils, decembre (vrai en décembre), categorieBenevole,
//      ongletPortage, anPortage (onglet et année du Portage), portageActif (module non désactivé),
//      ongletMat (onglet du Matériel), anMat (année des emprunts rendus), matHisto (article dont l'historique est ouvert), matPersonnes (liste d'emprunteurs ouverte), horizonPeremption (date limite de l'alerte « péremption proche ») }
//      questActId (fiche de résultats d'un questionnaire ouverte, lot J)
export function besoins(c) {
  const B = [];
  const add = (col, key, filtre, opts) => B.push({ col, key, filtre: filtre || null, opts: opts || null });
  if (!c.role) return B;
  add('parametres', 'all');
  // Accès de l'équipe : l'administratrice a tout ; intervenant·es et bénévoles seulement ce que l'administratrice a coché (et dont la date de fin n'est pas passée)
  const peut = m => c.role === 'admin' || !!(c.acces && c.acces[m]);
  // Matériel (lot A) : toute l'équipe (administratrice, intervenant·es, bénévoles) lit et saisit. Les emprunts non rendus sont toujours chargés (ils servent au « disponible » et aux retards) ;
  // les emprunts rendus de l'année seulement dans l'onglet Emprunts ; l'historique d'un article seulement à l'ouverture de cet historique.
  const materiel = () => {
    if (c.view !== 'materiel' || !peut('materiel')) return;
    add('materiel', 'all'); add('emprunts', 'ouverts', ['rendu', '==', false]);
    if (c.ongletMat === 'emprunts') { const an = c.anMat || c.auj.slice(0, 4); add('emprunts', `rendus-${an}`, [['retourReel', '>=', `${an}-01-01`], ['retourReel', '<=', `${an}-12-31`]]); }
    if (c.matHisto) add('mouvements', 'm-' + c.matHisto, ['materielId', '==', c.matHisto]);
    if (c.role === 'admin' && c.matPersonnes) { add('seniors', 'all'); add('contacts', 'all'); add('users', 'all'); } // liste d'emprunteurs : seule l'administratrice lit ces listes
  };
  // Portage de repas (lot B) : l'administratrice et l'équipe suivent les bénéficiaires (un document par bénéficiaire) ; les échanges avec le prestataire sont lus par année affichée.
  // L'administratrice charge aussi les fiches : l'ouverture du Portage met les documents en accord avec les fiches (nouveaux bénéficiaires, jours modifiés).
  const portage = () => {
    if (c.view !== 'portage' || c.portageActif === false || !peut('portage')) return;
    add('portage', 'all');
    if (c.ongletPortage === 'echanges') { const an = c.anPortage || c.auj.slice(0, 4); add('portageEchanges', `an-${an}`, [['date', '>=', `${an}-01-01`], ['date', '<=', `${an}-12-31`]]); }
    if (c.role === 'admin') add('seniors', 'all');
  };
  // Budgets et régie (lot D) : l'administratrice et l'équipe (si l'accès est coché) lisent les dépenses et opérations de l'année affichée (une par écran).
  const budgets = () => {
    if (c.budgetsActif === false || !peut('budgets')) return;
    if (c.view === 'budgets') { const an = c.anBudgets || c.auj.slice(0, 4); add('depenses', `an-${an}`, [['date', '>=', `${an}-01-01`], ['date', '<=', `${an}-12-31`]]); }
    if (c.view === 'regie') { const an = c.anRegie || c.auj.slice(0, 4); add('regie', `an-${an}`, [['date', '>=', `${an}-01-01`], ['date', '<=', `${an}-12-31`]]); }
  };
  // Saisie des inscriptions reçues sur papier ou par téléphone (bénévoles cochés) : liste restreinte des personnes (seniorsLite) et inscriptions de l'activité choisie
  const inscrire = () => {
    if (c.view !== 'inscrire' || !peut('inscriptions') || c.role !== 'benevole') return;
    add('seniorsLite', 'all');
    if (c.inscrActId) add('inscriptions', c.inscrActId, ['activiteId', '==', c.inscrActId]);
  };
  if (c.role === 'benevole') { add('activites', 'all'); materiel(); portage(); budgets(); inscrire(); return B; }
  if (c.role === 'intervenant') {
    add('activites', 'all'); materiel(); portage(); budgets();
    for (const id of c.mesActivites || []) { add('inscriptions', id, ['activiteId', '==', id]); add('seances', id, ['activiteId', '==', id]); }
    return B;
  }
  // Partenaire (accès ouvert par l'administratrice, par exemple pour un essai) : uniquement ses propres échanges
  if (c.role === 'partenaire') { if (c.uid) add('echanges', 'mes', ['parUid', '==', c.uid]); return B; }
  if (c.role !== 'admin') return B;
  add('activites', 'all'); add('taches', 'all');
  const v = c.view;
  // Recherche globale (loupe du menu) : les personnes et l'annuaire sont chargés à la première utilisation
  if (c.rechGlobale) { add('seniors', 'all'); add('contacts', 'all'); }
  if (v === 'home') {
    add('inscriptions', 'attente', ['statut', '==', 'attente']);
    add('seances', 'avalider', ['valide', '==', false]);
    // Alertes « partenaires » : suites à donner, réunions prévues, conventions (petites listes)
    // Alertes « accueils » (conventions, bilans, heures de la bourse) : les accueils non clos ; les bénévoles de l'Annuaire seulement en décembre (remerciements)
    add('accueils', 'ouverts', ['clos', '==', false]); if (c.decembre) add('contacts', 'all');
    add('echanges', 'suites', ['suiteAFaire', '==', true]); add('echanges', 'prevus', ['etat', '==', 'prevu']); add('conventions', 'all');
    // Alertes « matériel » : seulement les articles concernés (stock bas, manquant, péremption proche) et les emprunts non rendus : requêtes d'égalité ou de plage sur un seul champ, sans index à créer
    if (c.horizonPeremption) { add('materiel', 'bas', ['bas', '==', true]); add('materiel', 'manquant', ['manquant', '==', true]); add('materiel', 'peremp-' + c.horizonPeremption, [['echeance', '>', '0'], ['echeance', '<=', c.horizonPeremption]]); add('emprunts', 'ouverts', ['rendu', '==', false]); }
    // Alerte « portage » : reprises prévues dépassées (bénéficiaires interrompus) et suites à donner au prestataire : deux petites listes
    if (c.portageActif !== false) { add('portage', 'interrompus', ['etat', '==', 'interrompu']); add('portageEchanges', 'suites', ['suiteAFaire', '==', true]); }
    for (const a of c.activites || []) if (a.type === 'sortie' && a.date && a.date >= c.auj && a.date <= c.horizonSorties) { add('inscriptions', a.id, ['activiteId', '==', a.id]); add('fiches', a.id, ['activiteId', '==', a.id]); }
  }
  if (v === 'seniors' || v === 'bilans' || v === 'activite') add('seniors', 'all');
  if (v === 'activite' && c.actId) { for (const col of ['inscriptions', 'seances', 'fiches']) add(col, c.actId, ['activiteId', '==', c.actId]); }
  if (v === 'planning' && c.mois) {
    // 1 à 3 mois affichés : une seule lecture couvrant la période
    const fin = new Date(c.mois.a, c.mois.m + Math.min(3, Math.max(1, c.nbMois || 1)) - 1, 1), [d] = bornesMois(c.mois.a, c.mois.m), [, f] = bornesMois(fin.getFullYear(), fin.getMonth());
    add('seances', `mois-${d}-${f}`, [['date', '>=', d], ['date', '<=', f]]);
  }
  if (v === 'bilans') {
    const an = c.auj.slice(0, 4), du = (c.stat && c.stat.du) || `${an}-01-01`, au = (c.stat && c.stat.au) || `${an}-12-31`;
    add('seances', `bilan-${du}-${au}`, [['date', '>=', du], ['date', '<=', au]]);
  }
  if (v === 'equipe') { add('users', 'all'); add('contacts', 'all'); }
  // Accueils (lot E) : toutes les fiches (quelques dizaines) et l'Annuaire (bénévoles, pour les chiffres)
  if (v === 'accueils') { add('accueils', 'all'); add('contacts', 'all'); }
  // Questionnaires et sondages (lot J) : tous les questionnaires (petite liste) ; les réponses d'un questionnaire seulement quand sa fiche de résultats est ouverte.
  if (v === 'questionnaires') { add('questionnaires', 'all'); if (c.questActId) add('reponsesQuestionnaire', 'q-' + c.questActId, ['questionnaireId', '==', c.questActId]); }
  // Bibliothèque des voyages et sorties (lot J) : toutes les sorties, et l'Annuaire pour choisir prestataire et transporteur.
  if (v === 'voyages') { add('voyages', 'all'); add('contacts', 'all'); }
  materiel(); portage(); budgets();
  // Partenaires : l'annuaire, les conventions et les échanges de l'année affichée (+ ceux d'un partenaire si sa fiche est ouverte)
  if (v === 'partenaires') {
    const an = c.anPart || c.auj.slice(0, 4);
    add('contacts', 'all'); add('conventions', 'all'); add('echanges', `an-${an}`, [['date', '>=', `${an}-01-01`], ['date', '<=', `${an}-12-31`]]);
    if (c.partId) add('echanges', `p-${c.partId}`, ['partenaireId', '==', c.partId]);
  }
  // Annuaire : petite liste, chargée seulement là où elle sert (écran Annuaire, formulaires d'activité et de tâche)
  if (['annuaire', 'activites', 'activite', 'taches'].includes(v)) add('contacts', 'all');
  if (v === 'sauvegarde') {
    if (c.onglet === 'corbeille') add('corbeille', 'all');
    if (c.onglet === 'journal') add('journal', 'all', null, { tri: 'date', limite: 150 });
  }
  return B;
}
