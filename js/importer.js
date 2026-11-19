// Écran « Importer une liste » (v1.5.0) : personnes (bénéficiaires) ou annuaire, depuis Excel (.xlsx) ou CSV.
// Rien n'est écrasé : seules les nouvelles personnes sont ajoutées ; les doublons sont ignorés ; tout est montré avant d'écrire.
import { store } from './store.js';
import { P } from './parametres.js';
import { S, $, esc, modal, closeModal, toast, aujourdhui, telecharger, journaliser } from './ui.js';
import * as L from './logic.js';
import { lireListe, lireTexte, detecterColonnes, CHAMPS, preparerSeniors, preparerContacts, preparerActivites } from './import-logic.js';

const MAX_LIGNES = 5000, MAX_OCTETS = 8 * 1024 * 1024;

export function importer(cible) {
  const seniors = cible === 'seniors', act = cible === 'activites', quoi = seniors ? 'personne' : act ? 'activité' : 'contact';
  let feuilles = [], lignes = [], entetes = [], prep = null, debut = 1;
  modal(`<h2>${seniors ? 'Importer des personnes (bénéficiaires)' : act ? 'Importer des activités' : 'Importer dans l\'annuaire'}</h2>
  <p class="sub" style="margin-top:0">Fichier Excel (<b>.xlsx</b>) ou <b>CSV</b>. La <b>première ligne</b> contient les titres des colonnes (${seniors ? 'Nom, Prénom, Nom de jeune fille, Date de naissance…' : act ? 'Activité, Jour et horaire, Fréquence, Lieu, Places…' : 'Nom, Prénom, Métier ou organisme, Catégorie, Téléphone…'}). Les dates s'écrivent <b>jj/mm/aaaa</b>. ${act ? 'Les activités déjà présentes (même nom, même jour) ne sont pas dupliquées' : 'Les personnes déjà présentes ne sont pas dupliquées'} et rien n'est écrasé.</p>
  <div class="field"><label for="im-f">Fichier</label><input type="file" id="im-f" accept=".xlsx,.csv,.txt"></div>
  <div class="two">${seniors
    ? `<div class="field"><label for="im-d1">Statut si non indiqué</label><select id="im-d1"><option value="adherent">Adhérent·e</option><option value="resident">Résident·e</option><option value="autre">Autre public</option></select></div>
       <div class="field"><label for="im-d2">Sexe si non indiqué</label><select id="im-d2"><option value="">Non précisé (déduit du prénom quand c'est évident)</option><option value="F">Femme</option><option value="H">Homme</option></select></div>`
    : act ? `<div class="field"><label for="im-d1">Type si non indiqué</label><select id="im-d1"><option value="activite">Activité régulière</option><option value="sortie">Sortie ou voyage</option><option value="evenement">Événement</option></select></div>
       <div class="field"><label for="im-d2">Catégorie si non indiquée</label><select id="im-d2">${P('listes.categories').map(c => `<option>${esc(c)}</option>`).join('')}</select></div>`
    : `<div class="field"><label for="im-d1">Catégorie si non indiquée</label><select id="im-d1">${P('annuaire.categories').map(c => `<option>${esc(c)}</option>`).join('')}</select></div><div></div>`}</div>
  ${seniors ? '<label class="chk" style="margin:6px 0"><input type="checkbox" id="im-paye"> La cotisation de l\'année est déjà réglée pour toutes les personnes de cette liste (hors résident·es)</label>' : ''}
  <details style="margin:8px 0"><summary>Ou coller une liste copiée depuis Word ou Excel</summary>
    <p class="sub" style="margin:6px 0">Une personne par ligne, par exemple « DUPONT Marie – Nom de jeune fille : MARTIN » ou « Marie Dupont (tricot) ». Dans une liste à puces, les lignes sans puce sont lues comme des titres de groupe${seniors ? '' : ' et deviennent la précision'}. Un tableau copié (colonnes séparées par des tabulations) est lu avec sa première ligne comme titres.</p>
    <div class="field"><label for="im-t">Liste collée</label><textarea id="im-t" rows="6" spellcheck="false"></textarea></div>
    <button class="btn ghost" id="im-lire" type="button">Lire le texte collé</button></details>
  <button class="btn ghost" id="im-mod" type="button">Télécharger un modèle (CSV)</button>
  <div id="im-zone" aria-live="polite"></div>
  <div class="quick" style="margin-top:14px"><button class="btn" id="im-ok" disabled>Importer</button><button class="btn ghost" data-action="close">Annuler</button></div>`);

  $('#im-mod').onclick = () => telecharger(seniors ? 'modele-import-personnes.csv' : act ? 'modele-import-activites.csv' : 'modele-import-annuaire.csv',
    '﻿' + (seniors ? 'Nom;Prénom;Nom de jeune fille;Date de naissance;Sexe;Statut;Adresse;Commune;Téléphone;Personne à prévenir;Téléphone de cette personne\r\nDUPONT;Marie;MARTIN;12/03/1942;F;adhérente;;;;;\r\n'
      : act ? 'Activité;Type;Catégorie;Jour et horaire;Fréquence;Lieu;Places\r\nAtelier mémoire;activité;Mémoire;Lundi · 9h30 à 11h;Toutes les semaines;Salle commune;15\r\n'
      : 'Nom;Prénom;Métier ou organisme;Catégorie;Téléphone;E-mail;Remarque\r\nROUX;Claire;Fleuriste;Intervenant·e;;;\r\n'), 'text/csv;charset=utf-8');

  const cols = () => [...document.querySelectorAll('#im-zone [data-col]')].map(s => s.value);
  function analyser() {
    const colonnes = cols(), corps = lignes.slice(debut), zone = $('#im-zone');
    const besoin = act ? colonnes.includes('nom') : seniors ? (colonnes.includes('complet') || (colonnes.includes('nom') && colonnes.includes('prenom'))) : (colonnes.includes('complet') || colonnes.includes('nom'));
    const choix = zone.querySelector('.im-choix');
    if (!besoin) { prep = null; $('#im-ok').disabled = true; choix.innerHTML = `<div class="note">Indiquez la colonne ${act ? '« Activité » (le nom)' : seniors ? '« Nom » et la colonne « Prénom » (ou « Nom complet »)' : '« Nom » (ou « Nom complet »)'} dans les listes ci-dessus.</div>`; return; }
    prep = act ? preparerActivites(corps, colonnes, S.cache.activites, { type: $('#im-d1').value, cat: $('#im-d2').value, cap: 15, budget: P('listes.budgets')[0] })
      : seniors
      ? preparerSeniors(corps, colonnes, S.cache.seniors, { statut: $('#im-d1').value, sexe: $('#im-d2').value, commune: P('commune.defaut'), residenceAdresse: P('residence.adresse'), adhesion: { date: aujourdhui(), montant: P('adhesion.montantDefaut'), paye: $('#im-paye').checked } })
      : preparerContacts(corps, colonnes, S.cache.contacts, { categorie: $('#im-d1').value }, P('annuaire.categories'));
    const n = prep.nouveaux.length, mp = (prep.majPortage || []).length;
    choix.innerHTML = `<p><b>${corps.length}</b> ligne${corps.length > 1 ? 's' : ''} lue${corps.length > 1 ? 's' : ''} : <b>${n}</b> nouvelle${n > 1 ? 's' : ''} à ajouter, <b>${prep.doublons}</b> déjà présente${prep.doublons > 1 ? 's' : ''} (ignorée${prep.doublons > 1 ? 's' : ''}${mp ? `, dont ${mp} complétée${mp > 1 ? 's' : ''} par le portage` : ''}), <b>${prep.aVerifier.length}</b> remarque${prep.aVerifier.length > 1 ? 's' : ''}.</p>
      ${n ? `<p class="sub">Aperçu : ${prep.nouveaux.slice(0, 4).map(d => esc(L.nomAffiche(d)) + (d.naissance ? ' (' + L.fmtDate(d.naissance) + ')' : '')).join(' · ')}${n > 4 ? ' …' : ''}</p>` : ''}
      ${prep.aVerifier.length ? `<details><summary>Voir les remarques</summary><ul>${[...prep.aVerifier].sort((a, b) => /^même nom/.test(a.raison) - /^même nom/.test(b.raison)).slice(0, 30).map(r => `<li>Ligne ${r.n + 1} : ${esc(r.raison)}</li>`).join('')}${prep.aVerifier.length > 30 ? `<li>… et ${prep.aVerifier.length - 30} autres</li>` : ''}</ul></details>` : ''}`;
    $('#im-ok').disabled = !n && !mp; $('#im-ok').textContent = n ? `Importer ${n} ${quoi}${n > 1 ? 's' : ''}` : mp ? `Compléter ${mp} fiche${mp > 1 ? 's' : ''} (portage)` : 'Rien à importer';
  }
  $('#im-f').onchange = async () => {
    const f = $('#im-f').files[0]; if (!f) return;
    const zone = $('#im-zone'); zone.innerHTML = '<p class="sub">Lecture du fichier…</p>';
    try {
      if (f.size > MAX_OCTETS) throw new Error('Fichier trop volumineux (8 Mo maximum).');
      feuilles = (await lireListe(await f.arrayBuffer(), f.name)).filter(x => x.lignes.length >= 2);
      if (!feuilles.length) throw new Error('Le fichier ne contient pas de données (il faut une ligne de titres puis au moins une ligne).');
      if (feuilles.some(x => x.lignes.length > MAX_LIGNES)) throw new Error(`Trop de lignes (${MAX_LIGNES} au maximum) : découpez le fichier.`);
    } catch (e) { zone.innerHTML = `<div class="err" role="alert">${esc(e.message)}</div>`; $('#im-ok').disabled = true; return; }
    // plusieurs feuilles : on propose d'abord celle dont les titres ressemblent le plus à ce qu'on attend
    const score = x => { const d = detecterColonnes(x.lignes, cible); return d.colonnes.filter(Boolean).length; };
    const meilleure = feuilles.reduce((m, x, i) => score(x) > score(feuilles[m]) ? i : m, 0);
    montrer(meilleure);
  };
  $('#im-lire').onclick = () => {
    const zone = $('#im-zone'), r = lireTexte($('#im-t').value, cible);
    if (!r.lignes.length || r.lignes.length < 2) { zone.innerHTML = '<div class="err" role="alert">Rien de lisible dans le texte collé : collez une liste, une personne par ligne.</div>'; $('#im-ok').disabled = true; return; }
    if (r.lignes.length > MAX_LIGNES) { zone.innerHTML = `<div class="err" role="alert">Trop de lignes (${MAX_LIGNES} au maximum) : découpez la liste.</div>`; return; }
    feuilles = [{ nom: 'Texte collé', lignes: r.lignes }]; montrer(0);
    if (r.ignorees) zone.insertAdjacentHTML('afterbegin', `<p class="sub">${r.ignorees} ligne${r.ignorees > 1 ? 's' : ''} de titre ignorée${r.ignorees > 1 ? 's' : ''}.</p>`);
  };
  function montrer(idx) {
    const zone = $('#im-zone'); lignes = feuilles[idx].lignes;
    const det = detecterColonnes(lignes, cible); debut = det.ligne + 1; entetes = lignes[det.ligne]; const larg = Math.max(...lignes.slice(0, 50).map(l => l.length));
    zone.innerHTML = `${feuilles.length > 1 ? `<div class="field"><label for="im-feuille">Feuille du classeur à importer</label><select id="im-feuille">${feuilles.map((x, i) => `<option value="${i}" ${i === idx ? 'selected' : ''}>${esc(x.nom)} (${x.lignes.length - 1} lignes)</option>`).join('')}</select></div>` : ''}${det.entete ? '' : '<div class="note">Les titres n\'ont pas été reconnus : choisissez ci-dessous ce que contient chaque colonne.</div>'}
      <p class="sub" style="margin-bottom:4px">Contenu de chaque colonne (vérifiez, modifiez si besoin) :</p>
      <table class="im-tab"><thead><tr><th>Titre dans le fichier</th><th>Exemple</th><th>Correspond à</th></tr></thead><tbody>
      ${Array.from({ length: larg }, (_, i) => `<tr><td>${esc(entetes[i] || '(sans titre)')}</td><td class="sub">${esc(String(lignes[debut][i] == null ? '' : lignes[debut][i]).slice(0, 24))}</td>
        <td><select data-col aria-label="Colonne ${i + 1}">${CHAMPS[cible].map(([k, l]) => `<option value="${k}" ${(det.colonnes[i] || '') === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table>
      <div class="im-choix"></div>`;
    zone.querySelectorAll('[data-col]').forEach(s => { s.onchange = analyser; }); $('#im-d1').onchange = analyser; if ($('#im-d2')) $('#im-d2').onchange = analyser;
    if ($('#im-feuille')) $('#im-feuille').onchange = e => montrer(Number(e.target.value));
    analyser();
  }
  $('#im-ok').onclick = async () => {
    if (!prep || (!prep.nouveaux.length && !(prep.majPortage || []).length)) return;
    const btn = $('#im-ok'), docs = prep.nouveaux, col = seniors ? 'seniors' : act ? 'activites' : 'contacts'; btn.disabled = true; btn.insertAdjacentHTML('afterend', '<p class="patient" role="status">⏳ Un peu de patience : l\'import peut prendre un moment (une fiche à la fois). Ne fermez pas la fenêtre.</p>');
    const crees = [];
    try {
      for (let i = 0; i < docs.length; i++) {
        const id = await store.save(col, docs[i]); crees.push({ ...docs[i], id });
        if (i % 10 === 0) btn.textContent = `Import… ${i + 1}/${docs.length}`;
      }
      for (const m of prep.majPortage || []) await store.save('seniors', { id: m.id, portage: m.portage });
    } catch (e) { toast(`Import interrompu après ${crees.length} ajout${crees.length > 1 ? 's' : ''} : ${e.message}`); btn.disabled = false; return; }
    // une personne déjà présente qui a maintenant un·e homonyme voit son nom recopié (inscriptions, fiches) complété de sa naissance
    if (seniors) {
      const avant = S.cache.seniors, apres = avant.concat(crees);
      for (const p of avant) if (L.homonymes(p, crees).length) {
        const n = L.nomSenior(p, apres);
        for (const c of ['inscriptions', 'fiches']) for (const r of (await store.lire(c, ['seniorId', '==', p.id])).filter(x => x.seniorNom !== n)) await store.save(c, { id: r.id, seniorNom: n });
      }
    }
    journaliser('Importé', col, seniors ? { prenom: 'Import de', nom: `${crees.length} personnes` } : { nom: `Import de ${crees.length} ${act ? 'activités' : 'contacts'}` });
    const nmp = seniors ? (prep.majPortage || []).length : 0;
    closeModal(); toast(`Import terminé : ${crees.length} ${quoi}${crees.length > 1 ? 's' : ''} ajouté${crees.length > 1 && quoi !== 'contact' ? 'e' : ''}${crees.length > 1 ? 's' : ''}${nmp ? `, ${nmp} fiche${nmp > 1 ? 's' : ''} complétée${nmp > 1 ? 's' : ''} (portage)` : ''}`);
  };
}
export const actions = { importer: el => importer(el.dataset.cible) };
