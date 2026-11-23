// Matériel (lot A, v1.17.0) : inventaire, réserves (stocks, péremption), caisses de décorations, emprunts, alertes.
// Tout est écrit pour l'ORGANISATION du service (qui, quoi, où, quand) : aucune donnée de santé, aucune photo (le stockage de fichiers est payant).
// Accès : l'administratrice, les intervenant·es et les bénévoles consultent et saisissent ; chaque ligne garde « saisi par ». La suppression et les exports restent à l'administratrice.
// Les calculs (stock, péremption par article ou par lot, disponible, alertes) sont dans logic.js ; ici : les écrans et les formulaires.
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { champRecherche, comboLire, itemPersonne, itemContact, NOUVEAU } from './recherche.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, ajouterJours, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, patienter, journaliser, peutAdmin } from './ui.js';

const ONGLETS = [['inventaire', 'Inventaire'], ['reserves', 'Réserves'], ['caisses', 'Caisses de décorations'], ['emprunts', 'Emprunts']];
export const ongletMat = () => (ONGLETS.some(o => o[0] === S.ongletMat) ? S.ongletMat : 'inventaire');
const TYPE_ONGLET = { inventaire: 'objet', reserves: 'reserve', caisses: 'caisse' };
const fr = d => L.fmtDate(d);
const attendre = async (cond, ms = 5000) => { for (let i = 0; i < ms / 100 && !cond(); i++) await new Promise(r => setTimeout(r, 100)); };
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une information d'organisation, par exemple « 2e étagère du local de rangement », « à racheter avant le banquet », « caisse bleue, couvercle à réparer ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé, et le nom d'une personne accompagnée. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const options = (liste, courant, vide = '') => [...(vide ? [`<option value="">${esc(vide)}</option>`] : []), ...(courant && !liste.includes(courant) ? [courant] : []).concat(liste).map(x => `<option ${x === courant ? 'selected' : ''}>${esc(x)}</option>`)].join('');
const optionsEtats = courant => Object.entries(L.ETATS_MATERIEL).map(([k, l]) => `<option value="${k}" ${k === (courant || 'bon') ? 'selected' : ''}>${l}</option>`).join('');
const parNom = (a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
const ouverts = () => S.cache.emprunts.filter(e => !e.rendu);
const emplacementsConnus = () => [...new Set([...P('materiel.emplacements'), ...S.cache.materiel.map(m => m.emplacement).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'fr'));

/* ---------- Écran « Matériel » ---------- */
export function materiel() {
  if (!pret('materiel') || !pret('emprunts', 'ouverts')) return chargement('Matériel');
  const tab = ongletMat(), auj = aujourdhui(), admin = peutAdmin();
  const al = L.alertesMateriel({ materiel: S.cache.materiel, emprunts: ouverts(), auj, joursPeremption: P('materiel.alertePeremptionJours') });
  const lib = { crit: ['p-crit', 'Urgent'], warn: ['p-warn', 'À regarder'], info: ['p-bleu', 'À faire'] };
  const nb = { inventaire: S.cache.materiel.filter(m => m.type === 'objet').length, reserves: S.cache.materiel.filter(m => m.type === 'reserve').length, caisses: S.cache.materiel.filter(m => m.type === 'caisse').length, emprunts: ouverts().length };
  const ajout = { inventaire: ['mat-form', 'objet', '+ Nouvel article'], reserves: ['mat-form', 'reserve', '+ Nouvelle réserve'], caisses: ['mat-form', 'caisse', '+ Nouvelle caisse'], emprunts: ['emp-form', '', '+ Nouvel emprunt'] }[tab];
  return `<div class="top"><div><h1>Matériel</h1><p>L'inventaire, les réserves, les caisses de décorations et les emprunts du service. Une alerte apparaît dès qu'un stock est bas, qu'une date de péremption approche ou qu'un emprunt est en retard.</p></div>
    <div class="quick"><button class="btn" data-action="${ajout[0]}" data-type="${ajout[1]}">${ajout[2]}</button>${admin ? '<button class="btn sec" data-action="mat-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="mat-pdf">PDF / Imprimer</button>' : ''}</div></div>
  <div class="card alertes" style="margin-bottom:14px"><h2 style="margin-top:0">Alertes</h2>${al.length ? al.map(a => `<button class="row" style="width:100%;background:none;border:0;border-top:1px solid var(--ligne);text-align:left" data-action="mat-tab" data-v="${a.tab}">
    <span class="pill ${lib[a.niveau][0]}">${lib[a.niveau][1]}</span><div class="grow">${esc(a.texte)}</div></button>`).join('') : '<div class="empty"><b>Aucune alerte</b>Stocks, péremptions et emprunts sont en ordre.</div>'}</div>
  <div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="mat-tab" data-v="${k}" aria-pressed="${tab === k}">${l} (${nb[k]})</button>`).join('')}</div>
  ${tab === 'emprunts' ? vueEmprunts() : vueArticles(tab)}`;
}
export function apresMateriel() {
  const r = $('#rech-mat'); if (r) r.oninput = () => { S.rechMat = r.value; $('#liste-mat').innerHTML = listeCourante(); };
}

/* ---------- Articles (inventaire, réserves, caisses) ---------- */
function filtresArticles(tab) {
  const cats = tab === 'reserves' ? P('materiel.categoriesReserves') : P('materiel.categories');
  return `<div class="two" style="margin-bottom:6px">
    ${tab === 'caisses' ? `<div class="field"><label for="f-sa">Saison ou occasion</label><select id="f-sa" data-change="mat-fsaison">${options(P('materiel.saisons'), S.fSaisonMat || '', 'Toutes')}</select></div>`
      : `<div class="field"><label for="f-ca">Catégorie</label><select id="f-ca" data-change="mat-fcat">${options(cats, S.fCatMat || '', 'Toutes')}</select></div>`}
    <div class="field"><label for="f-em">Emplacement</label><select id="f-em" data-change="mat-femp">${options(emplacementsConnus(), S.fEmpMat || '', 'Tous')}</select></div></div>
    <div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin-bottom:10px"><input class="search" id="rech-mat" type="search" placeholder="Chercher un article…" aria-label="Chercher un article" value="${esc(S.rechMat || '')}" style="flex:1;min-width:200px;margin:0">
    <label class="chk" style="margin:0"><input type="checkbox" data-change="mat-fsig" ${S.fSigMat ? 'checked' : ''}> À signaler seulement</label></div>`;
}
function vueArticles(tab) { return `${filtresArticles(tab)}<div id="liste-mat">${listeCourante()}</div>`; }
function listeCourante() { return ongletMat() === 'emprunts' ? '' : listeArticles(ongletMat()); }
function ASignaler(m, auj) {
  const d = L.derivesMateriel(m), horizon = ajouterJours(auj, P('materiel.alertePeremptionJours'));
  return d.bas || d.manquant || (m.etat && m.etat !== 'bon' && m.type !== 'reserve') || (d.echeance && d.echeance <= horizon);
}
function listeArticles(tab) {
  const auj = aujourdhui(), type = TYPE_ONGLET[tab], q = L.cleNom(S.rechMat || '');
  const rows = S.cache.materiel.filter(m => m.type === type
    && (!S.fCatMat || tab === 'caisses' || m.categorie === S.fCatMat) && (!S.fSaisonMat || tab !== 'caisses' || m.saison === S.fSaisonMat) && (!S.fEmpMat || m.emplacement === S.fEmpMat)
    && (!S.fSigMat || ASignaler(m, auj)) && (!q || L.cleNom([m.nom, m.categorie, m.emplacement, m.commentaire, m.numero, m.saison, m.contenu].join(' ')).includes(q)))
    .sort((a, b) => (tab === 'caisses' ? String(a.saison || '').localeCompare(String(b.saison || ''), 'fr') || String(a.numero).localeCompare(String(b.numero), 'fr', { numeric: true }) : String(a.categorie || '').localeCompare(String(b.categorie || ''), 'fr')) || parNom(a, b));
  if (!rows.length) return `<div class="card"><div class="empty"><b>${S.cache.materiel.some(m => m.type === type) ? 'Aucun article ne correspond' : tab === 'reserves' ? 'Aucune réserve' : tab === 'caisses' ? 'Aucune caisse' : 'Aucun article'}</b>${S.cache.materiel.some(m => m.type === type) ? 'Modifiez la recherche ou les filtres.' : 'Ajoutez le premier avec le bouton en haut de l\'écran.'}</div></div>`;
  return `<p class="sub">${rows.length} ${tab === 'caisses' ? 'caisse' : 'article'}${rows.length > 1 ? 's' : ''}</p>` + rows.map(m => (tab === 'reserves' ? ligneReserve(m, auj) : tab === 'caisses' ? ligneCaisse(m) : ligneObjet(m))).join('');
}
const etatPill = m => (m.etat && m.etat !== 'bon' ? `<span class="pill ${m.etat === 'manquant' || m.etat === 'hs' ? 'p-crit' : 'p-warn'}">${esc(L.ETATS_MATERIEL[m.etat] || m.etat)}</span>` : '');
const extrait = t => (t ? `<span class="sub">${esc(t.length > 140 ? t.slice(0, 140) + '…' : t)}</span>` : '');
function ligneObjet(m) {
  const d = L.derivesMateriel(m), prete = L.pretes(m, S.cache.emprunts), dispo = L.disponible(m, S.cache.emprunts);
  return `<button class="cand" data-action="mat-form" data-id="${esc(m.id)}"><span class="av">${esc(initiales(m.nom))}</span><span style="flex:1"><b>${esc(m.nom)}</b><span class="why">
    <span class="pill p-rose">${esc(m.categorie || 'Sans catégorie')}</span><span class="pill p-bleu">${L.fmtQte(m.quantite)} au total</span>
    ${prete ? `<span class="pill p-warn">${L.fmtQte(prete)} prêté${prete > 1 ? 's' : ''} · ${L.fmtQte(dispo)} disponible${dispo > 1 ? 's' : ''}</span>` : ''}
    ${m.emplacement ? `<span class="pill p-bleu">${esc(m.emplacement)}</span>` : ''}${etatPill(m)}${d.bas ? `<span class="pill ${Number(m.quantite) === 0 ? 'p-crit' : 'p-warn'}">Stock bas (seuil ${L.fmtQte(m.seuil)})</span>` : ''}</span>${extrait(m.commentaire)}</span></button>`;
}
function ligneCaisse(m) {
  const prete = L.pretes(m, S.cache.emprunts);
  return `<button class="cand" data-action="mat-form" data-id="${esc(m.id)}"><span class="av">${esc(String(m.numero || '?').slice(0, 3))}</span><span style="flex:1"><b>Caisse n° ${esc(m.numero || '?')} — ${esc(m.nom)}</b><span class="why">
    <span class="pill p-rose">${esc(m.saison || 'Sans saison')}</span><span class="pill p-bleu">${L.fmtQte(m.quantite)} élément${Number(m.quantite) > 1 ? 's' : ''}</span>${m.emplacement ? `<span class="pill p-bleu">${esc(m.emplacement)}</span>` : ''}
    ${prete ? '<span class="pill p-warn">Prêtée</span>' : ''}${etatPill(m)}</span>${extrait(m.contenu)}${extrait(m.commentaire)}</span></button>`;
}
function ligneReserve(m, auj) {
  const d = L.derivesMateriel(m), horizon = ajouterJours(auj, P('materiel.alertePeremptionJours')), lignes = L.textesPeremption(m);
  const pP = !d.echeance ? '' : d.echeance < auj ? `<span class="pill p-crit">Périmé depuis le ${esc(fr(d.echeance))}</span>` : d.echeance <= horizon ? `<span class="pill p-warn">Péremption le ${esc(fr(d.echeance))}</span>` : `<span class="pill p-ok">Péremption le ${esc(fr(d.echeance))}</span>`;
  return `<div class="cand" style="cursor:default;align-items:flex-start"><span class="av">${esc(initiales(m.nom))}</span><span style="flex:1"><b>${esc(m.nom)}</b><span class="why">
    <span class="pill p-rose">${esc(m.categorie || 'Sans catégorie')}</span><span class="pill p-bleu">${L.fmtQte(d.quantite)} ${esc(m.unite || '')}</span>
    ${d.bas ? `<span class="pill ${d.quantite === 0 ? 'p-crit' : 'p-warn'}">${d.quantite === 0 ? 'Épuisé' : 'Stock bas'} (seuil ${L.fmtQte(m.seuil)})</span>` : ''}${pP}${m.emplacement ? `<span class="pill p-bleu">${esc(m.emplacement)}</span>` : ''}</span>
    ${lignes.map(t => `<span class="sub" style="display:block">${esc(t)}</span>`).join('')}${extrait(m.commentaire)}</span>
    <span class="quick" style="justify-content:flex-end"><button class="btn sm" data-action="mat-mvt" data-id="${esc(m.id)}" data-sens="entree">Entrée +</button><button class="btn sm sec" data-action="mat-mvt" data-id="${esc(m.id)}" data-sens="sortie">Sortie −</button>
    <button class="btn sm ghost" data-action="mat-histo" data-id="${esc(m.id)}">Historique</button><button class="btn sm ghost" data-action="mat-form" data-id="${esc(m.id)}">Fiche</button></span></div>`;
}

/* ---------- Emprunts ---------- */
function vueEmprunts() {
  const auj = aujourdhui(), an = S.anMat || auj.slice(0, 4), f = S.fEmprunt || 'encours';
  const ou = ouverts(), retard = ou.filter(e => L.statutEmprunt(e, auj) === 'retard');
  const filtres = [['encours', `En cours (${ou.length})`], ['retard', `En retard (${retard.length})`], ['rendus', 'Rendus']];
  let corps;
  if (f === 'rendus') {
    const annees = []; for (let a = Number(auj.slice(0, 4)); a >= Number(auj.slice(0, 4)) - 5; a--) annees.push(a);
    const rendus = pret('emprunts', 'rendus-' + an) ? S.cache.emprunts.filter(e => e.rendu && (e.retourReel || '').slice(0, 4) === String(an)).sort((a, b) => (b.retourReel || '').localeCompare(a.retourReel || '')) : null;
    corps = `<div class="field" style="max-width:200px;margin:0 0 10px"><label for="mat-an">Année du retour</label><select id="mat-an" data-change="mat-an">${annees.map(a => `<option ${String(a) === String(an) ? 'selected' : ''}>${a}</option>`).join('')}</select></div>`
      + (rendus === null ? '<div class="card"><div class="empty"><div class="spin" aria-hidden="true"></div><br><b>Chargement…</b></div></div>' : rendus.length ? rendus.map(e => ligneEmprunt(e, auj)).join('') : '<div class="card"><div class="empty"><b>Aucun emprunt rendu</b>Pour cette année.</div></div>');
  } else {
    const rows = (f === 'retard' ? retard : ou).sort((a, b) => (a.retourPrevu || '').localeCompare(b.retourPrevu || ''));
    corps = rows.length ? rows.map(e => ligneEmprunt(e, auj)).join('') : `<div class="card"><div class="empty"><b>${f === 'retard' ? 'Aucun emprunt en retard' : 'Aucun emprunt en cours'}</b>${f === 'retard' ? 'Tout est rendu à temps.' : 'Ajoutez-en un avec « + Nouvel emprunt ».'}</div></div>`;
  }
  return `<div class="filters">${filtres.map(([k, l]) => `<button data-action="mat-femprunt" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>${corps}`;
}
function ligneEmprunt(e, auj) {
  const st = L.statutEmprunt(e, auj), j = L.joursDeRetard(e, auj);
  return `<div class="cand" style="cursor:default;align-items:flex-start"><span class="av">${esc(initiales(e.emprunteur || '?'))}</span><span style="flex:1"><b>${esc(e.materielNom || '(article supprimé)')} × ${L.fmtQte(e.quantite)}</b><span class="why">
    <span class="pill p-rose">${esc(e.emprunteur || '')}</span><span class="pill p-bleu">Sorti le ${esc(fr(e.dateSortie))}</span>
    ${st === 'rendu' ? `<span class="pill p-ok">Rendu le ${esc(fr(e.retourReel))}</span>${e.etatRetour && e.etatRetour !== 'bon' ? `<span class="pill p-warn">${esc(L.ETATS_MATERIEL[e.etatRetour] || e.etatRetour)}</span>` : ''}`
      : st === 'retard' ? `<span class="pill p-crit">En retard de ${j} jour${j > 1 ? 's' : ''} (prévu le ${esc(fr(e.retourPrevu))})</span>` : `<span class="pill p-warn">Retour prévu le ${esc(fr(e.retourPrevu))}</span>`}</span>${extrait(e.commentaire)}${e.par ? `<span class="sub" style="display:block">Saisi par ${esc(e.par)}</span>` : ''}</span>
    <span class="quick" style="justify-content:flex-end">${st === 'rendu' ? '' : `<button class="btn sm" data-action="emp-retour" data-id="${esc(e.id)}">Enregistrer le retour</button>`}<button class="btn sm ghost" data-action="emp-form" data-id="${esc(e.id)}">${st === 'rendu' ? 'Voir' : 'Modifier'}</button></span></div>`;
}

/* ---------- Fiche d'un article ---------- */
const ligneLot = l => `<div class="lotrow" data-lot="${esc(l.id || '')}" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr)) auto;gap:8px;align-items:end;margin-bottom:8px;padding:8px;border:1px solid var(--ligne);border-radius:12px">
  <div class="field" style="margin:0"><label>Nom du lot<input class="lot-lib" maxlength="60" value="${esc(l.libelle || '')}" placeholder="Ex. : lot n° 2 (achat de mars)"></label></div>
  <div class="field" style="margin:0"><label>Quantité<input class="lot-qte" inputmode="decimal" value="${l.quantite == null ? '' : esc(L.fmtQte(l.quantite))}"></label></div>
  <div class="field" style="margin:0"><label>Date de péremption<input class="lot-date" type="date" value="${esc(l.date || '')}"></label></div>
  <button type="button" class="btn ghost sm lot-del" aria-label="Retirer ce lot">Retirer</button>
  ${l.le ? `<small class="sub" style="grid-column:1/-1">Date relevée le ${esc(fr(l.le))}${l.par ? ' par ' + esc(l.par) : ''} (mise à jour si vous changez la date)</small>` : ''}</div>`;
function matForm(id, typeNew) {
  const m = id ? S.cache.materiel.find(x => x.id === id) : { type: typeNew || 'objet', etat: 'bon', quantite: 1, seuil: 0, peremption: 'aucun', lots: [], unite: P('materiel.unites')[0], saison: P('materiel.saisons')[0] };
  if (id && !m) return;
  const t = m.type, admin = peutAdmin(), lot = t === 'reserve' && m.peremption === 'lot';
  const titre = { objet: 'article', reserve: 'réserve', caisse: 'caisse de décorations' }[t];
  const q0 = L.quantiteTotale(m);
  modal(`<h2>${id ? esc(m.nom) : 'Nouvelle ' + (t === 'objet' ? 'fiche d\'article' : titre)}</h2>
  ${t === 'reserve' && id && L.textesPeremption(m).length ? `<div class="card" style="margin-bottom:10px;padding:10px 14px"><b>Péremption</b>${L.textesPeremption(m).map(x => `<div class="sub">${esc(x)}</div>`).join('')}</div>` : ''}
  <div class="field"><label for="a1">${t === 'caisse' ? 'Nom ou contenu principal' : 'Nom de l\'article'}</label><input id="a1" maxlength="120" value="${esc(m.nom || '')}" placeholder="${t === 'reserve' ? 'Ex. : café moulu' : t === 'caisse' ? 'Ex. : guirlandes et boules' : 'Ex. : assiettes blanches'}"></div>
  ${t === 'caisse' ? `<div class="two"><div class="field"><label for="a3">Numéro de la caisse</label><input id="a3" maxlength="20" value="${esc(m.numero || '')}" placeholder="Ex. : 3"></div>
    <div class="field"><label for="a4">Saison ou occasion</label><select id="a4">${options(P('materiel.saisons'), m.saison || '')}</select></div></div>
    <div class="field"><label for="a5">Contenu <small class="sub">(facultatif)</small></label><textarea id="a5" rows="2" maxlength="400">${esc(m.contenu || '')}</textarea></div>`
    : `<div class="field"><label for="a2">Catégorie</label><select id="a2">${options(t === 'reserve' ? P('materiel.categoriesReserves') : P('materiel.categories'), m.categorie || '')}</select></div>`}
  <div class="two"><div class="field"><label for="a6">${t === 'caisse' ? 'Nombre d\'éléments' : 'Quantité'}</label><input id="a6" inputmode="decimal" value="${esc(L.fmtQte(q0))}" ${lot ? 'disabled' : ''}>
      ${t === 'reserve' ? '<small class="sub" id="a6aide"></small>' : ''}</div>
    ${t === 'reserve' ? `<div class="field"><label for="a7">Unité</label><select id="a7">${options(P('materiel.unites'), m.unite || '')}</select></div>` : '<div></div>'}</div>
  ${t !== 'caisse' ? `<div class="field"><label for="a8">Seuil d'alerte <small class="sub">(alerte quand il en reste ce nombre ou moins ; 0 = pas d'alerte)</small></label><input id="a8" inputmode="decimal" value="${esc(L.fmtQte(m.seuil || 0))}" style="max-width:180px"></div>` : ''}
  <div class="field"><label for="a9">Emplacement</label><input id="a9" list="dl-emp" maxlength="80" value="${esc(m.emplacement || '')}" placeholder="Ex. : local de rangement, étagère 2"><datalist id="dl-emp">${emplacementsConnus().map(e => `<option value="${esc(e)}"></option>`).join('')}</datalist></div>
  ${t !== 'reserve' ? `<div class="field"><label for="a10">État</label><select id="a10">${optionsEtats(m.etat)}</select></div>` : ''}
  ${t === 'reserve' ? `<div class="field"><label for="a11">Suivi de la péremption</label><select id="a11">${Object.entries(L.MODES_PEREMPTION).map(([k, l]) => `<option value="${k}" ${k === (m.peremption || 'aucun') ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <small class="sub">« Une date pour tout l'article » : la date la plus proche, relevée sur le produit. « Par lot » : une date par lot (achats ou dons de dates différentes) ; chaque date garde qui l'a relevée et quand.</small></div>
    <div id="zArt" class="field"><label for="a12">Date de péremption</label><input id="a12" type="date" value="${esc(m.datePeremption || '')}" style="max-width:220px">${m.peremptionPar ? `<small class="sub">Relevée le ${esc(fr(m.peremptionLe))} par ${esc(m.peremptionPar)} (mise à jour si vous changez la date).</small>` : ''}</div>
    <div id="zLots" class="field"><label>Lots</label><div id="lots-ed">${L.lotsDe(m).map(ligneLot).join('')}</div><button type="button" class="btn sec sm" id="lotAjout">+ Ajouter un lot</button></div>` : ''}
  <div class="field"><label for="a13">Commentaire <small class="sub">(facultatif)</small></label><textarea id="a13" rows="2" maxlength="400">${esc(m.commentaire || '')}</textarea></div>
  ${AVERT}
  ${m.modifiePar ? `<p class="sub" style="margin:0 0 8px">Dernière modification par ${esc(m.modifiePar)}${m.modifieLe ? ' le ' + esc(fr(m.modifieLe)) : ''}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveA">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>
  ${id && t !== 'reserve' ? '<button class="btn sec" id="pretA">Prêter</button>' : ''}
  ${id && t === 'reserve' ? '<button class="btn sec" id="entA">Entrée +</button><button class="btn sec" id="sorA">Sortie −</button><button class="btn sec" id="hisA">Historique</button>' : ''}
  ${id && admin ? '<button class="btn ghost" id="delA" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  if (t === 'reserve') {
    const maj = () => {
      const mode = $('#a11').value; $('#zArt').style.display = mode === 'article' ? '' : 'none'; $('#zLots').style.display = mode === 'lot' ? '' : 'none';
      const champ = $('#a6'); champ.disabled = mode === 'lot'; $('#a6aide').textContent = mode === 'lot' ? 'Calculée d\'après les lots.' : '';
      if (mode === 'lot') { const rows = [...document.querySelectorAll('#lots-ed .lotrow')]; champ.value = L.fmtQte(rows.reduce((n, r) => n + (L.lireNombre(r.querySelector('.lot-qte').value) || 0), 0)); }
    };
    $('#a11').onchange = () => {
      if ($('#a11').value === 'lot' && !document.querySelector('#lots-ed .lotrow')) $('#lots-ed').insertAdjacentHTML('beforeend', ligneLot({ libelle: 'Lot 1', quantite: L.lireNombre($('#a6').value) || 0, date: $('#a12').value }));
      maj();
    };
    $('#lotAjout').onclick = () => { $('#lots-ed').insertAdjacentHTML('beforeend', ligneLot({ libelle: `Lot ${document.querySelectorAll('#lots-ed .lotrow').length + 1}`, quantite: '', date: '' })); maj(); };
    $('#lots-ed').onclick = e => { const b = e.target.closest('.lot-del'); if (b) { b.closest('.lotrow').remove(); maj(); } };
    $('#lots-ed').oninput = maj;
    maj();
  }
  const lireLots = () => [...document.querySelectorAll('#lots-ed .lotrow')].map((r, i) => ({ id: r.dataset.lot || '', libelle: r.querySelector('.lot-lib').value.trim() || `Lot ${i + 1}`, quantite: L.lireNombre(r.querySelector('.lot-qte').value), date: r.querySelector('.lot-date').value }));
  $('#saveA').onclick = async () => {
    const mode = t === 'reserve' ? $('#a11').value : 'aucun', lots = mode === 'lot' ? lireLots() : [];
    const seuilTxt = t !== 'caisse' ? $('#a8').value.trim() : '';
    const doc = { ...(id ? { id } : {}), type: t, nom: $('#a1').value.trim(), commentaire: $('#a13').value.trim(), emplacement: $('#a9').value.trim(),
      quantite: mode === 'lot' ? lots.reduce((n, l) => n + (Number(l.quantite) || 0), 0) : L.lireNombre($('#a6').value), seuil: seuilTxt === '' ? 0 : L.lireNombre(seuilTxt), creePar: m.creePar || (S.user && S.user.nom) || '' };
    if (t === 'caisse') Object.assign(doc, { numero: $('#a3').value.trim(), saison: $('#a4').value, contenu: $('#a5').value.trim(), etat: $('#a10').value });
    else doc.categorie = $('#a2').value;
    if (t === 'objet') doc.etat = $('#a10').value;
    if (t === 'reserve') Object.assign(doc, { unite: $('#a7').value, peremption: mode, datePeremption: mode === 'article' ? $('#a12').value : '', lots, etat: '' });
    const err = L.erreurMateriel(doc); if (err) return toast(err);
    if (t !== 'reserve' && id) { const prete = L.pretes(m, S.cache.emprunts); if (doc.quantite < prete) return toast(`${L.fmtQte(prete)} sont actuellement prêtés : la quantité ne peut pas être plus basse. Enregistrez d'abord les retours.`); }
    const final = L.preparerMateriel(doc, id ? m : null, { par: (S.user && S.user.nom) || '', auj: aujourdhui() });
    await sauver('materiel', final, 'Enregistré');
    closeModal();
  };
  if (id && t !== 'reserve') $('#pretA').onclick = () => { closeModal(); empForm('', { materielId: id }); };
  if (id && t === 'reserve') { $('#entA').onclick = () => mvtForm(id, 'entree'); $('#sorA').onclick = () => mvtForm(id, 'sortie'); $('#hisA').onclick = () => histoForm(id); }
  if (id && admin) $('#delA').onclick = () => {
    const ens = ouverts().filter(e => e.materielId === id);
    if (ens.length) return toast('Des emprunts de cet article sont en cours : enregistrez d\'abord les retours.');
    confirmer('Supprimer cet article ?', `« ${m.nom} » va à la corbeille (restaurable pendant ${P('securite.joursCorbeille')} jours). L'historique des mouvements de stock est conservé.`, 'Supprimer', async () => { await mettreCorbeille('materiel', m); await store.remove('materiel', id); toast('Article mis à la corbeille'); });
  };
}

/* ---------- Entrée / sortie de stock ---------- */
function mvtForm(id, sens) {
  const m = S.cache.materiel.find(x => x.id === id); if (!m || m.type !== 'reserve') return;
  const lot = m.peremption === 'lot', lots = L.lotsDe(m), q = L.quantiteTotale(m), auj = aujourdhui(), entree = sens === 'entree';
  const libLot = l => `${l.libelle || 'Lot'} — ${L.fmtQte(l.quantite)} ${m.unite || ''}, péremption ${fr(l.date)}`;
  modal(`<h2>${entree ? 'Entrée de stock' : 'Sortie de stock'} — ${esc(m.nom)}</h2><p class="sub">En stock : <b>${L.fmtQte(q)} ${esc(m.unite || '')}</b></p>
  <div class="two"><div class="field"><label for="v1">Quantité ${entree ? 'entrée' : 'sortie'}</label><input id="v1" inputmode="decimal" placeholder="Ex. : 2"></div>
    <div class="field"><label for="v2">Date</label><input id="v2" type="date" value="${esc(auj)}"></div></div>
  <div class="field"><label for="v3">Motif</label><select id="v3">${L.MOTIFS_MOUVEMENT[sens].map(x => `<option>${esc(x)}</option>`).join('')}</select></div>
  ${lot ? `<div class="field"><label for="v4">${entree ? 'Dans quel lot ?' : 'Dans quel lot prendre ?'}</label><select id="v4">${entree ? '<option value="">Nouveau lot</option>' : ''}${lots.map(l => `<option value="${esc(l.id)}">${esc(libLot(l))}</option>`).join('')}</select></div>
    ${entree ? `<div id="zNouv" class="field"><label for="v5">Nom du nouveau lot <small class="sub">(facultatif)</small></label><input id="v5" maxlength="60" placeholder="Ex. : don de mars"></div>
    <div class="field"><label for="v6">Date de péremption <small class="sub">(relevée sur le produit)</small></label><input id="v6" type="date" style="max-width:220px"></div>` : ''}`
    : entree && m.peremption === 'article' ? `<div class="field"><label for="v6">Nouvelle date de péremption relevée <small class="sub">(facultatif)</small></label><input id="v6" type="date" style="max-width:220px">
      <small class="sub">Cet article a une seule date : si elle change, elle remplace l'ancienne pour tout l'article (relevée par vous, aujourd'hui). Pour garder plusieurs dates, passez la réserve en suivi « par lot ».</small></div>` : ''}
  <div class="field"><label for="v7">Précision <small class="sub">(facultatif)</small></label><input id="v7" maxlength="120" placeholder="Ex. : goûter du jeudi"></div>
  ${AVERT}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveV">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  if (lot && entree) {
    const maj = () => { const l = lots.find(x => x.id === $('#v4').value); $('#zNouv').style.display = l ? 'none' : ''; $('#v6').value = l ? l.date : ''; };
    $('#v4').onchange = maj; maj();
  }
  $('#saveV').onclick = async () => {
    const date = $('#v2').value; if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return toast('Indiquez la date.');
    const mv = { sens, quantite: L.lireNombre($('#v1').value), lotId: lot ? $('#v4').value : '', lotLibelle: $('#v5') ? $('#v5').value : '', lotDate: $('#v6') ? $('#v6').value : '' };
    const r = L.appliquerMouvement(m, mv, { par: (S.user && S.user.nom) || '', auj: aujourdhui() }); if (r.erreur) return toast(r.erreur);
    const doc = { materielId: m.id, materielNom: m.nom, date, sens, quantite: Number(mv.quantite), lot: r.lot || '', motif: $('#v3').value, note: $('#v7').value.trim(), apres: r.apres, par: (S.user && S.user.nom) || '', parUid: (S.user && S.user.uid) || '', creeLe: new Date().toISOString() };
    await patienter(store.save('materiel', r.materiel));
    const mid = await store.save('mouvements', doc); journaliser('Créé', 'mouvements', { ...doc, id: mid });
    closeModal(); toast(`${entree ? 'Entrée' : 'Sortie'} enregistrée : il reste ${L.fmtQte(r.apres)} ${m.unite || ''}${r.materiel.bas ? (r.apres === 0 ? ' — stock épuisé : pensez à réapprovisionner.' : ' — stock bas : pensez à réapprovisionner.') : ''}`);
  };
}
async function histoForm(id) {
  const m = S.cache.materiel.find(x => x.id === id); if (!m) return;
  S.matHisto = id; render(); await attendre(() => pret('mouvements', 'm-' + id));
  const rows = S.cache.mouvements.filter(v => v.materielId === id).sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.creeLe || '').localeCompare(a.creeLe || ''));
  const th = 'text-align:left;border-bottom:2px solid var(--prune);padding:5px', td = 'padding:5px;border-bottom:1px solid var(--ligne);vertical-align:top';
  modal(`<h2>Historique — ${esc(m.nom)}</h2><p class="sub">Entrées et sorties de stock, de la plus récente à la plus ancienne.</p>
  ${rows.length ? `<div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr>${['Date', 'Mouvement', 'Lot', 'Motif', 'Reste', 'Par'].map(c => `<th style="${th}">${c}</th>`).join('')}</tr></thead><tbody>
    ${rows.map(v => `<tr><td style="${td}">${esc(fr(v.date))}</td><td style="${td}">${v.sens === 'entree' ? '+' : '−'}${L.fmtQte(v.quantite)} ${esc(m.unite || '')}</td><td style="${td}">${esc(v.lot || '')}</td><td style="${td}">${esc(v.motif || '')}${v.note ? '<br><small>' + esc(v.note) + '</small>' : ''}</td><td style="${td}">${v.apres == null ? '' : L.fmtQte(v.apres)}</td><td style="${td}">${esc(v.par || '')}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="empty"><b>Aucun mouvement enregistré</b>Les entrées et sorties apparaîtront ici.</div>'}
  <div class="quick" style="margin-top:14px"><button class="btn ghost" data-action="close">Fermer</button></div>`);
}

/* ---------- Emprunts : formulaire et retour ---------- */
const typeDe = val => ({ c: 'contact', s: 'personne', u: 'equipe' }[String(val).slice(0, 1)] || 'libre');
async function empForm(id, pre = {}) {
  const e = id ? S.cache.emprunts.find(x => x.id === id) : { materielId: pre.materielId || '', quantite: 1, dateSortie: aujourdhui(), retourPrevu: ajouterJours(aujourdhui(), 7), emprunteur: '', emprunteurType: '', emprunteurId: '', rendu: false };
  if (id && !e) return;
  const admin = peutAdmin();
  // Liste d'emprunteurs : seule l'administratrice lit l'Annuaire, les personnes et l'équipe. Les autres choisissent « moi » ou écrivent le nom (texte libre).
  if (admin && !S.matPersonnes) { S.matPersonnes = true; render(); await attendre(() => pret('seniors') && pret('contacts') && pret('users')); }
  const articles = S.cache.materiel.filter(m => m.type !== 'reserve').sort(parNom), art = id => articles.find(m => m.id === id);
  const valeur = e.emprunteurType === 'contact' ? 'c:' + e.emprunteurId : e.emprunteurType === 'personne' ? 's:' + e.emprunteurId : e.emprunteurType === 'equipe' ? (e.emprunteurId === (S.user && S.user.uid) ? 'me' : 'u:' + e.emprunteurId) : '';
  const items = () => [{ id: 'me', nom: S.user.nom, prenom: '', label: `Moi-même (${S.user.nom})`, sous: 'Équipe', champs: [S.user.nom, 'moi'], dates: [] },
    ...(admin ? [...S.cache.contacts.map(c => ({ ...itemContact(c), id: 'c:' + c.id, sous: [c.categorie, c.service, c.precision].filter(Boolean).join(' · ') })),
      ...S.cache.users.filter(u => u.id !== S.user.uid).map(u => ({ id: 'u:' + u.id, nom: u.nom || u.email, prenom: '', label: u.nom || u.email, sous: u.role === 'partenaire' ? 'Compte partenaire' : 'Équipe', champs: [u.nom, u.email], dates: [] })),
      ...S.cache.seniors.map(s => ({ ...itemPersonne(s), id: 's:' + s.id, sous: ['Personne', itemPersonne(s).sous].filter(Boolean).join(' · ') }))] : [])];
  modal(`<h2>${id ? (e.rendu ? 'Emprunt rendu' : 'Modifier l\'emprunt') : 'Nouvel emprunt'}</h2>
  <div class="field"><label for="m1">Matériel emprunté</label><select id="m1" ${e.rendu ? 'disabled' : ''}><option value="">(choisir)</option>${articles.map(m => `<option value="${esc(m.id)}" ${m.id === e.materielId ? 'selected' : ''}>${esc((m.type === 'caisse' ? 'Caisse n° ' + m.numero + ' — ' : '') + m.nom)}</option>`).join('')}</select>
    <small class="sub" id="m1d"></small></div>
  <div class="two"><div class="field"><label for="m2">Quantité</label><input id="m2" inputmode="numeric" value="${esc(L.fmtQte(e.quantite))}" ${e.rendu ? 'disabled' : ''}></div><div></div></div>
  ${champRecherche({ id: 'm5', label: 'Qui emprunte ? <small class="sub">(personne, service ou structure)</small>', texte: e.emprunteur || '', val: valeur,
    aide: admin ? 'Tapez quelques lettres : Annuaire, équipe ou personnes. Vous pouvez aussi écrire un nom libre (par exemple « Service jeunesse »).' : 'Choisissez « Moi-même » ou écrivez le nom de la personne, du service ou de la structure.',
    items, recents: 'emprunteur', ajout: t => (t ? `+ Écrire « ${t} » tel quel (texte libre)` : null) })}
  <div class="two"><div class="field"><label for="m3">Sorti le</label><input id="m3" type="date" value="${esc(e.dateSortie || '')}" ${e.rendu ? 'disabled' : ''}></div>
    <div class="field"><label for="m4">Retour prévu le</label><input id="m4" type="date" value="${esc(e.retourPrevu || '')}" ${e.rendu ? 'disabled' : ''}></div></div>
  <div class="field"><label for="m6">Commentaire <small class="sub">(facultatif)</small></label><input id="m6" maxlength="200" value="${esc(e.commentaire || '')}" placeholder="Ex. : pour le goûter de Noël"></div>
  ${AVERT}
  ${e.rendu ? `<p class="sub">Rendu le ${esc(fr(e.retourReel))}${e.etatRetour ? ' — ' + esc(L.ETATS_MATERIEL[e.etatRetour] || e.etatRetour) : ''}.</p>` : ''}${e.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(e.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px">${e.rendu ? '' : '<button class="btn" id="saveM">Enregistrer</button>'}<button class="btn ghost" data-action="close">${e.rendu ? 'Fermer' : 'Annuler'}</button>${id && !e.rendu ? '<button class="btn sec" id="retM">Enregistrer le retour</button>' : ''}${id && admin ? '<button class="btn ghost" id="delM" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  const dispo = () => { const m = art($('#m1').value); $('#m1d').textContent = m ? `Disponible : ${L.fmtQte(L.disponible(m, S.cache.emprunts, id || ''))} sur ${L.fmtQte(m.quantite)}.` : ''; };
  $('#m1').onchange = dispo; dispo();
  if (!e.rendu) $('#saveM').onclick = async () => {
    const m = art($('#m1').value), { val, texte } = comboLire('m5');
    if (!texte) return toast('Indiquez qui emprunte : une personne, un service ou une structure.');
    let qui = { type: 'libre', id: '', libelle: texte };
    if (val === 'me') qui = { type: 'equipe', id: S.user.uid, libelle: texte };
    else if (val && val !== NOUVEAU && /^[csu]:/.test(val)) qui = { type: typeDe(val), id: val.slice(2), libelle: texte };
    const doc = { ...(id ? { id } : {}), materielId: m ? m.id : '', materielNom: m ? m.nom : '', quantite: L.lireNombre($('#m2').value), emprunteurType: qui.type, emprunteurId: qui.id, emprunteur: qui.libelle,
      dateSortie: $('#m3').value, retourPrevu: $('#m4').value, retourReel: '', etatRetour: '', rendu: false, commentaire: $('#m6').value.trim(), par: e.par || (S.user && S.user.nom) || '', parUid: e.parUid || (S.user && S.user.uid) || '' };
    const err = L.erreurEmprunt(doc, m, S.cache.emprunts); if (err) return toast(err);
    await sauver('emprunts', doc, 'Emprunt enregistré'); closeModal();
  };
  if (id && !e.rendu) $('#retM').onclick = () => retourForm(id);
  if (id && admin) $('#delM').onclick = () => confirmer('Supprimer cet emprunt ?', `« ${e.materielNom || ''} » (${e.emprunteur || ''}) va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('emprunts', e); await store.remove('emprunts', id); toast('Emprunt mis à la corbeille'); });
}
function retourForm(id) {
  const e = S.cache.emprunts.find(x => x.id === id); if (!e || e.rendu) return;
  const m = S.cache.materiel.find(x => x.id === e.materielId);
  modal(`<h2>Enregistrer le retour</h2><p class="sub"><b>${esc(e.materielNom || '')} × ${L.fmtQte(e.quantite)}</b> — ${esc(e.emprunteur || '')}</p>
  <div class="two"><div class="field"><label for="r1">Quantité rendue</label><input id="r1" inputmode="numeric" value="${esc(L.fmtQte(e.quantite))}"></div>
    <div class="field"><label for="r2">Rendu le</label><input id="r2" type="date" value="${esc(aujourdhui())}"></div></div>
  <small class="sub" style="display:block;margin:-6px 0 10px">Si tout n'est pas rendu, le reste demeure « en cours » (et passera « en retard » si la date est dépassée).</small>
  <div class="field"><label for="r3">État du matériel au retour</label><select id="r3">${optionsEtats('bon')}</select></div>
  ${m ? '<label class="chk" id="r4z" style="margin:0 0 10px;display:none"><input type="checkbox" id="r4"> Mettre aussi à jour l\'état de l\'article dans l\'inventaire</label>' : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveR">Enregistrer le retour</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  if (m) { const maj = () => { const diff = $('#r3').value !== (m.etat || 'bon'); $('#r4z').style.display = diff ? '' : 'none'; $('#r4').checked = diff && $('#r3').value !== 'bon'; }; $('#r3').onchange = maj; maj(); }
  $('#saveR').onclick = async () => {
    const etat = $('#r3').value, res = L.solderEmprunt(e, { quantiteRendue: L.lireNombre($('#r1').value), date: $('#r2').value, etat }); if (res.erreur) return toast(res.erreur);
    await sauver('emprunts', res.clos, 'Retour enregistré');
    if (res.reste) await sauver('emprunts', res.reste);
    if (m && $('#r4') && $('#r4').checked) { const f = L.preparerMateriel({ ...m, etat }, m, { par: (S.user && S.user.nom) || '', auj: aujourdhui() }); await sauver('materiel', f); }
    closeModal();
    if (res.reste) toast(`Retour partiel : ${L.fmtQte(res.reste.quantite)} reste${res.reste.quantite > 1 ? 'nt' : ''} à rendre`);
  };
}

/* ---------- Exports (administratrice) ---------- */
async function donneesExport() {
  const [mat, emp, mou] = [await store.lire('materiel'), await store.lire('emprunts'), await store.lire('mouvements')];
  return { materiel: mat, emprunts: emp, mouvements: mou };
}
const enteteExport = D => [`Matériel du service, état au ${fr(aujourdhui())} (AniMerci, ${P('nomService')}).`, `Contenu : ${D.materiel.length} articles (inventaire, réserves, caisses), ${D.emprunts.length} emprunts, ${D.mouvements.length} mouvements de stock.`,
  'Aucune donnée de santé ni photo dans ce document. Les quantités des réserves « par lot » sont détaillées lot par lot.'];

/* ---------- Actions ---------- */
export const actions = {
  'mat-tab': el => { S.ongletMat = el.dataset.v; S.rechMat = ''; S.fCatMat = ''; S.fEmpMat = ''; S.fSaisonMat = ''; S.fSigMat = false; render(); },
  'mat-form': el => matForm(el.dataset.id, el.dataset.type),
  'mat-mvt': el => mvtForm(el.dataset.id, el.dataset.sens),
  'mat-histo': el => histoForm(el.dataset.id),
  'emp-form': el => empForm(el.dataset.id),
  'emp-retour': el => retourForm(el.dataset.id),
  'mat-femprunt': el => { S.fEmprunt = el.dataset.v; render(); },
  'mat-xlsx': async () => { if (!peutAdmin()) return; const D = await patienter(donneesExport()), auj = aujourdhui(); telecharger(`materiel-${auj}.xlsx`, classeur(L.tableauxMateriel(D, auj), enteteExport(D)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'mat-pdf': async () => { if (!peutAdmin()) return; const D = await patienter(donneesExport()), auj = aujourdhui(); imprimer(documentHtml(L.tableauxMateriel(D, auj), enteteExport(D), `Matériel — ${fr(auj)}`)); }
};
export const changes = {
  'mat-fcat': el => { S.fCatMat = el.value; render(); },
  'mat-femp': el => { S.fEmpMat = el.value; render(); },
  'mat-fsaison': el => { S.fSaisonMat = el.value; render(); },
  'mat-fsig': el => { S.fSigMat = el.checked; render(); },
  'mat-an': el => { S.anMat = el.value; render(); }
};
