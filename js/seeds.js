// Données FICTIVES pour le mode démonstration. Aucune personne réelle.
import { uid, completerSenior, copiePortage, copieSeniorLite, avecEvenementPortage, ANNEE_REFERENCE_PORTAGE } from './logic.js';

const iso = d => d.toISOString().slice(0, 10);
const plusJours = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const NOMS = [
  ['Vasseur','Odette','F','resident','1938-03-14'], ['Delcourt','Jeanne','F','adherent','1949-07-02'],
  ['Lefebvre','Monique','F','adherent','1952-11-21'], ['Marchand','Gisèle','F','resident','1941-05-30'],
  ['Dumont','Paulette','F','adherent','1947-01-19'], ['Carlier','Yvette','F','adherent','1944-09-08'],
  ['Bailleul','Colette','F','adherent','1955-02-25'], ['Petit','Raymonde','F','resident','1936-12-03'],
  ['Wattel','Lucette','F','adherent','1950-06-17'], ['Hennion','Marie-Claire','F','adherent','1953-04-11'],
  ['Declercq','Simone','F','adherent','1946-08-23'], ['Cornille','Denise','F','adherent','1948-10-05'],
  ['Vandenbussche','Hélène','F','adherent','1957-03-09'], ['Ducatel','Josiane','F','adherent','1951-12-28'],
  ['Lemaire','Nicole','F','adherent','1945-07-14'], ['Verhaeghe','Arlette','F','adherent','1954-01-31'],
  ['Cools','Bernadette','F','adherent','1943-05-06'], ['Mahieu','Thérèse','F','adherent','1956-09-20'],
  ['Roussel','André','H','adherent','1947-02-12'], ['Lecomte','Roger','H','adherent','1949-06-26']
];

export function donneesDemo() {
  const seniors = NOMS.map(([nom, prenom, sexe, statut, naissance], i) => ({
    id: 's' + (i + 1), nom, prenom, sexe, statut, naissance,
    adresse: statut === 'resident' ? '' : `${10 + i} rue des Tilleuls`, commune: statut === 'resident' ? '' : (i % 5 === 4 ? 'Commune voisine' : 'Ville démo'), tel: `06 00 00 00 ${String(i + 10).padStart(2, '0')}`,
    contactNom: i % 3 === 0 ? 'Fille : Sophie' : '', contactTel: i % 3 === 0 ? '06 00 00 99 99' : '',
    adhesion: statut === 'resident' ? null : { date: `${new Date().getFullYear()}-01-${String(5 + (i % 20)).padStart(2, '0')}`, montant: 40, paye: i % 7 !== 0 }
  })).map(s => completerSenior({ ...s, email: s.id === 's1' ? 'exemple@exemple.fr' : '', verifieLe: parseInt(s.id.slice(1), 10) % 4 === 0 ? '' : '2026-06-15' }));

  const activites = [
    { id: 'a-flo', nom: 'Atelier floral de Noël', cat: 'Créatif', type: 'activite', jour: 'Mer. · 14h30', lieu: 'Salle des fêtes', cap: 8, budget: 'Budget ville', interv: 'Fleuriste', date: plusJours(7) },
    { id: 'a-mem', nom: 'Atelier mémoire', cat: 'Mémoire', type: 'activite', jour: 'Mar. · 10h', lieu: 'Résidence autonomie', cap: 15, budget: 'Budget résidence', interv: 'Animatrice du service', date: plusJours(4) },
    { id: 'a-mar', nom: 'Marche douce', cat: 'Bien-être', type: 'activite', jour: 'Jeu. · 9h30', lieu: 'Départ mairie', cap: 20, budget: 'Budget ville', interv: 'Bénévole référent', date: plusJours(6) },
    { id: 'a-cho', nom: 'Chorale des aînés', cat: 'Culture', type: 'activite', jour: 'Ven. · 10h', lieu: 'Salle des fêtes', cap: 25, budget: 'Budget ville', interv: 'Musicien intervenant', date: plusJours(8) },
    { id: 'a-bru', nom: 'Sortie au marché de Noël de Bruxelles', cat: 'Sortie', type: 'sortie', jour: 'Sam. · départ 8h', lieu: 'Parking de la mairie', cap: 50, budget: 'Budget ville', interv: 'Autocariste', date: plusJours(29) },
    { id: 'a-rep', nom: 'Repas de Noël des seniors', cat: 'Événement', type: 'evenement', jour: 'Mer. · 12h', lieu: 'Salle des fêtes', cap: 200, budget: 'Budget ville', interv: 'Traiteur', date: plusJours(33) }
  ];

  const inscriptions = [];
  const ins = (act, sid, statut = 'inscrit', j = 0) => {
    const s = seniors.find(x => x.id === sid);
    inscriptions.push({ id: uid() + inscriptions.length, activiteId: act, seniorId: sid, seniorNom: `${s.prenom} ${s.nom}`, statut, dateDemande: plusJours(-20 + j) });
  };
  // Atelier floral : 18 demandes pour 8 places (rotation)
  seniors.slice(0, 18).forEach((s, i) => ins('a-flo', s.id, 'attente', i));
  seniors.slice(0, 12).forEach((s, i) => ins('a-mem', s.id, 'inscrit', i));
  seniors.slice(2, 14).forEach((s, i) => ins('a-mar', s.id, 'inscrit', i));
  seniors.slice(0, 8).forEach((s, i) => ins('a-bru', s.id, 'inscrit', i));

  // Séances passées pour l'atelier floral et la mémoire : alimentent la rotation et les bilans
  const seances = [];
  const dem = [[1,2,4,5,7,8,10,11,14,16],[0,1,3,4,5,7,10,12,14],[1,3,4,5,7,8,10,11,14,16,17],[4,5,7,10,11,14,16],[5,7,8,10,14,16],[7,10,16]];
  dem.forEach((idx, k) => {
    const pres = {};
    idx.forEach(i => { pres['s' + (i + 1)] = 'p'; });
    if (k === 1) { pres.s3 = 'a'; pres.s9 = 'a'; pres.s12 = 'j'; }
    if (k === 2) { pres.s9 = 'a'; pres.s6 = 'd'; }
    seances.push({ id: 'se-flo-' + k, activiteId: 'a-flo', date: plusJours(-70 + k * 10), presences: pres, valide: true });
  });
  for (let k = 0; k < 8; k++) {
    const pres = {};
    for (let i = 0; i < 12; i++) pres['s' + (i + 1)] = (i + k) % 9 === 0 ? 'a' : 'p';
    seances.push({ id: 'se-mem-' + k, activiteId: 'a-mem', date: plusJours(-60 + k * 7), presences: pres, valide: true });
  }

  const fiches = seniors.slice(0, 8).map((s, i) => ({
    id: 'a-bru_' + s.id, activiteId: 'a-bru', seniorId: s.id, seniorNom: `${s.prenom} ${s.nom}`,
    contact: i < 4 ? ['Fille : Sophie', 'Fils : Marc', 'Voisine : Annie', 'Époux : Roger'][i] : '',
    tel: i < 4 ? `06 00 00 00 0${i + 1}` : '', mob: i === 5 ? 'Besoin d\'un accompagnement' : 'Aucune difficulté',
    info: i === 1 ? 'Vient avec une amie' : '', photo: i === 3 ? 'Non' : 'Oui', paye: i < 5, piece: i < 6, effacer: true
  }));

  const taches = [
    { id: 't1', titre: 'Transmettre le planning au service communication', cat: 'Communication', echeance: plusJours(5), done: false },
    { id: 't2', titre: 'Confirmer le traiteur pour le repas de Noël', cat: 'Événements', echeance: plusJours(7), done: false },
    { id: 't3', titre: 'Déposer les chèques de la régie au Trésor public', cat: 'Régie', echeance: plusJours(-1), done: false },
    { id: 't4', titre: 'Réunion des bénévoles (marché de Noël)', cat: 'Bénévoles', echeance: plusJours(10), done: false },
    { id: 't5', titre: 'Préparer la campagne d\'adhésions', cat: 'Adhésions', echeance: plusJours(30), done: false },
    { id: 't6', titre: 'Commander les colis de Noël', cat: 'Événements', echeance: plusJours(-4), done: true }
  ];

  const contacts = [
    { id: 'c-flo', categorie: 'Intervenant·e', nom: 'Fleuriste', prenom: '', organisme: true, tel: '03 20 00 00 01', note: 'Atelier floral (fictif)' },
    { id: 'c-mus', categorie: 'Intervenant·e', nom: 'Musicien intervenant', prenom: '', organisme: true, note: 'Chorale (fictif)' },
    { id: 'c-ani', categorie: 'Collègue', nom: 'Animatrice du service', prenom: '', organisme: true },
    { id: 'c-ben', categorie: 'Bénévole', nom: 'Bénévole référent', prenom: '', organisme: true },
    { id: 'c-par', categorie: 'Partenaire', nom: 'Association Les Jardins d\'Hiver', prenom: '', organisme: true, email: 'contact@exemple.fr', note: 'Partenaire fictif', service: '', partenariat: 'Association locale', referent: 'Présidente (fictive)', projets: 'Atelier jardinage de printemps' },
    { id: 'c-med', categorie: 'Partenaire', nom: 'Médiathèque municipale', prenom: '', organisme: true, note: 'Partenaire fictif', service: 'Médiathèque', partenariat: 'Service municipal', referent: 'Responsable (fictive)', projets: 'Lectures à voix haute' }
  ];
  // Partenaires (lot C) : échanges et conventions fictifs, dates relatives à aujourd'hui
  const echanges = [
    { id: 'e-1', type: 'appel-sortant', date: plusJours(-12), heure: '10:00', etat: 'realise', interne: false, partenaireId: 'c-med', partenaire: 'Médiathèque municipale', service: 'Médiathèque', objet: 'Réserver la salle de lecture', resume: 'Salle confirmée pour le mois prochain.', suite: '', suiteDate: '', suiteFaite: false, suiteAFaire: false, par: 'Démonstration' },
    { id: 'e-2', type: 'courriel', date: plusJours(-20), heure: '', etat: 'realise', interne: false, partenaireId: 'c-par', partenaire: 'Association Les Jardins d\'Hiver', service: '', objet: 'Proposer un atelier jardinage', resume: '', suite: 'Relancer pour la date', suiteDate: plusJours(-3), suiteFaite: false, suiteAFaire: true, par: 'Démonstration' },
    { id: 'e-3', type: 'reunion', date: plusJours(6), heure: '14:00', etat: 'prevu', interne: true, partenaireId: '', partenaire: '', service: '', objet: 'Réunion mensuelle de l\'équipe de la résidence', resume: '', participants: '', odj: '', decisions: '', suite: '', suiteDate: '', suiteFaite: false, suiteAFaire: false, par: 'Démonstration' }
  ];
  const conventions = [
    { id: 'v-1', partenaireId: 'c-med', partenaire: 'Médiathèque municipale', intitule: 'Convention de partenariat', statut: 'signee', signature: plusJours(-300), echeance: plusJours(15), emplacement: 'Classeur « Conventions » (fictif)', note: '', par: 'Démonstration' }
  ];
  // Matériel (lot A) : articles, emprunts et mouvements fictifs, dates relatives à aujourd'hui
  const sans = { peremption: 'aucun', lots: [], datePeremption: '', peremptionPar: '', peremptionLe: '', manquant: false, echeance: '', modifiePar: 'Démonstration', modifieLe: plusJours(-30), commentaire: '' };
  const materiel = [
    { ...sans, id: 'm-ass', type: 'objet', nom: 'Assiettes blanches', categorie: 'Assiettes', quantite: 60, seuil: 40, bas: false, emplacement: 'Cuisine', etat: 'bon', commentaire: 'Service de 60 (fictif)' },
    { ...sans, id: 'm-ver', type: 'objet', nom: 'Verres à pied', categorie: 'Verres', quantite: 18, seuil: 24, bas: true, emplacement: 'Cuisine', etat: 'bon' },
    { ...sans, id: 'm-pla', type: 'objet', nom: 'Plateaux de service', categorie: 'Plateaux', quantite: 12, seuil: 0, bas: false, emplacement: 'Local de rangement', etat: 'reparer', commentaire: 'Deux plateaux au bord abîmé (fictif)' },
    { ...sans, id: 'm-caf', type: 'reserve', nom: 'Café moulu', categorie: 'Café', unite: 'paquet(s)', quantite: 3, seuil: 4, bas: true, emplacement: 'Réserve', peremption: 'article', datePeremption: plusJours(120), peremptionPar: 'Démonstration', peremptionLe: plusJours(-10), echeance: plusJours(120) },
    { ...sans, id: 'm-bis', type: 'reserve', nom: 'Biscuits secs', categorie: 'Biscuits', unite: 'boîte(s)', quantite: 9, seuil: 5, bas: false, emplacement: 'Réserve', peremption: 'lot', echeance: plusJours(12),
      lots: [{ id: 'l-1', libelle: 'Lot n° 1 (achat de septembre)', quantite: 4, date: plusJours(12), par: 'Démonstration', le: plusJours(-45) }, { id: 'l-2', libelle: 'Lot n° 2 (don)', quantite: 5, date: plusJours(200), par: 'Démonstration', le: plusJours(-9) }] },
    { ...sans, id: 'm-jus', type: 'reserve', nom: 'Jus de pomme', categorie: 'Jus', unite: 'bouteille(s)', quantite: 6, seuil: 0, bas: false, emplacement: 'Réserve', peremption: 'article', datePeremption: plusJours(-2), peremptionPar: 'Démonstration', peremptionLe: plusJours(-60), echeance: plusJours(-2) },
    { ...sans, id: 'm-noel', type: 'caisse', nom: 'Guirlandes et boules', numero: '1', saison: 'Noël', contenu: 'Guirlandes dorées, boules rouges (fictif)', quantite: 6, seuil: 0, bas: false, emplacement: 'Local de rangement', etat: 'bon' },
    { ...sans, id: 'm-pri', type: 'caisse', nom: 'Fleurs en papier', numero: '2', saison: 'Printemps', contenu: 'Fleurs en papier et ruban (fictif)', quantite: 1, seuil: 0, bas: false, emplacement: 'Local de rangement', etat: 'bon' }
  ];
  const emprunts = [
    { id: 'em-1', materielId: 'm-ver', materielNom: 'Verres à pied', quantite: 6, emprunteurType: 'contact', emprunteurId: 'c-par', emprunteur: 'Association Les Jardins d\'Hiver', dateSortie: plusJours(-20), retourPrevu: plusJours(-5), retourReel: '', etatRetour: '', rendu: false, commentaire: 'Pot de fin d\'année (fictif)', par: 'Démonstration', parUid: '' },
    { id: 'em-2', materielId: 'm-pla', materielNom: 'Plateaux de service', quantite: 4, emprunteurType: 'libre', emprunteurId: '', emprunteur: 'Service jeunesse', dateSortie: plusJours(-45), retourPrevu: plusJours(-40), retourReel: plusJours(-40), etatRetour: 'bon', rendu: true, commentaire: '', par: 'Démonstration', parUid: '' }
  ];
  const mouvements = [
    { id: 'mv-1', materielId: 'm-caf', materielNom: 'Café moulu', date: plusJours(-10), sens: 'entree', quantite: 6, lot: '', motif: 'Achat', note: '', apres: 6, par: 'Démonstration', parUid: '', creeLe: plusJours(-10) + 'T09:00:00.000Z' },
    { id: 'mv-2', materielId: 'm-caf', materielNom: 'Café moulu', date: plusJours(-3), sens: 'sortie', quantite: 3, lot: '', motif: 'Atelier', note: '', apres: 3, par: 'Démonstration', parUid: '', creeLe: plusJours(-3) + 'T14:00:00.000Z' }
  ];
  // Portage de repas (lot B) : cinq bénéficiaires fictifs (en cours depuis avant 2026, interrompue dont la reprise prévue est dépassée, interrompue, arrêtée, récente) et deux échanges avec un prestataire fictif.
  const JOURS_DEMO = { s2: [0, 1, 2, 3, 4], s5: [0, 2, 4], s8: [0, 1, 2, 3, 4, 5, 6], s12: [1, 3], s14: [0, 2, 4] };
  for (const sn of seniors) if (JOURS_DEMO[sn.id]) sn.portage = { jours: JOURS_DEMO[sn.id], precision: '' };
  const par = 'Démonstration', le = new Date().toISOString(), avant = { type: 'debut', date: `${ANNEE_REFERENCE_PORTAGE - 1}-12-31`, avant: true, par, le };
  const pg = (id, ...evts) => evts.reduce((d, e) => avecEvenementPortage(d, { par, le, ...e }), { id, ...copiePortage(seniors.find(x => x.id === id)), historique: [] });
  const portage = [
    pg('s2', avant),
    pg('s5', avant, { type: 'interruption', date: plusJours(-20), reprise: plusJours(-5), motif: 'Absence temporaire (vacances ou autre)', precision: 'Absente quinze jours' }),
    pg('s8', avant, { type: 'interruption', date: plusJours(-3), reprise: plusJours(10), motif: 'Changement de rythme de livraison', precision: '' }),
    pg('s12', { type: 'debut', date: plusJours(-120) }, { type: 'arret', date: plusJours(-30), motif: 'Changement de lieu de vie', precision: '' }),
    pg('s14', { type: 'debut', date: plusJours(-60) })
  ];
  const portageEchanges = [
    { id: 'pe-1', type: 'commande', date: plusJours(-9), prestataire: 'Traiteur (démonstration)', objet: 'Repas supplémentaires pour le banquet', resume: 'Dix repas de plus le jour du banquet.', suite: 'Confirmer le nombre définitif', suiteDate: plusJours(3), suiteFaite: false, suiteAFaire: true, statut: 'ouvert', par },
    { id: 'pe-2', type: 'livraison', date: plusJours(-40), prestataire: 'Traiteur (démonstration)', objet: 'Livraison en retard le jeudi', resume: 'Retard d\'une heure, excuses reçues.', suite: '', suiteDate: '', suiteFaite: false, suiteAFaire: false, statut: 'clos', par }
  ];
  const an = new Date().getFullYear();
  const parametres = [{ id: 'portage', initialise: le }, { id: `budgets-${an}`, initiaux: { 'Budget ville': 3000, 'Budget résidence': 2000, 'Forfait autonomie': 1200 } }];
  // Budgets et dépenses (lot D) : exemples fictifs
  const depenses = [
    { id: 'd-1', budget: 'Budget ville', date: plusJours(-12), fournisseur: 'Fleuriste (démonstration)', nature: 'Fournitures pour l\'atelier floral', activiteId: 'a-flo', activiteNom: 'Atelier floral de Noël', libre: '', dispositif: 'Aucun', montantPrevu: 150, montantEngage: 150, montantPaye: 140, justificatifOu: 'Classeur « Factures » du bureau', commentaire: 'Facture n° 4521.', par },
    { id: 'd-2', budget: 'Budget résidence', date: plusJours(-5), fournisseur: 'Papeterie (démonstration)', nature: 'Fournitures pour l\'atelier mémoire', activiteId: 'a-mem', activiteNom: 'Atelier mémoire', libre: '', dispositif: 'Aucun', montantPrevu: 60, montantEngage: 55, montantPaye: '', justificatifOu: '', commentaire: '', par },
    { id: 'd-3', budget: 'Budget ville', date: plusJours(-30), fournisseur: 'Traiteur (démonstration)', nature: 'Marché de Noël : boissons et goûter', activiteId: '', activiteNom: '', libre: 'Marché de Noël', dispositif: 'Forfait autonomie', montantPrevu: 300, montantEngage: 300, montantPaye: 300, justificatifOu: 'Devis signé, dossier Marché de Noël', commentaire: 'Devis signé le 3 novembre.', par }
  ];
  const regie = [
    { id: 'r-1', type: 'Chèque à transmettre au Trésor public', date: plusJours(-8), objet: 'Chèque du marché de Noël', montant: 300, mode: 'Chèque', statut: 'a_transmettre', echeance: plusJours(5), commentaire: '', par },
    { id: 'r-2', type: 'Document à préparer', date: plusJours(-15), objet: 'Bilan financier trimestriel', montant: '', mode: '', statut: 'transmise', echeance: plusJours(-2), commentaire: 'En attente de signature.', par },
    { id: 'r-3', type: 'Suivi mensuel', date: plusJours(-45), objet: 'Suivi de caisse de novembre', montant: 85, mode: 'Espèces', statut: 'rapprochee', echeance: '', commentaire: '', par }
  ];
  // Accueils (lot E) : personnes fictives
  const accueils = [
    { id: 'ac-1', type: 'bourse', nom: 'Fictif', prenom: 'Léa', debut: plusJours(-60), fin: plusJours(120), objectifHeures: 50, montant: 500, clos: false, convention: { etat: 'signee', echeance: plusJours(120), ou: 'Classeur du bureau' }, missions: 'Aide à l\'animation des après-midi jeux', etatDossier: 'En cours',
      heures: [{ id: 'h-1', date: plusJours(-40), heures: 3, mission: 'Après-midi jeux', validee: true, par }, { id: 'h-2', date: plusJours(-20), heures: 2.5, mission: 'Atelier créatif', validee: true, par }], rdv: [] },
    { id: 'ac-2', type: 'civique', nom: 'Exemple', prenom: 'Samir', debut: plusJours(-100), fin: plusJours(25), clos: false, convention: { etat: 'asigner', echeance: '', ou: '' }, missions: 'Visites de convivialité et sorties', objectifs: 'Développer le lien avec les résident·es', pointsOrganisation: '', bilan: '', rdv: [{ id: 'r-1', date: plusJours(10), objet: 'Point à mi-parcours' }], heures: [] },
    { id: 'ac-3', type: 'stagiaire', nom: 'Modèle', prenom: 'Inès', debut: plusJours(-10), fin: plusJours(40), clos: false, etablissement: 'Lycée (démonstration)', referent: 'Tuteur de l\'établissement', convention: { etat: 'signee', echeance: plusJours(40), ou: 'Dossier stagiaires' }, missions: 'Découverte du service', bilan: '', rdv: [], heures: [] }
  ];
  const seniorsLite = seniors.map(copieSeniorLite);
  return { seniors, activites, inscriptions, seances, fiches, taches, contacts, echanges, conventions, materiel, emprunts, mouvements, portage, portageEchanges, parametres, accueils, seniorsLite, depenses, regie };
}
