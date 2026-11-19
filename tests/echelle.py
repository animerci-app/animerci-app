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
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_selector('#fl')
    pg.evaluate("""()=>{const F=window.__fb; const R=(n)=>Math.floor(Math.random()*n); const iso=(d)=>new Date(Date.UTC(2026,10,13)+d*864e5).toISOString().slice(0,10);
      F.db={users:{a1:{nom:'Responsable',role:'admin',activites:[]}},seniors:{},activites:{},inscriptions:{},seances:{},fiches:{},taches:{},corbeille:{},journal:{},parametres:{}};
      F.accounts={'m@x.fr':{uid:'a1',pw:'pw1'}};
      for(let i=0;i<300;i++)F.db.seniors['s'+i]={nom:'Nom'+i,prenom:'P'+i,statut:'adherent',sexe:'F',naissance:'1945-01-01'};
      for(let a=0;a<25;a++){F.db.activites['a'+a]={nom:'Act'+a,type:a<5?'sortie':'activite',cat:'Créatif',cap:15,date:iso(a<5?a*5+2:-30),jour:'lundi'};
        for(let k=0;k<60;k++)F.db.inscriptions['i'+a+'_'+k]={activiteId:'a'+a,seniorId:'s'+R(300),seniorNom:'X',statut:k<15?'inscrit':(k<20?'attente':'inscrit'),dateDemande:'2026-01-01'};
        for(let k=0;k<40;k++)F.db.seances['se'+a+'_'+k]={activiteId:'a'+a,date:iso(-7*k-1),valide:k>0,presences:{s1:'p',s2:'p'}};
        if(a<5)for(let k=0;k<20;k++)F.db.fiches['a'+a+'_s'+k]={activiteId:'a'+a,seniorId:'s'+k,contact:'c',tel:'1'};}
      for(let t=0;t<40;t++)F.db.taches['t'+t]={titre:'T'+t,done:false,echeance:iso(t-10),cat:'Autre'};
      for(let j=0;j<150;j++)F.db.journal['j'+j]={date:'2026-11-0'+(1+j%9)+'T10:00:00.000Z',par:'M',action:'Créé',type:'Personne',objet:'x'};
      for(let c=0;c<50;c++)F.db.corbeille['c'+c]={col:'seniors',label:'x'+c,date:'2026-11-10T10:00:00.000Z',doc:{id:'z'+c},liens:{}};}""")
    tot=pg.evaluate("Object.values(window.__fb.db).reduce((n,c)=>n+Object.keys(c).length,0)"); print('documents en base :',tot)
    pg.fill('#em','m@x.fr'); pg.fill('#pw','pw1'); pg.click('#fl button[type=submit], #fl .btn'); pg.wait_for_selector('text=Que voulez-vous faire'); pg.wait_for_timeout(6500)
    r0=pg.evaluate("window.__fb.reads"); print('ouverture (accueil + purge) :',r0,'lectures  (avant la v1.3.0 : environ', tot-0,')')
    def etape(nom,sel):
        a=pg.evaluate("window.__fb.reads"); pg.click(sel); pg.wait_for_timeout(1200); print(f'  + {nom} :',pg.evaluate("window.__fb.reads")-a,'lectures')
    etape('Personnes','nav.side [data-v=seniors]'); etape('Activités (liste)','nav.side [data-v=activites]')
    pg.click('.act >> nth=0'); pg.wait_for_timeout(1000); print('  + ouvrir une activité :',pg.evaluate("window.__fb.reads")-r0-0,'(cumul)')
    etape('Planning','nav.side [data-v=planning]'); etape('Bilans (année)','nav.side [data-v=bilans]'); etape('Équipe','nav.side [data-v=equipe]')
    print('CUMUL après tout cela :',pg.evaluate("window.__fb.reads"))
    print('Erreurs :',errs or 'aucune')
