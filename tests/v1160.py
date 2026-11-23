# v1.16.0 : Partenaires (échanges, réunions, conventions, comptage annuel), saisie par l'administratrice seule
from playwright.sync_api import sync_playwright
import re
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
SANTE=re.compile(r'traitement|fauteuil|déambulateur|maladie|médicament|diagnostic',re.I)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_context(viewport={'width':1280,'height':900}).new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side')
    pg.wait_for_timeout(600)
    t=pg.inner_text('main')
    check('Réunion mensuelle' in t or 'Suite à donner' in t or 'convention' in t.lower(),'accueil : alertes partenaires (suite en retard, réunion prévue, convention proche)')
    check(pg.locator('nav.side [data-v=partenaires]').count()==1,'menu : entrée Partenaires')
    pg.click('nav.side [data-v=partenaires]'); pg.wait_for_selector('text=Nouvel échange')
    t=pg.inner_text('main')
    check('Médiathèque municipale' in t and 'Jardins' in t,'liste : échanges de démonstration avec partenaires identifiés')
    # nouvel échange
    pg.click('text=+ Nouvel échange'); pg.wait_for_selector('#e7')
    m=pg.inner_text('.modal'); check('À écrire' in m and 'À ne pas écrire' in m,'formulaire : avertissement ✔/✘')
    pg.fill('#e7','Confirmer la salle du 12'); pg.fill('#e5','Médiathèque'); pg.wait_for_timeout(300)
    pg.locator('.combo-opt, [role=option]').first.click(); pg.click('#saveE'); pg.wait_for_timeout(500)
    check('Confirmer la salle du 12' in pg.inner_text('main'),'échange créé et affiché')
    # partenaire obligatoire
    pg.click('text=+ Nouvel échange'); pg.wait_for_selector('#e7'); pg.fill('#e7','Sans partenaire'); pg.click('#saveE'); pg.wait_for_timeout(300)
    check(pg.locator('#e7').count()==1,'sans partenaire : enregistrement refusé')
    pg.click('.modal [data-action=close]'); pg.wait_for_timeout(200)
    # série mensuelle
    pg.click('[data-action=part-tab][data-v=reunions]'); pg.click('text=Planifier la série mensuelle'); pg.wait_for_selector('#s1')
    pg.fill('#s2','3'); pg.click('#saveS'); pg.wait_for_timeout(600)
    check(pg.inner_text('main').count('Réunion mensuelle')>=3,'série mensuelle : réunions créées')
    # conventions
    pg.click('[data-action=part-tab][data-v=conventions]'); pg.click('text=+ Nouvelle convention'); pg.wait_for_selector('#v2')
    pg.fill('#v1','Jardins'); pg.wait_for_timeout(300); pg.locator('.combo-opt, [role=option]').first.click(); pg.fill('#v2','Convention jardinage'); pg.click('#saveV'); pg.wait_for_timeout(500)
    check('Convention jardinage' in pg.inner_text('main'),'convention créée')
    # comptage
    pg.click('[data-action=part-tab][data-v=comptage]'); pg.wait_for_selector('text=Par type d\'échange')
    c=pg.inner_text('main'); check('Partenaires distincts' in c and 'Par partenaire' in c,'comptage annuel affiché')
    with pg.expect_download() as d: pg.click('text=Excel (.xlsx)')
    check(d.value.suggested_filename.endswith('.xlsx'),'comptage : export Excel')
    # fiche partenaire
    pg.click('nav.side [data-v=annuaire]'); pg.wait_for_selector('text=Médiathèque municipale'); pg.click('.cand:has-text("Médiathèque municipale")'); pg.wait_for_selector('#c9')
    check('Suivi du partenariat' in pg.inner_text('.modal'),'Annuaire : bloc Suivi du partenariat')
    pg.click('text=Voir le suivi'); pg.wait_for_selector('text=Historique des échanges')
    check('Confirmer la salle du 12' in pg.inner_text('main'),'fiche partenaire : historique')
    check(not SANTE.search(pg.inner_text('main')),'aucun mot de santé')
    # paramètres
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-psv'); check('Orée' not in pg.inner_text('main'),'Paramètres : nom de la résidence non codé en dur')
    # --- compte Partenaire (accès ouvert par l'administratrice) ---
    pg.click('nav.side [data-v=equipe]'); pg.wait_for_selector('text=Ajouter une personne'); pg.click('text=Ajouter une personne'); pg.wait_for_selector('#e3')
    check('Partenaire' in pg.inner_text('#e3'),'Équipe : rôle Partenaire proposé')
    pg.select_option('#e3','partenaire'); check(pg.is_visible('#e4'),'Équipe : choix du partenaire concerné')
    pg.fill('#e1','Essai partenaire'); pg.fill('#e2','essai@exemple.fr'); pg.click('#saveEq'); pg.wait_for_timeout(300)
    check(pg.locator('#e3').count()==1,'Équipe : partenaire obligatoire pour ce rôle'); pg.select_option('#e4','c-med'); pg.click('#saveEq'); pg.wait_for_timeout(500)
    check('Partenaire' in pg.inner_text('main'),'Équipe : compte partenaire créé')
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme partenaire'); pg.click('text=Essayer comme partenaire'); pg.wait_for_selector('text=Mes échanges')
    check(pg.locator('nav.side .nav-btn[data-v]').count()==1,'partenaire : un seul écran')
    pg.click('text=+ Nouvel échange'); pg.fill('#m3','Proposition d\'un atelier lecture'); pg.click('#saveM'); pg.wait_for_timeout(500)
    check('atelier lecture' in pg.inner_text('main') and 'Jardins' not in pg.inner_text('main'),'partenaire : voit ses échanges seulement')
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('nav.side')
    pg.click('nav.side [data-v=partenaires]'); pg.click('[data-action=part-tab][data-v=echanges]'); pg.wait_for_timeout(500); check('atelier lecture' in pg.inner_text('main'),'administratrice : voit l\'échange saisi par le partenaire')
    b.close()
print('erreurs console :',errs); 
import sys; sys.exit(1 if fails or errs else 0)
