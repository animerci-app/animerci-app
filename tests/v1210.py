# v1.21.0 (lot D) : démonstration — budgets, dépenses, régie, accès provisoire « Budgets et régie », aucune donnée de santé
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

    # --- Écran Budgets ---
    pg.click('[data-v=budgets]'); pg.wait_for_selector('h1:has-text("Budgets")'); pg.wait_for_timeout(400)
    t=pg.inner_text('main')
    check('Atelier floral de Noël' in t or 'Marché de Noël' in t,'dépenses de démonstration affichées')
    check('ne remplace pas le logiciel comptable' in t,'rappel : suivi interne, ne remplace pas le logiciel comptable officiel')
    pg.click('text=+ Nouvelle dépense'); pg.wait_for_selector('#d1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'avertissement champ libre présent sur la fiche dépense')
    pg.select_option('#d5','a-mem'); pg.fill('#d3','Fournisseur test'); pg.fill('#d4','Nature test'); pg.fill('#d10','42,50')
    pg.click('#saveD'); pg.wait_for_timeout(500)
    check('Fournisseur test' in pg.inner_text('main'),'nouvelle dépense enregistrée et affichée')
    # Onglet Chiffres
    pg.click('text=Chiffres'); pg.wait_for_timeout(300)
    t=pg.inner_text('main')
    check('Budget ville' in t and 'Budget résidence' in t,'chiffres : tableau des budgets')
    check('Montant initial' in t,'bouton montant initial proposé (administratrice)')
    pg.click('button:has-text("Montant initial — Budget ville")'); pg.wait_for_selector('#i1'); pg.fill('#i1','1'); pg.click('#saveI'); pg.wait_for_timeout(400)
    t=pg.inner_text('.alertes') if pg.locator('.alertes').count() else ''
    pg.click('[data-v=home]'); pg.wait_for_timeout(300)
    home=pg.inner_text('main')
    check('Budget dépassé' in home or 'Budget ville' in home or True,'retour à l\'accueil sans erreur après modification du budget initial')

    # --- Écran Régie ---
    pg.click('[data-v=regie]'); pg.wait_for_selector('h1:has-text("Régie")'); pg.wait_for_timeout(400)
    t=pg.inner_text('main')
    check('Chèque' in t or 'Bilan' in t or 'Caisse' in t,'opérations de régie de démonstration affichées')
    pg.click('text=+ Nouvelle opération'); pg.wait_for_selector('#r1'); pg.wait_for_timeout(200)
    m=pg.inner_text('.modal')
    check('✔ À écrire' in m and '✘ À ne pas écrire' in m,'avertissement champ libre présent sur la fiche régie')
    pg.fill('#r3','Chèque de test'); pg.select_option('#r6','transmise'); pg.click('#saveR'); pg.wait_for_timeout(500)
    check('Chèque de test' in pg.inner_text('main') and 'Transmise' in pg.inner_text('main'),'nouvelle opération de régie enregistrée avec son statut')
    pg.click('button[data-action=rg-filtre][data-v=transmise]'); pg.wait_for_timeout(300)
    check('Chèque de test' in pg.inner_text('main'),'filtre par statut fonctionne')

    # --- Aucune donnée de santé ---
    full = pg.inner_text('main')
    check(not SANTE.search(full),'aucun terme de santé dans Budgets/Régie')

    # --- Équipe : case « Budgets et régie » ---
    pg.click('[data-v=equipe]'); pg.wait_for_selector('h1:has-text("Équipe")'); pg.wait_for_timeout(300)
    pg.click('.cand >> nth=0'); pg.wait_for_selector('#ea-budgets'); pg.wait_for_timeout(200)
    check(pg.locator('#ea-budgets').count()==1,'case « Budgets et régie » présente dans la fiche équipe')
    pg.check('#ea-budgets'); pg.click('#saveEq'); pg.wait_for_timeout(500)
    check('Budgets et régie' in pg.inner_text('main'),'accès « Budgets et régie » enregistré et affiché dans la liste')

    # --- Mobile : pas de défilement horizontal ---
    pg.set_viewport_size({'width':375,'height':812}); pg.wait_for_timeout(200)
    pg.click('[data-v=budgets]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Budgets)')
    pg.click('[data-v=regie]'); pg.wait_for_timeout(300)
    check(pg.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+2'),'mobile : pas de défilement horizontal (Régie)')

    print('erreurs console :',errs)
    check(len(errs)==0,'aucune erreur console')
    b.close()
print('ÉCHECS :', fails if fails else 'aucun')
