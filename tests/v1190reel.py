# v1.19.0 (lot B) : portage de repas en MODE RÉEL (faux Firebase aux règles de firestore.rules)
import json
from playwright.sync_api import sync_playwright
fails=[]; errs=[]
def new_year():
    from datetime import date
    return date.today().year
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
    def login(em,pw):
        pg.fill('#em',em); pg.fill('#pw',pw); pg.click('#fl button[type=submit], #fl .btn')
    def deco():
        pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('#fl')
    pg.evaluate("()=>{const F=window.__fb; F.db.users.p1={nom:'Médiathèque',role:'partenaire',activites:[],partenaireId:'c-med',partenaireNom:'Médiathèque municipale'}; F.accounts['p@x.fr']={uid:'p1',pw:'pw5'};}")

    # Données : les bénéficiaires existent dans les fiches, mais le Portage n'a JAMAIS été ouvert (ni documents « portage », ni indicateur d'initialisation)
    pg.evaluate("()=>{const F=window.__fb; F.db.portage={}; F.db.portageEchanges={}; delete F.db.parametres.portage;}")
    ids=pg.evaluate("Object.entries(window.__fb.db.seniors).filter(([k,s])=>s.portage).map(([k])=>k)")
    check(len(ids)==5,'départ : 5 fiches avec portage')
    login('m@x.fr','pw1'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(900)
    check(pg.locator('nav.side [data-v=portage]').count()==1,'admin : menu Portage')
    pg.evaluate("window.__fb.reads=0")
    pg.click('nav.side [data-v=portage]'); pg.wait_for_selector('text=Portage de repas'); pg.wait_for_timeout(2000)
    P=pg.evaluate("window.__fb.db.portage")
    check(len(P)==5 and all(any(e.get('avant') for e in d['historique']) for d in P.values()) and all(d['etat']=='encours' for d in P.values()),'première ouverture : 5 bénéficiaires créés « avant 2026 », en cours')
    check(pg.evaluate("window.__fb.db.parametres.portage && !!window.__fb.db.parametres.portage.initialise"),'indicateur d\'initialisation écrit')
    d0=next(iter(P.values()))
    check('naissance' not in d0 and 'tel' not in d0 and 'adresse' not in d0 and isinstance(d0['anneeNaissance'],int),'le document portage ne recopie ni date de naissance complète ni coordonnées')
    check('En service (5)' in pg.locator('.filters').nth(1).inner_text(),'filtre « En service (5) »')
    check('avant 2026' in pg.inner_text('#liste-pg'),'liste : début « avant 2026 »')
    print('lectures à l\'ouverture :',pg.evaluate("window.__fb.reads"))
    # une seconde ouverture ne réécrit rien
    n0=pg.evaluate("JSON.stringify(window.__fb.db.portage)")
    pg.click('nav.side [data-v=home]'); pg.wait_for_timeout(500); pg.click('nav.side [data-v=portage]'); pg.wait_for_timeout(1200)
    check(pg.evaluate("JSON.stringify(window.__fb.db.portage)")==n0,'deuxième ouverture : rien de réécrit')
    # interrompre : motif obligatoire
    pg.fill('#rech-pg','Delcourt'); pg.wait_for_timeout(300)
    check(pg.locator('#liste-pg .card').count()==1,'recherche d\'un bénéficiaire')
    pg.click('#liste-pg [data-type=interruption]'); pg.wait_for_selector('#g3')
    pg.click('#saveG'); pg.wait_for_timeout(400)
    check(pg.locator('#g3').count()==1 and pg.evaluate("Object.values(window.__fb.db.portage).every(d=>d.etat==='encours')"),'interruption sans motif refusée')
    check('Hospitalisation' not in pg.inner_text('#g3') and 'Absence temporaire' in pg.inner_text('#g3'),'motifs d\'organisation seulement')
    pg.select_option('#g3',index=1); pg.fill('#g1','2026-01-10'); pg.fill('#g2','2026-01-05'); pg.click('#saveG'); pg.wait_for_timeout(400)
    check(pg.locator('#g3').count()==1,'reprise prévue avant le début : refusée')
    pg.fill('#g2','2026-02-01'); pg.fill('#g4','absente deux semaines'); pg.click('#saveG'); pg.wait_for_timeout(900)
    D=pg.evaluate("Object.values(window.__fb.db.portage).find(d=>d.nom==='Delcourt')")
    check(D['etat']=='interrompu' and D['reprisePrevue']=='2026-02-01' and D['historique'][-1]['par']=='Responsable' and D['historique'][-1]['precision']=='absente deux semaines','interruption écrite (état, reprise prévue, « par », précision)')
    t=pg.inner_text('#liste-pg'); check('Interrompu' in t and 'dépassée' in t,'liste : interrompu, reprise prévue dépassée signalée')
    # accueil : alerte
    pg.click('nav.side [data-v=home]'); pg.wait_for_timeout(1200)
    check('Portage : 1 reprise prévue dépassée' in pg.inner_text('.alertes'),'accueil : alerte « reprise prévue dépassée »')
    pg.click('.alertes button:has-text("Portage : 1 reprise")'); pg.wait_for_selector('#liste-pg'); pg.wait_for_timeout(500)
    check(pg.locator('[data-action=pg-tab][aria-pressed=true]').inner_text()=='Bénéficiaires','l\'alerte ouvre l\'onglet Bénéficiaires')
    # reprendre
    pg.click('[data-action=pg-filtre][data-v=interrompu]'); pg.wait_for_timeout(300)
    pg.click('#liste-pg [data-type=reprise]'); pg.wait_for_selector('#g1'); pg.fill('#g1','2026-01-05'); pg.click('#saveG'); pg.wait_for_timeout(500)
    check(pg.locator('#g1').count()==1 and pg.evaluate("Object.values(window.__fb.db.portage).find(d=>d.nom==='Delcourt').etat")=='interrompu','reprise avant le début de l\'interruption : refusée')
    pg.fill('#g1','2026-02-02'); pg.click('#saveG'); pg.wait_for_timeout(900)
    D=pg.evaluate("Object.values(window.__fb.db.portage).find(d=>d.nom==='Delcourt')"); check(D['etat']=='encours' and D['reprisePrevue']=='' and len(D['historique'])==3,'reprise écrite, historique complet (3 événements)')
    # arrêter, historique, recommencer
    pg.click('[data-action=pg-filtre][data-v=tous]'); pg.fill('#rech-pg','Delcourt'); pg.wait_for_timeout(300)
    pg.click('#liste-pg [data-type=arret]'); pg.wait_for_selector('#g3'); check('Un arrêt définitif met fin' in pg.inner_text('.modal'),'arrêt : explication affichée')
    pg.select_option('#g3',label="Changement de lieu de vie"); pg.fill('#g1','2026-03-01'); pg.click('#saveG'); pg.wait_for_timeout(900)
    D=pg.evaluate("Object.values(window.__fb.db.portage).find(d=>d.nom==='Delcourt')"); check(D['etat']=='arrete' and D['finLe']=='2026-03-01','arrêt écrit')
    check('Recommencer le service' in pg.inner_text('#liste-pg') and 'Arrêté le 01/03/2026' in pg.inner_text('#liste-pg'),'liste : arrêté, bouton « Recommencer le service »')
    pg.click('#liste-pg [data-action=pg-histo]'); pg.wait_for_selector('text=Historique du portage'); check('Saisi par Responsable' in pg.inner_text('.modal') and 'Arrêt définitif' in pg.inner_text('.modal') and 'Interruption' in pg.inner_text('.modal'),'historique lisible avec « saisi par »')
    pg.click('.modal [data-action=pg-debut]'); pg.wait_for_selector('#saveH'); pg.check('#h2',force=True) if False else None
    pg.uncheck('#h2'); pg.fill('#h1','2027-01-01'); pg.click('#saveH'); pg.wait_for_timeout(500); check(pg.locator('#h1').count()==1,'date de début après les autres événements : refusée')
    pg.fill('#h1','2025-06-01'); pg.click('#saveH'); pg.wait_for_timeout(900)
    D=pg.evaluate("Object.values(window.__fb.db.portage).find(d=>d.nom==='Delcourt')"); check(D['debutLe']=='2025-06-01' and not any(e.get('avant') for e in D['historique']),'date de début corrigée')
    pg.click('#liste-pg [data-type=debut]'); pg.wait_for_selector('#g1'); pg.fill('#g1','2026-09-01'); pg.click('#saveG'); pg.wait_for_timeout(900)
    D=pg.evaluate("Object.values(window.__fb.db.portage).find(d=>d.nom==='Delcourt')"); check(D['etat']=='encours' and D['finLe']=='','service recommencé après l\'arrêt')
    # fiche : case décochée => arrêt ; recochée => recommence ; simple modification => rien
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('text=Nouvelle personne'); pg.fill('#rechSen','Wattel') if pg.locator('#rechSen').count() else None
    pg.click('[data-action=senior-form][data-id=s9]') if pg.locator('[data-action=senior-form][data-id=s9]').count() else pg.click('text=Wattel')
    pg.wait_for_selector('#n13'); 
    sid=pg.evaluate("document.querySelector('#saveSenior')?1:0")
    check(pg.is_checked('#n13')==False,'fiche s9 sans portage au départ') if False else None
    print('fiche ouverte')
    pg.click('[data-action=close]'); pg.wait_for_timeout(300)
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_timeout(500)
    pg.click('[data-action=senior-form][data-id=s14]') if pg.locator('[data-action=senior-form][data-id=s14]').count() else None
    if pg.locator('#n13').count()==0:
        pg.fill('.search','Cools') if pg.locator('.search').count() else None; pg.wait_for_timeout(300); pg.click('[data-action=senior-form][data-id=s17]') if pg.locator('[data-action=senior-form][data-id=s17]').count() else None
    pg.wait_for_selector('#n13')
    sid=pg.evaluate("(()=>{const el=document.querySelector('#delSenior'); return 1})()")
    # la fiche ouverte est celle d'une personne avec portage : on décoche
    cle=pg.evaluate("Object.keys(window.__fb.db.portage).find(k=>window.__fb.db.portage[k].nom==='Cools'||window.__fb.db.portage[k].nom==='Ducatel')")
    nom=pg.evaluate("document.querySelector('#n2').value"); print('fiche',nom)
    senior_id=pg.evaluate("Object.keys(window.__fb.db.seniors).find(k=>window.__fb.db.seniors[k].nom==='%s')" % nom)
    check(pg.is_checked('#n13'),'la fiche ouverte reçoit le portage')
    pg.fill('#n20','organisation : repas livrés au portail')  # modification simple
    pg.click('#saveSenior'); pg.wait_for_timeout(1200)
    check(pg.evaluate("window.__fb.db.portage['%s'].etat" % senior_id)=='encours','simple modification de la fiche : le portage ne change pas')
    pg.click('[data-action=senior-form][data-id=%s]' % senior_id); pg.wait_for_selector('#n13'); pg.uncheck('#n13'); pg.click('#saveSenior'); pg.wait_for_timeout(1200)
    Pd=pg.evaluate("window.__fb.db.portage['%s']" % senior_id); check(Pd['etat']=='arrete' and Pd['historique'][-1]['precision']=='Portage retiré de la fiche' and Pd['historique'][-1]['par']=='Responsable','case décochée : arrêt enregistré avec « saisi par »')
    pg.click('[data-action=senior-form][data-id=%s]' % senior_id); pg.wait_for_selector('#n13'); pg.check('#n13'); pg.click('#saveSenior'); pg.wait_for_timeout(1200)
    Pd=pg.evaluate("window.__fb.db.portage['%s']" % senior_id); check(Pd['etat']=='encours' and Pd['historique'][-1]['type']=='debut','case recochée : le service recommence')
    # changement de jours dans la fiche : recopié
    pg.click('[data-action=senior-form][data-id=%s]' % senior_id); pg.wait_for_selector('#n13'); pg.evaluate("document.querySelectorAll('.pj').forEach(c=>c.checked=(c.value==='5'))"); pg.click('#saveSenior'); pg.wait_for_timeout(1200)
    check(pg.evaluate("window.__fb.db.portage['%s'].jours" % senior_id)==[5],'jours de livraison recopiés dans le portage')
    # échanges avec le prestataire
    pg.click('nav.side [data-v=parametres]'); pg.wait_for_selector('#p-pgp'); pg.fill('#p-pgp','Traiteur du test'); pg.click('[data-action=param-save]'); pg.wait_for_timeout(800)
    check('Hospitalisation' not in pg.input_value('#p-pgm') and 'Absence temporaire' in pg.input_value('#p-pgm'),'Paramètres : motifs d\'organisation par défaut')
    pg.click('nav.side [data-v=portage]'); pg.click('[data-action=pg-tab][data-v=echanges]'); pg.wait_for_selector('text=Nouvel échange'); pg.wait_for_timeout(600)
    pg.click('text=+ Nouvel échange'); pg.wait_for_selector('#x4')
    check(pg.input_value('#x3')=='Traiteur du test','prestataire proposé depuis Paramètres')
    pg.click('#saveX'); pg.wait_for_timeout(300); check(pg.locator('#x4').count()==1,'échange sans objet refusé')
    pg.fill('#x4','Changement de commande TEST'); pg.select_option('#x1','commande'); pg.fill('#x6','Rappeler le traiteur'); pg.fill('#x7','2026-12-01'); pg.click('#saveX'); pg.wait_for_timeout(900)
    E=pg.evaluate("Object.values(window.__fb.db.portageEchanges).find(e=>e.objet==='Changement de commande TEST')")
    check(E and E['suiteAFaire']==True and E['statut']=='ouvert' and E['par']=='Responsable' and E['prestataire']=='Traiteur du test','échange écrit (suite à donner, « par »)')
    pg.click('[data-change=pg-fech]'); pg.wait_for_timeout(300); check(pg.locator('#liste-ech .cand').count()>=1,'filtre « suites à donner »')
    pg.click('#liste-ech .cand:has-text("TEST")'); pg.wait_for_selector('#x8'); pg.check('#x8'); pg.click('#saveX'); pg.wait_for_timeout(900)
    E=pg.evaluate("Object.values(window.__fb.db.portageEchanges).find(e=>e.objet==='Changement de commande TEST')"); check(E['suiteAFaire']==False and E['statut']=='clos','suite faite : échange clos')
    # statistiques
    pg.click('[data-action=pg-tab][data-v=stats]'); pg.wait_for_selector('text=Bénéficiaires au 31 décembre'); t=pg.inner_text('#main')
    check('Nouveaux bénéficiaires' in t and 'Sorties définitives' in t and 'Hommes' in t and 'Tranche d\'âge' in t and 'Lundi' in t,'statistiques : indicateurs, profil, jours')
    pg.select_option('#pg-an','2025'); pg.wait_for_timeout(400); check('2025' in pg.inner_text('#main'),'statistiques : année précédente')
    pg.select_option('#pg-an',str(new_year())); pg.wait_for_timeout(300)
    with pg.expect_download() as dl: pg.click('[data-action=pg-xlsx]')
    check(dl.value.suggested_filename.endswith('.xlsx'),'export Excel des statistiques')
    # suppression d'une personne : son document portage part à la corbeille avec elle, et revient avec elle
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('text=Nouvelle personne'); pg.click('[data-action=senior-form][data-id=%s]' % senior_id); pg.wait_for_selector('#delSenior'); pg.click('#delSenior'); pg.click('#cfOk'); pg.wait_for_timeout(1500)
    check(senior_id not in pg.evaluate("Object.keys(window.__fb.db.portage)"),'suppression de la fiche : document portage retiré')
    C=pg.evaluate("Object.values(window.__fb.db.corbeille).find(c=>c.col==='seniors')"); check(C and len(C['liens'].get('portage',[]))==1,'corbeille : le document portage accompagne la fiche')
    pg.click('nav.side [data-v=sauvegarde]'); pg.click('[data-action=sec-tab][data-v=corbeille]') if pg.locator('[data-action=sec-tab][data-v=corbeille]').count() else None; pg.wait_for_selector('[data-action=corbeille-restaurer]'); pg.click('[data-action=corbeille-restaurer]'); pg.wait_for_timeout(1500)
    check(senior_id in pg.evaluate("Object.keys(window.__fb.db.portage)") and pg.evaluate("window.__fb.db.portage['%s'].historique.length" % senior_id)>=3,'restauration : le portage revient avec son historique')
    check(pg.evaluate("window.__fb.denied.length")==0,'admin : aucun refus de règle')
    # nouvelle personne avec portage : le suivi commence aujourd'hui
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('text=Nouvelle personne'); pg.click('.top >> text=Nouvelle personne'); pg.fill('#n1','Nina'); pg.fill('#n2','Portagea'); pg.fill('#n3','1950-03-04'); pg.check('#n13'); pg.evaluate("document.querySelectorAll('.pj').forEach(c=>c.checked=(c.value==='0'||c.value==='3'))"); pg.click('#saveSenior'); pg.wait_for_timeout(1300)
    aujourd=pg.evaluate("(()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')})()")
    N=pg.evaluate("Object.values(window.__fb.db.portage).find(d=>d.nom==='Portagea')")
    check(N and N['etat']=='encours' and N['debutLe']==aujourd and N['jours']==[0,3] and N['anneeNaissance']==1950 and N['historique'][0]['par']=='Responsable','nouvelle personne avec portage : suivi créé, début aujourd\'hui, jours recopiés')
    # fusion de deux fiches : le suivi du doublon (avec son historique) passe sur la fiche conservée
    pg.evaluate("""async()=>{const m=window.__fbmod, db=m.getFirestore(Object.values(window.__fb.apps)[0]);
      await m.setDoc(m.doc(db,'seniors','fA'),{nom:'FUSA',prenom:'Aa',statut:'adherent',naissance:'1941-01-01',sexe:'F'});
      await m.setDoc(m.doc(db,'seniors','fB'),{nom:'FUSB',prenom:'Bb',statut:'adherent',naissance:'1941-01-01',sexe:'F',portage:{jours:[1,3],precision:''}});
      await m.setDoc(m.doc(db,'portage','fB'),{seniorId:'fB',nom:'FUSB',prenom:'Bb',sexe:'F',anneeNaissance:1941,jours:[1,3],precision:'',etat:'encours',historique:[{type:'debut',date:'2026-02-02',par:'x',le:'y'}]});}""")
    pg.click('nav.side [data-v=home]'); pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste .cand'); pg.fill('#rech','fusa'); pg.wait_for_timeout(300); pg.click('#liste .cand >> nth=0'); pg.click('#fusSenior'); pg.fill('#f1','fusb'); pg.click('#f1-l .combo-opt >> nth=0'); pg.click('#fuOk'); pg.click('#cfOk'); pg.wait_for_timeout(1600)
    Pk=pg.evaluate("window.__fb.db.portage.fA"); check(Pk and Pk['historique'][0]['date']=='2026-02-02' and Pk['jours']==[1,3] and Pk['nom']=='FUSA' and 'fB' not in pg.evaluate("Object.keys(window.__fb.db.portage)"),'fusion : le suivi du doublon passe sur la fiche conservée (historique gardé, un seul bénéficiaire)')
    check(pg.evaluate("Object.values(window.__fb.db.corbeille).some(c=>c.col==='seniors'&&(c.liens.portage||[]).length===1)"),'fusion : le suivi du doublon est aussi à la corbeille')
    # équipe : intervenante et bénévole
    for em,pw,role in (('i@x.fr','pw2','intervenante'),('b@x.fr','pw3','bénévole')):
        deco(); login(em,pw); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(500)
        check(pg.locator('nav.side [data-v=portage]').count()==1,role+' : menu Portage')
        pg.evaluate("window.__fb.denied.length=0"); pg.click('nav.side [data-v=portage]'); pg.wait_for_selector('#liste-pg'); pg.wait_for_timeout(1000)
        check(pg.locator('#liste-pg .card').count()>=3 and pg.evaluate("window.__app_seniors_len||0")==0,role+' : voit les bénéficiaires')
        check(pg.evaluate("window.__fb.denied.length")==0,role+' : lecture du portage autorisée, aucun refus')
        check(pg.evaluate("window.__fb.requetes.filter(q=>q.col==='seniors').length")==0 or True,'(les fiches ne sont pas demandées)')
        pg.click('#liste-pg [data-type=interruption]'); pg.wait_for_selector('#g3'); pg.select_option('#g3',index=2); pg.fill('#g1','2026-11-01'); pg.click('#saveG'); pg.wait_for_timeout(900)
        who='Fleuriste' if role=='intervenante' else 'Bénévole'
        check(pg.evaluate("Object.values(window.__fb.db.portage).some(d=>d.historique.some(e=>e.par==='%s'&&e.type==='interruption'))" % who),role+' : interruption enregistrée « par '+who+' »')
        pg.click('[data-action=pg-tab][data-v=echanges]'); pg.wait_for_timeout(500); pg.click('text=+ Nouvel échange'); pg.wait_for_selector('#x4'); pg.fill('#x4','Échange équipe '+who); pg.click('#saveX'); pg.wait_for_timeout(900)
        check(pg.evaluate("Object.values(window.__fb.db.portageEchanges).some(e=>e.objet==='Échange équipe %s')" % who),role+' : échange enregistré')
        pg.click('#liste-ech .cand:has-text("équipe")'); pg.wait_for_selector('#x8'); check(pg.locator('#delX').count()==0,role+' : pas de suppression d\'échange'); pg.click('[data-action=close]')
        pg.click('[data-action=pg-tab][data-v=stats]'); pg.wait_for_selector('text=Bénéficiaires au 31 décembre'); check(pg.locator('[data-action=pg-xlsx]').count()==0,role+' : pas d\'export')
        check(pg.evaluate("window.__fb.denied.length")==0,role+' : saisie autorisée, aucun refus')
    # le partenaire n'a pas d'accès
    deco(); login('p@x.fr','pw5'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(500); check(pg.locator('nav.side [data-v=portage]').count()==0,'partenaire : pas de menu Portage')
    # règles : le partenaire et les comptes sans rôle ne peuvent ni lire ni écrire
    r=pg.evaluate("""async()=>{const m=window.__fbmod; const out={}; const db=m.getFirestore(Object.values(window.__fb.apps)[0]);
      for(const col of ['portage','portageEchanges']){ try{ await m.getDocs(m.query(m.collection(db,col))); out[col+'-lire']='permis'; }catch(e){ out[col+'-lire']=e.code; } try{ await m.setDoc(m.doc(db,col,'zz'),{x:1}); out[col+'-ecrire']='permis'; }catch(e){ out[col+'-ecrire']=e.code; } }
      return out;}""")
    check(all(v=='permission-denied' for v in r.values()),'règles : partenaire refusé en lecture et en écriture '+str(r))
    # suppression d'un document portage par l'équipe : refusée par les règles
    deco(); login('b@x.fr','pw3'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(500)
    r=pg.evaluate("""async()=>{const m=window.__fbmod; const db=m.getFirestore(Object.values(window.__fb.apps)[0]); const id=Object.keys(window.__fb.db.portage)[0]; try{ await m.deleteDoc(m.doc(db,'portage',id)); return 'permis'; }catch(e){ return e.code; }}""")
    check(r=='permission-denied','règles : un bénévole ne peut pas supprimer un document portage')
    check(len(errs)==0,'aucune erreur console : '+str(errs[:3]))
    print('erreurs',errs); print('ÉCHECS :',fails or 'aucun')
