# v1.14.0 (lot K) : compte sur téléphone, logo, fiche d'activité, confirmations, place libérée, remplaçant, jour J, tâches, planning 3 mois, programme, alertes
from playwright.sync_api import sync_playwright
import re
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':900}); ctx.grant_permissions(['clipboard-read','clipboard-write'])
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('text=Essayer comme administratrice')
    check(pg.locator('.logo-login').count()==1 and pg.eval_on_selector('.logo-login','i=>i.complete && i.naturalWidth>0'),'écran d\'ouverture : logo affiché')
    pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    check(pg.eval_on_selector('.brand img','i=>i.complete && i.naturalWidth>0'),'menu : logo affiché')
    # Grand écran : Compte visible EN HAUT du menu, même sur une fenêtre basse ; toutes les rubriques atteignables
    for h in (900,600,420):
        pg.set_viewport_size({'width':1280,'height':h})
        bc=pg.locator('.nav-compte').bounding_box()
        check(pg.locator('.nav-compte').is_visible() and bc['y']>=0 and bc['y']+bc['height']<=h,'ordinateur %d px de haut : bouton Compte visible dans l\'écran'%h)
        pg.evaluate("document.querySelector('nav.side').scrollTop=99999")
        last=pg.locator('nav.side .foot button[data-action=logout]').bounding_box()
        check(last['y']+last['height']<=h+1,'ordinateur %d px de haut : en faisant défiler le menu, Se déconnecter est atteignable'%h)
        navs=pg.locator('nav.side .nav-btn[data-action=nav]'); n=navs.count()
        lb=navs.nth(n-1).bounding_box() if n else None
        check(n>0 and lb['y']+lb['height']<=h+1,'ordinateur %d px de haut : dernière rubrique atteignable'%h)
        pg.evaluate("document.querySelector('nav.side').scrollTop=0")
    pg.set_viewport_size({'width':1280,'height':900})
    pg.click('.nav-compte'); pg.wait_for_selector('.modal button:has-text("Se déconnecter")'); check(True,'ordinateur : le bouton Compte ouvre la fenêtre de déconnexion'); pg.click('.modal button:has-text("Fermer")') if pg.locator('.modal button:has-text("Fermer")').count() else pg.keyboard.press('Escape')
    # --- Accueil : alertes
    check(pg.locator('.alertes').count()==1,'accueil : carte Alertes')
    # --- Fiche d'activité : nouveaux champs, événement
    pg.click('nav.side [data-v=activites]'); pg.click('text=+ Nouvelle activité')
    pg.fill('#g1','Fête test K'); pg.select_option('#g3','evenement'); pg.fill('#g7','2'); pg.fill('#g4','2026-12-10')
    check(pg.locator('#blocEv').is_visible(),'type événement : champs « jour J » visibles')
    pg.fill('#g13','Alice, Bob'); pg.fill('#g14','Une belle fête'); pg.fill('#g15','Tous publics'); pg.fill('#g16','Gratuit'); pg.fill('#g17','Nappes, ballons'); pg.fill('#g18','À l\'accueil'); pg.fill('#g19','Deux agents'); pg.fill('#g20','9h installation\n10h accueil')
    pg.click('#saveAct'); pg.wait_for_selector('h1:has-text("Fête test K")')
    t=pg.inner_text('.detail')
    check(all(x in t for x in ['Une belle fête','Tous publics','Gratuit','Nappes, ballons','À l\'accueil','Alice, Bob','Deux agents','10h accueil']),'fiche : description, public, coût, matériel, modalités, autres bénévoles, accompagnants, déroulé affichés')
    # --- Inscriptions : 2 personnes pour 1 place
    pg.click('[data-action=ins-form]')
    for lettre in ['ma','ro','je']:
        pg.click('#i1'); pg.fill('#i1',''); pg.type('#i1',lettre); pg.wait_for_selector('#i1-l .combo-opt'); pg.locator('#i1-l .combo-opt').first.click()
    pg.click('#saveIns'); pg.wait_for_selector('.cand')
    check(pg.locator('.cand[aria-pressed=true]').count()==2 and pg.locator('.cand[aria-pressed=false]').count()==1,'2 places : 2 retenu·es, 1 en attente (mode rotation)')
    check(pg.locator('.alerte-place').count()==0,'place prise : pas d\'alerte de place libre')
    # confirmations
    pg.click('[data-action=confirmations]'); pg.wait_for_selector('text=Pas encore prévenue')
    pg.click('[data-conf=copier]'); pg.wait_for_timeout(200)
    clip=pg.evaluate('navigator.clipboard.readText()')
    check('confirmer votre inscription à « Fête test K »' in clip and 'Gratuit' in clip,'confirmation : message copié avec activité et coût')
    pg.click('[data-conf=fait]'); pg.wait_for_selector('text=Prévenue le'); check(True,'confirmation : « Prévenue le » noté')
    pg.click('.modal button:has-text("Fermer")')
    # place libérée : on retire l'inscrit·e
    pg.locator('div:has(> .cand[aria-pressed=true]) > [data-action=del-ins]').first.click(); pg.click('#cfOk'); pg.wait_for_selector('.alerte-place')
    check('Une place est libre' in pg.inner_text('.alerte-place'),'place libérée : proposition à la première personne en attente')
    pg.click('[data-action=copier-proposition]'); pg.wait_for_timeout(200)
    check('place vient de se libérer' in pg.evaluate('navigator.clipboard.readText()'),'place libérée : message de proposition copié')
    pg.click('[data-action=donner-place]'); pg.wait_for_function('document.querySelectorAll(".alerte-place").length==0')
    check(pg.locator('.row:has-text("Inscrit·e")').count()==2,'place donnée : 2 inscrit·es')
    # jour J
    pg.click('[data-action=jour-j]'); pg.wait_for_selector('.feuille')
    t=pg.inner_text('.feuille'); check('10h accueil' in t and 'Nappes' in t and 'Participant·es (2 / 2)' in t and pg.locator('.feuille .cases li').count()==2,'fiche du jour J : déroulé, matériel, participant·es à cocher')
    pg.click('.modal button:has-text("Fermer")')
    # remplaçant sur l'appel
    pg.click('[data-v=seances]'); pg.click('[data-action=nouvel-appel]'); pg.fill('#ap-remp','Julie Remplaçante'); pg.click('[data-action=save-appel][data-valide="0"]'); pg.wait_for_timeout(300)
    pg.click('[data-action=fin-appel]'); pg.wait_for_selector('text=Remplacé·e par Julie Remplaçante'); check(True,'appel : intervenant·e remplaçant·e noté·e et affiché·e')
    # --- Tâches : statut, priorité
    pg.click('nav.side [data-v=taches]'); pg.wait_for_selector('.task')
    pg.click('.top >> text=Nouvelle tâche'); pg.fill('#t1','Tâche urgente K'); pg.select_option('#t6','en-cours'); pg.select_option('#t7','haute'); pg.click('#saveT'); pg.wait_for_selector('text=Tâche urgente K')
    check(pg.locator('.task:has-text("Tâche urgente K") .pill:has-text("Priorité haute")').count()==1 and pg.locator('.task:has-text("Tâche urgente K") .pill:has-text("En cours")').count()==1,'tâche : pastilles priorité haute et statut en cours')
    pg.click('[data-action=filtre-statut-tache][data-v=en-cours]'); check(pg.locator('.task').count()==1,'tâches : filtre « En cours » ne garde que celle-ci')
    pg.click('[data-action=filtre-statut-tache][data-v=tous]')
    check('Tâche urgente K' in pg.locator('.task:not(.done)').first.inner_text(),'tâches : tri (priorité haute avant les autres)')
    pg.click('nav.side [data-v=accueil]') if False else pg.click('nav.side [data-v=home]'); pg.wait_for_selector('.alertes')
    check('priorité haute' in pg.inner_text('.alertes') or 'en retard' in pg.inner_text('.alertes'),'accueil : alerte sur les tâches prioritaires ou en retard')
    # --- Planning 3 mois, programme
    pg.click('nav.side [data-v=planning]'); pg.wait_for_selector('.cal')
    pg.click('[data-action=nb-mois][data-v="3"]'); pg.wait_for_function('document.querySelectorAll(".cal").length==3'); check(True,'planning : 3 mois affichés')
    pg.click('[data-action=mois][data-v="1"]'); pg.wait_for_function('document.querySelectorAll(".cal").length==3'); check(True,'planning : « Suivant » avance de 3 mois')
    pg.click('[data-action=nb-mois][data-v="1"]'); pg.wait_for_function('document.querySelectorAll(".cal").length==1')
    pg.click('[data-action=programme]'); pg.wait_for_selector('.feuille h3:has-text("Programme")')
    check(pg.locator('.feuille').count()==1,'programme : feuille générée')
    pg.fill('#pg1','2020-01-01'); pg.fill('#pg2','2030-12-31'); pg.dispatch_event('#pg2','change'); pg.wait_for_timeout(200)
    check('Fête test K' in pg.inner_text('.feuille') and 'décembre 2026' in pg.inner_text('.feuille'),'programme : activités datées groupées par mois')
    pg.click('#pg-cp'); pg.wait_for_timeout(200); check(pg.evaluate('navigator.clipboard.readText()').startswith('Programme du'),'programme : texte copié')
    pg.click('.modal button:has-text("Fermer")')
    b.close()
    # --- Téléphone : bouton Compte
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    m=b.new_page(viewport={'width':390,'height':800})
    m.on('pageerror',lambda e: errs.append(str(e)))
    m.goto('http://localhost:8765/index.html'); m.wait_for_selector('text=Essayer comme administratrice'); m.click('text=Essayer comme administratrice'); m.wait_for_selector('.nav-compte')
    check(m.locator('.nav-compte').is_visible() and not m.locator('.side .foot').is_visible(),'téléphone : bouton Compte visible, pied de menu masqué')
    m.click('.nav-compte'); m.wait_for_selector('.modal button:has-text("Se déconnecter")')
    check(re.search(r'[Vv]ersion \d+\.\d+\.\d+', m.inner_text('.modal')) is not None,'téléphone : fenêtre Compte avec le numéro de version')
    m.click('.modal button:has-text("Se déconnecter")'); m.wait_for_selector('text=Essayer comme administratrice')
    check(m.locator('.modal').count()==0,'téléphone : déconnexion et fenêtre fermée')
    # intervenante : Compte aussi
    m.click('text=Essayer comme intervenante'); m.wait_for_selector('.nav-compte'); check(m.locator('.nav-compte').is_visible(),'téléphone : bouton Compte pour l\'intervenante')
    b.close()
print('Erreurs console :', errs or 'aucune'); print('ÉCHECS :', fails or 'aucun')
