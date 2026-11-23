# v1.19.0 (lot B) : portage de repas — démonstration (administratrice, intervenante, bénévole, partenaire), mobile, aucune donnée de santé
from playwright.sync_api import sync_playwright
import re
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
SANTE=re.compile(r'hospital|maladie|décès|deces|EHPAD|médic|diagnostic|traitement|allerg|handicap',re.I)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':900}); pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(800)
    check('Portage : 1 reprise prévue dépassée' in pg.inner_text('.alertes') and 'Portage : 1 suite à donner' in pg.inner_text('.alertes'),'accueil : alertes du portage (reprise dépassée, suite à donner)')
    pg.click('.alertes button:has-text("suite à donner avec le prestataire")'); pg.wait_for_selector('#liste-ech'); check('Changement' in pg.inner_text('#liste-ech') or 'banquet' in pg.inner_text('#liste-ech'),'l\'alerte « suite à donner » ouvre l\'onglet Échanges')
    pg.click('[data-action=pg-tab][data-v=beneficiaires]'); pg.wait_for_selector('#liste-pg'); t=pg.inner_text('#main')
    check('En service (4)' in t and 'Interrompus (2)' in t and 'Arrêtés (1)' in t and 'Tous (5)' in t,'compteurs des filtres : 4 en service, 2 interrompus, 1 arrêté')
    check('Reprise prévue le' in t and 'dépassée' in t and 'Changement de rythme de livraison' in t,'interruptions : reprise prévue, motif')
    check(not SANTE.search(t),'aucun mot de santé à l\'écran')
    pg.click('[data-action=pg-filtre][data-v=arrete]'); pg.wait_for_timeout(300); check('Arrêté le' in pg.inner_text('#liste-pg') and 'Changement de lieu de vie' in pg.inner_text('#liste-pg'),'arrêté : date et motif d\'organisation')
    # statistiques de l'année
    pg.click('[data-action=pg-tab][data-v=stats]'); pg.wait_for_selector('text=Sorties définitives'); t=pg.inner_text('#main')
    check('Interruptions temporaires' in t and 'Hommes' in t and '90 ans et plus' in t,'statistiques affichées')
    check(pg.locator('[data-action=pg-xlsx]').count()==1 and pg.locator('[data-action=pg-pdf]').count()==1,'exports réservés à l\'administratrice : présents')
    # module désactivable
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-m-portage'); check(pg.is_checked('#p-m-portage'),'Paramètres : module Portage actif par défaut')
    check('Entreprise de restauration' in pg.inner_text('#main') and 'tout motif de santé' in pg.inner_text('#main'),'Paramètres : prestataire et avertissement sur les motifs')
    pg.uncheck('#p-m-portage'); pg.click('[data-action=param-save]'); pg.wait_for_timeout(600)
    check(pg.locator('nav.side [data-v=portage]').count()==0 and 'Portage :' not in (pg.click('nav.side [data-v=home]') or pg.wait_for_timeout(500) or pg.inner_text('.alertes')),'module désactivé : menu et alertes disparaissent')
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-m-portage'); pg.check('#p-m-portage'); pg.click('[data-action=param-save]'); pg.wait_for_timeout(600)
    check(pg.locator('nav.side [data-v=portage]').count()==1,'module réactivé')
    # sauvegarde Excel : onglets du portage
    pg.click('nav.side [data-v=sauvegarde]'); pg.wait_for_timeout(500)
    # équipe
    for qui,lib in (('intervenant','intervenante'),('benevole','bénévole')):
        pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante' if qui=='intervenant' else 'text=Essayer comme bénévole'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
        check(pg.locator('nav.side [data-v=portage]').count()==1,lib+' : menu Portage'); pg.click('nav.side [data-v=portage]'); pg.wait_for_selector('#liste-pg'); pg.wait_for_timeout(500)
        t=pg.inner_text('#main'); check('Vasseur' in t or 'Delcourt' in t or 'Dumont' in t,lib+' : voit les bénéficiaires')
        check(pg.locator('[data-type=interruption]').count()>=1 or pg.locator('[data-type=reprise]').count()>=1,lib+' : peut interrompre ou reprendre')
        pg.click('[data-action=pg-tab][data-v=stats]'); pg.wait_for_selector('text=Sorties définitives'); check(pg.locator('[data-action=pg-xlsx]').count()==0,lib+' : pas d\'export')
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme partenaire'); pg.click('text=Essayer comme partenaire'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side [data-v=portage]').count()==0,'partenaire : pas de menu Portage')
    # mobile : pas de débordement horizontal sur l'écran Portage
    m=b.new_context(viewport={'width':390,'height':800}).new_page(); m.goto('http://localhost:8765/index.html'); m.evaluate("localStorage.clear()"); m.reload(); m.wait_for_selector('text=Essayer comme administratrice'); m.click('text=Essayer comme administratrice'); m.wait_for_selector('nav.side'); m.wait_for_timeout(500)
    m.evaluate("import('/js/ui.js').then(u=>u.go('portage'))"); m.wait_for_selector('#liste-pg'); m.wait_for_timeout(400)
    check(m.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'mobile : pas de défilement horizontal (bénéficiaires)')
    m.click('[data-action=pg-tab][data-v=stats]'); m.wait_for_timeout(400); check(m.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'mobile : pas de défilement horizontal (statistiques)')
    m.click('[data-action=pg-tab][data-v=echanges]'); m.wait_for_timeout(400); check(m.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'mobile : pas de défilement horizontal (échanges)')
    check(len(errs)==0,'aucune erreur console : '+str(errs[:3]))
    print('erreurs',errs); print('ÉCHECS :',fails or 'aucun')
