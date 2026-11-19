/* global Buffer, process */
// Contrôle de confidentialité : aucun fichier destiné à GitHub ne doit contenir de nom propre du service.
// Lancer : node tests/confidentialite.mjs
import fs from 'fs'; import path from 'path';
const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
// Motifs gardés encodés (base64) pour ne pas écrire ces noms dans le code publié.
const INTERDITS = ['bWFkZWxlaW5l', 'd2VydmljcQ==', 'XGJwZW1cYg==', 'Z21haWxcLmNvbQ==', 'YmVydGltb252YWxkdXM=', 'cGhpbGlwcGU=', 'dGVtcG8oPyFbYS16w6ldKQ=='].map(b => new RegExp(Buffer.from(b, 'base64').toString('utf8'), 'i'));
const SUFFIXES = new Set(['.js', '.mjs', '.py', '.html', '.css', '.md', '.json', '.webmanifest', '.svg', '.rules', '.txt']);
let fautes = 0, n = 0;
(function parcourir(d) {
  for (const f of fs.readdirSync(d)) {
    if (f === 'node_modules' || f === '__pycache__' || f === '.git') continue;
    const p = path.join(d, f), st = fs.statSync(p);
    if (st.isDirectory()) { parcourir(p); continue; }
    if (!SUFFIXES.has(path.extname(f)) && f !== 'firestore.rules') continue;
    n++;
    const t = fs.readFileSync(p, 'utf8');
    for (const re of INTERDITS) { const m = t.match(re); if (m) { fautes++; console.log('ECHEC -', path.relative(racine, p), ':', m[0]); } }
    if (INTERDITS.some(re => re.test(f))) { fautes++; console.log('ECHEC - nom de fichier :', f); }
  }
})(racine);
console.log(`${n} fichiers contrôlés ; ${fautes ? fautes + ' problème(s)' : 'aucun nom propre trouvé'}`);
process.exit(fautes ? 1 : 0);
