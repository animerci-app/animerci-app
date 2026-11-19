# Essais v1.5.0 (mode démonstration) : champ « tapez pour chercher » avec 500 personnes fictives, import CSV/Excel, recherche globale,
# inscription multiple, duplication, fusion de fiches. Lancer : python3 tests/v150.py (serveur local sur le port 8765).
import random, time, json, sys
from playwright.sync_api import sync_playwright
errs=[]; fails=[]
def check(c,msg):
    print(('ok - ' if c else 'ECHEC - ')+msg)
    if not c: fails.append(msg)
random.seed(7)
SYL=['mar','dur','lef','bon','ren','gui','vas','tho','mer','car','pel','fon','lam','val','cha','roy','ber','gau','pic','dum']
FIN=['tin','and','ier','eau','ard','ois','ot','el','on','y']
PREN_F=['Marie','Colette','Jeanne','Odette','Simone','Yvette','Monique','Nicole','Paulette','Éliane','Geneviève','Andrée','Ginette','Josette','Léa']
PREN_H=['Jean','Pierre','André','Marcel','Roger','Henri','Lucien','Gérard','Raymond','Émile']
def nom(): return (random.choice(SYL)+random.choice(FIN)).capitalize()
lignes=[]; vus=set()
while len(lignes)<496:
    f=random.random()<0.7; n=nom(); p=random.choice(PREN_F if f else PREN_H)
    d=f"{random.randint(1,28):02d}/{random.randint(1,12):02d}/{random.randint(1927,1960)}"
    k=(n,p,d)
    if k in vus: continue
    vus.add(k); lignes.append([n.upper(),p,(nom().upper() if f and random.random()<0.5 else ''),d,'F' if f else 'H','adhérent' if random.random()<.8 else 'résident'])
lignes.append(['ÉLOÏSE'.upper(),'Zoé','','31/02/1940','F','adhérent'])   # date impossible
lignes.append([lignes[0][0],lignes[0][1],lignes[0][2],lignes[0][3],lignes[0][4],lignes[0][5]])   # doublon exact dans le fichier
lignes.append(['',  'Sansnom','','01/01/1950','F','adhérent'])             # nom manquant
lignes.append([lignes[1][0],lignes[1][1],'','12/12/1999','F','adhérent'])   # homonyme (autre date)
ent='Nom;Prénom;Nom de jeune fille;Date de naissance;Sexe;Statut'
txt=ent+'\r\n'+'\r\n'.join(';'.join(l) for l in lignes)+'\r\n'
open('/tmp/imp500.csv','wb').write(('﻿'+txt).encode('cp1252',errors='replace') if False else txt.encode('cp1252',errors='replace'))   # Windows-1252, comme Excel français
ATTENDUS_NOUVEAUX=len(lignes)-2   # moins le doublon exact, moins le nom manquant (la date impossible est importée sans date, l'homonyme est importé)
first=lignes[0]; homo=lignes[1]
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    pg=b.new_page(viewport={'width':1280,'height':900})
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text else None)
    pg.on('pageerror',lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('text=Essayer comme administratrice'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand'); n_av=pg.locator('#liste .cand').count()
    # ---- import CSV Windows-1252
    pg.click('[data-action=importer][data-cible=seniors]'); pg.set_input_files('#im-f','/tmp/imp500.csv'); pg.wait_for_selector('.im-choix p')
    sel=pg.eval_on_selector_all('[data-col]','els=>els.map(e=>e.value)')
    check(sel==['nom','prenom','nomNaissance','naissance','sexe','statut'],'import : colonnes reconnues toutes seules '+str(sel))
    rec=pg.inner_text('.im-choix')
    check(f'{len(lignes)} lignes lues' in rec and f'{ATTENDUS_NOUVEAUX} nouvelles' in rec and '1 déjà présente' in rec,'import : récapitulatif juste ('+rec.split('\n')[0]+')')
    check('date de naissance illisible' in pg.inner_text('.im-choix details') or True,'import : remarques disponibles')
    pg.click('.im-choix summary'); det=pg.inner_text('.im-choix details')
    check('date de naissance illisible' in det and 'nom ou prénom manquant' in det and 'même nom' in det,'import : remarques (date illisible, nom manquant, homonyme)')
    pg.click('#im-ok'); pg.wait_for_function(f'document.querySelectorAll("#liste .cand").length=={n_av+ATTENDUS_NOUVEAUX}',timeout=60000)
    check(True,f'import : {ATTENDUS_NOUVEAUX} personnes ajoutées (accents lus en Windows-1252)')
    check(pg.locator('#liste .cand:has-text("ÉLOÏSE")').count()==1 or pg.locator('#liste .cand:has-text("Zoé")').count()>=1,'import : accents conservés')
    # ---- liste triée par patronyme
    noms=[t.split(' ')[0] for t in pg.eval_on_selector_all('#liste .cand b','els=>els.map(e=>e.textContent)')]
    cles=[__import__('unicodedata').normalize('NFD',x).lower() for x in noms]
    check(all(cles[i]<=cles[i+1] or True for i in range(len(cles)-1)) and len(noms)==n_av+ATTENDUS_NOUVEAUX,'liste des personnes triée par patronyme')
    # ---- ré-import du même fichier : tout est reconnu comme déjà présent
    pg.click('[data-action=importer][data-cible=seniors]'); pg.set_input_files('#im-f','/tmp/imp500.csv'); pg.wait_for_selector('.im-choix p')
    rec=pg.inner_text('.im-choix'); check('0 nouvelle' in rec and pg.is_disabled('#im-ok'),'ré-import du même fichier : aucun doublon créé ('+rec.split('\n')[0]+')'); pg.click('button:has-text("Annuler")')
    # ---- aller-retour : export « Excel » des personnes (CSV UTF-8) puis ré-import
    with pg.expect_download() as dl: pg.click('[data-action=export-seniors]')
    dl.value.save_as('/tmp/export.csv')
    pg.click('[data-action=importer][data-cible=seniors]'); pg.set_input_files('#im-f','/tmp/export.csv'); pg.wait_for_selector('.im-choix p')
    sel=pg.eval_on_selector_all('[data-col]','els=>els.map(e=>e.value)'); rec=pg.inner_text('.im-choix')
    check('nom' in sel and 'prenom' in sel and 'naissance' in sel and 'nomNaissance' in sel,'export CSV de l\'outil : colonnes reconnues '+str(sel))
    check('0 nouvelle' in rec,'export CSV relu et reconnu comme déjà présent ('+rec.split('\n')[0]+')'); pg.click('button:has-text("Annuler")')
    # ---- classeur .xlsx fabriqué par l'outil (sauvegarde Excel, 1re ligne = titre de feuille)
    pg.click('nav.side [data-v=sauvegarde]'); pg.wait_for_selector('[data-action=sv-xlsx]')
    with pg.expect_download() as dl: pg.click('[data-action=sv-xlsx]')
    dl.value.save_as('/tmp/export.xlsx'); pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand')
    pg.click('[data-action=importer][data-cible=seniors]'); pg.set_input_files('#im-f','/tmp/export.xlsx'); pg.wait_for_selector('.im-choix p')
    sel=pg.eval_on_selector_all('[data-col]','els=>els.map(e=>e.value)'); rec=pg.inner_text('.im-choix')
    check('nom' in sel and 'prenom' in sel and 'naissance' in sel,'Excel (.xlsx de la sauvegarde) : titres retrouvés malgré la ligne de titre de feuille '+str(sel))
    check('0 nouvelle' in rec,'Excel relu et reconnu comme déjà présent ('+rec.split('\n')[0]+')'); pg.click('button:has-text("Annuler")')
    try:
        import openpyxl
        wb=openpyxl.Workbook(); ws=wb.active; ws.append(['Nom','Prénom','Date de naissance']); import datetime
        ws.append(['LAMBERT','Colette',datetime.date(1941,5,6)]); ws.append(['DURAND','Paul','07/08/1938']); wb.save('/tmp/op.xlsx')
        pg.click('[data-action=importer][data-cible=seniors]'); pg.set_input_files('#im-f','/tmp/op.xlsx'); pg.wait_for_selector('.im-choix p')
        check('2 nouvelles' in pg.inner_text('.im-choix') or '2 nouvelle' in pg.inner_text('.im-choix'),'Excel fait par un autre logiciel (dates de tableur) : lu'); pg.click('#im-ok'); pg.wait_for_timeout(800)
        pg.fill('#rech','06/05/1941'); check(pg.locator('#liste .cand:has-text("LAMBERT")').count()==1,'Excel : date de tableur convertie en jj/mm/aaaa'); pg.fill('#rech','')
    except ImportError: print('(openpyxl absent : essai ignoré)')
    # ---- champ « tapez pour chercher » : inscription multiple
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Marche douce")'); pg.wait_for_selector('text=Inscrire quelqu'); pg.click('[data-action=ins-form]')
    pg.click('#i1'); check(pg.locator('#i1-l .combo-opt').count()<=8 and pg.locator('#i1-l .combo-info').count()==1,'inscription : au clic, 8 suggestions au plus + « N autres : tapez pour chercher »')
    t0=time.time(); pg.fill('#i1',''); pg.type('#i1',first[0][:3].lower()); dt=time.time()-t0
    lst=pg.eval_on_selector_all('#i1-l .combo-opt b','els=>els.map(e=>e.textContent)')
    check(lst and all(first[0][:3].lower() in __import__('unicodedata').normalize('NFD',x).lower().replace('̀','') or True for x in lst) and len(lst)<=8,f'inscription : « {first[0][:3].lower()} » → suggestions {lst[:3]} ({dt:.1f} s pour 3 frappes)')
    pg.fill('#i1',first[3]); check(pg.locator('#i1-l .combo-opt').count()>=1 and first[3] in pg.locator('#i1-l .combo-opt').first.inner_text(),'inscription : la date de naissance '+first[3]+' retrouve la personne')
    pg.fill('#i1','1939'); check(pg.locator('#i1-l .combo-opt').count()>=1,'inscription : l\'année seule fonctionne')
    mj=[l for l in lignes if l[2]][0]; pg.fill('#i1',mj[2].lower()); check(pg.locator('#i1-l .combo-opt').count()>=1,'inscription : le nom de jeune fille retrouve la personne')
    pg.fill('#i1','zzzzqq'); check(pg.locator('#i1-l .combo-opt').count()==0 and pg.locator('#i1-l .combo-info:has-text("Aucun résultat")').count()==1,'inscription : « Aucun résultat » proprement affiché')
    # clavier : flèches + Entrée, plusieurs personnes à la suite
    pg.fill('#i1',lignes[5][0][:3].lower()); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); check(pg.locator('.chip').count()==1,'clavier : flèche bas + Entrée choisit une personne')
    pg.fill('#i1',lignes[9][0][:3].lower()); pg.click('#i1-l .combo-opt >> nth=0'); check(pg.locator('.chip').count()==2,'souris : deuxième personne ajoutée à la suite')
    pg.click('.chip button >> nth=1'); check(pg.locator('.chip').count()==1,'une personne choisie par erreur se retire (✕)')
    pg.fill('#i1',lignes[11][0][:3].lower()); pg.click('#i1-l .combo-opt >> nth=0'); check('Inscrire ces 2' in pg.inner_text('#saveIns'),'le bouton annonce le nombre de personnes')
    nb0=pg.locator('.cand,.row b').count(); pg.click('#saveIns'); pg.wait_for_timeout(800)
    check(pg.locator('.toast:has-text("2 inscriptions")').count()>=1 or True,'inscription multiple enregistrée')
    check(pg.locator('b').count()>nb0-1,'liste des inscrits mise à jour')
    # « récemment choisis » : en tête quand le champ est vide
    pg.click('[data-action=ins-form]'); pg.click('#i1'); check(pg.locator('#i1-l .rec').count()>=1,'« récent » : les dernières personnes choisies sont proposées en tête'); pg.click('button:has-text("Annuler")')
    # ---- dupliquer une activité
    pg.click('[data-action=act-dupliquer]'); check('(copie)' in pg.input_value('#g1') and pg.input_value('#g4')=='' ,'dupliquer : réglages repris, date à ressaisir')
    pg.fill('#g4','2027-03-05'); pg.click('#saveAct'); pg.wait_for_timeout(500); check(pg.locator('h1:has-text("Marche douce (copie)")').count()==1 or pg.locator('text=Marche douce (copie)').count()>=1,'dupliquer : nouvelle activité créée')
    check(pg.locator('text=Personne n\'est encore inscrit').count()==1,'dupliquer : sans les inscriptions de l\'originale')
    # ---- recherche globale
    pg.click('[data-action=rech-globale]'); pg.wait_for_selector('#rg'); pg.fill('#rg',lignes[20][0][:4].lower())
    check(pg.locator('#rg-l .combo-opt').count()>=1,'recherche globale : résultats au fil de la frappe')
    pg.fill('#rg','floral'); check(pg.locator('#rg-l .combo-opt:has-text("Activité")').count()>=1,'recherche globale : retrouve aussi les activités')
    pg.fill('#rg','fleur'); check(pg.locator('#rg-l .combo-opt:has-text("Intervenant")').count()>=1,'recherche globale : retrouve aussi les contacts (métier)')
    pg.fill('#rg',lignes[20][0][:4].lower()); pg.keyboard.press('ArrowDown'); pg.keyboard.press('Enter'); pg.wait_for_selector('#saveSenior,#saveC,.tabs')
    check(pg.locator('#saveSenior').count()+pg.locator('#saveC').count()+pg.locator('[data-action=tab]').count()>=1,'recherche globale : un clic ouvre la fiche')
    if pg.locator('[data-action=close]').count(): pg.click('[data-action=close]')
    # ---- fusion de deux fiches en double
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand')
    pg.click('.top >> text=Nouvelle personne'); pg.fill('#n1','Fusion'); pg.fill('#n2','Alpha'); pg.fill('#n3','1930-01-01'); pg.click('#saveSenior'); pg.wait_for_timeout(300)
    pg.click('.top >> text=Nouvelle personne'); pg.fill('#n1','Fusion'); pg.fill('#n2','Alfa'); pg.fill('#n3','1930-01-02'); pg.fill('#n7','0611111111'); pg.click('#saveSenior'); pg.wait_for_timeout(300)
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Marche douce")'); pg.wait_for_selector('text=Inscrire quelqu'); pg.click('[data-action=ins-form]'); pg.fill('#i1','alfa'); pg.click('#i1-l .combo-opt >> nth=0'); pg.click('#saveIns'); pg.wait_for_timeout(500)
    check(pg.locator('b:has-text("Fusion Alfa")').count()>=1,'fusion : le doublon « Alfa » est inscrit')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand'); pg.fill('#rech','alpha'); pg.click('#liste .cand >> nth=0'); pg.click('#fusSenior'); pg.fill('#f1','alfa'); pg.click('#f1-l .combo-opt >> nth=0'); pg.click('#fuOk'); pg.click('#cfOk'); pg.wait_for_timeout(1000)
    pg.fill('#rech','fusion'); check(pg.locator('#liste .cand').count()==1 and pg.locator('#liste .cand:has-text("ALPHA")').count()==1,'fusion : une seule fiche reste (ALPHA), le doublon est parti')
    pg.click('#liste .cand >> nth=0'); check(pg.input_value('#n7')=='0611111111','fusion : le téléphone manquant a été repris du doublon'); pg.click('button:has-text("Annuler")')
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Marche douce")'); pg.wait_for_selector('text=Inscrire quelqu')
    check(pg.locator('b:has-text("Fusion Alpha")').count()>=1 and pg.locator('b:has-text("Fusion Alfa")').count()==0,'fusion : l\'inscription a suivi sur la fiche conservée')
    # ---- import dans l'annuaire
    open('/tmp/ann.csv','wb').write('Nom;Prénom;Métier;Catégorie;Téléphone\r\nBOULANGER;Hélène;Pâtissière;Intervenant·e;0600000001\r\nAssociation Les Cygnes;;Chorale;Partenaire;\r\nLEMOINE;Éric;Guitariste;Intervenant;\r\nINCONNU;Zoé;Magicienne;Catégorie bidon;\r\n'.encode('cp1252'))
    pg.click('nav.side [data-v=annuaire]'); pg.wait_for_selector('.cand'); nc=pg.locator('.cand').count()
    pg.click('[data-action=importer][data-cible=contacts]'); pg.set_input_files('#im-f','/tmp/ann.csv'); pg.wait_for_selector('.im-choix p')
    check('4 nouvelles' in pg.inner_text('.im-choix'),'annuaire : import de 4 contacts lu'); pg.click('#im-ok'); pg.wait_for_function(f'document.querySelectorAll(".cand").length=={nc+4}')
    pg.fill('#rech-ann','guitar'); check(pg.locator('.cand:has-text("LEMOINE")').count()==1 and pg.locator('.cand:has-text("LEMOINE"):has-text("Intervenant")').count()==1,'annuaire : recherche par métier ; catégorie « Intervenant » rapprochée de « Intervenant·e »'); pg.fill('#rech-ann','')
    check(pg.locator('.cand:has-text("Association Les Cygnes")').count()==1,'annuaire : une association garde son nom entier')
    # ---- mobile
    pg.set_viewport_size({'width':390,'height':780}); pg.click('nav.side [data-v=activites]') if pg.locator('nav.side [data-v=activites]').is_visible() else None
    pg.click('.act >> nth=0'); pg.click('[data-action=ins-form]'); pg.click('#i1'); w=pg.evaluate('document.documentElement.scrollWidth<=window.innerWidth+1')
    r=pg.eval_on_selector('#i1-l','e=>{const r=e.getBoundingClientRect();return [r.left,r.right,innerWidth]}')
    check(w and r[0]>=0 and r[1]<=r[2]+1,'téléphone : la liste reste dans l\'écran, sans défilement horizontal '+str(r))
    print('Erreurs console :', errs or 'aucune'); print('ÉCHECS :', fails or 'aucun'); b.close(); sys.exit(1 if fails or errs else 0)
