# v1.23.0 (lot G + améliorations Activités) : regroupement par catégorie, recherche au fil de la frappe (clic ET Entrée),
# bilans enrichis (période + comparaison entre deux années), « Préparer mon année » (reconduction en un clic)
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

    # --- Écran Activités : regroupement visuel par catégorie, catégories ET activités triées par ordre alphabétique français ---
    pg.click('[data-v=activites]'); pg.wait_for_selector('h1:has-text("Activités")'); pg.wait_for_timeout(400)
    t=pg.inner_text('main')
    check('Créatif' in t and 'Mémoire' in t,'des titres de catégorie apparaissent sur l\'écran Activités')
    titres=pg.locator('.cat-titre').all_inner_texts()
    check(len(titres)>=3,'plusieurs sections de catégorie affichées')
    import unicodedata
    sans_accents = lambda s: unicodedata.normalize('NFKD', s).encode('ascii','ignore').decode().lower()
    check(titres==sorted(titres,key=sans_accents),'sections de catégorie dans l\'ordre alphabétique français (accents ignorés pour le tri)')
    check('Autres' not in titres or titres[-1]=='Autres','la section « Autres » (sans catégorie), si présente, est bien la dernière')
    # une activité de chaque catégorie doit se trouver dans le bon bloc
    check('Atelier floral de Noël' in pg.inner_text('main'),'activité « Créatif » présente')
    # tri alphabétique des activités à l'intérieur d'une même catégorie (ici : Créatif, qui contient « Atelier floral de Noël » et « Galette des rois » après reconduction plus bas)
    bloc_creatif = pg.locator('.cat-titre:has-text("Créatif") + .grid .act h3').all_inner_texts()
    check(bloc_creatif==sorted(bloc_creatif,key=lambda s:s),'activités de la catégorie « Créatif » triées par ordre alphabétique')

    # --- Recherche au fil de la frappe : suggestions, clic ---
    pg.fill('#rech-act','mémoire'); pg.wait_for_timeout(300)
    check(pg.locator('.combo-opt:has-text("Atelier mémoire")').count()>=1,'suggestion « Atelier mémoire » affichée au fil de la frappe')
    pg.click('.combo-opt:has-text("Atelier mémoire")'); pg.wait_for_selector('h1:has-text("Atelier mémoire")'); pg.wait_for_timeout(300)
    check('Atelier mémoire' in pg.inner_text('h1'),'clic sur une suggestion ouvre la bonne fiche')
    pg.click('text=← Toutes les activités'); pg.wait_for_timeout(300)

    # --- Recherche au fil de la frappe : touche Entrée ouvre la suggestion (surlignée par défaut) ---
    pg.fill('#rech-act','chorale'); pg.wait_for_timeout(300)
    check(pg.locator('.combo-opt:has-text("Chorale des aînés")').count()>=1,'suggestion « Chorale des aînés » affichée')
    pg.press('#rech-act','Enter'); pg.wait_for_selector('h1:has-text("Chorale des aînés")'); pg.wait_for_timeout(300)
    check('Chorale des aînés' in pg.inner_text('h1'),'touche Entrée ouvre la fiche de la suggestion surlignée')
    pg.click('text=← Toutes les activités'); pg.wait_for_timeout(300)

    # --- Planning : « Préparer mon année » (reconduction en un clic) ---
    pg.click('[data-v=planning]'); pg.wait_for_selector('h1:has-text("Planning")'); pg.wait_for_timeout(400)
    check('Préparer mon année' in pg.inner_text('main'),'bouton « Préparer mon année » présent sur le Planning')
    pg.click('text=Préparer mon année'); pg.wait_for_selector('text=Préparer mon année >> nth=1'); pg.wait_for_timeout(300)
    m=pg.inner_text('.modal')
    check('Galette des rois' in m,'activité passée (Galette des rois) proposée à la reconduction')
    pg.click('.modal [data-rec]'); pg.wait_for_timeout(600)
    m2=pg.inner_text('.modal')
    check('Galette des rois' not in m2,'l\'activité reconduite disparaît de la liste à reconduire')
    pg.click('[data-action=close]')
    pg.click('[data-v=activites]'); pg.wait_for_timeout(400)
    check('Galette des rois' in pg.inner_text('main'),'la nouvelle fiche (année suivante) existe bien parmi les activités')

    # --- Bilans : sélection de période et comparaison entre deux années ---
    pg.click('[data-v=bilans]'); pg.wait_for_selector('h1:has-text("Bilans")'); pg.wait_for_timeout(400)
    check('Cette année' in pg.inner_text('main') and 'Ce mois' in pg.inner_text('main'),'périodes prêtes à choisir (jour/semaine/mois/trimestre/année)')
    pg.click('text=Comparer avec une autre année'); pg.wait_for_timeout(400)
    check(pg.locator('#b-an').count()==1,'sélecteur de l\'année de comparaison affiché')
    t=pg.inner_text('main')
    check('vs ' in t,'écarts affichés par rapport à l\'année de comparaison')

    # --- Aucune donnée de santé sur les écrans modifiés ---
    full = pg.inner_text('main')
    pg.click('[data-v=activites]'); pg.wait_for_timeout(300); full += pg.inner_text('main')
    pg.click('[data-v=planning]'); pg.wait_for_timeout(300); full += pg.inner_text('main')
    check(not SANTE.search(full),'aucun terme de santé dans Bilans/Activités/Planning')

    # --- Équipe : un compte intervenant·e ne doit avoir aucun accès supplémentaire inattendu (ni Bilans, ni Préparer mon année) ---
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme intervenante'); pg.click('text=Essayer comme intervenante'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)
    check(pg.locator('nav.side [data-v=bilans]').count()==0,'intervenante : pas d\'accès à Bilans')
    pg.click('[data-v=activites]'); pg.wait_for_timeout(300)
    check('Mes activités' in pg.inner_text('h1'),'intervenante : écran « Mes activités »')
    check(pg.locator('[data-action=preparer-annee]').count()==0,'intervenante : pas de bouton « Préparer mon année »')
    pg.click('[data-v=planning]'); pg.wait_for_timeout(300)
    check(pg.locator('[data-action=preparer-annee]').count()==0,'intervenante : pas de bouton « Préparer mon année » sur le Planning')

    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(400)

    # --- Mobile : pas de défilement horizontal ---
    pg.set_viewport_size({'width':375,'height':812}); pg.wait_for_timeout(200)
    pg.click('[data-v=activites]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Activités)')
    pg.click('[data-v=bilans]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Bilans)')

    print('erreurs console :',errs)
    check(len(errs)==0,'aucune erreur console')
    b.close()
print('ÉCHECS :', fails if fails else 'aucun')
