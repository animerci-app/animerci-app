# v1.22.0 (lot J) : démonstration — questionnaires et sondages, bibliothèque des voyages et sorties, administratrice seule, aucune donnée de santé
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

    # --- Écran Questionnaires ---
    pg.click('[data-v=questionnaires]'); pg.wait_for_selector('h1:has-text("Questionnaires")'); pg.wait_for_timeout(400)
    t=pg.inner_text('main')
    check('Satisfaction de l\'atelier floral' in t,'questionnaire de démonstration affiché')
    check('Aucune diffusion en ligne' in t,'rappel : aucune diffusion en ligne, aucun envoi automatique')
    pg.click('text=+ Nouveau questionnaire'); pg.wait_for_selector('#qf1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'avertissement champ libre présent sur la fiche questionnaire')
    pg.fill('#qf1','Test questionnaire'); pg.fill('.qtexte','Question de test ?'); pg.click('#saveQ'); pg.wait_for_timeout(500)
    check('Test questionnaire' in pg.inner_text('main'),'nouveau questionnaire enregistré et affiché (détail ouvert)')
    pg.click('text=← Tous les questionnaires'); pg.wait_for_timeout(300)
    check('Test questionnaire' in pg.inner_text('main'),'nouveau questionnaire présent dans la liste')

    # Ouvrir le questionnaire de démonstration : réponses puis résultats
    pg.click('text=Satisfaction de l\'atelier floral'); pg.wait_for_selector('h1:has-text("Satisfaction")'); pg.wait_for_timeout(300)
    t=pg.inner_text('main')
    check('réponse' in t.lower(),'onglet Réponses : réponses de démonstration affichées')
    pg.click('text=Résultats'); pg.wait_for_timeout(300)
    t=pg.inner_text('main')
    check('%' in t,'onglet Résultats : pourcentages compilés affichés')
    check('Excel' in t and 'PDF' in t,'exports Excel et PDF proposés dans les résultats')

    # Saisir une nouvelle réponse reçue
    pg.click('text=Réponses'); pg.wait_for_timeout(200)
    pg.click('text=+ Saisir une réponse reçue'); pg.wait_for_selector('#rd1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'avertissement champ libre présent sur la fiche réponse')
    pg.click('#saveR'); pg.wait_for_timeout(500)
    check('Réponse du' in pg.inner_text('main'),'nouvelle réponse enregistrée et affichée')

    # --- Écran Voyages et sorties ---
    pg.click('[data-v=voyages]'); pg.wait_for_selector('h1:has-text("voyages et sorties")'); pg.wait_for_timeout(400)
    t=pg.inner_text('main')
    check('Bruxelles' in t,'sortie de démonstration affichée')
    check('Comparaison' in t,'comparaison d\'une année sur l\'autre affichée')
    pg.fill('#rech-vy','Bruxelles'); pg.wait_for_timeout(300)
    check('Bruxelles' in pg.inner_text('#liste-vy') and 'Opale' not in pg.inner_text('#liste-vy'),'recherche par destination déjà visitée fonctionne')
    pg.fill('#rech-vy',''); pg.wait_for_timeout(300)
    pg.click('text=+ Nouvelle sortie'); pg.wait_for_selector('#v1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'avertissement champ libre présent sur la fiche sortie')
    pg.fill('#v1','Test destination'); pg.fill('#v7','12'); pg.fill('#v8','99'); pg.click('#saveV'); pg.wait_for_timeout(500)
    check('Test destination' in pg.inner_text('main'),'nouvelle sortie enregistrée et affichée')

    # --- Aucune donnée de santé ---
    pg.click('[data-v=questionnaires]'); pg.wait_for_timeout(300)
    full1 = pg.inner_text('main')
    pg.click('[data-v=voyages]'); pg.wait_for_timeout(300)
    full2 = pg.inner_text('main')
    check(not SANTE.search(full1) and not SANTE.search(full2),'aucun terme de santé dans Questionnaires/Voyages')

    # --- Paramètres : modules désactivables ---
    pg.click('[data-v=parametres]'); pg.wait_for_selector('#p-qth'); pg.wait_for_timeout(300)
    check(pg.locator('#p-qth').count()==1,'thèmes de questionnaires réglables dans Paramètres')
    pg.uncheck('#p-m-questionnaires'); pg.uncheck('#p-m-voyages'); pg.click('[data-action=param-save]'); pg.wait_for_timeout(600)
    check(pg.locator('nav.side [data-v=questionnaires]').count()==0 and pg.locator('nav.side [data-v=voyages]').count()==0,'modules Questionnaires et Voyages désactivables : menu masqué')
    pg.check('#p-m-questionnaires'); pg.check('#p-m-voyages'); pg.click('[data-action=param-save]'); pg.wait_for_timeout(600)
    check(pg.locator('nav.side [data-v=questionnaires]').count()==1 and pg.locator('nav.side [data-v=voyages]').count()==1,'modules réactivés')

    # --- Équipe : aucun accès pour l'intervenante ni la bénévole ---
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side [data-v=questionnaires]').count()==0 and pg.locator('nav.side [data-v=voyages]').count()==0,'intervenante : ni Questionnaires ni Voyages')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme bénévole'); pg.click('text=Essayer comme bénévole'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side [data-v=questionnaires]').count()==0 and pg.locator('nav.side [data-v=voyages]').count()==0,'bénévole : ni Questionnaires ni Voyages')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    pg.click('nav.side [data-v=equipe]'); pg.wait_for_selector('[data-action=equipe-form]'); pg.wait_for_timeout(300); pg.click('.cand >> nth=0'); pg.wait_for_selector('#blocAcces'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('Questionnaires' not in m and 'Voyages' not in m,'aucune case « accès provisoire » Questionnaires/Voyages dans la fiche équipe')
    pg.click('[data-action=close]')

    # --- Mobile : pas de défilement horizontal ---
    pg.set_viewport_size({'width':375,'height':812}); pg.wait_for_timeout(200)
    pg.click('[data-v=questionnaires]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Questionnaires)')
    pg.click('[data-v=voyages]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Voyages)')

    print('erreurs console :',errs)
    check(len(errs)==0,'aucune erreur console')
    b.close()
print('ÉCHECS :', fails if fails else 'aucun')
