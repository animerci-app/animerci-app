// Logique pure (sans écran, sans base de données) : testable seule.

export const STATUTS_PRESENCE = { p: 'Présent·e', a: 'Absent·e', j: 'Excusé·e', d: 'Désisté·e' };

export function age(naissance, today = new Date()) {
  if (!naissance) return null;
  const d = new Date(naissance);
  if (isNaN(d)) return null;
  let a = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) a--;
  return a;
}

export function trancheAge(a) {
  if (a == null) return 'Non renseigné';
  if (a < 60) return 'Moins de 60 ans';
  if (a < 75) return '60 à 74 ans';
  if (a < 85) return '75 à 84 ans';
  return '85 ans et plus';
}

/** Historique d'un sénior pour une activité, à partir des séances. */
export function historique(seniorId, activiteId, seances) {
  const h = { part: 0, abs: 0, exc: 0, des: 0, derniere: null };
  for (const s of seances) {
    if (s.activiteId !== activiteId) continue;
    const v = s.presences && s.presences[seniorId];
    if (v === 'p') { h.part++; if (!h.derniere || s.date > h.derniere) h.derniere = s.date; }
    else if (v === 'a') h.abs++;
    else if (v === 'j') h.exc++;
    else if (v === 'd') h.des++;
  }
  return h;
}

/**
 * Propose un classement pour la prochaine séance d'une activité très demandée.
 * Plus le score est bas, plus la personne est prioritaire.
 * La décision finale reste humaine : cette fonction ne fait que classer.
 */
export function classerCandidats(candidats, regles = {}) {
  const r = { moins: true, abs: true, res: false, anciennete: true, ...regles };
  const avecScore = candidats.map((c, i) => {
    let score = 0;
    if (r.moins) score += c.h.part * 2;
    if (r.abs) score += c.h.abs * 1.5 + c.h.des * 0.5; // les absences excusées ne pénalisent pas
    if (r.res && c.statut === 'resident') score -= 3;
    return { ...c, score, ordre: i };
  });
  avecScore.sort((x, y) => {
    if (x.score !== y.score) return x.score - y.score;
    if (r.anciennete && x.dateDemande !== y.dateDemande) return (x.dateDemande || '').localeCompare(y.dateDemande || '');
    return x.ordre - y.ordre;
  });
  return avecScore;
}

export function raisons(c) {
  const out = [];
  out.push(c.h.part === 0 ? 'Première participation' : `${c.h.part} participation${c.h.part > 1 ? 's' : ''}`);
  if (c.h.abs) out.push(`${c.h.abs} absence${c.h.abs > 1 ? 's' : ''} non excusée${c.h.abs > 1 ? 's' : ''}`);
  if (c.h.des) out.push(`${c.h.des} désistement${c.h.des > 1 ? 's' : ''}`);
  if (c.statut === 'resident') out.push('Résident·e');
  return out;
}

/** Statistiques : distingue personnes uniques, participations, séances. */
export function statistiques(seances, seniors, activites, { du = null, au = null } = {}) {
  const sel = seances.filter(s => (!du || s.date >= du) && (!au || s.date <= au) && s.valide);
  const uniques = new Set();
  const parCat = {};
  const parMois = {};
  let presents = 0, absents = 0, exc = 0, des = 0;
  const catDe = id => (activites.find(a => a.id === id) || {}).cat || 'Autre';
  for (const s of sel) {
    for (const [sid, v] of Object.entries(s.presences || {})) {
      if (v === 'p') {
        presents++; uniques.add(sid);
        const c = catDe(s.activiteId); parCat[c] = (parCat[c] || 0) + 1;
        const m = (s.date || '').slice(0, 7); parMois[m] = (parMois[m] || 0) + 1;
      } else if (v === 'a') absents++;
      else if (v === 'j') exc++;
      else if (v === 'd') des++;
    }
  }
  const attendus = presents + absents + exc; // les désistements préviennent avant : hors taux
  const publics = { hommes: 0, femmes: 0, autre: 0, residents: 0, adherents: 0 };
  const tranches = {};
  for (const id of uniques) {
    const s = seniors.find(x => x.id === id);
    if (!s) continue;
    if (s.sexe === 'H') publics.hommes++; else if (s.sexe === 'F') publics.femmes++; else publics.autre++;
    if (s.statut === 'resident') publics.residents++; else if (s.statut === 'adherent') publics.adherents++;
    const t = trancheAge(age(s.naissance)); tranches[t] = (tranches[t] || 0) + 1;
  }
  return {
    seances: sel.length, participations: presents, personnesUniques: uniques.size,
    absents, excuses: exc, desistements: des,
    tauxPresence: attendus ? Math.round((presents / attendus) * 100) : null,
    parCat, parMois, publics, tranches
  };
}

/** Adhésion à jour ? Une adhésion couvre l'année civile de sa date. */
export function adhesionAJour(senior, annee = new Date().getFullYear()) {
  if (senior.statut === 'resident' || senior.statut === 'autre') return true; // résident·e : comprise dans le loyer ; autre public : pas de cotisation
  const a = adhesionsDe(senior).find(x => x.annee === annee);
  return !!(a && a.paye);
}

/** Libellé du statut d'une personne. */
export const libelleStatut = statut => statut === 'resident' ? 'Résident·e' : statut === 'adherent' ? 'Adhérent·e' : 'Autre public';

/** Lieu de vie affiché : la résidence pour un·e résident·e (nom réglé dans Paramètres), sinon la commune de la fiche. */
export function lieuDeVie(senior, residence = '') {
  if (!senior) return '';
  if (senior.statut === 'resident') return (residence || '').trim();
  return (senior.commune || '').trim();
}

/** Cotisation à régler ? Seulement pour un·e adhérent·e, tant que l'adhésion de l'année n'est pas réglée (jamais pour un·e résident·e ni un autre public). */
export const cotisationARegler = senior => !!senior && senior.statut === 'adherent' && !adhesionAJour(senior);

/** Ordre d'affichage des publics : résident·es, adhérent·es, autres. */
export const rangStatut = statut => statut === 'resident' ? 0 : statut === 'adherent' ? 1 : 2;

/**
 * Texte de la liste des retenus d'une activité, groupée par public (pour un règlement ou un envoi).
 * personnes : [{ nom, statut, cotis }] ; renvoie le texte à copier.
 */
export function texteListeRetenus(nomActivite, personnes) {
  const groupes = [['resident', 'Résident·es'], ['adherent', 'Adhérent·es'], ['autre', 'Autres publics']];
  const tri = (x, y) => x.nom.localeCompare(y.nom, 'fr');
  const rang = p => ['resident', 'adherent'].includes(p.statut) ? p.statut : 'autre';
  const blocs = groupes.map(([k, titre]) => {
    const l = personnes.filter(p => rang(p) === k).sort(tri);
    return l.length ? `${titre} (${l.length})\n` + l.map(p => p.nom + (p.cotis ? ' — cotisation à régler' : '')).join('\n') : '';
  }).filter(Boolean);
  return `${nomActivite}\n${blocs.join('\n\n')}`;
}

export function csvEscape(v) {
  let s = v == null ? '' : String(v);
  // Anti-injection de formule (Excel) : une cellule texte ne doit pas commencer par = @ ou +/- suivi d'une lettre
  if (/^[=@\t\r]/.test(s) || /^[+-][^0-9\s.,]/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/** CSV avec séparateur point-virgule et BOM : s'ouvre correctement dans Excel en français. */
export function toCSV(colonnes, lignes) {
  const head = colonnes.map(c => csvEscape(c.label)).join(';');
  const body = lignes.map(l => colonnes.map(c => csvEscape(c.get(l))).join(';')).join('\r\n');
  return '﻿' + head + '\r\n' + body;
}

export function fmtDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/* ---------- Homonymes (v1.4.1) ---------- */
/** Clé de comparaison d'un nom : sans accents ni majuscules, espaces simplifiés. */
export function cleNom(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
/** Autres personnes (fiches « Personnes ») portant le même prénom et le même nom. */
export function homonymes(s, tous) {
  // une même dame peut être connue sous son nom d'usage ou son nom de jeune fille : on compare les deux
  const cles = x => new Set([cleNom(`${x.prenom} ${x.nom}`), ...(x.nomNaissance ? [cleNom(`${x.prenom} ${x.nomNaissance}`)] : [])]);
  const k = cles(s);
  return tous.filter(x => x.id !== s.id && [...cles(x)].some(c => k.has(c)));
}
/** Nom affiché d'une personne : « Prénom Nom », complété de la naissance seulement s'il existe un·e homonyme. */
export function nomSenior(s, tous) {
  const base = `${s.prenom} ${s.nom}`, h = homonymes(s, tous);
  if (!h.length) return base;
  if (!s.naissance) return `${base} (naissance à renseigner)`;
  const an = String(s.naissance).slice(0, 4);
  return h.some(x => x.naissance && String(x.naissance).slice(0, 4) === an) ? `${base} (né·e le ${fmtDate(s.naissance)})` : `${base} (né·e en ${an})`;
}
/** Libellé d'un contact de l'annuaire : « Prénom Nom · précision ». Dans une liste, un homonyme sans précision est signalé. */
export function libelleContact(c, liste) {
  const nc = nomComplet(c);
  if (c.precision) return `${nc} · ${c.precision}`;
  if (liste && liste.some(x => x.id !== c.id && cleNom(nomComplet(x)) === cleNom(nc))) return `${nc} · (sans précision)`;
  return nc;
}
/** Retrouve le contact d'une rubrique : par identifiant, sinon par libellé enregistré, sinon par nom (si unique). */
export function trouverContact(liste, valeur, valeurId) {
  if (valeurId) { const c = liste.find(x => x.id === valeurId); if (c) return c; }
  const v = cleNom(valeur); if (!v) return null;
  const exact = liste.filter(x => cleNom(libelleContact(x)) === v);
  if (exact.length === 1) return exact[0];
  const parNom = liste.filter(x => cleNom(nomComplet(x)) === v);
  return parNom.length === 1 ? parNom[0] : null;
}

/* ---------- Noms, tri par patronyme, recherche au fil de la frappe (v1.5.0) ---------- */
/** Nom complet « Prénom Nom » d'un contact (ou d'une personne). */
export const nomComplet = x => [x.prenom, x.nom].filter(Boolean).join(' ');
/** Affichage en liste : « DUPONT Marie » ; un organisme (association…) garde son nom tel quel. */
export const nomAffiche = x => x.organisme || !x.prenom ? (x.nom || '') : `${String(x.nom || '').toLocaleUpperCase('fr')} ${x.prenom}`;
/** Tri par patronyme puis prénom (sans tenir compte des accents ni des majuscules). */
export function comparerPatronyme(a, b) {
  return cleNom(a.nom).localeCompare(cleNom(b.nom), 'fr') || cleNom(a.prenom).localeCompare(cleNom(b.prenom), 'fr');
}
// Heuristique de séparation nom/prénom, utilisée UNIQUEMENT pour les anciens contacts (avant 1.5.0) qui n'avaient qu'une case « Prénom et nom ».
// Rien n'est enregistré tant que l'administratrice n'a pas ouvert et validé la fiche.
const MOTS_ORGANISME = ['association', 'club', 'mairie', 'ccas', 'centre', 'maison', 'ville', 'societe', 'groupe', 'atelier', 'compagnie', 'cafe', 'restaurant', 'pharmacie', 'le', 'la', 'les', 'l'];
const PARTICULES = ['de', 'du', 'des', 'd', 'la', 'le', 'les', 'van', 'von', 'der', 'den', 'saint', 'sainte'];
export function separerNom(texte) {
  const t = String(texte || '').trim().replace(/\s+/g, ' '); if (!t) return { prenom: '', nom: '', organisme: false };
  const mots = t.split(' ');
  if (mots.length === 1) return { prenom: '', nom: t, organisme: false };
  const premier = cleNom(mots[0].split(/['’]/)[0]);
  // convention « DUPONT Marie » (nom en majuscules en premier)
  const maj = m => m.length > 1 && m === m.toLocaleUpperCase('fr') && m !== m.toLocaleLowerCase('fr');
  let run = 0; while (run < mots.length && maj(mots[run])) run++;
  // « LE GALL Marie » est une personne (nom en majuscules sur 2 mots ou plus, puis prénom) ; « Le Secours Populaire » ou « LA POSTE » restent des organismes
  if (MOTS_ORGANISME.includes(premier) && !(run >= 2 && run < mots.length)) return { prenom: '', nom: t, organisme: true };
  if (run >= 1 && run < mots.length) return { prenom: mots.slice(run).join(' '), nom: mots.slice(0, run).join(' '), organisme: false };
  let i = mots.findIndex((m, k) => k >= 1 && PARTICULES.includes(cleNom(m.split(/['’]/)[0])));
  if (i < 1) i = mots.length - 1;
  return { prenom: mots.slice(0, i).join(' '), nom: mots.slice(i).join(' '), organisme: false };
}
/** Contact au format actuel (nom + prénom séparés). Un ancien contact est séparé à la volée (marqué _derive : à vérifier). */
export function normContact(c) {
  if (!c || c.prenom !== undefined) return c;
  if (c.organisme) return { ...c, prenom: '' };
  return { ...c, ...separerNom(c.nom), _derive: true };
}
/** Écritures d'une date de naissance que l'on peut taper : jj/mm/aaaa, mm/aaaa, aaaa, jj/mm, jjmmaaaa. */
export function formatsDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ''); if (!m) return [];
  const [, y, mo, d] = m; return [`${d}/${mo}/${y}`, `${mo}/${y}`, y, `${d}/${mo}`, `${d}${mo}${y}`];
}
/** Lecture d'une date saisie par un humain ou venue d'un tableur : jj/mm/aaaa, jj-mm-aaaa, jj.mm.aaaa, aaaa-mm-jj, numéro de série Excel. */
export function lireDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' || /^\d{5}$/.test(String(v).trim())) { const n = Number(v); if (n >= 1850 && n <= 2100) return ''; /* une année seule n'est pas une date */ if (n > 1 && n < 80000) return new Date(Date.UTC(1899, 11, 30) + Math.round(n) * 86400000).toISOString().slice(0, 10); }
  const t = String(v).trim(); let m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t))) { const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]))); return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]) ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : ''; }
  if ((m = /^(\d{1,2})[\/.\- ](\d{1,2})[\/.\- ](\d{2,4})$/.exec(t))) {
    let a = m[3]; if (a.length === 2) a = (Number(a) > 30 ? '19' : '20') + a;
    const j = Number(m[1]), mo = Number(m[2]), d = new Date(Date.UTC(Number(a), mo - 1, j));
    return d.getUTCFullYear() === Number(a) && d.getUTCMonth() === mo - 1 && d.getUTCDate() === j ? `${a}-${String(mo).padStart(2, '0')}-${String(j).padStart(2, '0')}` : '';   // 31/02 refusé
  }
  return '';
}
/**
 * Filtre au fil de la frappe. items : [{ id, nom, prenom, champs: [textes], dates: [iso] }].
 * Chaque mot tapé doit se retrouver (accents et majuscules ignorés) dans un champ, ou dans une date de naissance (jj/mm/aaaa, aaaa, mm/aaaa…).
 * Résultat trié par patronyme ; ceux dont le nom ou le prénom COMMENCE par le premier mot passent devant.
 */
export function filtrer(items, texte, max = 8) {
  const tri = [...items].sort(comparerPatronyme);
  const mots = String(texte || '').trim().split(/\s+/).filter(Boolean);
  if (!mots.length) return { liste: tri.slice(0, max), total: tri.length };
  const jetons = mots.map(m => ({ t: cleNom(m), d: m.replace(/[.\-\s]/g, '/') }));
  const ok = [];
  for (const it of tri) {
    const txt = (it.champs || []).map(cleNom), dates = (it.dates || []).flatMap(formatsDate);
    if (jetons.every(j => txt.some(c => c.includes(j.t)) || (/\d/.test(j.d) && dates.some(f => f.includes(j.d))))) ok.push(it);
  }
  const t0 = jetons[0].t, debut = it => cleNom(it.nom).startsWith(t0) || cleNom(it.prenom).startsWith(t0) ? 0 : 1;
  const res = [...ok.filter(i => debut(i) === 0), ...ok.filter(i => debut(i) === 1)];
  return { liste: res.slice(0, max), total: res.length };
}

/* ---------- Portage de repas à domicile ---------- */
export const JOURS_PORTAGE = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const COURT_PORTAGE = ['lun', 'mar', 'mer', 'jeu', 'ven', 'sam', 'dim'];
const sansAccent = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Lit une fréquence écrite à la main : « Lundi au dimanche », « Lundi, mercredi, vendredi », « Lundi / mercredi », « Lundi, mardi et mercredi »…
 * Renvoie { jours: [0..6] (0 = lundi), precision } : un texte non reconnu (« Au choix ») est gardé tel quel en précision.
 */
export function lireFrequence(texte) {
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut) return { jours: [], precision: '' };
  const t = sansAccent(brut).replace(/\btous les jours\b/g, 'lundi au dimanche').replace(/\bchaque jour\b/g, 'lundi au dimanche');
  const idx = mot => COURT_PORTAGE.findIndex(c => mot.startsWith(c));
  const jours = new Set(); let reste = t;
  // plages « lundi au vendredi » (peut passer par le dimanche : « samedi au mardi »)
  reste = reste.replace(/\b([a-z]{3,8})\s+(?:au|a|jusqu'?au?)\s+([a-z]{3,8})\b/g, (m, a, b) => {
    const i = idx(a), j = idx(b); if (i < 0 || j < 0) return m;
    for (let k = i; ; k = (k + 1) % 7) { jours.add(k); if (k === j) break; }
    return ' ';
  });
  reste = reste.replace(/\b[a-z]{3,9}\b/g, m => { const i = idx(m); if (i < 0) return m; jours.add(i); return ' '; });
  const residu = reste.replace(/\b(et|ou|le|les|de|du|des|la|chaque|tous|toutes)\b/g, ' ').replace(/[^a-z]/g, '').trim();
  const liste = [...jours].sort((a, b) => a - b);
  return { jours: liste, precision: !liste.length || residu ? brut : '' };
}

/** Texte lisible des jours de portage : « Tous les jours », « Lundi au vendredi », « Lundi, mercredi ». */
export function libelleFrequence(portage) {
  if (!portage) return '';
  const j = [...new Set(portage.jours || [])].filter(x => x >= 0 && x < 7).sort((a, b) => a - b), p = (portage.precision || '').trim();
  let txt = '';
  if (j.length === 7) txt = 'Tous les jours';
  else if (j.length) {
    const blocs = []; let d = j[0], f = j[0];
    for (const x of j.slice(1)) { if (x === f + 1) f = x; else { blocs.push([d, f]); d = f = x; } }
    blocs.push([d, f]);
    // une série qui passe par le dimanche (« samedi au mardi ») est un seul bloc
    if (blocs.length > 1 && blocs[0][0] === 0 && blocs[blocs.length - 1][1] === 6 && (blocs[0][1] + 1) + (7 - blocs[blocs.length - 1][0]) >= 3) { const dernier = blocs.pop(); blocs[0] = [dernier[0], blocs[0][1] + 7]; }
    const nom = k => JOURS_PORTAGE[k % 7];
    const morceaux = blocs.map(([a, b]) => b - a >= 2 ? `${nom(a)} au ${nom(b).toLowerCase()}` : a === b ? nom(a) : `${nom(a)}, ${nom(b).toLowerCase()}`);
    txt = morceaux.map((m, i) => i ? m[0].toLowerCase() + m.slice(1) : m).join(', ');
  }
  // une précision qui reprend déjà des noms de jours (texte d'origine non reconnu en entier) remplace la liste calculée
  if (p && j.length && /\b(lun|mar|mer|jeu|ven|sam|dim)/.test(sansAccent(p))) return p;
  return [txt, p].filter(Boolean).join(' · ') || 'Jours à préciser';
}

/** Cette adresse est-elle celle de la résidence ? Compare le numéro et les mots de la rue (sans accent, sans rue/avenue, le code postal et tout ce qui le suit, donc la commune, sont ignorés). */
export function memeAdresse(adresse, residence) {
  const MOTS = new Set(['rue', 'r', 'avenue', 'av', 'allee', 'bd', 'boulevard', 'de', 'des', 'du', 'la', 'le', 'les', 'l', 'd', 'france', 'residence']);
  const jetons = a => sansAccent(a).replace(/\b\d{5}\b.*$/, ' ').replace(/[^a-z0-9]+/g, ' ').split(' ').filter(x => x && !/^\d{5}$/.test(x) && !MOTS.has(x));
  const A = jetons(adresse), R = jetons(residence);
  if (!A.length || !R.length || !R.some(x => /^\d/.test(x))) return false;
  return R.every(x => A.includes(x));
}

/** Fréquences proposées pour une activité (la saisie reste libre : « 1 semaine sur 2 », « 4 fois par an »…). */
export const FREQUENCES_ACTIVITE = ['Toutes les semaines', 'Toutes les 2 semaines', 'Toutes les 3 semaines', '1 fois par mois', '1 fois tous les 2 mois', '4 fois par an', '2 fois par an', '1 fois par an', 'Fréquence variable'];

/* ---------- Lot K (v1.14.0) : tâches, confirmations, programme, alertes ---------- */
export const STATUTS_TACHE = { 'a-faire': 'À faire', 'en-cours': 'En cours', 'en-attente': 'En attente' };
export const PRIORITES_TACHE = { haute: 'Haute', normale: 'Normale', basse: 'Basse' };
const rangPriorite = p => p === 'haute' ? 0 : p === 'basse' ? 2 : 1;
// Tri des tâches : à faire d'abord, puis priorité haute, puis échéance la plus proche
export function comparerTaches(a, b) {
  return (a.done ? 1 : 0) - (b.done ? 1 : 0) || rangPriorite(a.priorite) - rangPriorite(b.priorite) || (a.echeance || '9').localeCompare(b.echeance || '9');
}
// Texte de confirmation d'inscription (à copier dans un message ou à imprimer) ; `quand` est déjà mis en forme (ex. « mar. 3 décembre · 14h »)
export function texteConfirmation({ prenom, activite, quand, lieu, cout, modalites, signature }) {
  return [prenom ? `Bonjour ${prenom},` : 'Bonjour,', '',
    `Nous avons le plaisir de confirmer votre inscription à « ${activite} »${quand ? ', ' + quand : ''}${lieu ? ', ' + lieu : ''}.`,
    cout ? `Participation : ${cout}.` : '', modalites ? `À savoir : ${modalites}` : '',
    'En cas d\'empêchement, merci de nous prévenir pour que la place puisse être proposée à une autre personne.', '', 'À bientôt,', signature || ''].filter((l, i, t) => l !== '' || (t[i - 1] !== '' && i < t.length - 1)).join('\n');
}
// Texte proposant une place libérée à la première personne en attente
export function texteProposition({ prenom, activite, quand, lieu, signature }) {
  return [prenom ? `Bonjour ${prenom},` : 'Bonjour,', '',
    `Une place vient de se libérer pour « ${activite} »${quand ? ', ' + quand : ''}${lieu ? ', ' + lieu : ''}. Souhaitez-vous la prendre ?`,
    'Merci de nous répondre rapidement : à défaut, nous la proposerons à la personne suivante.', '', 'Cordialement,', signature || ''].join('\n');
}
// Programme d'une période : activités datées groupées par mois, puis activités régulières (sans date)
export function programme(activites, du, au) {
  const datees = activites.filter(a => a.date && a.date >= du && a.date <= au).sort((x, y) => x.date.localeCompare(y.date) || String(x.nom).localeCompare(String(y.nom), 'fr'));
  const mois = [];
  for (const a of datees) { const k = a.date.slice(0, 7); let m = mois.find(x => x.mois === k); if (!m) mois.push(m = { mois: k, items: [] }); m.items.push(a); }
  const regulieres = activites.filter(a => !a.date && (a.jour || a.frequence)).sort((x, y) => String(x.nom).localeCompare(String(y.nom), 'fr'));
  return { mois, regulieres };
}
// Alertes de l'accueil, calculées sur les données déjà chargées (aucune lecture en plus)
export function alertesAccueil({ activites, inscriptions, seances, taches, auj, echanges = [], conventions = [], joursConv = 30, materiel = [], emprunts = [], joursPeremption = 30, fiches = null }) {
  const A = [], nomAct = id => (activites.find(a => a.id === id) || {}).nom;
  const ouvertes = taches.filter(t => !t.done);
  const retard = ouvertes.filter(t => t.echeance && t.echeance < auj).sort((x, y) => x.echeance.localeCompare(y.echeance));
  if (retard.length) A.push({ niveau: 'crit', texte: `${retard.length} tâche${retard.length > 1 ? 's' : ''} en retard : ${retard.slice(0, 3).map(t => t.titre).join(', ')}${retard.length > 3 ? '…' : ''}`, vue: 'taches' });
  const hautes = ouvertes.filter(t => t.priorite === 'haute' && !retard.includes(t));
  if (hautes.length) A.push({ niveau: 'warn', texte: `${hautes.length} tâche${hautes.length > 1 ? 's' : ''} de priorité haute : ${hautes.slice(0, 3).map(t => t.titre).join(', ')}${hautes.length > 3 ? '…' : ''}`, vue: 'taches' });
  const att = {}; for (const i of inscriptions) if (i.statut === 'attente') att[i.activiteId] = (att[i.activiteId] || 0) + 1;
  for (const [id, n] of Object.entries(att)) if (nomAct(id)) A.push({ niveau: 'warn', texte: `${n} personne${n > 1 ? 's' : ''} en attente d'une place : ${nomAct(id)}`, act: id });
  const val = {}; for (const s of seances) if (!s.valide) val[s.activiteId] = (val[s.activiteId] || 0) + 1;
  for (const [id, n] of Object.entries(val)) if (nomAct(id)) A.push({ niveau: 'info', texte: `${n} appel${n > 1 ? 's' : ''} à valider : ${nomAct(id)}`, act: id });
  A.push(...alertesPartenaires({ echanges, conventions, auj, joursConv }));
  A.push(...alertesMateriel({ materiel, emprunts, auj, joursPeremption }));
  if (fiches) A.push(...alertesFiches(fiches));
  return A;
}

/* ---------- Lot C (v1.16.0) : partenaires — échanges, réunions, conventions, comptage annuel ---------- */
// Les échanges sont saisis par l'administratrice seule : les partenaires n'ont pas besoin de compte. Chaque échange est rattaché à un partenaire de l'Annuaire
// (ou, pour les réunions de l'équipe de la résidence, marqué « interne »), ce qui permet les bilans et statistiques de fin d'année.
export const TYPES_ECHANGE = { 'appel-entrant': 'Appel entrant', 'appel-sortant': 'Appel sortant', courriel: 'Courriel', reunion: 'Réunion', contact: 'Contact physique', invitation: 'Invitation', relance: 'Relance' };
export const STATUTS_CONVENTION = { 'a-preparer': 'À préparer', envoyee: 'Envoyée', signee: 'Signée', 'a-renouveler': 'À renouveler', terminee: 'Terminée' };
const plusJ = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
/** Message d'erreur (ou '' si tout va bien) pour un échange à enregistrer. */
export function erreurEchange({ date, objet, type, interne, partenaire }) {
  if (!TYPES_ECHANGE[type]) return 'Choisissez le type d\'échange.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return 'Indiquez la date.';
  if (interne && type !== 'reunion') return 'Seule une réunion peut être « interne » (équipe de la résidence).';
  if (!interne && !String(partenaire || '').trim()) return 'Choisissez le partenaire concerné : chaque échange doit être rattaché à un partenaire.';
  if (!String(objet || '').trim()) return 'Donnez un objet à l\'échange.';
  return '';
}
/** Service d'un échange : celui de la fiche du partenaire (à jour), sinon celui noté à l'enregistrement ; « interne » pour l'équipe de la résidence. */
export function serviceEchange(e, parId, interne) { const c = parId && parId[e.partenaireId]; return (e.interne ? interne : c ? c.service : e.service) || ''; }
/**
 * Comptage annuel des échanges (cahier 15.4). Seuls les échanges tenus comptent (les réunions « prévues » ne sont pas comptées avant d'être confirmées).
 * Distingue le nombre d'échanges et le nombre de partenaires distincts. Filtrable par service ou partenaire.
 */
export function comptageEchanges(echanges, contacts, { an, service = '', partenaireId = '', interne = 'Équipe de la résidence' } = {}) {
  const parId = Object.fromEntries((contacts || []).map(c => [c.id, c]));
  const types = Object.keys(TYPES_ECHANGE), zero = () => Object.fromEntries(types.map(k => [k, 0]));
  const rows = echanges.filter(e => e.etat !== 'prevu' && e.date && e.date.slice(0, 4) === String(an))
    .map(e => ({ ...e, _service: serviceEchange(e, parId, interne), _part: e.interne ? interne : (e.partenaire || '') }))
    .filter(e => (!service || e._service === service) && (!partenaireId || e.partenaireId === partenaireId));
  const parType = zero(), parMois = Array.from({ length: 12 }, zero), parService = {}, parPartenaire = {};
  for (const e of rows) {
    if (!(e.type in parType)) continue;
    parType[e.type]++; parMois[Number(e.date.slice(5, 7)) - 1][e.type]++;
    const sv = e._service || '(sans service)'; (parService[sv] = parService[sv] || { nom: sv, n: 0, ...zero() }); parService[sv].n++; parService[sv][e.type]++;
    const cle = e.interne ? 'interne' : (e.partenaireId || 'x:' + e._part);
    (parPartenaire[cle] = parPartenaire[cle] || { cle, nom: e._part || '(partenaire supprimé)', service: e._service, n: 0, ...zero() }); parPartenaire[cle].n++; parPartenaire[cle][e.type]++;
  }
  const total = rows.filter(e => e.type in parType).length;
  const tri = (a, b) => b.n - a.n || String(a.nom).localeCompare(String(b.nom), 'fr');
  return { total, parType, parMois, parService: Object.values(parService).sort(tri), parPartenaire: Object.values(parPartenaire).sort(tri), partenairesDistincts: Object.keys(parPartenaire).length, lignes: rows.sort((a, b) => a.date.localeCompare(b.date)) };
}
/** Dates d'une série mensuelle : même quantième chaque mois (le 31 donne le dernier jour des mois plus courts). */
export function datesSerieMensuelle(debut, nb) {
  const [y, m, j] = String(debut).split('-').map(Number), out = [];
  for (let i = 0; i < nb; i++) { const d = new Date(y, m - 1 + i, 1), fin = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.min(j, fin)).padStart(2, '0')}`); }
  return out;
}
/** Alertes de l'accueil : suites à donner, conventions proches de leur échéance, échanges prévus dont la date est passée. Aucune lecture en plus (données déjà chargées). */
export function alertesPartenaires({ echanges = [], conventions = [], auj, joursConv = 30 }) {
  const A = [], nom = e => e.interne ? 'équipe de la résidence' : (e.partenaire || '?'), liste = (t, f) => t.slice(0, 3).map(f).join(', ') + (t.length > 3 ? '…' : '');
  const suites = echanges.filter(e => e.suiteAFaire && e.suiteDate);
  const retard = suites.filter(e => e.suiteDate < auj).sort((a, b) => a.suiteDate.localeCompare(b.suiteDate));
  if (retard.length) A.push({ niveau: 'crit', texte: `${retard.length} suite${retard.length > 1 ? 's' : ''} à donner en retard (partenaires) : ${liste(retard, nom)}`, vue: 'partenaires', tab: 'echanges' });
  const proches = suites.filter(e => e.suiteDate >= auj && e.suiteDate <= plusJ(auj, 7)).sort((a, b) => a.suiteDate.localeCompare(b.suiteDate));
  if (proches.length) A.push({ niveau: 'warn', texte: `${proches.length} suite${proches.length > 1 ? 's' : ''} à donner cette semaine (partenaires) : ${liste(proches, nom)}`, vue: 'partenaires', tab: 'echanges' });
  const ouvertes = conventions.filter(c => c.echeance && c.statut !== 'terminee');
  const echues = ouvertes.filter(c => c.echeance < auj), bientot = ouvertes.filter(c => c.echeance >= auj && c.echeance <= plusJ(auj, joursConv));
  if (echues.length) A.push({ niveau: 'crit', texte: `${echues.length} convention${echues.length > 1 ? 's' : ''} échue${echues.length > 1 ? 's' : ''} : ${liste(echues, c => c.partenaire || c.intitule)}`, vue: 'partenaires', tab: 'conventions' });
  if (bientot.length) A.push({ niveau: 'warn', texte: `${bientot.length} convention${bientot.length > 1 ? 's' : ''} à renouveler ou à suivre dans les ${joursConv} jours : ${liste(bientot, c => c.partenaire || c.intitule)}`, vue: 'partenaires', tab: 'conventions' });
  const aConfirmer = echanges.filter(e => e.etat === 'prevu' && e.date && e.date < auj);
  if (aConfirmer.length) A.push({ niveau: 'info', texte: `${aConfirmer.length} réunion${aConfirmer.length > 1 ? 's' : ''} ou échange${aConfirmer.length > 1 ? 's' : ''} prévu${aConfirmer.length > 1 ? 's' : ''} dont la date est passée : à confirmer comme tenu${aConfirmer.length > 1 ? 's' : ''}`, vue: 'partenaires', tab: 'reunions' });
  return A;
}
/** Message prêt à copier (invitation ou relance) : l'outil n'envoie rien, l'administratrice le colle dans sa messagerie. */
export function texteMessagePartenaire({ type, referent, objet, quand, signature }) {
  const debut = referent ? `Bonjour ${referent},` : 'Bonjour,';
  if (type === 'invitation') return [debut, '', `Nous avons le plaisir de vous inviter${objet ? ' à « ' + objet + ' »' : ''}${quand ? ' (' + quand + ')' : ''}.`, 'Pourriez-vous nous confirmer votre présence ?', '', 'Cordialement,', signature || ''].join('\n');
  return [debut, '', `Je me permets de revenir vers vous au sujet de « ${objet || 'notre échange précédent'} ».`, 'Pouvez-vous nous indiquer où en est ce dossier ?', '', 'Cordialement,', signature || ''].join('\n');
}

/* ---------- Lot A (v1.17.0) : matériel, réserves, caisses de décorations, emprunts ---------- */
// Tout est écrit pour l'ORGANISATION du service (qui, quoi, où, quand) : aucune donnée de santé, aucune photo (le stockage de fichiers est payant).
// Un article = un document « materiel » de type objet (inventaire), reserve (stock qui se consomme) ou caisse (décorations rangées par saison).
export const TYPES_MATERIEL = { objet: 'Inventaire', reserve: 'Réserve', caisse: 'Caisse de décorations' };
export const ETATS_MATERIEL = { bon: 'Bon état', use: 'Usé', reparer: 'À réparer', manquant: 'Manquant', hs: 'Hors d\'usage' };
export const MODES_PEREMPTION = { aucun: 'Pas de date de péremption', article: 'Une date pour tout l\'article', lot: 'Par lot (plusieurs dates)' };
export const MOTIFS_MOUVEMENT = {
  entree: ['Achat', 'Don', 'Retour d\'un événement', 'Correction d\'inventaire', 'Autre'],
  sortie: ['Atelier', 'Événement ou repas', 'Consommation courante', 'Jeté (périmé)', 'Perte ou casse', 'Correction d\'inventaire', 'Autre']
};
const ISO_JOUR = /^\d{4}-\d{2}-\d{2}$/;
const arrondi = n => Math.round(n * 100) / 100;
/** Nombre saisi (virgule ou point) ; NaN si vide ou illisible. */
export function lireNombre(v) { if (typeof v === 'number') return v; const s = String(v == null ? '' : v).trim().replace(/\s/g, '').replace(',', '.'); return s === '' ? NaN : Number(s); }
/** Quantité affichée à la française (2,5). */
export const fmtQte = n => String(arrondi(Number(n) || 0)).replace('.', ',');

/** Lots d'une réserve suivie « par lot » (sinon liste vide). */
export const lotsDe = m => (m && m.type === 'reserve' && m.peremption === 'lot' && Array.isArray(m.lots) ? m.lots : []);
/** Quantité d'un article : somme des lots en suivi « par lot », sinon la quantité saisie. */
export const quantiteTotale = m => (m && m.type === 'reserve' && m.peremption === 'lot' ? arrondi(lotsDe(m).reduce((n, l) => n + (Number(l.quantite) || 0), 0)) : Number(m && m.quantite) || 0);
/** Dates de péremption encore utiles (il en reste) : une par lot, ou une pour l'article entier. */
export function peremptions(m) {
  if (!m || m.type !== 'reserve') return [];
  if (m.peremption === 'lot') return lotsDe(m).filter(l => l.date && Number(l.quantite) > 0).map(l => ({ date: l.date, quantite: Number(l.quantite), lot: l.libelle || 'lot', lotId: l.id }));
  if (m.peremption === 'article' && m.datePeremption && quantiteTotale(m) > 0) return [{ date: m.datePeremption, quantite: quantiteTotale(m), lot: '', lotId: '' }];
  return [];
}
/** Champs calculés enregistrés avec l'article (ils servent aux alertes de l'accueil, sans tout lire) : quantité, stock bas, manquant, plus proche péremption. */
export function derivesMateriel(m) {
  const quantite = quantiteTotale(m), seuil = Number(m.seuil) || 0, dates = peremptions(m).map(p => p.date).sort();
  return { quantite, bas: m.type !== 'caisse' && seuil > 0 && quantite <= seuil, manquant: m.type !== 'reserve' && m.etat === 'manquant', echeance: dates[0] || '' };
}
/** Texte clair, lisible par toute l'équipe : QUI a relevé la date de péremption, QUAND, et ce qu'elle concerne (un lot ou l'article entier). */
export function textesPeremption(m) {
  if (!m || m.type !== 'reserve') return [];
  const qui = (par, le) => `relevée${le ? ' le ' + fmtDate(le) : ''}${par ? ' par ' + par : ''}`;
  if (m.peremption === 'article' && m.datePeremption) return [`Date de péremption ${qui(m.peremptionPar, m.peremptionLe)} : ${fmtDate(m.datePeremption)} — concerne l'article entier`];
  if (m.peremption === 'lot') return [...lotsDe(m)].filter(l => l.date).sort((a, b) => a.date.localeCompare(b.date)).map(l => `Date de péremption ${qui(l.par, l.le)} : ${fmtDate(l.date)} — concerne le lot « ${l.libelle || 'sans nom'} » (${fmtQte(l.quantite)} ${m.unite || ''})`.replace(/\s+\)/, ')'));
  return [];
}
/** Fusionne les lots saisis avec les anciens : « relevé par / le » ne change que pour un lot nouveau ou dont la date a changé. */
export function fusionnerLots(anciens = [], saisis = [], par = '', auj = '') {
  const parId = Object.fromEntries((anciens || []).map(l => [l.id, l]));
  return saisis.map(s => { const a = s.id && parId[s.id], garde = a && a.date === s.date; return { id: s.id || uid(), libelle: String(s.libelle || '').trim(), quantite: arrondi(Number(s.quantite) || 0), date: s.date || '', par: garde ? a.par : par, le: garde ? a.le : auj }; });
}
/** Message d'erreur (ou '' si tout va bien) pour un article à enregistrer. Les nombres doivent déjà être lus (lireNombre). */
export function erreurMateriel(m) {
  if (!TYPES_MATERIEL[m.type]) return 'Type d\'article inconnu.';
  if (!String(m.nom || '').trim()) return 'Donnez un nom à l\'article.';
  if (m.type === 'caisse' && !String(m.numero || '').trim()) return 'Indiquez le numéro de la caisse.';
  if (m.type !== 'reserve' && !ETATS_MATERIEL[m.etat || 'bon']) return 'Choisissez l\'état.';
  const seuil = m.seuil === '' || m.seuil == null ? 0 : Number(m.seuil);
  if (m.type !== 'caisse' && (!Number.isFinite(seuil) || seuil < 0 || seuil > 1e6)) return 'Le seuil d\'alerte doit être un nombre (0 pour aucune alerte).';
  if (m.type === 'reserve') {
    if (!MODES_PEREMPTION[m.peremption || 'aucun']) return 'Choisissez le suivi de péremption.';
    if (m.peremption === 'article' && !ISO_JOUR.test(m.datePeremption || '')) return 'Indiquez la date de péremption, ou choisissez « Pas de date de péremption ».';
    if (m.peremption === 'lot') {
      const lots = m.lots || [];
      if (!lots.length) return 'Ajoutez au moins un lot, ou choisissez un autre suivi de péremption.';
      for (const l of lots) {
        const q = Number(l.quantite);
        if (!Number.isFinite(q) || q < 0 || q > 1e6) return 'Chaque lot doit avoir une quantité (0 ou plus).';
        if (!ISO_JOUR.test(l.date || '')) return 'Chaque lot doit avoir une date de péremption.';
      }
      return '';
    }
  }
  const q = Number(m.quantite);
  if (!Number.isFinite(q) || q < 0 || q > 1e6) return 'Indiquez une quantité (0 ou plus).';
  if (m.type !== 'reserve' && !Number.isInteger(q)) return 'La quantité doit être un nombre entier.';
  return '';
}
/** Document prêt à enregistrer : champs propres au type, lots fusionnés, « relevé par / le », champs calculés, dernière modification. */
export function preparerMateriel(m, ancien, { par = '', auj = '' } = {}) {
  const d = { ...m };
  if (d.type === 'reserve') {
    d.peremption = MODES_PEREMPTION[d.peremption] ? d.peremption : 'aucun';
    if (d.peremption === 'lot') { d.lots = fusionnerLots(ancien && ancien.lots, d.lots || [], par, auj); d.datePeremption = ''; d.peremptionPar = ''; d.peremptionLe = ''; }
    else if (d.peremption === 'article') { const change = !ancien || ancien.datePeremption !== d.datePeremption; d.lots = []; d.peremptionPar = change ? par : (ancien.peremptionPar || par); d.peremptionLe = change ? auj : (ancien.peremptionLe || auj); }
    else { d.lots = []; d.datePeremption = ''; d.peremptionPar = ''; d.peremptionLe = ''; }
  } else { d.peremption = 'aucun'; d.lots = []; d.datePeremption = ''; d.peremptionPar = ''; d.peremptionLe = ''; }
  d.seuil = d.type === 'caisse' || d.seuil === '' || d.seuil == null ? 0 : Number(d.seuil);
  Object.assign(d, derivesMateriel(d));
  d.modifiePar = par; d.modifieLe = auj;
  return d;
}
/**
 * Applique une entrée ou une sortie de stock à une réserve (fonction pure). mv : { sens, quantite, lotId, lotLibelle, lotDate }.
 * En suivi « par lot » : une entrée va dans un lot existant ou crée un lot (date obligatoire) ; une sortie se fait dans un lot précis (les lots vides disparaissent).
 * Renvoie { materiel, apres, lot } ou { erreur }. Le stock ne peut jamais devenir négatif.
 */
export function appliquerMouvement(m, mv, { par = '', auj = '' } = {}) {
  if (!m || m.type !== 'reserve') return { erreur: 'Les entrées et sorties concernent les réserves.' };
  if (mv.sens !== 'entree' && mv.sens !== 'sortie') return { erreur: 'Choisissez entrée ou sortie.' };
  const n = arrondi(Number(mv.quantite));
  if (!Number.isFinite(n) || n <= 0) return { erreur: 'Indiquez une quantité supérieure à 0.' };
  if (mv.lotDate && !ISO_JOUR.test(mv.lotDate)) return { erreur: 'Date de péremption invalide.' };
  const base = { ...m }; let lot = '';
  if (m.peremption === 'lot') {
    let lots = (m.lots || []).map(l => ({ ...l }));
    if (mv.sens === 'entree') {
      if (mv.lotId) {
        const l = lots.find(x => x.id === mv.lotId); if (!l) return { erreur: 'Lot introuvable.' };
        l.quantite = arrondi((Number(l.quantite) || 0) + n); lot = l.libelle;
        if (mv.lotDate && mv.lotDate !== l.date) { l.date = mv.lotDate; l.par = par; l.le = auj; }
      } else {
        if (!ISO_JOUR.test(mv.lotDate || '')) return { erreur: 'Indiquez la date de péremption du nouveau lot.' };
        lot = String(mv.lotLibelle || '').trim() || `Lot du ${fmtDate(auj)}`;
        lots.push({ id: uid(), libelle: lot, quantite: n, date: mv.lotDate, par, le: auj });
      }
    } else {
      const l = lots.find(x => x.id === mv.lotId); if (!l) return { erreur: 'Choisissez le lot concerné.' };
      if (n > l.quantite) return { erreur: `Stock insuffisant dans ce lot : il en reste ${fmtQte(l.quantite)}.` };
      l.quantite = arrondi(l.quantite - n); lot = l.libelle; lots = lots.filter(x => x.quantite > 0);
    }
    base.lots = lots;
  } else {
    const q = Number(m.quantite) || 0;
    if (mv.sens === 'sortie' && n > q) return { erreur: `Stock insuffisant : il en reste ${fmtQte(q)}.` };
    base.quantite = arrondi(mv.sens === 'entree' ? q + n : q - n);
    if (mv.sens === 'entree' && m.peremption === 'article' && mv.lotDate && mv.lotDate !== m.datePeremption) { base.datePeremption = mv.lotDate; base.peremptionPar = par; base.peremptionLe = auj; }
  }
  base.modifiePar = par; base.modifieLe = auj;
  const d = derivesMateriel(base);
  return { materiel: { ...base, ...d }, apres: d.quantite, lot };
}

/* ----- Emprunts ----- */
/** Quantité actuellement prêtée d'un article (emprunts non rendus). `sauf` : emprunt à ne pas compter (celui qu'on modifie). */
export const pretes = (m, emprunts, sauf = '') => arrondi((emprunts || []).filter(e => e.materielId === m.id && !e.rendu && e.id !== sauf).reduce((n, e) => n + (Number(e.quantite) || 0), 0));
export const disponible = (m, emprunts, sauf = '') => Math.max(0, arrondi((Number(m.quantite) || 0) - pretes(m, emprunts, sauf)));
/** Message d'erreur (ou '') pour un emprunt à enregistrer. */
export function erreurEmprunt(e, m, emprunts) {
  if (!m) return 'Choisissez le matériel emprunté.';
  if (m.type === 'reserve') return 'Une réserve ne se prête pas : utilisez « Sortie » pour la consommer.';
  const q = Number(e.quantite);
  if (!Number.isInteger(q) || q < 1) return 'Indiquez une quantité entière (1 ou plus).';
  if (!String(e.emprunteur || '').trim()) return 'Indiquez qui emprunte : une personne, un service ou une structure.';
  if (!ISO_JOUR.test(e.dateSortie || '')) return 'Indiquez la date de sortie.';
  if (!ISO_JOUR.test(e.retourPrevu || '')) return 'Indiquez la date de retour prévue.';
  if (e.retourPrevu < e.dateSortie) return 'Le retour prévu ne peut pas être avant la date de sortie.';
  if (!e.rendu) { const dispo = disponible(m, emprunts, e.id); if (q > dispo) return dispo ? `Quantité indisponible : il n'en reste que ${fmtQte(dispo)} à prêter.` : 'Plus rien à prêter : tout est déjà sorti.'; }
  return '';
}
/**
 * Enregistre un retour (complet ou partiel). Renvoie { clos, reste } : `clos` est l'emprunt soldé (quantité rendue), `reste` l'emprunt qui demeure ouvert
 * pour ce qui n'a pas été rendu (null si tout est rendu), ou { erreur }.
 */
export function solderEmprunt(e, { quantiteRendue, date, etat = 'bon' }) {
  const q = Number(e.quantite), r = Number(quantiteRendue);
  if (!Number.isInteger(r) || r < 1 || r > q) return { erreur: `La quantité rendue doit être comprise entre 1 et ${fmtQte(q)}.` };
  if (!ISO_JOUR.test(date || '')) return { erreur: 'Indiquez la date de retour.' };
  if (date < e.dateSortie) return { erreur: 'Le retour ne peut pas être avant la date de sortie.' };
  if (!ETATS_MATERIEL[etat]) return { erreur: 'Choisissez l\'état du matériel au retour.' };
  const clos = { ...e, quantite: r, rendu: true, retourReel: date, etatRetour: etat };
  const reste = r < q ? { ...e, id: undefined, quantite: q - r, rendu: false, retourReel: '', etatRetour: '', commentaire: [e.commentaire, `Reste d'un retour partiel du ${fmtDate(date)}`].filter(Boolean).join(' — ') } : null;
  if (reste) delete reste.id;
  return { clos, reste };
}
export function statutEmprunt(e, auj) { return e.rendu ? 'rendu' : e.retourPrevu && e.retourPrevu < auj ? 'retard' : 'encours'; }
export const joursDeRetard = (e, auj) => Math.max(0, Math.round((new Date(auj + 'T12:00:00') - new Date(e.retourPrevu + 'T12:00:00')) / 864e5));

/* ----- Alertes (accueil et écran Matériel) ----- */
export function alertesMateriel({ materiel = [], emprunts = [], auj, joursPeremption = 30 }) {
  const A = [], liste = (t, f) => t.slice(0, 3).map(f).join(', ') + (t.length > 3 ? '…' : ''), s = n => (n > 1 ? 's' : '');
  const horizon = plusJ(auj, joursPeremption), tabDe = m => (m.type === 'reserve' ? 'reserves' : m.type === 'caisse' ? 'caisses' : 'inventaire');
  const nomP = p => p.m.nom + (p.lot ? ` (${p.lot})` : '');
  const per = []; for (const m of materiel) for (const p of peremptions(m)) per.push({ m, ...p });
  const perimes = per.filter(p => p.date < auj).sort((a, b) => a.date.localeCompare(b.date)), bientot = per.filter(p => p.date >= auj && p.date <= horizon).sort((a, b) => a.date.localeCompare(b.date));
  if (perimes.length) A.push({ niveau: 'crit', texte: `${perimes.length} produit${s(perimes.length)} périmé${s(perimes.length)} : ${liste(perimes, p => `${nomP(p)} (${fmtDate(p.date).slice(0, 5)})`)}`, vue: 'materiel', tab: 'reserves' });
  if (bientot.length) A.push({ niveau: 'warn', texte: `${bientot.length} produit${s(bientot.length)} à consommer dans les ${joursPeremption} jours : ${liste(bientot, p => `${nomP(p)} (${fmtDate(p.date).slice(0, 5)})`)}`, vue: 'materiel', tab: 'reserves' });
  for (const tab of ['reserves', 'inventaire']) {
    const bas = materiel.filter(m => tabDe(m) === tab && derivesMateriel(m).bas), vide = bas.filter(m => quantiteTotale(m) === 0), faible = bas.filter(m => quantiteTotale(m) > 0);
    const ou = tab === 'reserves' ? 'réserve' : 'inventaire';
    if (vide.length) A.push({ niveau: 'crit', texte: `${vide.length} article${s(vide.length)} épuisé${s(vide.length)} (${ou}) : ${liste(vide, m => m.nom)}`, vue: 'materiel', tab });
    if (faible.length) A.push({ niveau: 'warn', texte: `${faible.length} article${s(faible.length)} en stock bas (${ou}) : ${liste(faible, m => `${m.nom} (${fmtQte(quantiteTotale(m))}${m.unite && m.unite !== 'unité(s)' ? ' ' + m.unite : ''})`)}`, vue: 'materiel', tab });
  }
  const retard = emprunts.filter(e => !e.rendu && e.retourPrevu && e.retourPrevu < auj).sort((a, b) => a.retourPrevu.localeCompare(b.retourPrevu));
  if (retard.length) A.push({ niveau: 'crit', texte: `${retard.length} emprunt${s(retard.length)} en retard : ${liste(retard, e => `${e.materielNom} (${e.emprunteur})`)}`, vue: 'materiel', tab: 'emprunts' });
  const manq = materiel.filter(m => derivesMateriel(m).manquant);
  if (manq.length) A.push({ niveau: 'warn', texte: `${manq.length} matériel${manq.length > 1 ? 's' : ''} déclaré${s(manq.length)} manquant${s(manq.length)} : ${liste(manq, m => m.nom)}`, vue: 'materiel', tab: manq.every(m => m.type === 'caisse') ? 'caisses' : 'inventaire' });
  return A;
}

/* ----- Tableaux pour les exports Excel / PDF et la sauvegarde ----- */
export function tableauxMateriel({ materiel = [], emprunts = [], mouvements = [] }, auj = '') {
  const tri = (a, b) => String(a).localeCompare(String(b), 'fr'), par = t => materiel.filter(m => m.type === t);
  const e = v => (v ? ETATS_MATERIEL[v] || v : '');
  const reserves = [];
  for (const m of [...par('reserve')].sort((a, b) => tri((a.categorie || '') + a.nom, (b.categorie || '') + b.nom))) {
    const base = [m.nom, m.categorie || '', m.unite || ''], fin = [m.seuil || '', m.emplacement || '', m.commentaire || ''];
    if (m.peremption === 'lot' && lotsDe(m).length) for (const l of lotsDe(m)) reserves.push([...base, Number(l.quantite) || 0, 'Par lot', fmtDate(l.date), `Lot « ${l.libelle || 'sans nom'} »`, fmtDate(l.le), l.par || '', ...fin]);
    else reserves.push([...base, quantiteTotale(m), MODES_PEREMPTION[m.peremption || 'aucun'], fmtDate(m.datePeremption), m.datePeremption ? 'Article entier' : '', fmtDate(m.peremptionLe), m.peremptionPar || '', ...fin]);
  }
  return [
    { nom: 'Inventaire', titre: 'Inventaire du matériel (vaisselle, décorations, matériel créatif et de loisirs, équipements)',
      cols: ['Article', 'Catégorie', 'Quantité', 'Prêtée', 'Disponible', 'Seuil d\'alerte', 'Emplacement', 'État', 'Commentaire', 'Modifié par', 'Le'],
      rows: [...par('objet')].sort((a, b) => tri((a.categorie || '') + a.nom, (b.categorie || '') + b.nom)).map(m => [m.nom, m.categorie || '', Number(m.quantite) || 0, pretes(m, emprunts), disponible(m, emprunts), m.seuil || '', m.emplacement || '', e(m.etat), m.commentaire || '', m.modifiePar || '', fmtDate(m.modifieLe)]) },
    { nom: 'Réserves', titre: 'Réserves alimentaires, boissons et fournitures (une ligne par lot quand le suivi est « par lot »)',
      cols: ['Article', 'Catégorie', 'Unité', 'Quantité', 'Suivi de péremption', 'Date de péremption', 'Concerne', 'Relevée le', 'Relevée par', 'Seuil d\'alerte', 'Emplacement', 'Commentaire'], rows: reserves },
    { nom: 'Caisses', titre: 'Caisses de décorations saisonnières',
      cols: ['N° de caisse', 'Nom', 'Saison', 'Contenu', 'Quantité', 'Emplacement', 'État', 'Commentaire'],
      rows: [...par('caisse')].sort((a, b) => tri(a.saison || '', b.saison || '') || tri(a.numero, b.numero)).map(m => [m.numero, m.nom, m.saison || '', m.contenu || '', Number(m.quantite) || 0, m.emplacement || '', e(m.etat), m.commentaire || '']) },
    { nom: 'Emprunts', titre: 'Emprunts de matériel',
      cols: ['Matériel', 'Quantité', 'Emprunteur', 'Sortie le', 'Retour prévu', 'Retour réel', 'État au retour', 'Situation', 'Commentaire', 'Saisi par'],
      rows: [...emprunts].sort((a, b) => (b.dateSortie || '').localeCompare(a.dateSortie || '')).map(x => [x.materielNom, Number(x.quantite) || 0, x.emprunteur, fmtDate(x.dateSortie), fmtDate(x.retourPrevu), fmtDate(x.retourReel), e(x.etatRetour), { rendu: 'Rendu', retard: 'En retard', encours: 'En cours' }[statutEmprunt(x, auj || '9999-12-31')], x.commentaire || '', x.par || '']) },
    { nom: 'Mouvements de stock', titre: 'Entrées et sorties de stock des réserves',
      cols: ['Date', 'Article', 'Sens', 'Quantité', 'Lot', 'Motif', 'Précision', 'Stock après', 'Saisi par'],
      rows: [...mouvements].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.creeLe || '').localeCompare(a.creeLe || '')).map(v => [fmtDate(v.date), v.materielNom, v.sens === 'entree' ? 'Entrée' : 'Sortie', Number(v.quantite) || 0, v.lot || '', v.motif || '', v.note || '', v.apres == null ? '' : v.apres, v.par || '']) }
  ];
}


/* ---------- Lot F (v1.18.0) : fiches enrichies, adhésions par année, campagne annuelle de vérification ---------- */
// Une adhésion couvre l'ANNÉE CIVILE (décision du 23/11/2026). Les anciennes fiches (champ `adhesion` unique, `tel`, `contactNom`/`contactTel`) restent lisibles :
// elles sont converties à la volée par adhesionsDe / telephones / prochesDe, puis réécrites au nouveau format par completerSenior (migration à l'ouverture de « Personnes »).
const EST_DATE = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '');
export const MAX_PROCHES = 3;
/** Année visée par les relances : l'année suivante à partir du 1er du mois de début (décembre par défaut), sinon l'année en cours. */
export function anneeCible(auj, moisDebut = 12) {
  const a = Number(String(auj).slice(0, 4)), m = Number(String(auj).slice(5, 7));
  return m >= moisDebut ? a + 1 : a;
}
/** Adhésions d'une personne, une par année, de la plus ancienne à la plus récente (ancien champ `adhesion` converti). */
export function adhesionsDe(s) {
  if (!s) return [];
  let l = Array.isArray(s.adhesions) ? s.adhesions : (s.adhesion && s.adhesion.date ? [{ annee: Number(String(s.adhesion.date).slice(0, 4)), date: s.adhesion.date, montant: s.adhesion.montant, paye: !!s.adhesion.paye }] : []);
  const par = new Map();
  for (const a of l) { if (!a || !Number.isFinite(Number(a.annee))) continue; par.set(Number(a.annee), { annee: Number(a.annee), date: a.date || '', montant: a.montant == null || a.montant === '' ? 0 : Number(a.montant), paye: !!a.paye, mode: a.mode || '', datePaiement: a.datePaiement || (a.paye ? a.date || '' : ''), relanceLe: a.relanceLe || '' }); }
  return [...par.values()].sort((x, y) => x.annee - y.annee);
}
/** Situation de l'adhésion pour une année : 'na' (ni cotisation ni suivi), 'reglee', 'a-regler' (saisie mais non réglée, ou jamais réglée), 'a-renouveler' (réglée une année précédente, rien pour l'année). */
export function statutAdhesion(s, annee) {
  if (!s || s.statut !== 'adherent') return 'na';
  const l = adhesionsDe(s), a = l.find(x => x.annee === annee);
  if (a) return a.paye ? 'reglee' : 'a-regler';
  return l.some(x => x.annee < annee && x.paye) ? 'a-renouveler' : 'a-regler';
}
export const LIBELLES_ADHESION = { reglee: 'Réglée', 'a-regler': 'À régler', 'a-renouveler': 'À renouveler', na: '' };
/** Message d'erreur (ou '') pour une adhésion à enregistrer. */
export function erreurAdhesion(a) {
  if (!Number.isInteger(Number(a.annee)) || a.annee < 2000 || a.annee > 2100) return 'Indiquez l\'année de l\'adhésion.';
  if (a.date && !EST_DATE(a.date)) return 'La date d\'adhésion est illisible.';
  const m = a.montant === '' || a.montant == null ? 0 : Number(a.montant);
  if (!Number.isFinite(m) || m < 0) return 'Le montant doit être un nombre positif ou nul.';
  if (a.datePaiement && !EST_DATE(a.datePaiement)) return 'La date de règlement est illisible.';
  if (a.paye && !a.datePaiement) return 'Indiquez la date de règlement.';
  return '';
}
/** Ajoute (ou remplace) l'adhésion d'une année ; renvoie la nouvelle liste triée. */
export function avecAdhesion(s, adh) {
  const l = adhesionsDe(s).filter(x => x.annee !== Number(adh.annee));
  const ancien = adhesionsDe(s).find(x => x.annee === Number(adh.annee)) || {};
  l.push({ annee: Number(adh.annee), date: adh.date || ancien.date || '', montant: adh.montant === '' || adh.montant == null ? 0 : Number(adh.montant), paye: !!adh.paye, mode: adh.paye ? (adh.mode || '') : '', datePaiement: adh.paye ? (adh.datePaiement || '') : '', relanceLe: adh.relanceLe != null ? adh.relanceLe : (ancien.relanceLe || '') });
  return l.sort((x, y) => x.annee - y.annee);
}
/** Renouvellement : crée l'adhésion de l'année (non réglée, montant proposé). Erreur si elle existe déjà ou si la personne n'est pas adhérente. */
export function renouveler(s, annee, { auj, montant = 0 } = {}) {
  if (!s || s.statut !== 'adherent') return { erreur: 'Seul·e un·e adhérent·e se renouvelle.' };
  if (adhesionsDe(s).some(x => x.annee === annee)) return { erreur: `L'adhésion ${annee} existe déjà.` };
  return { adhesions: avecAdhesion(s, { annee, date: auj, montant, paye: false }) };
}
/** Marque une relance (date) sur l'adhésion de l'année, qu'elle existe ou non. */
export function marquerRelance(s, annee, auj, montant = 0) {
  const a = adhesionsDe(s).find(x => x.annee === annee);
  return avecAdhesion(s, a ? { ...a, relanceLe: auj } : { annee, date: '', montant, paye: false, relanceLe: auj });
}
/** Dernière année réglée (0 si aucune) pour les adhérent·es ; 9999 pour les autres (« sans objet » : jamais retenus par la requête `adhAnnee < année cible`, null étant traité différemment selon les bases). */
export const SANS_ADHESION = 9999;
export const derniereAnneeReglee = s => (s && s.statut === 'adherent' ? adhesionsDe(s).filter(a => a.paye).reduce((m, a) => Math.max(m, a.annee), 0) : SANS_ADHESION);
/** Téléphones : fixe et portable (une ancienne fiche n'a qu'un `tel` : 06 / 07 → portable, sinon fixe). */
export function telephones(s) {
  if (!s) return { fixe: '', portable: '' };
  if (s.telFixe !== undefined || s.telPortable !== undefined) return { fixe: s.telFixe || '', portable: s.telPortable || '' };
  const t = String(s.tel || '').trim(); if (!t) return { fixe: '', portable: '' };
  return /^(\+33|0033|0)[67]/.test(t.replace(/[\s.\-]/g, '')) ? { fixe: '', portable: t } : { fixe: t, portable: '' };
}
/** Proches (3 au plus) : nom, lien, téléphone. Une ancienne fiche (contactNom / contactTel) devient le premier proche. */
export function prochesDe(s) {
  if (!s) return [];
  const l = Array.isArray(s.proches) ? s.proches : (s.contactNom || s.contactTel ? [{ nom: s.contactNom || '', lien: '', tel: s.contactTel || '' }] : []);
  return l.map(p => ({ nom: String(p.nom || '').trim(), lien: String(p.lien || '').trim(), tel: String(p.tel || '').trim() })).filter(p => p.nom || p.tel).slice(0, MAX_PROCHES);
}
/** Champs recopiés ou calculés à enregistrer avec la fiche : adhésions normalisées, ancien champ `adhesion` (année la plus récente), `adhAnnee` (requêtes de l'accueil), téléphones, proches, `verifieLe`. */
export function champsCalcules(s) {
  const adh = adhesionsDe(s), tel = telephones(s), pro = prochesDe(s), dern = adh.length ? adh[adh.length - 1] : null;
  return {
    adhesions: adh, adhesion: s.statut === 'adherent' && dern ? { date: dern.date, montant: dern.montant, paye: dern.paye } : null, adhAnnee: derniereAnneeReglee(s),
    telFixe: tel.fixe, telPortable: tel.portable, tel: tel.portable || tel.fixe, proches: pro, contactNom: pro[0] ? pro[0].nom : '', contactTel: pro[0] ? pro[0].tel : '',
    verifieLe: s.verifieLe || ''
  };
}
export const completerSenior = s => ({ ...s, ...champsCalcules(s) });
/** Fiche à convertir au nouveau format (migration à l'ouverture de « Personnes ») ? */
export const besoinMigration = s => !!s && (s.verifieLe === undefined || s.proches === undefined || s.telFixe === undefined || !Array.isArray(s.adhesions) || s.adhAnnee === undefined);
/** Date limite : une fiche vérifiée avant cette date (ou jamais) est « à vérifier ». */
export function seuilVerification(auj, mois = 12) { const d = new Date(auj + 'T12:00:00'); d.setMonth(d.getMonth() - mois); return d.toISOString().slice(0, 10); }
export const aVerifier = (s, auj, mois = 12) => !s.verifieLe || s.verifieLe < seuilVerification(auj, mois);
/** Marque la fiche comme vérifiée. */
export const marquerVerifiee = (s, { par, auj }) => ({ id: s.id, verifieLe: auj, verifiePar: par || '' });
/** Alertes de l'accueil (compteurs lus côté serveur : aucune fiche téléchargée). */
export function alertesFiches({ adh = 0, verif = 0, cible, mois = 12 } = {}) {
  const A = [];
  if (adh > 0) A.push({ niveau: 'warn', texte: `${adh} adhésion${adh > 1 ? 's' : ''} à renouveler ou à régler pour ${cible}`, vue: 'seniors', tab: 'adhesions' });
  if (verif > 0) A.push({ niveau: 'info', texte: `${verif} fiche${verif > 1 ? 's' : ''} à vérifier (non vérifiée${verif > 1 ? 's' : ''} depuis plus de ${mois} mois)`, vue: 'seniors', tab: 'verification' });
  return A;
}
/** Message de relance à copier (rien n'est envoyé). */
export function messageRelance(s, annee, { service = '', montant = 0 } = {}) {
  const st = statutAdhesion(s, annee), prenom = s.prenom || '';
  const m = montant ? ` (${montant} €)` : '';
  const corps = st === 'a-regler' ? `votre cotisation ${annee}${m} n'est pas encore réglée.` : `il est temps de renouveler votre adhésion pour ${annee}${m}.`;
  return `Bonjour ${prenom},\n\n${corps} Vous pouvez la régler auprès du service${service ? ' ' + service : ''}.\n\nMerci et à bientôt !`;
}
/** Tableaux d'export des adhésions d'une année et de l'historique (une ligne par personne et par année). */
export function tableauxAdhesions(seniors, annee) {
  const adh = seniors.filter(s => s.statut === 'adherent').sort(comparerPatronyme);
  const lib = a => (a ? (a.paye ? 'Réglée' : 'À régler') : '');
  return [
    { nom: `Adhésions ${annee}`, titre: `Adhésions de l'année ${annee}`, cols: ['Nom', 'Prénom', 'Situation', 'Montant (€)', 'Date d\'adhésion', 'Réglée le', 'Mode de règlement', 'Relancé le', 'Téléphone', 'E-mail'],
      rows: adh.map(s => { const a = adhesionsDe(s).find(x => x.annee === annee), t = telephones(s); return [s.nom, s.prenom, LIBELLES_ADHESION[statutAdhesion(s, annee)], a ? a.montant : '', a ? fmtDate(a.date) : '', a && a.paye ? fmtDate(a.datePaiement) : '', a ? a.mode : '', a && a.relanceLe ? fmtDate(a.relanceLe) : '', t.portable || t.fixe, s.email || '']; }) },
    { nom: 'Historique des adhésions', titre: 'Historique des adhésions par année',
      cols: ['Nom', 'Prénom', 'Année', 'Montant (€)', 'Date d\'adhésion', 'Situation', 'Réglée le', 'Mode de règlement'],
      rows: adh.flatMap(s => adhesionsDe(s).map(a => [s.nom, s.prenom, a.annee, a.montant, fmtDate(a.date), lib(a), a.paye ? fmtDate(a.datePaiement) : '', a.mode])) }
  ];
}
/** Liste imprimable de la campagne de vérification (à faire relire par chaque personne). */
export function tableauVerification(seniors, auj, mois = 12, residence = '') {
  const l = seniors.filter(s => aVerifier(s, auj, mois)).sort(comparerPatronyme);
  return { nom: 'Fiches à vérifier', titre: `Fiches à vérifier au ${fmtDate(auj)}`,
    cols: ['Nom', 'Prénom', 'Naissance', 'Adresse ou lieu de vie', 'Commune', 'Tél. fixe', 'Tél. portable', 'E-mail', 'Proches (nom, lien, tél.)', 'Adhésion ' + auj.slice(0, 4), 'Dernière vérification', 'Vérifié'],
    rows: l.map(s => { const t = telephones(s); return [s.nom, s.prenom, fmtDate(s.naissance), s.statut === 'resident' ? (residence ? residence + (s.appartement ? ', appt ' + s.appartement : '') : 'Résidence') : s.adresse || '', s.statut === 'resident' ? '' : s.commune || '', t.fixe, t.portable, s.email || '',
      prochesDe(s).map(p => [p.nom, p.lien, p.tel].filter(Boolean).join(', ')).join(' ; '), s.statut === 'adherent' ? LIBELLES_ADHESION[statutAdhesion(s, Number(auj.slice(0, 4)))] : '—', s.verifieLe ? fmtDate(s.verifieLe) : 'Jamais', '☐']; }) };
}
