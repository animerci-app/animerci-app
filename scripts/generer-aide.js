// Génère js/aide-contenu.js (contenu du menu Aide) à partir du Mode d'emploi + FAQ (claude/MODE-EMPLOI-FAQ.md, doc du projet Claude).
// À relancer après CHAQUE mise à jour du Mode d'emploi + FAQ, pour que le menu Aide de l'outil ne s'en écarte jamais (règle de cohérence du projet).
// Usage : node scripts/generer-aide.js chemin/vers/MODE-EMPLOI-FAQ.md
// Le fichier js/aide-contenu.js qui en résulte ne doit jamais être édité à la main : toute correction se fait dans le .md source, puis on relance ce script.
import fs from 'fs';

const src = process.argv[2];
if (!src) { console.error('Usage : node scripts/generer-aide.js chemin/vers/MODE-EMPLOI-FAQ.md'); process.exit(1); }
const texte = fs.readFileSync(src, 'utf8');
const lignes = texte.split('\n');

const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

let groupes = [], cur = null, curGroupe = null, modeFaq = false, i = 0;
function ajouterParagraphe(texte) { if (cur) cur.paras.push(texte); }

while (i < lignes.length) {
  const ligne = lignes[i];
  if (/^# \d+\./.test(ligne)) {
    curGroupe = { titre: ligne.replace(/^# /, '').trim(), articles: [] };
    groupes.push(curGroupe); cur = null;
    modeFaq = /Questions fr/i.test(curGroupe.titre);
    i++; continue;
  }
  if ((/^### /.test(ligne) || /^## /.test(ligne)) && !modeFaq) {
    cur = { titre: ligne.replace(/^#{2,3} /, '').trim(), paras: [] };
    curGroupe.articles.push(cur);
    i++; continue;
  }
  if (modeFaq) {
    if (/^## Une question qui n'est pas ici/.test(ligne)) {
      cur = { titre: "Une question qui n'est pas ici ?", paras: [] };
      curGroupe.articles.push(cur); i++; continue;
    }
    if (/^\*\*.+/.test(ligne.trim())) {
      // Question en gras, parfois coupée sur plusieurs lignes par le traitement de texte : on la recompose jusqu'à la fermeture **.
      let q = ligne.trim();
      while (!/\*\*\s*$/.test(q) && i + 1 < lignes.length && lignes[i + 1].trim() !== '') { i++; q += ' ' + lignes[i].trim(); }
      cur = { titre: q.replace(/^\*\*/, '').replace(/\*\*$/, '').trim(), paras: [] };
      curGroupe.articles.push(cur); i++; continue;
    }
  }
  if (ligne.trim() === '') { i++; continue; }
  if (/^\*Première version\*/.test(ligne) || /^\*\d+ novembre/.test(ligne)) { i++; continue; } // en-tête du document : pas un article
  let paragraphe = ligne;
  while (i + 1 < lignes.length && lignes[i + 1].trim() !== '' && !/^#/.test(lignes[i + 1]) && !(modeFaq && /^\*\*/.test(lignes[i + 1].trim()))) { i++; paragraphe += ' ' + lignes[i].trim(); }
  ajouterParagraphe(paragraphe.trim());
  i++;
}

const enLigne = t => t.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/---/g, '—');
function paragraphesEnHtml(paras) {
  let html = '', puces = [];
  const vider = () => { if (puces.length) { html += '<ul>' + puces.map(p => `<li>${enLigne(p)}</li>`).join('') + '</ul>'; puces = []; } };
  for (const p of paras) {
    const m = p.match(/^-\s+(.*)$/);
    if (m) { puces.push(m[1]); continue; }
    vider(); html += `<p>${enLigne(p)}</p>`;
  }
  vider();
  return html;
}

const dejaVus = new Set();
function identifiant(base) {
  let s = slug(base) || 'section', n = s, k = 2;
  while (dejaVus.has(n)) n = s + '-' + (k++);
  dejaVus.add(n); return n;
}

const articles = [];
for (const g of groupes) for (const a of g.articles) articles.push({ id: identifiant(a.titre), groupe: g.titre, titre: a.titre, html: paragraphesEnHtml(a.paras) });

const sortie = "// Contenu de l'Aide intégrée (menu Aide), généré depuis claude/MODE-EMPLOI-FAQ.md par scripts/generer-aide.js — NE PAS ÉDITER À LA MAIN : relancer ce script après toute mise à jour du Mode d'emploi.\n"
  + "export const AIDE_VERSION = '1.33.0';\n"
  + "export const AIDE = " + JSON.stringify(articles, null, 2) + ";\n";
fs.writeFileSync(new URL('../js/aide-contenu.js', import.meta.url), sortie);
console.log(`js/aide-contenu.js régénéré : ${articles.length} articles dans ${groupes.length} groupes.`);
