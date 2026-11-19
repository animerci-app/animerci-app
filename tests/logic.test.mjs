import assert from 'node:assert/strict';
import * as IL from '../js/import-logic.js';
import * as L from '../js/logic.js';
import { donneesDemo } from '../js/seeds.js';

let n = 0; const t = (nom, f) => { f(); n++; console.log('ok -', nom); };

t('âge calculé à la date donnée', () => {
  assert.equal(L.age('1950-06-15', new Date('2026-06-14')), 75);
  assert.equal(L.age('1950-06-15', new Date('2026-06-15')), 76);
  assert.equal(L.age(''), null);
});
t('tranches d\'âge', () => { assert.equal(L.trancheAge(59), 'Moins de 60 ans'); assert.equal(L.trancheAge(60), '60 à 74 ans'); assert.equal(L.trancheAge(75), '75 à 84 ans'); assert.equal(L.trancheAge(90), '85 ans et plus'); });

t('historique : compte présences, absences, excusées, désistements', () => {
  const se = [
    { activiteId: 'x', date: '2026-01-01', presences: { s1: 'p', s2: 'a' } },
    { activiteId: 'x', date: '2026-01-08', presences: { s1: 'p', s2: 'j' } },
    { activiteId: 'y', date: '2026-01-09', presences: { s1: 'p' } },
    { activiteId: 'x', date: '2026-01-15', presences: { s1: 'd' } }
  ];
  assert.deepEqual(L.historique('s1', 'x', se), { part: 2, abs: 0, exc: 0, des: 1, derniere: '2026-01-08' });
  assert.deepEqual(L.historique('s2', 'x', se), { part: 0, abs: 1, exc: 1, des: 0, derniere: null });
});

t('rotation : moins de participations passe devant', () => {
  const c = [
    { id: 'a', h: { part: 5, abs: 0, des: 0 }, dateDemande: '2026-01-01' },
    { id: 'b', h: { part: 0, abs: 0, des: 0 }, dateDemande: '2026-01-05' },
    { id: 'c', h: { part: 2, abs: 0, des: 0 }, dateDemande: '2026-01-02' }
  ];
  assert.deepEqual(L.classerCandidats(c).map(x => x.id), ['b', 'c', 'a']);
});
t('rotation : les absences non excusées pénalisent, pas les excusées', () => {
  const c = [
    { id: 'a', h: { part: 1, abs: 2, exc: 0, des: 0 }, dateDemande: '2026-01-01' },
    { id: 'b', h: { part: 1, abs: 0, exc: 3, des: 0 }, dateDemande: '2026-01-02' }
  ];
  assert.deepEqual(L.classerCandidats(c).map(x => x.id), ['b', 'a']);
  assert.deepEqual(L.classerCandidats(c, { abs: false }).map(x => x.id), ['a', 'b']); // règle désactivée : ancienneté
});
t('rotation : égalité départagée par ancienneté de la demande, puis ordre', () => {
  const h = { part: 1, abs: 0, des: 0 };
  const c = [{ id: 'a', h, dateDemande: '2026-02-01' }, { id: 'b', h, dateDemande: '2026-01-01' }, { id: 'c', h, dateDemande: '2026-01-01' }];
  assert.deepEqual(L.classerCandidats(c).map(x => x.id), ['b', 'c', 'a']);
});
t('rotation : résidents en priorité si la règle est activée', () => {
  const h = { part: 1, abs: 0, des: 0 };
  const c = [{ id: 'a', h, statut: 'adherent', dateDemande: '2026-01-01' }, { id: 'b', h, statut: 'resident', dateDemande: '2026-03-01' }];
  assert.equal(L.classerCandidats(c)[0].id, 'a');
  assert.equal(L.classerCandidats(c, { res: true })[0].id, 'b');
});

t('statistiques : personnes uniques ≠ participations, seuls les appels validés comptent', () => {
  const seniors = [{ id: 's1', sexe: 'F', statut: 'adherent', naissance: '1950-01-01' }, { id: 's2', sexe: 'H', statut: 'resident', naissance: '1940-01-01' }];
  const acts = [{ id: 'x', cat: 'Mémoire' }];
  const se = [
    { activiteId: 'x', date: '2026-03-01', valide: true, presences: { s1: 'p', s2: 'a' } },
    { activiteId: 'x', date: '2026-03-08', valide: true, presences: { s1: 'p', s2: 'p' } },
    { activiteId: 'x', date: '2026-03-15', valide: false, presences: { s1: 'p', s2: 'p' } }
  ];
  const st = L.statistiques(se, seniors, acts);
  assert.equal(st.seances, 2); assert.equal(st.participations, 3); assert.equal(st.personnesUniques, 2);
  assert.equal(st.tauxPresence, 75); // 3 présents sur 4 attendus
  assert.deepEqual(st.parMois, { '2026-03': 3 });
  assert.equal(st.publics.residents, 1); assert.equal(st.publics.femmes, 1);
});
t('statistiques : filtre par période', () => {
  const se = [{ activiteId: 'x', date: '2026-01-10', valide: true, presences: { s1: 'p' } }, { activiteId: 'x', date: '2026-06-10', valide: true, presences: { s1: 'p' } }];
  assert.equal(L.statistiques(se, [], [], { du: '2026-05-01', au: '2026-12-31' }).participations, 1);
});
t('statistiques : les désistements ne comptent pas dans le taux', () => {
  const se = [{ activiteId: 'x', date: '2026-01-10', valide: true, presences: { s1: 'p', s2: 'd', s3: 'd' } }];
  assert.equal(L.statistiques(se, [], []).tauxPresence, 100);
});

t('adhésion : résident = à jour, adhérent = payée dans l\'année', () => {
  assert.equal(L.adhesionAJour({ statut: 'resident' }, 2026), true);
  assert.equal(L.adhesionAJour({ statut: 'adherent', adhesion: { date: '2026-01-05', paye: true } }, 2026), true);
  assert.equal(L.adhesionAJour({ statut: 'adherent', adhesion: { date: '2025-12-30', paye: true } }, 2026), false);
  assert.equal(L.adhesionAJour({ statut: 'adherent', adhesion: { date: '2026-01-05', paye: false } }, 2026), false);
  assert.equal(L.adhesionAJour({ statut: 'adherent' }, 2026), false);
});

t('CSV : point-virgule, guillemets doublés, BOM', () => {
  const csv = L.toCSV([{ label: 'Nom', get: r => r.n }, { label: 'Note', get: r => r.k }], [{ n: 'Dupont; Jean', k: 'dit "ok"' }, { n: 'Léa', k: null }]);
  assert.equal(csv, '﻿Nom;Note\r\n"Dupont; Jean";"dit ""ok"""\r\nLéa;');
});
t('dates françaises', () => { assert.equal(L.fmtDate('2026-11-13'), '13/11/2026'); assert.equal(L.fmtDate(''), ''); });

t('données de démonstration cohérentes (références valides, 18 demandes pour 8 places)', () => {
  const d = donneesDemo();
  const sIds = new Set(d.seniors.map(s => s.id)), aIds = new Set(d.activites.map(a => a.id));
  for (const i of d.inscriptions) { assert.ok(sIds.has(i.seniorId)); assert.ok(aIds.has(i.activiteId)); }
  for (const s of d.seances) { assert.ok(aIds.has(s.activiteId)); for (const k of Object.keys(s.presences)) assert.ok(sIds.has(k), k); }
  const flo = d.inscriptions.filter(i => i.activiteId === 'a-flo'); assert.equal(flo.length, 18);
  assert.equal(d.activites.find(a => a.id === 'a-flo').cap, 8);
  const ids = d.inscriptions.map(i => i.id); assert.equal(new Set(ids).size, ids.length);
});
import { besoins, bornesMois } from '../js/donnees.js';
const base = { auj: '2026-11-13', horizonSorties: '2027-01-12', activites: [{ id: 's1', type: 'sortie', date: '2026-11-20' }, { id: 's2', type: 'sortie', date: '2027-06-01' }, { id: 'x', type: 'activite', date: '2026-11-15' }], mois: { a: 2026, m: 10 }, stat: {} };
const cols = (c) => besoins({ ...base, ...c }).map(b => b.col + ':' + b.key);
t('chargement à la demande : accueil sans personnes, équipe, corbeille ni journal', () => {
  const l = cols({ role: 'admin', view: 'home' });
  for (const interdit of ['seniors:all', 'users:all', 'corbeille:all', 'journal:all', 'inscriptions:all', 'seances:all', 'fiches:all']) assert.ok(!l.includes(interdit), interdit);
  assert.ok(l.includes('inscriptions:attente') && l.includes('seances:avalider') && l.includes('inscriptions:s1') && l.includes('fiches:s1'));
  assert.ok(!l.includes('inscriptions:s2'), 'sortie lointaine non chargée');
});
t('chargement à la demande : chaque écran charge ce qu\'il affiche', () => {
  assert.ok(cols({ role: 'admin', view: 'seniors' }).includes('seniors:all'));
  const a = cols({ role: 'admin', view: 'activite', actId: 'x' });
  for (const k of ['inscriptions:x', 'seances:x', 'fiches:x', 'seniors:all']) assert.ok(a.includes(k), k);
  assert.ok(cols({ role: 'admin', view: 'equipe' }).includes('users:all'));
  assert.ok(cols({ role: 'admin', view: 'sauvegarde', onglet: 'journal' }).includes('journal:all'));
  assert.ok(!cols({ role: 'admin', view: 'sauvegarde', onglet: 'sauvegarde' }).includes('journal:all'));
  assert.ok(cols({ role: 'admin', view: 'sauvegarde', onglet: 'corbeille' }).includes('corbeille:all'));
});
t('chargement à la demande : planning = mois affiché, bilans = période', () => {
  assert.deepEqual(bornesMois(2026, 1), ['2026-02-01', '2026-02-28']);
  assert.deepEqual(bornesMois(2028, 1), ['2028-02-01', '2028-02-29']);
  const p = besoins({ ...base, role: 'admin', view: 'planning' }).find(b => b.col === 'seances');
  assert.deepEqual(p.filtre, [['date', '>=', '2026-11-01'], ['date', '<=', '2026-11-30']]);
  const b = besoins({ ...base, role: 'admin', view: 'bilans', stat: { du: '2026-01-01', au: '2026-06-30' } }).find(x => x.col === 'seances');
  assert.deepEqual(b.filtre, [['date', '>=', '2026-01-01'], ['date', '<=', '2026-06-30']]);
});
t('annuaire : chargé seulement là où il sert, jamais pour les autres rôles', () => {
  assert.ok(!cols({ role: 'admin', view: 'home' }).includes('contacts:all'));
  for (const v of ['annuaire', 'activites', 'activite', 'taches']) assert.ok(cols({ role: 'admin', view: v, actId: 'x' }).includes('contacts:all'), v);
  assert.ok(!cols({ role: 'intervenant', view: 'activites', mesActivites: [] }).includes('contacts:all'));
});
t('chargement à la demande : intervenante et bénévole limités', () => {
  const i = cols({ role: 'intervenant', view: 'activites', mesActivites: ['a1'] });
  assert.deepEqual(i.sort(), ['activites:all', 'inscriptions:a1', 'parametres:all', 'seances:a1']);
  assert.deepEqual(cols({ role: 'benevole', view: 'planning' }).sort(), ['activites:all', 'parametres:all']);
  assert.deepEqual(besoins({ ...base, role: null, view: 'home' }), []);
});

t('homonymes (personnes) : nom simple sans homonyme, naissance ajoutée seulement en cas d\'homonyme', () => {
  const a = { id: 'a', prenom: 'Marie', nom: 'Dupont', naissance: '1942-03-01' }, b = { id: 'b', prenom: 'MARIE', nom: 'dupont', naissance: '1950-07-09' }, c = { id: 'c', prenom: 'Éloïse', nom: 'Martin', naissance: '1940-01-01' };
  assert.equal(L.nomSenior(a, [a, c]), 'Marie Dupont');
  assert.equal(L.nomSenior(a, [a, b, c]), 'Marie Dupont (né·e en 1942)');
  assert.equal(L.nomSenior(b, [a, b, c]), 'MARIE dupont (né·e en 1950)');
  assert.equal(L.nomSenior({ ...b, naissance: '1942-11-30' }, [a, { ...b, naissance: '1942-11-30' }]), 'MARIE dupont (né·e le 30/11/1942)');
  assert.equal(L.nomSenior({ ...b, naissance: '' }, [a, { ...b, naissance: '' }]), 'MARIE dupont (naissance à renseigner)');
  assert.equal(L.homonymes({ id: 'x', prenom: 'eloise', nom: 'MARTIN' }, [a, b, c]).length, 1, 'accents et casse ignorés');
  assert.equal(L.homonymes(a, [a]).length, 0, 'une personne n\'est pas son propre homonyme');
});
t('homonymes (annuaire) : libellé, recherche par identifiant puis par libellé puis par nom unique', () => {
  const m1 = { id: 'k1', nom: 'Marie Dupont', precision: 'fleuriste' }, m2 = { id: 'k2', nom: 'Marie Dupont' }, p = { id: 'k3', nom: 'Paul Roux' };
  assert.equal(L.libelleContact(m1), 'Marie Dupont · fleuriste');
  assert.equal(L.libelleContact(p, [m1, m2, p]), 'Paul Roux');
  assert.equal(L.libelleContact(m2, [m1, m2, p]), 'Marie Dupont · (sans précision)');
  assert.equal(L.libelleContact(m2, [m2]), 'Marie Dupont');
  const liste = [m1, m2, p];
  assert.equal(L.trouverContact(liste, 'n\'importe quoi', 'k2').id, 'k2', 'l\'identifiant l\'emporte');
  assert.equal(L.trouverContact(liste, 'Marie Dupont · fleuriste', '').id, 'k1', 'libellé exact');
  assert.equal(L.trouverContact(liste, 'Marie Dupont', ''), liste[1], 'libellé exact d\'un contact sans précision');
  assert.equal(L.trouverContact([m1, p], 'marie dupont', '').id, 'k1', 'nom seul, unique : ancien format repris');
  assert.equal(L.trouverContact([m1, { id: 'k4', nom: 'Marie  Dupont', precision: 'chef' }], 'Marie Dupont', ''), null, 'nom partagé : ambigu, rien n\'est deviné');
  assert.equal(L.trouverContact(liste, '', ''), null);
});
t('homonymes : nom de jeune fille comparé au nom d\'usage (une même dame connue sous deux noms)', () => {
  const a = { id: 'a', prenom: 'Colette', nom: 'Bailleul', naissance: '1933-03-03' };
  const b = { id: 'b', prenom: 'colette', nom: 'Lambert', nomNaissance: 'BAILLEUL' };
  assert.equal(L.homonymes(b, [a, b]).length, 1, 'Lambert née Bailleul rapprochée de Bailleul');
  assert.equal(L.homonymes(a, [a, b]).length, 1, 'et réciproquement');
  assert.equal(L.homonymes({ id: 'c', prenom: 'Colette', nom: 'Lambert', nomNaissance: 'Roux' }, [a, b]).length, 1, 'même nom d\'usage');
  assert.equal(L.homonymes({ id: 'd', prenom: 'Colette', nom: 'Martin', nomNaissance: 'Roux' }, [a]).length, 0);
});

t('v1.7.0 : lieu de vie, libellés et cotisation à régler', () => {
  const an = new Date().getFullYear();
  const res = { id: 'r', statut: 'resident', commune: 'X', adhesion: null };
  const adhOk = { id: 'a', statut: 'adherent', commune: ' Lieu1 ', adhesion: { date: `${an}-02-01`, montant: 40, paye: true } };
  const adhKo = { id: 'b', statut: 'adherent', commune: '', adhesion: { date: `${an}-02-01`, montant: 40, paye: false } };
  assert.equal(L.libelleStatut('resident'), 'Résident·e'); assert.equal(L.libelleStatut('adherent'), 'Adhérent·e'); assert.equal(L.libelleStatut('autre'), 'Autre public');
  assert.equal(L.lieuDeVie(res, 'Résidence R'), 'Résidence R', 'résident : la résidence, jamais la commune');
  assert.equal(L.lieuDeVie(res, ''), '', 'résidence non réglée : vide, pas d\'invention');
  assert.equal(L.lieuDeVie(adhOk, 'Résidence R'), 'Lieu1');
  assert.equal(L.lieuDeVie(null), '');
  assert.equal(L.cotisationARegler(res), false, 'jamais pour un·e résident·e');
  assert.equal(L.cotisationARegler(adhOk), false);
  assert.equal(L.cotisationARegler(adhKo), true);
  assert.equal(L.cotisationARegler({ id: 'c', statut: 'adherent', adhesion: null }), true, 'adhésion absente : à régler');
  assert.equal(L.cotisationARegler(undefined), false, 'fiche supprimée : pas de repère');
  assert.equal(L.cotisationARegler({ id: 'd', statut: 'autre', adhesion: null }), false, 'autre public : pas de cotisation');
  assert.equal(L.adhesionAJour({ statut: 'autre', adhesion: null }), true);
  assert.deepEqual([L.rangStatut('resident'), L.rangStatut('adherent'), L.rangStatut('autre'), L.rangStatut(undefined)], [0, 1, 2, 2]);
  const txt = L.texteListeRetenus('Atelier', [{ nom: 'Zoé', statut: 'adherent', cotis: true }, { nom: 'Anne', statut: 'adherent', cotis: false }, { nom: 'Bob', statut: 'resident' }, { nom: 'Ève', statut: 'autre' }]);
  assert.equal(txt, 'Atelier\nRésident·es (1)\nBob\n\nAdhérent·es (2)\nAnne\nZoé — cotisation à régler\n\nAutres publics (1)\nÈve');
});

t('v1.8.0 : texte collé (liste Word) et ressemblance de noms', () => {
  const a = IL.lireTexte('LISTE DES ADHÉRENTS 2026\nDUPONT Marie – Nom de jeune fille : MARTIN\nROUX Claire nom de jeune fille LEBLANC\nBERNARD Anne– Prénom à confirmer\nVANDEN BERG Luc\n', 'seniors');
  assert.equal(a.ignorees, 1, 'titre de document ignoré');
  assert.deepEqual(a.lignes.slice(1), [['DUPONT Marie', 'MARTIN', ''], ['ROUX Claire', 'LEBLANC', ''], ['BERNARD Anne', '', 'oui'], ['VANDEN BERG Luc', '', '']]);
  const b = IL.lireTexte('Liste des bénévoles\nGroupe un\n• Marie Dupont\n• Luc Roux (tricot)\nChorale\n• Père Martin\n• Son équipe(Anne Petit, Paul Durand)\n', 'contacts');
  assert.deepEqual(b.lignes.slice(1), [['Marie Dupont', 'Groupe un'], ['Luc Roux', 'Groupe un — tricot'], ['Martin', 'Chorale — Père'], ['Anne Petit', 'Chorale — équipe'], ['Paul Durand', 'Chorale — équipe']]);
  assert.equal(IL.lireTexte('Marie Dupont\nLuc Roux', 'contacts').lignes.length, 3, 'sans puce : une personne par ligne, aucun groupe');
  const t = IL.lireTexte('Nom/Prénom\tAdresse\tFréquence\tDate anniversaire\nDUPONT Marie\t5 rue X\tLundi\t11/03/1940\nROUX Luc\t6 rue Y\tMardi\t', 'seniors');
  assert.equal(t.format, 'tableau'); assert.deepEqual(IL.detecterColonnes(t.lignes, 'seniors').colonnes, ['complet', 'adresse', 'frequence', 'naissance']);
  assert.deepEqual(IL.lireTexte('   \n', 'seniors').lignes, []);
  assert.deepEqual(L.separerNom('LE GALL Marguerite Marie Belle'), { prenom: 'Marguerite Marie Belle', nom: 'LE GALL', organisme: false });
  assert.equal(L.separerNom('Le Secours Populaire').organisme, true); assert.equal(L.separerNom('LA POSTE').organisme, true);
  assert.equal(IL.proche('Rolande Letangre', 'Rollande Letangre'), true); assert.equal(IL.proche('Marie Dupont', 'Marie Dupond'), true);
  assert.equal(IL.proche('Marie Dupont', 'Marie Dupont'), false); assert.equal(IL.proche('Anne Roux', 'Anna Roux'), false, 'noms courts : pas de faux positif');
  const r = IL.preparerSeniors(a.lignes.slice(1), ['complet', 'nomNaissance', 'aConfirmer'], [], { statut: 'adherent', sexe: 'F', commune: 'Ville', adhesion: { date: '2026-11-18', montant: 40, paye: true } });
  assert.equal(r.nouveaux.length, 4); assert.equal(r.nouveaux[2].prenomAConfirmer, true); assert.equal(r.nouveaux[0].prenomAConfirmer, undefined);
  assert.equal(r.nouveaux[0].nom, 'DUPONT'); assert.equal(r.nouveaux[3].nom, 'VANDEN BERG'); assert.equal(r.nouveaux[0].adhesion.paye, true); assert.equal(r.nouveaux[0].commune, 'Ville');
  const r2 = IL.preparerSeniors([['DUPONT Marie', '', ''], ['DUPOND Marie', '', '']], ['complet', 'nomNaissance', 'aConfirmer'], [], { statut: 'adherent', sexe: 'F', commune: '', adhesion: {} });
  assert.ok(r2.aVerifier.some(x => /ressemble/.test(x.raison)), 'faute de frappe signalée');
});

t('v1.9.0 : portage de repas (fréquence) et adresse de la résidence', () => {
  const f = x => L.lireFrequence(x);
  assert.deepEqual(f('Lundi au dimanche').jours, [0, 1, 2, 3, 4, 5, 6]); assert.equal(L.libelleFrequence(f('Lundi au dimanche')), 'Tous les jours');
  assert.deepEqual(f('Lundi au vendredi').jours, [0, 1, 2, 3, 4]); assert.equal(L.libelleFrequence(f('Lundi au vendredi')), 'Lundi au vendredi');
  assert.deepEqual(f('Lundi, mercredi, vendredi, dimanche').jours, [0, 2, 4, 6]); assert.equal(L.libelleFrequence(f('Lundi, mercredi, vendredi, dimanche')), 'Lundi, mercredi, vendredi, dimanche');
  assert.deepEqual(f('Lundi, mardi et mercredi').jours, [0, 1, 2]); assert.deepEqual(f('Lundi / mercredi').jours, [0, 2]);
  assert.deepEqual(f('Au choix'), { jours: [], precision: 'Au choix' }); assert.equal(L.libelleFrequence(f('Au choix')), 'Au choix');
  assert.deepEqual(f('Samedi au mardi').jours, [0, 1, 5, 6]); assert.equal(L.libelleFrequence(f('Samedi au mardi')), 'Samedi au mardi');
  assert.deepEqual(f('mardi et jeudi sauf férié').jours, [1, 3]); assert.equal(f('mardi et jeudi sauf férié').precision, 'mardi et jeudi sauf férié');
  assert.deepEqual(f(''), { jours: [], precision: '' }); assert.equal(L.libelleFrequence(null), '');
  const R = '22 Rue des Frères Testrue, 59000 Villetest';
  assert.equal(L.memeAdresse('22 rue des Freres Testrue', R), true); assert.equal(L.memeAdresse('22, r. des Frères Testrue 59000 Villetest', R), true);
  assert.equal(L.memeAdresse('24 Rue des Frères Autretest', R), false); assert.equal(L.memeAdresse('2 rue des frères Testrue', R), false, 'autre numéro');
  assert.equal(L.memeAdresse('', R), false); assert.equal(L.memeAdresse('22 rue des Frères Testrue', ''), false); assert.equal(L.memeAdresse('rue des Frères Testrue', 'rue des Frères Testrue'), false, 'sans numéro : pas de classement automatique');
  const cols = ['complet', 'adresse', 'frequence', 'naissance'], defauts = { statut: 'autre', sexe: 'F', commune: '', adhesion: {}, residenceAdresse: R };
  const lignes = [['DUPONT Marie', '5 rue X', 'Lundi au vendredi', '11/03/1940'], ['ROUX Luc', '22 rue des Frères Testrue', 'Au choix', ''], ['MARTIN Anne', '7 rue Y', '', '']];
  const r = IL.preparerSeniors(lignes, cols, [], defauts);
  assert.equal(r.nouveaux.length, 3);
  assert.deepEqual(r.nouveaux[0].portage, { jours: [0, 1, 2, 3, 4], precision: '' }); assert.equal(r.nouveaux[0].statut, 'autre');
  assert.equal(r.nouveaux[1].statut, 'resident'); assert.equal(r.nouveaux[1].adresse, ''); assert.equal(r.nouveaux[1].adhesion, null); assert.equal(r.nouveaux[1].portage.precision, 'Au choix');
  assert.equal(r.nouveaux[2].portage, undefined, 'pas de fréquence : pas de portage');
  assert.ok(r.aVerifier.some(x => /classée Résident/.test(x.raison)));
  // statut écrit dans le fichier : l'adresse ne le change pas
  const r3 = IL.preparerSeniors([['ROUX Luc', '22 rue des Frères Testrue', 'adhérent']], ['complet', 'adresse', 'statut'], [], defauts); assert.equal(r3.nouveaux[0].statut, 'adherent');
  // une personne déjà présente (sans portage) reçoit seulement son portage ; un re-import ne change plus rien
  const ex = [{ id: 'a1', nom: 'DUPONT', prenom: 'Marie', naissance: '1940-03-11', statut: 'adherent' }];
  const r4 = IL.preparerSeniors([lignes[0]], cols, ex, defauts);
  assert.equal(r4.nouveaux.length, 0); assert.equal(r4.doublons, 1); assert.deepEqual(r4.majPortage, [{ id: 'a1', portage: { jours: [0, 1, 2, 3, 4], precision: '' } }]);
  const r5 = IL.preparerSeniors([lignes[0]], cols, [{ ...ex[0], portage: { jours: [0], precision: '' } }], defauts); assert.deepEqual(r5.majPortage, []);
  assert.equal(IL.detecterColonnes([['Nom/Prénom', 'Adresse', 'Fréquence', 'Date anniversaire']], 'seniors').colonnes[2], 'frequence');
});

t('v1.9.0 : annuaire, titre de civilité et nom seul', () => {
  const cats = ['Intervenant·e', 'Partenaire'];
  const r = IL.preparerContacts([['Père Testnom', 'Célébrations'], ['Prénomseul', '']], ['complet', 'precision'], [], { categorie: 'Partenaire' }, cats);
  assert.equal(r.nouveaux[0].nom, 'Testnom'); assert.equal(r.nouveaux[0].prenom, ''); assert.equal(r.nouveaux[0].precision, 'Père · Célébrations');
  assert.ok(r.aVerifier.some(x => /un seul mot/.test(x.raison)));
});

t('v1.10.0 : import des activités', () => {
  const cols = ['nom', 'jour', 'frequence', 'categorie', 'type', 'cap'];
  assert.deepEqual(IL.detecterColonnes([['Activité', 'Jour et horaire', 'Fréquence', 'Catégorie', 'Type', 'Places']], 'activites').colonnes, cols);
  const d = { type: 'activite', cat: 'Créatif', cap: 15, budget: 'B1' };
  const r = IL.preparerActivites([['Atelier test', 'Lundi · 10h', 'Toutes les semaines', 'Mémoire', '', '12'], ['Sophro test', 'Mercredi · 10h', '1 fois par mois', '', 'sortie', ''], ['Sophro test', 'Vendredi · 9h', '', '', '', 'abc'], ['', 'x', '', '', '', '']], cols, [], d);
  assert.equal(r.nouveaux.length, 3); assert.equal(r.nouveaux[0].cap, 12); assert.equal(r.nouveaux[0].cat, 'Mémoire'); assert.equal(r.nouveaux[0].frequence, 'Toutes les semaines');
  assert.equal(r.nouveaux[1].type, 'sortie'); assert.equal(r.nouveaux[1].cat, 'Créatif'); assert.equal(r.nouveaux[2].cap, 15); assert.equal(r.nouveaux[0].budget, 'B1');
  assert.ok(r.aVerifier.some(x => /autre jour/.test(x.raison)) && r.aVerifier.some(x => /illisible/.test(x.raison)) && r.aVerifier.some(x => /manquant/.test(x.raison)));
  const r2 = IL.preparerActivites([['Atelier test', 'Lundi · 10h', '', '', '', '']], cols, [{ nom: 'Atelier test', jour: 'Lundi · 10h' }], d); assert.equal(r2.nouveaux.length, 0); assert.equal(r2.doublons, 1);
  assert.deepEqual(IL.lireTexte('A\nB', 'activites').lignes, [['Nom'], ['A'], ['B']]);
});

t('v1.12.0 : résidents (appartement, lignes de mois, sexe déduit)', () => {
  const cols = ['appartement', 'complet', 'naissance'], d = { statut: 'resident', sexe: '', commune: '', adhesion: {} };
  const r = IL.preparerSeniors([['JANVIER', '', ''], ['211', 'TESTUN Alice', '05/01/1950'], ['5', 'TESTDEUX Marc', '11/02/1940'], ['', '', ''], ['FEVRIER', '', ''], ['9', 'TESTTROIS Dominique', '']], cols, [], d);
  assert.equal(r.nouveaux.length, 3); assert.equal(r.aVerifier.filter(x => /nom ou prénom manquant/.test(x.raison)).length, 0, 'lignes de mois ignorées');
  assert.equal(r.nouveaux[0].appartement, '211'); assert.equal(r.nouveaux[0].sexe, 'F'); assert.equal(r.nouveaux[1].sexe, 'H'); assert.equal(r.nouveaux[2].sexe, '');
  assert.equal(r.nouveaux[0].statut, 'resident'); assert.equal(r.nouveaux[0].adhesion, null);
  assert.ok(r.aVerifier.some(x => /sexe non déterminé/.test(x.raison)));
  assert.equal(IL.detecterColonnes([['APPARTEMENT', 'Nom/Prénom', 'Date de Naissance', 'Année', 'Age']], 'seniors').colonnes.join(), 'appartement,complet,naissance,,');
});

console.log(`\n${n} tests réussis`);
// L'identifiant d'une fiche de sortie suit toujours la forme activité_sénior
const t2 = donneesDemo(); assert.ok(t2.fiches.every(f => f.id === `${f.activiteId}_${f.seniorId}`)); t('CSV : anti-injection de formule, numéros de téléphone intacts', () => {
  assert.equal(L.csvEscape('=SOMME(A1)'), "'=SOMME(A1)");
  assert.equal(L.csvEscape('@cmd'), "'@cmd");
  assert.equal(L.csvEscape('+cmd|x'), "'+cmd|x");
  assert.equal(L.csvEscape('+33 6 12 34 56 78'), '+33 6 12 34 56 78');
  assert.equal(L.csvEscape('-5'), '-5');
  assert.equal(L.csvEscape('a;b'), '"a;b"');
});

console.log('ok - identifiants des fiches de démonstration');
