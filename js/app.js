// Point d'entrée : connexion, navigation par rôle, abonnement aux données, événements.
import { store, MODE_REEL, COLS } from './store.js';
import { S, $, esc, setRender, render, toast, modal, closeModal, confirmer, aujourdhui, ajouterJours, pret } from './ui.js';
import { besoins } from './donnees.js';
import * as core from './views-core.js';
import * as act from './views-activites.js';
import * as eq from './views-equipe.js';
import * as ann from './annuaire.js';
import * as part from './partenaires.js';
import * as mat from './materiel.js';
import * as adhs from './adhesions.js';
import * as pg from './portage.js';
import * as ac from './accueils.js';
import * as ins from './inscrire.js';
import * as bud from './budgets.js';
import * as reg from './regie.js';
import * as quest from './questionnaires.js';
import * as voy from './voyages.js';
import * as L from './logic.js';
import { installerRecherche, oublierRecents, champRecherche, itemPersonne, itemContact, itemActivite, AIDE_PERSONNE } from './recherche.js';
import * as imp from './importer.js';
import * as pwa from './pwa.js';
import * as sec from './securite.js';
import { VERSION } from './version.js';
import * as pa from './parametres.js';
import { P, moduleActif } from './parametres.js';

const NAV = {
  admin: [['home', 'Accueil', '⌂'], ['seniors', 'Personnes', '☺'], ['activites', 'Activités', '♥'], ['planning', 'Planning', '▦'], ['taches', 'Tâches', '✓'], ['materiel', 'Matériel', '▣'], ['budgets', 'Budgets', '💰'], ['regie', 'Régie', '🏦'], ['bilans', 'Bilans', '▮'], ['annuaire', 'Annuaire', '☎'], ['partenaires', 'Partenaires', '⇄'], ['portage', 'Portage', '◉'], ['accueils', 'Accueils', '☼'], ['questionnaires', 'Questionnaires', '✎'], ['voyages', 'Voyages et sorties', '✈'], ['equipe', 'Équipe', '☻'], ['parametres', 'Paramètres', '⚙'], ['sauvegarde', 'Sécurité', '⛨']],
  // Intervenant·e : ses activités et le planning ; bénévole : le planning. Matériel, Portage, Budgets et régie, Saisie des inscriptions s'ajoutent si l'administratrice a coché l'accès (Équipe).
  intervenant: [['activites', 'Mes activités', '♥'], ['planning', 'Planning', '▦'], ['materiel', 'Matériel', '▣'], ['budgets', 'Budgets', '💰'], ['regie', 'Régie', '🏦'], ['portage', 'Portage', '◉']],
  benevole: [['planning', 'Planning', '▦'], ['materiel', 'Matériel', '▣'], ['budgets', 'Budgets', '💰'], ['regie', 'Régie', '🏦'], ['portage', 'Portage', '◉'], ['inscrire', 'Inscriptions', '✎']],
  partenaire: [['mespart', 'Mes échanges', '⇄']]
};
// Modules facultatifs : masqués du menu quand l'administratrice les désactive (Paramètres)
const FACULTATIFS = { taches: 'taches', bilans: 'bilans', portage: 'portage', accueils: 'accueils', budgets: 'budgets', regie: 'budgets', questionnaires: 'questionnaires', voyages: 'voyages' };
const ACCES_NAV = { materiel: 'materiel', portage: 'portage', inscrire: 'inscriptions', budgets: 'budgets', regie: 'budgets' };
export const navPour = user => ((user && NAV[user.role]) || []).filter(([k]) => (!(k in FACULTATIFS) || moduleActif(FACULTATIFS[k])) && (user.role === 'admin' || !(k in ACCES_NAV) || L.accesActif(user, ACCES_NAV[k], aujourdhui())));
const ACCUEIL = { admin: 'home', intervenant: 'activites', benevole: 'planning', partenaire: 'mespart' };

/* ---------- Données ---------- */
// Chargement à la demande : on ne s'abonne qu'à ce que l'écran ouvert affiche (voir donnees.js). Chaque abonnement n'est créé qu'une fois.
let unsubs = [], parts = {}, actifs = new Set(), minuteurPurge = null, rendu = false;
const COLS_ECOUTE = COLS.concat(['users', 'corbeille', 'journal', 'parametres', 'contacts', 'echanges', 'conventions', 'materiel', 'emprunts', 'mouvements', 'portage', 'portageEchanges', 'accueils', 'seniorsLite', 'depenses', 'regie', 'questionnaires', 'reponsesQuestionnaire', 'voyages']);
function planifierRendu() { if (rendu) return; rendu = true; Promise.resolve().then(() => { rendu = false; render(); }); }
function listen(col, key, filtre, opts) {
  unsubs.push(store.subscribe(col, (rows, err) => {
    (parts[col] = parts[col] || {})[key] = rows; S.pret.add(col + '|' + key);
    // un même document peut figurer dans plusieurs abonnements : on ne le garde qu'une fois
    const m = new Map(); for (const lot of Object.values(parts[col])) for (const r of lot) m.set(r.id, r);
    S.cache[col] = [...m.values()];
    S.erreur = err ? `Lecture impossible (${col}) : ${err.code || err.message}. Vérifiez les règles de sécurité.` : '';
    planifierRendu();
  }, filtre, opts));
}
function synchroniser() {
  const u = S.user; if (!u || !u.role) return;
  const mes = (u.activites || []);
  for (const b of besoins({ role: u.role, uid: u.uid, view: S.view, actId: S.actId, mois: S.moisPlan || { a: new Date().getFullYear(), m: new Date().getMonth() }, nbMois: S.nbMois, stat: S.stat, anPart: S.anPart, partId: S.partId, ongletMat: mat.ongletMat(), anMat: S.anMat, ongletPortage: pg.ongletPortage(), anPortage: S.anPortage, portageActif: moduleActif('portage'), anBudgets: bud.anneeBudgets(), anRegie: reg.anneeRegie(), budgetsActif: moduleActif('budgets'), acces: { materiel: L.accesActif(u, 'materiel', aujourdhui()), portage: L.accesActif(u, 'portage', aujourdhui()), inscriptions: L.accesActif(u, 'inscriptions', aujourdhui()), budgets: L.accesActif(u, 'budgets', aujourdhui()) }, inscrActId: S.inscrActId, decembre: aujourdhui().slice(5, 7) === '12' && moduleActif('accueils'), matHisto: S.matHisto, matPersonnes: S.matPersonnes, horizonPeremption: ajouterJours(aujourdhui(), P('materiel.alertePeremptionJours')), questActId: S.questActId,
    rechGlobale: S.rechGlobale, onglet: sec.ongletCourant(), auj: aujourdhui(), horizonSorties: ajouterJours(aujourdhui(), 60), activites: S.cache.activites, mesActivites: mes })) {
    const k = b.col + '|' + b.key; if (actifs.has(k)) continue;
    actifs.add(k); listen(b.col, b.key, b.filtre, b.opts);
  }
  // Portage : l'administratrice met les documents des bénéficiaires en accord avec les fiches à chaque ouverture de l'écran
  if (u.role === 'admin' && S.view === 'portage') pg.synchroniser();
  // Personnes : l'administratrice tient à jour la copie restreinte lue par les bénévoles qui saisissent les inscriptions (une écriture par fiche modifiée)
  if (u.role === 'admin' && S.view === 'seniors') ins.synchroLite();
  // Écran « Activités » : places prises par activité, comptées côté serveur (beaucoup moins de lectures que de tout télécharger)
  // Accueil : alertes « adhésions » et « fiches à vérifier » comptées côté serveur (2 lectures, aucune fiche téléchargée)
  if (u.role === 'admin' && S.view === 'home' && S.compteursFichesNav !== S.navId) { S.compteursFichesNav = S.navId; const nav = S.navId; adhs.compterFiches().then(r => { if (nav === S.navId && S.user) { S.compteursFiches = r; planifierRendu(); } }).catch(e => console.warn('comptage des fiches', e)); }
  if (u.role === 'admin' && S.view === 'activites' && S.compteursNav !== S.navId && S.cache.activites.length) { S.compteursNav = S.navId; compterPlaces(S.navId); }
}
async function compterPlaces(navId) {
  const res = {};
  try {
    // deux comptages par activité, filtres d'égalité seulement (aucun index à créer) : retenus = total - en attente
    for (const a of S.cache.activites) {
      const total = await store.nombre('inscriptions', ['activiteId', '==', a.id]);
      const att = await store.nombre('inscriptions', [['activiteId', '==', a.id], ['statut', '==', 'attente']]);
      res[a.id] = { r: total - att, att };
    }
    if (navId === S.navId && S.user) { S.compteurs = res; planifierRendu(); }
  } catch (e) { console.warn('comptage des places', e); }
}
function demarrer() {
  arreter();
  if (S.user && S.user.role === 'admin') minuteurPurge = setTimeout(sec.purger, 5000);
  synchroniser();
}
function arreter() { clearTimeout(minuteurPurge); unsubs.forEach(u => u()); unsubs = []; parts = {}; actifs = new Set(); S.pret = new Set(); S.rechGlobale = false; S.matPersonnes = false; S.compteursFiches = null; S.compteursFichesNav = -1; S.ongletSen = 'liste'; S.anAdh = 0; S.fAdh = 'encours'; S.inscrActId = null; S.inscrQ = ''; S.ongletAccueils = null; S.liteErreur = false; S.acClos = false; S.rechAdh = ''; S.migrationFaite = false; S.portageSyncNav = -1; S.ongletPortage = 'beneficiaires'; S.fPortage = 'actifs'; S.rechPortage = ''; S.anPortage = 0; S.fEchPortage = 'tous'; S.rechEchPortage = ''; S.matHisto = null; S.ongletMat = 'inventaire'; S.fEmprunt = 'encours'; S.anMat = ''; S.rechMat = ''; S.fCatMat = ''; S.fEmpMat = ''; S.fSaisonMat = ''; S.fSigMat = false; S.compteurs = {}; S.compteursNav = -1; S.ongletBudgets = 'depenses'; S.anBudgets = 0; S.fBudget = ''; S.rechBudgets = ''; S.anRegie = 0; S.fRegie = 'toutes'; S.rechRegie = ''; S.questActId = null; S.ongletQuest = 'reponses'; S.rechVoyages = ''; COLS_ECOUTE.forEach(c => { S.cache[c] = []; }); }

/* ---------- Écrans ---------- */
function ecranConnexion() {
  return `<div class="login"><div class="card"><img class="logo-login" src="icons/icon-192.png" alt="" width="72" height="72"><h1>${esc(P('nomOutil'))}</h1><p class="sub">${esc(P('nomService'))}</p>
  ${MODE_REEL ? `<form id="fl"><div class="field"><label for="em">Adresse e-mail</label><input id="em" type="email" autocomplete="username" required></div>
    <div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required></div>
    <div id="lerr" class="err" style="display:none" role="alert"></div>
    <div class="quick" style="margin-top:12px"><button class="btn" type="submit">Se connecter</button><button class="btn ghost" type="button" data-action="reset-mdp">Mot de passe oublié</button></div></form>`
  : `<p>Mode démonstration : les données sont fictives et restent dans ce navigateur. Choisissez une vue pour essayer l'outil.</p>
    <div class="quick" style="flex-direction:column;align-items:stretch">
    <button class="btn" data-action="demo" data-v="admin">Essayer comme administratrice (accès complet)</button>
    <button class="btn blue" data-action="demo" data-v="intervenant">Essayer comme intervenante (appel de son atelier)</button>
    <button class="btn sec" data-action="demo" data-v="benevole">Essayer comme bénévole (planning)</button>
    <button class="btn sec" data-action="demo" data-v="partenaire">Essayer comme partenaire (ses échanges)</button></div>`}${pwa.boutonInstaller(true)}</div></div>`;
}
function ecranSansRole() {
  return `<div class="login"><div class="card"><h1>Accès à activer</h1><p>Votre compte (${esc(S.user.email)}) est bien connecté, mais aucun rôle ne lui a encore été attribué. Demandez à l'administratrice de l'activer.</p>
  ${S.user.erreur ? `<div class="err">${esc(S.user.erreur)}</div>` : ''}<button class="btn" data-action="logout">Se déconnecter</button></div></div>`;
}
function nav() {
  const items = navPour(S.user);
  const courante = S.view === 'activite' ? 'activites' : S.view;
  return `<div class="brand"><img src="icons/icon-192.png" alt="" width="34" height="34">${esc(P('nomOutil'))}</div>` + (S.user.role === 'admin' ? '<button class="nav-btn" data-action="rech-globale" style="background:rgba(255,255,255,.14)"><span aria-hidden="true" style="width:20px;text-align:center">⌕</span><span>Chercher</span></button>' : '') + items.map(([k, l, ic]) =>
    `<button class="nav-btn" data-action="nav" data-v="${k}" ${courante === k ? 'aria-current="page"' : ''}><span aria-hidden="true" style="width:20px;text-align:center">${ic}</span><span>${l}</span></button>`).join('') +
    // Sur téléphone le pied du menu est masqué : ce bouton ouvre la fenêtre « Mon compte » (déconnexion, mot de passe, installation)
    `<button class="nav-btn nav-compte" data-action="compte"><span aria-hidden="true" style="width:20px;text-align:center">☰</span><span>Compte</span></button>` +
    `<div class="foot"><div>${esc(S.user.nom)}</div><div style="font-size:12px;opacity:.7">Version ${VERSION}</div>${MODE_REEL ? '<button class="nav-btn" style="padding:6px 0;font-size:13px" data-action="mdp-form">Mon mot de passe</button>' : ''}${pwa.boutonInstaller()}<button class="nav-btn" style="padding:6px 0" data-action="logout">Se déconnecter</button>${MODE_REEL ? '' : '<button class="nav-btn" style="padding:6px 0;font-size:13px" data-action="reset-demo">Remettre les données de démonstration</button>'}</div>`;
}
const VUES = { home: core.accueil, seniors: core.seniors, taches: core.taches, planning: core.planning, bilans: core.bilans, activites: act.activites, activite: act.activite, annuaire: ann.annuaire, partenaires: part.partenaires, mespart: part.espacePartenaire, materiel: mat.materiel, budgets: bud.budgets, regie: reg.regie, portage: pg.portage, accueils: ac.accueils, questionnaires: quest.questionnaires, voyages: voy.voyages, inscrire: ins.inscrire, equipe: eq.equipe, sauvegarde: sec.securite, parametres: pa.parametres };

setRender(() => {
  synchroniser();
  const main = $('#main'), side = $('#nav'), banner = $('#banner');
  banner.innerHTML = MODE_REEL ? '' : '<div class="demo-banner">Mode démonstration : données fictives, enregistrées uniquement dans ce navigateur</div>';
  if (!S.user) { side.innerHTML = ''; side.style.display = 'none'; document.querySelector('.app').style.display = 'block'; main.innerHTML = ecranConnexion(); return; }
  if (!S.user.role) { side.style.display = 'none'; main.innerHTML = ecranSansRole(); return; }
  document.querySelector('.app').style.display = ''; side.style.display = '';
  const autorisees = navPour(S.user).map(x => x[0]).concat(['admin', 'intervenant'].includes(S.user.role) ? ['activite'] : []);
  if (!autorisees.includes(S.view)) S.view = ACCUEIL[S.user.role];
  side.innerHTML = nav();
  const faible = MODE_REEL && S.mdpLongueur && S.mdpLongueur < P('securite.motDePasseMin') ? `<div class="err" role="alert" style="background:#fff6e0;border-color:#e0b060;color:#5a3a00"><b>Votre mot de passe est trop court</b> (minimum ${P('securite.motDePasseMin')} caractères). <button class="btn sec" data-action="mdp-form" style="margin-left:8px">Le changer maintenant</button></div>` : '';
  main.innerHTML = faible + (S.erreur ? `<div class="err" role="alert">${esc(S.erreur)}</div>` : '') + (VUES[S.view] || core.accueil)();
  if (S.view === 'seniors') core.afterSeniors();
  if (S.view === 'annuaire') ann.apresAnnuaire();
  if (S.view === 'partenaires') part.apresPartenaires();
  if (S.view === 'materiel') mat.apresMateriel();
  if (S.view === 'budgets') bud.apresBudgets();
  if (S.view === 'regie') reg.apresRegie();
  if (S.view === 'portage') pg.apresPortage();
  if (S.view === 'voyages') voy.apresVoyages();
  if (S.view === 'inscrire') ins.apresInscrire();
  if (S.view === 'sauvegarde') sec.apresSecurite();
});

/* ---------- Événements ---------- */
const actions = {
  ...core.actions, ...act.actions, ...eq.actions, ...ann.actions, ...part.actions, ...mat.actions, ...bud.actions, ...reg.actions, ...pg.actions, ...ac.actions, ...quest.actions, ...voy.actions, ...ins.actions, ...adhs.actions, ...sec.actions, ...pa.actions, ...imp.actions, ...pwa.actions,
  'rech-globale': () => rechGlobale(),
  close: () => closeModal(),
  compte: () => {
    const roles = { admin: 'Administratrice', intervenant: 'Intervenant·e', benevole: 'Bénévole', partenaire: 'Partenaire' };
    modal(`<h2>Mon compte</h2><p style="margin:0"><b>${esc(S.user.nom)}</b></p><p class="sub" style="margin:0 0 12px">${esc(roles[S.user.role] || '')} · version ${VERSION}</p>
    <div class="quick" style="flex-direction:column;align-items:stretch">
    ${MODE_REEL ? '<button class="btn sec" data-action="mdp-form">Changer mon mot de passe</button>' : '<button class="btn sec" data-action="reset-demo">Remettre les données de démonstration</button>'}
    <button class="btn" data-action="logout">Se déconnecter</button><button class="btn ghost" data-action="close">Fermer</button></div>${pwa.boutonInstaller(true)}`);
  },
  logout: async () => { closeModal(); oublierRecents(); S.mdpLongueur = 0; await store.signOut(); },
  'mdp-form': () => {
    const min = P('securite.motDePasseMin');
    modal(`<h2>Changer mon mot de passe</h2><p class="sub">Au moins ${min} caractères. Choisissez un mot de passe que vous n'utilisez nulle part ailleurs (une phrase facile à retenir fonctionne très bien).</p>
    <div class="field"><label for="m0">Mot de passe actuel</label><input id="m0" type="password" autocomplete="current-password"></div>
    <div class="field"><label for="m1">Nouveau mot de passe</label><input id="m1" type="password" autocomplete="new-password"></div>
    <div class="field"><label for="m2">Nouveau mot de passe (encore une fois)</label><input id="m2" type="password" autocomplete="new-password"></div>
    <div id="merr" class="err" style="display:none" role="alert"></div>
    <div class="quick" style="margin-top:14px"><button class="btn" id="mok">Changer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
    $('#mok').onclick = async () => {
      const a = $('#m0').value, n = $('#m1').value, e = $('#merr'); e.style.display = 'block';
      if (n.length < min) return void (e.textContent = `Le nouveau mot de passe doit faire au moins ${min} caractères.`);
      if (n !== $('#m2').value) return void (e.textContent = 'Les deux saisies ne sont pas identiques.');
      if (n === a) return void (e.textContent = 'Choisissez un mot de passe différent de l\'actuel.');
      try { await store.changerMdp(a, n); S.mdpLongueur = n.length; closeModal(); toast('Mot de passe changé'); render(); }
      catch (x) { e.textContent = /wrong-password|invalid-credential/.test(x.code || '') ? 'Le mot de passe actuel est incorrect.' : /weak-password/.test(x.code || '') ? 'Mot de passe refusé : trop faible.' : 'Impossible : ' + (x.message || x.code); }
    };
  },
  demo: async el => { await store.signInDemo(el.dataset.v); },
  'reset-demo': () => confirmer('Remettre les données de démonstration ?', 'Tout ce que vous avez saisi dans ce navigateur sera remplacé par les exemples.', 'Remettre', () => store.reset()),
  'reset-mdp': async () => {
    const em = $('#em').value.trim(); if (!em) return toast('Saisissez d\'abord votre adresse e-mail.');
    try { await store.resetMdp(em); toast('Si cette adresse existe, un e-mail de réinitialisation vient d\'être envoyé.'); } catch (e) { toast('Envoi impossible : ' + e.message); }
  }
};
// Recherche globale : une personne, un contact ou une activité, en tapant quelques lettres (nom, prénom, nom de jeune fille, date de naissance, métier…)
async function rechGlobale() {
  S.rechGlobale = true; render();
  modal('<h2>Chercher</h2><p class="sub">Chargement…</p>');
  for (let i = 0; i < 50 && !(pret('seniors') && pret('contacts')); i++) await new Promise(r => setTimeout(r, 100));
  const avec = (it, type, pre) => ({ ...it, type, sous: [pre, it.sous].filter(Boolean).join(' · ') });
  modal(`<h2>Chercher</h2>${champRecherche({ id: 'rg', label: 'Une personne, un contact ou une activité', aide: AIDE_PERSONNE + ' Ou un métier, un nom d\'activité.', mode: 'action', recents: 'global', placeholder: 'Tapez pour chercher…',
    items: () => [...S.cache.seniors.map(s => avec(itemPersonne(s), 'senior', 'Personne')), ...S.cache.contacts.map(c => avec(itemContact(c), 'contact', c.categorie)), ...S.cache.activites.map(a => avec(itemActivite(a), 'activite', 'Activité'))],
    onChoose: o => { if (!o) return; closeModal(); const ouvrir = { senior: 'senior-form', contact: 'contact-form', activite: 'open-act' }[o.type]; actions[ouvrir]({ dataset: { id: o.id } }); } })}
  <p class="sub">Choisissez un résultat pour ouvrir sa fiche.</p>`);
  const champ = $('#rg'); if (champ) champ.focus();
}
const changes = { ...core.changes, ...act.changes, ...ann.changes, ...part.changes, ...mat.changes, ...bud.changes, ...reg.changes, ...pg.changes, ...ac.changes, ...quest.changes, ...voy.changes, ...ins.changes };

document.addEventListener('click', e => {
  const el = e.target.closest('[data-action]'); if (!el || el.tagName === 'INPUT' && el.type === 'checkbox') return;
  const f = actions[el.dataset.action];
  if (f) { e.preventDefault(); Promise.resolve(f(el, e)).catch(err => { console.error(err); toast('Erreur : ' + err.message); }); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change],[data-action]'); if (!el) return;
  const f = changes[el.dataset.change || el.dataset.action];
  if (f) Promise.resolve(f(e.target)).catch(err => { console.error(err); toast('Erreur : ' + err.message); });
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'fl') return;
  e.preventDefault();
  const err = $('#lerr'); err.style.display = 'none';
  try { S.mdpLongueur = $('#pw').value.length; await store.signIn($('#em').value.trim(), $('#pw').value); }
  catch (x) {
    S.mdpLongueur = 0;
    const c = x.code || '';
    err.textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(c) ? 'Adresse e-mail ou mot de passe incorrect.' : /too-many/.test(c) ? 'Trop d\'essais : patientez quelques minutes ou réinitialisez votre mot de passe.' : 'Connexion impossible : ' + (x.message || c);
    err.style.display = 'block';
  }
});
installerRecherche();
pwa.enregistrer();
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ---------- Démarrage ---------- */
(async () => {
  try {
    await store.init();
    store.onAuth(u => { S.user = u; if (u && u.role) { S.view = ACCUEIL[u.role]; demarrer(); } else arreter(); render(); });
    if (!MODE_REEL) { /* démo : onAuth a déjà appelé le rappel avec null */ }
    render();
  } catch (e) {
    $('#main').innerHTML = `<div class="login"><div class="card"><h1>Démarrage impossible</h1><div class="err">${esc(e.message)}</div><p>Vérifiez la connexion Internet et la configuration (js/config.js).</p></div></div>`;
  }
})();

/* Bouton « œil » : afficher ou masquer le mot de passe en cours de saisie (Chrome n'en propose pas). Appliqué à tout champ mot de passe, y compris ceux créés plus tard. */
function ajouterOeil(root) {
  root.querySelectorAll('input[type="password"]:not([data-oeil])').forEach(inp => {
    inp.setAttribute('data-oeil', '1');
    const actif = document.activeElement === inp;
    const wrap = document.createElement('span'); wrap.className = 'pw-wrap';
    inp.replaceWith(wrap); wrap.appendChild(inp);
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pw-oeil';
    b.setAttribute('aria-label', 'Afficher le mot de passe'); b.setAttribute('aria-pressed', 'false'); b.title = 'Afficher ou masquer le mot de passe'; b.textContent = '👁';
    b.addEventListener('click', ev => {
      ev.preventDefault(); ev.stopPropagation();
      const voir = inp.type === 'password'; inp.type = voir ? 'text' : 'password';
      b.setAttribute('aria-pressed', String(voir)); b.setAttribute('aria-label', voir ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
      b.classList.toggle('on', voir); inp.focus();
    });
    wrap.appendChild(b);
    if (actif) inp.focus();
  });
}
new MutationObserver(() => ajouterOeil(document)).observe(document.body, { childList: true, subtree: true });
ajouterOeil(document);
