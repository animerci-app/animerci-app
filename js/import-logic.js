// Lecture de listes (CSV, Excel .xlsx) et préparation de l'import — logique pure, sans écran (testable).
// Rien n'est codé en dur : ni noms ni listes ; seulement des synonymes de titres de colonnes pour reconnaître un tableau.
import { deduireSexe } from './prenoms.js';
import { cleNom, lireDate, separerNom, homonymes, nomComplet, normContact, lireFrequence, memeAdresse } from './logic.js';

/* ---------- Lecture des fichiers ---------- */
const decoder = (buf) => { try { return new TextDecoder('utf-8', { fatal: true }).decode(buf); } catch { return new TextDecoder('windows-1252').decode(buf); } };   // CSV d'Excel français : souvent Windows-1252

export function lireCsv(texte) {
  const t = String(texte).replace(/^﻿/, ''), premiere = t.split(/\r?\n/, 1)[0] || '';
  const sep = [';', '\t', ','].map(c => [c, premiere.split(c).length]).sort((a, b) => b[1] - a[1])[0][0];
  const lignes = []; let ligne = [], cell = '', q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) { if (c === '"') { if (t[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { ligne.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; ligne.push(cell); cell = ''; lignes.push(ligne); ligne = []; }
    else cell += c;
  }
  if (cell !== '' || ligne.length) { ligne.push(cell); lignes.push(ligne); }
  return lignes.filter(l => l.some(x => String(x).trim() !== ''));
}

const decodeXml = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&amp;/g, '&');
const colIndex = ref => { let n = 0; for (const ch of /^[A-Z]+/i.exec(ref)[0].toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

async function inflater(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
/** Lit un fichier .xlsx (zip) : renvoie les feuilles [{ nom, lignes }]. */
export async function lireXlsx(buf) {
  const u = new Uint8Array(buf), v = new DataView(buf), dec = new TextDecoder();
  let fin = -1; for (let i = u.length - 22; i >= Math.max(0, u.length - 70000); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break; }
  if (fin < 0) throw new Error('Ce fichier n\'est pas un classeur Excel (.xlsx) valide.');
  const n = v.getUint16(fin + 10, true); let p = v.getUint32(fin + 16, true); const entrees = {};
  for (let k = 0; k < n; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) break;
    const meth = v.getUint16(p + 10, true), tc = v.getUint32(p + 20, true), ln = v.getUint16(p + 28, true), lm = v.getUint16(p + 30, true), lc = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    entrees[dec.decode(u.subarray(p + 46, p + 46 + ln))] = { meth, tc, off }; p += 46 + ln + lm + lc;
  }
  const lire = async nom => {
    const e = entrees[nom]; if (!e) return null;
    const d = e.off + 30 + v.getUint16(e.off + 26, true) + v.getUint16(e.off + 28, true), brut = u.subarray(d, d + e.tc);
    return dec.decode(e.meth === 8 ? await inflater(brut) : brut);
  };
  const ss = await lire('xl/sharedStrings.xml'), chaines = [];
  if (ss) for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) chaines.push(decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join('')));
  const lireFeuille = xml => {
    const lignes = [];
    for (const r of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
      const ligne = [];
      for (const c of r[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const at = c[1], ref = /\br="([A-Z]+\d+)"/.exec(at), t = (/\bt="(\w+)"/.exec(at) || [])[1], corps = c[2] || '';
        if (!ref) continue;
        let val = '';
        if (t === 'inlineStr') val = decodeXml([...corps.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x => x[1]).join(''));
        else { const m = /<v>([\s\S]*?)<\/v>/.exec(corps); if (m) val = t === 's' ? (chaines[Number(m[1])] || '') : t === 'str' ? decodeXml(m[1]) : t === 'b' ? (m[1] === '1' ? 'oui' : 'non') : (m[1] !== '' && !isNaN(Number(m[1])) ? Number(m[1]) : decodeXml(m[1])); }
        ligne[colIndex(ref[1])] = val;
      }
      for (let i = 0; i < ligne.length; i++) if (ligne[i] === undefined) ligne[i] = '';
      lignes.push(ligne);
    }
    return lignes.filter(l => l.some(x => String(x).trim() !== ''));
  };
  // noms des feuilles (workbook.xml) reliés à leurs fichiers (workbook.xml.rels) ; à défaut, ordre des fichiers
  const wb = await lire('xl/workbook.xml'), rels = await lire('xl/_rels/workbook.xml.rels'), cibles = {};
  if (rels) for (const m of rels.matchAll(/<Relationship\b([^>]*)\/?>/g)) { const id = /\bId="([^"]+)"/.exec(m[1]), tg = /\bTarget="([^"]+)"/.exec(m[1]); if (id && tg) cibles[id[1]] = 'xl/' + tg[1].replace(/^\/?(xl\/)?/, ''); }
  let feuilles = [];
  if (wb) for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) { const nom = /\bname="([^"]*)"/.exec(m[1]), rid = /\br:id="([^"]+)"/.exec(m[1]); if (nom && rid && cibles[rid[1]] && entrees[cibles[rid[1]]]) feuilles.push({ nom: decodeXml(nom[1]), fichier: cibles[rid[1]] }); }
  if (!feuilles.length) feuilles = Object.keys(entrees).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((x, y) => parseInt(x.replace(/\D/g, '')) - parseInt(y.replace(/\D/g, ''))).map((f, i) => ({ nom: `Feuille ${i + 1}`, fichier: f }));
  if (!feuilles.length) throw new Error('Aucune feuille trouvée dans ce classeur.');
  const res = []; for (const f of feuilles) res.push({ nom: f.nom, lignes: lireFeuille(await lire(f.fichier)) });
  return res.filter(f => f.lignes.length);
}
/** Lit un fichier choisi par l'utilisatrice (contenu + nom) : renvoie les feuilles [{ nom, lignes }] (un CSV n'a qu'une feuille). */
export async function lireListe(buf, nom) {
  if (/\.xlsx$/i.test(nom)) return lireXlsx(buf);
  if (/\.xls$/i.test(nom)) throw new Error('Ancien format Excel (.xls) non lu : enregistrez le fichier au format .xlsx ou CSV, puis recommencez.');
  return [{ nom: 'Fichier', lignes: lireCsv(decoder(buf)) }];
}

/* ---------- Texte collé (liste copiée depuis Word) ---------- */
const PUCE = /^\s*(?:[•·▪◦●○■*•·–—-]|\d+[.)])\s*/;
const TITRES_CIVILITE = ['pere', 'abbe', 'pasteur', 'soeur', 'frere', 'madame', 'monsieur', 'mme', 'mlle', 'dr', 'docteur', 'maitre', 'me', 'mgr'];
const RE_JF = /\s*[–—-]?\s*nom\s+de\s+jeune\s+fille\s*:?\s*/i;
const RE_CONF = /\s*[–—-]?\s*pr[ée]nom\s+(?:à|a)\s+confirmer\s*/i;
const toutMajuscule = t => /[A-ZÀ-ÖØ-Þ]/.test(t) && t === t.toLocaleUpperCase('fr');
/**
 * Transforme un texte collé en tableau [titres, ...lignes] que l'écran d'import sait lire.
 * - texte tabulé (tableau Word ou Excel collé) : lu comme un CSV, première ligne = titres ;
 * - sinon une personne par ligne : « NOM Prénom – Nom de jeune fille : X », « Prénom Nom (précision) » ; les lignes sans puce
 *   d'une liste à puces sont des titres de groupe (utilisés comme précision) ; « Prénom à confirmer » est repéré.
 * Renvoie { lignes, format, ignorees } ; lignes est vide si rien n'est lisible.
 */
export function lireTexte(texte, cible) {
  const brut = String(texte || '').replace(/\r/g, '').split('\n');
  const utiles = brut.filter(l => l.trim());
  if (!utiles.length) return { lignes: [], format: 'vide', ignorees: 0 };
  if (utiles.filter(l => l.includes('\t')).length >= Math.max(2, Math.ceil(utiles.length / 2))) return { lignes: lireCsv(brut.join('\n')), format: 'tableau', ignorees: 0 };
  if (cible === 'activites') return { lignes: [['Nom'], ...utiles.map(l => [l.replace(PUCE, '').trim()]).filter(x => x[0])], format: 'liste', ignorees: 0 };
  const seniors = cible === 'seniors', avecPuces = utiles.filter(l => PUCE.test(l)).length, groupes = avecPuces >= 1 && avecPuces < utiles.length;
  const rows = []; let groupe = '', ignorees = 0;
  for (const ligne of utiles) {
    const puce = PUCE.test(ligne); let t = ligne.replace(PUCE, '').replace(/\s+/g, ' ').trim(); if (!t) continue;
    if (groupes && !puce) { groupe = t.replace(/\s*[:：]\s*$/, ''); continue; }
    if (seniors) {
      if (t.split(' ').length >= 3 && toutMajuscule(t.replace(/[0-9]/g, ''))) { ignorees++; continue; }   // titre de document : « LISTE DES ADHÉRENTS 2026 »
      let conf = '', jf = ''; if (RE_CONF.test(t)) { conf = 'oui'; t = t.replace(RE_CONF, ' ').trim(); }
      const m = RE_JF.exec(t); if (m) { jf = t.slice(m.index + m[0].length).trim(); t = t.slice(0, m.index).trim(); }
      t = t.replace(/[–—-]\s*$/, '').trim(); if (t) rows.push([t, jf, conf]);
    } else {
      let prec = '', m;
      const equipe = /^(.*?)\(([^)]*,[^)]*)\)\s*$/.exec(t);
      if (equipe && /[ée]quipe/i.test(equipe[1])) { for (const nom of equipe[2].split(',').map(x => x.trim()).filter(Boolean)) rows.push([nom, [groupe, 'équipe'].filter(Boolean).join(' — ')]); continue; }
      if ((m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(t))) { t = m[1].trim(); prec = m[2].trim(); }
      const mots = t.split(' '), civ = cleNom(mots[0].replace(/\.$/, ''));
      if (mots.length > 1 && TITRES_CIVILITE.includes(civ)) { prec = [mots[0], prec].filter(Boolean).join(' · '); t = mots.slice(1).join(' '); }
      rows.push([t, [groupe, prec].filter(Boolean).join(' — ')]);
    }
  }
  const titres = seniors ? ['Nom complet', 'Nom de jeune fille', 'Prénom à confirmer'] : ['Nom complet', 'Précision'];
  return { lignes: rows.length ? [titres, ...rows] : [], format: 'liste', ignorees };
}

/** Deux noms complets qui ne diffèrent que d'une lettre (faute de frappe probable) : « Rolande » / « Rollande ». */
export function proche(a, b) {
  const x = cleNom(a), y = cleNom(b); if (x === y || Math.min(x.length, y.length) < 12 || Math.abs(x.length - y.length) > 1) return false;
  let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++;
  return x.slice(i + 1) === y.slice(i) || x.slice(i) === y.slice(i + 1) || x.slice(i + 1) === y.slice(i + 1);
}

/* ---------- Reconnaissance des colonnes ---------- */
export const CHAMPS = {
  seniors: [['', '— ignorer cette colonne —'], ['complet', 'Nom complet (Prénom Nom)'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['nomNaissance', 'Nom de jeune fille'], ['naissance', 'Date de naissance'], ['sexe', 'Sexe'], ['statut', 'Statut'], ['adresse', 'Adresse'], ['commune', 'Commune'], ['tel', 'Téléphone'], ['contactNom', 'Personne à prévenir'], ['contactTel', 'Téléphone de cette personne'], ['aConfirmer', 'Prénom à confirmer'], ['frequence', 'Portage de repas : fréquence'], ['appartement', 'Appartement (résidents)']],
  activites: [['', '— ignorer cette colonne —'], ['nom', 'Nom de l\'activité'], ['type', 'Type (activité, sortie, événement)'], ['categorie', 'Catégorie'], ['jour', 'Jour et horaire'], ['frequence', 'Fréquence'], ['lieu', 'Lieu'], ['cap', 'Nombre de places']],
  contacts: [['', '— ignorer cette colonne —'], ['complet', 'Nom complet (Prénom Nom)'], ['nom', 'Nom'], ['prenom', 'Prénom'], ['precision', 'Métier, activité ou organisme'], ['categorie', 'Catégorie'], ['tel', 'Téléphone'], ['email', 'E-mail'], ['note', 'Remarque']]
};
const SYNONYMES = {
  nom: ['nom', 'patronyme', 'nom de famille', 'nom d usage', 'nom usuel', 'activite', 'nom de l activite', 'intitule'],
  prenom: ['prenom', 'prenoms'],
  complet: ['nom complet', 'prenom nom', 'nom prenom', 'identite', 'personne', 'beneficiaire', 'nom et prenom', 'prenom et nom'],
  nomNaissance: ['nom de jeune fille', 'nom de naissance', 'jeune fille', 'nee', 'nom jeune fille'],
  naissance: ['naissance', 'date de naissance', 'ne le', 'ne e le', 'date naissance', 'ddn', 'date de naiss', 'date anniversaire', 'anniversaire'],
  aConfirmer: ['prenom a confirmer', 'a confirmer', 'prenom incertain'],
  appartement: ['appartement', 'appart', 'n appartement', 'numero appartement', 'logement', 'n logement', 'numero logement'],
  jour: ['jour', 'jours', 'jour et horaire', 'horaire', 'horaires', 'creneau'],
  lieu: ['lieu', 'endroit', 'salle'],
  cap: ['places', 'nombre de places', 'capacite', 'effectif'],
  frequence: ['frequence', 'frequence de portage', 'jours de portage', 'portage', 'jours de livraison', 'frequence de livraison', 'jours de repas'],
  sexe: ['sexe', 'genre', 'civilite'],
  statut: ['statut'],
  adresse: ['adresse', 'adresse postale', 'domicile'],
  commune: ['commune', 'ville', 'localite', 'code postal et ville'],
  tel: ['telephone', 'tel', 'portable', 'mobile', 'numero de telephone', 'telephone fixe'],
  contactNom: ['personne a prevenir', 'contact', 'personne a contacter', 'en cas d urgence'],
  contactTel: ['telephone de cette personne', 'tel de cette personne', 'telephone personne a prevenir', 'tel contact', 'telephone contact'],
  email: ['email', 'e mail', 'mail', 'courriel', 'adresse e mail', 'adresse mail'],
  type: ['type', 'nature'],
  categorie: ['categorie', 'type', 'liste', 'groupe'],
  precision: ['precision', 'metier', 'activite', 'fonction', 'organisme', 'profession', 'specialite', 'structure'],
  note: ['remarque', 'remarques', 'note', 'notes', 'commentaire', 'commentaires', 'observations']
};
const titre = s => cleNom(String(s || '').replace(/[’'_\-./()]/g, ' ')).replace(/\s+/g, ' ').trim();
/**
 * Devine, pour chaque colonne, le champ de l'outil (d'après la ligne de titres). La ligne de titres est cherchée parmi les 6 premières
 * (un fichier peut commencer par un titre ou une date d'édition). Renvoie { colonnes: [champ|''], entete: bool, ligne: index de la ligne de titres }.
 */
export function detecterColonnes(lignes, cible) {
  const autorises = new Set(CHAMPS[cible].map(x => x[0]).filter(Boolean));
  const essai = premiere => { const vus = new Set(); return premiere.map(h => { const t = titre(h); for (const [champ, syn] of Object.entries(SYNONYMES)) if (autorises.has(champ) && !vus.has(champ) && syn.includes(t)) { vus.add(champ); return champ; } return ''; }); };
  let meilleur = { colonnes: essai(lignes[0] || []), ligne: 0 };
  for (let i = 1; i < Math.min(6, lignes.length); i++) { const c = essai(lignes[i]); if (c.filter(Boolean).length > meilleur.colonnes.filter(Boolean).length) meilleur = { colonnes: c, ligne: i }; }
  return { ...meilleur, entete: meilleur.colonnes.some(Boolean) };
}

/* ---------- Préparation de l'import ---------- */
const RE_MOIS = /^(janvier|fevrier|mars|avril|mai|juin|juillet|aout|septembre|octobre|novembre|decembre)$/;
const sexeDe = (v, defaut) => { const t = titre(v); if (/^(f|femme|mme|madame|mlle|mademoiselle)$/.test(t)) return 'F'; if (/^(h|homme|m|mr|monsieur)$/.test(t)) return 'H'; return defaut; };
// Commune : celle du fichier ; à défaut, celle proposée dans Paramètres (jamais pour un·e résident·e, dont le lieu de vie est la résidence)
const doc0commune = (v, st, defauts) => statutDe(st, defauts.statut) === 'resident' ? '' : (v || defauts.commune || '');
const statutDe = (v, defaut) => { const t = titre(v); if (/resid/.test(t)) return 'resident'; if (/adh/.test(t)) return 'adherent'; if (/autre/.test(t)) return 'autre'; return defaut; };

/**
 * Prépare les personnes à importer. lignes : tableau de lignes (sans l'en-tête) ; colonnes : champ par colonne ;
 * existants : fiches déjà présentes ; defauts : { statut, sexe, commune, adhesion, residenceAdresse }.
 * Renvoie { nouveaux, doublons, homonymes, aVerifier: [{ n, raison }] }.
 */
export function preparerSeniors(lignes, colonnes, existants, defauts) {
  const nouveaux = [], aVerifier = [], majPortage = []; let doublons = 0, nHom = 0; const tous = [...existants];
  lignes.forEach((l, k) => {
    const g = champ => { const i = colonnes.indexOf(champ); return i < 0 ? '' : String(l[i] == null ? '' : l[i]).trim(); };
    // ligne de titre de mois (« JANVIER ») dans une liste classée par mois : ignorée sans remarque
    const pleines = l.filter(x => String(x == null ? '' : x).trim()); if (!pleines.length || (pleines.length === 1 && RE_MOIS.test(titre(pleines[0])))) return;
    let nom = g('nom'), prenom = g('prenom'); const sep = g('complet') ? separerNom(g('complet')) : null;
    if (sep && !nom) { nom = sep.nom; prenom = prenom || sep.prenom; }
    if (!nom || !prenom) { aVerifier.push({ n: k + 1, raison: 'nom ou prénom manquant' }); return; }
    const jn = colonnes.indexOf('naissance'), nb = jn < 0 ? '' : l[jn], naissance = lireDate(nb);
    if (nb !== '' && nb != null && !naissance) aVerifier.push({ n: k + 1, raison: `date de naissance illisible (« ${nb} »), importée sans date` });
    const doc = { nom, prenom, nomNaissance: g('nomNaissance'), naissance, sexe: sexeDe(g('sexe'), '') || deduireSexe(prenom) || defauts.sexe || '', statut: statutDe(g('statut'), defauts.statut),
      ...(g('appartement') ? { appartement: g('appartement') } : {}), adresse: g('adresse'), commune: doc0commune(g('commune'), g('statut'), defauts), tel: g('tel'), contactNom: g('contactNom'), contactTel: g('contactTel'),
      ...(/^(oui|x|1|vrai)$/i.test(g('aConfirmer')) ? { prenomAConfirmer: true } : {}) };
    if (!doc.sexe) aVerifier.push({ n: k + 1, raison: `sexe non déterminé (${doc.prenom}) : « non précisé », à compléter sur la fiche si besoin` });
    if (doc.prenomAConfirmer) aVerifier.push({ n: k + 1, raison: `prénom à confirmer (${doc.prenom}) : marqué sur la fiche` });
    // adresse de la résidence (réglée dans Paramètres) : la personne y vit, elle est classée Résident·e sans adresse (sauf statut écrit dans le fichier)
    if (defauts.residenceAdresse && doc.adresse && !g('statut') && memeAdresse(doc.adresse, defauts.residenceAdresse)) {
      doc.statut = 'resident'; doc.adresse = ''; doc.commune = '';
      aVerifier.push({ n: k + 1, raison: `adresse de la résidence : classée Résident·e (${prenom} ${nom})` });
    }
    // portage de repas : jours lus dans la colonne « Fréquence »
    const fr = g('frequence');
    if (fr) {
      doc.portage = lireFrequence(fr);
      if (!doc.portage.jours.length) aVerifier.push({ n: k + 1, raison: `fréquence de portage « ${fr} » : aucun jour reconnu, conservée en précision` });
      else if (doc.portage.precision) aVerifier.push({ n: k + 1, raison: `fréquence de portage « ${fr} » : jours reconnus, texte conservé en précision` });
    }
    doc.adhesion = doc.statut !== 'adherent' ? null : { ...defauts.adhesion };
    const hom = homonymes(doc, tous);
    // même personne : même date de naissance ; ou, sans date ni d'un côté ni de l'autre, même nom de jeune fille (re-import du même fichier)
    const memePers = hom.find(x => x.naissance && naissance ? x.naissance === naissance : !x.naissance && !naissance && cleNom(x.nomNaissance) === cleNom(doc.nomNaissance));
    if (memePers) {
      doublons++;
      // déjà présente (ex. adhérente) mais sans portage : on ajoute seulement le portage à sa fiche
      if (doc.portage && !memePers.portage && !String(memePers.id).startsWith('~')) { majPortage.push({ id: memePers.id, portage: doc.portage }); aVerifier.push({ n: k + 1, raison: `déjà présente : portage de repas ajouté à sa fiche (${nomComplet(memePers)})` }); }
      return;
    }
    if (hom.length) { nHom++; aVerifier.push({ n: k + 1, raison: `même nom qu'une fiche existante (${nomComplet(hom[0])}) : importée comme personne distincte${naissance ? '' : ', sans date de naissance pour les distinguer'}` }); }
    const pr = tous.find(x => proche(nomComplet(x), nomComplet(doc)) && !hom.includes(x));
    if (pr) aVerifier.push({ n: k + 1, raison: `ressemble à « ${nomComplet(pr)} » (faute de frappe ?) : importée comme personne distincte` });
    nouveaux.push(doc); tous.push({ ...doc, id: '~' + k });
  });
  return { nouveaux, doublons, homonymes: nHom, aVerifier, majPortage };
}
const typeActiviteDe = (v, defaut) => { const t = titre(v); if (/sortie|voyage/.test(t)) return 'sortie'; if (/evenement|fete|repas/.test(t)) return 'evenement'; if (/activite|atelier|regulier/.test(t)) return 'activite'; return defaut; };
/**
 * Prépare les activités à importer. defauts : { type, cat, cap, budget }. Une activité de même nom ET de même jour/horaire est ignorée
 * (« Sophrologie » le mercredi et le vendredi sont deux activités). Les intervenant·es se rattachent ensuite dans l'outil (liste de l'annuaire).
 */
export function preparerActivites(lignes, colonnes, existants, defauts) {
  const nouveaux = [], aVerifier = []; let doublons = 0; const tous = existants.map(x => ({ nom: x.nom, jour: x.jour }));
  lignes.forEach((l, k) => {
    const g = champ => { const i = colonnes.indexOf(champ); return i < 0 ? '' : String(l[i] == null ? '' : l[i]).trim(); };
    const nom = g('nom'); if (!nom) { aVerifier.push({ n: k + 1, raison: 'nom de l\'activité manquant' }); return; }
    let cap = defauts.cap; const brut = g('cap');
    if (brut) { const c = parseInt(brut, 10); if (c >= 1 && c <= 1000) cap = c; else aVerifier.push({ n: k + 1, raison: `nombre de places illisible (« ${brut} ») : ${defauts.cap} par défaut` }); }
    const doc = { nom, type: typeActiviteDe(g('type'), defauts.type), cat: g('categorie') || defauts.cat, jour: g('jour'), frequence: g('frequence'), lieu: g('lieu'), cap, budget: defauts.budget };
    if (tous.some(x => cleNom(x.nom) === cleNom(doc.nom) && cleNom(x.jour) === cleNom(doc.jour))) { doublons++; return; }
    if (tous.some(x => cleNom(x.nom) === cleNom(doc.nom))) aVerifier.push({ n: k + 1, raison: `« ${nom} » existe déjà à un autre jour ou horaire : importée comme activité distincte` });
    nouveaux.push(doc); tous.push({ nom: doc.nom, jour: doc.jour });
  });
  return { nouveaux, doublons, homonymes: 0, aVerifier };
}
/** Prépare les contacts de l'annuaire. defauts : { categorie }. */
export function preparerContacts(lignes, colonnes, existants, defauts, categories) {
  const nouveaux = [], aVerifier = []; let doublons = 0, nHom = 0; const tous = existants.map(normContact);
  lignes.forEach((l, k) => {
    const g = champ => { const i = colonnes.indexOf(champ); return i < 0 ? '' : String(l[i] == null ? '' : l[i]).trim(); };
    let nom = g('nom'), prenom = g('prenom'), organisme = false;
    if (g('complet') && !nom) { const s = separerNom(g('complet')); nom = s.nom; prenom = prenom || s.prenom; organisme = s.organisme; }
    let prec = g('precision');
    // titre de civilité devant le nom (Père, Abbé, Docteur…) : il va en précision, pas en prénom
    if (g('complet') && prenom && TITRES_CIVILITE.includes(cleNom(prenom).replace(/\s+/g, ''))) { prec = [prenom, prec].filter(Boolean).join(' · '); prenom = ''; }
    if (!nom) { aVerifier.push({ n: k + 1, raison: 'nom manquant' }); return; }
    if (g('complet') && !prenom && !organisme && !/\s/.test(g('complet'))) aVerifier.push({ n: k + 1, raison: `« ${nom} » : un seul mot, nom de famille ou prénom à compléter sur la fiche` });
    if (!g('prenom') && !g('complet') && /\s/.test(nom)) { const s = separerNom(nom); nom = s.nom; prenom = s.prenom; organisme = s.organisme; aVerifier.push({ n: k + 1, raison: `« ${g('nom')} » séparé en prénom « ${prenom} » et nom « ${nom} »` }); }
    let cat = g('categorie') || defauts.categorie;
    if (g('categorie') && !categories.includes(cat)) { const t = categories.find(c => cleNom(c) === cleNom(cat) || cleNom(c).startsWith(cleNom(cat))); if (t) cat = t; else { aVerifier.push({ n: k + 1, raison: `catégorie « ${cat} » inconnue : remplacée par « ${defauts.categorie} »` }); cat = defauts.categorie; } }
    const doc = { nom, prenom, organisme, precision: prec, categorie: cat, tel: g('tel'), email: g('email'), note: g('note') };
    const meme = tous.filter(x => x.categorie === cat && cleNom(nomComplet(x)) === cleNom(nomComplet(doc)));
    if (meme.some(x => cleNom(x.precision) === cleNom(doc.precision))) { doublons++; return; }
    if (meme.length) { nHom++; aVerifier.push({ n: k + 1, raison: `même nom qu'un contact existant : ${doc.precision ? 'importé comme personne distincte' : 'sans précision pour les distinguer (ajoutez-en une)'}` }); }
    nouveaux.push(doc); tous.push({ ...doc, id: '~' + k });
  });
  return { nouveaux, doublons, homonymes: nHom, aVerifier };
}
