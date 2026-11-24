// Lien social (lot B, second temps, v1.24.0) : contacts et maintien du lien avec les aînés (cahier des charges §10).
// Écran réservé à l'administratrice, sans aucune exception (contrairement au reste du Portage), car il touche aux fiches complètes des personnes.
// Tout est écrit pour l'ORGANISATION du contact (qui, quand, quel type, pour quel motif d'organisation, quelle suite) : aucune donnée de santé.
import { store } from './store.js';
import * as L from './logic.js';
import { P } from './parametres.js';
import { champRecherche, itemPersonne, comboLire, comboFixer, NOUVEAU } from './recherche.js';
import { classeur, documentHtml, imprimer } from './backup.js';
import { S, pret, chargement, $, esc, aujourdhui, initiales, render, toast, modal, closeModal, confirmer, telecharger, sauver, mettreCorbeille, peutAdmin } from './ui.js';

const ONGLETS = [['contacts', 'Contacts'], ['stats', 'Chiffres de l\'année']];
const fr = d => L.fmtDate(d);
const AVERT = `<div class="note" style="margin:6px 0 10px"><b>✔ À écrire</b> : des éléments d'organisation, par exemple « prise de nouvelles », « invitation à l'activité du jeudi », « demande d'information sur le portage de repas ».<br>
  <b>✘ À ne pas écrire</b> : toute information de santé ou de situation personnelle sensible. Un champ libre ne peut pas être contrôlé par l'outil : la règle vaut pour tous.</div>`;
const liste = () => S.cache.lienSocial;
const nomSenior = id => { const s = S.cache.seniors.find(x => x.id === id); return s ? L.nomAffiche(s) : 'Personne'; };
export const anneeLS = () => Number(S.anLS) || Number(aujourdhui().slice(0, 4));

/* ---------- Écran ---------- */
export function lienSocial() {
  if (!peutAdmin()) return '<div class="card"><div class="empty"><b>Accès réservé</b>Cet écran est réservé à l\'administratrice.</div></div>';
  const an = anneeLS();
  if (!pret('lienSocial', `an-${an}`) || !pret('seniors')) return chargement('Lien social');
  const tab = ONGLETS.some(o => o[0] === S.ongletLS) ? S.ongletLS : 'contacts';
  return `<div class="top"><div><h1>Lien social</h1><p>Appels, visites, rendez-vous et échanges qui valorisent le lien entretenu avec les aînés (cahier des charges §10).</p></div>
    <div class="quick">${tab === 'contacts' ? '<button class="btn" data-action="ls-form">+ Nouveau contact</button>' : '<button class="btn sec" data-action="ls-xlsx">Excel (.xlsx)</button><button class="btn sec" data-action="ls-pdf">PDF / Imprimer</button>'}</div></div>
  <div class="filters" role="tablist">${ONGLETS.map(([k, l]) => `<button role="tab" data-action="ls-tab" data-v="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div>
  ${tab === 'stats' ? vueStats(an) : vueContacts(an)}`;
}
function listeContacts(an) {
  const seul = S.fLS === 'asuivre', q = L.cleNom(S.rechLS || '');
  const rows = liste().filter(c => c.date && c.date.slice(0, 4) === String(an) && (!seul || c.statut !== 'cloture') && (!q || L.cleNom([nomSenior(c.seniorId), c.motif, c.action].join(' ')).includes(q))).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return rows.length ? `<p class="sub">${rows.length} contact${rows.length > 1 ? 's' : ''}</p>${rows.map(ligneContact).join('')}` : '<div class="card"><div class="empty"><b>Aucun contact</b>Notez ici les appels, visites, rendez-vous et échanges avec les aînés.</div></div>';
}
function vueContacts(an) {
  const seul = S.fLS === 'asuivre';
  return `<div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;margin-bottom:10px">${selectAnnee(an)}
    <input class="search" id="rech-ls" type="search" placeholder="Chercher : personne, motif…" aria-label="Chercher dans le lien social" value="${esc(S.rechLS || '')}" style="flex:1;min-width:180px">
    <label class="chk" style="margin:0 0 6px"><input type="checkbox" data-change="ls-fls" ${seul ? 'checked' : ''}> À traiter ou en cours seulement</label></div>
  <div id="liste-ls">${listeContacts(an)}</div>`;
}
const selectAnnee = an => { const a0 = Number(aujourdhui().slice(0, 4)); return `<div class="field" style="max-width:140px;margin:0"><label for="ls-an">Année</label><select id="ls-an" data-change="ls-an">${[a0 + 1, a0, a0 - 1, a0 - 2, a0 - 3].filter((x, i, t) => t.indexOf(x) === i).concat(an).filter((x, i, t) => t.indexOf(x) === i).sort((x, y) => y - x).map(x => `<option ${x === an ? 'selected' : ''}>${x}</option>`).join('')}</select></div>`; };
const PILL_STATUT_LS = { 'a-traiter': 'p-warn', 'en-cours': 'p-bleu', cloture: 'p-ok' };
function ligneContact(c) {
  return `<button class="cand" data-action="ls-form" data-id="${esc(c.id)}"><span class="av" aria-hidden="true">${esc(initiales(nomSenior(c.seniorId)))}</span>
    <span style="flex:1"><b>${esc(nomSenior(c.seniorId))}</b><span class="why"><span class="pill p-bleu">${esc(fr(c.date))}</span><span class="pill p-rose">${esc(L.TYPES_CONTACT_LIEN_SOCIAL[c.type] || c.type || '')}</span>
    ${c.statut ? `<span class="pill ${PILL_STATUT_LS[c.statut] || 'p-bleu'}">${esc(L.STATUTS_CONTACT_LIEN_SOCIAL[c.statut] || c.statut)}</span>` : ''}</span>
    ${c.motif ? `<span class="sub">${esc(c.motif)}</span>` : ''}</span></button>`;
}

/* ---------- Formulaire ---------- */
function form(id) {
  const c = id ? liste().find(x => x.id === id) : null;
  const d = c || { type: 'appel-entrant', date: aujourdhui(), statut: 'cloture' };
  modal(`<h2>${id ? 'Modifier le contact' : 'Nouveau contact'}</h2>
  ${champRecherche({ id: 'ls1', label: 'Personne concernée', aide: 'Tapez un nom ou une date de naissance.', texte: c ? nomSenior(c.seniorId) : '', val: c ? c.seniorId : '', items: () => S.cache.seniors.map(itemPersonne), mode: 'unique' })}
  <div class="two"><div class="field"><label for="ls2">Type de contact</label><select id="ls2">${Object.entries(L.TYPES_CONTACT_LIEN_SOCIAL).map(([k, l]) => `<option value="${k}" ${d.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  <div class="field"><label for="ls3">Date</label><input id="ls3" type="date" value="${esc(d.date || aujourdhui())}"></div></div>
  <div class="two"><div class="field"><label for="ls4">Heure <small class="sub">(facultatif)</small></label><input id="ls4" type="time" value="${esc(d.heure || '')}"></div>
  <div class="field"><label for="ls5">Durée approximative (minutes) <small class="sub">(facultatif)</small></label><input id="ls5" type="number" min="0" max="600" value="${esc(d.duree == null ? '' : d.duree)}"></div></div>
  <div class="field"><label for="ls6">Motif général</label><input id="ls6" list="ls6-l" maxlength="160" autocomplete="off" value="${esc(d.motif || '')}"><datalist id="ls6-l">${P('liensocial.motifs').map(m => `<option value="${esc(m)}">`).join('')}</datalist></div>
  <div class="field"><label for="ls7">Action réalisée <small class="sub">(facultatif)</small></label><textarea id="ls7" rows="2" maxlength="400">${esc(d.action || '')}</textarea></div>
  <div class="field"><label for="ls8">Suite à donner <small class="sub">(facultatif)</small></label><input id="ls8" maxlength="200" value="${esc(d.suite || '')}" placeholder="Ex. : rappeler la semaine prochaine"></div>
  <div class="field"><label for="ls9">Statut</label><select id="ls9">${Object.entries(L.STATUTS_CONTACT_LIEN_SOCIAL).map(([k, l]) => `<option value="${k}" ${d.statut === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
  ${AVERT}${d.par ? `<p class="sub" style="margin:0 0 8px">Saisi par ${esc(d.par)}.</p>` : ''}
  <div class="quick" style="margin-top:6px"><button class="btn" id="saveLS">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>${id ? '<button class="btn ghost" id="delLS" style="margin-left:auto">Supprimer</button>' : ''}</div>`);
  $('#saveLS').onclick = async () => {
    const choix = comboLire('ls1'); if (choix.val === NOUVEAU || !choix.val) return toast('Choisissez la personne concernée dans la liste.');
    const o = { seniorId: choix.val, type: $('#ls2').value, date: $('#ls3').value };
    const err = L.erreurContactLienSocial(o); if (err) return toast(err);
    await sauver('lienSocial', { ...(id ? { id } : {}), ...o, heure: $('#ls4').value, duree: $('#ls5').value === '' ? '' : Number($('#ls5').value), motif: $('#ls6').value.trim(), action: $('#ls7').value.trim(), suite: $('#ls8').value.trim(), statut: $('#ls9').value, par: d.par || S.user.nom }, 'Contact enregistré');
    closeModal();
  };
  if (id) $('#delLS').onclick = () => confirmer('Supprimer ce contact ?', `Contact du ${fr(d.date)}.`, 'Supprimer', async () => { await mettreCorbeille('lienSocial', c); await store.remove('lienSocial', id); closeModal(); toast('Contact mis à la corbeille'); });
}

/* ---------- Chiffres de l'année ---------- */
function vueStats(an) {
  const s = L.statsLienSocial(liste(), an);
  const ligne = (l, v) => `<tr><td>${esc(l)}</td><td style="text-align:right"><b>${v}</b></td></tr>`;
  return `<div class="field" style="max-width:140px;margin-bottom:10px">${selectAnnee(an)}</div>
  <div class="card" style="margin-bottom:14px"><h2 style="margin-top:0">Chiffres ${an}</h2>
  <p class="sub" style="margin:0 0 10px">Ces trois chiffres ne se recoupent pas : un contact peut concerner une personne déjà comptée, et seuls les contacts avec une action réalisée ou une suite donnée comptent comme « interventions ».</p>
  <table class="tbl" style="width:100%">${ligne('Nombre de contacts', s.contacts)}${ligne('Personnes distinctes concernées', s.personnesDistinctes)}${ligne('Interventions (action réalisée ou suite donnée)', s.interventions)}${ligne('Appels (entrants et sortants)', s.appels)}${ligne('Visites spontanées', s.visites)}${ligne('Rendez-vous', s.rdv)}${ligne('Temps consacré (minutes)', s.tempsConsacre)}</table></div>
  <div class="card"><h2 style="margin-top:0">Motifs principaux</h2>${s.motifsPrincipaux.length ? `<table class="tbl" style="width:100%">${s.motifsPrincipaux.map(([m, n]) => ligne(m, n)).join('')}</table>` : '<p class="sub">Aucun contact cette année.</p>'}</div>`;
}
const entete = an => [`Lien social : chiffres ${an} (AniMerci, ${P('nomService')}), édité le ${fr(aujourdhui())}.`, 'Aucune donnée de santé dans ce document.'];

/* ---------- Après rendu : rebranche la recherche ---------- */
export function apresLienSocial() {
  const r = $('#rech-ls'); if (r) r.oninput = () => { S.rechLS = r.value; $('#liste-ls').innerHTML = listeContacts(anneeLS()); };
}

/* ---------- Actions ---------- */
export const actions = {
  'ls-tab': el => { S.ongletLS = el.dataset.v; render(); },
  'ls-form': el => { if (peutAdmin()) form(el.dataset.id); },
  'ls-xlsx': () => { if (!peutAdmin()) return; const an = anneeLS(); telecharger(`lien-social-${an}.xlsx`, classeur(L.tableauxLienSocial(liste(), an, nomSenior), entete(an)), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); toast('Fichier Excel téléchargé'); },
  'ls-pdf': () => { if (!peutAdmin()) return; const an = anneeLS(); imprimer(documentHtml(L.tableauxLienSocial(liste(), an, nomSenior), entete(an), `Lien social : chiffres ${an}`)); }
};
export const changes = {
  'ls-an': el => { S.anLS = Number(el.value); render(); },
  'ls-fls': el => { S.fLS = el.checked ? 'asuivre' : ''; render(); }
};
