// Fusion de deux fiches « Personnes » en double (v1.5.0). Réservé à l'administratrice.
// On garde une fiche ; les inscriptions, fiches de sortie et présences de l'autre passent sur la fiche gardée ; l'autre va à la corbeille.
import { store } from './store.js';
import { P } from './parametres.js';
import * as L from './logic.js';
import { S, $, esc, modal, closeModal, toast, confirmer, mettreCorbeille, seniorDe } from './ui.js';
import { champRecherche, comboLire, itemPersonne, AIDE_PERSONNE, NOUVEAU } from './recherche.js';

export function fusionForm(idGarde) {
  const A = seniorDe(idGarde); if (!A) return;
  modal(`<h2>Fusionner avec une fiche en double</h2>
  <p>La fiche de <b>${esc(L.nomAffiche(A))}</b> est conservée. Choisissez l'autre fiche (le doublon) : ses inscriptions, fiches de sortie et présences passent sur la fiche conservée, les informations manquantes sont complétées, puis le doublon est mis à la corbeille.</p>
  ${champRecherche({ id: 'f1', label: 'Fiche en double', aide: AIDE_PERSONNE, items: () => S.cache.seniors.filter(s => s.id !== idGarde).map(itemPersonne), recents: 'seniors' })}
  <div class="quick" style="margin-top:14px"><button class="btn" id="fuOk">Fusionner</button><button class="btn ghost" data-action="close">Annuler</button></div>`);
  $('#fuOk').onclick = () => {
    const { val } = comboLire('f1'), B = val && val !== NOUVEAU ? seniorDe(val) : null;
    if (!B) return toast('Cherchez puis choisissez la fiche en double dans la liste.');
    confirmer('Fusionner ces deux fiches ?', `« ${L.nomAffiche(B)} » sera fusionnée dans « ${L.nomAffiche(A)} » : ses inscriptions et ses présences sont déplacées, puis la fiche en double va à la corbeille (${P('securite.joursCorbeille')} jours). Un appel validé n'est pas perdu : ses présences passent sur la fiche conservée.`, 'Fusionner', async () => { await fusionner(A, B); });
  };
}

export async function fusionner(A, B) {
  // 1. informations manquantes
  const doc = { id: A.id };
  for (const k of ['prenom', 'nom', 'nomNaissance', 'naissance', 'sexe', 'appartement', 'adresse', 'commune', 'email', 'quartier', 'entreeLe', 'infosOrga']) if (!A[k] && B[k]) doc[k] = B[k];
  // téléphones, proches et adhésions : fusionnés au nouveau format (les années déjà réglées chez A sont conservées, celles de B complètent)
  const { telephones, prochesDe, adhesionsDe, champsCalcules, MAX_PROCHES } = L, tA = telephones(A), tB = telephones(B), pA = prochesDe(A), pB = prochesDe(B);
  const fusion = { telFixe: tA.fixe || tB.fixe, telPortable: tA.portable || tB.portable, proches: [...pA, ...pB.filter(p => !pA.some(q => q.nom === p.nom && q.tel === p.tel))].slice(0, MAX_PROCHES) };
  if (A.statut !== 'resident') { const m = new Map(adhesionsDe(B).map(a => [a.annee, a])); for (const a of adhesionsDe(A)) m.set(a.annee, a.paye || !m.get(a.annee) || !m.get(a.annee).paye ? a : m.get(a.annee)); fusion.adhesions = [...m.values()].sort((x, y) => x.annee - y.annee); }
  Object.assign(doc, champsCalcules({ ...A, ...doc, ...fusion }));
  if (!A.portage && B.portage) doc.portage = B.portage;
  if (Object.keys(doc).length > 1) await store.save('seniors', doc);
  const reste = S.cache.seniors.filter(s => s.id !== B.id), Aap = { ...A, ...doc };
  const nomAff = L.nomSenior(Aap, reste.map(s => s.id === A.id ? Aap : s));
  // 2. inscriptions
  const insA = await store.lire('inscriptions', ['seniorId', '==', A.id]), insB = await store.lire('inscriptions', ['seniorId', '==', B.id]);
  const actsA = new Set(insA.map(i => i.activiteId));
  for (const r of insB) { if (actsA.has(r.activiteId)) await store.remove('inscriptions', r.id); else await store.save('inscriptions', { id: r.id, seniorId: A.id, seniorNom: nomAff }); }
  // 3. fiches de sortie (identifiant = activité_personne)
  const fA = new Set((await store.lire('fiches', ['seniorId', '==', A.id])).map(f => f.activiteId));
  for (const f of await store.lire('fiches', ['seniorId', '==', B.id])) {
    if (!fA.has(f.activiteId)) await store.save('fiches', { ...f, id: `${f.activiteId}_${A.id}`, seniorId: A.id, seniorNom: nomAff });
    await store.remove('fiches', f.id);
  }
  // 4. présences des appels des activités concernées
  for (const act of new Set(insB.map(i => i.activiteId))) {
    for (const s of await store.lire('seances', ['activiteId', '==', act])) {
      if (!s.presences || !(B.id in s.presences)) continue;
      const p = { ...s.presences }; if (!(A.id in p)) p[A.id] = p[B.id]; delete p[B.id];
      await store.save('seances', { id: s.id, presences: p });
    }
  }
  // 5. le doublon va à la corbeille, et ses homonymes éventuels sont réétiquetés
  await mettreCorbeille('seniors', B, { inscriptions: insB });
  await store.remove('seniors', B.id);
  for (const p of [Aap, ...L.homonymes(Aap, reste)]) {
    const n = L.nomSenior(p, reste.map(s => s.id === A.id ? Aap : s));
    for (const col of ['inscriptions', 'fiches']) for (const r of (await store.lire(col, ['seniorId', '==', p.id])).filter(x => x.seniorNom !== n)) await store.save(col, { id: r.id, seniorNom: n });
  }
  closeModal(); toast('Fiches fusionnées : le doublon est à la corbeille');
}
