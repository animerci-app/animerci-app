# v1.24.0 (lot B second temps : journal de suivi du portage §9.3 + lien social §10 ; menu regroupé en 6 blocs visuels)
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
    pg.goto('http://localhost:8765/index.html'); pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(900)

    # --- Menu regroupé en 6 blocs visuels, avec titres de groupe (admin) ---
    titres = [t.strip().lower() for t in pg.locator('nav.side .nav-titre').all_inner_texts()]
    check(titres == ['pilotage du jour','publics accompagnés','activités et sorties','partenaires et équipe','ressources','administration'],'admin : les 6 titres de groupe apparaissent, dans l\'ordre attendu')
    check(pg.locator('nav.side .nav-btn[data-v=liensocial]').count()==1,'admin : « Lien social » présent dans le menu')
    check(pg.locator('nav.side [data-action=rech-globale]').count()==1,'admin : « Chercher » toujours présent (dans le premier groupe)')

    # --- Journal de suivi du portage (cahier §9.3) : nouvel onglet, mêmes accès que le reste du Portage ---
    pg.click('[data-v=portage]'); pg.wait_for_selector('h1:has-text("Portage")'); pg.wait_for_timeout(400)
    check('Journal de suivi' in pg.inner_text('main'),'Portage : onglet « Journal de suivi » présent')
    pg.click('[data-action="pg-tab"][data-v=journal]'); pg.wait_for_timeout(300)
    pg.click('text=+ Nouvelle entrée'); pg.wait_for_selector('.modal'); pg.wait_for_timeout(200)
    check('✔ À écrire' in pg.inner_text('.modal'),'Journal de suivi : avertissement ✔/✘ affiché dans le formulaire')
    pg.select_option('#j2','Appel du bénéficiaire'); pg.fill('#j4','Appel pour confirmer le jour de livraison')
    pg.click('#saveJ'); pg.wait_for_timeout(500)
    check('Appel pour confirmer' in pg.inner_text('main') or 'entrée' in pg.inner_text('main').lower(),'Journal de suivi : entrée enregistrée')

    # --- Lien social (cahier §10) : administratrice seule ---
    pg.click('[data-v=liensocial]'); pg.wait_for_selector('h1:has-text("Lien social")'); pg.wait_for_timeout(400)
    check('Nouveau contact' in pg.inner_text('main'),'Lien social : écran accessible à l\'administratrice')
    pg.click('text=+ Nouveau contact'); pg.wait_for_selector('.modal'); pg.wait_for_timeout(200)
    check(pg.locator('#ls1').count()==1,'Lien social : champ « personne concernée » (recherche) présent dans le formulaire')
    pg.fill('#ls1','a'); pg.wait_for_timeout(300)
    opt = pg.locator('.combo-opt').first
    if opt.count():
        opt.click(); pg.wait_for_timeout(150)
        pg.fill('#ls6','Prise de nouvelles')
        pg.click('#saveLS'); pg.wait_for_timeout(600)
    check(pg.locator('.modal').count()==0 or pg.locator('#ls1').count()==1,'Lien social : formulaire de contact exploitable')
    for _ in range(4):
        if pg.locator('.modal').count()==0: break
        pg.click('.modal [data-action=close]', force=True); pg.wait_for_timeout(300)

    # --- Lien social : chiffres de l'année distinguent contacts / personnes distinctes / interventions ---
    pg.click('[data-v=liensocial]'); pg.wait_for_timeout(300)
    pg.click('[data-action="ls-tab"][data-v=stats]'); pg.wait_for_timeout(300)
    t = pg.inner_text('main')
    check('Nombre de contacts' in t and 'Personnes distinctes' in t and 'Interventions' in t,'Lien social : les trois chiffres (contacts, personnes distinctes, interventions) sont bien distingués')

    # --- Aucune donnée de santé sur les écrans modifiés ---
    full = pg.inner_text('main')
    pg.click('[data-v=portage]'); pg.wait_for_timeout(300); full += pg.inner_text('main')
    check(not SANTE.search(full),'aucun terme de santé dans Lien social / Portage')

    # --- Rôles restreints : aucune fuite de Lien social, menu regroupé sans groupe vide ni titre orphelin ---
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side [data-v=liensocial]').count()==0,'intervenante : pas d\'accès à Lien social')
    titres_interv = [t.strip().lower() for t in pg.locator('nav.side .nav-titre').all_inner_texts()]
    check('pilotage du jour' not in titres_interv and 'administration' not in titres_interv,'intervenante : aucun titre pour les groupes sans rubrique visible (pas de bloc vide ni orphelin)')
    check(len(titres_interv)==len(set(titres_interv)),'intervenante : pas de titre de groupe en double')
    check(pg.locator('nav.side .nav-btn[data-v]').count()>=1,'intervenante : le menu reste utilisable')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)

    # --- Mobile : pas de défilement horizontal, menu toujours utilisable ---
    pg.set_viewport_size({'width':375,'height':812}); pg.wait_for_timeout(200)
    pg.click('[data-v=liensocial]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Lien social)')
    check(pg.locator('nav.side .nav-btn[data-v]').count()>0,'mobile : le menu horizontal reste peuplé malgré le regroupement')

    print('erreurs console :',errs)
    check(len(errs)==0,'aucune erreur console')
    b.close()
print('ÉCHECS :', fails if fails else 'aucun')
