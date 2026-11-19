# v1.8.0 : import par texte collé (liste Word / tableau), prénom à confirmer, cotisation réservée aux adhérent·es
from playwright.sync_api import sync_playwright
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
ADH="LISTE DES ADHÉRENTS 2026\nTESTNOM Alice – Nom de jeune fille : AUTRENOM\nTESTDEUX Berthe nom de jeune fille AUTREDEUX\nTESTTROIS Carole– Prénom à confirmer\nLE TESTQUATRE Denise\n"
BEN="Liste des bénévoles\nGroupe un\n• Eva Testcinq\n• Luc Testsix (tricot)\nChorale\n• Père Testsept\n• Son équipe(Anne Testhuit, Paul Testneuf)\n"
TAB="Nom/Prénom\tAdresse\tFréquence\tDate anniversaire\nTESTDIX Jean\t5 rue des Essais\tLundi\t11/03/1940\nTESTONZE Marie\t6 rue des Essais\tMardi\t\n"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    def coller(txt,defaut=None,paye=False):
        pg.click('text=Importer une liste'); pg.wait_for_selector('#im-t',state='attached'); pg.click('summary:has-text("coller une liste")'); pg.fill('#im-t',txt)
        if defaut: pg.select_option('#im-d1',defaut)
        if paye: pg.check('#im-paye')
        pg.click('#im-lire'); pg.wait_for_selector('.im-choix p'); return pg.inner_text('#im-zone')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand')
    t=coller(ADH,'adherent',True)
    check('4 lignes lues : 4 nouvelles' in t,'adhérent·es : 4 lignes lues, 4 nouvelles (le titre du document est ignoré, « LE TESTQUATRE » est une personne)')
    pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(400)
    l=pg.inner_text('#liste'); check('TESTNOM' in l and 'LE TESTQUATRE' in l,'les personnes collées sont dans la liste')
    check(l.count('Prénom à confirmer')==1,'une seule fiche « Prénom à confirmer »')
    pg.click('.cand:has-text("TESTTROIS")'); pg.wait_for_selector('#n12'); check(pg.is_checked('#n12'),'case « Prénom à confirmer » cochée sur la fiche'); pg.uncheck('#n12'); pg.click('#saveSenior'); pg.wait_for_timeout(400)
    check('Prénom à confirmer' not in pg.inner_text('#liste'),'case décochée : le repère disparaît')
    t=coller(ADH,'adherent'); check('0 nouvelle' in t or ' 0 nouvelle' in t,'réimport de la même liste : rien n\'est dupliqué'); pg.click('[data-action=close]')
    t=coller(TAB,'autre'); check('2 lignes lues : 2 nouvelles' in t,'tableau collé (portage) : 2 lignes') ; pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(400)
    pg.click('.cand:has-text("TESTDIX")'); pg.wait_for_selector('#n5'); check(pg.input_value('#n5')=='autre','statut « Autre public »'); check(not pg.is_visible('#blocAdh'),'autre public : pas de bloc cotisation'); pg.click('[data-action=close]')
    pg.click('nav.side [data-v=annuaire]'); pg.wait_for_timeout(300)
    t=coller(BEN,'Bénévole'); check('5 lignes lues : 5 nouvelles' in t,'bénévoles : 5 lignes (équipe entre parenthèses développée)'); pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(400)
    l=pg.inner_text('main'); check('Groupe un — tricot' in l and 'Chorale — équipe' in l and 'Chorale — Père' in l,'groupes et précisions repris')
    check(pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'pas de défilement horizontal')
    print('Erreurs console :',errs or 'aucune'); print('ÉCHECS :',fails or 'aucun'); b.close()
