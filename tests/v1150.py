# v1.15.0 : aucune donnée de santé (fiche de sortie : champ libre avec avertissement, déplacements en choix d'organisation)
from playwright.sync_api import sync_playwright
import re
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
MOTS=re.compile(r'traitement|fauteuil|déambulateur|marche lente',re.I)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1280,'height':900}).new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Bruxelles")'); pg.click('[data-v=fiches]'); pg.wait_for_selector('text=Fiches complètes')
    t=pg.inner_text('main')
    check('Ne notez aucune donnée de santé' in t,'onglet Fiches : avertissement visible')
    check(not MOTS.search(t) and 'Alimentation' not in t,'onglet Fiches : aucun mot de santé (traitement, fauteuil, alimentation…)')
    check('Vient avec une amie' in t,'onglet Fiches : l\'information pratique de démonstration s\'affiche')
    pg.locator('.cand').nth(5).click(); pg.wait_for_selector('#f4')
    m=pg.inner_text('.modal')
    check('Autre information pratique' in m and 'À écrire' in m and 'À ne pas écrire' in m and 'vient avec Mme Durand' in m,'fiche : champ libre, avertissement et exemples')
    check(pg.locator('#f5').count()==0 and 'Alimentation' not in m and 'traitement' not in m.lower(),'fiche : plus de champ alimentation ni traitement')
    check('Déplacements' in m and 'Fauteuil' not in m and 'Marche lente' not in m,'fiche : déplacements en choix d\'organisation')
    check(pg.eval_on_selector('#f4','i=>i.maxLength')==140,'fiche : champ limité à 140 caractères')
    pg.fill('#f1','Fils : Paul'); pg.fill('#f2','06 11 22 33 44'); pg.fill('#f4','Arrive en retard'); pg.click('#saveF'); pg.wait_for_timeout(500)
    check('Arrive en retard' in pg.inner_text('main'),'fiche enregistrée : information pratique affichée')
    # liste d'urgence : texte copié sans mot de santé
    pg.context.grant_permissions(['clipboard-read','clipboard-write'])
    pg.click('[data-action=copier-urgence]'); pg.wait_for_timeout(300)
    cp=pg.evaluate('navigator.clipboard.readText()')
    check('Arrive en retard' in cp and not MOTS.search(cp),'liste d\'urgence : information pratique, rien de santé')
    # Paramètres
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-mob')
    pm=pg.inner_text('main')
    check('À ne pas mettre' in pm and 'Déplacements' in pm,'Paramètres : liste Déplacements avec avertissement')
    check(not re.search(r'fauteuil|déambulateur|marche lente',pm,re.I),'Paramètres : choix par défaut sans vocabulaire de santé')
    # Sécurité
    pg.click('nav.side [data-v=sauvegarde]'); pg.wait_for_timeout(500)
    st=pg.inner_text('main'); check('santé' not in st.replace('aucune information de santé','').lower() or 'informations de santé' not in st,'Sécurité : plus de « informations de santé » dans la sauvegarde')
    check(pg.locator('#sv-fiches').count()==1 and 'personne à prévenir' in pg.locator('#sv-fiches').locator('..').inner_text(),'Sécurité : case des fiches de sortie reformulée')
    # Personnes : note de santé
    pg.click('nav.side [data-v=seniors]'); pg.click('text=Nouvelle personne'); pg.wait_for_selector('.modal')
    check("n'en contient pas" in pg.inner_text('.modal'),'fiche personne : AniMerci ne contient aucune donnée de santé')
    b.close()
print('Erreurs console :',errs or 'aucune'); print('ÉCHECS :',fails or 'aucun')
