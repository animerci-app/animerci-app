// Quelles données charger, selon l'écran ouvert ? (économie du quota gratuit de lectures Firestore)
// Règle : on ne lit que ce que l'écran affiche. Les listes déjà chargées restent en mémoire pendant la session.
// Fonction pure (sans accès à Firebase) : elle décrit les « abonnements » souhaités, app.js les crée une seule fois.

// Premier et dernier jour d'un mois (AAAA-MM-JJ), mois de 0 à 11
export function bornesMois(a, m) {
  const p = n => String(n).padStart(2, '0');
  return [`${a}-${p(m + 1)}-01`, `${a}-${p(m + 1)}-${p(new Date(a, m + 1, 0).getDate())}`];
}

// c : { nbMois (planning : 1 à 3), horizonSorties (date limite pour l'alerte « fiches de sortie à compléter »), role, view, actId, mois:{a,m}, stat:{du,au}, onglet, auj, activites:[], mesActivites:[] }
export function besoins(c) {
  const B = [];
  const add = (col, key, filtre, opts) => B.push({ col, key, filtre: filtre || null, opts: opts || null });
  if (!c.role) return B;
  add('parametres', 'all');
  if (c.role === 'benevole') { add('activites', 'all'); return B; }
  if (c.role === 'intervenant') {
    add('activites', 'all');
    for (const id of c.mesActivites || []) { add('inscriptions', id, ['activiteId', '==', id]); add('seances', id, ['activiteId', '==', id]); }
    return B;
  }
  if (c.role !== 'admin') return B;
  add('activites', 'all'); add('taches', 'all');
  const v = c.view;
  // Recherche globale (loupe du menu) : les personnes et l'annuaire sont chargés à la première utilisation
  if (c.rechGlobale) { add('seniors', 'all'); add('contacts', 'all'); }
  if (v === 'home') {
    add('inscriptions', 'attente', ['statut', '==', 'attente']);
    add('seances', 'avalider', ['valide', '==', false]);
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
  if (v === 'equipe') add('users', 'all');
  // Annuaire : petite liste, chargée seulement là où elle sert (écran Annuaire, formulaires d'activité et de tâche)
  if (['annuaire', 'activites', 'activite', 'taches'].includes(v)) add('contacts', 'all');
  if (v === 'sauvegarde') {
    if (c.onglet === 'corbeille') add('corbeille', 'all');
    if (c.onglet === 'journal') add('journal', 'all', null, { tri: 'date', limite: 150 });
  }
  return B;
}
