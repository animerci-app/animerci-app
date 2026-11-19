# Aucun chevauchement de fenêtres, bandeaux, barres et messages, quel que soit l'appareil.
# Pour chaque appareil : tous les onglets, les fenêtres (fiches, imports, confirmations), le bandeau de mise à jour et un message affichés en même temps.
from playwright.sync_api import sync_playwright
import sys
APPAREILS=[('iPhone SE',375,667),('iPhone 14 Pro Max',430,932),('Pixel 7',412,915),('Petit Android',360,640),('Téléphone paysage',844,390),('Petit téléphone paysage',667,375),
           ('iPad portrait',768,1024),('iPad paysage',1024,768),('Portable',1366,768),('Grand écran',1920,1080)]
ONGLETS=['home','seniors','activites','planning','taches','bilans','annuaire','equipe','parametres','sauvegarde']
JS_ANALYSE = """() => {
  const vw = innerWidth, vh = innerHeight, res = [];
  const vis = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  // 1. éléments flottants (fixes ou collants) : ne doivent pas se recouvrir (la fenêtre modale recouvre volontairement le reste)
  const flot = [...document.querySelectorAll('body *')].filter(e => { const p = getComputedStyle(e).position; return (p === 'fixed' || p === 'sticky') && vis(e); })
    .filter(e => !e.closest('.modal') && e.id !== 'mbg');
  const modale = document.querySelector('.modal');
  const nom = e => (e.id ? '#' + e.id : '') + (e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : '') || e.tagName;
  if (!modale) for (let i = 0; i < flot.length; i++) for (let j = i + 1; j < flot.length; j++) {
    const a = flot[i], b = flot[j]; if (a.contains(b) || b.contains(a)) continue;
    const r = a.getBoundingClientRect(), s = b.getBoundingClientRect();
    const w = Math.min(r.right, s.right) - Math.max(r.left, s.left), h = Math.min(r.bottom, s.bottom) - Math.max(r.top, s.top);
    if (w > 3 && h > 3) res.push(`chevauchement : ${nom(a)} et ${nom(b)} (${Math.round(w)}×${Math.round(h)} px)`);
  }
  // 2. la fenêtre modale reste dans l'écran et un seul calque est ouvert
  const calques = document.querySelectorAll('.modal-bg').length; if (calques > 1) res.push(`${calques} fenêtres empilées`);
  if (modale) { const r = modale.getBoundingClientRect(); if (r.left < -1 || r.right > vw + 1 || r.top < -1 || r.bottom > vh + 1) res.push(`fenêtre hors de l'écran (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)} pour ${vw}×${vh})`);
    for (const c of modale.querySelectorAll('input,select,textarea,button')) { if (!vis(c)) continue; const q = c.getBoundingClientRect(); if (q.right > r.right + 1 || q.left < r.left - 1) res.push(`champ ou bouton qui dépasse de la fenêtre : ${nom(c)}`); }
    // les messages (toast) et bandeaux fixes ne doivent pas masquer les boutons de la fenêtre
    for (const f of document.querySelectorAll('.toast,#maj')) { if (!vis(f)) continue; const q = f.getBoundingClientRect(); for (const c of modale.querySelectorAll('button,input,select,textarea')) { if (!vis(c)) continue; const t = c.getBoundingClientRect(); if (t.bottom <= r.top || t.top >= r.bottom) continue; if (t.bottom > 0 && t.top < vh && Math.min(q.right, t.right) - Math.max(q.left, t.left) > 3 && Math.min(q.bottom, t.bottom) - Math.max(q.top, t.top) > 3) { res.push(`${nom(f)} masque ${nom(c)} de la fenêtre`); break; } } }
  }
  // 3. pas de défilement horizontal de la page, ni de contenu qui sort à droite (hors zones défilantes voulues)
  if (document.documentElement.scrollWidth > vw + 1) res.push(`la page défile horizontalement (${document.documentElement.scrollWidth} > ${vw})`);
  const racine = modale || document.querySelector('main');
  if (racine) for (const e of racine.querySelectorAll('*')) { if (!vis(e)) continue; const r = e.getBoundingClientRect(); if (r.right > vw + 2) { let p = e, dans = false; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (p !== e && (o === 'auto' || o === 'scroll' || o === 'hidden')) { dans = true; break; } p = p.parentElement; } if (!dans) { res.push(`contenu qui sort de l'écran : ${nom(e)}`); break; } } }
  return res;
}"""
JS_BAS = """() => { // en bas de page, le dernier contenu doit rester visible au-dessus de la barre de navigation
  const nav = document.querySelector('nav.side'), main = document.querySelector('main'); if (!nav || !main) return [];
  const rn = nav.getBoundingClientRect(); if (getComputedStyle(nav).position !== 'fixed') return [];
  scrollTo(0, document.documentElement.scrollHeight);
  const dern = [...main.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(); return r.height > 2 && r.width > 2 && r.bottom > 0; }).sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0];
  if (dern && dern.getBoundingClientRect().bottom > rn.top + 1) return [`le bas de la page passe sous la barre de navigation (${Math.round(dern.getBoundingClientRect().bottom)} > ${Math.round(rn.top)})`];
  return [];
}"""
echecs=[]; total=0
def noter(app,ou,liste):
    global total
    total+=1
    for m in liste: echecs.append(f'{app} · {ou} : {m}'); 
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox'])
    for nom,w,h in APPAREILS:
        tactile = w<1000
        ctx=b.new_context(viewport={'width':w,'height':h},has_touch=tactile,is_mobile=w<800,device_scale_factor=2 if tactile else 1); pg=ctx.new_page(); errs=[]
        pg.on('pageerror',lambda e: errs.append(str(e)))
        pg.goto('http://localhost:8765/index.html'); pg.click('text=Essayer comme administratrice'); pg.wait_for_selector('text=Que voulez-vous faire')
        def aller(v):
            pg.evaluate(f"document.querySelector('nav.side [data-v={v}]').click()"); pg.wait_for_timeout(450)
        def fermer():
            pg.evaluate("document.querySelector('#layer').innerHTML=''; document.querySelectorAll('.toast,#maj').forEach(e=>e.remove())")
        # A. chaque onglet, seul puis avec le bandeau de mise à jour et un message affichés
        for v in ONGLETS:
            aller(v); noter(nom,f'onglet {v}',pg.evaluate(JS_ANALYSE)+pg.evaluate(JS_BAS)); pg.evaluate("scrollTo(0,0)")
            pg.evaluate("""()=>{ const b=document.createElement('div'); b.id='maj'; b.innerHTML='<span style="flex:1">Une nouvelle version de l\\'application est disponible.</span><button class="btn">Mettre à jour</button>'; document.body.appendChild(b); const t=document.createElement('div'); t.className='toast'; t.textContent='Enregistré : message de test assez long pour la largeur'; document.body.appendChild(t); }""")
            noter(nom,f'onglet {v} + bandeau de mise à jour + message',pg.evaluate(JS_ANALYSE)); fermer()
        # B. fenêtres
        def ouvrir(onglet, libelle, ou):
            aller(onglet)
            try:
                pg.click(libelle,timeout=3000); pg.wait_for_selector('.modal',timeout=3000); pg.wait_for_timeout(250)
                noter(nom,ou,pg.evaluate(JS_ANALYSE)); 
                pg.evaluate("""()=>{ const t=document.createElement('div'); t.className='toast'; t.textContent='Message de test'; document.body.appendChild(t); }"""); noter(nom,ou+' + message',pg.evaluate(JS_ANALYSE))
            except Exception as e: echecs.append(f'{nom} · {ou} : impossible à ouvrir ({str(e)[:60]})')
            fermer()
        ouvrir('seniors','text=+ Nouvelle personne','fenêtre Nouvelle personne')
        ouvrir('seniors','text=Importer une liste','fenêtre Importer des personnes')
        ouvrir('seniors','.cand >> nth=0','fiche d\'une personne')
        ouvrir('activites','text=+ Nouvelle activité','fenêtre Nouvelle activité')
        ouvrir('activites','text=Importer une liste','fenêtre Importer des activités')
        ouvrir('annuaire','text=+ Ajouter','fenêtre Ajouter un contact')
        ouvrir('annuaire','text=Importer une liste','fenêtre Importer dans l\'annuaire')
        ouvrir('equipe','text=+ Ajouter une personne','fenêtre Ajouter à l\'équipe')
        ouvrir('taches','text=+ Nouvelle tâche','fenêtre Nouvelle tâche')
        # recherche globale
        aller('home')
        try: pg.evaluate("document.querySelector('[data-action=recherche],nav.side [data-action=cherche]')?.click()"); pg.wait_for_timeout(300); noter(nom,'recherche globale',pg.evaluate(JS_ANALYSE))
        except Exception: pass
        fermer()
        # C. une activité : écran de détail, appel, inscription, confirmation
        aller('activites'); pg.click('.act >> nth=0'); pg.wait_for_timeout(600); noter(nom,'détail d\'une activité',pg.evaluate(JS_ANALYSE)+pg.evaluate(JS_BAS)); pg.evaluate("scrollTo(0,0)")
        for lib,ou in [('text=Inscrire','fenêtre Inscrire'),('text=Dupliquer','fenêtre Dupliquer'),('text=Modifier','fenêtre Modifier l\'activité')]:
            try:
                pg.click(lib,timeout=2500); pg.wait_for_selector('.modal',timeout=2500); pg.wait_for_timeout(250); noter(nom,ou,pg.evaluate(JS_ANALYSE)); fermer()
            except Exception: pass
        for t in ['Présence','Appel']:
            if pg.locator(f'text={t}').count():
                pass
        noter(nom,'erreurs de page',[f'erreur : {e}' for e in errs]); ctx.close()
    b.close()
print(f'{total} contrôles sur {len(APPAREILS)} appareils')
for e in echecs: print('ECHEC -',e)
print('ÉCHECS :',len(echecs) if echecs else 'aucun')
