# v1.27.0 (confort d'usage, retour terrain, 25/11/2026) : une fiche Personnes ou un contact
# de l'Annuaire peut désormais être enregistré avec seulement le prénom OU seulement le nom (à compléter
# plus tard). Repère « À compléter » sur les fiches/contacts dans ce cas. Pour un organisme de l'Annuaire,
# le nom reste obligatoire.
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

    # ========== PERSONNES ==========
    pg.click('[data-v=seniors]'); pg.wait_for_selector('h1:has-text("Personnes")'); pg.wait_for_timeout(400)

    # --- Blocage : toujours impossible d'enregistrer sans AUCUN des deux ---
    pg.click('[data-action=senior-form]'); pg.wait_for_timeout(300)
    pg.click('#saveSenior'); pg.wait_for_timeout(300)
    check('nécessaire' in pg.inner_text('body'), 'Personnes : le message invite à compléter prénom ou nom quand les deux sont vides')
    check(pg.locator('.modal').count() == 1, 'Personnes : la fiche reste ouverte quand ni le prénom ni le nom ne sont saisis')

    # --- Prénom seul, nom laissé vide : doit s'enregistrer ---
    pg.fill('#n1', 'Christophe')
    pg.click('#saveSenior'); pg.wait_for_timeout(500)
    t = pg.inner_text('#liste')
    check('Christophe' in t, 'Personnes : une fiche avec seulement le prénom « Christophe » est enregistrée')
    carte_christophe = pg.locator('.cand:has-text("Christophe")')
    check(carte_christophe.locator('.pill:has-text("À compléter")').count() == 1, 'Personnes : repère « À compléter » affiché sur une fiche sans nom')

    # --- Nom seul, prénom laissé vide : doit s'enregistrer ---
    pg.click('[data-action=senior-form]'); pg.wait_for_timeout(300)
    pg.fill('#n2', 'Dubois')
    pg.click('#saveSenior'); pg.wait_for_timeout(500)
    t = pg.inner_text('#liste')
    check('Dubois' in t, 'Personnes : une fiche avec seulement le nom « Dubois » est enregistrée')
    carte_dubois = pg.locator('.cand:has-text("Dubois")')
    check(carte_dubois.locator('.pill:has-text("À compléter")').count() == 1, 'Personnes : repère « À compléter » affiché sur une fiche sans prénom')
    check(not carte_dubois.inner_text().strip().startswith('?'), 'Personnes : pas d\'espace ni d\'avatar cassé sans prénom')

    # --- La recherche retrouve bien une fiche à prénom seul ---
    pg.fill('#rech', 'Christophe'); pg.wait_for_timeout(300)
    check('Christophe' in pg.inner_text('#liste'), 'Personnes : la recherche retrouve une fiche enregistrée avec le prénom seul')
    pg.fill('#rech', ''); pg.wait_for_timeout(300)

    # ========== ANNUAIRE ==========
    pg.click('[data-v=annuaire]'); pg.wait_for_selector('h1:has-text("Annuaire")'); pg.wait_for_timeout(400)

    # --- Blocage : toujours impossible d'enregistrer un particulier sans AUCUN des deux ---
    pg.click('[data-action=contact-form]'); pg.wait_for_timeout(300)
    pg.click('#saveC'); pg.wait_for_timeout(300)
    check('nécessaire' in pg.inner_text('body'), 'Annuaire : le message invite à compléter le nom ou le prénom quand les deux sont vides')
    check(pg.locator('.modal').count() == 1, 'Annuaire : la fiche reste ouverte quand ni le nom ni le prénom ne sont saisis')

    # --- Prénom seul (nom de famille inconnu), cas réel « Christophe, intervenant musical » ---
    pg.fill('#c7', 'Christophe'); pg.fill('#c6', 'Musicien intervenant')
    pg.click('#saveC'); pg.wait_for_timeout(500)
    t = pg.inner_text('#liste-ann')
    check('Christophe' in t, 'Annuaire : un contact avec seulement le prénom « Christophe » est enregistré')
    carte_c = pg.locator('.cand:has-text("Christophe")')
    check(carte_c.locator('.pill:has-text("À compléter")').count() == 1, 'Annuaire : repère « À compléter » affiché sur un contact sans nom')

    # --- Organisme : le nom reste obligatoire (pas de prénom) ---
    pg.click('[data-action=contact-form]'); pg.wait_for_timeout(300)
    pg.click('#c8'); pg.wait_for_timeout(200)
    pg.click('#saveC'); pg.wait_for_timeout(300)
    check('organisme' in pg.inner_text('body').lower(), 'Annuaire : un organisme sans nom est toujours refusé (le nom de l\'organisme reste obligatoire)')
    pg.fill('#c1', 'Croix-Rouge locale')
    pg.click('#saveC'); pg.wait_for_timeout(500)
    check('Croix-Rouge locale' in pg.inner_text('#liste-ann'), 'Annuaire : un organisme avec un nom s\'enregistre toujours normalement')
    check(pg.locator('.cand:has-text("Croix-Rouge locale") .pill:has-text("À compléter")').count() == 0, 'Annuaire : un organisme n\'est jamais signalé « À compléter »')

    # --- Un contact normal sans prénom (cas déjà permis avant cette version) n'est PAS signalé « À compléter » ---
    pg.click('[data-action=contact-form]'); pg.wait_for_timeout(300)
    pg.fill('#c1', 'Mercier'); pg.fill('#c6', 'Fleuriste')
    pg.click('#saveC'); pg.wait_for_timeout(500)
    check(pg.locator('.cand:has-text("Mercier") .pill:has-text("À compléter")').count() == 0, 'Annuaire : un contact avec un nom mais sans prénom (déjà permis avant) n\'est pas signalé « À compléter »')

    print('erreurs console :', errs)
    check(len(errs) == 0, 'aucune erreur console')
    b.close()
print('ÉCHECS :', fails if fails else 'aucun')
