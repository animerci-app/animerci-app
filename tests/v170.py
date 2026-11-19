# v1.7.0 : lieu de vie (résident·e / adhérent·e + commune), repères dans les listes d'activité
from playwright.sync_api import sync_playwright
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('text=Essayer comme administratrice')
    pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    # Paramètres : résidence et commune
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-res')
    pg.fill('#p-res','Résidence Test'); pg.fill('#p-com','Ville Test'); pg.click('text=Enregistrer les paramètres'); pg.wait_for_timeout(400)
    # Personnes
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand')
    txt=pg.inner_text('#liste')
    check('Résident·e' in txt and 'Adhérent·e' in txt,'pastilles Résident·e et Adhérent·e dans la liste')
    check(pg.locator('#liste .cand:has-text("Résident·e") .pill:has-text("Résidence Test")').count()>=1,'lieu de vie d\'un·e résident·e = la résidence')
    check('Commune voisine' in txt,'commune d\'une personne d\'une autre commune affichée')
    # nouvelle fiche : commune proposée, masquée pour un·e résident·e
    pg.click('.top >> text=Nouvelle personne'); pg.wait_for_selector('#n11')
    check(pg.input_value('#n11')=='Ville Test','commune proposée depuis les paramètres')
    pg.select_option('#n5','resident')
    check(not pg.is_visible('#n11') and pg.is_visible('#infoRes'),'résident·e : adresse et commune masquées, lieu de vie indiqué')
    pg.select_option('#n5','adherent'); check(pg.is_visible('#n11'),'adhérent·e : commune visible')
    pg.fill('#n11','Autre Commune'); pg.fill('#n1','Lise'); pg.fill('#n2','Nouvelle'); pg.fill('#n3','1950-01-01'); pg.click('#saveSenior')
    pg.wait_for_selector('#liste .cand:has-text("Autre Commune")'); check(True,'fiche enregistrée avec sa commune')
    # Activité : repères
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Atelier mémoire")'); pg.wait_for_selector('.stat-row')
    t=pg.inner_text('.card')
    check('Adhérent·e' in t or 'Résident·e' in t,'statut visible dans la liste de l\'activité')
    check('résident' in t and 'adhérent' in t,'compteurs par public')
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Atelier floral")'); pg.wait_for_selector('text=Rotation')
    t=pg.inner_text('.card'); check('Adhérent·e' in t and 'Cotisation à régler' in t,'repères aussi en mode rotation')
    check(pg.locator('.cand:has-text("Résident·e") .pill:has-text("Cotisation à régler")').count()==0,'jamais de cotisation à régler pour un·e résident·e')
    check(pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'pas de défilement horizontal')
    print('Erreurs console :',errs or 'aucune'); print('ÉCHECS :',fails or 'aucun')
    b.close()
