# Test du MODE RÉEL avec un faux Firebase (mêmes règles que firestore.rules). Lancer : python3 tests/reel.py
import json
from playwright.sync_api import sync_playwright
fails=[]; errs=[]
def check(c,m):
    print(('ok - ' if c else 'ECHEC - ')+m)
    if not c: fails.append(m)
FAKE=open('/home/claude/animerci-app/tests/fake-firebase.js').read()
def module(nom):
    noms=['initializeApp','deleteApp','getAuth','getFirestore','onAuthStateChanged','signInWithEmailAndPassword','createUserWithEmailAndPassword','signOut','sendPasswordResetEmail','EmailAuthProvider','reauthenticateWithCredential','updatePassword','getCountFromServer','collection','where','orderBy','limit','getDocs','query','doc','getDoc','setDoc','deleteDoc','onSnapshot']
    return FAKE+'\n'+'\n'.join(f'export const {n} = window.__fbmod.{n};' for n in noms)
CONFIG="export const firebaseConfig={apiKey:'k',authDomain:'x.firebaseapp.com',projectId:'p',storageBucket:'',messagingSenderId:'1',appId:'1'};export const MODE_REEL=true;export const FIREBASE_VERSION='10.14.1';"
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    ctx=b.new_context(viewport={'width':1280,'height':900})
    ctx.route('**/firebasejs/**',lambda r:r.fulfill(body=module(r.request.url),content_type='text/javascript'))
    ctx.route('**/js/config.js',lambda r:r.fulfill(body=CONFIG,content_type='text/javascript'))
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and 'fonts.g' not in m.text and 'ERR_' not in m.text and 'permission' not in m.text.lower() else None)
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html')
    # graine : données de démonstration + comptes
    pg.wait_for_selector('#fl')
    pg.evaluate("""async()=>{const F=window.__fb;const {donneesDemo}=await import('/js/seeds.js');const d=donneesDemo();
      for(const c of Object.keys(d)){F.db[c]={};for(const r of d[c]){const {id,...x}=r;F.db[c][id]=x;}}
      F.db.users={a1:{nom:'Responsable',role:'admin',activites:[]},i1:{nom:'Fleuriste',role:'intervenant',activites:['a-flo']},b1:{nom:'Bénévole',role:'benevole',activites:[]},n1:{nom:'Sans rôle'}};
      F.accounts={'m@x.fr':{uid:'a1',pw:'pw1'},'i@x.fr':{uid:'i1',pw:'pw2'},'b@x.fr':{uid:'b1',pw:'pw3'},'n@x.fr':{uid:'n1',pw:'pw4'}};}""")
    def login(em,pw):
        pg.fill('#em',em); pg.fill('#pw',pw); pg.click('#fl button[type=submit], #fl .btn')
    # mauvais mot de passe
    check(pg.locator('#fl .pw-oeil').count()==1,'connexion : bouton œil présent')
    pg.fill('#pw','zz'); pg.click('#fl .pw-oeil'); check(pg.eval_on_selector('#pw','i=>i.type')=='text','connexion : œil affiche le mot de passe')
    login('m@x.fr','faux'); pg.wait_for_selector('#lerr',state='visible'); check('incorrect' in pg.inner_text('#lerr'),'mot de passe erroné : message clair')
    # administratrice
    login('m@x.fr','pw1'); pg.wait_for_selector('text=Que voulez-vous faire')
    check(pg.locator('nav.side .nav-btn[data-v]').count()==18,'admin : 18 entrées de menu (lot J : Questionnaires, Voyages)')
    # mot de passe trop court (pw1 = 3 caractères) : bandeau + changement
    check(pg.locator('text=Votre mot de passe est trop court').count()==1,'mot de passe court : bandeau affiché')
    pg.click('main [data-action=mdp-form]'); pg.wait_for_selector('#m0')
    check(pg.locator('.pw-oeil').count()==3,'œil : un bouton par champ mot de passe (3)')
    pg.fill('#m1','abc'); pg.locator('.pw-oeil').nth(1).click()
    check(pg.eval_on_selector('#m1','i=>i.type')=='text' and pg.input_value('#m1')=='abc' and pg.eval_on_selector('#m0','i=>i.type')=='password','œil : affiche seulement le champ visé, texte conservé')
    pg.locator('.pw-oeil').nth(1).click(); check(pg.eval_on_selector('#m1','i=>i.type')=='password','œil : masque de nouveau')
    pg.fill('#m0','pw1'); pg.fill('#m1','court'); pg.fill('#m2','court'); pg.click('#mok')
    check('au moins 12' in pg.inner_text('#merr'),'mot de passe court refusé par l\'outil')
    pg.fill('#m1','une phrase longue 2026'); pg.fill('#m2','une phrase longue 2026'); pg.click('#mok'); pg.wait_for_timeout(500)
    check(pg.evaluate("window.__fb.accounts['m@x.fr'].pw")=='une phrase longue 2026','mot de passe changé côté compte')
    check(pg.locator('text=Votre mot de passe est trop court').count()==0,'bandeau disparu')
    # paramètres : renommer l'outil + masquer le module Tâches
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('text=Enregistrer')
    pg.fill('#p-nom','Espace Test'); pg.uncheck('#p-m-taches'); pg.click('[data-action=param-save]'); pg.wait_for_timeout(600)
    check(pg.locator('nav.side .nav-btn[data-v=taches]').count()==0,'module Tâches masqué après réglage')
    check('Espace Test' in pg.inner_text('nav.side'),'nom de l\'outil modifié dans le menu')
    pg.check('#p-m-taches'); pg.fill('#p-nom','AniMerci'); pg.click('[data-action=param-save]'); pg.wait_for_timeout(500)
    check(pg.evaluate("window.__fb.db.parametres.general.nomOutil")=='AniMerci','paramètres écrits en base (nom remis)')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('.cand'); check(pg.locator('.cand').count()==20,'admin : 20 personnes lues depuis la base')
    pg.click('text=+ Nouvelle personne'); pg.fill('#n1','Test'); pg.fill('#n2','Réel'); pg.click('#saveSenior'); pg.wait_for_timeout(500)
    check(pg.evaluate("Object.values(window.__fb.db.seniors).some(s=>s.nom==='Réel')"),'admin : création enregistrée en base')
    # Équipe : créer un accès sans être déconnectée
    pg.click('nav.side [data-v=equipe]'); pg.wait_for_selector('text=Ajouter une personne'); pg.wait_for_selector('.cand'); check(pg.locator('.cand').count()==4,'équipe : 4 accès listés')
    pg.click('text=+ Ajouter une personne'); pg.fill('#e1','Nouvelle Interv'); pg.fill('#e2','nouvelle@x.fr'); pg.select_option('#e3','intervenant'); pg.locator('.eact').first.check(); pg.click('#saveEq'); pg.wait_for_timeout(800)
    check(pg.evaluate("window.__fb.mails.includes('nouvelle@x.fr')"),'équipe : e-mail de mot de passe envoyé')
    check(pg.evaluate("Object.values(window.__fb.db.users).some(u=>u.email==='nouvelle@x.fr'&&u.role==='intervenant')"),'équipe : profil créé')
    check(pg.locator('nav.side').inner_text().find('Responsable')>=0 and pg.locator('text=Nouvelle Interv').count()>=1,'équipe : l\'administratrice reste connectée')
    # suppression → corbeille → restauration
    pg.click('nav.side [data-v=seniors]'); pg.click('.cand:has-text("Réel")'); pg.click('#delSenior'); pg.click('#cfOk'); pg.wait_for_timeout(600)
    check(pg.evaluate("Object.keys(window.__fb.db.corbeille||{}).length")==1,'corbeille : élément conservé')
    pg.click('nav.side [data-v=sauvegarde]'); pg.click('[data-action=sec-tab][data-v=corbeille]'); pg.click('[data-action=corbeille-restaurer]'); pg.wait_for_timeout(600)
    check(pg.evaluate("Object.values(window.__fb.db.seniors).some(s=>s.nom==='Réel')"),'corbeille : restauration réelle')
    check(pg.evaluate("Object.keys(window.__fb.db.journal||{}).length")>=3,'journal : lignes écrites')
    # sauvegarde JSON + restauration
    pg.click('[data-action=sec-tab][data-v=sauvegarde]')
    with pg.expect_download() as d: pg.click('text=Fichier de restauration')
    d.value.save_as('/tmp/reel.json'); pg.set_input_files('#sv-fichier','/tmp/reel.json'); pg.click('#cfOk'); pg.wait_for_selector('text=Restauration terminée',timeout=20000)
    check(True,'restauration depuis le fichier .json')
    pg.click('text=Se déconnecter')
    # intervenante
    pg.wait_for_selector('#fl'); login('i@x.fr','pw2'); pg.wait_for_selector('text=Mes activités'); pg.wait_for_selector('.act')
    check(pg.locator('.act').count()==1,'intervenante : 1 activité visible')
    pg.click('.act'); pg.wait_for_selector('.tabs'); pg.click('text=Faire l\'appel'); pg.wait_for_selector('text=Enregistrer')
    pg.click('button[data-action=save-appel][data-valide="0"]'); pg.wait_for_timeout(500)
    check(pg.evaluate("Object.values(window.__fb.db.seances).some(s=>s.activiteId==='a-flo'&&s.valide===false)"),'intervenante : appel enregistré (non validé)')
    check(pg.locator('button[data-action=save-appel][data-valide="1"]').count()==0,'intervenante : pas de bouton de validation')
    pg.click('text=Se déconnecter')
    # bénévole
    pg.wait_for_selector('#fl'); login('b@x.fr','pw3'); pg.wait_for_selector('text=Planning'); check(pg.locator('nav.side .nav-btn[data-v]').count()==1,'bénévole sans case cochée : planning seulement')
    pg.click('text=Se déconnecter')
    # sans rôle
    pg.wait_for_selector('#fl'); login('n@x.fr','pw4'); pg.wait_for_timeout(800)
    check(pg.locator('nav.side .nav-btn[data-v]').count()==0,'sans rôle : aucun menu')
    denied=[x for x in pg.evaluate("window.__fb.denied") if x!='setDoc mouvements']; check(denied==[],'aucun accès refusé par les règles : '+str(denied))
    # --- l'administratrice a la main sur ce que saisissent les autres ---
    pg.click('text=Se déconnecter')
    pg.evaluate("Object.values(window.__fb.db.inscriptions).filter(i=>i.activiteId==='a-flo').slice(0,3).forEach(i=>i.statut='inscrit')")
    pg.wait_for_selector('#fl'); login('m@x.fr','une phrase longue 2026'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Atelier floral")'); pg.click('[data-action=tab][data-v=seances]')
    pg.wait_for_selector('text=Saisi par Fleuriste'); check(True,'admin : voit qui a saisi l\'appel (Fleuriste)')
    pg.click('[data-action=ouvrir-appel]:has-text("Saisi par Fleuriste")'); pg.wait_for_selector('text=Faire l\'appel')
    pg.locator('button.s-a').first.click(); pg.click('button[data-action=save-appel][data-valide="1"]'); pg.wait_for_timeout(500)
    check(pg.evaluate("Object.values(window.__fb.db.seances).some(s=>s.activiteId==='a-flo'&&s.valide===true&&s.modifiePar==='Responsable'&&s.saisiPar==='Fleuriste')"),'admin : corrige et valide l\'appel d\'une intervenante (trace conservée)')
    # appel complet à la place d'une intervenante (activité qu'elle gère) : nouvel appel saisi par l'administratrice
    pg.click('button.back'); pg.click('[data-action=nouvel-appel]'); pg.fill('#ap-date','2026-01-05'); pg.locator('button.s-p').first.click(); pg.click('button[data-action=save-appel][data-valide="0"]'); pg.wait_for_timeout(400)
    check(pg.evaluate("Object.values(window.__fb.db.seances).some(s=>s.date==='2026-01-05'&&s.saisiPar==='Responsable')"),'admin : saisit un appel oublié à la place de l\'intervenante')
    # une fois validé, l'intervenante ne peut plus modifier ; l'administratrice peut rouvrir
    avant=pg.evaluate("JSON.stringify(Object.values(window.__fb.db.seances).find(s=>s.activiteId==='a-flo'&&s.valide===true))")
    pg.click('button.back'); pg.click('text=Se déconnecter'); pg.wait_for_selector('#fl'); login('i@x.fr','pw2'); pg.wait_for_selector('.act'); pg.click('.act'); pg.click('[data-action=ouvrir-appel] >> nth=0')
    pg.wait_for_selector('text=Faire l\'appel'); n0=pg.evaluate("window.__fb.denied.length")
    pg.locator('button.s-j').first.click(); pg.click('button[data-action=save-appel][data-valide="0"]'); pg.wait_for_timeout(500)
    check(pg.evaluate("window.__fb.denied.length")>n0 or pg.evaluate("JSON.stringify(Object.values(window.__fb.db.seances).find(s=>s.activiteId==='a-flo'&&s.valide===true))")==avant,'intervenante : ne peut pas modifier un appel validé')
    pg.evaluate("window.__fb.denied.length=0")
    pg.click('text=Se déconnecter'); pg.wait_for_selector('#fl'); login('m@x.fr','une phrase longue 2026'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Atelier floral")'); pg.click('[data-action=tab][data-v=seances]'); pg.click('[data-action=ouvrir-appel]:has-text("Saisi par Fleuriste")')
    pg.click('text=Rouvrir l\'appel'); pg.click('#cfOk'); pg.wait_for_timeout(500)
    check(pg.evaluate("Object.values(window.__fb.db.seances).filter(s=>s.saisiPar==='Fleuriste').every(s=>s.valide===false)"),'admin : peut rouvrir un appel validé')
    # l'administratrice modifie une fiche personne et une inscription créées par d'autres, sans refus
    check(pg.evaluate("window.__fb.denied.length")==0,'admin : aucun refus sur toutes ces opérations')
    # --- v1.3.0 : chargement à la demande, économie de lectures ---
    pg.evaluate("""()=>{const F=window.__fb; F.db.corbeille=F.db.corbeille||{}; F.db.corbeille.vieux={col:'seniors',label:'Très ancien',date:'2020-01-01T00:00:00.000Z',doc:{id:'x-vieux',nom:'Vieux',prenom:'V'},liens:{}};
      localStorage.removeItem('animerci-purge'); localStorage.removeItem('animerci-lectures'); F.requetes.length=0; F.reads=0;}""")
    pg.click('text=Se déconnecter'); pg.wait_for_selector('#fl'); login('m@x.fr','une phrase longue 2026'); pg.wait_for_selector('text=Que voulez-vous faire'); pg.wait_for_timeout(6500)
    rq=pg.evaluate("window.__fb.requetes")
    for col in ['seniors','users','corbeille','journal','contacts']:
        check(not any(r.startswith('listen '+col) for r in rq),'accueil : « '+col+' » non chargé')
    check(not any(r in ('listen inscriptions []','listen seances []','listen fiches []') for r in rq),'accueil : inscriptions, séances, fiches jamais chargées en entier')
    total=pg.evaluate("Object.values(window.__fb.db).reduce((n,c)=>n+Object.keys(c).length,0)"); lus=pg.evaluate("window.__fb.reads")
    check(lus<total*0.8,f'accueil : {lus} lectures pour {total} documents en base')
    check(pg.evaluate("window.__fb.reads")==pg.evaluate("JSON.parse(localStorage.getItem('animerci-lectures')).n"),'compteur de lectures de l\'outil = lectures réelles (faux Firebase)')
    check(pg.evaluate("!window.__fb.db.corbeille.vieux"),'purge : corbeille de plus de 30 jours effacée au démarrage')
    check(pg.evaluate("localStorage.getItem('animerci-purge')")!=None,'purge : une seule fois par jour')
    # Activités : places comptées côté serveur
    pg.click('nav.side [data-v=activites]'); pg.wait_for_selector('.act'); pg.wait_for_timeout(500)
    attendu=pg.evaluate("Object.values(window.__fb.db.inscriptions).filter(i=>i.activiteId==='a-flo'&&['inscrit','invite'].includes(i.statut)).length")
    check(f'<b>{attendu}</b> /' in pg.locator('.act:has-text("Atelier floral")').inner_html().replace('\n',' '),f'liste des activités : {attendu} places prises (comptées sans tout lire)')
    check(any(r.startswith('count inscriptions') for r in pg.evaluate("window.__fb.requetes")),'liste des activités : comptage serveur utilisé')
    # Planning : seulement le mois affiché
    pg.click('nav.side [data-v=planning]'); pg.wait_for_selector('.cal .d'); pg.wait_for_timeout(300)
    check(any('listen seances' in r and '>=' in r and '<=' in r for r in pg.evaluate("window.__fb.requetes")),'planning : séances du mois seulement')
    # Pas de doublon dans les listes mémorisées
    dup=pg.evaluate("import('/js/ui.js').then(m=>Object.entries(m.S.cache).filter(([c,l])=>new Set(l.map(x=>x.id)).size!==l.length).map(x=>x[0]))")
    check(dup==[],'aucun document en double dans les listes : '+str(dup))
    # Suppression d'une personne dont les inscriptions ne sont PAS chargées : tout est retrouvé directement dans la base
    pg.evaluate("""()=>{const F=window.__fb; F.db.seniors['s-orph']={nom:'Orphelin',prenom:'Test',statut:'adherent',sexe:'F'};
      F.db.inscriptions['i-orph']={activiteId:'a-flo',seniorId:'s-orph',seniorNom:'Test Orphelin',statut:'inscrit',dateDemande:'2026-01-01'};
      F.db.fiches['a-flo_s-orph']={activiteId:'a-flo',seniorId:'s-orph',seniorNom:'Test Orphelin',contact:'X',tel:'1'};}""")
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('.cand:has-text("Orphelin")'); pg.click('.cand:has-text("Orphelin")'); pg.click('#delSenior'); pg.click('#cfOk'); pg.wait_for_timeout(800)
    check(pg.evaluate("!window.__fb.db.inscriptions['i-orph'] && !window.__fb.db.fiches['a-flo_s-orph'] && !window.__fb.db.seniors['s-orph']"),'suppression d\'une personne : inscriptions et fiche retrouvées et supprimées sans les avoir chargées')
    check(pg.evaluate("Object.values(window.__fb.db.corbeille).some(c=>c.label.includes('Orphelin')&&(c.liens.inscriptions||[]).length===1)"),'corbeille : l\'inscription est gardée avec la personne')
    # Sauvegarde complète : lit toute la base
    pg.click('nav.side [data-v=sauvegarde]'); pg.wait_for_selector('text=Faire la sauvegarde')
    with pg.expect_download() as dl: pg.click('[data-action=sv-json]')
    import json as _j; sv=_j.load(open(dl.value.path()))
    nb=lambda c: pg.evaluate(f"Object.keys(window.__fb.db.{c}||{{}}).length")
    check(all(len(sv['donnees'][c])==nb(c) for c in ['seniors','activites','inscriptions','seances','taches']),'sauvegarde .json : toutes les données (même celles non affichées)')
    check(len(sv['equipe'])==nb('users'),'sauvegarde .json : équipe complète')
    # --- v1.4.0 / 1.5.0 : annuaire en mode réel (champ « tapez pour chercher ») ---
    pg.click('nav.side [data-v=activites]'); pg.wait_for_selector('.act'); pg.click('.act:has-text("Atelier floral")'); pg.click('[data-action=act-form]')
    pg.fill('#g8','Intervenant Réel'); pg.click('#saveAct'); pg.wait_for_timeout(700)
    check(pg.evaluate("Object.values(window.__fb.db.contacts||{}).filter(c=>c.nom==='Réel'&&c.prenom==='Intervenant'&&c.categorie==='Intervenant·e').length")==1,'annuaire réel : contact ajouté automatiquement en base (prénom et nom séparés)')
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Atelier floral")'); pg.click('[data-action=act-form]'); pg.fill('#g8','intervenant réel'); pg.click('#saveAct'); pg.wait_for_timeout(500)
    check(pg.is_visible('[data-combo=g8] .hom'),'annuaire réel : même nom en casse différente → question « même personne ? »')
    pg.click('[data-combo=g8] .hom input:not([value=autre])'); pg.click('#saveAct'); pg.wait_for_timeout(700)
    check(pg.evaluate("Object.values(window.__fb.db.contacts).filter(c=>(c.prenom+' '+c.nom).toLowerCase()==='intervenant réel').length")==1,'annuaire réel : pas de doublon (même nom, casse différente)')
    pg.click('nav.side [data-v=annuaire]'); pg.wait_for_selector('.cand'); pg.click('.cand:has-text("RÉEL Intervenant")'); pg.click('#delC'); pg.click('#cfOk'); pg.wait_for_timeout(600)
    check(pg.evaluate("Object.values(window.__fb.db.contacts).filter(c=>c.nom==='Réel').length")==0 and pg.evaluate("Object.values(window.__fb.db.corbeille).some(c=>c.col==='contacts')"),'annuaire réel : suppression vers la corbeille')
    # --- v1.5.0 : retirer une présence d'un appel doit vraiment la retirer en base (mergeFields) ---
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Marche douce")'); pg.wait_for_selector('text=Inscrire quelqu')
    pg.click('[data-action=tab][data-v=seances]') if pg.locator('[data-action=tab][data-v=seances]').count() else None
    pg.click('[data-action=nouvel-appel]'); pg.fill('#ap-date','2026-02-02'); pg.locator('button.s-p').nth(0).click(); pg.locator('button.s-p').nth(1).click(); pg.click('button[data-action=save-appel][data-valide="0"]') if pg.locator('button[data-action=save-appel][data-valide="0"]').count() else pg.click('button[data-action=save-appel]'); pg.wait_for_timeout(600)
    nbp=lambda: pg.evaluate("Math.max(0,...Object.values(window.__fb.db.seances).filter(x=>x.date==='2026-02-02').map(x=>Object.keys(x.presences||{}).length))")
    check(nbp()==2,'appel réel : 2 présences enregistrées')
    pg.wait_for_selector('button.s-p'); pg.locator('button.s-p[aria-pressed=true]').first.click(); pg.click('button[data-action=save-appel][data-valide="0"]') if pg.locator('button[data-action=save-appel][data-valide="0"]').count() else pg.click('button[data-action=save-appel]'); pg.wait_for_timeout(600)
    check(nbp()==1,'appel réel : une présence retirée est bien retirée de la base (1 restante)')
    # --- v1.5.0 : import, recherche globale, fusion en mode réel (règles Firestore appliquées) ---
    open('/tmp/imp10.csv','wb').write('Nom;Prénom;Date de naissance;Sexe\r\nREELA;Alice;01/02/1940;F\r\nREELB;Bruno;03/04/1938;H\r\nREELA;Alice;01/02/1940;F\r\n'.encode('cp1252'))
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand'); pg.click('[data-action=importer][data-cible=seniors]'); pg.set_input_files('#im-f','/tmp/imp10.csv'); pg.wait_for_selector('.im-choix p')
    check('2 nouvelles' in pg.inner_text('.im-choix') and '1 déjà présente' in pg.inner_text('.im-choix'),'import réel : 2 nouvelles, 1 doublon du fichier ignoré'); pg.click('#im-ok'); pg.wait_for_timeout(1500)
    check(pg.evaluate("Object.values(window.__fb.db.seniors).filter(s=>s.nom==='REELA'&&s.naissance==='1940-02-01').length")==1,'import réel : fiche écrite en base (date normalisée aaaa-mm-jj)')
    pg.click('.top >> text=Nouvelle personne'); pg.fill('#n1','Alicia'); pg.fill('#n2','Reela'); pg.fill('#n3','1940-02-01'); pg.fill('#n7','0600000099'); pg.click('#saveSenior'); pg.wait_for_timeout(600)
    pg.click('nav.side [data-v=activites]'); pg.click('.act:has-text("Marche douce")'); pg.wait_for_selector('text=Inscrire quelqu'); pg.click('[data-action=ins-form]'); pg.fill('#i1','alicia'); pg.click('#i1-l .combo-opt >> nth=0'); pg.click('#saveIns'); pg.wait_for_timeout(700)
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand'); pg.fill('#rech','reela alice'); pg.click('#liste .cand >> nth=0'); pg.click('#fusSenior'); pg.fill('#f1','alicia'); pg.click('#f1-l .combo-opt >> nth=0'); pg.click('#fuOk'); pg.click('#cfOk'); pg.wait_for_timeout(1200)
    check(pg.evaluate("Object.values(window.__fb.db.seniors).filter(s=>s.nom==='Reela').length")==0 and pg.evaluate("Object.values(window.__fb.db.corbeille).some(c=>c.col==='seniors')"),'fusion réelle : le doublon est supprimé et placé à la corbeille')
    check(pg.evaluate("(()=>{const [aid,A]=Object.entries(window.__fb.db.seniors).find(([k,s])=>s.nom==='REELA');const I=Object.values(window.__fb.db.inscriptions).filter(i=>i.seniorId===aid&&i.activiteId==='a-mar');return I.length===1&&A.tel==='0600000099'})()"),'fusion réelle : l\'inscription a suivi et le téléphone a été repris')
    pg.click('[data-action=rech-globale]'); pg.wait_for_selector('#rg'); pg.fill('#rg','reelb'); check(pg.locator('#rg-l .combo-opt').count()==1,'recherche globale réelle : résultat trouvé (lecture admin autorisée)'); pg.click('button[data-action=close]') if pg.locator('button[data-action=close]').count() else pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    pg.click('nav.side [data-v=sauvegarde]'); pg.wait_for_selector('text=Faire la sauvegarde')
    with pg.expect_download() as dl2: pg.click('[data-action=sv-json]')
    sv2=_j.load(open(dl2.value.path())); check(isinstance(sv2.get('contacts'),list),'sauvegarde .json : annuaire inclus')
    check(pg.evaluate("window.__fb.denied.length")==0,'aucun refus de règle pendant les tests de chargement')
    # --- compte Partenaire (mode réel) : ne voit et n'écrit que ses propres échanges ---
    pg.evaluate("()=>{const F=window.__fb; F.db.users.p1={nom:'Médiathèque',role:'partenaire',activites:[],partenaireId:'c-med',partenaireNom:'Médiathèque municipale'}; F.accounts['p@x.fr']={uid:'p1',pw:'pw5'};}")
    pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('#fl'); login('p@x.fr','pw5'); pg.wait_for_selector('text=Mes échanges')
    check(pg.locator('nav.side .nav-btn[data-v]').count()==1,'partenaire (réel) : un seul écran')
    pg.click('text=+ Nouvel échange'); pg.fill('#m3','Proposition réelle'); pg.click('#saveM'); pg.wait_for_timeout(600)
    check(pg.evaluate("Object.values(window.__fb.db.echanges).some(e=>e.objet==='Proposition réelle'&&e.parUid==='p1'&&e.partenaireId==='c-med')"),'partenaire (réel) : échange écrit avec son identifiant')
    check('Proposition réelle' in pg.inner_text('main') and 'Réserver la salle' not in pg.inner_text('main'),'partenaire (réel) : ne voit pas les échanges de l\'administratrice')
    r=pg.evaluate("""async()=>{const {store}=await import('/js/store.js'); const out={};
      for(const [c,d] of [['conventions',{intitule:'x'}],['contacts',{nom:'x'}],['seniors',{nom:'x'}],['echanges',{objet:'autre',parUid:'p1',partenaireId:'c-par',interne:false}],['echanges',{objet:'interne',parUid:'p1',partenaireId:'c-med',interne:true}]]) { try { await store.save(c,d); out[c+(d.interne?'-int':'')+(d.partenaireId==='c-par'?'-autre':'')]='ECRIT'; } catch(e) { out[c+(d.interne?'-int':'')+(d.partenaireId==='c-par'?'-autre':'')]='refusé'; } }
      return out;}""")
    check(all(v=='refusé' for v in r.values()),'partenaire (réel) : refus pour conventions, annuaire, personnes, autre partenaire, réunion interne '+str(r))
    pg.evaluate("window.__fb.denied.length=0")
    print('Erreurs console :',errs or 'aucune'); 
    if errs: fails.append('console')
    print('ÉCHECS :',fails or 'aucun')
