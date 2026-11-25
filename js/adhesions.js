// Lot F (1.18.0) : onglets « Adhésions » et « Vérification » de l'écran Personnes, migration des fiches, compteurs de l'accueil.
// Aucune lecture supplémentaire : les fiches sont déjà chargées par l'écran Personnes (administratrice seulement).
import * as L from './logic.js';
import { P } from './parametres.js';
import { store } from './store.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, esc, aujourdhui, render, toast, modal, closeModal, confirmer, telecharger, copier, sauver, peutAdmin } from './ui.js';

const ONGLETS = [['liste', 'Liste'], ['adhesions', 'Adhésions'], ['verification', 'Vérification des fiches']];
export const ongletSen = () => (ONGLETS.some(o => o[0] === S.ongletSen) ? S.ongletSen : 'liste');
export const anneeAdh = () => S.anAdh || L.anneeCible(aujourdhui(), P('adhesion.relanceMois'));
const lib = { reglee: ['p-bleu', 'Réglée'], 'a-regler': ['p-warn', 'À régler'], 'a-renouveler': ['p-crit', 'À renouveler'] };
const FILTRES = [['encours', 'À traiter'], ['a-regler', 'À régler'], ['a-renouveler', 'À renouveler'], ['reglee', 'Réglées'], ['tous', 'Toutes']];
const adherents = () => S.cache.seniors.filter(s => s.statut === 'adherent').sort(L.comparerPatronyme);
const seniorDe = id => S.cache.seniors.find(s => s.id === id);

export const barreOnglets = () => `<div class="filters" role="tablist" style="margin-bottom:10px">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="sen-tab" data-v="${k}" aria-pressed="${ongletSen() === k}">${l}</button>`).join('')}</div>`;

/* ---------- Adhésions ---------- */
export function vueAdhesions() {
  const an = anneeAdh(), tous = adherents(), st = s => L.statutAdhesion(s, an);
  const nb = { 'a-regler': tous.filter(s => st(s) === 'a-regler').length, 'a-renouveler': tous.filter(s => st(s) === 'a-renouveler').length, reglee: tous.filter(s => st(s) === 'reglee').length };
  const f = S.fAdh || 'encours', q = (S.rechAdh || '').trim().toLowerCase();
  let rows = tous.filter(s => f === 'tous' || (f === 'encours' ? st(s) !== 'reglee' : st(s) === f));
  if (q) rows = rows.filter(s => `${s.prenom} ${s.nom} ${s.nomNaissance || ''}`.toLowerCase().includes(q));
  const somme = tous.filter(s => st(s) === 'reglee').reduce((t, s) => t + (L.adhesionsDe(s).find(a => a.annee === an) || {}).montant, 0);
  const annees = [...new Set([an, new Date().getFullYear(), new Date().getFullYear() + 1, ...tous.flatMap(s => L.adhesionsDe(s).map(a => a.annee))])].sort((a, b) => b - a);
  return `<div class="card" style="margin-bottom:12px"><div class="quick" style="align-items:flex-end">
      <div class="field" style="margin:0"><label for="adAn">Année</label><select id="adAn">${annees.map(a => `<option ${a === an ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
      <div class="grow sub">${nb.reglee} réglée${nb.reglee > 1 ? 's' : ''} (${somme} €) · ${nb['a-regler']} à régler · ${nb['a-renouveler']} à renouveler. Une adhésion couvre l'année civile.</div>
      ${nb['a-renouveler'] ? `<button class="btn" data-action="adh-renouv-tous">Renouveler les ${nb['a-renouveler']} adhésions</button>` : ''}
      <button class="btn sec" data-action="adh-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="adh-pdf">PDF / imprimer</button></div></div>
    <input class="search" id="rechAdh" type="search" placeholder="Chercher un·e adhérent·e…" aria-label="Chercher un·e adhérent·e" value="${esc(S.rechAdh || '')}">
    <div class="filters">${FILTRES.map(([k, l]) => `<button data-action="adh-filtre" data-v="${k}" aria-pressed="${f === k}">${l}</button>`).join('')}</div>
    <div id="listeAdh">${listeAdh(rows, an)}</div>`;
}
function listeAdh(rows, an) {
  if (!rows.length) return '<div class="empty"><b>Rien à afficher</b>Aucune adhésion dans cette sélection.</div>';
  return rows.map(s => {
    const k = L.statutAdhesion(s, an), a = L.adhesionsDe(s).find(x => x.annee === an), t = L.telephones(s), [cl, tx] = lib[k];
    return `<div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow"><b>${esc(L.nomAffiche(s))}</b>
      <small>${esc(t.portable || t.fixe || '')}${s.email ? ' · ' + esc(s.email) : ''}${a && a.relanceLe ? ` · relancé·e le ${L.fmtDate(a.relanceLe)}` : ''}${a && a.paye ? ` · ${a.montant} € le ${L.fmtDate(a.datePaiement)}${a.mode ? ' (' + esc(a.mode) + ')' : ''}` : ''}</small></div>
      <span class="pill ${cl}">${tx}</span>
      ${k === 'reglee' ? `<button class="btn sec" data-action="adh-regl" data-id="${s.id}">Modifier</button>`
        : `${k === 'a-renouveler' ? `<button class="btn sec" data-action="adh-renouv" data-id="${s.id}">Renouveler</button>` : ''}<button class="btn" data-action="adh-regl" data-id="${s.id}">Enregistrer le règlement</button>
           <button class="btn ghost" data-action="adh-msg" data-id="${s.id}">Message de relance</button>`}</div>`;
  }).join('');
}
export const apresAdhesions = () => { const r = document.getElementById('rechAdh'); if (r) r.oninput = () => { S.rechAdh = r.value; const rows = (() => { const an = anneeAdh(), f = S.fAdh || 'encours', q = r.value.trim().toLowerCase(); return adherents().filter(s => f === 'tous' || (f === 'encours' ? L.statutAdhesion(s, an) !== 'reglee' : L.statutAdhesion(s, an) === f)).filter(s => !q || `${s.prenom} ${s.nom} ${s.nomNaissance || ''}`.toLowerCase().includes(q)); })(); document.getElementById('listeAdh').innerHTML = listeAdh(rows, anneeAdh()); };
  const sel = document.getElementById('adAn'); if (sel) sel.onchange = () => { S.anAdh = Number(sel.value); render(); }; };

async function enregistrerAdhesions(s, adhesions) {
  const doc = L.completerSenior({ ...s, adhesions });
  await sauver('seniors', { id: s.id, adhesions: doc.adhesions, adhesion: doc.adhesion, adhAnnee: doc.adhAnnee });
}
function formReglement(id) {
  const s = seniorDe(id); if (!s) return;
  const an = anneeAdh(), a = L.adhesionsDe(s).find(x => x.annee === an) || { annee: an, date: aujourdhui(), montant: P('adhesion.montantDefaut'), paye: false, mode: '', datePaiement: '' };
  modal(`<h2>Adhésion ${an} — ${esc(L.nomAffiche(s))}</h2>
    <div class="two"><div class="field"><label for="r2">Montant (€)</label><input id="r2" type="number" min="0" step="1" value="${esc(a.montant)}"></div>
    <div class="field"><label for="r3">Mode de règlement</label><select id="r3">${P('adhesion.modes').map(m => `<option ${a.mode === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div></div>
    <div class="field"><label for="r4">Réglée le</label><input id="r4" type="date" value="${esc(a.paye ? a.datePaiement : aujourdhui())}"></div>
    <div class="quick" style="margin-top:14px"><button class="btn" id="rOk">Enregistrer le règlement</button>${a.paye ? '<button class="btn ghost" id="rAnn">Annuler le règlement</button>' : ''}<button class="btn ghost" data-action="close">Fermer</button></div>`);
  document.getElementById('rOk').onclick = async () => {
    const nv = { annee: an, date: a.date || aujourdhui(), montant: document.getElementById('r2').value, paye: true, mode: document.getElementById('r3').value, datePaiement: document.getElementById('r4').value };
    const err = L.erreurAdhesion(nv); if (err) return toast(err);
    closeModal(); await enregistrerAdhesions(s, L.avecAdhesion(s, nv)); toast('Règlement enregistré');
  };
  const ann = document.getElementById('rAnn'); if (ann) ann.onclick = () => confirmer('Annuler le règlement ?', `L'adhésion ${an} de ${L.nomComplet(s)} repassera « à régler ».`, 'Annuler le règlement', async () => { await enregistrerAdhesions(s, L.avecAdhesion(s, { ...a, paye: false })); toast('Règlement annulé'); });
}
function formMessage(id) {
  const s = seniorDe(id); if (!s) return; const an = anneeAdh();
  const txt = L.messageRelance(s, an, { service: P('nomService'), montant: P('adhesion.montantDefaut') });
  modal(`<h2>Message de relance — ${esc(L.nomAffiche(s))}</h2><p class="sub">Rien n'est envoyé par l'outil : copiez le message pour l'envoyer vous-même (courrier, e-mail, SMS), puis notez la relance.</p>
    <div class="field"><label for="m1">Message</label><textarea id="m1" rows="7">${esc(txt)}</textarea></div>
    <div class="quick"><button class="btn" id="mCop">Copier le message</button><button class="btn sec" id="mRel">Noter « relancé·e aujourd'hui »</button><button class="btn ghost" data-action="close">Fermer</button></div>`);
  document.getElementById('mCop').onclick = () => copier(document.getElementById('m1').value);
  document.getElementById('mRel').onclick = async () => { closeModal(); await enregistrerAdhesions(s, L.marquerRelance(s, an, aujourdhui(), P('adhesion.montantDefaut'))); toast('Relance notée'); };
}
const donneesAdh = () => { const an = anneeAdh(); return { T: L.tableauxAdhesions(S.cache.seniors, an), an }; };
const enteteAdh = an => [`Adhésions ${an} (année civile), état au ${L.fmtDate(aujourdhui())} (AniMerci, ${P('nomService')}).`, 'Aucune donnée de santé dans ce document.'];

/* ---------- Vérification des fiches ---------- */
export function vueVerification() {
  const auj = aujourdhui(), mois = P('verification.mois'), l = S.cache.seniors.filter(s => L.aVerifier(s, auj, mois)).sort(L.comparerPatronyme);
  return `<div class="card" style="margin-bottom:12px"><div class="quick" style="align-items:center"><div class="grow sub"><b>${l.length}</b> fiche${l.length > 1 ? 's' : ''} non vérifiée${l.length > 1 ? 's' : ''} depuis plus de ${mois} mois (réglable dans Paramètres). Relisez la fiche avec la personne (adresse, téléphones, proches), puis cliquez sur « Fiche vérifiée aujourd'hui ».</div>
    <button class="btn sec" data-action="ver-pdf">Liste imprimable</button><button class="btn sec" data-action="ver-xlsx">Excel (.xlsx)</button></div></div>
    ${l.length ? l.map(s => { const t = L.telephones(s); return `<div class="row" style="flex-wrap:wrap;gap:8px"><div class="grow"><b>${esc(L.nomAffiche(s))}</b><small>${esc(L.libelleStatut(s.statut))} · ${s.verifieLe ? 'vérifiée le ' + L.fmtDate(s.verifieLe) : 'jamais vérifiée'}${t.portable || t.fixe ? ' · ' + esc(t.portable || t.fixe) : ''}</small></div>
      <button class="btn sec" data-action="senior-form" data-id="${s.id}">Ouvrir la fiche</button><button class="btn" data-action="ver-ok" data-id="${s.id}">Fiche vérifiée aujourd'hui</button></div>`; }).join('') : '<div class="empty"><b>Toutes les fiches sont à jour</b>Aucune fiche à relire pour le moment.</div>'}`;
}

/* ---------- Migration silencieuse (ancien format → nouveau) ---------- */
export async function migrer() {
  if (S.migrationFaite || !peutAdmin()) return;
  const a = S.cache.seniors.filter(L.besoinMigration); if (!a.length) return;
  S.migrationFaite = true;
  try { for (const s of a) { const c = L.champsCalcules(s); await store.save('seniors', { id: s.id, ...c }); } toast(`${a.length} fiche${a.length > 1 ? 's' : ''} mise${a.length > 1 ? 's' : ''} au nouveau format (téléphones, proches, adhésions par année).`); }
  catch (e) { S.migrationFaite = false; console.warn('migration des fiches', e); }
}

/* ---------- Compteurs de l'accueil (côté serveur : 1 lecture par comptage) ---------- */
export async function compterFiches(auj = aujourdhui()) {
  const cible = L.anneeCible(auj, P('adhesion.relanceMois')), mois = P('verification.mois');
  const [adh, verif] = await Promise.all([store.nombre('seniors', ['adhAnnee', '<', cible]), store.nombre('seniors', ['verifieLe', '<', L.seuilVerification(auj, mois)])]);
  return { adh, verif, cible, mois };
}
// Effectifs (depuis 1.28.0, demande de Madeleine) : compteurs automatiques sur l'accueil, calculés côté serveur (4 lectures, une seule fois par ouverture de l'accueil),
// sans jamais relire toutes les fiches ni tout l'annuaire. « Autre public » est déduit (total − adhérents − résident·es) plutôt que recompté séparément, pour rester valable
// quel que soit le libellé exact utilisé en interne pour ce statut.
export async function compterEffectifs() {
  const [adherents, residents, personnes, annuaire] = await Promise.all([
    store.nombre('seniors', ['statut', '==', 'adherent']), store.nombre('seniors', ['statut', '==', 'resident']), store.nombre('seniors'), store.nombre('contacts')
  ]);
  return { adherents, residents, autre: Math.max(0, personnes - adherents - residents), personnes, annuaire };
}

export const actions = {
  'sen-tab': el => { S.ongletSen = el.dataset.v; render(); },
  'adh-filtre': el => { S.fAdh = el.dataset.v; render(); },
  'adh-regl': el => formReglement(el.dataset.id),
  'adh-msg': el => formMessage(el.dataset.id),
  'adh-renouv': async el => { const s = seniorDe(el.dataset.id), an = anneeAdh(), r = L.renouveler(s, an, { auj: aujourdhui(), montant: P('adhesion.montantDefaut') }); if (r.erreur) return toast(r.erreur); await enregistrerAdhesions(s, r.adhesions); toast(`Adhésion ${an} créée (à régler)`); },
  'adh-renouv-tous': () => { const an = anneeAdh(), l = adherents().filter(s => L.statutAdhesion(s, an) === 'a-renouveler');
    confirmer(`Renouveler ${l.length} adhésion${l.length > 1 ? 's' : ''} ?`, `Une adhésion ${an} « à régler » (${P('adhesion.montantDefaut')} €) sera créée pour chaque adhérent·e concerné·e. Rien n'est envoyé.`, 'Renouveler', async () => {
      for (const s of l) { const r = L.renouveler(s, an, { auj: aujourdhui(), montant: P('adhesion.montantDefaut') }); if (!r.erreur) await enregistrerAdhesions(s, r.adhesions); } toast(`${l.length} adhésion${l.length > 1 ? 's' : ''} créée${l.length > 1 ? 's' : ''}`); }); },
  'adh-xlsx': () => { const { T, an } = donneesAdh(); telecharger(`adhesions-${an}.xlsx`, classeur(T, enteteAdh(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'adh-pdf': () => { const { T, an } = donneesAdh(); imprimer(documentHtml(T, enteteAdh(an), `Adhésions ${an}`)); },
  'ver-ok': async el => { const s = seniorDe(el.dataset.id); if (!s) return; await sauver('seniors', L.marquerVerifiee(s, { par: (S.user && (S.user.nom || S.user.email)) || '', auj: aujourdhui() }), 'Fiche vérifiée'); },
  'ver-pdf': () => { const t = L.tableauVerification(S.cache.seniors, aujourdhui(), P('verification.mois'), P('residence.nom')); imprimer(documentHtml([t], ['Liste à relire avec chaque personne : cochez la dernière colonne une fois la fiche vérifiée.', 'Aucune donnée de santé dans ce document.'], 'Fiches à vérifier')); },
  'ver-xlsx': () => { const t = L.tableauVerification(S.cache.seniors, aujourdhui(), P('verification.mois'), P('residence.nom')); telecharger(`fiches-a-verifier-${aujourdhui()}.xlsx`, classeur([t], ['Fiches à vérifier, état au ' + L.fmtDate(aujourdhui()) + '.', 'Aucune donnée de santé dans ce document.']), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); }
};
