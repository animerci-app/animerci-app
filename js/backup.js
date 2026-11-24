// Sauvegarde et restauration — écran « Sauvegarde » (administratrice uniquement).
// Aucune bibliothèque externe : les fichiers Excel (.xlsx) sont fabriqués ici, pour que la sauvegarde
// fonctionne même si un service tiers disparaît. Tous les tableaux restent lisibles en noir et blanc :
// l'information est toujours écrite en toutes lettres (« Oui », « Présent·e »…), jamais portée par une couleur.
import { store, lecturesDuJour, MODE_REEL } from './store.js';
import { S, $, esc, toast, patienter, confirmer, aujourdhui } from './ui.js';
import { STATUTS_PRESENCE, lieuDeVie, libelleFrequence, TYPES_ECHANGE, STATUTS_CONVENTION, tableauxMateriel, tableauxSuiviPortage, tableauxAccueils, telephones, prochesDe, tableauxAdhesions, tableauxBudgets, tableauxRegie, tableauxVoyages, LIBELLE_DIFFUSION } from './logic.js';
import { VERSION } from './version.js';
import { P, moduleActif } from './parametres.js';

const CLE = 'animerci-derniere-sauvegarde';
const STATUT_INS = { inscrit: 'Inscrit·e', invite: 'Invité·e', attente: 'En attente' };
const TYPES = { activite: 'Activité', sortie: 'Sortie', evenement: 'Événement' };
const ROLES = { admin: 'Administratrice', intervenant: 'Intervenant·e', benevole: 'Bénévole' };
const REPETE = { semaine: 'Chaque semaine', mois: 'Chaque mois', an: 'Chaque année' };
const oui = v => (v ? 'Oui' : 'Non');
const fr = d => (d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : d || '');

// Données complètes pour une sauvegarde : lues directement dans la base (l'écran, lui, ne charge que ce qu'il affiche).
let SAUV = null;
async function lireTout() {
  const T = {}, cols = ['seniors', 'activites', 'inscriptions', 'seances', 'fiches', 'taches', 'contacts', 'echanges', 'conventions', 'materiel', 'emprunts', 'mouvements', 'portage', 'portageEchanges', 'portageJournal', 'lienSocial', 'accueils', 'depenses', 'regie', 'questionnaires', 'reponsesQuestionnaire', 'voyages', 'users', 'parametres'];
  for (const c of cols) T[c] = await store.lire(c);
  T.corbeille = []; T.journal = [];
  return T;
}
async function avecDonnees(fn) {
  toast('Lecture de toutes les données…');
  SAUV = await patienter(lireTout(), '⏳ Lecture des données en cours : un peu de patience, cela peut prendre quelques secondes.');
  try { await fn(); } finally { SAUV = null; }
}

/* ---------- Tableaux lisibles (noms écrits, jamais d'identifiants) ---------- */
export function tableaux({ fiches = false } = {}) {
  const C = SAUV || S.cache;
  const nomAct = id => (C.activites.find(a => a.id === id) || {}).nom || '(activité supprimée)';
  const nomSen = id => { const s = C.seniors.find(x => x.id === id); return s ? `${s.nom} ${s.prenom}` : '(personne supprimée)'; };
  const T = [];
  T.push({ nom: 'Personnes', titre: 'Personnes (adhérents, résidents, autres publics)',
    cols: ['Nom', 'Nom de jeune fille', 'Prénom', 'Naissance', 'Sexe', 'Statut', 'Lieu de vie', 'Appartement', 'Adresse', 'Commune', 'Tél. fixe', 'Tél. portable', 'E-mail', 'Quartier ou secteur', 'Date d\'entrée', 'Proches (nom, lien, tél.)', 'Informations d\'organisation', 'Dernière vérification', 'Date d\'adhésion', 'Montant (€)', 'Cotisation réglée', 'Portage de repas'],
    rows: [...C.seniors].sort((a, b) => (a.nom + a.prenom).localeCompare(b.nom + b.prenom, 'fr')).map(s => [s.nom, s.nomNaissance, s.prenom, fr(s.naissance), s.sexe === 'H' ? 'Homme' : s.sexe === 'F' ? 'Femme' : 'Non précisé',
      { adherent: 'Adhérent·e', resident: 'Résident·e', autre: 'Autre public' }[s.statut] || s.statut, lieuDeVie(s, P('residence.nom')), s.appartement, s.adresse, s.commune, telephones(s).fixe, telephones(s).portable, s.email, s.quartier, fr(s.entreeLe), prochesDe(s).map(p => [p.nom, p.lien, p.tel].filter(Boolean).join(', ')).join(' ; '), s.infosOrga, fr(s.verifieLe),
      s.adhesion ? fr(s.adhesion.date) : s.statut === 'resident' ? 'Comprise dans le loyer' : '', s.adhesion ? s.adhesion.montant : '', s.adhesion ? oui(s.adhesion.paye) : '', s.portage ? libelleFrequence(s.portage) : ''] ) });
  T.push(tableauxAdhesions(C.seniors, new Date().getFullYear())[1]); // historique des adhésions par année
  T.push({ nom: 'Activités', titre: 'Activités, sorties et événements',
    cols: ['Activité', 'Type', 'Catégorie', 'Date', 'Jour et horaire', 'Fréquence', 'Lieu', 'Places', 'Intervenant·e', 'Partenaire', 'Bénévole référent·e', 'Budget'],
    rows: [...C.activites].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(a => [a.nom, TYPES[a.type] || a.type, a.cat, fr(a.date), a.jour, a.frequence, a.lieu, a.cap, a.interv, a.partenaire, a.benevole, a.budget]) });
  T.push({ nom: 'Annuaire', titre: 'Annuaire : intervenants, partenaires, bénévoles, collègues',
    cols: ['Nom', 'Précision', 'Catégorie', 'Téléphone', 'E-mail', 'Remarque', 'Service ou structure', 'Type de partenariat', 'Référent', 'Projets communs', 'Suite à donner'],
    rows: [...(C.contacts || [])].sort((a, b) => ((a.categorie || '') + a.nom).localeCompare((b.categorie || '') + b.nom, 'fr')).map(c => [c.nom, c.precision, c.categorie, c.tel, c.email, c.note, c.service, c.partenariat, c.referent, c.projets, c.suite]) });
  T.push({ nom: 'Échanges partenaires', titre: 'Échanges avec les partenaires (appels, courriels, réunions, contacts, invitations, relances)',
    cols: ['Date', 'Heure', 'Type', 'Partenaire', 'Service', 'Prévu', 'Objet', 'Résumé', 'Participants', 'Ordre du jour', 'Décisions', 'Suite à donner', 'Pour le', 'Suite faite', 'Saisi par'],
    rows: [...(C.echanges || [])].sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(e => [fr(e.date), e.heure, TYPES_ECHANGE[e.type] || e.type, e.interne ? 'Équipe de la résidence (interne)' : e.partenaire, e.service, e.etat === 'prevu' ? 'Oui' : 'Non', e.objet, e.resume, e.participants, e.odj, e.decisions, e.suite, fr(e.suiteDate), e.suite ? oui(e.suiteFaite) : '', e.par]) });
  T.push({ nom: 'Conventions', titre: 'Conventions avec les partenaires',
    cols: ['Partenaire', 'Intitulé', 'État', 'Signature', 'Échéance', 'Où se trouve le document', 'Remarque'],
    rows: [...(C.conventions || [])].sort((a, b) => (a.echeance || '9999').localeCompare(b.echeance || '9999')).map(k => [k.partenaire, k.intitule, STATUTS_CONVENTION[k.statut] || k.statut, fr(k.signature), fr(k.echeance), k.emplacement, k.note]) });
  T.push(...tableauxMateriel({ materiel: C.materiel || [], emprunts: C.emprunts || [], mouvements: C.mouvements || [] }, aujourdhui()));
  T.push(...tableauxSuiviPortage(C.portage || [], C.portageEchanges || []));
  if (moduleActif('accueils')) T.push(...tableauxAccueils(C.accueils || [], Number(aujourdhui().slice(0, 4)), C.contacts || [], P('annuaire.rubriques.activiteBenevole'), aujourdhui()));
  if (moduleActif('budgets')) {
    const anBud = Number(aujourdhui().slice(0, 4)), initiaux = ((C.parametres || []).find(p => p.id === `budgets-${anBud}`) || {}).initiaux || {};
    T.push(...tableauxBudgets(C.depenses || [], anBud, P('listes.budgets'), initiaux, aujourdhui()));
    T.push(...tableauxRegie(C.regie || [], anBud));
  }
  if (moduleActif('questionnaires')) {
    const rep = C.reponsesQuestionnaire || [];
    T.push({ nom: 'Questionnaires', titre: 'Questionnaires et sondages', cols: ['Titre', 'Thème', 'Nombre de questions', 'Nombre de réponses reçues'],
      rows: [...(C.questionnaires || [])].sort((a, b) => String(a.titre).localeCompare(String(b.titre), 'fr')).map(q => [q.titre || '', q.theme || '', (q.questions || []).length, rep.filter(r => r.questionnaireId === q.id).length]) });
  }
  if (moduleActif('voyages')) T.push(...tableauxVoyages(C.voyages || []));
  T.push({ nom: 'Inscriptions', titre: 'Inscriptions et listes d\'attente',
    cols: ['Activité', 'Personne', 'Situation', 'Date de la demande', 'Origine'],
    rows: [...C.inscriptions].sort((a, b) => (nomAct(a.activiteId) + nomSen(a.seniorId)).localeCompare(nomAct(b.activiteId) + nomSen(b.seniorId), 'fr'))
      .map(i => [nomAct(i.activiteId), nomSen(i.seniorId), STATUT_INS[i.statut] || i.statut, fr(i.dateDemande), i.source]) });
  const pres = [];
  [...C.seances].sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(se => {
    Object.entries(se.presences || {}).forEach(([sid, st]) => pres.push([nomAct(se.activiteId), fr(se.date), se.valide ? 'Validé' : 'Non validé', nomSen(sid), STATUTS_PRESENCE[st] || st]));
  });
  T.push({ nom: 'Présences', titre: 'Présences aux séances (une ligne par personne et par séance)', cols: ['Activité', 'Date de la séance', 'Appel', 'Personne', 'Présence'], rows: pres });
  if (fiches) T.push({ nom: 'Fiches de sortie', titre: 'Fiches de sortie — DONNÉES SENSIBLES : à conserver sous clé',
    cols: ['Sortie', 'Personne', 'Personne à prévenir', 'Téléphone', 'Déplacements', 'Autre information pratique', 'Autorisation photo', 'Règlement reçu', 'Pièce d\'identité vue'],
    rows: C.fiches.map(f => [nomAct(f.activiteId), nomSen(f.seniorId), f.contact, f.tel, f.mob, f.info, f.photo, oui(f.paye), oui(f.piece)]) });
  T.push({ nom: 'Tâches', titre: 'Tâches et rappels', cols: ['Tâche', 'Catégorie', 'Responsable', 'Échéance', 'Fait', 'Répétition'],
    rows: [...C.taches].sort((a, b) => (a.echeance || '9').localeCompare(b.echeance || '9')).map(t => [t.titre, t.cat, t.responsable, fr(t.echeance), oui(t.done), REPETE[t.repete] || 'Jamais']) });
  T.push({ nom: 'Équipe', titre: 'Équipe : personnes ayant accès à l\'outil', cols: ['Nom', 'E-mail', 'Rôle', 'Activités accessibles'],
    rows: C.users.map(u => [u.nom, u.email, ROLES[u.role] || 'Sans rôle', (u.activites || []).map(nomAct).join(', ')]) });
  return T;
}

/* ---------- Excel (.xlsx) fabriqué sans bibliothèque ---------- */
const enc = new TextEncoder();
let TABLE_CRC;
function crc32(u8) {
  if (!TABLE_CRC) { TABLE_CRC = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; TABLE_CRC[n] = c >>> 0; } }
  let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = TABLE_CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0;
}
export function zip(fichiers) { // fichiers : [{nom, data: Uint8Array}] — méthode « stockée » (sans compression)
  const parts = [], centrale = []; let pos = 0;
  const w16 = (v, n) => { v.push(n & 255, (n >>> 8) & 255); }, w32 = (v, n) => { v.push(n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255); };
  for (const f of fichiers) {
    const nom = enc.encode(f.nom), crc = crc32(f.data), h = [];
    w32(h, 0x04034b50); w16(h, 20); w16(h, 0x0800); w16(h, 0); w16(h, 0); w16(h, 0x21); w32(h, crc); w32(h, f.data.length); w32(h, f.data.length); w16(h, nom.length); w16(h, 0);
    parts.push(new Uint8Array(h), nom, f.data);
    const c = []; w32(c, 0x02014b50); w16(c, 20); w16(c, 20); w16(c, 0x0800); w16(c, 0); w16(c, 0); w16(c, 0x21); w32(c, crc); w32(c, f.data.length); w32(c, f.data.length);
    w16(c, nom.length); w16(c, 0); w16(c, 0); w16(c, 0); w16(c, 0); w32(c, 0); w32(c, pos);
    centrale.push(new Uint8Array(c), nom);
    pos += h.length + nom.length + f.data.length;
  }
  const taille = centrale.reduce((n, x) => n + x.length, 0), fin = [];
  w32(fin, 0x06054b50); w16(fin, 0); w16(fin, 0); w16(fin, fichiers.length); w16(fin, fichiers.length); w32(fin, taille); w32(fin, pos); w16(fin, 0);
  return new Blob([...parts, ...centrale, new Uint8Array(fin)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
const x = s => String(s == null ? '' : s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const col = n => { let s = ''; for (n++; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + (n - 1) % 26) + s; return s; };
const cell = (r, c, v, st) => {
  if (v === '' || v == null) return `<c r="${col(c)}${r}" s="${st}"/>`;
  if (typeof v === 'number' && isFinite(v)) return `<c r="${col(c)}${r}" s="${st}"><v>${v}</v></c>`;
  return `<c r="${col(c)}${r}" s="${st}" t="inlineStr"><is><t xml:space="preserve">${x(v)}</t></is></c>`;
};
function feuille(cols, rows, larg) {
  const lignes = [cols.map((v, c) => cell(1, c, v, 1)).join('')].concat(rows.map((row, i) => row.map((v, c) => cell(i + 2, c, v, 2)).join('')));
  const largeurs = cols.map((t, c) => { const m = Math.max(String(t).length, ...rows.map(r => String(r[c] == null ? '' : r[c]).length)); return Math.min(larg || 45, Math.max(10, m + 2)); });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${largeurs.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` +
    `<sheetData>${lignes.map((l, i) => `<row r="${i + 1}">${l}</row>`).join('')}</sheetData>` +
    `<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.7" header="0.3" footer="0.3"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    `<headerFooter><oddFooter>&amp;L&amp;A&amp;CSauvegarde AniMerci&amp;RPage &amp;P / &amp;N</oddFooter></headerFooter></worksheet>`;
}
export function classeur(T, entete) {
  const feuilles = [{ nom: 'Lisez-moi', cols: ['Sauvegarde AniMerci'], rows: entete.map(l => [l]), larg: 110 }, ...T.map(t => ({ nom: t.nom, cols: t.cols, rows: t.rows }))];
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const fich = [
    ['[Content_Types].xml', `${X}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${feuilles.map((f, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `${X}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${feuilles.map((f, i) => `<sheet name="${x(f.nom)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets><definedNames>${feuilles.map((f, i) => `<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${x(f.nom)}'!$1:$1</definedName>`).join('')}</definedNames></workbook>`],
    ['xl/_rels/workbook.xml.rels', `${X}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${feuilles.map((f, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${feuilles.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    // Styles : 0 normal · 1 en-tête (gras, fond gris clair, cadre) · 2 corps (cadre, retour à la ligne)
    ['xl/styles.xml', `${X}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFD9D9D9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs></styleSheet>`]
  ];
  feuilles.forEach((f, i) => fich.push([`xl/worksheets/sheet${i + 1}.xml`, feuille(f.cols, f.rows, f.larg)]));
  return zip(fich.map(([nom, t]) => ({ nom, data: enc.encode(t) })));
}

/* ---------- Document imprimable (PDF via l'impression, ou Word) ---------- */
export function documentHtml(T, entete, titre) {
  const tab = t => `<h2>${esc(t.titre)} <small>(${t.rows.length})</small></h2>` + (t.rows.length ?
    `<table><thead><tr>${t.cols.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(v => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<p>Aucune donnée.</p>');
  return `<!DOCTYPE html><html lang="fr" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(titre)}</title>
<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->
<style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;font-size:10pt;color:#000;background:#fff}
h1{font-size:18pt;margin:0 0 4pt}h2{font-size:13pt;margin:18pt 0 6pt;border-bottom:2px solid #000;padding-bottom:2pt;page-break-after:avoid}h2 small{font-weight:normal}
table{border-collapse:collapse;width:100%}th,td{border:1px solid #000;padding:3pt 5pt;text-align:left;vertical-align:top}th{background:#d9d9d9;font-weight:bold}
thead{display:table-header-group}tr{page-break-inside:avoid}.lisez p{margin:2pt 0}.sec{border:2px solid #000;padding:5pt;margin:8pt 0;font-weight:bold}</style></head><body>
<h1>${esc(titre)}</h1><div class="lisez">${entete.map(l => `<p>${esc(l)}</p>`).join('')}</div>${T.map(tab).join('')}</body></html>`;
}
export function imprimer(html) {
  const f = document.createElement('iframe'); f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  f.contentDocument.open(); f.contentDocument.write(html); f.contentDocument.close();
  setTimeout(() => { try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { toast('Impression impossible : ' + e.message); } setTimeout(() => f.remove(), 60000); }, 400);
}

/* ---------- Fichier complet de restauration (JSON) ---------- */
const COLS_SAUVEES = ['seniors', 'activites', 'inscriptions', 'seances', 'fiches', 'taches'];
export function exportJson() {
  return JSON.stringify({ application: 'animerci', version: 1, versionOutil: VERSION, date: new Date().toISOString(), donnees: Object.fromEntries(COLS_SAUVEES.map(c => [c, (SAUV || S.cache)[c]])), equipe: (SAUV || S.cache).users, parametres: (SAUV || S.cache).parametres, contacts: (SAUV || S.cache).contacts, echanges: (SAUV || S.cache).echanges || [], conventions: (SAUV || S.cache).conventions || [], materiel: (SAUV || S.cache).materiel || [], emprunts: (SAUV || S.cache).emprunts || [], mouvements: (SAUV || S.cache).mouvements || [], portage: (SAUV || S.cache).portage || [], portageEchanges: (SAUV || S.cache).portageEchanges || [], portageJournal: (SAUV || S.cache).portageJournal || [], lienSocial: (SAUV || S.cache).lienSocial || [], accueils: (SAUV || S.cache).accueils || [], depenses: (SAUV || S.cache).depenses || [], regie: (SAUV || S.cache).regie || [], questionnaires: (SAUV || S.cache).questionnaires || [], reponsesQuestionnaire: (SAUV || S.cache).reponsesQuestionnaire || [], voyages: (SAUV || S.cache).voyages || [] }, null, 1);
}
export function lireSauvegarde(texte) {
  let d; try { d = JSON.parse(texte); } catch (e) { throw new Error('Ce fichier n\'est pas une sauvegarde valide (illisible).'); }
  if (!d || d.application !== 'animerci' || !d.donnees) throw new Error('Ce fichier n\'est pas une sauvegarde AniMerci.');
  const out = {};
  for (const c of COLS_SAUVEES) {
    const rows = d.donnees[c]; if (!Array.isArray(rows)) throw new Error(`Sauvegarde incomplète : « ${c} » manquant.`);
    if (rows.some(r => !r || typeof r !== 'object' || !r.id || /[\/]/.test(String(r.id)))) throw new Error(`Sauvegarde abîmée : une ligne de « ${c} » est invalide.`);
    out[c] = rows;
  }
  out.parametres = Array.isArray(d.parametres) ? d.parametres.filter(r => r && r.id) : [];
  out.contacts = Array.isArray(d.contacts) ? d.contacts.filter(r => r && r.id && !/[\/]/.test(String(r.id))) : []; // facultatif : absent des sauvegardes d'avant la 1.4.0
  // facultatifs : absents des sauvegardes d'avant la 1.16.0
  out.echanges = Array.isArray(d.echanges) ? d.echanges.filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  out.conventions = Array.isArray(d.conventions) ? d.conventions.filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  // facultatifs : absents des sauvegardes d'avant la 1.17.0
  // facultatifs : absents des sauvegardes d'avant la 1.19.0
  // facultatif : absent des sauvegardes d'avant la 1.20.0
  out.accueils = Array.isArray(d.accueils) ? d.accueils.filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  for (const c of ['portage', 'portageEchanges']) out[c] = Array.isArray(d[c]) ? d[c].filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  // facultatifs : absents des sauvegardes d'avant la 1.24.0
  for (const c of ['portageJournal', 'lienSocial']) out[c] = Array.isArray(d[c]) ? d[c].filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  for (const c of ['materiel', 'emprunts', 'mouvements']) out[c] = Array.isArray(d[c]) ? d[c].filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  // facultatifs : absents des sauvegardes d'avant la 1.21.0
  for (const c of ['depenses', 'regie']) out[c] = Array.isArray(d[c]) ? d[c].filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  // facultatifs : absents des sauvegardes d'avant la 1.22.0
  for (const c of ['questionnaires', 'reponsesQuestionnaire', 'voyages']) out[c] = Array.isArray(d[c]) ? d[c].filter(r => r && r.id && !/[\/]/.test(String(r.id))) : [];
  return { donnees: out, date: d.date };
}

/* ---------- Écran ---------- */
const marquer = () => { try { localStorage.setItem(CLE, new Date().toISOString()); } catch (e) { /* ignoré */ } };
const derniere = () => { try { return localStorage.getItem(CLE); } catch (e) { return null; } };
export function joursDepuisSauvegarde() { const d = derniere(); return d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null; }
// Quota gratuit Firebase : 50 000 lectures par jour pour l'ensemble des appareils. Ce compteur ne voit que cet appareil.
const QUOTA_LECTURES = 50000;
export function alerteLectures() {
  const n = lecturesDuJour();
  if (!MODE_REEL || n < QUOTA_LECTURES * 0.6) return '';
  return `<div class="err" role="alert" style="background:#fff6e0;border-color:#e0b060;color:#5a3a00"><b>Beaucoup de lectures aujourd'hui sur cet appareil</b> (environ ${n.toLocaleString('fr-FR')} sur ${QUOTA_LECTURES.toLocaleString('fr-FR')} par jour pour tout le service). Évitez de recharger la page sans nécessité. Au-delà, l'outil s'arrête jusqu'au lendemain : prévoir les feuilles de présence papier (Sécurité).</div>`;
}
export function rappelSauvegarde() {
  const j = joursDepuisSauvegarde();
  if (j !== null && j < P('securite.rappelSauvegardeJours')) return '';
  return `<div class="err" role="alert" style="background:#fff6e0;border-color:#e0b060;color:#5a3a00"><b>Sauvegarde conseillée.</b> ${j === null ? 'Aucune sauvegarde n\'a été faite depuis cet appareil.' : `Dernière sauvegarde il y a ${j} jours.`} <button class="btn sec" data-action="nav" data-v="sauvegarde" style="margin-left:8px">Sauvegarder maintenant</button></div>`;
}
function opts() { return { fiches: !!($('#sv-fiches') && $('#sv-fiches').checked) }; }
function entete(o) {
  const n = SAUV || S.cache;
  return [`Sauvegarde faite le ${fr(aujourdhui())} par ${S.user.nom} (AniMerci, version ${VERSION}).`,
    `Contenu : ${n.seniors.length} personnes, ${n.activites.length} activités, ${n.inscriptions.length} inscriptions, ${n.seances.length} séances${o.fiches ? `, ${n.fiches.length} fiches de sortie` : ' (fiches de sortie non incluses)'}, ${n.taches.length} tâches, ${(n.echanges || []).length} échanges avec les partenaires, ${(n.conventions || []).length} conventions, ${(n.materiel || []).length} articles de matériel, ${(n.emprunts || []).length} emprunts, ${(n.mouvements || []).length} mouvements de stock, ${(n.depenses || []).length} dépenses, ${(n.regie || []).length} opérations de régie, ${(n.questionnaires || []).length} questionnaires, ${(n.reponsesQuestionnaire || []).length} réponses, ${(n.voyages || []).length} voyages et sorties.`,
    'Lecture : chaque onglet ou chaque tableau est une liste. Les mots sont écrits en toutes lettres (Oui, Non, Présent·e, Absent·e…) : le document se lit aussi bien en noir et blanc.',
    'ATTENTION : ce fichier contient des données personnelles. Le ranger dans un endroit fermé à clé ou protégé par mot de passe ; ne pas l\'envoyer par e-mail ordinaire ni le déposer sur GitHub.',
    'Pour restaurer l\'outil : utiliser le fichier « .json » de la même date (écran Sauvegarde > Restaurer).'];
}
const stamp = () => aujourdhui();
export function sauvegarde() {
  const j = joursDepuisSauvegarde();
  return `<div class="top"><div><h1>Sauvegarde</h1><p>Une copie de toutes vos données sur votre ordinateur, lisible et imprimable.</p></div></div>
  <div class="card" style="margin-bottom:14px"><b>Dernière sauvegarde depuis cet appareil :</b> ${j === null ? 'aucune' : j === 0 ? 'aujourd\'hui' : `il y a ${j} jour${j > 1 ? 's' : ''}`}
    ${MODE_REEL ? `<p class="sub" style="margin:6px 0 0"><b>Lectures estimées aujourd'hui sur cet appareil :</b> ${lecturesDuJour().toLocaleString('fr-FR')} sur ${QUOTA_LECTURES.toLocaleString('fr-FR')} (quota gratuit de tout le service ; les autres appareils comptent aussi ; estimation).</p>` : ''}
    <p class="sub" style="margin:6px 0 0">La sauvegarde lit toutes les données (quelques milliers de lectures, comptées dans le quota gratuit). Conseil : une fois par mois, et avant tout changement important.</p></div>
  <div class="card" style="margin-bottom:14px"><label class="chk"><input type="checkbox" id="sv-fiches"> Inclure les fiches de sortie (personne à prévenir, autorisations, informations pratiques)</label>
    <p class="sub" style="margin:6px 0 0">Par défaut, ces fiches ne sont pas dans la sauvegarde : elles doivent être effacées après chaque sortie. Cochez seulement si besoin.</p></div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">1. Faire la sauvegarde</h2>
    <div class="quick"><button class="btn" data-action="sv-xlsx">Excel (.xlsx)</button><button class="btn" data-action="sv-pdf">PDF / Imprimer</button><button class="btn sec" data-action="sv-word">Word (.doc)</button><button class="btn sec" data-action="sv-json">Fichier de restauration (.json)</button></div>
    <p class="sub" style="margin:8px 0 0"><b>Excel</b> : un onglet par sujet, prêt à imprimer. <b>PDF</b> : s'ouvre la fenêtre d'impression, choisissez « Enregistrer au format PDF » ou votre imprimante. <b>Word</b> : mêmes tableaux, modifiables. <b>Fichier .json</b> : indispensable pour tout remettre dans l'outil après un incident ; il n'est pas fait pour être lu.</p>
    <div class="quick" style="margin-top:10px"><button class="btn blue" data-action="sv-tout">Tout sauvegarder d'un coup (Excel + Word + .json)</button></div></div>
  <div class="card"><h2 style="margin-top:0">2. Restaurer après un incident</h2>
    <p class="sub">Choisissez un fichier « .json » de sauvegarde. Les données sont <b>ajoutées ou remises à jour</b> ; rien n'est supprimé.</p>
    <input type="file" id="sv-fichier" accept=".json,application/json" aria-label="Fichier de sauvegarde à restaurer"></div>`;
}
function telechargerBlob(nom, blob) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}
const faire = {
  xlsx: o => telechargerBlob(`sauvegarde-animerci-${stamp()}.xlsx`, classeur(tableaux(o), entete(o))),
  word: o => telechargerBlob(`sauvegarde-animerci-${stamp()}.doc`, new Blob(['\uFEFF', documentHtml(tableaux(o), entete(o), 'Sauvegarde AniMerci — ' + fr(aujourdhui()))], { type: 'application/msword' })),
  json: () => telechargerBlob(`restauration-animerci-${stamp()}.json`, new Blob([exportJson()], { type: 'application/json' })),
  pdf: o => imprimer(documentHtml(tableaux(o), entete(o), 'Sauvegarde AniMerci — ' + fr(aujourdhui())))
};
export const actions = {
  'sv-xlsx': () => avecDonnees(() => { faire.xlsx(opts()); marquer(); toast('Fichier Excel téléchargé'); }),
  'sv-word': () => avecDonnees(() => { faire.word(opts()); marquer(); toast('Fichier Word téléchargé'); }),
  'sv-json': () => avecDonnees(() => { faire.json(); marquer(); toast('Fichier de restauration téléchargé'); }),
  'sv-pdf': () => avecDonnees(() => { faire.pdf(opts()); marquer(); }),
  'sv-tout': () => { const o = opts(); const pause = () => new Promise(r => setTimeout(r, 700)); return avecDonnees(async () => { faire.xlsx(o); await pause(); faire.word(o); await pause(); faire.json(); marquer(); toast('3 fichiers téléchargés : vérifiez le dossier Téléchargements'); }); }
};
export function brancher() {
  const f = $('#sv-fichier'); if (!f) return;
  f.onchange = async () => {
    const fic = f.files[0]; if (!fic) return;
    try {
      const { donnees, date } = lireSauvegarde(await fic.text());
      const total = COLS_SAUVEES.concat('parametres', 'contacts', 'echanges', 'conventions', 'materiel', 'emprunts', 'mouvements', 'portage', 'portageEchanges', 'portageJournal', 'lienSocial', 'accueils', 'depenses', 'regie', 'questionnaires', 'reponsesQuestionnaire', 'voyages').reduce((n, c) => n + donnees[c].length, 0);
      const resume = COLS_SAUVEES.map(c => `${donnees[c].length} ${c}`).join(', ');
      confirmer('Restaurer cette sauvegarde ?', `Sauvegarde du ${date ? fr(date.slice(0, 10)) : '?'} : ${resume}. ${total > 15000 ? 'Attention : volume supérieur au quota quotidien gratuit d\'écritures.' : ''} Les données seront ajoutées ou remises à jour, sans rien supprimer.`, 'Restaurer', async () => {
        let n = 0, deja = 0;
        for (const c of COLS_SAUVEES.concat('parametres', 'contacts', 'echanges', 'conventions', 'materiel', 'emprunts', 'mouvements', 'portage', 'portageEchanges', 'portageJournal', 'lienSocial', 'accueils', 'depenses', 'regie', 'questionnaires', 'reponsesQuestionnaire', 'voyages')) for (const r of donnees[c]) {
          // Les mouvements de stock ne sont pas modifiables (règles Firestore) : un mouvement déjà présent est laissé tel quel.
          if (c === 'mouvements') { try { await store.save(c, r); } catch (e) { deja++; } } else await store.save(c, r);
          if (++n % 50 === 0) toast(`Restauration… ${n}/${total}`);
        }
        toast(`Restauration terminée : ${total} éléments${deja ? ` (dont ${deja} mouvements de stock déjà présents, conservés tels quels)` : ''}`);
      });
    } catch (e) { toast(e.message); }
    f.value = '';
  };
}
