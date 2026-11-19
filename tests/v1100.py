# v1.10.0 : fréquence des activités, nouvelles catégories d'annuaire
from playwright.sync_api import sync_playwright
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=activites]'); pg.wait_for_selector('.act'); pg.click('text=Nouvelle activité'); pg.wait_for_selector('#g12')
    check(pg.locator('#frql option').count()>=8,'fréquence : liste de suggestions')
    pg.fill('#g1','Activité TEST fréquence'); pg.fill('#g12','Toutes les semaines, hors vacances scolaires'); pg.click('#saveAct'); pg.wait_for_selector('h1:has-text("Activité TEST fréquence")')
    check('Toutes les semaines, hors vacances scolaires' in pg.inner_text('.top'),'fréquence affichée sur la fiche de l\'activité')
    pg.click('text=Toutes les activités'); pg.wait_for_selector('.act'); check('hors vacances scolaires' in pg.inner_text('.act:has-text("Activité TEST fréquence")'),'fréquence affichée sur la carte')
    pg.click('.act:has-text("Activité TEST fréquence")'); pg.click('[data-action=act-form]'); pg.wait_for_selector('#g12'); check(pg.input_value('#g12').startswith('Toutes les semaines'),'fréquence reprise à la modification'); pg.click('[data-action=close]')
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-ann'); cats=pg.input_value('#p-ann').split('\n')
    check(len(cats)==9 and 'Association partenaire' in cats and 'Intervenant·e religieux·se' in cats and 'Conduites et accompagnements' in cats,'9 catégories d\'annuaire par défaut')
    pg.click('nav.side [data-v=annuaire]'); pg.wait_for_selector('.filters'); check(pg.locator('[data-action=filtre-contact]').count()>=9,'filtres de l\'annuaire pour les nouvelles catégories')
    check(pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'pas de défilement horizontal')
    print('Erreurs console :',errs or 'aucune'); print('ÉCHECS :',fails or 'aucun'); b.close()
