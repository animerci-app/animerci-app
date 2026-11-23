# v1.20.0 : Annuaire des bénévoles enrichi (compétences, disponibilités, missions, réunions, remerciement annuel, inactif) et alerte de décembre
from playwright.sync_api import sync_playwright
import re
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':900}); pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.clear()"); pg.reload(); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(600)
    pg.click('nav.side [data-v=annuaire]'); pg.wait_for_selector('[data-action=contact-form]'); pg.wait_for_timeout(500)
    pg.click('[data-action=contact-form]:not([data-id]) >> nth=0'); pg.wait_for_selector('#c1')
    check(not pg.is_visible('#c14'),'catégorie autre que bénévole : bloc Bénévolat masqué')
    pg.fill('#c1','TESTBEN'); pg.fill('#c7','Anne'); pg.select_option('#c2','Bénévole'); pg.wait_for_timeout(200)
    check(pg.is_visible('#blocBen'),'catégorie Bénévole : bloc Bénévolat affiché')
    pg.evaluate("document.querySelector('#blocBen').open=true")
    check('✘ À ne pas écrire' in pg.inner_text('#blocBen'),'avertissement ✔/✘ dans le bloc Bénévolat')
    pg.fill('#c14','jeux de société'); pg.check('.ben-jour[value="1"]'); pg.check('.ben-jour[value="3"]'); pg.fill('#c15','après-midi'); pg.fill('#c16','accueil du jeudi'); pg.fill('#c17','réunion de rentrée')
    pg.click('#saveC'); pg.wait_for_timeout(700)
    c=pg.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/animerci/i.test(k)))).contacts.find(x=>x.nom==='TESTBEN')")
    check(c['dispoJours']==[1,3] and c['competences']=='jeux de société' and c['benMissions']=='accueil du jeudi' and c['remerciements']==[] and c['inactif']==False,'fiche bénévole enregistrée '+str({k:c.get(k) for k in ('dispoJours','competences','remerciements','inactif')}))
    check('mar. jeu.' in pg.inner_text('main') and 'jeux de société' in pg.inner_text('main'),'liste : disponibilités et compétences affichées')
    # remerciement de l'année + inactif
    pg.click('.cand:has-text("TESTBEN")'); pg.wait_for_selector('#c14'); pg.evaluate("document.querySelector('#blocBen').open=true")
    an=pg.evaluate("new Date().getFullYear()")
    pg.check(f'.ben-rem[value="{an}"]'); pg.click('#saveC'); pg.wait_for_timeout(600)
    c=pg.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/animerci/i.test(k)))).contacts.find(x=>x.nom==='TESTBEN')")
    check(c['remerciements']==[an],'remerciement de l\'année enregistré')
    # changement de catégorie : les valeurs sont conservées
    pg.click('.cand:has-text("TESTBEN")'); pg.wait_for_selector('#c1'); pg.select_option('#c2','Collègue'); pg.click('#saveC'); pg.wait_for_timeout(600)
    c=pg.evaluate("JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k=>/animerci/i.test(k)))).contacts.find(x=>x.nom==='TESTBEN')")
    check(c['categorie']=='Collègue' and c['remerciements']==[an] and c['dispoJours']==[1,3],'autre catégorie : valeurs bénévolat conservées')
    check(len(errs)==0,'aucune erreur console : '+str(errs[:3]))
    print('ÉCHECS :',fails or 'aucun')
