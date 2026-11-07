# Uso diario: vista «Todas», deslizar para marcar/borrar y aviso de eventos
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
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='es-ES', has_touch=True)
    ctx.route('**/supabase-js*/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    ctx.route('**/sw.js', lambda r: r.abort())
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(400)
    cdp = ctx.new_cdp_session(pg)
    def swipe(sel, dx):
        r = pg.evaluate("s => { const e = document.querySelector(s).getBoundingClientRect(); return [e.x + e.width / 2, e.y + e.height / 2]; }", sel)
        x, y = r
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
        for k in range(1, 9):
            cdp.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx * k / 8, 'y': y}]})
        cdp.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
        pg.wait_for_timeout(350)

    # 1) vista «Todas»
    pg.click('nav button[data-tab=shop]'); pg.wait_for_timeout(200)
    segs = pg.inner_text('#shopSeg')
    check('la compra tiene botón «Todas»', 'Todas' in segs, segs)
    total = pg.evaluate("state.items.filter(i => !i.done).length")
    pg.click('#shopSeg button:last-child'); pg.wait_for_timeout(250)
    shown = pg.evaluate("document.querySelectorAll('#shopList .item:not(.done)').length")
    check('«Todas» muestra los productos de las dos viviendas', shown == total, f'{shown} vs {total}')
    check('en «Todas» no se puede añadir (formulario oculto)', not pg.is_visible('#shopForm'))
    check('cada producto indica su vivienda', '🏠' in pg.inner_text('#shopList'))
    pg.click('nav button[data-tab=chores]'); pg.wait_for_timeout(200)
    check('las tareas también tienen «Todas» activa', pg.evaluate("document.querySelector('#choreSeg button:last-child').classList.contains('on')"))
    check('en «Todas» no se puede crear tarea', not pg.is_visible('#choreForm'))
    pg.click('#choreSeg button:first-child'); pg.wait_for_timeout(250)
    check('al elegir una vivienda vuelve el formulario', pg.is_visible('#choreForm'))
    pg.screenshot(path=OUT + 'todas.png')

    # 2) deslizar
    pg.click('nav button[data-tab=shop]'); pg.wait_for_timeout(200)
    pg.click('#shopSeg button:first-child'); pg.wait_for_timeout(200)
    first = pg.evaluate("(() => { const i = state.items.find(x => x.place === state.place && !x.done); return i && i.id; })()")
    sel = f'#shopList .item[data-id="{first}"]'
    swipe(sel, 160)
    check('deslizar a la derecha marca el producto', pg.evaluate(f"state.items.find(x => x.id === '{first}').done") is True)
    check('y no abre el formulario', not pg.is_visible('#sheet'))
    n = pg.evaluate("state.items.length")
    swipe(sel, -160)
    check('deslizar a la izquierda borra (con deshacer)', pg.evaluate("state.items.length") == n - 1 and pg.is_visible('.toast'))
    pg.click('.toast button'); pg.wait_for_timeout(200)
    check('el deshacer recupera el producto', pg.evaluate("state.items.length") == n)
    swipe(sel, 40)
    check('un deslizamiento corto no hace nada', pg.evaluate(f"state.items.find(x => x.id === '{first}').done") is True)
    pg.click('nav button[data-tab=chores]'); pg.wait_for_timeout(200)
    cid = pg.evaluate("(() => { const c = state.chores.find(x => x.place === state.place && !x.done && !x.recur); return c && c.id; })()")
    swipe(f'#choreList .item[data-id="{cid}"]', 160)
    check('deslizar marca una tarea', pg.evaluate(f"state.chores.find(x => x.id === '{cid}').done") is True)

    # 3) aviso de eventos
    pg.click('nav button[data-tab=cal]'); pg.wait_for_timeout(200)
    pg.evaluate("eventForm(new Date())"); pg.wait_for_selector('#sheet input'); pg.wait_for_timeout(150)
    opts = pg.evaluate("[...document.querySelectorAll('#sheet select')].map(s => [...s.options].map(o => o.text))")
    check('el formulario de eventos tiene «Avisar»', any('1 hora antes' in o for o in opts), str(opts))
    pg.fill('#sheet input[placeholder^="Título"]', 'Dentista')
    idx = pg.evaluate("[...document.querySelectorAll('#sheet select')].findIndex(s => [...s.options].some(o => o.text === '1 hora antes'))")
    pg.locator('#sheet select').nth(idx).select_option('60')
    pg.click('#sheet button:has-text("Crear evento")'); pg.wait_for_timeout(300)
    check('el evento guarda remind_min = 60', pg.evaluate("window.__db.events.some(e => e.title === 'Dentista' && e.remind_min === 60)"))
    pg.evaluate("eventForm(new Date())"); pg.wait_for_selector('#sheet input'); pg.wait_for_timeout(150)
    pg.check('#sheet input[type=checkbox]'); pg.wait_for_timeout(100)
    opts = pg.evaluate("[...document.querySelectorAll('#sheet select')].map(s => [...s.options].map(o => o.text))")
    check('todo el día ofrece «La víspera a las 20:00»', any('La víspera a las 20:00' in o for o in opts), str(opts))
    # 4) preferencias de avisos
    pg.evaluate('closeSheet()'); pg.click('#btnSettings'); pg.wait_for_selector('#sheet label:has-text("Mensajes del chat")'); pg.wait_for_timeout(200)
    check('ajustes muestra «Qué avisos quieres recibir»', 'Qué avisos quieres recibir' in pg.inner_text('#sheet'))
    pg.uncheck('#sheet label:has-text("Mensajes del chat") input'); pg.wait_for_timeout(250)
    row = pg.evaluate("window.__db.notif_prefs[0]")
    check('desactivar el chat se guarda', row and row['prefs'].get('chat') is False, str(row))
    pg.check('#sheet label:has-text("Silencio por la noche") input'); pg.wait_for_timeout(250)
    row = pg.evaluate("window.__db.notif_prefs[0]")
    check('el silencio nocturno se guarda con horas por defecto', row['prefs'].get('quiet') is True and row['prefs'].get('quiet_from') == '23:00' and row['prefs'].get('quiet_to') == '07:30', str(row))
    check('sigue siendo una sola fila por persona', pg.evaluate("window.__db.notif_prefs.length") == 1)
    check('sin errores de página', not errs, str(errs))
    b.close()
print(('\nTodo correcto' if not fails else f'\n{len(fails)} fallos'))
