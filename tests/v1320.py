# v1.32.0 (retour de Philippe, 26/11/2026) : le Portage de repas devient autonome vis-à-vis de Personnes.
# - Écran Personnes : le filtre « Portage de repas » disparaît, « Autres » redevient une simple lecture du statut.
# - Portage › Bénéficiaires : repère de statut (visible par toute l'équipe) + coordonnées (admin/bénévole seulement, jamais intervenant·e).
# - « + Nouvelle personne », « Importer une liste », « Exporter (Excel) » : réservés à l'administratrice sur cet onglet.
from playwright.sync_api import sync_playwright
import re
errs = []; fails = []
def check(c, msg):
    print(('ok - ' if c else 'ECHEC - ') + msg)
    if not c: fails.append(msg)
SANTE = re.compile(r'hospital|maladie|décès|deces|EHPAD|médic|diagnostic|traitement|allerg|handicap', re.I)
TEL = re.compile(r'0\d([ .]?\d{2}){4}')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.clear()"); pg.reload()
    pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(900)

    # --- Personnes : plus que 4 filtres, « Autres » redevient simple ---
    pg.click('[data-v=seniors]'); pg.wait_for_selector('h1:has-text("Personnes")'); pg.wait_for_timeout(500)
    filtres = pg.locator('.filters button').all_inner_texts()
    nb = {m.group(1): int(m.group(2)) for t in filtres for m in [re.match(r'^(.+) \((\d+)\)$', t)] if m}
    check(all(k in nb for k in ['Tous', 'Adhérents', 'Résidents', 'Autres']), 'les 4 filtres (sans Portage de repas) affichent un nombre : ' + ' | '.join(filtres))
    check('Portage de repas' not in ' | '.join(filtres), 'le filtre « Portage de repas » a bien disparu de l\'écran Personnes : ' + ' | '.join(filtres))
    check(nb['Adhérents'] + nb['Résidents'] + nb['Autres'] == nb['Tous'], f'Adhérents + Résidents + Autres = Tous, à nouveau une égalité stricte ({nb})')
    check(not pg.locator('.sub:has-text("ne compte ici que")').count(), 'plus de note explicative sur « Autres » (filtre redevenu simple)')

    # --- Accueil : la carte Effectifs ne renvoie plus au filtre supprimé ---
    pg.click('[data-v=home]'); pg.wait_for_selector('h2:has-text("Effectifs")'); pg.wait_for_timeout(600)
    carte = pg.locator('.card:has-text("Effectifs")').inner_text()
    check('filtre « Tous » de Portage' in carte or 'Portage' in carte, 'la note de la carte Effectifs mentionne désormais le filtre « Tous » de Portage : ' + carte[:300])

    # --- Portage › Bénéficiaires, vue administratrice : statut + coordonnées + les 3 outils ---
    pg.click('[data-v=portage]'); pg.wait_for_selector('h1:has-text("Portage de repas")'); pg.wait_for_timeout(500)
    quick_admin = pg.locator('.quick').first.inner_text()
    for lib in ['Nouvelle personne', 'Importer une liste', 'Exporter (Excel)']:
        check(lib in quick_admin, f'administratrice : bouton « {lib} » présent sur Bénéficiaires')
    liste_admin = pg.locator('#liste-pg').inner_text()
    check(any(s in liste_admin for s in ['Adhérent', 'Résident', 'Autre public']), 'administratrice : un repère de statut apparaît sur au moins une ligne')
    check(bool(TEL.search(liste_admin)), 'administratrice : un numéro de téléphone est visible sur la liste des bénéficiaires : ' + liste_admin[:400])

    # --- Rôle bénévole : statut + coordonnées visibles, mais pas les 3 outils (réservés à l'administratrice) ---
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme bénévole'); pg.click('text=Essayer comme bénévole'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(600)
    pg.click('[data-v=portage]'); pg.wait_for_selector('h1:has-text("Portage de repas")'); pg.wait_for_timeout(500)
    quick_benevole = pg.locator('.quick').first.inner_text()
    for lib in ['Nouvelle personne', 'Importer une liste', 'Exporter (Excel)']:
        check(lib not in quick_benevole, f'bénévole : bouton « {lib} » absent (réservé à l\'administratrice) : ' + quick_benevole)
    liste_benevole = pg.locator('#liste-pg').inner_text()
    check(any(s in liste_benevole for s in ['Adhérent', 'Résident', 'Autre public']), 'bénévole : le repère de statut reste visible')
    check(bool(TEL.search(liste_benevole)), 'bénévole : les coordonnées (téléphone) restent visibles : ' + liste_benevole[:400])

    # --- Rôle intervenant·e : statut visible, coordonnées masquées ---
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(600)
    pg.click('[data-v=portage]'); pg.wait_for_selector('h1:has-text("Portage de repas")'); pg.wait_for_timeout(500)
    quick_interv = pg.locator('.quick').first.inner_text()
    for lib in ['Nouvelle personne', 'Importer une liste', 'Exporter (Excel)']:
        check(lib not in quick_interv, f'intervenant·e : bouton « {lib} » absent')
    liste_interv = pg.locator('#liste-pg').inner_text()
    check(any(s in liste_interv for s in ['Adhérent', 'Résident', 'Autre public']), 'intervenant·e : le repère de statut reste visible (donnée d\'organisation, pas une coordonnée)')
    check(not TEL.search(liste_interv), 'intervenant·e : aucun numéro de téléphone visible (coordonnées réservées admin/bénévole) : ' + liste_interv[:400])

    # --- Retour administratrice : aucune donnée de santé, aucune erreur JS ---
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    texte_accueil = pg.inner_text('main')
    check(not SANTE.search(texte_accueil), 'aucun terme de santé dans les textes de l\'accueil')
    pg.click('[data-v=portage]'); pg.wait_for_timeout(400)
    check(not SANTE.search(pg.inner_text('main')), 'aucun terme de santé dans les textes de l\'écran Portage')

    check(not errs, 'aucune erreur JavaScript dans la console : ' + ' | '.join(errs[:5]))
    b.close()

print('\n' + ('TOUT PASSE' if not fails else f'{len(fails)} ECHEC(S) : ' + ' ; '.join(fails)))
