// Couche données : un seul code d'interface, deux moteurs.
//  - mode démonstration : données fictives dans le navigateur (localStorage)
//  - mode réel : Firebase (Authentication + Firestore, région Paris à choisir à la création)
import { firebaseConfig, MODE_REEL, FIREBASE_VERSION } from './config.js';
import * as cfg from './config.js';

// Filtres : un triplet ['champ', 'opérateur', valeur] ou une liste de triplets.
const conds = f => (!f ? [] : Array.isArray(f[0]) ? f : [f]);
const passe = (r, [champ, op, v]) => op === '==' ? r[champ] === v : op === '>=' ? r[champ] >= v : op === '<=' ? r[champ] <= v
  : op === '<' ? r[champ] < v : op === '>' ? r[champ] > v : op === 'in' ? v.includes(r[champ]) : false;

// Compteur de lectures (estimation, propre à cet appareil) : le quota gratuit est de 50 000 lectures par jour pour tout le monde.
const CLE_LECT = 'animerci-lectures';
const jourLocal = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
function ajouterLectures(n) {
  if (!n) return;
  try { const j = jourLocal(); let c = JSON.parse(localStorage.getItem(CLE_LECT) || 'null'); if (!c || c.jour !== j) c = { jour: j, n: 0 }; c.n += n; localStorage.setItem(CLE_LECT, JSON.stringify(c)); } catch (e) { /* stockage indisponible */ }
}
export function lecturesDuJour() {
  try { const c = JSON.parse(localStorage.getItem(CLE_LECT) || 'null'); return c && c.jour === jourLocal() ? c.n : 0; } catch (e) { return 0; }
}
import { donneesDemo } from './seeds.js';
import { uid } from './logic.js';

const COLS = ['seniors', 'activites', 'inscriptions', 'seances', 'fiches', 'taches'];

/* ---------------- Mode démonstration ---------------- */
function backendDemo() {
  const KEY = 'animerci-demo-v1';
  const ecoute = {}; // col -> Set(fn)
  let data;
  const charger = () => {
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
    if (!data) data = donneesDemo();
    charger_users();
  };
  const charger_users = () => { data.corbeille = data.corbeille || []; data.journal = data.journal || []; data.parametres = data.parametres || []; data.contacts = data.contacts || []; data.echanges = data.echanges || []; data.conventions = data.conventions || []; data.materiel = data.materiel || []; data.emprunts = data.emprunts || []; data.mouvements = data.mouvements || []; data.portage = data.portage || []; data.portageEchanges = data.portageEchanges || []; data.portageJournal = data.portageJournal || []; data.lienSocial = data.lienSocial || []; data.accueils = data.accueils || []; data.seniorsLite = data.seniorsLite || []; data.depenses = data.depenses || []; data.regie = data.regie || []; data.questionnaires = data.questionnaires || []; data.reponsesQuestionnaire = data.reponsesQuestionnaire || []; data.voyages = data.voyages || []; data.residencePersonnel = data.residencePersonnel || []; data.residenceFamilles = data.residenceFamilles || []; data.residenceResidents = data.residenceResidents || []; data.residenceJournal = data.residenceJournal || []; data.residenceRemplacements = data.residenceRemplacements || []; data.residenceInterventions = data.residenceInterventions || [];
    if (!data.users || !data.users.length) data.users = Object.values(comptes).map(c => ({ id: c.uid, email: c.email, nom: c.nom, role: c.role, activites: c.activites, partenaireId: c.partenaireId || '', partenaireNom: c.partenaireNom || '', acces: c.acces || {}, accesFin: 0, accesJusqu: '' })); };
  const sauver = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* stockage indisponible : on garde en mémoire */ } };
  const notifier = col => (ecoute[col] || new Set()).forEach(f => f());
  let authCb = () => {};
  let user = null;
  const comptes = {
    admin: { uid: 'demo-admin', email: 'admin@exemple.fr', nom: 'Responsable', role: 'admin', activites: [] },
    intervenant: { uid: 'demo-interv', email: 'fleuriste@exemple.fr', nom: 'Intervenante (fleuriste)', role: 'intervenant', activites: ['a-flo'], acces: { materiel: true, portage: true }, accesFin: 0 },
    benevole: { uid: 'demo-benev', email: 'benevole@exemple.fr', nom: 'Bénévole', role: 'benevole', activites: [], acces: { materiel: true, portage: true, inscriptions: true }, accesFin: 0 },
    partenaire: { uid: 'demo-part', email: 'mediatheque@exemple.fr', nom: 'Médiathèque (essai partenaire)', role: 'partenaire', activites: [], partenaireId: 'c-med', partenaireNom: 'Médiathèque municipale' }
  };
  return {
    nom: 'demo',
    async init() { charger(); },
    onAuth(cb) { authCb = cb; cb(user); },
    // Les boutons de démonstration utilisent des comptes fixes, mais reprennent les accès provisoires (cases cochées dans Équipe, dont « Résidence ») déjà enregistrés sur ce compte dans ce navigateur :
    // ainsi une délégation d'accès cochée par l'administratrice en démonstration a un effet réel, le temps d'essayer l'outil.
    async signInDemo(role) {
      const base = comptes[role], enregistre = (data.users || []).find(u => u.id === base.uid);
      user = enregistre ? { ...base, acces: enregistre.acces || base.acces || {}, accesFin: Number(enregistre.accesFin) || 0, accesJusqu: enregistre.accesJusqu || '' } : base;
      authCb(user);
    },
    async signIn() { throw new Error('Le mode démonstration n\'a pas de compte : utilisez les boutons de démonstration.'); },
    async signOut() { user = null; authCb(null); },
    async lire(col, filtre) { return JSON.parse(JSON.stringify((data[col] || []).filter(r => conds(filtre).every(c => passe(r, c))))); },
    async nombre(col, filtre) { return (data[col] || []).filter(r => conds(filtre).every(c => passe(r, c))).length; },
    cacheLocal: false,
    async supprimerAvant(col, champ, valeur) { data[col] = (data[col] || []).filter(r => !(r[champ] < valeur)); sauver(); notifier(col); },
    subscribe(col, cb, filtre, opts) {
      const f = () => {
        let rows = (data[col] || []).filter(r => conds(filtre).every(c => passe(r, c)));
        if (opts && opts.tri) { rows = [...rows].sort((a, b) => String(b[opts.tri] || '').localeCompare(String(a[opts.tri] || ''))); if (opts.limite) rows = rows.slice(0, opts.limite); }
        cb(JSON.parse(JSON.stringify(rows)));
      };
      (ecoute[col] = ecoute[col] || new Set()).add(f);
      f();
      return () => ecoute[col].delete(f);
    },
    async save(col, doc) {
      const d = { ...doc }; if (!d.id) d.id = uid();
      const i = data[col].findIndex(x => x.id === d.id);
      if (i >= 0) data[col][i] = { ...data[col][i], ...d }; else data[col].push(d);
      sauver(); notifier(col); return d.id;
    },
    async remove(col, id) { data[col] = data[col].filter(x => x.id !== id); sauver(); notifier(col); },
    async creerCompte(email) { return 'demo-' + uid(); },
    async changerMdp() { /* démonstration : pas de mot de passe */ },
    async resetMdp() { /* démonstration : aucun e-mail envoyé */ },
    async reset() { data = donneesDemo(); charger_users(); sauver(); COLS.concat(['users', 'corbeille', 'journal', 'parametres', 'contacts', 'echanges', 'conventions', 'materiel', 'emprunts', 'mouvements', 'portage', 'portageEchanges', 'portageJournal', 'lienSocial', 'accueils', 'seniorsLite', 'depenses', 'regie', 'questionnaires', 'reponsesQuestionnaire', 'voyages', 'residencePersonnel', 'residenceFamilles', 'residenceResidents', 'residenceJournal', 'residenceRemplacements', 'residenceInterventions']).forEach(notifier); }
  };
}

/* ---------------- Mode réel : Firebase ---------------- */
function backendFirebase() {
  let fb = {}, app, auth, db, authCb = () => {}, cacheActif = false;
  const base = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}`;
  return {
    nom: 'firebase',
    async init() {
      const [a, au, fs] = await Promise.all([
        import(`${base}/firebase-app.js`), import(`${base}/firebase-auth.js`), import(`${base}/firebase-firestore.js`)
      ]);
      fb = { ...a, ...au, ...fs };
      app = fb.initializeApp(firebaseConfig);
      auth = fb.getAuth(app);
      // Cache local (IndexedDB) : un rechargement ou une coupure réseau de moins de 30 minutes ne relit presque rien.
      // Désactivable avec « export const CACHE_LOCAL = false; » dans config.js. Repli automatique si le navigateur ne le permet pas.
      if (cfg.CACHE_LOCAL !== false && typeof fb.persistentLocalCache === 'function') {
        try { db = fb.initializeFirestore(app, { localCache: fb.persistentLocalCache({ tabManager: fb.persistentMultipleTabManager() }) }); cacheActif = true; }
        catch (e) { console.warn('Cache local indisponible, lecture directe', e); db = null; }
      }
      if (!db) db = fb.getFirestore(app);
      fb.onAuthStateChanged(auth, async u => {
        if (!u) return authCb(null);
        try {
          const snap = await fb.getDoc(fb.doc(db, 'users', u.uid));
          if (!snap.exists()) return authCb({ uid: u.uid, email: u.email, nom: u.email, role: null });
          const d = snap.data();
          authCb({ uid: u.uid, email: u.email, nom: d.nom || u.email, role: d.role || null, activites: d.activites || [], partenaireId: d.partenaireId || '', partenaireNom: d.partenaireNom || '', acces: d.acces || {}, accesFin: Number(d.accesFin) || 0, accesJusqu: d.accesJusqu || '' });
        } catch (e) { authCb({ uid: u.uid, email: u.email, nom: u.email, role: null, erreur: e.message }); }
      });
    },
    onAuth(cb) { authCb = cb; },
    async signIn(email, mdp) { await fb.signInWithEmailAndPassword(auth, email, mdp); },
    // Déconnexion explicite : on efface aussi le cache local de cet appareil (poste partagé), puis on recharge la page.
    async signOut() {
      await fb.signOut(auth);
      if (cacheActif) { try { await fb.terminate(db); await fb.clearIndexedDbPersistence(db); } catch (e) { console.warn('effacement du cache local', e); } location.reload(); }
    },
    async resetMdp(email) { await fb.sendPasswordResetEmail(auth, email); },
    async changerMdp(actuel, nouveau) {
      const u = auth.currentUser; if (!u) throw new Error('Non connecté·e.');
      await fb.reauthenticateWithCredential(u, fb.EmailAuthProvider.credential(u.email, actuel));
      await fb.updatePassword(u, nouveau);
    },
    // Création d'un compte SANS déconnecter l'administratrice : on utilise une 2e instance de l'application.
    // Mot de passe provisoire aléatoire ; la personne définit le sien via le lien reçu par e-mail.
    async creerCompte(email) {
      const sec = fb.initializeApp(firebaseConfig, 'creation-' + Date.now());
      try {
        const a2 = fb.getAuth(sec);
        const tmp = Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(36).padStart(2, '0')).join('').slice(0, 24) + 'Aa1!';
        const cred = await fb.createUserWithEmailAndPassword(a2, email, tmp);
        const id = cred.user.uid;
        await fb.signOut(a2);
        await fb.sendPasswordResetEmail(auth, email);
        return id;
      } finally { try { await fb.deleteApp(sec); } catch (e) { /* sans importance */ } }
    },
    // Supprime les documents dont `champ` < `valeur` (par paquets de 200) : sert au nettoyage du journal.
    async supprimerAvant(col, champ, valeur) {
      const s = await fb.getDocs(fb.query(fb.collection(db, col), fb.where(champ, '<', valeur), fb.limit(200)));
      ajouterLectures(Math.max(1, s.docs.length));
      for (const d of s.docs) await fb.deleteDoc(d.ref);
    },
    async lire(col, filtre) {
      const s = await fb.getDocs(fb.query(fb.collection(db, col), ...conds(filtre).map(c => fb.where(...c))));
      ajouterLectures(Math.max(1, s.docs.length));
      return s.docs.map(d => ({ ...d.data(), id: d.id }));
    },
    // Nombre de documents sans les lire un par un (compté : 1 lecture pour 1 000 éléments, au minimum 1)
    async nombre(col, filtre) {
      const r = await fb.getCountFromServer(fb.query(fb.collection(db, col), ...conds(filtre).map(c => fb.where(...c))));
      ajouterLectures(1); return r.data().count;
    },
    get cacheLocal() { return cacheActif; },
    subscribe(col, cb, filtre, opts) {
      let q = fb.collection(db, col);
      if (filtre) q = fb.query(q, ...conds(filtre).map(c => fb.where(...c)));
      // `tri` + `limite` : ne lire que les N plus récents (économise le quota gratuit de lectures)
      if (opts && opts.tri) q = fb.query(q, fb.orderBy(opts.tri, 'desc'), ...(opts.limite ? [fb.limit(opts.limite)] : []));
      let premier = true;
      return fb.onSnapshot(q, s => {
        if (!(s.metadata && s.metadata.fromCache)) { ajouterLectures(premier ? Math.max(1, s.docChanges().length) : s.docChanges().length); premier = false; }
        cb(s.docs.map(d => ({ ...d.data(), id: d.id })));
      }, e => { console.error(col, e); cb([], e); });
    },
    async save(col, doc) {
      const { id, ...rest } = doc;
      const ref = id ? fb.doc(db, col, id) : fb.doc(fb.collection(db, col));
      // mergeFields : chaque champ listé est remplacé EN ENTIER (avec merge:true, une présence retirée d'un appel resterait dans la base)
      const champs = Object.keys(rest);
      if (champs.length) await fb.setDoc(ref, rest, { mergeFields: champs });
      else await fb.setDoc(ref, rest, { merge: true });
      return ref.id;
    },
    async remove(col, id) { await fb.deleteDoc(fb.doc(db, col, id)); }
  };
}

export const store = MODE_REEL ? backendFirebase() : backendDemo();
export { COLS, MODE_REEL };
