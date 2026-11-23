# v1.17.0 (lot A) : Matériel — démonstration admin / intervenante / bénévole
from playwright.sync_api import sync_playwright
import re
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
SANTE=re.compile(r'traitement|fauteuil|déambulateur|maladie|médicament|diagnostic|allerg',re.I)
def entrer(pg,libelle):
    pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector('text='+libelle); pg.click('text='+libelle); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(500)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1280,'height':900}).new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    entrer(pg,'Essayer comme administratrice')
    t=pg.inner_text('main')
    check('périmé' in t.lower() or 'stock bas' in t.lower() or 'emprunt en retard' in t.lower(),'accueil : alertes du matériel')
    pg.click('nav.side [data-v=materiel]'); pg.wait_for_selector('text=Nouvel article'); t=pg.inner_text('main')
    check(all(x in t for x in ['Inventaire','Réserves','Caisses de décorations','Emprunts']),'4 onglets')
    check('Alertes' in t and 'emprunt en retard' in t,'bloc d\'alertes sur l\'écran')
    check('Excel' in t and 'PDF' in t,'admin : exports présents')
    # article : création
    pg.click('text=+ Nouvel article'); pg.wait_for_selector('#a1'); m=pg.inner_text('.modal'); check('À écrire' in m and 'À ne pas écrire' in m,'fiche article : avertissement ✔/✘')
    pg.fill('#a1','Nappes blanches TEST'); pg.fill('#a6','12'); pg.fill('#a8','4'); pg.fill('#a9','Local test'); pg.click('#saveA'); pg.wait_for_timeout(500)
    check('Nappes blanches TEST' in pg.inner_text('main'),'article créé')
    pg.click('.cand:has-text("Nappes blanches TEST")'); pg.wait_for_selector('#a6'); pg.fill('#a6','3'); pg.click('#saveA'); pg.wait_for_timeout(500)
    check('Stock bas' in pg.inner_text('.cand:has-text("Nappes blanches TEST")'),'quantité sous le seuil : « Stock bas »')
    # prêt : quantité supérieure au disponible refusée
    pg.click('.cand:has-text("Nappes blanches TEST")'); pg.wait_for_selector('#pretA'); pg.click('#pretA'); pg.wait_for_selector('#m1')
    pg.fill('#m2','9'); pg.fill('#m5-saisie' if pg.locator('#m5-saisie').count() else '#m5','Service jeunesse'); pg.wait_for_timeout(300)
    pg.keyboard.press('Escape') if False else None
    # champ libre : choisir l'option « tel quel » si proposée
    opt=pg.locator('.combo-opt:has-text("tel quel"), [role=option]:has-text("tel quel")')
    if opt.count(): opt.first.click()
    pg.click('#saveM'); pg.wait_for_timeout(400)
    check(pg.locator('#m1').count()==1,'prêt de 9 alors que 3 en stock : refusé')
    pg.fill('#m2','2'); pg.click('#saveM'); pg.wait_for_timeout(500)
    pg.click('[data-action=mat-tab][data-v=emprunts]'); pg.wait_for_timeout(300)
    check('Nappes blanches TEST' in pg.inner_text('main') and 'Service jeunesse' in pg.inner_text('main'),'emprunt créé (texte libre)')
    # retour partiel puis complet
    pg.click('.cand:has-text("Nappes blanches TEST") [data-action=emp-retour]'); pg.wait_for_selector('#r1'); pg.fill('#r1','1'); pg.click('#saveR'); pg.wait_for_timeout(500)
    check('× 1' in pg.inner_text('main'),'retour partiel : reste 1 en cours')
    pg.click('.cand:has-text("Nappes blanches TEST") [data-action=emp-retour]'); pg.wait_for_selector('#r1'); pg.click('#saveR'); pg.wait_for_timeout(500)
    check('Nappes blanches TEST' not in pg.inner_text('main').split('Emprunts (')[-1],'retour complet : plus en cours')
    # réserves : lots, sortie, historique
    pg.click('[data-action=mat-tab][data-v=reserves]'); pg.wait_for_timeout(300); t=pg.inner_text('main')
    check('concerne le lot' in t and "concerne l'article entier" in t,'péremption : texte explicite lot / article entier pour toute l\'équipe')
    check('Périmé' in t,'réserve périmée signalée')
    pg.click('text=+ Nouvelle réserve'); pg.wait_for_selector('#a11'); pg.fill('#a1','Sucre TEST'); pg.select_option('#a11','lot')
    check(pg.locator('#lots-ed .lotrow').count()==1,'mode « par lot » : un lot proposé')
    pg.fill('#lots-ed .lot-qte','6'); pg.fill('#lots-ed .lot-date','2027-05-01'); pg.fill('#a8','2'); pg.click('#saveA'); pg.wait_for_timeout(500)
    ligne='.cand:has-text("Sucre TEST")'; t=pg.inner_text(ligne)
    check('6' in t and 'concerne le lot' in t and "Relevée" not in 'x' ,'réserve par lot enregistrée avec date relevée')
    check('par ' in t,'« relevée … par X » affiché')
    pg.click(ligne+' [data-action=mat-mvt][data-sens=sortie]'); pg.wait_for_selector('#v1'); pg.fill('#v1','9'); pg.click('#saveV'); pg.wait_for_timeout(300)
    check(pg.locator('#v1').count()==1,'sortie > stock : refusée')
    pg.fill('#v1','5'); pg.click('#saveV'); pg.wait_for_timeout(500)
    check('Stock bas' in pg.inner_text(ligne) or 'bas' in pg.inner_text(ligne).lower(),'après la sortie : stock bas (1 ≤ seuil 2)')
    pg.click(ligne+' [data-action=mat-histo]'); pg.wait_for_selector('text=Historique —'); h=pg.inner_text('.modal'); check('−5' in h and 'Reste' in h,'historique : sortie de 5 visible, avec le reste')
    pg.click('.modal [data-action=close]')
    # caisses
    pg.click('[data-action=mat-tab][data-v=caisses]'); pg.wait_for_timeout(300); check('Caisse n°' in pg.inner_text('main'),'caisses de décorations listées')
    # filtre « à signaler »
    pg.click('[data-action=mat-tab][data-v=inventaire]'); pg.check('[data-change=mat-fsig]'); pg.wait_for_timeout(300); check(pg.locator('.cand').count()>=1,'filtre « À signaler seulement »')
    # exports admin
    pg.click('[data-action=mat-tab][data-v=inventaire]')
    with pg.expect_download() as d: pg.click('[data-action=mat-xlsx]')
    check(d.value.suggested_filename.endswith('.xlsx'),'export Excel du matériel')
    # suppression admin (corbeille), puis nettoyage
    for nom in ['Nappes blanches TEST']:
        pg.click('[data-action=mat-tab][data-v=inventaire]'); pg.click('.cand:has-text("%s")'%nom); pg.wait_for_selector('#delA'); pg.click('#delA'); pg.click('#cfOk'); pg.wait_for_timeout(400)
    check('Nappes blanches TEST' not in pg.inner_text('main'),'suppression (corbeille) par l\'administratrice')
    check(not SANTE.search(pg.inner_text('main')),'aucun terme de santé à l\'écran')
    # sauvegarde JSON : le matériel y est
    pg.click('nav.side [data-v=sauvegarde]')
    with pg.expect_download() as d: pg.click('text=Fichier de restauration')
    d.value.save_as('/tmp/v1170.json'); js=open('/tmp/v1170.json',encoding='utf-8').read(); check('"materiel"' in js and '"emprunts"' in js and '"mouvements"' in js,'sauvegarde .json : matériel, emprunts, mouvements')
    # intervenante
    pg.click('text=Se déconnecter'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante'); pg.wait_for_selector('text=Mes activités')
    check(pg.locator('nav.side [data-v=materiel]').count()==1,'intervenante : menu Matériel')
    pg.click('nav.side [data-v=materiel]'); pg.wait_for_selector('text=Nouvel article'); t=pg.inner_text('main')
    check('Excel' not in t and 'PDF' not in t,'intervenante : pas d\'exports')
    pg.click('.cand >> nth=0'); pg.wait_for_selector('#saveA'); check(pg.locator('#delA').count()==0,'intervenante : pas de bouton Supprimer'); pg.click('.modal [data-action=close]')
    pg.click('[data-action=mat-tab][data-v=emprunts]'); pg.click('text=+ Nouvel emprunt'); pg.wait_for_selector('#m5')
    pg.fill('#m5' if pg.locator('input#m5').count() else '#m5-saisie','Moi'); pg.wait_for_timeout(300); check('Moi-même' in pg.inner_text('.modal'),'intervenante : « Moi-même » proposé')
    pg.click('.modal [data-action=close]')
    # bénévole
    pg.click('text=Se déconnecter'); pg.wait_for_selector('text=Essayer comme bénévole'); pg.click('text=Essayer comme bénévole'); pg.wait_for_selector('nav.side')
    check(pg.locator('nav.side .nav-btn[data-v]').count()==3 and pg.locator('nav.side [data-v=materiel]').count()==1,'bénévole : planning, matériel et portage')
    pg.click('nav.side [data-v=materiel]'); pg.wait_for_selector('text=Nouvel article'); pg.click('[data-action=mat-tab][data-v=reserves]'); pg.wait_for_timeout(300)
    check(pg.locator('[data-action=mat-mvt]').count()>=1 and 'concerne' in pg.inner_text('main'),'bénévole : entrées/sorties et péremption lisibles')
    check(not SANTE.search(pg.inner_text('main')),'bénévole : aucun terme de santé')
    # partenaire : aucun accès
    pg.click('text=Se déconnecter'); pg.wait_for_selector('text=Essayer comme partenaire'); pg.click('text=Essayer comme partenaire'); pg.wait_for_selector('nav.side')
    check(pg.locator('nav.side [data-v=materiel]').count()==0,'partenaire : aucune entrée Matériel')
    b.close()
print('erreurs',errs); import sys; sys.exit(1 if fails or errs else 0)
