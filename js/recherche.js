// Champ « Tapez pour chercher » : remplace les longs menus déroulants (v1.5.0).
// Les suggestions apparaissent au fil de la frappe : nom, prénom, nom de jeune fille, date de naissance (jj/mm/aaaa, aaaa…), métier ou organisme.
// La recherche se fait dans les listes DÉJÀ chargées à l'écran : aucune lecture Firebase en plus.
// Rien n'est figé ici : les listes viennent des fonctions `items` fournies par chaque écran.
import { esc } from './ui.js';
import { filtrer, nomAffiche, fmtDate, normContact } from './logic.js';

const REG = new Map();            // id du champ → { items, mode, ajout, onChoose, recents }
const CLE_RECENTS = 'animerci-recents';
const MAX = 8;

/* ---------- « Récemment choisis » : identifiants seulement, gardés sur l'appareil ---------- */
const lireRecents = () => { try { return JSON.parse(localStorage.getItem(CLE_RECENTS) || '{}'); } catch { return {}; } };
function noterRecent(cle, id) {
  if (!cle || !id) return;
  try { const r = lireRecents(); r[cle] = [id, ...(r[cle] || []).filter(x => x !== id)].slice(0, 5); localStorage.setItem(CLE_RECENTS, JSON.stringify(r)); } catch { /* stockage indisponible : sans conséquence */ }
}
export function oublierRecents() { try { localStorage.removeItem(CLE_RECENTS); } catch { /* idem */ } }

/* ---------- Fabriques d'éléments ---------- */
export const itemPersonne = s => ({ id: s.id, nom: s.nom, prenom: s.prenom, label: nomAffiche(s),
  sous: [s.nomNaissance && `née ${s.nomNaissance}`, s.naissance && fmtDate(s.naissance)].filter(Boolean).join(' · '),
  champs: [s.nom, s.prenom, s.nomNaissance], dates: [s.naissance] });
export const itemContact = c => { c = normContact(c); return { id: c.id, nom: c.nom, prenom: c.prenom, label: nomAffiche(c), sous: [c.precision, c.note].filter(Boolean).join(' · '),
  champs: [c.nom, c.prenom, c.precision, c.note, c.categorie], dates: [] }; };
export const itemActivite = a => ({ id: a.id, nom: a.nom, prenom: '', label: a.nom, sous: [a.cat, a.interv].filter(Boolean).join(' · '), champs: [a.nom, a.cat, a.interv, a.lieu], dates: [] });

export const AIDE_PERSONNE = 'Tapez un nom, un prénom, un nom de jeune fille ou une date de naissance (jj/mm/aaaa, ou seulement l\'année, ex. 1942).';

/**
 * Markup d'un champ de recherche.
 *  mode 'unique' : un choix, gardé dans le champ (lire avec comboLire) ; mode 'action' : chaque choix appelle onChoose(item) et le champ se vide.
 *  ajout(texte) : texte de la ligne « + Ajouter … » (ou null pour ne pas la proposer). recents : clé de la liste des récents.
 */
export function champRecherche({ id, label, aide = '', texte = '', val = '', items, mode = 'unique', ajout = null, onChoose = null, recents = '', placeholder = 'Tapez pour chercher…' }) {
  REG.set(id, { items, mode, ajout, onChoose, recents });
  return `<div class="field combo" data-combo="${esc(id)}"><label for="${esc(id)}">${label}</label>
    <input id="${esc(id)}" class="combo-in" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${esc(id)}-l" autocomplete="off" autocapitalize="off" spellcheck="false"
      placeholder="${esc(placeholder)}" value="${esc(texte)}" data-val="${esc(val)}">
    <ul id="${esc(id)}-l" class="combo-list" role="listbox" hidden></ul>
    ${aide ? `<small class="sub">${esc(aide)}</small>` : ''}</div>`;
}
/** Valeur d'un champ en mode « unique » : { val: identifiant choisi ('' si rien, NOUVEAU si « + Ajouter »), texte: ce qui est écrit }. */
export function comboLire(id) { const el = document.getElementById(id); return el ? { val: el.dataset.val || '', texte: el.value.trim() } : { val: '', texte: '' }; }
export const NOUVEAU = '__nouveau__';
/** Remplit un champ avec un choix (utilisé après une création). */
export function comboFixer(id, item) { const el = document.getElementById(id); if (!el) return; el.value = item.label; el.dataset.val = item.id; fermer(id); }

/* ---------- Affichage de la liste ---------- */
let actif = -1;   // ligne mise en évidence
function lignes(id, texte) {
  const r = REG.get(id); if (!r) return { opts: [], plus: '' };
  const tous = r.items() || [];
  let opts, plus = '';
  if (!texte.trim()) {
    const ids = r.recents ? (lireRecents()[r.recents] || []) : [];
    const rec = ids.map(i => tous.find(x => x.id === i)).filter(Boolean);
    const reste = filtrer(tous.filter(x => !rec.includes(x)), '', Math.max(0, MAX - rec.length));
    opts = [...rec.map(x => ({ ...x, recent: true })), ...reste.liste];
    plus = tous.length > opts.length ? `${tous.length - opts.length} autres : tapez pour chercher` : '';
    if (!tous.length) plus = 'La liste est vide';
  } else {
    const f = filtrer(tous, texte, MAX); opts = f.liste;
    plus = f.total > opts.length ? `${f.total - opts.length} autres : continuez à taper pour affiner` : '';
  }
  return { opts, plus, ajout: r.ajout ? r.ajout(texte.trim()) : null, vide: !opts.length };
}
function ouvrir(id) {
  const el = document.getElementById(id), ul = document.getElementById(id + '-l'); if (!el || !ul) return;
  const { opts, plus, ajout, vide } = lignes(id, el.value);
  el._opts = opts; actif = opts.length ? 0 : -1;
  ul.innerHTML = opts.map((o, k) => `<li role="option" id="${esc(id)}-o${k}" class="combo-opt${k === actif ? ' on' : ''}" data-k="${k}" aria-selected="${k === actif}">${o.recent ? '<span class="rec">récent</span>' : ''}<b>${esc(o.label)}</b>${o.sous ? `<small>${esc(o.sous)}</small>` : ''}</li>`).join('')
    + (vide && el.value.trim() ? '<li class="combo-info" role="presentation">Aucun résultat</li>' : '')
    + (plus ? `<li class="combo-info" role="presentation">${esc(plus)}</li>` : '')
    + (ajout ? `<li role="option" id="${esc(id)}-oa" class="combo-opt combo-add" data-k="ajout" aria-selected="false"><b>${esc(ajout)}</b></li>` : '');
  ul.hidden = false; el.setAttribute('aria-expanded', 'true');
  if (actif >= 0) el.setAttribute('aria-activedescendant', `${id}-o0`); else el.removeAttribute('aria-activedescendant');
}
function fermer(id) {
  const el = document.getElementById(id), ul = document.getElementById(id + '-l'); if (!el || !ul) return;
  ul.hidden = true; el.setAttribute('aria-expanded', 'false'); el.removeAttribute('aria-activedescendant'); actif = -1;
}
const ouverte = id => { const ul = document.getElementById(id + '-l'); return !!ul && !ul.hidden; };
function surligner(id, k) {
  const ul = document.getElementById(id + '-l'); if (!ul) return;
  const lis = [...ul.querySelectorAll('.combo-opt')]; if (!lis.length) return;
  actif = (k + lis.length) % lis.length;
  lis.forEach((l, i) => { l.classList.toggle('on', i === actif); l.setAttribute('aria-selected', String(i === actif)); });
  lis[actif].scrollIntoView({ block: 'nearest' }); document.getElementById(id).setAttribute('aria-activedescendant', lis[actif].id);
}
function choisir(id, k) {
  const el = document.getElementById(id), r = REG.get(id); if (!el || !r) return;
  if (k === 'ajout') {
    const t = el.value.trim();
    if (r.mode === 'action') { fermer(id); if (r.onChoose) r.onChoose(null, t); return; }
    el.dataset.val = NOUVEAU; fermer(id); return;
  }
  const o = (el._opts || [])[Number(k)]; if (!o) return;
  noterRecent(r.recents, o.id);
  if (r.mode === 'action') { el.value = ''; el.dataset.val = ''; fermer(id); if (r.onChoose) r.onChoose(o, ''); el.focus(); return; }
  el.value = o.label; el.dataset.val = o.id; fermer(id);
}

/* ---------- Événements (installés une seule fois, pour tous les champs) ---------- */
let installe = false;
export function installerRecherche() {
  if (installe) return; installe = true;
  document.addEventListener('input', e => {
    const el = e.target.closest && e.target.closest('.combo-in'); if (!el) return;
    el.dataset.val = '';                       // dès qu'on retape, l'ancien choix est oublié
    ouvrir(el.id);
  });
  document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('.combo-in'); if (el && !ouverte(el.id)) ouvrir(el.id); });
  document.addEventListener('focusout', e => { const el = e.target.closest && e.target.closest('.combo-in'); if (el) setTimeout(() => { if (document.activeElement !== el) fermer(el.id); }, 150); });
  document.addEventListener('mousedown', e => { if (e.target.closest && e.target.closest('.combo-list')) e.preventDefault(); });   // garde le focus dans le champ
  document.addEventListener('click', e => {
    const li = e.target.closest && e.target.closest('.combo-opt'); if (!li) return;
    const box = li.closest('.combo'); if (box) choisir(box.dataset.combo, li.dataset.k);
  });
  // phase de capture : les flèches/Entrée/Échap sont traitées ici avant le reste de l'application (Échap ferme d'abord la liste, pas la fenêtre)
  document.addEventListener('keydown', e => {
    const el = e.target.closest && e.target.closest('.combo-in'); if (!el) return;
    const id = el.id;
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!ouverte(id)) ouvrir(id); else surligner(id, actif + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (ouverte(id)) surligner(id, actif - 1); }
    else if (e.key === 'Enter' && ouverte(id)) {
      const lis = [...document.getElementById(id + '-l').querySelectorAll('.combo-opt')];
      if (actif >= 0 && lis[actif]) { e.preventDefault(); choisir(id, lis[actif].dataset.k); }
    }
    else if (e.key === 'Escape' && ouverte(id)) { e.preventDefault(); e.stopImmediatePropagation(); fermer(id); }
  }, true);
}
