# Pictogramme et message de patience : visibles seulement si ça traîne.
from playwright.sync_api import sync_playwright
ech=[]
def ok(c,m):
    print(('ok - ' if c else 'ECHEC - ')+m)
    if not c: ech.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox']); pg=b.new_page(viewport={'width':390,'height':800})
    tenue=[]
    pg.route('**/js/app.js',lambda route: tenue.append(route))
    pg.goto('http://localhost:8765/index.html',wait_until='commit'); pg.wait_for_selector('.spin',timeout=3000)
    ok(pg.locator('main .spin').count()==1,'démarrage : pictogramme d\'attente affiché')
    ok(float(pg.eval_on_selector('main .patient','e=>getComputedStyle(e).opacity'))<0.1,'démarrage : message de patience caché au début')
    pg.wait_for_timeout(4800)
    ok(float(pg.eval_on_selector('main .patient','e=>getComputedStyle(e).opacity'))>0.9,'démarrage : message de patience visible après 4 s')
    tenue[0].continue_()
    pg.wait_for_selector('text=Essayer comme administratrice',timeout=15000)
    ok(pg.locator('main .spin').count()==0,'démarrage : le pictogramme disparaît une fois l\'application ouverte')
    pg.unroute('**/js/app.js')
    pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    # enregistrement lent : message de patience au bout de 3 s
    pg.evaluate("""async()=>{const m=await import('/js/ui.js'); const s=await import('/js/store.js'); const o=s.store.save.bind(s.store); s.store.save=(...a)=>new Promise(r=>setTimeout(()=>r(o(...a)),3800)); window.__m=m; m.sauver('taches',{titre:'test lenteur',statut:'a-faire'},'Enregistré'); }""")
    pg.wait_for_timeout(3400)
    ok('patience' in pg.inner_text('.toast'),'enregistrement lent : message « patience » affiché après 3 s')
    pg.wait_for_timeout(1500)
    ok(pg.locator('.toast', has_text='Enregistré').count()>=1,'enregistrement lent : le message de succès suit')
    b.close()
print('ÉCHECS :',ech or 'aucun')
