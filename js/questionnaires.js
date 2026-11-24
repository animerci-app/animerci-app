// Questionnaires et sondages (lot J, v1.22.0) : créer un questionnaire (titre, thème, questions en texte libre ou à choix),
// l'imprimer ou en copier le texte pour un envoi par e-mail (aucun envoi automatique, aucun lien en ligne).
// Les réponses reçues (papier, e-mail ou orales) sont saisies une par une par l'administratrice. Résultats : compilation automatique,
// graphiques simples en barres, pourcentages, exports Excel et PDF.
// Accès : administratrice uniquement (aucun accès équipe, aucune diffusion en ligne).
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, copier } from './ui.js';

const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : une question ou une réponse d'organisation, par exemple « Êtes-vous satisfait·e des horaires des ateliers ? », « Quels jours vous conviennent le mieux ? ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const uid = () => L.uid();
let QU_AJOUT = () => {}; // rebranché à chaque ouverture du formulaire « questForm »

/* ---------- Écran « Questionnaires » : liste, ou détail d'un questionnaire ---------- */
export function questionnaires() {
  if (!pret('questionnaires')) return chargement('Questionnaires et sondages');
  if (S.questActId) return detail(S.questActId);
  const rows = [...S.cache.questionnaires].sort((a, b) => String(a.titre || '').localeCompare(String(b.titre || ''), 'fr'));
  // Le nombre de réponses n'est pas affiché ici : les réponses d'un questionnaire ne sont lues qu'à l'ouverture de sa fiche (économie de lectures).
  const liste = rows.length ? rows.map(q => `<button class="cand" data-action="qu-ouvrir" data-id="${esc(q.id)}">
    <span class="av">${esc(initiales(q.titre || '?'))}</span><span style="flex:1"><b>${esc(q.titre || '(sans titre)')}</b>
    <span class="why"><span class="pill p-bleu">${esc(q.theme || '')}</span><span class="pill p-rose">${(q.questions || []).length} question${(q.questions || []).length > 1 ? 's' : ''}</span></span></span></button>`).join('')
    : '<div class="empty"><b>Aucun questionnaire</b>Créez-en un avec « + Nouveau questionnaire ».</div>';
  return `<div class="top"><div><h1>Questionnaires et sondages</h1><p>Créer un questionnaire, l'imprimer ou en copier le texte, puis saisir les réponses reçues sur papier, par e-mail ou à l'oral.</p></div>
    <div class="quick"><button class="btn" data-action="qu-form">+ Nouveau questionnaire</button></div></div>
    <div class="card" style="margin-bottom:14px"><p class="sub" style="margin:0">Aucune diffusion en ligne ni envoi automatique : un questionnaire se transmet en version imprimée ou par un texte à copier-coller dans un e-mail. Les réponses reçues sont ensuite saisies ici, une par une.</p></div>
    ${liste}`;
}

function questForm(id) {
  const q = id ? S.cache.questionnaires.find(x => x.id === id) : { titre: '', theme: P('questionnaires.themes')[0], questions: [{ id: uid(), texte: '', type: 'libre', options: [] }] };
  if (id && !q) return;
  const themes = P('questionnaires.themes');
  const ligneQ = (qq, i) => `<div class="card" style="margin-bottom:8px" data-qrow="${esc(qq.id)}">
    <div class="field"><label for="qt-${qq.id}">Question ${i + 1}</label><input id="qt-${qq.id}" class="qtexte" maxlength="200" value="${esc(qq.texte || '')}" placeholder="Ex. : Êtes-vous satisfait·e des horaires ?"></div>
    <div class="two"><div class="field"><label for="qy-${qq.id}">Type de réponse</label><select id="qy-${qq.id}" class="qtype" data-id="${esc(qq.id)}"><option value="libre" ${qq.type !== 'choix' ? 'selected' : ''}>Texte libre</option><option value="choix" ${qq.type === 'choix' ? 'selected' : ''}>Choix parmi des options</option></select></div>
    <div class="field"><button type="button" class="btn ghost sm" data-action="qu-suppq" data-id="${esc(qq.id)}" style="margin-top:22px">Retirer cette question</button></div></div>
    <div class="field qopts" id="qo-${qq.id}" style="display:${qq.type === 'choix' ? '' : 'none'}"><label for="qoz-${qq.id}">Options (une par ligne)</label><textarea id="qoz-${qq.id}" rows="3">${esc((qq.options || []).join('\n'))}</textarea></div></div>`;
  modal(`<h2>${id ? 'Modifier le questionnaire' : 'Nouveau questionnaire'}</h2>
  <div class="two"><div class="field"><label for="qf1">Titre</label><input id="qf1" maxlength="160" value="${esc(q.titre || '')}" placeholder="Ex. : Satisfaction des animations — automne"></div>
  <div class="field"><label for="qf2">Thème</label><select id="qf2">${themes.map(t => `<option ${t === q.theme ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div></div>
  <div id="qlisteQ">${(q.questions || []).map(ligneQ).join('')}</div>
  <div class="quick" style="margin-bottom:10px"><button type="button" class="btn ghost sm" data-action="qu-ajoutq">+ Ajouter une question</button></div>
  ${AVERT}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveQ">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id ? '<button class="btn ghost" id="delQ" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  const brancherType = idq => { const sel = $('#qy-' + idq), z = $('#qo-' + idq); if (sel) sel.onchange = () => { z.style.display = sel.value === 'choix' ? '' : 'none'; }; };
  (q.questions || []).forEach(qq => brancherType(qq.id));
  QU_AJOUT = () => { const nid = uid(); $('#qlisteQ').insertAdjacentHTML('beforeend', ligneQ({ id: nid, texte: '', type: 'libre', options: [] }, $('#qlisteQ').children.length)); brancherType(nid); };
  const lireQuestions = () => [...document.querySelectorAll('[data-qrow]')].map(div => {
    const idq = div.dataset.qrow, texte = $('#qt-' + idq).value.trim(), type = $('#qy-' + idq).value;
    const options = type === 'choix' ? [...new Set($('#qoz-' + idq).value.split('\n').map(x => x.trim()).filter(Boolean))] : [];
    return { id: idq, texte, type, options };
  });
  $('#saveQ').onclick = async () => {
    const doc = { ...(id ? { id } : {}), titre: $('#qf1').value.trim(), theme: $('#qf2').value, questions: lireQuestions() };
    const err = L.erreurQuestionnaire(doc, themes); if (err) return toast(err);
    const nid = await sauver('questionnaires', doc, 'Questionnaire enregistré'); closeModal();
    if (!id) { S.questActId = nid; render(); }
  };
  if (id) $('#delQ').onclick = () => confirmer('Supprimer ce questionnaire ?', `« ${q.titre || ''} » et ses réponses reçues vont à la corbeille.`, 'Supprimer', async () => {
    for (const r of S.cache.reponsesQuestionnaire.filter(x => x.questionnaireId === id)) { await mettreCorbeille('reponsesQuestionnaire', r); await store.remove('reponsesQuestionnaire', r.id); }
    await mettreCorbeille('questionnaires', q); await store.remove('questionnaires', id); closeModal(); S.questActId = null; toast('Questionnaire mis à la corbeille');
  });
}

/* ---------- Détail d'un questionnaire : réponses et résultats ---------- */
const ONGLETS_Q = [['reponses', 'Réponses'], ['resultats', 'Résultats']];
export const ongletQuest = () => (ONGLETS_Q.some(o => o[0] === S.ongletQuest) ? S.ongletQuest : 'reponses');
function detail(id) {
  const q = S.cache.questionnaires.find(x => x.id === id);
  if (!q) { S.questActId = null; return questionnaires(); }
  if (!pret('reponsesQuestionnaire', 'q-' + id)) return chargement(q.titre || 'Questionnaire');
  const tab = ongletQuest();
  return `<div class="top"><div><button class="btn ghost sm" data-action="qu-retour" style="margin-bottom:8px">← Tous les questionnaires</button><h1>${esc(q.titre || '')}</h1><p>${esc(q.theme || '')} · ${(q.questions || []).length} question${(q.questions || []).length > 1 ? 's' : ''}</p></div>
    <div class="quick"><button class="btn sec" data-action="qu-form" data-id="${esc(id)}">Modifier</button><button class="btn sec" data-action="qu-imprimer" data-id="${esc(id)}">Imprimer le questionnaire</button><button class="btn sec" data-action="qu-copier" data-id="${esc(id)}">Copier le texte pour un e-mail</button></div></div>
  <div class="filters" role="tablist">${ONGLETS_Q.map(([k, l]) => `<button role="tab" data-action="qu-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
  ${tab === 'resultats' ? vueResultats(q) : vueReponses(q)}`;
}
function vueReponses(q) {
  const rows = S.cache.reponsesQuestionnaire.filter(r => r.questionnaireId === q.id).sort((a, b) => (b.dateRecue || '').localeCompare(a.dateRecue || ''));
  const LIB = L.LIBELLE_DIFFUSION;
  return `<div class="quick" style="margin:10px 0"><button class="btn" data-action="qu-reponse" data-id="${esc(q.id)}">+ Saisir une réponse reçue</button></div>
  ${rows.length ? `<p class="sub">${rows.length} réponse${rows.length > 1 ? 's' : ''}</p>` + rows.map(r => `<button class="cand" data-action="qu-reponse" data-id="${esc(q.id)}" data-rid="${esc(r.id)}">
    <span class="av">${esc(initiales(r.dateRecue || '?'))}</span><span style="flex:1"><b>Réponse du ${esc(L.fmtDate(r.dateRecue))}</b><span class="why"><span class="pill p-bleu">${esc(LIB[r.diffusion] || r.diffusion || '')}</span></span></span></button>`).join('')
    : '<div class="card"><div class="empty"><b>Aucune réponse saisie</b>Ajoutez-en une avec « + Saisir une réponse reçue ».</div></div>'}`;
}
function barre(pourcent) { return `<div style="background:var(--fond2,#eee);border-radius:4px;overflow:hidden;height:14px;width:100%"><div style="background:var(--accent,#2a6);height:14px;width:${Math.max(0, Math.min(100, pourcent))}%"></div></div>`; }
function vueResultats(q) {
  const res = L.resultatsQuestionnaire(q, S.cache.reponsesQuestionnaire);
  return `<div class="quick" style="margin:10px 0"><button class="btn sec" data-action="qu-xlsx" data-id="${esc(q.id)}">Excel (.xlsx)</button><button class="btn sec" data-action="qu-pdf" data-id="${esc(q.id)}">PDF / Imprimer</button></div>
  ${res.map(r => `<div class="card" style="margin-bottom:12px"><h2 style="margin-top:0">${esc(r.question)}</h2>
    ${r.type === 'choix'
      ? (r.nb ? r.options.map(o => `<div style="margin:8px 0"><div style="display:flex;justify-content:space-between"><span>${esc(o.option)}</span><span class="sub">${o.nb} · ${o.pourcent} %</span></div>${barre(o.pourcent)}</div>`).join('')
        : '<p class="sub">Aucune réponse à cette question pour l\'instant.</p>')
      : (r.textes.length ? `<p class="sub" style="margin:0 0 6px">${r.nb} réponse${r.nb > 1 ? 's' : ''} en texte libre :</p><ul style="margin:0;padding-left:20px">${r.textes.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`
        : '<p class="sub">Aucune réponse à cette question pour l\'instant.</p>')}</div>`).join('')}`;
}

/* ---------- Saisie d'une réponse reçue ---------- */
function reponseForm(questionnaireId, rid) {
  const q = S.cache.questionnaires.find(x => x.id === questionnaireId); if (!q) return;
  const r = rid ? S.cache.reponsesQuestionnaire.find(x => x.id === rid) : { dateRecue: aujourdhui(), diffusion: 'papier', reponses: {}, commentaire: '' };
  if (rid && !r) return;
  const champ = qq => {
    const v = (r.reponses || {})[qq.id] || '';
    if (qq.type === 'choix') return `<div class="field"><label for="rr-${qq.id}">${esc(qq.texte)}</label><select id="rr-${qq.id}" class="rrchamp" data-id="${esc(qq.id)}"><option value="">(sans réponse)</option>${(qq.options || []).map(o => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></div>`;
    return `<div class="field"><label for="rr-${qq.id}">${esc(qq.texte)}</label><textarea id="rr-${qq.id}" class="rrchamp" data-id="${esc(qq.id)}" rows="2" maxlength="400">${esc(v)}</textarea></div>`;
  };
  modal(`<h2>${rid ? 'Modifier la réponse' : 'Nouvelle réponse reçue'}</h2><p class="sub" style="margin:0 0 10px">${esc(q.titre || '')}</p>
  <div class="two"><div class="field"><label for="rd1">Date de réception</label><input id="rd1" type="date" value="${esc(r.dateRecue || '')}"></div>
  <div class="field"><label for="rd2">Reçue par</label><select id="rd2"><option value="papier" ${r.diffusion === 'papier' ? 'selected' : ''}>Papier</option><option value="email" ${r.diffusion === 'email' ? 'selected' : ''}>E-mail</option><option value="oral" ${r.diffusion === 'oral' ? 'selected' : ''}>Orale</option></select></div></div>
  ${(q.questions || []).map(champ).join('')}
  <div class="field"><label for="rd3">Commentaire <small class="sub">(facultatif)</small></label><textarea id="rd3" rows="2" maxlength="300">${esc(r.commentaire || '')}</textarea></div>
  ${AVERT}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveR">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${rid ? '<button class="btn ghost" id="delR" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveR').onclick = async () => {
    const reponses = {}; [...document.querySelectorAll('.rrchamp')].forEach(el => { const v = el.value.trim(); if (v) reponses[el.dataset.id] = v; });
    const doc = { ...(rid ? { id: rid } : {}), questionnaireId, questionnaireTitre: q.titre || '', dateRecue: $('#rd1').value, diffusion: $('#rd2').value, reponses, commentaire: $('#rd3').value.trim(), par: (r.par) || (S.user && S.user.nom) || '' };
    const err = L.erreurReponseQuestionnaire(doc); if (err) return toast(err);
    await sauver('reponsesQuestionnaire', doc, 'Réponse enregistrée'); closeModal();
  };
  if (rid) $('#delR').onclick = () => confirmer('Supprimer cette réponse ?', `Réponse du ${L.fmtDate(r.dateRecue)} va à la corbeille.`, 'Supprimer', async () => { await mettreCorbeille('reponsesQuestionnaire', r); await store.remove('reponsesQuestionnaire', rid); closeModal(); toast('Réponse mise à la corbeille'); });
}

/* ---------- Impression / texte pour e-mail (aucun envoi automatique) ---------- */
function texteQuestionnaire(q) {
  const L1 = [`${q.titre || ''} (${q.theme || ''})`, ''];
  (q.questions || []).forEach((qq, i) => { L1.push(`${i + 1}. ${qq.texte || ''}`); if (qq.type === 'choix') L1.push('   ' + (qq.options || []).join(' / ')); L1.push(''); });
  return L1.join('\n');
}
function imprimerQuestionnaire(q) {
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><title>${q.titre || ''}</title>
  <style>@page{size:A4;margin:18mm}body{font-family:Arial,Helvetica,sans-serif;font-size:12pt}h1{font-size:16pt}ol{padding-left:20px}li{margin:14pt 0}.opts{color:#444;font-size:10pt}</style></head><body>
  <h1>${q.titre || ''}</h1><p>${q.theme || ''}</p><ol>${(q.questions || []).map(qq => `<li>${qq.texte || ''}${qq.type === 'choix' ? `<div class="opts">Choix : ${(qq.options || []).join(' / ')}</div>` : '<div class="opts">Réponse libre : ……………………………………………………………</div>'}</li>`).join('')}</ol></body></html>`;
  imprimer(html);
}
const enteteExport = q => [`Questionnaire « ${q.titre || ''} » — ${q.theme || ''} (AniMerci, ${P('nomService')}), édité le ${L.fmtDate(aujourdhui())}.`, 'Aucune donnée de santé dans ce document.'];

/* ---------- Actions ---------- */
export const actions = {
  'qu-form': el => questForm(el.dataset.id),
  'qu-ajoutq': () => QU_AJOUT(),
  'qu-suppq': el => { const row = el.closest('[data-qrow]'); if (row) row.remove(); },
  'qu-ouvrir': el => { S.questActId = el.dataset.id; S.ongletQuest = 'reponses'; render(); },
  'qu-retour': () => { S.questActId = null; render(); },
  'qu-reponse': el => reponseForm(el.dataset.id, el.dataset.rid),
  'qu-tab': el => { S.ongletQuest = el.dataset.v; render(); },
  'qu-imprimer': el => { const q = S.cache.questionnaires.find(x => x.id === el.dataset.id); if (q) imprimerQuestionnaire(q); },
  'qu-copier': el => { const q = S.cache.questionnaires.find(x => x.id === el.dataset.id); if (q) copier(texteQuestionnaire(q), 'Texte du questionnaire copié'); },
  'qu-xlsx': el => { const q = S.cache.questionnaires.find(x => x.id === el.dataset.id); if (!q) return; telecharger(`questionnaire-${(q.titre || 'sans-titre').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.xlsx`, classeur(L.tableauxQuestionnaire(q, S.cache.reponsesQuestionnaire), enteteExport(q)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'qu-pdf': el => { const q = S.cache.questionnaires.find(x => x.id === el.dataset.id); if (!q) return; imprimer(documentHtml(L.tableauxQuestionnaire(q, S.cache.reponsesQuestionnaire), enteteExport(q), `Questionnaire — ${q.titre || ''}`)); }
};
export const changes = {};
