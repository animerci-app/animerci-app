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


/* ---- v1.14.0 (lot K) ---- */
t('tâches : tri par priorité puis échéance, terminées en dernier', () => {
  const r = [{ done: false, priorite: 'basse', echeance: '2026-01-01' }, { done: true, priorite: 'haute' }, { done: false, priorite: 'haute', echeance: '2027-01-01' }, { done: false, echeance: '2026-05-01' }].sort(L.comparerTaches);
  assert.deepEqual(r.map(x => x.priorite || '-'), ['haute', '-', 'basse', 'haute']);
  assert.equal(r[3].done, true);
});
t('confirmation d\'inscription : prénom, activité, date, coût ; sans ligne vide en trop', () => {
  const x = L.texteConfirmation({ prenom: 'Rose', activite: 'Chorale', quand: 'mar. 3 décembre · 14h', lieu: 'Salle 1', cout: 'gratuite', modalites: '', signature: 'Service' });
  assert.match(x, /^Bonjour Rose,/); assert.match(x, /« Chorale », mar\. 3 décembre · 14h, Salle 1\./); assert.match(x, /Participation : gratuite\./);
  assert.ok(!/\n\n\n/.test(x)); assert.ok(!/À savoir/.test(x));
  assert.match(L.texteConfirmation({ activite: 'X' }), /^Bonjour,/);
});
t('proposition de place libérée', () => assert.match(L.texteProposition({ prenom: 'Léa', activite: 'Marche', quand: 'lun. 1er', lieu: '' }), /Une place vient de se libérer pour « Marche », lun\. 1er\./));
t('programme : activités datées par mois (triées) puis régulières ; hors période exclues', () => {
  const p = L.programme([{ nom: 'B', date: '2026-12-03' }, { nom: 'A', date: '2026-12-01' }, { nom: 'C', date: '2027-01-05' }, { nom: 'R', jour: 'Lundis' }, { nom: 'Vide' }, { nom: 'Z', date: '2027-05-01' }], '2026-12-01', '2027-01-31');
  assert.deepEqual(p.mois.map(m => [m.mois, m.items.map(a => a.nom)]), [['2026-12', ['A', 'B']], ['2027-01', ['C']]]);
  assert.deepEqual(p.regulieres.map(a => a.nom), ['R']);
});
t('alertes de l\'accueil : retard, priorité haute, attente, appels à valider', () => {
  const al = L.alertesAccueil({ activites: [{ id: 'a', nom: 'Chorale' }], inscriptions: [{ activiteId: 'a', statut: 'attente' }, { activiteId: 'a', statut: 'inscrit' }, { activiteId: 'zz', statut: 'attente' }], seances: [{ activiteId: 'a', valide: false }, { activiteId: 'a', valide: true }],
    taches: [{ titre: 'T', echeance: '2026-11-01', done: false }, { titre: 'U', priorite: 'haute', echeance: '2027-01-01' }, { titre: 'V', done: true, echeance: '2026-01-01' }], auj: '2026-11-23' });
  assert.deepEqual(al.map(x => x.niveau), ['crit', 'warn', 'warn', 'info']);
  assert.match(al[0].texte, /1 tâche en retard : T/); assert.match(al[1].texte, /priorité haute : U/); assert.match(al[2].texte, /1 personne en attente d'une place : Chorale/); assert.match(al[3].texte, /1 appel à valider : Chorale/);
  assert.deepEqual(L.alertesAccueil({ activites: [], inscriptions: [], seances: [], taches: [], auj: '2026-11-23' }), []);
});
t('chargement du planning : une seule lecture couvrant 1, 2 ou 3 mois', () => {
  const lit = nb => besoins({ role: 'admin', view: 'planning', mois: { a: 2026, m: 10 }, nbMois: nb, auj: '2026-11-23', activites: [], mesActivites: [] }).filter(b => b.col === 'seances');
  assert.equal(lit(1).length, 1); assert.deepEqual(lit(1)[0].filtre, [['date', '>=', '2026-11-01'], ['date', '<=', '2026-11-30']]);
  assert.deepEqual(lit(3)[0].filtre, [['date', '>=', '2026-11-01'], ['date', '<=', '2027-01-31']]);
  assert.deepEqual(lit(9)[0].filtre, [['date', '>=', '2026-11-01'], ['date', '<=', '2027-01-31']]);
  assert.deepEqual(lit(undefined)[0].filtre, lit(1)[0].filtre);
});

console.log('ok - identifiants des fiches de démonstration');

// Lot C : rôle partenaire dans besoins() : uniquement ses propres échanges
{
  const b = besoins({ role: 'partenaire', uid: 'p1', view: 'mespart', auj: '2026-11-23', activites: [] }).map(x => x.col + ':' + x.key);
  assert.deepEqual(b.sort(), ['echanges:mes', 'parametres:all']);
  assert.ok(!besoins({ role: 'partenaire', uid: 'p1', view: 'home', auj: '2026-11-23' }).some(x => ['contacts', 'seniors', 'activites', 'conventions'].includes(x.col)));
  console.log('ok - partenaire : chargement limité à ses échanges');
}

/* ---------- Lot A (1.17.0) : matériel, réserves, emprunts ---------- */
{
  const ok = (c, m) => { assert.ok(c, m); };
  const AUJ = '2026-11-23';
  // nombres
  assert.equal(L.lireNombre('2,5'), 2.5); assert.ok(Number.isNaN(L.lireNombre(''))); assert.equal(L.fmtQte(2.5), '2,5'); assert.equal(L.fmtQte(3), '3');
  // validations
  assert.match(L.erreurMateriel({ type: 'objet', nom: '', quantite: 1 }), /nom/);
  assert.match(L.erreurMateriel({ type: 'caisse', nom: 'x', numero: '', quantite: 1, etat: 'bon' }), /numéro/);
  assert.match(L.erreurMateriel({ type: 'objet', nom: 'x', quantite: 1.5, etat: 'bon', seuil: 0 }), /entier/);
  assert.match(L.erreurMateriel({ type: 'objet', nom: 'x', quantite: -1, etat: 'bon', seuil: 0 }), /quantité/);
  assert.equal(L.erreurMateriel({ type: 'reserve', nom: 'Café', quantite: 2.5, seuil: 1, peremption: 'aucun' }), '');
  assert.match(L.erreurMateriel({ type: 'reserve', nom: 'x', quantite: 1, peremption: 'article', datePeremption: '' }), /péremption/);
  assert.match(L.erreurMateriel({ type: 'reserve', nom: 'x', peremption: 'lot', lots: [] }), /au moins un lot/);
  assert.match(L.erreurMateriel({ type: 'reserve', nom: 'x', peremption: 'lot', lots: [{ quantite: 2, date: '' }] }), /date de péremption/);
  assert.equal(L.erreurMateriel({ type: 'reserve', nom: 'x', peremption: 'lot', lots: [{ quantite: 2, date: '2027-01-01' }] }), '');
  // champs calculés
  const biscuits = L.preparerMateriel({ type: 'reserve', nom: 'Biscuits', unite: 'boîte(s)', seuil: 5, peremption: 'lot', quantite: 0, lots: [{ libelle: 'Lot 1', quantite: 4, date: '2026-12-05' }, { libelle: 'Lot 2', quantite: 5, date: '2027-06-01' }] }, null, { par: 'Alice', auj: AUJ });
  assert.equal(biscuits.quantite, 9); assert.equal(biscuits.echeance, '2026-12-05'); assert.equal(biscuits.bas, false);
  assert.ok(biscuits.lots.every(l => l.id && l.par === 'Alice' && l.le === AUJ), 'lots nouveaux : relevé par/le = auteur et date du jour');
  assert.equal(biscuits.modifiePar, 'Alice');
  // « relevé par » ne change que si la date change
  const l1 = biscuits.lots[0], l2 = biscuits.lots[1];
  const modif = L.preparerMateriel({ ...biscuits, lots: [{ ...l1, quantite: 3 }, { ...l2, date: '2027-07-01' }] }, biscuits, { par: 'Bob', auj: '2026-11-30' });
  assert.equal(modif.lots[0].par, 'Alice'); assert.equal(modif.lots[0].le, AUJ); assert.equal(modif.lots[1].par, 'Bob'); assert.equal(modif.lots[1].le, '2026-11-30');
  assert.equal(modif.quantite, 8);
  // article entier : relevé par/le
  const cafe = L.preparerMateriel({ type: 'reserve', nom: 'Café', unite: 'paquet(s)', quantite: 3, seuil: 4, peremption: 'article', datePeremption: '2027-03-01' }, null, { par: 'Alice', auj: AUJ });
  assert.equal(cafe.bas, true); assert.equal(cafe.echeance, '2027-03-01'); assert.equal(cafe.peremptionPar, 'Alice');
  const cafe2 = L.preparerMateriel({ ...cafe, quantite: 10 }, cafe, { par: 'Bob', auj: '2026-12-01' });
  assert.equal(cafe2.peremptionPar, 'Alice'); assert.equal(cafe2.peremptionLe, AUJ); assert.equal(cafe2.bas, false);
  const cafe3 = L.preparerMateriel({ ...cafe, datePeremption: '2027-05-01' }, cafe, { par: 'Bob', auj: '2026-12-01' });
  assert.equal(cafe3.peremptionPar, 'Bob'); assert.equal(cafe3.peremptionLe, '2026-12-01');
  // passage en « sans péremption » : plus d'échéance
  assert.equal(L.preparerMateriel({ ...cafe, peremption: 'aucun' }, cafe, { par: 'Bob', auj: AUJ }).echeance, '');
  // stock à zéro : plus d'échéance
  assert.equal(L.preparerMateriel({ ...cafe, quantite: 0 }, cafe, { par: 'Bob', auj: AUJ }).echeance, '');
  // textes explicites pour l'équipe
  assert.match(L.textesPeremption(cafe)[0], /relevée le 23\/11\/2026 par Alice : 01\/03\/2027 — concerne l'article entier/);
  const tl = L.textesPeremption(biscuits); assert.equal(tl.length, 2); assert.match(tl[0], /concerne le lot « Lot 1 » \(4 boîte\(s\)\)/); assert.match(tl[0], /par Alice/);
  // objets : état « manquant »
  assert.equal(L.derivesMateriel({ type: 'objet', etat: 'manquant', quantite: 3, seuil: 0 }).manquant, true);
  assert.equal(L.derivesMateriel({ type: 'objet', etat: 'bon', quantite: 3, seuil: 3 }).bas, true);
  assert.equal(L.derivesMateriel({ type: 'caisse', etat: 'bon', quantite: 0, seuil: 5 }).bas, false, 'pas de seuil pour une caisse');
  // mouvements : article
  let r = L.appliquerMouvement(cafe, { sens: 'sortie', quantite: 2 }, { par: 'Bob', auj: AUJ }); assert.equal(r.materiel.quantite, 1); assert.equal(r.apres, 1); assert.equal(r.materiel.bas, true);
  assert.match(L.appliquerMouvement(cafe, { sens: 'sortie', quantite: 5 }, {}).erreur, /Stock insuffisant : il en reste 3/);
  assert.match(L.appliquerMouvement(cafe, { sens: 'entree', quantite: 0 }, {}).erreur, /supérieure à 0/);
  assert.match(L.appliquerMouvement(cafe, { sens: 'x', quantite: 1 }, {}).erreur, /entrée ou sortie/);
  assert.match(L.appliquerMouvement({ ...cafe, type: 'objet' }, { sens: 'entree', quantite: 1 }, {}).erreur, /réserves/);
  r = L.appliquerMouvement(cafe, { sens: 'entree', quantite: 2.5, lotDate: '2027-09-01' }, { par: 'Bob', auj: '2026-12-01' });
  assert.equal(r.materiel.quantite, 5.5); assert.equal(r.materiel.datePeremption, '2027-09-01'); assert.equal(r.materiel.peremptionPar, 'Bob');
  r = L.appliquerMouvement(cafe, { sens: 'entree', quantite: 1 }, { par: 'Bob', auj: '2026-12-01' }); assert.equal(r.materiel.peremptionPar, 'Alice', 'sans nouvelle date, le relevé ne change pas');
  // mouvements : lots
  r = L.appliquerMouvement(biscuits, { sens: 'sortie', quantite: 4, lotId: l1.id }, { par: 'Bob', auj: AUJ });
  assert.equal(r.materiel.lots.length, 1, 'le lot vide disparaît'); assert.equal(r.materiel.quantite, 5); assert.equal(r.materiel.echeance, '2027-06-01'); assert.equal(r.lot, 'Lot 1');
  assert.match(L.appliquerMouvement(biscuits, { sens: 'sortie', quantite: 9, lotId: l1.id }, {}).erreur, /insuffisant dans ce lot/);
  assert.match(L.appliquerMouvement(biscuits, { sens: 'sortie', quantite: 1 }, {}).erreur, /lot concerné/);
  r = L.appliquerMouvement(biscuits, { sens: 'entree', quantite: 6, lotLibelle: 'Don de mars', lotDate: '2027-02-01' }, { par: 'Carla', auj: '2026-12-02' });
  assert.equal(r.materiel.lots.length, 3); assert.equal(r.materiel.quantite, 15); assert.equal(r.materiel.lots[2].par, 'Carla'); assert.equal(r.lot, 'Don de mars');
  assert.match(L.appliquerMouvement(biscuits, { sens: 'entree', quantite: 1 }, {}).erreur, /date de péremption du nouveau lot/);
  r = L.appliquerMouvement(biscuits, { sens: 'entree', quantite: 1, lotId: l2.id, lotDate: '2027-08-01' }, { par: 'Carla', auj: '2026-12-02' });
  assert.equal(r.materiel.lots[1].quantite, 6); assert.equal(r.materiel.lots[1].date, '2027-08-01'); assert.equal(r.materiel.lots[1].par, 'Carla');
  // le matériel d'origine n'est pas modifié (fonction pure)
  assert.equal(biscuits.lots[0].quantite, 4);
  // emprunts
  const verres = { id: 'v', type: 'objet', nom: 'Verres', quantite: 18 };
  const emp = [{ id: 'e1', materielId: 'v', quantite: 6, rendu: false }, { id: 'e2', materielId: 'v', quantite: 4, rendu: true }, { id: 'e3', materielId: 'autre', quantite: 9, rendu: false }];
  assert.equal(L.pretes(verres, emp), 6); assert.equal(L.disponible(verres, emp), 12); assert.equal(L.disponible(verres, emp, 'e1'), 18);
  const E0 = { materielId: 'v', quantite: 3, emprunteur: 'Service jeunesse', dateSortie: '2026-11-20', retourPrevu: '2026-11-27' };
  assert.equal(L.erreurEmprunt(E0, verres, emp), '');
  assert.match(L.erreurEmprunt({ ...E0, quantite: 13 }, verres, emp), /il n'en reste que 12/);
  assert.match(L.erreurEmprunt({ ...E0, quantite: 0 }, verres, emp), /entière/); assert.match(L.erreurEmprunt({ ...E0, quantite: 1.5 }, verres, emp), /entière/);
  assert.match(L.erreurEmprunt({ ...E0, emprunteur: ' ' }, verres, emp), /qui emprunte/);
  assert.match(L.erreurEmprunt({ ...E0, retourPrevu: '2026-11-19' }, verres, emp), /avant la date de sortie/);
  assert.match(L.erreurEmprunt({ ...E0, dateSortie: '' }, verres, emp), /date de sortie/); assert.match(L.erreurEmprunt({ ...E0, retourPrevu: '' }, verres, emp), /retour prévue/);
  assert.match(L.erreurEmprunt(E0, null, emp), /Choisissez le matériel/); assert.match(L.erreurEmprunt(E0, { ...verres, type: 'reserve' }, emp), /ne se prête pas/);
  assert.equal(L.erreurEmprunt({ ...E0, id: 'e1', quantite: 18 }, verres, emp), '', 'modifier un emprunt ne compte pas ses propres pièces');
  assert.match(L.erreurEmprunt(E0, verres, [{ materielId: 'v', quantite: 18, rendu: false }]), /Plus rien à prêter/);
  // retour complet / partiel
  const E1 = { id: 'e1', materielId: 'v', materielNom: 'Verres', quantite: 6, dateSortie: '2026-11-10', retourPrevu: '2026-11-15', rendu: false, emprunteur: 'X', commentaire: 'Pot' };
  let s = L.solderEmprunt(E1, { quantiteRendue: 6, date: '2026-11-18', etat: 'bon' }); assert.equal(s.clos.rendu, true); assert.equal(s.clos.retourReel, '2026-11-18'); assert.equal(s.reste, null);
  s = L.solderEmprunt(E1, { quantiteRendue: 4, date: '2026-11-18', etat: 'reparer' }); assert.equal(s.clos.quantite, 4); assert.equal(s.clos.etatRetour, 'reparer'); assert.equal(s.reste.quantite, 2); assert.equal(s.reste.rendu, false); assert.ok(!('id' in s.reste)); assert.match(s.reste.commentaire, /retour partiel du 18\/11\/2026/);
  assert.match(L.solderEmprunt(E1, { quantiteRendue: 7, date: '2026-11-18' }).erreur, /entre 1 et 6/); assert.match(L.solderEmprunt(E1, { quantiteRendue: 0, date: '2026-11-18' }).erreur, /entre 1 et 6/);
  assert.match(L.solderEmprunt(E1, { quantiteRendue: 6, date: '2026-11-09' }).erreur, /avant la date de sortie/); assert.match(L.solderEmprunt(E1, { quantiteRendue: 6, date: '' }).erreur, /date de retour/);
  assert.match(L.solderEmprunt(E1, { quantiteRendue: 6, date: '2026-11-18', etat: 'zzz' }).erreur, /état/);
  assert.equal(L.statutEmprunt(E1, AUJ), 'retard'); assert.equal(L.statutEmprunt(E1, '2026-11-15'), 'encours'); assert.equal(L.statutEmprunt({ ...E1, rendu: true }, AUJ), 'rendu'); assert.equal(L.joursDeRetard(E1, AUJ), 8);
  // alertes
  const mat = [
    { id: 'a', type: 'objet', nom: 'Verres', quantite: 0, seuil: 5, etat: 'bon' }, { id: 'b', type: 'objet', nom: 'Plats', quantite: 3, seuil: 5, etat: 'manquant' },
    { id: 'c', type: 'reserve', nom: 'Café', unite: 'paquet(s)', quantite: 2, seuil: 4, peremption: 'article', datePeremption: '2026-11-20' },
    { id: 'd', type: 'reserve', nom: 'Thé', unite: 'boîte(s)', quantite: 9, seuil: 0, peremption: 'lot', lots: [{ id: 'x', libelle: 'Lot A', quantite: 5, date: '2026-12-10' }, { id: 'y', libelle: 'Lot B', quantite: 4, date: '2027-06-01' }] },
    { id: 'e', type: 'caisse', nom: 'Noël', numero: '1', quantite: 4, etat: 'manquant' }
  ];
  const al = L.alertesMateriel({ materiel: mat, emprunts: [E1], auj: AUJ, joursPeremption: 30 }), txt = al.map(a => a.niveau + ':' + a.texte).join('\n');
  assert.match(txt, /crit:1 produit périmé : Café \(20\/11\)/); assert.match(txt, /warn:1 produit à consommer dans les 30 jours : Thé \(Lot A\) \(10\/12\)/);
  assert.match(txt, /crit:1 article épuisé \(inventaire\) : Verres/); assert.match(txt, /warn:1 article en stock bas \(réserve\) : Café \(2 paquet\(s\)\)/);
  assert.match(txt, /crit:1 emprunt en retard : Verres \(X\)/); assert.match(txt, /warn:2 matériels déclarés manquants : Plats, Noël/);
  assert.ok(al.every(a => a.vue === 'materiel' && a.tab));
  assert.equal(L.alertesMateriel({ materiel: [], emprunts: [], auj: AUJ }).length, 0);
  // alertes de l'accueil : le matériel y est intégré
  assert.ok(L.alertesAccueil({ activites: [], inscriptions: [], seances: [], taches: [], auj: AUJ, materiel: mat, emprunts: [E1] }).some(a => a.vue === 'materiel'));
  // tableaux d'export
  const T = L.tableauxMateriel({ materiel: [{ ...biscuits, id: 'b1' }, { ...cafe, id: 'c1' }, { id: 'o1', type: 'objet', nom: 'Verres', categorie: 'Verres', quantite: 18, etat: 'bon' }, { id: 'k1', type: 'caisse', nom: 'Guirlandes', numero: '2', saison: 'Noël', quantite: 3, etat: 'bon' }], emprunts: [{ ...E1, materielId: 'o1' }], mouvements: [{ date: '2026-11-01', materielNom: 'Café', sens: 'entree', quantite: 6, motif: 'Achat', apres: 6, par: 'Alice' }] }, AUJ);
  assert.deepEqual(T.map(x => x.nom), ['Inventaire', 'Réserves', 'Caisses', 'Emprunts', 'Mouvements de stock']);
  assert.equal(T[1].rows.length, 3, 'réserves : une ligne par lot + une pour l\'article entier'); assert.ok(T[1].rows.some(r => r.includes('Lot « Lot 1 »')));
  assert.equal(T[0].rows[0][3], 6, 'inventaire : quantité prêtée'); assert.equal(T[0].rows[0][4], 12); assert.equal(T[3].rows[0][7], 'En retard');
  for (const t of T) for (const row of t.rows) assert.equal(row.length, t.cols.length, 'tableau ' + t.nom + ' : colonnes cohérentes');
  console.log('ok - lot A : matériel, péremption par article ou par lot, mouvements, emprunts, alertes, exports');
}
// Lot A : chargement à la demande (matériel)
{
  const cols = b => b.map(x => x.col + ':' + x.key).sort();
  const base = { auj: '2026-11-23', activites: [], mesActivites: [], horizonPeremption: '2026-12-23' };
  // administratrice sur l'accueil : seulement les articles concernés + emprunts non rendus (pas tout le matériel)
  const home = cols(besoins({ ...base, role: 'admin', view: 'home' })); assert.ok(home.includes('materiel:bas') && home.includes('materiel:manquant') && home.includes('materiel:peremp-2026-12-23') && home.includes('emprunts:ouverts')); assert.ok(!home.includes('materiel:all'));
  const f = besoins({ ...base, role: 'admin', view: 'home' }).find(b => b.key.startsWith('peremp'));
  assert.deepEqual(f.filtre, [['echeance', '>', '0'], ['echeance', '<=', '2026-12-23']], 'plage sur un seul champ : aucun index à créer');
  // écran Matériel : tout le matériel, emprunts ouverts ; rendus seulement dans l'onglet Emprunts ; historique et personnes à la demande
  assert.deepEqual(cols(besoins({ ...base, role: 'admin', view: 'materiel', ongletMat: 'inventaire' })).filter(x => /materiel|emprunts|mouvements|seniors|contacts|users/.test(x)), ['emprunts:ouverts', 'materiel:all']);
  assert.ok(cols(besoins({ ...base, role: 'admin', view: 'materiel', ongletMat: 'emprunts', anMat: '2025' })).includes('emprunts:rendus-2025'));
  assert.deepEqual(besoins({ ...base, role: 'admin', view: 'materiel', ongletMat: 'emprunts' }).find(b => b.key === 'rendus-2026').filtre, [['retourReel', '>=', '2026-01-01'], ['retourReel', '<=', '2026-12-31']]);
  assert.ok(cols(besoins({ ...base, role: 'admin', view: 'materiel', matHisto: 'abc' })).includes('mouvements:m-abc'));
  assert.ok(!cols(besoins({ ...base, role: 'admin', view: 'materiel' })).includes('seniors:all'));
  assert.ok(['seniors:all', 'contacts:all', 'users:all'].every(x => cols(besoins({ ...base, role: 'admin', view: 'materiel', matPersonnes: true })).includes(x)));
  // équipe : le matériel sans rien d'autre que son périmètre (jamais les personnes, l'annuaire ni les comptes)
  for (const role of ['intervenant', 'benevole']) {
    const b = cols(besoins({ ...base, role, view: 'materiel', matPersonnes: true, mesActivites: [] }));
    assert.ok(b.includes('materiel:all') && b.includes('emprunts:ouverts'), role + ' : charge le matériel');
    assert.ok(!b.some(x => /^(seniors|contacts|users|conventions|echanges|fiches|taches)/.test(x)), role + ' : aucune donnée hors de son périmètre');
    assert.ok(!cols(besoins({ ...base, role, view: 'planning' })).some(x => /materiel|emprunts/.test(x)), role + ' : rien du matériel hors de l\'écran Matériel');
  }
  assert.ok(!cols(besoins({ ...base, role: 'partenaire', uid: 'p', view: 'materiel' })).some(x => /materiel|emprunts/.test(x)), 'le partenaire n\'a aucun accès au matériel');
  console.log('ok - lot A : chargement à la demande du matériel');
}

/* ---------- Lot F (1.18.0) : fiches enrichies, adhésions par année, vérification ---------- */
{
  const AUJ = '2026-11-23';
  // année cible : à partir du mois de début (décembre par défaut)
  assert.equal(L.anneeCible('2026-11-30'), 2026); assert.equal(L.anneeCible('2026-12-01'), 2027); assert.equal(L.anneeCible('2026-10-01', 10), 2027); assert.equal(L.anneeCible('2027-01-02'), 2027);
  // ancien format → adhésions
  const vieux = { id: 'a', statut: 'adherent', nom: 'Dupont', prenom: 'Anne', adhesion: { date: '2026-01-10', montant: 40, paye: true }, tel: '06 11 22 33 44', contactNom: 'Fille : Sophie', contactTel: '03 20 00 00 00' };
  assert.deepEqual(L.adhesionsDe(vieux).map(a => [a.annee, a.montant, a.paye]), [[2026, 40, true]]);
  assert.equal(L.adhesionAJour(vieux, 2026), true); assert.equal(L.adhesionAJour(vieux, 2027), false);
  assert.equal(L.adhesionAJour({ statut: 'resident' }, 2030), true); assert.equal(L.adhesionAJour({ statut: 'autre' }, 2030), true);
  assert.deepEqual(L.adhesionsDe({ statut: 'adherent' }), []); assert.deepEqual(L.adhesionsDe(null), []);
  assert.equal(L.adhesionsDe(vieux)[0].datePaiement, '2026-01-10', 'ancienne adhésion réglée sans date de règlement : la date d\'adhésion en tient lieu');
  // statuts
  assert.equal(L.statutAdhesion(vieux, 2026), 'reglee'); assert.equal(L.statutAdhesion(vieux, 2027), 'a-renouveler');
  assert.equal(L.statutAdhesion({ statut: 'adherent' }, 2026), 'a-regler', 'jamais réglée : à régler');
  assert.equal(L.statutAdhesion({ statut: 'adherent', adhesions: [{ annee: 2026, date: '2026-02-01', montant: 40, paye: false }] }, 2026), 'a-regler');
  assert.equal(L.statutAdhesion({ statut: 'resident' }, 2026), 'na'); assert.equal(L.statutAdhesion(null, 2026), 'na');
  // validation
  assert.equal(L.erreurAdhesion({ annee: 2026, date: '2026-01-10', montant: 40, paye: false }), '');
  assert.match(L.erreurAdhesion({ annee: 1999, montant: 1 }), /année/); assert.match(L.erreurAdhesion({ annee: 2026, montant: -3 }), /montant/);
  assert.match(L.erreurAdhesion({ annee: 2026, montant: 40, paye: true, datePaiement: '' }), /date de règlement/); assert.match(L.erreurAdhesion({ annee: 2026, date: '10/01/2026' }), /illisible/);
  // renouvellement
  let r = L.renouveler(vieux, 2027, { auj: AUJ, montant: 40 }); assert.equal(r.adhesions.length, 2); assert.equal(r.adhesions[1].annee, 2027); assert.equal(r.adhesions[1].paye, false); assert.equal(r.adhesions[0].paye, true);
  assert.match(L.renouveler(vieux, 2026, { auj: AUJ }).erreur, /existe déjà/); assert.match(L.renouveler({ statut: 'resident' }, 2027, { auj: AUJ }).erreur, /adhérent/);
  // règlement : mode et date ; relance conservée
  const reg = L.avecAdhesion({ ...vieux, adhesions: r.adhesions }, { annee: 2027, montant: 40, paye: true, mode: 'Chèque', datePaiement: '2027-01-15' });
  assert.equal(reg.find(a => a.annee === 2027).mode, 'Chèque'); assert.equal(reg.find(a => a.annee === 2027).date, AUJ, 'la date d\'adhésion est conservée');
  const rel = L.marquerRelance({ ...vieux, adhesions: r.adhesions }, 2027, '2026-12-05'); assert.equal(rel.find(a => a.annee === 2027).relanceLe, '2026-12-05');
  const rel2 = L.marquerRelance(vieux, 2027, '2026-12-05', 40); assert.equal(rel2.length, 2); assert.equal(rel2[1].paye, false);
  assert.equal(L.avecAdhesion({ ...vieux, adhesions: reg }, { annee: 2027, montant: 40, paye: false }).find(a => a.annee === 2027).mode, '', 'non réglée : plus de mode ni de date de règlement');
  // dernière année réglée (requêtes de l'accueil)
  assert.equal(L.derniereAnneeReglee(vieux), 2026); assert.equal(L.derniereAnneeReglee({ statut: 'adherent' }), 0); assert.equal(L.derniereAnneeReglee({ statut: 'resident' }), 9999);
  // téléphones et proches (anciens formats)
  assert.deepEqual(L.telephones(vieux), { fixe: '', portable: '06 11 22 33 44' }); assert.deepEqual(L.telephones({ tel: '03 20 11 22 33' }), { fixe: '03 20 11 22 33', portable: '' });
  assert.deepEqual(L.telephones({ telFixe: '03', telPortable: '' }), { fixe: '03', portable: '' }); assert.deepEqual(L.telephones({}), { fixe: '', portable: '' });
  assert.deepEqual(L.prochesDe(vieux), [{ nom: 'Fille : Sophie', lien: '', tel: '03 20 00 00 00' }]);
  assert.equal(L.prochesDe({ proches: [{ nom: 'A', tel: '1' }, { nom: '', tel: '' }, { nom: 'B' }, { nom: 'C' }, { nom: 'D' }] }).length, 3, '3 proches au plus, lignes vides ignorées');
  // champs calculés / migration
  const c = L.completerSenior(vieux);
  assert.equal(c.adhAnnee, 2026); assert.equal(c.telPortable, '06 11 22 33 44'); assert.equal(c.tel, '06 11 22 33 44'); assert.equal(c.contactNom, 'Fille : Sophie'); assert.equal(c.verifieLe, ''); assert.deepEqual(c.adhesion, { date: '2026-01-10', montant: 40, paye: true });
  assert.equal(L.besoinMigration(vieux), true); assert.equal(L.besoinMigration(c), false, 'une fiche convertie n\'est plus à migrer'); assert.equal(L.besoinMigration(L.completerSenior({ statut: 'resident', nom: 'X' })), false);
  assert.equal(L.completerSenior({ statut: 'resident', adhesion: { date: '2026-01-01', paye: true } }).adhesion, null, 'résident·e : pas d\'adhésion');
  assert.equal(L.completerSenior({ statut: 'resident' }).adhAnnee, 9999);
  assert.equal(L.completerSenior({ ...c, telFixe: '03 20', telPortable: '' }).tel, '03 20', 'tel (compatibilité) = portable sinon fixe');
  // la conversion est idempotente
  assert.deepEqual(L.completerSenior(c), c);
  // vérification annuelle
  assert.equal(L.seuilVerification('2026-11-23', 12), '2025-11-23'); assert.equal(L.seuilVerification('2026-03-31', 1), '2026-03-03', 'mois plus court : repli de JS');
  assert.equal(L.aVerifier({ verifieLe: '' }, AUJ), true); assert.equal(L.aVerifier({}, AUJ), true); assert.equal(L.aVerifier({ verifieLe: '2025-11-22' }, AUJ), true);
  assert.equal(L.aVerifier({ verifieLe: '2025-11-23' }, AUJ), false); assert.equal(L.aVerifier({ verifieLe: '2026-01-01' }, AUJ, 12), false); assert.equal(L.aVerifier({ verifieLe: '2026-01-01' }, AUJ, 6), true);
  assert.deepEqual(L.marquerVerifiee({ id: 'x' }, { par: 'Alice', auj: AUJ }), { id: 'x', verifieLe: AUJ, verifiePar: 'Alice' });
  // alertes
  assert.equal(L.alertesFiches({}).length, 0);
  const al = L.alertesFiches({ adh: 2, verif: 1, cible: 2027, mois: 12 }); assert.match(al[0].texte, /2 adhésions à renouveler ou à régler pour 2027/); assert.equal(al[0].tab, 'adhesions'); assert.match(al[1].texte, /1 fiche à vérifier \(non vérifiée depuis plus de 12 mois\)/); assert.ok(al.every(a => a.vue === 'seniors'));
  assert.ok(L.alertesAccueil({ activites: [], inscriptions: [], seances: [], taches: [], auj: AUJ, fiches: { adh: 3, verif: 0, cible: 2026 } }).some(a => a.tab === 'adhesions'));
  assert.equal(L.alertesAccueil({ activites: [], inscriptions: [], seances: [], taches: [], auj: AUJ }).length, 0);
  // message de relance
  assert.match(L.messageRelance(vieux, 2027, { service: 'Animation', montant: 40 }), /^Bonjour Anne,\n\nil est temps de renouveler votre adhésion pour 2027 \(40 €\)\./);
  assert.match(L.messageRelance({ statut: 'adherent', prenom: 'Luc' }, 2026, {}), /cotisation 2026 n'est pas encore réglée/);
  // tableaux
  const S2 = [c, { id: 'b', statut: 'resident', nom: 'Zed', prenom: 'Z' }, L.completerSenior({ id: 'd', statut: 'adherent', nom: 'Abel', prenom: 'Ben', telPortable: '07 00', email: 'b@x.fr', adhesions: [{ annee: 2026, date: '2026-02-02', montant: 40, paye: false }, { annee: 2025, date: '2025-02-02', montant: 40, paye: true, datePaiement: '2025-02-03', mode: 'Chèque' }] })];
  const T = L.tableauxAdhesions(S2, 2026); assert.equal(T[0].rows.length, 2, 'seulement les adhérent·es'); assert.equal(T[0].rows[0][0], 'Abel', 'classé par patronyme'); assert.equal(T[0].rows[0][2], 'À régler'); assert.equal(T[1].rows.length, 3);
  for (const t of T) for (const row of t.rows) assert.equal(row.length, t.cols.length);
  const V = L.tableauVerification(S2, AUJ, 12, 'Résidence'); assert.equal(V.rows.length, 3); for (const row of V.rows) assert.equal(row.length, V.cols.length);
  assert.ok(V.rows.some(row => row[3] === 'Résidence'), 'résident·e : lieu de vie');
  // le test historique (alertes) reste vrai : adhesionAJour sur l'année en cours
  assert.equal(L.cotisationARegler({ statut: 'adherent', adhesion: { date: `${new Date().getFullYear()}-01-02`, paye: false } }), true);
  console.log('ok - lot F : adhésions par année, renouvellement, proches, téléphones, vérification, alertes, exports');
}
