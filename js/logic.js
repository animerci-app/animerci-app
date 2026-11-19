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
  const a = senior.adhesion;
  return !!(a && a.date && new Date(a.date).getFullYear() === annee && a.paye);
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
