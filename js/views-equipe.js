// Écran « Équipe » (administratrice uniquement) : créer des accès, choisir le rôle et les activités.
import { store, MODE_REEL } from './store.js';
import * as L from './logic.js';
import { S, pret, chargement, $, esc, initiales, modal, closeModal, toast, confirmer, sauver } from './ui.js';

const ROLES = { admin: 'Administratrice', intervenant: 'Intervenant·e', benevole: 'Bénévole', partenaire: 'Partenaire (journal de ses échanges)' };
const CLS = { admin: 'p-bleu', intervenant: 'p-rose', benevole: 'p-warn', partenaire: 'p-ok' };

export function equipe() {
  if (!pret('users')) return chargement('Équipe');
  const rows = [...S.cache.users].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
  const liste = rows.length ? rows.map(u => {
    const acts = (u.activites || []).map(id => (S.cache.activites.find(a => a.id === id) || {}).nom).filter(Boolean);
    return `<button class="cand" data-action="equipe-form" data-id="${esc(u.id)}">
      <span class="av">${esc(initiales(u.nom || u.email))}</span>
      <span style="flex:1"><b>${esc(u.nom || u.email)}</b>${u.id === S.user.uid ? ' <span class="sub">(vous)</span>' : ''}
      <span class="why"><span class="pill ${CLS[u.role] || 'p-warn'}">${ROLES[u.role] || 'Sans rôle'}</span>
      ${u.email ? `<span class="pill p-rose">${esc(u.email)}</span>` : ''}
      ${acts.map(n => `<span class="pill p-bleu">${esc(n)}</span>`).join('')}</span></span></button>`;
  }).join('') : '<div class="empty"><b>Aucun accès créé</b>Ajoutez la première personne avec le bouton en haut.</div>';
  return `<div class="top"><div><h1>Équipe</h1><p>Qui peut se connecter, et ce qu'elle ou il voit.</p></div>
    <div class="quick"><button class="btn" data-action="equipe-form">+ Ajouter une personne</button></div></div>
    <div class="card" style="margin-bottom:14px"><p class="sub" style="margin:0"><b>Administratrice</b> : tout. <b>Intervenant·e</b> : uniquement les inscrits et les appels de ses activités (elle ou il ne peut pas valider). <b>Bénévole</b> : le planning seulement. <b>Matériel</b> : l'administratrice, les intervenant·es et les bénévoles consultent et saisissent le matériel, les réserves et les emprunts (la suppression et les exports restent à l'administratrice).</p></div>
    ${liste}`;
}

function formulaire(id) {
  const u = id ? S.cache.users.find(x => x.id === id) : { role: 'intervenant', activites: [] };
  if (id && !u) return;
  const moi = id === S.user.uid;
  const acts = [...S.cache.activites].sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
  modal(`<h2>${id ? esc(u.nom || u.email) : 'Ajouter une personne'}</h2>
    <div class="field"><label for="e1">Prénom et nom</label><input id="e1" value="${esc(u.nom || '')}" autocomplete="off"></div>
    ${id ? `<p class="sub">Adresse : ${esc(u.email || 'non renseignée')}</p>` : `<div class="field"><label for="e2">Adresse e-mail</label><input id="e2" type="email" autocomplete="off" placeholder="prenom.nom@exemple.fr"></div>`}
    <div class="field"><label for="e3">Rôle</label><select id="e3" ${moi ? 'disabled' : ''}>${Object.entries(ROLES).map(([k, l]) => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
    <div id="blocActs" class="field"><label>Activités accessibles</label>
      ${acts.length ? acts.map(a => `<label class="chk" style="margin:4px 0"><input type="checkbox" class="eact" value="${esc(a.id)}" ${(u.activites || []).includes(a.id) ? 'checked' : ''}> ${esc(a.nom)}</label>`).join('') : '<p class="sub">Aucune activité pour le moment : créez-les d\'abord dans « Activités ».</p>'}</div>
    <div id="blocPart" class="field"><label for="e4">Partenaire concerné <small class="sub">(fiche de l'Annuaire)</small></label><select id="e4"><option value="">(choisir)</option>${[...S.cache.contacts].map(c => L.normContact(c)).sort(L.comparerPatronyme).map(c => `<option value="${esc(c.id)}" ${u.partenaireId === c.id ? 'selected' : ''}>${esc(L.libelleContact(c))}${c.categorie ? ' (' + esc(c.categorie) + ')' : ''}</option>`).join('')}</select>
      <p class="sub" style="margin:4px 0 0">Ce compte voit uniquement un écran « Mes échanges » : il saisit et relit ses propres échanges avec le service. Il ne voit ni les personnes, ni l'Annuaire, ni les activités. Retirez l'accès quand l'essai est terminé.</p></div>
    ${id ? '' : `<p class="sub">${MODE_REEL ? 'Un e-mail est envoyé à cette adresse pour que la personne choisisse son mot de passe.' : 'Mode démonstration : aucun e-mail n\'est envoyé.'}</p>`}
    ${moi ? '<p class="sub">Vous ne pouvez pas modifier votre propre rôle (protection contre le verrouillage).</p>' : ''}
    <div class="quick" style="margin-top:14px"><button class="btn" id="saveEq">Enregistrer</button><button class="btn ghost" data-action="close">Annuler</button>
    ${id && !moi ? `<button class="btn ghost" id="mdpEq" style="margin-left:auto">Renvoyer le lien de mot de passe</button><button class="btn ghost" id="delEq">Retirer l'accès</button>` : ''}</div>`);
  const maj = () => { $('#blocActs').style.display = $('#e3').value === 'intervenant' ? 'block' : 'none'; $('#blocPart').style.display = $('#e3').value === 'partenaire' ? 'block' : 'none'; };
  $('#e3').onchange = maj; maj();
  $('#saveEq').onclick = async () => {
    const nom = $('#e1').value.trim(); if (!nom) return toast('Indiquez un nom.');
    const role = moi ? 'admin' : $('#e3').value;
    const activites = role === 'intervenant' ? [...document.querySelectorAll('.eact:checked')].map(c => c.value) : [];
    const partenaireId = role === 'partenaire' ? $('#e4').value : '';
    if (role === 'partenaire' && !partenaireId) return toast('Choisissez le partenaire concerné.');
    const cp = partenaireId ? S.cache.contacts.find(c => c.id === partenaireId) : null, partenaireNom = cp ? L.libelleContact(L.normContact(cp)) : '';
    const btn = $('#saveEq'); btn.disabled = true;
    try {
      if (id) {
        await sauver('users', { id, nom, role, activites, partenaireId, partenaireNom }, 'Accès mis à jour');
      } else {
        const email = $('#e2').value.trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) { btn.disabled = false; return toast('Adresse e-mail invalide.'); }
        if (S.cache.users.some(x => (x.email || '').toLowerCase() === email)) { btn.disabled = false; return toast('Cette adresse a déjà un accès.'); }
        const uid = await store.creerCompte(email);
        await sauver('users', { id: uid, nom, email, role, activites, partenaireId, partenaireNom }, MODE_REEL ? 'Accès créé : un e-mail a été envoyé' : 'Accès créé (démonstration)');
      }
      closeModal();
    } catch (e) {
      btn.disabled = false;
      toast(/email-already-in-use/.test(e.code || '') ? 'Ce compte existe déjà dans Firebase : voir le guide (compte existant).' : 'Impossible : ' + (e.message || e));
    }
  };
  if (id && !moi) {
    $('#mdpEq').onclick = async () => { try { await store.resetMdp(u.email); toast('Lien envoyé à ' + u.email); } catch (e) { toast('Envoi impossible : ' + e.message); } };
    $('#delEq').onclick = () => confirmer('Retirer l\'accès de ' + (u.nom || u.email) + ' ?', 'La personne ne verra plus rien dans l\'application. Son compte de connexion reste dans Firebase (à supprimer là-bas si besoin).', 'Retirer', async () => { await store.remove('users', id); toast('Accès retiré'); });
  }
}

export const actions = { 'equipe-form': el => formulaire(el.dataset.id) };
