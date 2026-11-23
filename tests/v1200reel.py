# v1.20.0 (lot E) : accès provisoires, inscriptions par l'équipe, accueils en MODE RÉEL (faux Firebase aux règles de firestore.rules)
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
    pg.evaluate("""()=>{const F=window.__fb;
      F.db.users={a1:{nom:'Responsable',role:'admin',activites:[]},i1:{nom:'Fleuriste',role:'intervenant',activites:['a-flo']},b1:{nom:'Bénévole sans case',role:'benevole',activites:[]},
        b2:{nom:'Bénévole inscriptions',role:'benevole',activites:[],acces:{materiel:true,portage:false,inscriptions:true},accesFin:0,accesJusqu:''},
        b3:{nom:'Bénévole expiré',role:'benevole',activites:[],acces:{materiel:true,portage:true,inscriptions:true},accesFin:20200101,accesJusqu:'2020-01-01'},
        i2:{nom:'Intervenante cochée',role:'intervenant',activites:['a-flo'],acces:{materiel:true,portage:true,inscriptions:true},accesFin:0,accesJusqu:''}};
      F.accounts={'m@x.fr':{uid:'a1',pw:'pw1'},'i@x.fr':{uid:'i1',pw:'pw2'},'b@x.fr':{uid:'b1',pw:'pw3'},'b2@x.fr':{uid:'b2',pw:'pw5'},'b3@x.fr':{uid:'b3',pw:'pw6'},'i2@x.fr':{uid:'i2',pw:'pw7'}};
      F.db.seniorsLite={}; delete F.db.parametres.lite;}""")
    nav=lambda: pg.evaluate("[...document.querySelectorAll('nav.side [data-action=nav]')].map(b=>b.dataset.v)")
    def denied(js):
        return pg.evaluate("async()=>{const m=window.__fbmod; const db=m.getFirestore(Object.values(window.__fb.apps)[0]); try{ "+js+"; return 'ok'; }catch(e){ return e.code||String(e); }}")
    # ---------- Administratrice ----------
    login('m@x.fr','pw1'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(900)
    check('accueils' in nav() and 'equipe' in nav(),'admin : menu Accueils et Équipe')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#liste'); pg.wait_for_timeout(2500)
    n=pg.evaluate("[Object.keys(window.__fb.db.seniors).length, Object.keys(window.__fb.db.seniorsLite).length]")
    check(n[0]>0 and n[0]==n[1],'Personnes : copie restreinte créée pour chaque fiche '+str(n))
    L0=next(iter(pg.evaluate("window.__fb.db.seniorsLite").values()))
    check(set(L0.keys())=={'nom','prenom','nomNaissance','statut','anneeNaissance','adhPayees'},'copie restreinte : seulement les champs prévus '+str(sorted(L0.keys())))
    check(pg.evaluate("Object.keys(window.__fb.db.parametres.lite.h).length")==n[0],'table d\'empreintes écrite')
    snap=pg.evaluate("JSON.stringify(window.__fb.db.seniorsLite)")
    pg.click('nav.side [data-v=home]'); pg.wait_for_timeout(400); pg.click('nav.side [data-v=seniors]'); pg.wait_for_timeout(1500)
    check(pg.evaluate("JSON.stringify(window.__fb.db.seniorsLite)")==snap,'deuxième ouverture : rien de réécrit')
    # Équipe : cases d'accès
    pg.click('nav.side [data-v=equipe]'); pg.wait_for_selector('[data-action=equipe-form]'); pg.wait_for_timeout(600)
    check('Accès : Matériel, Saisie des inscriptions' in pg.inner_text('main'),'Équipe : résumé des accès sur la liste')
    pg.click('[data-action=equipe-form][data-id=b1]'); pg.wait_for_selector('#ea-materiel')
    check(pg.is_visible('#ea-inscriptions'),'bénévole : case « Saisie des inscriptions » proposée')
    pg.select_option('#e3','intervenant'); pg.wait_for_timeout(200)
    check(not pg.is_visible('#ea-inscriptions') and pg.is_visible('#ea-materiel'),'intervenante : pas de case « Saisie des inscriptions »')
    pg.select_option('#e3','benevole'); pg.check('#ea-materiel'); pg.fill('#ea-fin','2099-12-31'); pg.click('#saveEq'); pg.wait_for_timeout(900)
    U=pg.evaluate("window.__fb.db.users.b1")
    check(U['acces']=={'materiel':True,'portage':False,'inscriptions':False} and U['accesFin']==20991231 and U['accesJusqu']=='2099-12-31','compte b1 : cases et date de fin enregistrées '+str(U))
    # Accueils : création d'une fiche bourse
    pg.click('nav.side [data-v=accueils]'); pg.wait_for_selector('text=Accueils'); pg.wait_for_timeout(900)
    check(pg.locator('#main .cand').count()==1 and 'Fictif' in pg.inner_text('main'),'Accueils : fiche de démonstration (bourse) listée')
    pg.click('[data-action=ac-form][data-type=bourse]'); pg.wait_for_selector('#a1')
    pg.click('#saveAc'); pg.wait_for_timeout(300); check(pg.locator('#a1').count()==1,'fiche sans nom refusée')
    pg.fill('#a1','TESTNOM'); pg.fill('#a2','Test'); pg.fill('#a5','2026-11-01'); pg.fill('#a6','2027-03-01'); pg.fill('#a9','40'); pg.select_option('#a15','asigner'); pg.click('#saveAc'); pg.wait_for_selector('text=Heures de mission'); pg.wait_for_timeout(600)
    A=[a for a in pg.evaluate("Object.values(window.__fb.db.accueils)") if a['nom']=='TESTNOM'][0]
    check(A['type']=='bourse' and A['objectifHeures']==40 and 'naissance' not in A,'fiche bourse enregistrée, sans date de naissance')
    pg.fill('#h2','2.3'); pg.click('[data-action=ac-h-add]'); pg.wait_for_timeout(300)
    A=[a for a in pg.evaluate("Object.values(window.__fb.db.accueils)") if a['nom']=='TESTNOM'][0]
    check(len(A.get('heures',[]))==0,'heures non multiples du quart d\'heure refusées')
    pg.fill('#h2','2.5'); pg.fill('#h3','Atelier'); pg.click('[data-action=ac-h-add]'); pg.wait_for_timeout(700)
    A=[a for a in pg.evaluate("Object.values(window.__fb.db.accueils)") if a['nom']=='TESTNOM'][0]
    check(len(A['heures'])==1 and A['heures'][0]['heures']==2.5 and A['heures'][0]['par']=='Responsable','heures enregistrées, « saisi par » conservé')
    check('2,5 / 40' in pg.inner_text('.modal'),'cumul affiché : 2,5 / 40 h')
    pg.click('.modal [data-action=close]'); pg.wait_for_timeout(300)
    pg.click('nav.side [data-v=home]'); pg.wait_for_timeout(1500)
    check('à signer' in pg.inner_text('.alertes'),'accueil : alerte convention à signer')
    pg.click('nav.side [data-v=accueils]'); pg.wait_for_timeout(600); pg.click('[data-action=ac-tab][data-v=chiffres]'); pg.wait_for_selector('#ac-an'); pg.wait_for_timeout(800)
    check('Montant des bourses' in pg.inner_text('main'),'onglet Chiffres affiché')
    with pg.expect_download() as dl: pg.click('[data-action=ac-xlsx]')
    check(dl.value.suggested_filename.startswith('accueils-'),'export Excel des accueils')
    pg.click('[data-action=ac-tab][data-v=bourse]'); pg.wait_for_timeout(400); pg.click('.cand:has-text("TESTNOM")'); pg.wait_for_selector('[data-action=ac-suppr]'); pg.click('[data-action=ac-suppr]'); pg.click('#cfOk'); pg.wait_for_timeout(900)
    check(not any(a['nom']=='TESTNOM' for a in pg.evaluate("Object.values(window.__fb.db.accueils)")) and any(c['col']=='accueils' for c in pg.evaluate("Object.values(window.__fb.db.corbeille)")),'fiche supprimée : en corbeille')
    deco()
    # ---------- Intervenante sans case ----------
    login('i@x.fr','pw2'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(700)
    check(nav()==['activites','planning'],'intervenante sans case : Mes activités et Planning seulement '+str(nav()))
    r=denied("await m.getDoc(m.doc(db,'seniorsLite','probe'))"); check(r=='permission-denied','intervenante : liste restreinte refusée '+r)
    r=denied("await m.getDoc(m.doc(db,'materiel','probe'))"); check(r=='permission-denied','intervenante sans case : matériel refusé '+r)
    r=denied("await m.getDoc(m.doc(db,'accueils','probe'))"); check(r=='permission-denied','intervenante : accueils refusés '+r)
    deco()
    # ---------- Intervenante avec toutes les cases (inscriptions ignoré) ----------
    login('i2@x.fr','pw7'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(700)
    check(nav()==['activites','planning','materiel','portage'],'intervenante cochée : Matériel et Portage, jamais Inscriptions '+str(nav()))
    r=denied("await m.getDoc(m.doc(db,'seniorsLite','probe'))"); check(r=='permission-denied','intervenante cochée : liste restreinte refusée même avec la case '+r)
    r=denied("await m.setDoc(m.doc(db,'inscriptions','zz'),{activiteId:'a-flo',seniorId:'x',seniorNom:'X',statut:'inscrit',par:'i'})"); check(r=='permission-denied','intervenante : création d\'inscription refusée '+r)
    deco()
    # ---------- Bénévole avec case Matériel (b1, posée plus haut par l'administratrice) ----------
    login('b@x.fr','pw3'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(700)
    check(nav()==['planning','materiel'],'bénévole b1 : Matériel coché seulement '+str(nav()))
    r=denied("await m.getDoc(m.doc(db,'portage','probe'))"); check(r=='permission-denied','b1 : portage refusé (case non cochée) '+r)
    r=denied("await m.getDoc(m.doc(db,'emprunts','probe'))"); check(r=='ok','b1 : emprunts lisibles (case cochée) '+r)
    deco()
    # ---------- Bénévole expiré (b3) ----------
    login('b3@x.fr','pw6'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(700)
    check(nav()==['planning'],'bénévole dont l\'accès est terminé : planning seulement '+str(nav()))
    r=denied("await m.getDoc(m.doc(db,'seniorsLite','probe'))"); check(r=='permission-denied','b3 : liste restreinte refusée après la date de fin '+r)
    r=denied("await m.getDoc(m.doc(db,'materiel','probe'))"); check(r=='permission-denied','b3 : matériel refusé après la date de fin '+r)
    deco()
    # ---------- Bénévole avec Saisie des inscriptions (b2) ----------
    login('b2@x.fr','pw5'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(700)
    check(nav()==['planning','materiel','inscrire'],'bénévole b2 : Planning, Matériel, Inscriptions '+str(nav()))
    act=pg.evaluate("Object.entries(window.__fb.db.activites).find(([k,a])=>a.cap>0 && k!=='a-flo')[0]")
    pg.click('nav.side [data-v=inscrire]'); pg.wait_for_selector('#ins-act'); pg.wait_for_timeout(700)
    libres=pg.evaluate("(a)=>{const dej=new Set(Object.values(window.__fb.db.inscriptions).filter(i=>i.activiteId===a).map(i=>i.seniorId)); const noms=Object.entries(window.__fb.db.seniorsLite).filter(([k,l])=>!dej.has(k)).map(([k,l])=>l.nom); return noms.filter(n=>noms.filter(x=>x===n).length===1);}", act)
    check(len(libres)>=2,'deux personnes non inscrites disponibles pour le test')
    pg.select_option('#ins-act',act); pg.wait_for_selector('#ins-q'); pg.wait_for_timeout(700)
    pg.fill('#ins-q',libres[0]); pg.wait_for_timeout(500)
    t=pg.inner_text('#ins-liste'); check(libres[0] in t and 'Inscrire' in t,'recherche dans la liste restreinte')
    check('06' not in t and 'rue' not in t.lower() and '/19' not in t,'aucun téléphone, adresse ni date de naissance affichés')
    pg.select_option('#ins-src','Téléphone'); pg.click('#ins-liste [data-action=ins-go]'); pg.wait_for_timeout(900)
    I=[i for i in pg.evaluate("Object.values(window.__fb.db.inscriptions)") if i.get('par')=='Bénévole inscriptions']
    check(len(I)==1 and I[0]['source']=='Téléphone' and I[0]['statut'] in ('inscrit','attente'),'inscription créée avec « par » et la source '+str(I))
    check('Déjà' in pg.inner_text('#ins-liste'),'doublon : « Déjà inscrit·e » affiché, plus de bouton')
    iid=pg.evaluate("Object.entries(window.__fb.db.inscriptions).find(([k,i])=>i.par==='Bénévole inscriptions')[0]")
    r=denied("await m.setDoc(m.doc(db,'inscriptions','"+iid+"'),{statut:'invite'},{merge:true})"); check(r=='permission-denied','b2 : modification d\'une inscription refusée '+r)
    r=denied("await m.deleteDoc(m.doc(db,'inscriptions','"+iid+"'))"); check(r=='permission-denied','b2 : suppression refusée '+r)
    r=denied("await m.setDoc(m.doc(db,'inscriptions','zz2'),{activiteId:'"+act+"',seniorId:'x',seniorNom:'X',statut:'invite',par:'b'})"); check(r=='permission-denied','b2 : création avec statut « invité » refusée '+r)
    r=denied("await m.setDoc(m.doc(db,'inscriptions','zz3'),{activiteId:'"+act+"',seniorId:'x',seniorNom:'X',statut:'inscrit'})"); check(r=='permission-denied','b2 : création sans « saisi par » refusée '+r)
    r=denied("await m.getDoc(m.doc(db,'seniors','probe'))"); check(r=='permission-denied','b2 : fiches complètes des personnes refusées '+r)
    r=denied("await m.getDoc(m.doc(db,'accueils','probe'))"); check(r=='permission-denied','b2 : accueils refusés '+r)
    r=denied("await m.getDoc(m.doc(db,'portage','probe'))"); check(r=='permission-denied','b2 : portage refusé (case non cochée) '+r)
    r=denied("await m.setDoc(m.doc(db,'seniorsLite','zz'),{nom:'X'})"); check(r=='permission-denied','b2 : écriture dans la liste restreinte refusée '+r)
    # activité complète -> liste d'attente
    pg.evaluate("(a)=>{window.__fb.db.activites[a].cap=1; window.__fb.listeners.forEach(l=>l.run());}", act); pg.wait_for_timeout(500); pg.click('nav.side [data-v=planning]'); pg.wait_for_timeout(300); pg.click('nav.side [data-v=inscrire]'); pg.wait_for_selector('#ins-act'); pg.select_option('#ins-act',act); pg.wait_for_selector('#ins-q'); pg.wait_for_timeout(600)
    pg.fill('#ins-q',libres[1]); pg.wait_for_timeout(400)
    check('complète' in pg.inner_text('main').lower(),'activité complète annoncée')
    pg.click('#ins-liste [data-action=ins-go]'); pg.wait_for_timeout(800)
    I=[i for i in pg.evaluate("Object.values(window.__fb.db.inscriptions)") if i.get('par')=='Bénévole inscriptions']
    check(len(I)==2 and any(i['statut']=='attente' for i in I),'activité complète : mise en liste d\'attente '+str([i['statut'] for i in I]))
    deco()
    check(len(errs)==0,'aucune erreur console : '+str(errs[:3]))
    print('erreurs',errs); print('ÉCHECS :',fails or 'aucun')
    b.close()
