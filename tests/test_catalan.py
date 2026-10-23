import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
import re
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')
MOCK=open(os.path.join(HERE, 'mock-supabase.js'),encoding='utf-8').read()
ES=re.compile(r"\b(el|la|los|las|de|del|para|sin|con|una|hoy|mañana|añadir|eliminar|guardar|nuevo|nueva|tarea|tareas|evento|eventos|compra|menú|días?|semana|hecho|aún|todavía|escribe|pon|elige|ajustes|cerrar|crear|vivienda|opcional|repetir|repetición|fecha|lugar|notas|copia|seguridad|avisos|código|tiempo|viento|lluvia|humedad|presión|lista|vacía|está|próximos?|todo)\b",re.I)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='ca-ES',timezone_id='Europe/Madrid')
    ctx.route('**/supabase-js*/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK))
    ctx.route('**/sw.js',lambda r:r.abort())
    ctx.add_init_script("try{localStorage.setItem('hogar-lang','ca')}catch(e){}")
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])',timeout=5000); pg.wait_for_timeout(400)
    def dump(name):
        t=pg.inner_text('body'); pg.screenshot(path=OUT+f'ca-{name}.png')
        hits=sorted({m.group(0).lower() for m in ES.finditer(t)})
        print(f'--- {name}: possibles castellanismes: {hits}')
        return t
    print('lang attr:',pg.evaluate('document.documentElement.lang'))
    dump('home')
    for tab in ['cal','chat','shop','chores','menu']:
        pg.click(f'nav button[data-tab={tab}]'); pg.wait_for_timeout(250); dump(tab)
    pg.click('nav button[data-tab=cal]'); pg.wait_for_timeout(200)
    pg.click('#btnNewEvent') if pg.query_selector('#btnNewEvent') else None
    # formularios
    for sel,name in [('#btnSettings','settings')]:
        pg.click(sel); pg.wait_for_timeout(300); print(pg.inner_text('.modal')[:1500] if pg.query_selector('.modal') else ''); dump(name)
        pg.keyboard.press('Escape')
    print('ERRORS:',errs)
    b.close()
