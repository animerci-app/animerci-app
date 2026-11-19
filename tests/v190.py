# v1.9.0 : portage de repas (jours de livraison), adresse de la résidence → Résident·e automatique
from playwright.sync_api import sync_playwright
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
TAB="Nom/Prénom\tAdresse\tFréquence\tDate anniversaire\nTESTUN Jean\t5 rue des Essais\tLundi au dimanche\t11/03/1940\nTESTDEUX Marie\t6 rue des Essais\tLundi, mercredi, vendredi\t\nTESTTROIS Paul\t22 rue du Test\tAu choix\t\nTESTQUATRE Rose\t7 rue des Essais\tLundi au vendredi\t\n"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    # 1. réglage de l'adresse de la résidence
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-resadr'); pg.fill('#p-res','Résidence Test'); pg.fill('#p-resadr','22 rue du Test, 59000 Villetest'); pg.click('text=Enregistrer'); pg.wait_for_timeout(500)
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand')
    # 2. import d'un tableau avec Fréquence
    pg.click('text=Importer une liste'); pg.wait_for_selector('#im-t',state='attached'); pg.click('summary:has-text("coller une liste")'); pg.fill('#im-t',TAB); pg.select_option('#im-d1','autre'); pg.click('#im-lire'); pg.wait_for_selector('.im-choix p')
    t=pg.inner_text('#im-zone'); check('4 lignes lues : 4 nouvelles' in t,'4 personnes lues'); pg.click('summary:has-text("Voir les remarques")'); t=pg.inner_text('#im-zone'); check('classée Résident' in t,'remarque : adresse de la résidence → Résident·e')
    pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(400)
    pg.click('[data-action=filtre-statut][data-v=portage]'); pg.wait_for_timeout(300); l=pg.inner_text('#liste')
    check(l.count('Portage :')==4,'filtre « Portage de repas » : 4 personnes'); check('Tous les jours' in l and 'Lundi, mercredi, vendredi' in l and 'Lundi au vendredi' in l and 'Au choix' in l,'jours de portage lisibles dans la liste')
    pg.click('[data-action=filtre-statut][data-v=resident]'); pg.wait_for_timeout(300); l=pg.inner_text('#liste')
    check('TESTTROIS' in l and 'Résidence Test' in l and 'TESTUN' not in l,'TESTTROIS (adresse de la résidence) est Résident·e, lieu de vie = la résidence')
    pg.click('[data-action=filtre-statut][data-v=tous]')
    # 3. fiche : cases des jours
    pg.click('.cand:has-text("TESTDEUX")'); pg.wait_for_selector('#n13'); check(pg.is_checked('#n13') and pg.is_visible('.pj'),'fiche : portage coché, jours visibles')
    jours=pg.eval_on_selector_all('.pj:checked','e=>e.map(x=>x.value).join(",")'); check(jours=='0,2,4','jours cochés : lundi, mercredi, vendredi')
    pg.check('.pj[value="1"]'); pg.fill('#n14','sauf jours fériés'); pg.click('#saveSenior'); pg.wait_for_timeout(500)
    l=pg.inner_text('#liste'); check('sauf jours fériés' in l,'jour ajouté et précision enregistrés')
    # 4. nouvelle personne sans portage ; décocher retire le portage
    pg.click('.cand:has-text("TESTQUATRE")'); pg.wait_for_selector('#n13'); pg.uncheck('#n13'); check(not pg.is_visible('.pj'),'décoché : jours masqués'); pg.click('#saveSenior'); pg.wait_for_timeout(500)
    pg.click('[data-action=filtre-statut][data-v=portage]'); pg.wait_for_timeout(300); check(pg.inner_text('#liste').count('Portage :')==3,'TESTQUATRE retiré du portage : 3 restent')
    pg.click('[data-action=filtre-statut][data-v=tous]')
    # 5. une adhérente existante reçoit seulement son portage
    pg.click('text=Importer une liste'); pg.wait_for_selector('#im-t',state='attached'); pg.click('summary:has-text("coller une liste")'); pg.fill('#im-t',"Nom/Prénom\tDate anniversaire\nTESTCINQ Alice\t02/02/1945"); pg.select_option('#im-d1','adherent'); pg.click('#im-lire'); pg.wait_for_selector('.im-choix p'); pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(400)
    pg.click('text=Importer une liste'); pg.wait_for_selector('#im-t',state='attached'); pg.click('summary:has-text("coller une liste")'); pg.fill('#im-t',"Nom/Prénom\tAdresse\tFréquence\tDate anniversaire\nTESTCINQ Alice\t9 rue des Essais\tMardi et jeudi\t02/02/1945\nTESTSIX Zoé\t3 rue des Essais\tMardi\t"); pg.select_option('#im-d1','autre'); pg.click('#im-lire'); pg.wait_for_selector('.im-choix p')
    t=pg.inner_text('#im-zone'); check('1 nouvelle' in t and 'complétée' in t,'aperçu : 1 nouvelle, 1 fiche complétée par le portage'); pg.click('#im-ok'); pg.wait_for_selector('text=Import terminé'); pg.wait_for_timeout(400)
    pg.click('[data-action=filtre-statut][data-v=adherent]'); pg.wait_for_timeout(300); l=pg.inner_text('#liste'); check('TESTCINQ' in l and 'Mardi, jeudi' in l,'TESTCINQ reste adhérente et reçoit le portage Mardi, jeudi')
    check(pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth'),'pas de défilement horizontal')
    print('Erreurs console :',errs or 'aucune'); print('ÉCHECS :',fails or 'aucun'); b.close()
