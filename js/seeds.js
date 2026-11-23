// Données FICTIVES pour le mode démonstration. Aucune personne réelle.
import { uid } from './logic.js';

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
  }));

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
    { id: 'c-par', categorie: 'Partenaire', nom: 'Association Les Jardins d\'Hiver', prenom: '', organisme: true, email: 'contact@exemple.fr', note: 'Partenaire fictif' }
  ];
  return { seniors, activites, inscriptions, seances, fiches, taches, contacts };
}
