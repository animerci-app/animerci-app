# v1.11.0 : import des activités (liste collée)
from playwright.sync_api import sync_playwright
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
TAB="Activité\tJour et horaire\tFréquence\tCatégorie\nAtelier TESTA\tLundi · 9h30-11h\tToutes les semaines\tMémoire\nTESTB douce\tMardi · 10h\t1 fois par mois\tActivité physique\nTESTB douce\tJeudi · 14h\tToutes les 2 semaines\tActivité physique\nTESTC\t\t4 fois par an\t\n"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=activites]'); pg.wait_for_selector('.act'); avant=pg.locator('.act').count()
    pg.click('text=Importer une liste'); pg.wait_for_selector('#im-t',state='attached'); pg.click('summary:has-text("coller une liste")'); pg.fill('#im-t',TAB); pg.select_option('#im-d1','activite'); pg.select_option('#im-d2','Créatif'); pg.click('#im-lire'); pg.wait_for_selector('.im-choix p')
    t=pg.inner_text('#im-zone'); check('4 lignes lues : 4 nouvelles' in t,'4 activités lues'); pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(500)
    check(pg.locator('.act').count()==avant+4,'4 cartes ajoutées'); l=pg.inner_text('main')  # v1.23.0 : les activités sont réparties en plusieurs blocs .grid (un par catégorie)
    check('Toutes les semaines' in l and 'Toutes les 2 semaines' in l and 'Mardi · 10h' in l and 'Jeudi · 14h' in l,'jours, horaires et fréquences repris')
    pg.click('.act:has-text("Atelier TESTA")'); pg.wait_for_selector('h1:has-text("Atelier TESTA")'); check('Toutes les semaines' in pg.inner_text('.top'),'fiche de l\'activité : fréquence'); pg.click('text=Toutes les activités'); pg.wait_for_selector('.act')
    pg.click('text=Importer une liste'); pg.wait_for_selector('#im-t',state='attached'); pg.click('summary:has-text("coller une liste")'); pg.fill('#im-t',TAB); pg.click('#im-lire'); pg.wait_for_selector('.im-choix p'); t=pg.inner_text('#im-zone'); check('0 nouvelle' in t,'réimport : rien n\'est dupliqué'); pg.click('[data-action=close]')
    check(pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'pas de défilement horizontal')
    print('Erreurs console :',errs or 'aucune'); print('ÉCHECS :',fails or 'aucun'); b.close()
