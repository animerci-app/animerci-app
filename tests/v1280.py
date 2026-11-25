# v1.28.0 (retour de Madeleine) : effectifs automatiques sur l'accueil, et alertes régie/budgets remontées sur l'accueil
# quand elles sont déjà en mémoire (Budgets ou Régie déjà ouverts dans la session).
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

    # --- Effectifs automatiques, visibles dès la première ouverture de l'accueil ---
    pg.wait_for_selector('h2:has-text("Effectifs")'); pg.wait_for_timeout(600)
    t = pg.inner_text('main')
    check('Effectifs' in t, 'la carte « Effectifs » est affichée sur l\'accueil')
    check('Adhérent' in t and 'Résident' in t and 'Autres publics' in t and 'Annuaire' in t, 'les quatre compteurs (adhérent·es, résident·es, autres publics, annuaire) sont présents')
    check('…' not in pg.locator('.card:has-text("Effectifs")').inner_text(), 'les compteurs affichent un nombre (pas le repère de chargement) après un court délai')

    # --- Clic sur une ligne « Effectifs » : navigation vers Personnes ou Annuaire ---
    pg.click('.card:has-text("Effectifs") button:has-text("Adhérent")'); pg.wait_for_selector('h1:has-text("Personnes")'); pg.wait_for_timeout(300)
    check(True, 'clic sur « Adhérent·es » ouvre bien l\'écran Personnes')
    pg.click('[data-v=home]'); pg.wait_for_timeout(400)

    # --- Alertes régie/budgets : absentes tant que ces écrans n'ont jamais été ouverts pendant la session ---
    check(pg.locator('.alertes button[data-v=regie]').count() == 0, 'aucune alerte régie sur l\'accueil avant d\'avoir ouvert l\'écran Régie (aucune lecture forcée)')

    # --- Ouvrir Régie puis Budgets (une fois), puis revenir à l'accueil : les alertes apparaissent ---
    pg.click('[data-v=regie]'); pg.wait_for_selector('h1:has-text("Régie")'); pg.wait_for_timeout(500)
    pg.click('[data-v=budgets]'); pg.wait_for_selector('h1:has-text("Budgets")'); pg.wait_for_timeout(500)
    pg.click('[data-v=home]'); pg.wait_for_selector('h2:has-text("Alertes")'); pg.wait_for_timeout(500)
    al_apres = pg.locator('.alertes button[data-v=regie]').all_inner_texts()
    al_apres_txt = ' | '.join(al_apres)
    check(any('transmettre' in a.lower() for a in al_apres), 'alerte « opération de régie à transmettre » bien remontée sur l\'accueil : ' + al_apres_txt)
    check(any('retard' in a.lower() for a in al_apres), 'alerte « opération de régie en retard d\'échéance » bien remontée sur l\'accueil : ' + al_apres_txt)

    # --- Clic sur une alerte régie : ouvre bien l'écran Régie ---
    pg.locator('.alertes button[data-v=regie]').first.click(); pg.wait_for_selector('h1:has-text("Régie")'); pg.wait_for_timeout(300)
    check(True, 'clic sur une alerte régie ouvre bien l\'écran Régie')

    # --- Aucune donnée de santé dans les textes affichés sur l'accueil (effectifs + alertes) ---
    pg.click('[data-v=home]'); pg.wait_for_timeout(500)
    texte_accueil = pg.inner_text('main')
    check(not SANTE.search(texte_accueil), 'aucun terme de santé dans les textes de l\'accueil (effectifs, alertes)')

    check(not errs, 'aucune erreur JavaScript dans la console : ' + ' | '.join(errs[:5]))
    b.close()

print('\n' + ('TOUT PASSE' if not fails else f'{len(fails)} ECHEC(S) : ' + ' ; '.join(fails)))
import sys; sys.exit(1 if fails else 0)
