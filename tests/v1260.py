# v1.26.0 (confort d'usage, 25/11/2026) : qui est rattaché à une activité visible directement sur sa carte
# (sans ouvrir la fiche), repère « À rattacher » quand personne n'est rattaché, filtre « Sans personne rattachée »
# sur l'écran Activités, et confirmation que la Fiche du jour J l'affichait déjà.
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
    pg.click('[data-v=activites]'); pg.wait_for_selector('h1:has-text("Activités")'); pg.wait_for_timeout(400)

    # --- La carte affiche directement qui est rattaché, sans ouvrir la fiche ---
    carte_marche = pg.locator('.act:has-text("Marche douce")')
    check(carte_marche.locator('.qui').count() == 1, 'une ligne « qui » est présente sur la carte « Marche douce »')
    check('Bénévole référent' in carte_marche.inner_text(), 'la carte « Marche douce » affiche directement le bénévole référent, sans clic')
    carte_chorale = pg.locator('.act:has-text("Chorale des aînés")')
    check('Musicien intervenant' in carte_chorale.inner_text(), 'la carte « Chorale des aînés » affiche directement l\'intervenant')

    # --- Repère « À rattacher » pour une activité toute neuve (aucun intervenant, partenaire, bénévole ni autre bénévole) ---
    pg.click('[data-action=act-form]'); pg.wait_for_timeout(300)
    pg.fill('#g1', 'Test sans personne rattachée'); pg.fill('#g2', 'Culture'); pg.fill('#g5', 'Mardi · 10h')
    pg.click('#saveAct'); pg.wait_for_timeout(500)
    pg.click('[data-v=activites]'); pg.wait_for_timeout(400)
    carte_test = pg.locator('.act:has-text("Test sans personne rattachée")')
    check(carte_test.locator('.pill:has-text("À rattacher")').count() == 1, 'repère « À rattacher » affiché sur une activité sans personne rattachée')

    # --- Filtre « Sans personne rattachée » ---
    check(pg.locator('[data-action=filtre-rattachement]').count() == 1, 'bouton de filtre « Sans personne rattachée » présent')
    pg.click('[data-action=filtre-rattachement]'); pg.wait_for_timeout(300)
    t = pg.inner_text('main')
    check('Test sans personne rattachée' in t, 'le filtre affiche bien l\'activité sans personne rattachée')
    check('Marche douce' not in t, 'le filtre masque une activité qui a déjà une personne rattachée')
    pg.click('[data-action=filtre-rattachement]'); pg.wait_for_timeout(300)
    check('Marche douce' in pg.inner_text('main'), 'désactiver le filtre réaffiche toutes les activités')

    # --- Plusieurs personnes rattachées : « +N » sur la carte ---
    pg.click('.act:has-text("Test sans personne rattachée")'); pg.wait_for_timeout(300)
    pg.click('[data-action=act-form]'); pg.wait_for_timeout(300)
    pg.fill('#g8', 'Jean Dupont'); pg.wait_for_timeout(250); pg.keyboard.press('Escape')
    pg.fill('#g10', 'Croix-Rouge'); pg.wait_for_timeout(250); pg.keyboard.press('Escape')
    pg.click('#saveAct'); pg.wait_for_timeout(500)
    pg.click('[data-v=activites]'); pg.wait_for_timeout(400)
    carte_test2 = pg.locator('.act:has-text("Test sans personne rattachée")')
    check('Jean Dupont' in carte_test2.inner_text() and '+1' in carte_test2.inner_text(), 'carte avec deux personnes rattachées : la première est affichée, suivie de « +1 »')

    # Suppression de l'activité de test
    pg.click('.act:has-text("Test sans personne rattachée")'); pg.wait_for_timeout(300)
    pg.click('[data-action=act-form]'); pg.wait_for_timeout(300)
    pg.click('#delAct'); pg.wait_for_timeout(300)
    pg.click('.modal .btn:has-text("Supprimer")'); pg.wait_for_timeout(500)

    # --- La Fiche du jour J affichait déjà l'intervenant (aucune régression) ---
    pg.click('text=Repas de Noël des seniors'); pg.wait_for_timeout(300)
    pg.click('[data-action=jour-j]'); pg.wait_for_timeout(300)
    m = pg.inner_text('.modal')
    check('Qui est là' in m and 'Traiteur' in m, 'la Fiche du jour J affiche toujours « Qui est là » sans clic supplémentaire')
    pg.click('[data-action=close]')

    # --- Aucune donnée de santé sur l'écran Activités modifié ---
    pg.click('[data-v=activites]'); pg.wait_for_timeout(300)
    check(not SANTE.search(pg.inner_text('main')), 'aucun terme de santé sur l\'écran Activités')

    # --- Mobile : pas de défilement horizontal malgré la ligne ajoutée ---
    pg.set_viewport_size({'width': 375, 'height': 812}); pg.wait_for_timeout(200)
    pg.click('[data-v=activites]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'), 'mobile : pas de défilement horizontal (Activités, carte enrichie)')

    print('erreurs console :', errs)
    check(len(errs) == 0, 'aucune erreur console')
    b.close()
print('ÉCHECS :', fails if fails else 'aucun')
