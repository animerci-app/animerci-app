# v1.29.0 (précision du retour de Madeleine sur les effectifs) : compteurs sur les filtres de l'écran Personnes
# (Tous, Adhérents, Résidents, Autres, Portage de repas) et compteur Portage sur la carte Effectifs de l'accueil
# (affiché seulement après une première visite de l'écran Portage dans la session, aucune lecture en plus).
from playwright.sync_api import sync_playwright
import re
errs = []; fails = []
def check(c, msg):
    print(('ok - ' if c else 'ECHEC - ') + msg)
    if not c: fails.append(msg)
SANTE = re.compile(r'hospital|maladie|décès|deces|EHPAD|médic|diagnostic|traitement|allerg|handicap', re.I)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page()
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.clear()"); pg.reload()
    pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(900)

    # --- Compteurs sur les filtres de l'écran Personnes ---
    pg.click('[data-v=seniors]'); pg.wait_for_selector('h1:has-text("Personnes")'); pg.wait_for_timeout(500)
    filtres = pg.locator('.filters button').all_inner_texts()
    check(any(re.match(r'^Tous \(\d+\)$', t) for t in filtres), 'le filtre « Tous » affiche un nombre : ' + ' | '.join(filtres))
    check(any(re.match(r'^Adhérents \(\d+\)$', t) for t in filtres), 'le filtre « Adhérents » affiche un nombre : ' + ' | '.join(filtres))
    check(any(re.match(r'^Résidents \(\d+\)$', t) for t in filtres), 'le filtre « Résidents » affiche un nombre : ' + ' | '.join(filtres))
    check(any(re.match(r'^Autres \(\d+\)$', t) for t in filtres), 'le filtre « Autres » affiche un nombre : ' + ' | '.join(filtres))
    check(any(re.match(r'^Portage de repas \(\d+\)$', t) for t in filtres), 'le filtre « Portage de repas » affiche un nombre : ' + ' | '.join(filtres))
    # Cohérence : Adhérents + Résidents + Autres == Tous
    nb = {m.group(1): int(m.group(2)) for t in filtres for m in [re.match(r'^(.+) \((\d+)\)$', t)] if m}
    check(nb.get('Adhérents', -1) + nb.get('Résidents', -1) + nb.get('Autres', -1) == nb.get('Tous', -9999), f'Adhérents + Résidents + Autres = Tous ({nb})')

    # --- Carte Effectifs de l'accueil : Portage absent (ou non chiffré) avant toute visite de l'écran Portage ---
    pg.click('[data-v=home]'); pg.wait_for_selector('h2:has-text("Effectifs")'); pg.wait_for_timeout(600)
    carte_av = pg.locator('.card:has-text("Effectifs")').inner_text()
    check('Portage de repas' in carte_av, 'la ligne « Portage de repas » est présente sur la carte Effectifs')
    check('—' in pg.locator('.card:has-text("Effectifs") button:has-text("Portage de repas")').inner_text(), 'le compteur Portage affiche un tiret avant toute visite de l\'écran Portage (aucune lecture forcée)')

    # --- Après une visite de l'écran Portage : le compteur apparaît ---
    pg.click('[data-v=portage]'); pg.wait_for_selector('h1:has-text("Portage")'); pg.wait_for_timeout(500)
    pg.click('[data-v=home]'); pg.wait_for_timeout(500)
    txt_portage = pg.locator('.card:has-text("Effectifs") button:has-text("Portage de repas")').inner_text()
    check(re.search(r'Portage de repas\s*\d+', txt_portage.replace('\n', ' ')), 'le compteur Portage affiche un nombre après une première visite de l\'écran Portage : ' + txt_portage)

    # --- Clic sur la ligne Portage : ouvre bien l'écran Portage ---
    pg.locator('.card:has-text("Effectifs") button:has-text("Portage de repas")').click(); pg.wait_for_selector('h1:has-text("Portage")'); pg.wait_for_timeout(300)
    check(True, 'clic sur la ligne Portage de l\'accueil ouvre bien l\'écran Portage')

    # --- Aucune donnée de santé ---
    pg.click('[data-v=home]'); pg.wait_for_timeout(500)
    texte_accueil = pg.inner_text('main')
    check(not SANTE.search(texte_accueil), 'aucun terme de santé dans les textes de l\'accueil')

    check(not errs, 'aucune erreur JavaScript dans la console : ' + ' | '.join(errs[:5]))
    b.close()

print('\n' + ('TOUT PASSE' if not fails else f'{len(fails)} ECHEC(S) : ' + ' ; '.join(fails)))
import sys; sys.exit(1 if fails else 0)
