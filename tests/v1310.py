# v1.31.0 (retour de Philippe, 25/11/2026) : le filtre « Autres » de l'écran Personnes exclut désormais
# les bénéficiaires du portage de repas, pour qu'il n'y ait plus de confusion visuelle entre « Autres » et
# « Portage de repas » affichant parfois le même nombre alors qu'ils désignaient les mêmes personnes.
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

    pg.click('[data-v=seniors]'); pg.wait_for_selector('h1:has-text("Personnes")'); pg.wait_for_timeout(500)
    filtres = pg.locator('.filters button').all_inner_texts()
    nb = {m.group(1): int(m.group(2)) for t in filtres for m in [re.match(r'^(.+) \((\d+)\)$', t)] if m}
    check(all(k in nb for k in ['Tous', 'Adhérents', 'Résidents', 'Autres', 'Portage de repas']), 'les 5 filtres affichent un nombre : ' + ' | '.join(filtres))

    # --- Micheline Carton (s21, « Autre public » + portage) : vérifier qu'elle n'est PAS comptée dans « Autres » mais apparaît bien dans « Portage de repas » ---
    pg.click('button:has-text("Autres (")'); pg.wait_for_timeout(400)
    liste_autres = pg.locator('#liste').inner_text()
    check('CARTON' not in liste_autres, 'Micheline Carton (Autre public + portage) n\'apparaît PAS dans le filtre « Autres » : ' + liste_autres[:200])
    note_autres = pg.locator('.sub:has-text("« Autres » ne compte ici que")').inner_text()
    check('bénéficiaires du portage' in note_autres, 'une note explique pourquoi « Autres » exclut les bénéficiaires du portage')

    pg.click('button:has-text("Portage de repas (")'); pg.wait_for_timeout(400)
    liste_portage = pg.locator('#liste').inner_text()
    check('CARTON' in liste_portage, 'Micheline Carton apparaît bien dans le filtre « Portage de repas »')

    # --- Cohérence arithmétique : Adhérents + Résidents + Autres(nouveau) + (Autre public avec portage) == Tous ---
    check(nb['Adhérents'] + nb['Résidents'] + nb['Autres'] + 1 == nb['Tous'], f'Adhérents + Résidents + Autres(hors portage) + 1 (Micheline, autre+portage) = Tous ({nb})')

    # --- Aucune régression sur le reste : compteurs toujours présents sur l'accueil ---
    pg.click('[data-v=home]'); pg.wait_for_selector('h2:has-text("Effectifs")'); pg.wait_for_timeout(600)
    carte = pg.locator('.card:has-text("Effectifs")').inner_text()
    check('Autres publics' in carte, 'la ligne « Autres publics » est toujours présente sur la carte Effectifs de l\'accueil')

    # --- Aucune donnée de santé ---
    texte_accueil = pg.inner_text('main')
    check(not SANTE.search(texte_accueil), 'aucun terme de santé dans les textes de l\'accueil')
    pg.click('[data-v=seniors]'); pg.wait_for_timeout(300)
    check(not SANTE.search(pg.inner_text('main')), 'aucun terme de santé dans les textes de l\'écran Personnes')

    check(not errs, 'aucune erreur JavaScript dans la console : ' + ' | '.join(errs[:5]))
    b.close()

print('\n' + ('TOUT PASSE' if not fails else f'{len(fails)} ECHEC(S) : ' + ' ; '.join(fails)))
import sys; sys.exit(1 if fails else 0)
