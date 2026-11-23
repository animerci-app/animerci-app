# v1.18.0 (lot F) : fiches, adhésions, vérification en MODE RÉEL (faux Firebase aux règles de firestore.rules)
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
    # fiche à l'ancien format (avant 1.18.0) ajoutée aux données
    pg.evaluate("""()=>{const F=window.__fb; const an=new Date().getFullYear(); F.db.seniors.sOld={nom:'Ancien',prenom:'Format',statut:'adherent',naissance:'1944-02-02',tel:'06 12 12 12 12',contactNom:'Fille : Ana',contactTel:'03 20 10 10 10',adhesion:{date:an+'-01-10',montant:40,paye:true},commune:'Ville démo'};}""")
    login('m@x.fr','pw1'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(900)
    pg.evaluate("window.__fb.reads=0")
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('text=Nouvelle personne'); pg.wait_for_timeout(1500)
    o=pg.evaluate("window.__fb.db.seniors.sOld")
    check(isinstance(o.get('adhesions'),list) and o['adhesions'][0]['paye']==True and o.get('telPortable')=='06 12 12 12 12' and o.get('proches',[{}])[0].get('nom')=='Fille : Ana' and o.get('verifieLe')=='' and o.get('adhAnnee')==new_year(),'migration silencieuse : ancien format converti dans la base')
    check(o.get('tel')=='06 12 12 12 12' and o.get('contactNom')=='Fille : Ana','compatibilité : anciens champs conservés')
    # vérification
    pg.click('[data-action=sen-tab][data-v=verification]'); pg.wait_for_selector('[data-action=ver-ok]'); pg.click('.row:has-text("ANCIEN") [data-action=ver-ok]'); pg.wait_for_timeout(700)
    o=pg.evaluate("window.__fb.db.seniors.sOld"); check(o['verifieLe']==pg.evaluate("new Date().toISOString().slice(0,10)") and o['verifiePar']=='Responsable','vérification écrite avec la date et « par »')
    # règlement et renouvellement
    pg.click('[data-action=sen-tab][data-v=adhesions]'); pg.wait_for_selector('#adAn'); an=int(pg.eval_on_selector('#adAn','e=>e.value'))
    pg.select_option('#adAn',str(an+1)); pg.wait_for_timeout(400); pg.click('[data-action=adh-filtre][data-v=tous]'); pg.fill('#rechAdh','Ancien'); pg.wait_for_timeout(300)
    check('À renouveler' in pg.inner_text('#listeAdh'),'réel : « À renouveler » pour l\'année suivante')
    pg.click('#listeAdh [data-action=adh-renouv]'); pg.wait_for_timeout(600)
    o=pg.evaluate("window.__fb.db.seniors.sOld"); check(len(o['adhesions'])==2 and o['adhesions'][1]['paye']==False and o['adhesions'][1]['annee']==an+1 and o['adhAnnee']==an if an==new_year() else True,'renouvellement écrit (2 années, la dernière non réglée)')
    pg.click('#listeAdh [data-action=adh-regl]'); pg.wait_for_selector('#r2'); pg.click('#rOk'); pg.wait_for_timeout(700)
    o=pg.evaluate("window.__fb.db.seniors.sOld"); check(o['adhesions'][1]['paye']==True and o['adhAnnee']==an+1 and o['adhesions'][1]['datePaiement'],'règlement écrit, adhAnnee mise à jour pour les comptages')
    # compteurs serveur de l'accueil
    pg.click('nav.side [data-v=home]'); pg.wait_for_timeout(1200)
    q=pg.evaluate("window.__fb.requetes.length")
    check(pg.evaluate("window.__fb.denied.length")==0,'admin : aucun refus de règle')
    # fiche enrichie enregistrée en base réelle
    pg.click('nav.side [data-v=seniors]'); pg.click('[data-action=sen-tab][data-v=liste]'); pg.wait_for_selector('text=Nouvelle personne'); pg.click('text=+ Nouvelle personne'); pg.wait_for_selector('#n16')
    pg.fill('#n1','Reel'); pg.fill('#n2','Fiche'); pg.fill('#n3','1951-01-01'); pg.fill('#n16','07 00 00 00 00'); pg.fill('#n17','r@exemple.fr'); pg.fill('#pr0n','Proche REEL'); pg.fill('#pr0t','03 00 00 00 00'); pg.click('#saveSenior'); pg.wait_for_timeout(700)
    n=pg.evaluate("Object.values(window.__fb.db.seniors).find(s=>s.nom==='Fiche')")
    check(n and n['telPortable']=='07 00 00 00 00' and n['email']=='r@exemple.fr' and n['proches'][0]['nom']=='Proche REEL' and n['adhesions'][0]['annee']==new_year() and n['adhAnnee']==0 and n['contactNom']=='Proche REEL','nouvelle fiche : champs enrichis et calculés écrits')
    # accès des autres rôles aux personnes : toujours refusé
    deco(); login('i@x.fr','pw2'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(500)
    check(pg.locator('nav.side [data-v=seniors]').count()==0,'intervenante : pas d\'écran Personnes')
    print('erreurs',errs); print('ÉCHECS :',fails or 'aucun')
