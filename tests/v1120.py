# v1.12.0 : résidents (appartement, lignes de mois, sexe non précisé)
from playwright.sync_api import sync_playwright
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
TAB="APPARTEMENT\tNom/Prénom\tDate de Naissance\tAnnée\tAge\nJANVIER\t\t\t\t\n211\tTESTUN Alice\t05/01/1950\t1950\t76\n5\tTESTDEUX Marc\t11/02/1940\t1940\t86\nFEVRIER\t\t\t\t\n9\tTESTTROIS Dominique\t\t\t\n"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand')
    pg.click('text=Importer une liste'); pg.wait_for_selector('#im-t',state='attached'); pg.click('summary:has-text("coller une liste")'); pg.fill('#im-t',TAB); pg.select_option('#im-d1','resident'); pg.click('#im-lire'); pg.wait_for_selector('.im-choix p')
    t=pg.inner_text('#im-zone'); check('3 lignes lues' in t.replace('3 lignes','3 lignes') or '3 nouvelles' in t,'3 résidents lus, lignes de mois ignorées'); check('appartement' in pg.eval_on_selector_all('[data-col]','e=>e.map(x=>x.value)'),'colonne Appartement reconnue')
    pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(500)
    pg.click('[data-action=filtre-statut][data-v=resident]'); pg.wait_for_timeout(300); l=pg.inner_text('#liste')
    check('Appt 211' in l and 'Appt 5' in l and 'Appt 9' in l,'repère « Appt n° » dans la liste'); check('TESTUN' in l and 'TESTDEUX' in l and 'TESTTROIS' in l,'3 résidents visibles')
    pg.click('.cand:has-text("TESTDEUX")'); pg.wait_for_selector('#n15'); check(pg.input_value('#n15')=='5' and pg.is_visible('#n15'),'fiche : appartement visible'); check(pg.input_value('#n4')=='H','sexe déduit du prénom : Homme'); pg.fill('#n15','12'); pg.click('#saveSenior'); pg.wait_for_timeout(500)
    check('Appt 12' in pg.inner_text('#liste'),'appartement modifié')
    pg.click('.cand:has-text("TESTTROIS")'); pg.wait_for_selector('#n4'); check(pg.evaluate("(()=>{const m=document.querySelector('.modal').getBoundingClientRect();return ![...document.querySelectorAll('.modal input,.modal select')].some(e=>e.offsetParent&&e.getBoundingClientRect().right>m.right-8)})()"),'fiche : aucun champ ne dépasse de la fenêtre'); check(pg.input_value('#n4')=='','sexe non précisé quand le prénom est mixte'); pg.click('[data-action=close]')
    pg.click('nav.side [data-v=bilans]'); pg.wait_for_timeout(600); check('Public' in pg.inner_text('main'),'Bilans : l\'écran s\'affiche')
    check(pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'pas de défilement horizontal')
    print('Erreurs console :',errs or 'aucune'); print('ÉCHECS :',fails or 'aucun'); b.close()
