# v1.17.0 (lot A) : Matériel en MODE RÉEL (faux Firebase aux règles de firestore.rules)
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
    def login(em,pw):
        pg.fill('#em',em); pg.fill('#pw',pw); pg.click('#fl button[type=submit], #fl .btn')
    def deco():
        pg.click('[data-action=compte]'); pg.click('.modal [data-action=logout]'); pg.wait_for_selector('#fl')
    pg.evaluate("()=>{const F=window.__fb; F.db.users.p1={nom:'Médiathèque',role:'partenaire',activites:[],partenaireId:'c-med',partenaireNom:'Médiathèque municipale'}; F.accounts['p@x.fr']={uid:'p1',pw:'pw5'};}")
    # --- administratrice ---
    login('m@x.fr','pw1'); pg.wait_for_selector('nav.side'); pg.wait_for_timeout(600)
    pg.evaluate("window.__fb.reads=0")
    t=pg.inner_text('main'); check('Stock bas' in t or 'stock bas' in t.lower() or 'périmé' in t.lower(),'accueil : alertes du matériel lues avec des requêtes ciblées')
    check(pg.evaluate("window.__fb.reads")<80,'accueil : lectures du matériel limitées ('+str(pg.evaluate("window.__fb.reads"))+')')
    pg.click('nav.side [data-v=materiel]'); pg.wait_for_selector('text=Nouvel article'); pg.wait_for_timeout(500)
    pg.click('text=+ Nouvel article'); pg.wait_for_selector('#a1'); pg.fill('#a1','Article REEL'); pg.fill('#a6','5'); pg.fill('#a8','2'); pg.click('#saveA'); pg.wait_for_timeout(600)
    ar=pg.evaluate("Object.entries(window.__fb.db.materiel).find(([k,v])=>v.nom==='Article REEL')")
    check(ar and ar[1]['quantite']==5 and ar[1]['modifiePar']=='Responsable' and ar[1]['bas']==False,'admin : article écrit avec « saisi par » et champs calculés')
    pg.click('[data-action=mat-tab][data-v=reserves]'); pg.click('text=+ Nouvelle réserve'); pg.wait_for_selector('#a11'); pg.fill('#a1','Réserve REEL'); pg.select_option('#a11','article'); pg.fill('#a12','2027-01-15'); pg.fill('#a6','4'); pg.fill('#a8','1'); pg.click('#saveA'); pg.wait_for_timeout(600)
    rs=pg.evaluate("Object.entries(window.__fb.db.materiel).find(([k,v])=>v.nom==='Réserve REEL')")
    check(rs and rs[1]['echeance']=='2027-01-15' and rs[1]['peremptionPar']=='Responsable','admin : réserve avec date de péremption relevée par X')
    pg.click('.cand:has-text("Réserve REEL") [data-action=mat-mvt][data-sens=sortie]'); pg.wait_for_selector('#v1'); pg.fill('#v1','3'); pg.click('#saveV'); pg.wait_for_timeout(700)
    mv=pg.evaluate("Object.values(window.__fb.db.mouvements||{}).filter(v=>v.materielNom==='Réserve REEL')")
    check(len(mv)==1 and mv[0]['apres']==1 and mv[0]['par']=='Responsable' and mv[0]['parUid']=='a1','admin : mouvement écrit (reste, par, parUid)')
    check(pg.evaluate("window.__fb.db.materiel['%s'].quantite"%rs[0])==1 and pg.evaluate("window.__fb.db.materiel['%s'].bas"%rs[0])==True,'réserve : quantité et alerte « bas » mises à jour')
    pg.click('.cand:has-text("Réserve REEL") [data-action=mat-histo]'); pg.wait_for_selector('text=Historique —'); check('−3' in pg.inner_text('.modal'),'historique lu à la demande'); pg.click('.modal [data-action=close]')
    check(pg.evaluate("window.__fb.denied.length")==0,'admin : aucun refus de règle')
    # nom d'emprunteur de l'Annuaire (admin)
    pg.click('[data-action=mat-tab][data-v=emprunts]'); pg.click('text=+ Nouvel emprunt'); pg.wait_for_selector('#m1'); pg.wait_for_timeout(600)
    pg.select_option('#m1',index=1); pg.fill('#m5','Médiathèque'); pg.wait_for_timeout(300)
    check(pg.locator('.combo-opt:has-text("Médiathèque")').count()>=1,'admin : emprunteur proposé depuis l\'Annuaire')
    pg.locator('.combo-opt:has-text("Médiathèque municipale")').first.click(); pg.click('#saveM'); pg.wait_for_timeout(600)
    em=pg.evaluate("Object.values(window.__fb.db.emprunts).find(e=>e.emprunteurType==='contact'&&e.emprunteurId==='c-med')")
    check(em and em['emprunteurId']=='c-med' and em['rendu']==False,'admin : emprunt rattaché à la fiche Annuaire')
    # --- bénévole : lit, crée, modifie ; ne supprime pas ; ne lit pas les personnes ---
    deco(); login('b@x.fr','pw3'); pg.wait_for_selector('nav.side'); pg.click('nav.side [data-v=materiel]'); pg.wait_for_selector('text=Nouvel article'); pg.wait_for_timeout(500)
    check('Article REEL' in pg.inner_text('main'),'bénévole : voit le matériel')
    pg.click('.cand:has-text("Article REEL")'); pg.wait_for_selector('#a6'); check(pg.locator('#delA').count()==0,'bénévole : pas de bouton Supprimer'); pg.fill('#a6','7'); pg.click('#saveA'); pg.wait_for_timeout(600)
    check(pg.evaluate("window.__fb.db.materiel['%s'].quantite"%ar[0])==7 and pg.evaluate("window.__fb.db.materiel['%s'].modifiePar"%ar[0])=='Bénévole','bénévole : modification enregistrée, « modifié par » = lui')
    pg.click('[data-action=mat-tab][data-v=reserves]'); pg.click('.cand:has-text("Réserve REEL") [data-action=mat-mvt][data-sens=entree]'); pg.wait_for_selector('#v1'); pg.fill('#v1','2'); pg.click('#saveV'); pg.wait_for_timeout(700)
    check(pg.evaluate("Object.values(window.__fb.db.mouvements).filter(v=>v.par==='Bénévole').length")==1,'bénévole : entrée de stock enregistrée')
    pg.click('[data-action=mat-tab][data-v=emprunts]'); pg.click('text=+ Nouvel emprunt'); pg.wait_for_selector('#m1'); pg.select_option('#m1',index=1); pg.fill('#m5','Atelier cuisine'); pg.wait_for_timeout(300)
    o=pg.locator('.combo-opt:has-text("tel quel")'); (o.first.click() if o.count() else None); pg.click('#saveM'); pg.wait_for_timeout(600)
    check(pg.evaluate("Object.values(window.__fb.db.emprunts).some(e=>e.emprunteur==='Atelier cuisine'&&e.par==='Bénévole'&&e.emprunteurType==='libre')"),'bénévole : emprunt en texte libre')
    check(pg.evaluate("window.__fb.denied.length")==0,'bénévole : aucun refus sur ses actions permises')
    r=pg.evaluate("""async(ids)=>{const {store}=await import('/js/store.js'); const out={};
      try{await store.remove('materiel',ids.a); out.suppr='ECRIT'}catch(e){out.suppr='refusé'}
      try{await store.remove('emprunts',ids.e); out.supprE='ECRIT'}catch(e){out.supprE='refusé'}
      try{const mv=Object.keys(window.__fb.db.mouvements)[0]; await store.save('mouvements',{id:mv,quantite:999}); out.modifM='ECRIT'}catch(e){out.modifM='refusé'}
      try{await store.remove('mouvements',Object.keys(window.__fb.db.mouvements)[0]); out.supprM='ECRIT'}catch(e){out.supprM='refusé'}
      for(const c of ['seniors','contacts']){ try{await store.lire(c); out[c]='LU'}catch(e){out[c]='refusé'} }
      return out;}""",{'a':ar[0],'e':pg.evaluate("Object.keys(window.__fb.db.emprunts)[0]")})
    check(r['suppr']=='refusé' and r['supprE']=='refusé' and r['modifM']=='refusé' and r['supprM']=='refusé','bénévole : suppression de matériel/emprunt/mouvement et modification d\'un mouvement refusées '+str(r))
    check(r['seniors']=='refusé' and r['contacts']=='refusé','bénévole : personnes et annuaire toujours illisibles '+str(r))
    pg.evaluate("window.__fb.denied.length=0")
    # --- intervenante : même accès équipe ---
    deco(); login('i@x.fr','pw2'); pg.wait_for_selector('nav.side'); check(pg.locator('nav.side [data-v=materiel]').count()==1,'intervenante : menu Matériel')
    pg.click('nav.side [data-v=materiel]'); pg.wait_for_selector('text=Nouvel article'); pg.wait_for_timeout(400); check('Article REEL' in pg.inner_text('main'),'intervenante : voit le matériel')
    # --- partenaire : aucun accès ---
    deco(); login('p@x.fr','pw5'); pg.wait_for_selector('text=Mes échanges'); check(pg.locator('nav.side [data-v=materiel]').count()==0,'partenaire : pas de menu Matériel')
    r=pg.evaluate("""async()=>{const {store}=await import('/js/store.js'); const out={};
      for(const c of ['materiel','emprunts','mouvements']){ try{await store.lire(c); out['lire '+c]='LU'}catch(e){out['lire '+c]='refusé'} try{await store.save(c,{nom:'x'}); out['ecrire '+c]='ECRIT'}catch(e){out['ecrire '+c]='refusé'} }
      return out;}""")
    check(all(v=='refusé' for v in r.values()),'partenaire : lecture et écriture du matériel refusées '+str(r))
    # --- sans rôle ---
    pg.evaluate("window.__fb.denied.length=0"); deco() if pg.locator('[data-action=compte]').count() else None
    pg.wait_for_selector('#fl'); login('n@x.fr','pw4'); pg.wait_for_timeout(800); check(pg.locator('nav.side [data-v=materiel]').count()==0,'sans rôle : aucun accès au matériel')
    print('Erreurs console :',errs or 'aucune')
    b.close()
print('ÉCHECS :',fails or 'aucun'); import sys; sys.exit(1 if fails or errs else 0)
