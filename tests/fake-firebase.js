// Faux Firebase en mémoire pour tester le MODE RÉEL sans réseau. Applique des règles équivalentes à firestore.rules.
(() => {
  const F = window.__fb = window.__fb || { db: {}, accounts: {}, mails: [], denied: [], listeners: [], seq: 0, apps: {}, reads: 0, requetes: [] };
  // Filtres : égalité et comparaisons, comme Firestore
  const passe = (d, w) => !w.op ? true : w.op === '==' ? d[w.f] === w.v : w.op === '>=' ? d[w.f] >= w.v : w.op === '<=' ? d[w.f] <= w.v
    : w.op === '<' ? d[w.f] < w.v : w.op === '>' ? d[w.f] > w.v : w.op === 'in' ? w.v.includes(d[w.f]) : false;
  const rows = c => (F.db[c] = F.db[c] || {});
  const role = uid => (F.db.users && F.db.users[uid] || {}).role || '';
  const acts = uid => (F.db.users && F.db.users[uid] || {}).activites || [];
  const exists = uid => !!(F.db.users && F.db.users[uid]);
  function permis(op, col, data, newData, uid, requete) {
    if (!uid) return false;
    const r = exists(uid) ? role(uid) : '', admin = r === 'admin';
    const sienne = id => r === 'intervenant' && acts(uid).includes(id);
    switch (col) {
      case 'users': return op === 'read' ? (uid === data.__id || admin) : (admin && uid !== data.__id);
      case 'seniors': case 'fiches': case 'taches': case 'corbeille': case 'contacts': case 'conventions': return admin;
      case 'echanges': {
        if (admin) return true; const mien = d => r === 'partenaire' && d && d.parUid === uid && d.partenaireId === (F.db.users[uid] || {}).partenaireId && d.interne !== true;
        if (op === 'read') return r === 'partenaire' && data.parUid === uid; if (op === 'create') return mien(newData); if (op === 'update') return mien(data) && mien(newData); return false; }
      case 'activites': return op === 'read' ? ['admin', 'intervenant', 'benevole'].includes(r) : admin;
      case 'inscriptions': return op === 'read' ? (admin || sienne(data.activiteId)) : admin;
      case 'seances':
        if (op === 'read') return admin || sienne(data.activiteId);
        if (admin) return true;
        if (op === 'create') return sienne(newData.activiteId) && newData.valide !== true;
        if (op === 'update') return sienne(data.activiteId) && data.valide !== true && newData.valide !== true && newData.activiteId === data.activiteId;
        return false;
      case 'portage': case 'portageEchanges': return ['admin', 'intervenant', 'benevole'].includes(r) ? (op !== 'delete' || admin) : false;
      case 'materiel': case 'emprunts': return ['admin', 'intervenant', 'benevole'].includes(r) ? (op !== 'delete' || admin) : false;
      case 'mouvements': return op === 'read' || op === 'create' ? ['admin', 'intervenant', 'benevole'].includes(r) : op === 'update' ? false : admin;
      case 'parametres': return op === 'read' ? ['admin', 'intervenant', 'benevole', 'partenaire'].includes(r) : admin;
      case 'journal': return op === 'create' ? ['admin', 'intervenant', 'benevole', 'partenaire'].includes(r) : (op !== 'update' && admin);
      default: return false;
    }
  }
  const snap = (c, id) => ({ id, data: () => { const d = { ...rows(c)[id] }; delete d.__id; return d; }, exists: () => id in rows(c) });
  const deny = (what) => { F.denied.push(what); const e = new Error('Missing or insufficient permissions.'); e.code = 'permission-denied'; return e; };
  window.__fbmod = {
    initializeApp(cfg, nom) { const a = { nom: nom || '[DEFAULT]', auth: { cur: null, cbs: [], get currentUser() { return this.cur; } } }; F.apps[a.nom] = a; return a; },
    deleteApp: async () => {},
    getAuth: app => app.auth,
    getFirestore: app => ({ app }),
    onAuthStateChanged(auth, cb) { auth.cbs.push(cb); setTimeout(() => cb(auth.cur), 0); },
    async signInWithEmailAndPassword(auth, em, pw) {
      const a = F.accounts[em]; if (!a || a.pw !== pw) { const e = new Error('x'); e.code = 'auth/invalid-credential'; throw e; }
      auth.cur = { uid: a.uid, email: em }; auth.cbs.forEach(cb => cb(auth.cur));
    },
    async createUserWithEmailAndPassword(auth, em, pw) {
      if (F.accounts[em]) { const e = new Error('x'); e.code = 'auth/email-already-in-use'; throw e; }
      const uid = 'uid-' + (++F.seq); F.accounts[em] = { uid, pw }; auth.cur = { uid, email: em }; return { user: auth.cur };
    },
    EmailAuthProvider: { credential: (email, pw) => ({ email, pw }) },
    async reauthenticateWithCredential(u, c) { const a = F.accounts[c.email]; if (!a || a.pw !== c.pw) { const e = new Error('x'); e.code = 'auth/wrong-password'; throw e; } },
    async updatePassword(u, n) { F.accounts[u.email].pw = n; },
    async signOut(auth) { auth.cur = null; auth.cbs.forEach(cb => cb(null)); },
    async sendPasswordResetEmail(auth, em) { F.mails.push(em); },
    collection: (db, c) => ({ col: c, db, filtres: [] }),
    where: (f, op, v) => ({ f, op, v }),
    orderBy: (f, sens) => ({ tri: f, sens }), limit: n => ({ lim: n }),
    async getCountFromServer(q) { const uid = auth(q.db); if (role(uid) !== 'admin') throw deny('count ' + q.col);
      F.reads += 1; F.requetes.push('count ' + q.col);
      return { data: () => ({ count: Object.values(rows(q.col)).filter(d => q.filtres.every(w => passe(d, w))).length }) }; },
    async getDocs(q) { const uid = auth(q.db); if (role(uid) !== 'admin') throw deny('getDocs ' + q.col);
      const docs = Object.entries(rows(q.col)).filter(([, d]) => q.filtres.every(w => passe(d, w)));
      F.reads += Math.max(1, docs.length); F.requetes.push('getDocs ' + q.col);
      return { docs: docs.map(([id]) => ({ ...snap(q.col, id), ref: { db: q.db, col: q.col, id } })) }; },
    query: (q, ...w) => ({ ...q, filtres: q.filtres.concat(w.filter(x => x.f)) }),
    doc: (a, c, id) => a.col ? { db: a.db, col: a.col, id: 'auto' + (++F.seq) } : { db: a, col: c, id },
    async getDoc(ref) { const uid = auth(ref.db); const s = snap(ref.col, ref.id); if (!permis('read', ref.col, { ...rows(ref.col)[ref.id], __id: ref.id }, null, uid)) throw deny('getDoc ' + ref.col); return s; },
    async setDoc(ref, data, opt) {
      const uid = auth(ref.db), ex = ref.id in rows(ref.col), old = rows(ref.col)[ref.id] || {};
      // Comme Firestore : merge:true fusionne aussi les sous-tableaux associatifs (une clé retirée RESTE) ; mergeFields remplace les champs listés en entier
      const fusion = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object' && !Array.isArray(a[k]) ? fusion(a[k], v) : v; return o; };
      const nouv = opt && opt.mergeFields ? { ...old, ...Object.fromEntries(opt.mergeFields.map(k => [k, data[k]])) } : opt && opt.merge ? fusion(old, data) : { ...data };
      if (!permis(ex ? 'update' : 'create', ref.col, { ...old, __id: ref.id }, { ...nouv, __id: ref.id }, uid)) throw deny('setDoc ' + ref.col);
      rows(ref.col)[ref.id] = nouv; notifier(ref.col);
    },
    async deleteDoc(ref) {
      const uid = auth(ref.db); if (!permis('delete', ref.col, { ...rows(ref.col)[ref.id], __id: ref.id }, null, uid)) throw deny('delete ' + ref.col);
      delete rows(ref.col)[ref.id]; notifier(ref.col);
    },
    onSnapshot(q, ok, ko) {
      const uid = auth(q.db);
      const l = { q, ok, ko, uid, vus: null, run() {
        const r = role(uid), docs = Object.entries(rows(q.col)).filter(([, d]) => q.filtres.every(w => passe(d, w)));
        let autorise;
        if (q.col === 'activites') autorise = ['admin', 'intervenant', 'benevole'].includes(r);
        else if (q.col === 'parametres') autorise = ['admin', 'intervenant', 'benevole', 'partenaire'].includes(r);
        else if (['materiel', 'emprunts', 'mouvements', 'portage', 'portageEchanges'].includes(q.col)) autorise = ['admin', 'intervenant', 'benevole'].includes(r);
        else if (q.col === 'echanges') autorise = r === 'admin' || (r === 'partenaire' && q.filtres.some(w => w.f === 'parUid' && w.op === '==' && w.v === uid));
        else if (['inscriptions', 'seances'].includes(q.col)) autorise = r === 'admin' || (r === 'intervenant' && q.filtres.some(w => w.f === 'activiteId' && w.op === '==' && acts(uid).includes(w.v)));
        else if (q.col === 'users') autorise = r === 'admin' || (uid && q.filtres.length === 0 && false);
        else autorise = r === 'admin';
        if (!autorise) { F.denied.push('liste ' + q.col + ' par ' + (r || 'sans rôle')); return ko && ko(deny('liste ' + q.col)); }
        const avant = l.vus, maintenant = {}; docs.forEach(([id, d]) => { maintenant[id] = JSON.stringify(d); });
        const changes = docs.filter(([id]) => !avant || avant[id] !== maintenant[id]).map(([id]) => ({ type: 'added', doc: snap(q.col, id) }));
        const nouveau = !avant; l.vus = maintenant; F.reads += nouveau ? Math.max(1, changes.length) : changes.length;
        ok({ docs: docs.map(([id]) => snap(q.col, id)), metadata: { fromCache: false }, docChanges: () => changes });
      } };
      F.requetes.push('listen ' + q.col + ' ' + JSON.stringify(q.filtres.map(w => [w.f, w.op, w.v]))); F.listeners.push(l); setTimeout(() => l.run(), 0);
      return () => { F.listeners = F.listeners.filter(x => x !== l); };
    }
  };
  const auth = db => (db.app.auth.cur || {}).uid;
  const notifier = c => F.listeners.filter(l => l.q.col === c).forEach(l => l.run());
})();
