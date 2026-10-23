import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
import sys
from playwright.sync_api import sync_playwright
MOCK=open(os.path.join(HERE, 'mock-supabase.js'),encoding='utf-8').read()
lang=sys.argv[1] if len(sys.argv)>1 else 'es'
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,timezone_id='Europe/Madrid')
    ctx.route('**/supabase-js*/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK)); ctx.route('**/sw.js',lambda r:r.abort())
    ctx.add_init_script(f"try{{localStorage.setItem('hogar-lang','{lang}')}}catch(e){{}}")
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(400)
    # --- búsqueda
    pg.click('#btnSearch'); pg.wait_for_timeout(150)
    print('vacío:',pg.inner_text('#sheet').replace('\n',' | ')[:90])
    pg.fill('#sheet input','le'); pg.wait_for_timeout(150); print('"le":',pg.inner_text('#sheet').replace('\n',' | ')[:230]); pg.screenshot(path=OUT+f'q-search-{lang}.png')
    pg.fill('#sheet input','PLATANO'); pg.wait_for_timeout(100); print('sin tildes/mayúsculas ->',pg.inner_text('#sheet').replace('\n',' | ')[:80])
    pg.fill('#sheet input','fontanero'); pg.wait_for_timeout(100); pg.click('#sheet .srow >> nth=0'); pg.wait_for_timeout(300)
    print('tras pulsar tarea -> pestaña:',pg.evaluate('state.tab'),'| flash:',pg.evaluate("!!document.querySelector('.flash')"))
    pg.fill('#choreIn','x') if False else None
    pg.click('#btnSearch'); pg.fill('#sheet input','natacion'); pg.wait_for_timeout(100); pg.click('#sheet .srow >> nth=0'); pg.wait_for_timeout(300); print('evento -> pestaña:',pg.evaluate('state.tab'),'| calMode:',pg.evaluate('state.calMode'))
    pg.click('#btnSearch'); pg.fill('#sheet input','zzzz'); pg.wait_for_timeout(100); print('sin resultados:',pg.inner_text('#sheet').split('\n')[1] if '\n' in pg.inner_text('#sheet') else pg.inner_text('#sheet')); pg.click('#sheet button:last-child')
    # --- filtro de tareas y contador
    pg.click('nav button[data-tab=chores]'); pg.wait_for_timeout(250)
    print('stats:',pg.inner_text('#choreStats')); print('filtro:',pg.inner_text('#choreFilter').replace('\n',' | '))
    n_all=pg.evaluate("document.querySelectorAll('#choreList .item').length"); pg.click('#choreFilter button >> nth=1'); pg.wait_for_timeout(150)
    n_mine=pg.evaluate("document.querySelectorAll('#choreList .item').length"); print('tareas todas/mías (L\'Estartit):',n_all,n_mine); pg.screenshot(path=OUT+f'q-chores-{lang}.png')
    # contador al completar
    pg.click('#choreFilter button >> nth=0'); pg.wait_for_timeout(100)
    pg.evaluate("toggleChore(state.chores.find(c=>c.id==='c2'))"); pg.wait_for_timeout(300); print('stats tras hacer c2:',pg.inner_text('#choreStats'))
    pg.evaluate("toggleChore(state.chores.find(c=>c.id==='c2'))"); pg.wait_for_timeout(300); print('stats tras deshacer c2:',pg.inner_text('#choreStats'))
    # --- chat: respuesta
    pg.click('nav button[data-tab=chat]'); pg.wait_for_timeout(250)
    pg.click('#chatlog .msg >> nth=0'); pg.wait_for_timeout(100); print('barra:',pg.inner_text('#replyBar'),'| hidden:',pg.evaluate("document.querySelector('#replyBar').hidden"))
    pg.fill('#chatIn','Vale, gracias'); pg.click('#chatForm button[type=submit]'); pg.wait_for_timeout(300)
    print('mensaje con reply_to:',pg.evaluate("state.messages.at(-1).reply_to"),'| cita visible:',pg.inner_text('#chatlog .msg:last-child').replace('\n',' | ')); pg.screenshot(path=OUT+f'q-chat-{lang}.png')
    print('barra oculta tras enviar:',pg.evaluate("document.querySelector('#replyBar').hidden"))
    # --- colores por vivienda y vacíos
    pg.click('nav button[data-tab=shop]'); pg.wait_for_timeout(200); pg.click('#shopSeg button >> nth=1'); pg.wait_for_timeout(150)
    print('place attr:',pg.evaluate("document.body.dataset.place"),'| color seg:',pg.evaluate("getComputedStyle(document.querySelector('#shopSeg button.on')).backgroundColor")); pg.screenshot(path=OUT+f'q-shop-{lang}.png')
    pg.evaluate("state.items=[]; render()"); pg.wait_for_timeout(100); pg.screenshot(path=OUT+f'q-empty-{lang}.png')
    print('ERRORS',errs); b.close()
