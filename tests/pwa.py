# Tests de l'application installable : manifeste, icônes, service worker, hors connexion, mise à jour, bouton Installer.
# Lancer (serveur local sur 8765 depuis le dossier de l'appli) : python3 tests/pwa.py
import json, os, re, shutil, subprocess, struct, sys, threading, http.server, socketserver, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ech = []
def check(c, m):
    print(('ok - ' if c else 'ECHEC - ') + m)
    if not c: ech.append(m)
def png_taille(p):
    with open(p, 'rb') as f: d = f.read(24)
    return struct.unpack('>II', d[16:24]) if d[:8] == b'\x89PNG\r\n\x1a\n' else None

# --- 1. Fichiers statiques ---
man = json.load(open(f'{ROOT}/manifest.webmanifest', encoding='utf-8'))
check(man['name'] == 'AniMerci' and man['short_name'] == 'AniMerci', 'manifeste : nom AniMerci')
check(man['display'] == 'standalone' and man['start_url'] == './' and man['scope'] == './', 'manifeste : standalone, adresse relative')
check(man['lang'] == 'fr' and man['theme_color'] == '#5B2A4B', 'manifeste : langue et couleur')
for ic in man['icons']:
    w, h = map(int, ic['sizes'].split('x'))
    check(png_taille(f"{ROOT}/{ic['src']}") == (w, h), f"icône {ic['src']} : taille réelle {w}x{h} ({ic['purpose']})")
check({i['purpose'] for i in man['icons']} == {'any', 'maskable'}, 'icônes any + maskable présentes')
check(png_taille(f'{ROOT}/icons/apple-touch-icon.png') == (180, 180), 'apple-touch-icon 180x180')
check(png_taille(f'{ROOT}/icons/favicon-32.png') == (32, 32), 'favicon 32x32')
idx = open(f'{ROOT}/index.html', encoding='utf-8').read()
for pat, lab in [('rel="manifest" href="manifest.webmanifest"', 'lien manifeste'), ('rel="apple-touch-icon"', 'lien apple-touch-icon'), ('rel="icon" href="favicon.svg"', 'lien favicon svg'), ('apple-mobile-web-app-title" content="AniMerci"', 'titre iOS AniMerci'), ('<title>AniMerci</title>', 'titre de la page')]:
    check(pat in idx, 'index.html : ' + lab)
sw = open(f'{ROOT}/sw.js', encoding='utf-8').read()
ver = re.search(r"VERSION = '([^']+)'", open(f'{ROOT}/js/version.js', encoding='utf-8').read()).group(1)
check(re.search(r"const VERSION = '([^']+)'", sw).group(1) == ver, f'sw.js et js/version.js ont la même version ({ver})')
liste = re.search(r'COQUILLE = \[(.*?)\];', sw, re.S).group(1)
dans_sw = set(re.findall(r"'([^']+)'", liste))
manque = [u for u in dans_sw if u != './' and not os.path.exists(f'{ROOT}/{u}')]
check(not manque, 'sw.js : tous les fichiers listés existent ' + str(manque))
js_reels = {f'js/{f}' for f in os.listdir(f'{ROOT}/js') if f.endswith('.js')}
check(js_reels <= dans_sw, 'sw.js : tous les fichiers js sont mis en cache ' + str(sorted(js_reels - dans_sw)))
check(all(i['src'] in dans_sw for i in man['icons']), 'sw.js : toutes les icônes du manifeste sont mises en cache')

# --- 2. Navigateur ---
class Q(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
def serveur(dossier, port):
    h = functools.partial(Q, directory=dossier)
    socketserver.TCPServer.allow_reuse_address = True
    s = socketserver.TCPServer(('127.0.0.1', port), h); threading.Thread(target=s.serve_forever, daemon=True).start(); return s
TMP = '/tmp/animerci-upd'
shutil.rmtree(TMP, ignore_errors=True); shutil.copytree(ROOT, TMP, ignore=shutil.ignore_patterns('tests', 'node_modules', '__pycache__'))
s1 = serveur(TMP, 8766)
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    ctx = b.new_context(viewport={'width': 1200, 'height': 800}); pg = ctx.new_page()
    erreurs = []; pg.on('pageerror', lambda e: erreurs.append(str(e)))
    pg.on('console', lambda m: erreurs.append(m.text) if m.type == 'error' and not re.search(r'favicon|ERR_TUNNEL|ERR_INTERNET_DISCONNECTED', m.text) else None)
    pg.goto('http://localhost:8766/index.html'); pg.wait_for_selector('text=Essayer comme administratrice')
    check(pg.title() == 'AniMerci', 'titre de l\'onglet : AniMerci')
    check('AniMerci' in pg.inner_text('h1'), 'écran de connexion : AniMerci')
    check(pg.evaluate("fetch('manifest.webmanifest').then(r=>r.ok)"), 'manifeste servi')
    pg.wait_for_function("navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(r=>!!r.active)", timeout=15000)
    pg.reload(); pg.wait_for_selector('text=Essayer comme administratrice')
    pg.wait_for_function("!!navigator.serviceWorker.controller", timeout=15000)
    check(True, 'service worker actif et contrôle la page')
    noms = pg.evaluate("caches.keys()"); check(noms == [f'animerci-{ver}'], f'un seul cache : animerci-{ver} {noms}')
    urls = pg.evaluate("caches.open('animerci-%s').then(c=>c.keys()).then(k=>k.map(r=>new URL(r.url).pathname))" % ver)
    check(all(u.endswith(('/', '.html', '.js', '.css', '.png', '.svg', '.webmanifest')) for u in urls) and len(urls) >= 25, f'cache : {len(urls)} fichiers du programme')
    # Connexion en démo, saisie de données, puis vérification : aucune donnée dans le cache
    pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    pg.click('nav.side [data-v=seniors]'); pg.wait_for_selector('#rech')
    urls2 = pg.evaluate("caches.open('animerci-%s').then(c=>c.keys()).then(k=>k.map(r=>r.url))" % ver)
    check(not any(re.search(r'firestore|identitytoolkit|securetoken|googleapis', u) for u in urls2), 'cache : aucune requête de données (Firestore / Auth)')
    check(pg.locator('text=Installer l\'application').count() == 1, 'menu : bouton Installer l\'application')
    # Aide d'installation
    pg.click('text=Installer l\'application'); pg.wait_for_selector('text=Sur l\'écran d\'accueil')
    t = pg.inner_text('#layer')
    check(all(x in t for x in ['iPhone', 'Android', 'PC ou Mac', 'Partager', 'Installer']), 'aide : iPhone, Android, PC/Mac')
    pg.click('#layer [data-action=close]'); check(pg.locator('#layer .modal, #mbg').count() == 0, 'aide : se ferme')
    # Invite d'installation native simulée (Android / Chrome PC)
    pg.evaluate("""()=>{ window.__invites=0; const e=new Event('beforeinstallprompt'); e.prompt=()=>{window.__invites++;return Promise.resolve()}; e.userChoice=Promise.resolve({outcome:'accepted'}); window.dispatchEvent(e); }""")
    pg.click('text=Installer l\'application'); pg.wait_for_timeout(300)
    check(pg.evaluate("window.__invites")==1, 'bouton Installer : déclenche l\'invite native du navigateur')
    # Hors connexion : l'application démarre depuis le cache
    ctx.set_offline(True)
    pg.reload(); pg.wait_for_selector('text=Essayer comme administratrice', timeout=15000)
    check(True, 'hors connexion : l\'écran de démarrage s\'affiche')
    pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
    check(True, 'hors connexion : l\'outil (démonstration) fonctionne')
    ctx.set_offline(False)
    # Mode installé : plus de bouton (simulation du mode standalone via émulation média)
    # --- 3. Mise à jour : nouvelle version publiée ---
    pg.goto('http://localhost:8766/index.html'); pg.wait_for_selector('text=Essayer comme administratrice')
    sw2 = open(f'{TMP}/sw.js', encoding='utf-8').read().replace(f"VERSION = '{ver}'", "VERSION = '9.9.9'")
    open(f'{TMP}/sw.js', 'w', encoding='utf-8').write(sw2)
    pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>r.update())")
    try:
        pg.wait_for_selector('#maj', timeout=15000); check(True, 'mise à jour : bandeau « nouvelle version disponible »')
        check(pg.evaluate("caches.keys()") and 'animerci-' + ver in pg.evaluate("caches.keys()"), 'mise à jour : ancienne version conservée tant qu\'on n\'a pas accepté')
        with pg.expect_navigation(timeout=15000):
            pg.click('#maj-ok')
        pg.wait_for_selector('text=Essayer comme administratrice')
        pg.wait_for_function("caches.keys().then(k=>k.length===1&&k[0]==='animerci-9.9.9')", timeout=15000)
        check(True, 'mise à jour : la page se recharge et l\'ancien cache est supprimé')
    except Exception as e:
        check(False, 'mise à jour : ' + str(e).splitlines()[0])
    # Première visite : aucun rechargement intempestif
    ctx2 = b.new_context(); q = ctx2.new_page(); navs = []
    q.on('framenavigated', lambda f: navs.append(f.url) if f == q.main_frame else None)
    q.goto('http://localhost:8766/index.html'); q.wait_for_selector('text=Essayer comme administratrice'); q.wait_for_timeout(2500)
    check(len(navs) == 1, 'première visite : pas de rechargement automatique ' + str(len(navs)))
    check(q.locator('#maj').count() == 0, 'première visite : pas de bandeau de mise à jour')
    check(not erreurs, 'aucune erreur console ' + str(erreurs[:3]))
    b.close()
print('ÉCHECS :', ech if ech else 'aucun'); sys.exit(1 if ech else 0)
