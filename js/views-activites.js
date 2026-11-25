// Écrans : activités, inscriptions, rotation, appel (présences), fiches de sortie.
import * as L from './logic.js';
import { store } from './store.js';
import { champListe, lireChamp } from './annuaire.js';
import { champRecherche, itemPersonne, itemActivite, AIDE_PERSONNE } from './recherche.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, dateLongue, go, render, toast, modal, closeModal, confirmer, copier, sauver, mettreCorbeille, seniorDe, actDe, validees, peutAdmin } from './ui.js';
import { ficheId, classeCat } from './views-core.js';
import { emargementBouton } from './securite.js';
import { P } from './parametres.js';

const RETENUS = ['inscrit', 'invite'];

const inscriptionsDe = id => S.cache.inscriptions.filter(i => i.activiteId === id);
const retenusDe = id => inscriptionsDe(id).filter(i => RETENUS.includes(i.statut));
const mesActivites = () => peutAdmin() ? S.cache.activites : S.cache.activites.filter(a => (S.user.activites || []).includes(a.id));

// Aucune personne du tout rattachée à l'activité (ni intervenant·e, ni partenaire, ni bénévole référent·e, ni autres bénévoles)
const sansRattachement = a => !a.interv && !a.partenaire && !a.benevole && !(a.autresBenevoles && a.autresBenevoles.trim());
// Qui est rattaché·e, pour l'afficher directement sur la carte sans ouvrir la fiche : intervenant·e, puis partenaire, puis bénévole référent·e (avec « +N » s'il y en a plusieurs) ; à défaut, le premier nom des autres bénévoles ; sinon un repère « À rattacher ».
function quiActivite(a) {
  const noms = [a.interv, a.partenaire, a.benevole].filter(Boolean);
  if (noms.length) return `<div class="meta qui">${esc(noms[0])}${noms.length > 1 ? ` <span class="sub">+${noms.length - 1}</span>` : ''}</div>`;
  const premier = a.autresBenevoles && a.autresBenevoles.split(',').map(s => s.trim()).filter(Boolean)[0];
  if (premier) return `<div class="meta qui">${esc(premier)}</div>`;
  return `<div class="meta qui"><span class="pill p-warn">À rattacher</span></div>`;
}

/* ============ LISTE ============ */
// Une carte par activité (places prises côté serveur pour l'administratrice ; inscriptions déjà chargées pour l'intervenant·e)
function carteActivite(a, admin) {
  const cp = admin ? (S.compteurs[a.id] || { r: 0, att: 0 }) : null, enCours = admin && !S.compteurs[a.id];
  const r = cp ? cp.r : retenusDe(a.id).length, att = cp ? cp.att : inscriptionsDe(a.id).filter(i => i.statut === 'attente').length, full = r >= a.cap, pct = Math.min(100, Math.round(r / a.cap * 100));
  return `<button class="act" data-action="open-act" data-id="${a.id}">
    <div style="display:flex;gap:12px;align-items:center"><span class="cat ${classeCat(a.cat)}">${esc((a.cat || '?')[0])}</span><div><h3>${esc(a.nom)}</h3><div class="meta">${esc(a.jour || '')}${a.date ? ' · ' + L.fmtDate(a.date) : ''}${a.frequence ? `<br>${esc(a.frequence)}` : ''}</div>${quiActivite(a)}</div></div>
    <div class="bar ${full ? 'full' : ''}"><i style="width:${pct}%"></i></div>
    <div style="display:flex;justify-content:space-between;align-items:center"><span><b>${enCours ? '…' : r}</b> / ${a.cap} places</span>
    ${enCours ? '' : att ? `<span class="pill p-warn">${att} en attente</span>` : full ? '<span class="pill p-crit">Complet</span>' : `<span class="pill p-ok">${a.cap - r} libres</span>`}</div></button>`;
}
// Regroupement visuel par catégorie, catégories triées par ordre alphabétique (accents français) ; sans catégorie (ou catégorie inconnue) : « Autres », toujours en dernier.
// À l'intérieur de chaque catégorie, les activités sont elles aussi triées par ordre alphabétique de leur nom.
function groupesParCategorie(rows) {
  const connues = new Set(P('listes.categories') || []);
  const groupes = new Map(), autres = [];
  for (const a of rows) {
    if (a.cat && connues.has(a.cat)) { if (!groupes.has(a.cat)) groupes.set(a.cat, []); groupes.get(a.cat).push(a); }
    else autres.push(a);
  }
  const cles = [...groupes.keys()].sort(L.comparerTexte);
  const blocs = cles.map(c => [c, groupes.get(c).slice().sort((x, y) => L.comparerTexte(x.nom, y.nom))]);
  if (autres.length) blocs.push(['Autres', autres.slice().sort((x, y) => L.comparerTexte(x.nom, y.nom))]);
  return blocs;
}
export function activites() {
  const admin = peutAdmin();
  const rows = mesActivites();
  const manquants = admin ? rows.filter(sansRattachement) : [];
  const visibles = (admin && S.filtreSansRattachement) ? manquants : rows;
  const blocs = groupesParCategorie(visibles);
  return `<div class="top"><div><h1>${admin ? 'Activités' : 'Mes activités'}</h1><p>Touchez une activité pour gérer les inscriptions et faire l'appel.</p></div>
    ${admin ? '<button class="btn" data-action="act-form">+ Nouvelle activité</button><button class="btn sec" data-action="importer" data-cible="activites">Importer une liste</button>' : ''}</div>
  ${rows.length ? champRecherche({ id: 'rech-act', label: 'Chercher une activité', texte: '', aide: 'Tapez un nom, un jour ou un horaire ; choisissez une suggestion (clic ou touche Entrée) pour ouvrir la fiche.', mode: 'action', recents: 'activites', placeholder: 'Chercher une activité (nom, jour, horaire…)…',
    items: () => rows.map(itemActivite), onChoose: o => { if (o) { const el = $('#rech-act'); if (el) el.value = ''; go('activite', { actId: o.id }); } } }) : ''}
  ${admin && rows.length ? `<div class="filters"><button data-action="filtre-rattachement" aria-pressed="${!!S.filtreSansRattachement}">Sans personne rattachée${manquants.length ? ` (${manquants.length})` : ''}</button></div>` : ''}
  ${visibles.length ? blocs.map(([cat, liste]) => `<h2 class="cat-titre" style="margin:18px 0 8px">${esc(cat)}</h2><div class="grid acts">${liste.map(a => carteActivite(a, admin)).join('')}</div>`).join('')
    : `<div class="card"><div class="empty"><b>${S.filtreSansRattachement ? 'Aucune activité sans personne rattachée' : 'Aucune activité'}</b>${S.filtreSansRattachement ? 'Toutes les activités ont au moins une personne rattachée.' : admin ? 'Créez la première avec le bouton en haut.' : 'Aucune activité ne vous est attribuée pour le moment.'}</div></div>`}`;
}

// modele : activité à copier (sans ses inscriptions ni ses appels) ; la date est à saisir de nouveau
function actForm(id, modele) {
  const a = id ? actDe(id) : modele ? { ...modele, nom: (modele.nom || '') + ' (copie)', date: '' } : { cat: 'Mémoire', type: 'activite', cap: 15, budget: P('listes.budgets')[0] };
  modal(`<h2>${id ? 'Modifier l\'activité' : modele ? 'Dupliquer l\'activité' : 'Nouvelle activité'}</h2>${modele ? '<p class="sub">Les réglages sont repris ; les inscriptions et les appels ne le sont pas. Pensez à saisir la nouvelle date.</p>' : ''}
  <div class="field"><label for="g1">Nom</label><input id="g1" value="${esc(a.nom || '')}"></div>
  <div class="two"><div class="field"><label for="g2">Catégorie</label><input id="g2" list="catl" value="${esc(a.cat || '')}"><datalist id="catl">${P('listes.categories').map(c => `<option value="${c}">`).join('')}</datalist></div>
  <div class="field"><label for="g3">Type</label><select id="g3">${[['activite', 'Activité régulière'], ['sortie', 'Sortie ou voyage (avec fiches de sortie)'], ['evenement', 'Événement']].map(([k, l]) => `<option value="${k}" ${a.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
  <div class="two"><div class="field"><label for="g4">Prochaine date</label><input id="g4" type="date" value="${esc(a.date || '')}"></div>
  <div class="field"><label for="g5">Jour et horaire</label><input id="g5" value="${esc(a.jour || '')}" placeholder="Mardis · 10h"></div></div>
  <div class="field"><label for="g12">Fréquence <small class="sub">(facultatif : choisissez ou écrivez, ex. « Toutes les semaines, hors vacances scolaires »)</small></label><input id="g12" list="frql" value="${esc(a.frequence || '')}" autocomplete="off"><datalist id="frql">${L.FREQUENCES_ACTIVITE.map(f => `<option value="${f}">`).join('')}</datalist></div>
  <div class="two"><div class="field"><label for="g6">Lieu</label><input id="g6" value="${esc(a.lieu || '')}"></div>
  <div class="field"><label for="g7">Nombre de places</label><input id="g7" type="number" min="1" value="${esc(a.cap)}"></div></div>
  <div class="two">${champListe('g8', 'activiteIntervenant', a.interv, a.intervId)}
  <div class="field"><label for="g9">Budget</label><select id="g9">${P('listes.budgets').map(b => `<option ${a.budget === b ? 'selected' : ''}>${b}</option>`).join('')}</select></div></div>
  <div class="two">${champListe('g10', 'activitePartenaire', a.partenaire, a.partenaireId)}${champListe('g11', 'activiteBenevole', a.benevole, a.benevoleId)}</div>
  <div class="field"><label for="g13">Autres bénévoles <small class="sub">(noms séparés par des virgules ; le·la bénévole référent·e se choisit ci-dessus)</small></label><input id="g13" value="${esc(a.autresBenevoles || '')}" autocomplete="off"></div>
  <div class="field"><label for="g14">Description</label><textarea id="g14" rows="3">${esc(a.description || '')}</textarea></div>
  <div class="two"><div class="field"><label for="g15">Public concerné</label><input id="g15" value="${esc(a.publicCible || '')}" placeholder="Ex. résident·es et adhérent·es" autocomplete="off"></div>
  <div class="field"><label for="g16">Coût pour les participant·es</label><input id="g16" value="${esc(a.cout || '')}" placeholder="Gratuit, 2 € par personne…" autocomplete="off"></div></div>
  <div class="two"><div class="field"><label for="g17">Matériel nécessaire</label><input id="g17" value="${esc(a.materiel || '')}" autocomplete="off"></div>
  <div class="field"><label for="g18">Modalités d'inscription</label><input id="g18" value="${esc(a.modalites || '')}" placeholder="Ex. à l'accueil, avant jeudi" autocomplete="off"></div></div>
  <div id="blocEv" style="display:none"><div class="field"><label for="g19">Accompagnants et personnel présent <small class="sub">(jour J)</small></label><input id="g19" value="${esc(a.accompagnants || '')}" autocomplete="off"></div>
  <div class="field"><label for="g20">Déroulé du jour J</label><textarea id="g20" rows="4" placeholder="Ex. 9 h installation · 10 h accueil · 12 h repas…">${esc(a.deroule || '')}</textarea></div></div>
  <div class="quick" style="margin-top:14px"><button class="btn" id="saveAct">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id ? '<button class="btn ghost" id="delAct" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  const majType = () => { $('#blocEv').style.display = ['evenement', 'sortie'].includes($('#g3').value) ? 'block' : 'none'; };
  $('#g3').onchange = majType; majType();
  $('#saveAct').onclick = async () => {
    const nom = $('#g1').value.trim(); if (!nom) return toast('Donnez un nom à l\'activité.');
    const cap = Math.max(1, Number($('#g7').value) || 1);
    const ri = await lireChamp('g8', 'activiteIntervenant'); if (!ri) return;
    const rp = await lireChamp('g10', 'activitePartenaire'); if (!rp) return;
    const rb = await lireChamp('g11', 'activiteBenevole'); if (!rb) return;
    const li = { ...ri, ...rp, ...rb };
    const nid = await sauver('activites', { ...(id ? { id } : {}), nom, cat: $('#g2').value.trim() || 'Autre', type: $('#g3').value, date: $('#g4').value, jour: $('#g5').value.trim(), frequence: $('#g12').value.trim(), lieu: $('#g6').value.trim(), cap, ...li, budget: $('#g9').value,
      autresBenevoles: $('#g13').value.trim(), description: $('#g14').value.trim(), publicCible: $('#g15').value.trim(), cout: $('#g16').value.trim(), materiel: $('#g17').value.trim(), modalites: $('#g18').value.trim(), accompagnants: $('#g19').value.trim(), deroule: $('#g20').value.trim() }, 'Activité enregistrée');
    closeModal(); if (!id) go('activite', { actId: nid });
  };
  if (id) $('#delAct').onclick = () => confirmer('Supprimer cette activité ?', 'Ses inscriptions, séances et fiches de sortie seront supprimées aussi.', 'Supprimer', async () => {
    // lecture directe de la base : les listes affichées peuvent être incomplètes (chargement à la demande)
    const liens = {}; for (const col of ['inscriptions', 'seances', 'fiches']) liens[col] = await store.lire(col, ['activiteId', '==', id]);
    await mettreCorbeille('activites', actDe(id), { inscriptions: liens.inscriptions, seances: liens.seances });
    for (const col of ['inscriptions', 'seances', 'fiches']) for (const r of liens[col]) await store.remove(col, r.id);
    await store.remove('activites', id); toast(`Activité mise à la corbeille (récupérable ${P('securite.joursCorbeille')} jours)`); go('activites');
  });
}

/* ============ DÉTAIL ============ */
// Détails facultatifs de la fiche d'activité (description, public, coût, matériel, modalités, bénévoles, jour J)
function blocDetails(a) {
  const ev = ['evenement', 'sortie'].includes(a.type);
  const L1 = [['Description', a.description], ['Public concerné', a.publicCible], ['Coût', a.cout], ['Matériel nécessaire', a.materiel], ['Modalités d\'inscription', a.modalites], ['Autres bénévoles', a.autresBenevoles], ...(ev ? [['Accompagnants et personnel présent', a.accompagnants], ['Déroulé du jour J', a.deroule]] : [])].filter(([, v]) => v);
  return L1.length ? `<div class="card detail" style="margin-bottom:16px"><dl style="margin:0">${L1.map(([k, v]) => `<dt>${esc(k)}</dt><dd style="white-space:pre-line">${esc(v)}</dd>`).join('')}</dl></div>` : '';
}
export function activite() {
  const a = actDe(S.actId);
  if (!a) return `<button class="back" data-action="nav" data-v="activites">← Activités</button><div class="card"><div class="empty"><b>Activité introuvable</b></div></div>`;
  if (peutAdmin() && !pret('inscriptions', a.id)) return chargement(esc(a.nom));
  if (S.appel) return appel(a);
  const admin = peutAdmin();
  const tabs = [['inscriptions', 'Inscriptions'], ['seances', 'Appels'], ...(a.type === 'sortie' && admin ? [['fiches', 'Fiches de sortie']] : [])].filter(([k]) => admin || k === 'seances');
  if (!tabs.find(([k]) => k === S.tab)) S.tab = tabs[0][0];
  const corps = S.tab === 'inscriptions' ? tabInscriptions(a) : S.tab === 'seances' ? tabSeances(a) : tabFiches(a);
  return `<button class="back" data-action="nav" data-v="activites">← Toutes les activités</button>
  <div class="top"><div><h1>${esc(a.nom)}</h1><p>${esc(a.jour || '')}${a.date ? ' · ' + esc(dateLongue(a.date)) : ''}${a.lieu ? ' · ' + esc(a.lieu) : ''}${a.frequence ? ' · ' + esc(a.frequence) : ''}</p>
    ${a.interv || a.partenaire || a.benevole ? `<p class="sub">${[a.interv && 'Intervenant·e : ' + a.interv, a.partenaire && 'Partenaire : ' + a.partenaire, a.benevole && 'Bénévole : ' + a.benevole].filter(Boolean).map(esc).join(' · ')}</p>` : ''}</div>
    ${admin ? '<button class="btn sec" data-action="act-form" data-id="' + a.id + '">Modifier</button><button class="btn ghost" data-action="act-dupliquer" data-id="' + a.id + '">Dupliquer</button>' + (['evenement', 'sortie'].includes(a.type) ? '<button class="btn blue" data-action="jour-j">Fiche du jour J</button>' : '') : ''}</div>
  ${blocDetails(a)}
  <div class="tabs">${tabs.map(([k, l]) => `<button data-action="tab" data-v="${k}" aria-pressed="${S.tab === k}">${l}</button>`).join('')}</div>${corps}`;
}

/* ---- Inscriptions et rotation ---- */
// Repères de public : statut + « Cotisation à régler » (jamais pour un·e résident·e)
const repereStatut = st => st ? `<span class="pill ${st === 'resident' ? 'p-bleu' : 'p-rose'}">${L.libelleStatut(st)}</span>` : '';
const repereCotis = sn => sn && L.cotisationARegler(sn) ? '<span class="pill p-warn">Cotisation à régler</span>' : '';
function candidats(a) {
  const hist = validees();
  return inscriptionsDe(a.id).map(i => {
    const s = seniorDe(i.seniorId) || {};
    return { id: i.id, seniorId: i.seniorId, nom: i.seniorNom, statutIns: i.statut, statut: s.statut, cotis: L.cotisationARegler(s.id ? s : null), dateDemande: i.dateDemande, h: L.historique(i.seniorId, a.id, hist) };
  });
}
function tabInscriptions(a) {
  const tous = inscriptionsDe(a.id), r = tous.filter(i => RETENUS.includes(i.statut)).length, att = tous.filter(i => i.statut === 'attente').length;
  const rotation = tous.length > a.cap;
  const classes = L.classerCandidats(candidats(a), S.rules);
  const ligne = (c, rang) => {
    const retenu = RETENUS.includes(c.statutIns);
    return `<div style="display:flex;align-items:flex-start;gap:4px"><button class="cand" style="flex:1;min-width:0" data-action="toggle-ins" data-id="${c.id}" aria-pressed="${retenu}">
      <span class="rank">${rang}</span><span class="av">${esc(initiales(c.nom))}</span>
      <span style="flex:1"><b>${esc(c.nom)}</b><span class="why">${repereStatut(c.statut)}${c.cotis ? '<span class="pill p-warn">Cotisation à régler</span>' : ''}${L.raisons(c).filter(x => x !== 'Résident·e').map(x => `<span class="pill ${x.startsWith('Première') ? 'p-ok' : x.includes('absence') || x.includes('désist') ? 'p-warn' : 'p-rose'}">${esc(x)}</span>`).join('')}</span></span>
      <span class="pill ${retenu ? 'p-ok' : 'p-rose'}">${retenu ? 'Retenu·e' : 'En attente'}</span></button><button class="iconbtn" style="margin-top:6px" data-action="del-ins" data-id="${c.id}" aria-label="Retirer ${esc(c.nom)}">✕</button></div>`;
  };
  const sn = i => seniorDe(i.seniorId) || null;
  const simple = tous.map(i => ({ i, sn: sn(i) })).sort((x, y) => L.rangStatut(x.sn && x.sn.statut) - L.rangStatut(y.sn && y.sn.statut));
  const nbRes = tous.filter(i => RETENUS.includes(i.statut) && sn(i) && sn(i).statut === 'resident').length;
  const nbAdh = tous.filter(i => RETENUS.includes(i.statut) && sn(i) && sn(i).statut === 'adherent').length;
  const nbCot = tous.filter(i => RETENUS.includes(i.statut) && L.cotisationARegler(sn(i))).length;
  return `<div class="card">
    <div class="stat-row"><span class="lab">Places prises</span><div class="bar ${r >= a.cap ? 'full' : ''}"><i style="width:${Math.min(100, r / a.cap * 100)}%"></i></div><span class="v">${r}/${a.cap}</span></div>
    ${r ? `<p class="sub" style="margin:8px 0 0">${nbRes} résident·e${nbRes > 1 ? 's' : ''} · ${nbAdh} adhérent·e${nbAdh > 1 ? 's' : ''}${r - nbRes - nbAdh ? ` · ${r - nbRes - nbAdh} autre${r - nbRes - nbAdh > 1 ? 's' : ''}` : ''}${nbCot ? ` · <b>${nbCot} cotisation${nbCot > 1 ? 's' : ''} à régler</b>` : ''}</p>` : ''}
    <div class="quick" style="margin-top:12px"><button class="btn" data-action="ins-form">+ Inscrire quelqu'un</button>
    ${rotation ? '<button class="btn blue" data-action="proposer">Proposer la liste</button>' : ''}
    ${r ? '<button class="btn sec" data-action="copier-retenus">Copier la liste des retenus</button><button class="btn sec" data-action="confirmations">Confirmations d\'inscription</button>' : ''}${r ? emargementBouton() : ''}</div>
    ${placeLibre(a, tous, r)}
    ${rotation ? `<h2 style="margin-top:20px">Rotation : ${tous.length} demandes pour ${a.cap} places</h2>
    <p class="sub" style="margin:0">Choisissez vos règles puis demandez une proposition. Touchez ensuite un nom pour le retenir ou le remettre en attente : la décision reste la vôtre.</p>
    <div class="rules"><label class="chk"><input type="checkbox" data-change="regle" data-r="moins" ${S.rules.moins ? 'checked' : ''}> Ceux qui ont le moins participé</label>
    <label class="chk"><input type="checkbox" data-change="regle" data-r="abs" ${S.rules.abs ? 'checked' : ''}> Tenir compte des absences non excusées</label>
    <label class="chk"><input type="checkbox" data-change="regle" data-r="res" ${S.rules.res ? 'checked' : ''}> Résident·es en priorité</label></div>
    ${classes.map((c, k) => ligne(c, k + 1)).join('')}`
    : tous.length ? `<div style="margin-top:14px">${simple.map(({ i, sn }) => `<div class="row"><span class="av" style="width:38px;height:38px;border-radius:50%;background:var(--rose);color:var(--prune);display:grid;place-items:center;font-weight:800">${esc(initiales(i.seniorNom))}</span>
      <div class="grow"><b>${esc(i.seniorNom)}</b> ${repereStatut(sn && sn.statut)}${repereCotis(sn)}<small>Demande du ${esc(L.fmtDate(i.dateDemande))}${i.source ? ' · ' + esc(i.source) : ''}</small></div>
      <span class="pill ${RETENUS.includes(i.statut) ? 'p-ok' : 'p-rose'}">${RETENUS.includes(i.statut) ? 'Inscrit·e' : 'En attente'}</span>
      <button class="iconbtn" data-action="del-ins" data-id="${i.id}" aria-label="Retirer ${esc(i.seniorNom)}">✕</button></div>`).join('')}</div>`
    : '<div class="empty"><b>Personne n\'est encore inscrit·e</b>Ajoutez la première inscription avec le bouton ci-dessus.</div>'}
    ${att && !rotation && r >= a.cap ? `<p class="note">${att} personne${att > 1 ? 's' : ''} en attente : quand une place se libère, l'outil vous propose de la redonner à la première de la liste.</p>` : ''}
  </div>`;
}
const quand = a => [a.date ? dateLongue(a.date) : '', a.jour ? a.jour.split('·').pop().trim() : ''].filter(Boolean).join(' · ');
const premiereAttente = tous => tous.filter(i => i.statut === 'attente').sort((x, y) => (x.dateDemande || '').localeCompare(y.dateDemande || ''))[0];
// Une place est libre et des personnes attendent : proposition à la première (la plus ancienne demande)
function placeLibre(a, tous, r) {
  // en mode rotation (plus de demandes que de places), l'alerte n'apparaît qu'une fois la liste proposée (au moins une personne retenue)
  const p = tous.length > a.cap && !r ? null : premiereAttente(tous);
  if (!p || r >= a.cap) return '';
  const sn = seniorDe(p.seniorId);
  return `<div class="alerte-place" role="status" style="margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--warn-bg);border:1px solid #e0b060"><b>${a.cap - r === 1 ? 'Une place est libre' : (a.cap - r) + ' places sont libres'}.</b>
    <div>Première personne en attente : <b>${esc(p.seniorNom)}</b>${sn && sn.tel ? ' · ' + esc(sn.tel) : ''} (demande du ${esc(L.fmtDate(p.dateDemande))}).</div>
    <div class="quick" style="margin-top:8px"><button class="btn" data-action="donner-place" data-id="${p.id}">Lui donner la place</button><button class="btn sec" data-action="copier-proposition" data-id="${p.id}">Copier le message de proposition</button></div></div>`;
}
// Confirmations d'inscription : un message prêt à copier pour chaque personne retenue, et la date où elle a été confirmée
function confirmationsModal() {
  const a = actDe(S.actId), faites = new Map();
  const dessiner = () => {
    const rows = retenusDe(a.id).sort((x, y) => x.seniorNom.localeCompare(y.seniorNom, 'fr'));
    modal(`<h2>Confirmations d'inscription</h2><p class="sub">${esc(a.nom)}. Copiez le message pour l'envoyer ou le lire par téléphone, puis marquez la personne comme prévenue.</p>
    ${rows.map(i => { const sn = seniorDe(i.seniorId), le = faites.get(i.id) || i.confirmeLe; return `<div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow" style="min-width:150px"><b>${esc(i.seniorNom)}</b><small>${sn && sn.tel ? esc(sn.tel) : 'Pas de téléphone'}</small></div>
      ${le ? `<span class="pill p-ok">Prévenue le ${esc(L.fmtDate(le))}</span>` : '<span class="pill p-warn">Pas encore prévenue</span>'}
      <button class="btn sec sm" data-conf="copier" data-id="${i.id}">Copier le message</button>${le ? '' : `<button class="btn sm" data-conf="fait" data-id="${i.id}">Marquer prévenue</button>`}</div>`; }).join('') || '<div class="empty"><b>Personne n\'est retenu·e</b></div>'}
    <div class="quick" style="margin-top:14px"><button class="btn ghost" data-action="close">Fermer</button></div>`);
    document.querySelectorAll('[data-conf]').forEach(b => { b.onclick = async () => {
      const i = rows.find(x => x.id === b.dataset.id); if (!i) return; const sn = seniorDe(i.seniorId);
      if (b.dataset.conf === 'copier') return copier(L.texteConfirmation({ prenom: sn && sn.prenom, activite: a.nom, quand: quand(a), lieu: a.lieu, cout: a.cout, modalites: a.modalites, signature: P('nomService') }), 'Message copié');
      await sauver('inscriptions', { ...i, confirmeLe: aujourdhui() }, 'Confirmation notée'); faites.set(i.id, aujourdhui()); dessiner();
    }; });
  };
  dessiner();
}
async function insForm() {
  const a = actDe(S.actId), deja = new Set(inscriptionsDe(a.id).map(i => i.seniorId)), choisis = new Map();
  if (!S.cache.seniors.some(s => !deja.has(s.id))) return toast('Toutes les personnes enregistrées sont déjà inscrites. Ajoutez d\'abord une nouvelle personne.');
  const reste = a.cap - retenusDe(a.id).length;
  modal(`<h2>Inscrire à « ${esc(a.nom)} »</h2>
  ${champRecherche({ id: 'i1', label: 'Personnes à inscrire', aide: AIDE_PERSONNE + ' Vous pouvez en ajouter plusieurs à la suite.', mode: 'action', recents: 'seniors', placeholder: 'Tapez un nom, un prénom, une date de naissance…',
    items: () => S.cache.seniors.filter(s => !deja.has(s.id) && !choisis.has(s.id)).map(itemPersonne),
    onChoose: o => { if (o) { choisis.set(o.id, seniorDe(o.id)); maj(); } } })}
  <div class="chips" id="i-chips" aria-live="polite"></div>
  <div class="field"><label for="i2">Demande reçue par</label><select id="i2">${['Téléphone', 'Bulletin papier', 'Accueil de la mairie', 'Sur place', 'Portail en ligne'].map(x => `<option>${x}</option>`).join('')}</select></div>
  <p class="sub" id="i-info"></p>
  <div class="quick" style="margin-top:14px"><button class="btn" id="saveIns">Inscrire</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  function maj() {
    const n = choisis.size;
    $('#i-chips').innerHTML = [...choisis.values()].sort((x, y) => L.comparerPatronyme(x, y)).map(s => `<span class="chip">${esc(L.nomAffiche(s))}<button type="button" data-ret="${esc(s.id)}" aria-label="Retirer ${esc(L.nomAffiche(s))}">✕</button></span>`).join('');
    $('#i-chips').querySelectorAll('[data-ret]').forEach(b => { b.onclick = () => { choisis.delete(b.dataset.ret); maj(); }; });
    $('#saveIns').textContent = n > 1 ? `Inscrire ces ${n} personnes` : 'Inscrire';
    $('#i-info').textContent = reste <= 0 ? 'L\'activité est complète : les personnes seront mises en liste d\'attente.' : n > reste ? `Il reste ${reste} place${reste > 1 ? 's' : ''} : les ${reste} premières personnes seront inscrites, les autres en liste d'attente.` : `Il reste ${reste} place${reste > 1 ? 's' : ''}.`;
  }
  maj();
  $('#saveIns').onclick = async () => {
    if (!choisis.size) return toast('Cherchez puis choisissez au moins une personne.');
    let pris = retenusDe(a.id).length, nbAtt = 0;
    for (const s of [...choisis.values()].sort(L.comparerPatronyme)) {
      const plein = pris >= a.cap; if (plein) nbAtt++; else pris++;
      await sauver('inscriptions', { activiteId: a.id, seniorId: s.id, seniorNom: L.nomSenior(s, S.cache.seniors), statut: plein ? 'attente' : 'inscrit', dateDemande: aujourdhui(), source: $('#i2').value });
    }
    closeModal(); toast(`${choisis.size} inscription${choisis.size > 1 ? 's' : ''} enregistrée${choisis.size > 1 ? 's' : ''}${nbAtt ? ` (dont ${nbAtt} en liste d'attente)` : ''}`);
  };
}
async function proposer() {
  const a = actDe(S.actId), classes = L.classerCandidats(candidats(a), S.rules);
  for (let k = 0; k < classes.length; k++) {
    const voulu = k < a.cap ? 'invite' : 'attente';
    if (classes[k].statutIns !== voulu) await store.save('inscriptions', { id: classes[k].id, statut: voulu });
  }
  toast(`Liste proposée : ${Math.min(a.cap, classes.length)} personnes retenues. Vous pouvez la modifier.`);
}
async function toggleIns(el) {
  const a = actDe(S.actId), i = S.cache.inscriptions.find(x => x.id === el.dataset.id); if (!i) return;
  if (RETENUS.includes(i.statut)) return store.save('inscriptions', { id: i.id, statut: 'attente' });
  if (retenusDe(a.id).length >= a.cap) return toast(`Les ${a.cap} places sont prises : remettez d'abord quelqu'un en attente.`);
  return store.save('inscriptions', { id: i.id, statut: 'invite' });
}

/* ---- Appels (présences) ---- */
function tabSeances(a) {
  const rows = S.cache.seances.filter(s => s.activiteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  return `<div class="card"><div class="quick"><button class="btn" data-action="nouvel-appel">Faire l'appel</button>${emargementBouton()}</div>
  ${rows.length ? rows.map(s => { const v = Object.values(s.presences || {}); return `<button class="row" style="width:100%;background:none;border:0;border-top:1px solid var(--ligne);text-align:left" data-action="ouvrir-appel" data-id="${s.id}">
    <div class="grow"><b>${esc(dateLongue(s.date))}</b><small>${s.remplacant ? 'Remplacé·e par ' + esc(s.remplacant) + ' — ' : ''}${infoSaisie(s) ? infoSaisie(s) + ' — ' : ''}${v.filter(x => x === 'p').length} présent·es · ${v.filter(x => x === 'a').length} absent·es · ${v.filter(x => x === 'j').length} excusé·es · ${v.filter(x => x === 'd').length} désisté·es</small></div>
    <span class="pill ${s.valide ? 'p-ok' : 'p-warn'}">${s.valide ? 'Validé' : 'À valider'}</span></button>`; }).join('') : '<div class="empty"><b>Aucun appel</b>Faites le premier appel avec le bouton ci-dessus.</div>'}</div>`;
}
const frH = iso => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); };
// Qui a saisi / corrigé un appel (l'administratrice voit ainsi ce que les intervenants ont fait et ce qu'elle a repris)
const infoSaisie = s => s ? [s.saisiPar ? `Saisi par ${esc(s.saisiPar)} (${frH(s.saisiLe)})` : '', s.modifiePar && s.modifiePar !== s.saisiPar ? `corrigé par ${esc(s.modifiePar)} (${frH(s.modifieLe)})` : ''].filter(Boolean).join(' · ') : '';
function appel(a) {
  const ap = S.appel, roster = retenusDe(a.id).sort((x, y) => x.seniorNom.localeCompare(y.seniorNom, 'fr'));
  const n = x => Object.values(ap.presences).filter(v => v === x).length;
  const seg = (sid, c, l, cls) => `<button class="s-${cls}" data-action="pres" data-sid="${sid}" data-v="${c}" aria-pressed="${ap.presences[sid] === c}">${l}</button>`;
  const admin = peutAdmin(), valide = ap.valide;
  const sc = ap.seanceId ? S.cache.seances.find(x => x.id === ap.seanceId) : null, info = infoSaisie(sc);
  return `<button class="back" data-action="fin-appel">← ${esc(a.nom)}</button>${info ? `<p class="sub" style="margin:0 0 8px">${info}</p>` : ''}
  <div class="top"><div><h1>Faire l'appel</h1><p>${esc(a.nom)}</p></div><div class="field" style="margin:0"><label for="ap-date">Date de la séance</label><input id="ap-date" type="date" value="${esc(ap.date)}" data-change="appel-date"></div></div>
  <div class="field" style="max-width:520px"><label for="ap-remp">Intervenant·e remplaçant·e <small class="sub">(facultatif : à remplir si l'intervenant·e habituel·le est absent·e)</small></label><input id="ap-remp" value="${esc(ap.remplacant || '')}" autocomplete="off"></div>
  <div class="card">${roster.length ? roster.map(i => `<div class="row"><span class="av" style="width:38px;height:38px;border-radius:50%;background:var(--rose);color:var(--prune);display:grid;place-items:center;font-weight:800;flex:none">${esc(initiales(i.seniorNom))}</span>
    <div class="grow"><b>${esc(i.seniorNom)}</b></div>
    <div class="seg">${seg(i.seniorId, 'p', 'Présent·e', 'p')}${seg(i.seniorId, 'a', 'Absent·e', 'a')}${seg(i.seniorId, 'j', 'Excusé·e', 'j')}${seg(i.seniorId, 'd', 'Désisté·e', 'd')}</div></div>`).join('')
    : '<div class="empty"><b>Aucune personne retenue</b>Inscrivez des personnes avant de faire l\'appel.</div>'}
  <div class="counter"><span class="pill p-ok">${n('p')} présent·es</span><span class="pill p-crit">${n('a')} absent·es</span><span class="pill p-warn">${n('j')} excusé·es</span><span class="pill p-rose">${n('d')} désisté·es</span><span style="flex:1"></span>
    ${valide ? '<span class="pill p-ok">Appel validé</span>' : ''}
    <button class="btn ${admin ? 'sec' : ''}" data-action="save-appel" data-valide="0">Enregistrer</button>
    ${admin && !valide ? '<button class="btn" data-action="save-appel" data-valide="1">Enregistrer et valider</button>' : ''}
    ${admin && valide ? '<button class="btn ghost" data-action="rouvrir-appel">Rouvrir l\'appel (annuler la validation)</button>' : ''}</div></div>
  <p class="note">Inscription, présence réelle, absence et désistement sont comptés séparément pour que les bilans soient justes. Seuls les appels validés entrent dans les bilans.</p>`;
}
async function saveAppel(el) {
  const a = actDe(S.actId), ap = S.appel, valide = el.dataset.valide === '1' || (ap.valide && peutAdmin());
  const remp = ($('#ap-remp') ? $('#ap-remp').value : ap.remplacant || '').trim(); ap.remplacant = remp;
  const maintenant = new Date().toISOString(), trace = ap.seanceId ? { modifiePar: S.user.nom, modifieLe: maintenant } : { saisiPar: S.user.nom, saisiLe: maintenant };
  const id = await sauver('seances', { ...(ap.seanceId ? { id: ap.seanceId } : {}), activiteId: a.id, date: ap.date, presences: ap.presences, remplacant: remp, valide: !!valide, ...trace }, valide ? 'Appel validé' : 'Appel enregistré');
  ap.seanceId = id; ap.valide = !!valide; render();
}

/* ---- Fiches de sortie ---- */
function tabFiches(a) {
  const part = retenusDe(a.id);
  const get = i => S.cache.fiches.find(f => f.id === ficheId(a.id, i.seniorId)) || {};
  const ok = part.filter(i => { const f = get(i); return f.contact && f.tel; }).length;
  return `<div class="card"><h2>Fiches de sortie</h2><p class="sub" style="margin:0 0 8px">Une fiche légère par participant·e : la personne à prévenir et les informations pratiques de la sortie, rien de plus. <b>Ne notez aucune donnée de santé.</b></p>
  <div class="stat-row"><span class="lab">Fiches complètes</span><div class="bar ${part.length && ok === part.length ? 'full' : ''}"><i style="width:${part.length ? ok / part.length * 100 : 0}%"></i></div><span class="v">${ok}/${part.length}</span></div>
  ${part.length ? part.map(i => { const f = get(i), done = f.contact && f.tel; return `<button class="cand" data-action="fiche-form" data-sid="${i.seniorId}">
    <span class="av">${esc(initiales(i.seniorNom))}</span><span style="flex:1"><b>${esc(i.seniorNom)}</b><span class="why">
    ${f.mob && f.mob !== P('listes.mobilites')[0] ? `<span class="pill p-bleu">${esc(f.mob)}</span>` : ''}${f.info ? `<span class="pill p-warn">${esc(f.info)}</span>` : ''}
    ${f.photo === 'Non' ? '<span class="pill p-crit">Pas de photo</span>' : ''}${f.paye === false ? '<span class="pill p-warn">Règlement attendu</span>' : ''}${f.piece === false ? '<span class="pill p-warn">Pièce d\'identité à rappeler</span>' : ''}</span></span>
    <span class="pill ${done ? 'p-ok' : 'p-crit'}">${done ? 'Complète' : 'À compléter'}</span></button>`; }).join('') : '<div class="empty"><b>Aucun·e participant·e</b>Inscrivez des personnes d\'abord.</div>'}
  <div class="counter"><span style="flex:1;color:var(--gris)">Liste d'urgence : noms, personne à prévenir et téléphone.</span>
    <button class="btn blue" data-action="copier-urgence">Copier la liste d'urgence</button>
    <button class="btn ghost" data-action="effacer-fiches">Effacer les fiches après la sortie</button></div></div>
  <p class="note">AniMerci ne contient aucune donnée de santé : n'y notez ni allergie, ni maladie, ni médicament, ni handicap. Les fiches marquées « effacer après la sortie » sont supprimées d'un clic une fois la sortie terminée.</p>`;
}
function ficheForm(sid) {
  const a = actDe(S.actId), s = seniorDe(sid), ins = inscriptionsDe(a.id).find(i => i.seniorId === sid);
  const f = S.cache.fiches.find(x => x.id === ficheId(a.id, sid)) || { contact: s ? s.contactNom || '' : '', tel: s ? s.contactTel || '' : '', mob: P('listes.mobilites')[0], photo: 'Oui', paye: false, piece: false, effacer: true };
  modal(`<h2>Fiche de sortie</h2><p class="sub" style="margin:0"><b>${esc(ins ? ins.seniorNom : '')}</b> · ${esc(a.nom)}</p>
  <div class="field"><label for="f1">Personne à prévenir</label><input id="f1" value="${esc(f.contact || '')}" placeholder="Lien et prénom, ex. Fille : Sophie"></div>
  <div class="field"><label for="f2">Son téléphone</label><input id="f2" type="tel" value="${esc(f.tel || '')}"></div>
  <div class="field"><label for="f3">Déplacements (organisation du transport)</label><select id="f3">${P('listes.mobilites').map(m => `<option ${m === f.mob ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
  <div class="field"><label for="f4">Autre information pratique (facultatif)</label><input id="f4" value="${esc(f.info || '')}" maxlength="140" placeholder="Ex. : vient avec Mme Durand">
    <div class="note" style="margin:4px 0 0"><b>✔ À écrire</b> : une information d'organisation, par exemple « vient avec Mme Durand », « arrive à 14 h 30 », « repartira avec sa fille ».<br><b>✘ À ne pas écrire</b> : toute information de santé (allergie, maladie, médicament, handicap, régime médical…). Si une situation de santé compte pour la sortie, la personne la signale directement à l'équipe, en dehors de l'outil.</div></div>
  <div class="field"><label for="f6">Autorisation de photo (journal, site de la commune)</label><select id="f6"><option ${f.photo !== 'Non' ? 'selected' : ''}>Oui</option><option ${f.photo === 'Non' ? 'selected' : ''}>Non</option></select></div>
  <label class="chk" style="margin:8px 0"><input type="checkbox" id="f7" ${f.paye ? 'checked' : ''}> Règlement reçu</label>
  <label class="chk" style="margin:8px 0"><input type="checkbox" id="f8" ${f.piece ? 'checked' : ''}> Pièce d'identité rappelée (sortie en Belgique)</label>
  <label class="chk" style="margin:8px 0"><input type="checkbox" id="f9" ${f.effacer !== false ? 'checked' : ''}> Effacer cette fiche après la sortie</label>
  <div class="quick" style="margin-top:14px"><button class="btn" id="saveF">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#saveF').onclick = async () => {
    await sauver('fiches', { id: ficheId(a.id, sid), activiteId: a.id, seniorId: sid, seniorNom: ins ? ins.seniorNom : '', contact: $('#f1').value.trim(), tel: $('#f2').value.trim(), mob: $('#f3').value, info: $('#f4').value.trim(), photo: $('#f6').value, paye: $('#f7').checked, piece: $('#f8').checked, effacer: $('#f9').checked }, 'Fiche enregistrée');
    closeModal();
  };
}
function listeUrgence() {
  const a = actDe(S.actId);
  const t = `Liste d'urgence · ${a.nom}${a.date ? ' · ' + L.fmtDate(a.date) : ''}\n` + retenusDe(a.id).map(i => {
    const f = S.cache.fiches.find(x => x.id === ficheId(a.id, i.seniorId)) || {};
    return [i.seniorNom, f.contact || '?', f.tel || '?', f.mob && f.mob !== P('listes.mobilites')[0] ? f.mob : '', f.info || '', f.photo === 'Non' ? 'PAS DE PHOTO' : ''].filter(Boolean).join(' | ');
  }).join('\n');
  copier(t, 'Liste d\'urgence copiée');
}

// Fiche du jour J (événement ou sortie) : tout ce qu'il faut sur une page à imprimer, avec la liste des participant·es à cocher
function jourJ() {
  const a = actDe(S.actId), part = retenusDe(a.id).sort((x, y) => x.seniorNom.localeCompare(y.seniorNom, 'fr'));
  const eq = [a.interv && 'Intervenant·e : ' + a.interv, a.partenaire && 'Partenaire : ' + a.partenaire, a.benevole && 'Bénévole référent·e : ' + a.benevole, a.autresBenevoles && 'Autres bénévoles : ' + a.autresBenevoles, a.accompagnants && 'Accompagnants : ' + a.accompagnants].filter(Boolean);
  const bloc = (t, v) => v ? `<h4>${t}</h4><p style="margin:0;white-space:pre-line">${esc(v)}</p>` : '';
  modal(`<div class="feuille"><h3>${esc(a.nom)}</h3><div class="sub">${esc([quand(a), a.lieu].filter(Boolean).join(' · '))}</div>
    ${eq.length ? `<h4>Qui est là</h4><ul>${eq.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}${bloc('Matériel à prévoir', a.materiel)}${bloc('Déroulé', a.deroule)}${bloc('Coût', a.cout)}
    <h4>Participant·es (${part.length} / ${a.cap})</h4>${part.length ? `<ul class="cases">${part.map(i => `<li>${esc(i.seniorNom)}</li>`).join('')}</ul>` : '<p class="sub">Personne n\'est encore inscrit·e.</p>'}</div>
  <div class="quick noprint" style="margin-top:14px"><button class="btn" id="jj-imp">Imprimer</button><button class="btn ghost" data-action="close">Fermer</button></div>`);
  $('#jj-imp').onclick = () => window.print();
}

/* ============ ACTIONS ============ */
export const actions = {
  'jour-j': () => jourJ(),
  confirmations: () => confirmationsModal(),
  'donner-place': async el => { const i = S.cache.inscriptions.find(x => x.id === el.dataset.id); if (!i) return; await sauver('inscriptions', { ...i, statut: 'inscrit' }, `Place donnée à ${i.seniorNom}`); },
  'copier-proposition': el => { const i = S.cache.inscriptions.find(x => x.id === el.dataset.id), a = actDe(S.actId); if (!i) return; const sn = seniorDe(i.seniorId);
    copier(L.texteProposition({ prenom: sn && sn.prenom, activite: a.nom, quand: quand(a), lieu: a.lieu, signature: P('nomService') }), 'Message copié'); },
  'open-act': el => go('activite', { actId: el.dataset.id }),
  'act-form': el => actForm(el.dataset.id),
  'act-dupliquer': el => actForm(null, actDe(el.dataset.id)),
  'filtre-rattachement': () => { S.filtreSansRattachement = !S.filtreSansRattachement; render(); },
  tab: el => { S.tab = el.dataset.v; render(); },
  'ins-form': () => insForm(),
  proposer: () => proposer(),
  'toggle-ins': el => toggleIns(el),
  'del-ins': el => confirmer('Retirer cette inscription ?', 'La personne sera retirée de l\'activité.', 'Retirer', async () => { const i = S.cache.inscriptions.find(x => x.id === el.dataset.id); if (i) await mettreCorbeille('inscriptions', i); await store.remove('inscriptions', el.dataset.id); }),
  'copier-retenus': () => { const a = actDe(S.actId); copier(L.texteListeRetenus(a.nom, retenusDe(a.id).map(i => { const sn = seniorDe(i.seniorId); return { nom: i.seniorNom, statut: sn ? sn.statut : 'autre', cotis: L.cotisationARegler(sn) }; })), 'Liste copiée'); },
  'nouvel-appel': () => { S.appel = { date: aujourdhui(), presences: {}, seanceId: null, valide: false, remplacant: '' }; render(); },
  'ouvrir-appel': el => { const s = S.cache.seances.find(x => x.id === el.dataset.id); S.appel = { date: s.date, presences: { ...(s.presences || {}) }, seanceId: s.id, valide: !!s.valide, remplacant: s.remplacant || '' }; render(); },
  pres: el => { const ap = S.appel, sid = el.dataset.sid; ap.presences[sid] = ap.presences[sid] === el.dataset.v ? undefined : el.dataset.v; if (!ap.presences[sid]) delete ap.presences[sid]; const y = window.scrollY; render(); window.scrollTo(0, y); },
  'save-appel': el => saveAppel(el),
  'rouvrir-appel': () => confirmer('Rouvrir cet appel ?', 'L\'appel ne sera plus compté dans les bilans tant que vous ne l\'aurez pas validé de nouveau. L\'intervenant·e pourra de nouveau le modifier.', 'Rouvrir', async () => {
    const ap = S.appel; await sauver('seances', { id: ap.seanceId, activiteId: S.actId, date: ap.date, valide: false, modifiePar: S.user.nom, modifieLe: new Date().toISOString() }, 'Appel rouvert'); ap.valide = false; render(); }),
  'fin-appel': () => { S.appel = null; render(); },
  'fiche-form': el => ficheForm(el.dataset.sid),
  'copier-urgence': () => listeUrgence(),
  'effacer-fiches': () => confirmer('Effacer les fiches de cette sortie ?', 'Les fiches marquées « effacer après la sortie » seront supprimées définitivement. Cette action est irréversible.', 'Effacer', async () => {
    const a = actDe(S.actId); const aEffacer = S.cache.fiches.filter(f => f.activiteId === a.id && f.effacer !== false);
    for (const f of aEffacer) await store.remove('fiches', f.id); toast(`${aEffacer.length} fiche${aEffacer.length > 1 ? 's' : ''} effacée${aEffacer.length > 1 ? 's' : ''}`);
  })
};
export const changes = {
  regle: el => { S.rules[el.dataset.r] = el.checked; render(); },
  'appel-date': el => { S.appel.date = el.value; }
};
