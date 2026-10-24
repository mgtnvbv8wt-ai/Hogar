# Simula perder la cobertura: los cambios se guardan en cola, la app se puede abrir sin red y todo se envía al volver.
import os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
BASE = os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')
MOCK = open(os.path.join(HERE, 'mock-supabase.js'), encoding='utf-8').read()
fails = []
def check(name, cond, extra=''):
    print(('OK   ' if cond else 'FALLA'), name, '' if cond else extra)
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='es-ES', timezone_id='Europe/Madrid')
    ctx.route('**/supabase-js*/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    ctx.route('**/sw.js', lambda r: r.abort())
    # el estado «sin red» sobrevive a las recargas con localStorage (solo para la prueba)
    ctx.add_init_script("try{ if(localStorage.getItem('t_off')==='1'){ window.__offline=true; window.__noSession=true; } }catch(e){}")
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(500)
    db_count = lambda t: pg.evaluate(f"window.__db.{t}.length")
    n_items, n_chores, n_msgs = db_count('shopping_items'), db_count('chores'), db_count('messages')

    # 1) se pierde la cobertura con la app abierta
    ctx.set_offline(True); pg.evaluate("window.__offline = true; window.dispatchEvent(new Event('offline'))"); pg.wait_for_timeout(200)
    check('aviso «Sin conexión» visible', pg.is_visible('#netbar') and 'Sin conexión' in pg.inner_text('#netbar'), pg.inner_text('#netbar'))
    pg.click('nav button[data-tab=shop]'); pg.wait_for_timeout(150)
    pg.fill('#shopIn', 'Pan de molde'); pg.press('#shopIn', 'Enter'); pg.wait_for_timeout(300)
    check('el producto aparece al instante sin red', 'Pan de molde' in pg.inner_text('#shopList'))
    check('y no llegó al servidor', db_count('shopping_items') == n_items)
    pg.click('nav button[data-tab=chores]'); pg.wait_for_timeout(150)
    pg.fill('#choreIn', 'Regar plantas'); pg.press('#choreIn', 'Enter'); pg.wait_for_timeout(300)
    check('la tarea aparece sin red', 'Regar plantas' in pg.inner_text('#choreList'))
    pg.evaluate("toggleChore(state.chores.find(c => c.id === 'c2'))"); pg.wait_for_timeout(300)
    pg.click('nav button[data-tab=chat]'); pg.wait_for_timeout(150)
    pg.fill('#chatIn', 'Estoy sin cobertura'); pg.press('#chatIn', 'Enter'); pg.wait_for_timeout(300)
    check('el mensaje aparece sin red', 'Estoy sin cobertura' in pg.inner_text('#chatlog'))
    pending = pg.evaluate('OPS.length')
    check('hay cambios en cola', pending >= 4, str(pending))
    check('el aviso cuenta los pendientes', 'pendientes' in pg.inner_text('#netbar'), pg.inner_text('#netbar'))
    check('nada llegó al servidor', db_count('chores') == n_chores and db_count('messages') == n_msgs)
    pg.screenshot(path=OUT + 'offline-bar.png')

    # 2) se cierra y se vuelve a abrir la app sin sesión válida ni red del servidor de datos
    pg.wait_for_timeout(1000)
    pg.evaluate("localStorage.setItem('t_off','1')")
    # nueva sesión del navegador (conserva localStorage) para reabrir la app; el contexto offline no recarga bien los scripts simulados
    st = ctx.storage_state(); ctx.close()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='es-ES', timezone_id='Europe/Madrid', storage_state=st)
    ctx.route('**/supabase-js*/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    ctx.route('**/sw.js', lambda r: r.abort())
    ctx.add_init_script("try{ if(localStorage.getItem('t_off')==='1'){ window.__offline=true; window.__noSession=true; } }catch(e){}")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])', timeout=8000); pg.wait_for_timeout(700)
    check('la app abre sin red con los datos guardados', pg.is_visible('#app') and pg.inner_text('#title') == 'Inicio')
    check('aviso «Sin conexión» tras reabrir', 'Sin conexión' in pg.inner_text('#netbar'), pg.inner_text('#netbar'))
    pg.click('nav button[data-tab=shop]'); pg.wait_for_timeout(150)
    check('los datos locales siguen ahí', 'Pan de molde' in pg.inner_text('#shopList'))
    check('la cola sobrevive al reinicio', pg.evaluate('OPS.length') == pending, str(pg.evaluate('OPS.length')))

    # 3) vuelve la cobertura
    pg.evaluate("localStorage.removeItem('t_off'); window.__offline = false; window.__noSession = false; window.dispatchEvent(new Event('online'))")
    pg.wait_for_timeout(4000)
    check('la cola se vació', pg.evaluate('OPS.length') == 0, str(pg.evaluate('OPS.length')))
    check('el producto llegó al servidor', pg.evaluate("window.__db.shopping_items.some(i => i.name === 'Pan de molde')"))
    check('la tarea llegó al servidor', pg.evaluate("window.__db.chores.some(c => c.title === 'Regar plantas')"))
    check('el mensaje llegó al servidor', pg.evaluate("window.__db.messages.some(m => m.body === 'Estoy sin cobertura')"))
    check('la tarea marcada llegó al servidor', pg.evaluate("window.__db.chores.find(c => c.id === 'c2').done") is True)
    check('el aviso desaparece', not pg.is_visible('#netbar'))
    check('sin duplicados', pg.evaluate("window.__db.shopping_items.filter(i => i.name === 'Pan de molde').length") == 1)
    check('sin errores de página', not errs, str(errs))
    b.close()
print(f"{len([1])*0 + 0}", end='')
print(('\nTodo correcto' if not fails else f'\n{len(fails)} fallos'))
