# v1.16.1 : Corbeille : suppression définitive d'une ligne et vidage
from playwright.sync_api import sync_playwright
fails=[]; errs=[]
def check(c,m):
    print(('ok - ' if c else 'ECHEC - ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_context(viewport={'width':1280,'height':900}).new_page()
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side')
    # supprimer 3 tâches pour alimenter la corbeille
    pg.click('nav.side [data-v=taches]'); pg.wait_for_timeout(500)
    for t in ['Commander','Préparer','Appeler']:
        pass
    pg.evaluate("""async()=>{const {store}=await import('/js/store.js'); const {mettreCorbeille}=await import('/js/ui.js'); for (const t of (await store.lire('taches')).slice(0,3)) { await mettreCorbeille('taches',t); await store.remove('taches',t.id); }}""")
    pg.click('nav.side [data-v=sauvegarde]'); pg.click('[data-action=sec-tab][data-v=corbeille]'); pg.wait_for_selector('[data-action=corbeille-effacer]')
    n=pg.locator('[data-action=corbeille-effacer]').count(); check(n==3,'3 lignes avec « Supprimer définitivement »')
    check('Restaurer' in pg.inner_text('main') and pg.locator('[data-action=corbeille-vider]').count()==1,'Restaurer conservé ; bouton « Vider la corbeille »')
    pg.locator('[data-action=corbeille-effacer]').first.click(); pg.wait_for_selector('#cfOk'); check('irréversible' in pg.inner_text('.modal'),'confirmation irréversible'); pg.click('.modal [data-action=close]'); pg.wait_for_timeout(200)
    check(pg.locator('[data-action=corbeille-effacer]').count()==3,'annuler ne supprime rien')
    pg.locator('[data-action=corbeille-effacer]').first.click(); pg.click('#cfOk'); pg.wait_for_timeout(500)
    check(pg.locator('[data-action=corbeille-effacer]').count()==2,'une ligne supprimée définitivement')
    pg.click('[data-action=corbeille-vider]'); pg.click('#cfOk'); pg.wait_for_timeout(600)
    check('La corbeille est vide' in pg.inner_text('main'),'corbeille vidée')
    pg.click('[data-action=sec-tab][data-v=journal]'); pg.wait_for_timeout(500); j=pg.inner_text('main'); check('Supprimé définitivement' in j and 'Corbeille vidée' in j,'journal : les deux actions')
    b.close()
print('erreurs',errs); import sys; sys.exit(1 if fails or errs else 0)
