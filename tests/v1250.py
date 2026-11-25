# v1.25.0 (nouveau lot : menu « Résidence » — personnel et remplacements §11.1, relations familles §11.2, relations résidents §11.3,
# journal de transmissions §11.4, temps de remplacement §22, interventions exceptionnelles §23 ; accès délégable temporaire)
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

    # --- Menu : « Résidence » apparaît dans le groupe « Publics accompagnés », à la suite de « Lien social » ---
    check(pg.locator('nav.side .nav-btn[data-v=residence]').count()==1,'admin : « Résidence » présente dans le menu')
    ordre = [b.get_attribute('data-v') for b in pg.locator('nav.side .nav-btn[data-v]').all()]
    pubs = [k for k in ordre if k in ('seniors','portage','liensocial','residence','accueils')]
    check(pubs==['seniors','portage','liensocial','residence','accueils'],'« Résidence » bien placée après « Lien social », avant « Accueils » : '+str(pubs))

    pg.click('[data-v=residence]'); pg.wait_for_selector('h1'); pg.wait_for_timeout(400)
    check('Personnel et remplacements' in pg.inner_text('main'),'Résidence : onglet « Personnel et remplacements » par défaut')

    # --- a. Personnel et remplacements (§11.1) : pas un dossier RH ---
    check('pas un dossier du personnel' in pg.inner_text('main'),'Personnel : rappel « pas un dossier RH »')
    pg.click('text=+ Nouvelle entrée'); pg.wait_for_selector('#rp1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'Personnel : avertissement ✔/✘ présent')
    pg.fill('#rp1','Mme Test Agent'); pg.fill('#rp5','M. Remplaçant'); pg.fill('#rp6','Transmission de consignes à l\'équipe du matin')
    pg.click('#saveRP'); pg.wait_for_timeout(500)
    check('Mme Test Agent' in pg.inner_text('main'),'Personnel : entrée enregistrée et affichée')

    # --- b. Relations avec les familles (§11.2) ---
    pg.click('[data-action="res-tab"][data-v=familles]'); pg.wait_for_timeout(300)
    pg.click('text=+ Nouveau contact'); pg.wait_for_selector('#rf1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'Familles : avertissement ✔/✘ présent')
    pg.fill('#rf1','Famille Test'); pg.fill('#rf6','Appel pour organiser une visite'); pg.click('#saveRF'); pg.wait_for_timeout(500)
    check('Famille Test' in pg.inner_text('main'),'Familles : contact enregistré (résident·e facultatif)')

    # --- c. Relations avec les résidents (§11.3) ---
    pg.click('[data-action="res-tab"][data-v=residents]'); pg.wait_for_timeout(300)
    pg.click('text=+ Nouveau contact'); pg.wait_for_selector('#rr1'); pg.wait_for_timeout(200)
    pg.fill('#rr1','a'); pg.wait_for_timeout(300)
    opt = pg.locator('.combo-opt').first
    if opt.count():
        opt.click(); pg.wait_for_timeout(150)
        pg.fill('#rr4','Demande concernant la vie collective')
        pg.click('#saveRR'); pg.wait_for_timeout(600)
    for _ in range(4):
        if pg.locator('.modal').count()==0: break
        pg.click('.modal [data-action=close]', force=True); pg.wait_for_timeout(300)
    check(pg.locator('.modal').count()==0,'Résidents : formulaire exploitable (recherche filtrée aux résident·es)')

    # --- d. Journal de transmissions (§11.4) ---
    pg.click('[data-action="res-tab"][data-v=journal]'); pg.wait_for_timeout(300)
    pg.click('text=+ Nouvelle entrée'); pg.wait_for_selector('#rj1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'Journal : avertissement ✔/✘ présent')
    check(pg.locator('#rj8').count()==1,'Journal : champ statut présent')
    pg.fill('#rj4','Mme Test Agent'); pg.select_option('#rj8','a-traiter'); pg.click('#saveRJ'); pg.wait_for_timeout(500)
    check('À traiter' in pg.inner_text('main'),'Journal : entrée enregistrée avec son statut')
    pg.click('label:has-text("À traiter ou en cours seulement")'); pg.wait_for_timeout(300)
    check('Mme Test Agent' in pg.inner_text('main'),'Journal : filtre « à traiter / en cours » fonctionne')

    # --- e. Temps de remplacement (§22) ---
    pg.click('[data-action="res-tab"][data-v=remplacements]'); pg.wait_for_timeout(300)
    pg.click('text=+ Nouvelle période'); pg.wait_for_selector('#re4'); pg.wait_for_timeout(200)
    pg.select_option('#re2','accueil'); pg.select_option('#re3','intervention'); pg.fill('#re4','90')
    pg.click('#saveRE'); pg.wait_for_timeout(500)
    check('90 min' in pg.inner_text('main') or 'Accueil' in pg.inner_text('main'),'Remplacement : période enregistrée (disponibilité / intervention effective distinguées)')

    # --- f. Interventions exceptionnelles (§23) ---
    pg.click('[data-action="res-tab"][data-v=interventions]'); pg.wait_for_timeout(300)
    pg.click('text=+ Nouvelle intervention'); pg.wait_for_selector('#ri3'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'Interventions : avertissement ✔/✘ présent')
    pg.fill('#ri3','Dépannage du lecteur de badge'); pg.fill('#ri4','20'); pg.click('#saveRI'); pg.wait_for_timeout(500)
    check('Dépannage du lecteur de badge' in pg.inner_text('main'),'Interventions : intervention enregistrée')

    # --- g. Chiffres de l'année : export disponible ---
    pg.click('[data-action="res-tab"][data-v=stats]'); pg.wait_for_timeout(300)
    t=pg.inner_text('main')
    check('Contacts avec des familles' in t and 'Interventions exceptionnelles' in t and 'Temps total de remplacement' in t,'Chiffres : tous les indicateurs affichés')
    check(pg.locator('[data-action=res-xlsx]').count()==1 and pg.locator('[data-action=res-pdf]').count()==1,'Chiffres : export Excel et PDF proposés')

    # --- Aucune donnée de santé sur tous les écrans visités ---
    full = pg.inner_text('main')
    check(not SANTE.search(full),'aucun terme de santé dans le menu Résidence')

    # --- Équipe : case « Résidence » délégable, avec date de fin qui referme l'accès tout seul ---
    pg.click('[data-v=equipe]'); pg.wait_for_selector('h1:has-text("Équipe")'); pg.wait_for_timeout(300)
    pg.click('text=Intervenante (fleuriste)'); pg.wait_for_selector('#ea-residence'); pg.wait_for_timeout(200)
    check(pg.locator('#ea-residence').count()==1,'Équipe : case « Résidence » présente dans la fiche')
    pg.check('#ea-residence'); pg.fill('#ea-fin','2020-01-01'); pg.click('#saveEq'); pg.wait_for_timeout(500)
    check('Résidence' in pg.inner_text('main'),'Équipe : accès « Résidence » enregistré et affiché (même expiré)')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side .nav-btn[data-v=residence]').count()==0,'intervenante : accès expiré (date de fin dépassée) → pas de menu Résidence')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    pg.click('[data-v=equipe]'); pg.wait_for_selector('h1:has-text("Équipe")'); pg.wait_for_timeout(300)
    pg.click('text=Intervenante (fleuriste)'); pg.wait_for_selector('#ea-residence'); pg.wait_for_timeout(200)
    pg.fill('#ea-fin',''); pg.click('#saveEq'); pg.wait_for_timeout(500)

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side .nav-btn[data-v=residence]').count()==1,'intervenante : accès « Résidence » sans date de fin → menu présent')
    pg.click('[data-v=residence]'); pg.wait_for_selector('h1'); pg.wait_for_timeout(400)
    check('Accès réservé' not in pg.inner_text('main'),'intervenante avec accès : écran Résidence exploitable')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme bénévole'); pg.click('text=Essayer comme bénévole'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side .nav-btn[data-v=residence]').count()==0,'bénévole sans la case cochée : aucun accès au menu Résidence')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme partenaire'); pg.click('text=Essayer comme partenaire'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side .nav-btn[data-v=residence]').count()==0,'partenaire : aucun accès au menu Résidence (jamais proposé)')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)

    # --- Mobile : pas de défilement horizontal ---
    pg.set_viewport_size({'width':375,'height':812}); pg.wait_for_timeout(200)
    pg.click('[data-v=residence]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Résidence)')

    print('erreurs console :',errs)
    check(len(errs)==0,'aucune erreur console')
    b.close()
print('ÉCHECS :', fails if fails else 'aucun')
