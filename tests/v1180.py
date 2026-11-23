# v1.18.0 (lot F) : fiches enrichies, adhésions par année, vérification annuelle — démonstration administratrice
from playwright.sync_api import sync_playwright
import re
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
SANTE=re.compile(r'traitement|fauteuil|déambulateur|maladie|médicament|diagnostic|allerg|handicap',re.I)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1280,'height':900}).new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(900)
    t=pg.inner_text('main')
    check(re.search(r'adhésions? à renouveler ou à régler pour \d{4}',t) is not None,'accueil : alerte adhésions (compteur serveur)')
    check('à vérifier' in t,'accueil : alerte fiches à vérifier')
    pg.click('main .alertes button:has-text("adhésion")'); pg.wait_for_selector('#adAn'); t=pg.inner_text('main')
    check('Adhésions' in t and 'À traiter' in t,'l\'alerte ouvre l\'onglet Adhésions')
    pg.click('[data-action=sen-tab][data-v=liste]'); pg.wait_for_selector('text=Nouvelle personne')
    # --- Paramètres ---
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-rel'); check(pg.locator('#p-ver').count()==1 and pg.locator('#p-mdr').count()==1,'Paramètres : relances, vérification, modes de règlement')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('text=Nouvelle personne')
    # --- fiche enrichie ---
    pg.click('text=+ Nouvelle personne'); pg.wait_for_selector('#n16'); m=pg.inner_text('.modal')
    check('À écrire' in m and 'À ne pas écrire' in m,'fiche : avertissement ✔/✘ sur les informations d\'organisation')
    check(not SANTE.search(m.replace('information de santé','').replace('aucune information','')) or 'À ne pas écrire' in m,'fiche : pas de champ de santé')
    pg.fill('#n1','Zoé'); pg.fill('#n2','Testeur'); pg.fill('#n3','1950-03-04'); pg.fill('#n7','03 20 00 00 01'); pg.fill('#n16','06 11 11 11 11'); pg.fill('#n17','zoe@exemple.fr'); pg.fill('#n18','Centre'); pg.fill('#n20','Préfère l\'après-midi')
    pg.fill('#pr0n','Fils TEST'); pg.fill('#pr0l','fils'); pg.fill('#pr0t','06 22 22 22 22'); pg.fill('#pr1n','Voisine TEST'); pg.fill('#pr1t','06 33 33 33 33')
    pg.click('#saveSenior'); pg.wait_for_timeout(600)
    pg.fill('#rech','Testeur'); pg.wait_for_timeout(300); pg.click('.cand:has-text("TESTEUR")'); pg.wait_for_selector('#n16')
    check(pg.input_value('#n7')=='03 20 00 00 01' and pg.input_value('#n16')=='06 11 11 11 11' and pg.input_value('#n17')=='zoe@exemple.fr','fiche : fixe, portable, e-mail conservés')
    check(pg.input_value('#pr0n')=='Fils TEST' and pg.input_value('#pr1t')=='06 33 33 33 33' and pg.input_value('#n20')=="Préfère l'après-midi",'fiche : proches et informations d\'organisation conservés')
    check('2026' in pg.inner_text('#histAdh') or 'Historique' in pg.inner_text('#histAdh') or 'Aucune' in pg.inner_text('#histAdh'),'fiche : historique des adhésions affiché')
    pg.click('.modal [data-action=close]')
    # --- adhésions ---
    pg.click('[data-action=sen-tab][data-v=adhesions]'); pg.wait_for_selector('#adAn'); pg.click('[data-action=adh-filtre][data-v=tous]'); pg.fill('#rechAdh','Testeur'); pg.wait_for_timeout(300)
    check('À régler' in pg.inner_text('#listeAdh'),'nouvelle adhérente : à régler')
    pg.click('#listeAdh [data-action=adh-regl]'); pg.wait_for_selector('#r2'); pg.select_option('#r3','Chèque'); pg.click('#rOk'); pg.wait_for_timeout(500)
    check('Réglée' in pg.inner_text('#listeAdh') and 'Chèque' in pg.inner_text('#listeAdh'),'règlement enregistré avec son mode')
    # année suivante : à renouveler
    an=int(pg.input_value('#adAn') if False else pg.eval_on_selector('#adAn','e=>e.value'))
    pg.select_option('#adAn',str(an+1)); pg.wait_for_timeout(400); pg.click('[data-action=adh-filtre][data-v=tous]'); pg.fill('#rechAdh','Testeur'); pg.wait_for_timeout(300)
    check('À renouveler' in pg.inner_text('#listeAdh'),'année suivante : « À renouveler »')
    pg.click('#listeAdh [data-action=adh-renouv]'); pg.wait_for_timeout(500)
    check('À régler' in pg.inner_text('#listeAdh'),'renouvellement : adhésion créée « À régler »')
    pg.click('#listeAdh [data-action=adh-msg]'); pg.wait_for_selector('#m1'); check(pg.input_value('#m1').startswith('Bonjour Zoé') and str(an+1) in pg.input_value('#m1'),'message de relance à copier'); pg.click('#mRel'); pg.wait_for_timeout(500)
    check('relancé' in pg.inner_text('#listeAdh'),'relance notée')
    with pg.expect_download() as d: pg.click('[data-action=adh-xlsx]')
    check(d.value.suggested_filename.endswith('.xlsx'),'export Excel des adhésions')
    # --- vérification ---
    pg.click('[data-action=sen-tab][data-v=verification]'); pg.wait_for_selector('[data-action=ver-ok]'); t=pg.inner_text('main')
    check('Testeur'.upper() in t.upper() and 'jamais vérifiée' in t,'vérification : fiche jamais vérifiée listée')
    n0=pg.locator('[data-action=ver-ok]').count(); pg.click('.row:has-text("TESTEUR") [data-action=ver-ok]'); pg.wait_for_timeout(500)
    check(pg.locator('[data-action=ver-ok]').count()==n0-1 and 'TESTEUR' not in pg.inner_text('main').upper(),'« Fiche vérifiée aujourd\'hui » : sortie de la liste')
    with pg.expect_download() as d: pg.click('[data-action=ver-xlsx]')
    check(d.value.suggested_filename.endswith('.xlsx'),'liste à vérifier : Excel')
    # --- sauvegarde et export ---
    pg.click('nav.side [data-v=seniors]'); pg.click('[data-action=sen-tab][data-v=liste]'); pg.wait_for_selector('text=Exporter')
    with pg.expect_download() as d: pg.click('[data-action=export-seniors]')
    contenu=open(d.value.path(),encoding='utf-8-sig').read(); check('Tél. portable' in contenu and 'Proches' in contenu and 'zoe@exemple.fr' in contenu,'export CSV : nouveaux champs')
    # --- nettoyage ---
    pg.fill('#rech','Testeur'); pg.wait_for_timeout(300); pg.click('.cand:has-text("TESTEUR")'); pg.wait_for_selector('#delSenior'); pg.click('#delSenior'); pg.click('#cfOk'); pg.wait_for_timeout(600)
    check('TESTEUR' not in pg.inner_text('#liste').upper(),'fiche de test supprimée')
    print('erreurs',errs); print('ÉCHECS :',fails or 'aucun')
