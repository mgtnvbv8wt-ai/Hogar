# Listas reutilizables y número en el icono
import os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')
MOCK = open(os.path.join(HERE, 'mock-supabase.js'), encoding='utf-8').read()
fails = []
def check(name, cond, extra=''):
    print(('OK   ' if cond else 'FALLA'), name, '' if cond else extra)
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='es-ES', timezone_id='Europe/Madrid')
    ctx.route('**/supabase-js*/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    ctx.add_init_script("window.__badge = null; navigator.setAppBadge = n => { window.__badge = n; return Promise.resolve(); }; navigator.clearAppBadge = () => { window.__badge = 0; return Promise.resolve(); };")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(300)
    db = lambda js: pg.evaluate(js)

    # crear
    check('inicio tiene la tarjeta «Listas»', 'listas' in pg.inner_text('#homeBox').lower() and pg.is_visible('#homeBox button:has-text("Nueva lista")'))
    pg.click('#homeBox button:has-text("Nueva lista")'); pg.wait_for_selector('#sheet textarea')
    pg.fill('#sheet input', 'Maleta Torelló'); pg.fill('#sheet textarea', 'Pijamas\nCepillos de dientes\n\nCargador')
    pg.click('#sheet button:has-text("Guardar")'); pg.wait_for_timeout(300)
    lst = db("window.__db.checklists[0]")
    check('la lista se guarda con 3 elementos (sin líneas vacías)', lst and lst['title'] == 'Maleta Torelló' and [i['text'] for i in lst['items']] == ['Pijamas', 'Cepillos de dientes', 'Cargador'], str(lst))
    check('al crearla se abre para usarla', pg.is_visible('#sheet h3:has-text("Maleta Torelló")'))

    # marcar
    chk = lambda i: pg.locator('#sheet .item .chk').nth(i)
    chk(0).click(); pg.wait_for_timeout(150); chk(1).click(); pg.wait_for_timeout(250)
    check('el progreso se actualiza (2 / 3)', '2 / 3' in pg.inner_text('#sheet'))
    check('se guarda en la base de datos', [i['done'] for i in db("window.__db.checklists[0].items")] == [True, True, False])
    chk(2).click(); pg.wait_for_timeout(250)
    check('al marcar todo sale «Todo listo»', 'Todo listo' in pg.inner_text('#sheet'))
    check('se guarda la hora de terminada', db("window.__db.checklists[0].completed_at") is not None)

    # reiniciar a mano
    pg.click('#sheet button:has-text("Reiniciar")'); pg.wait_for_timeout(250)
    check('«Reiniciar» desmarca todo', all(not i['done'] for i in db("window.__db.checklists[0].items")) and db("window.__db.checklists[0].completed_at") is None)

    # reinicio automático a las 12 horas
    pg.click('#sheet button:has-text("Cerrar")'); pg.wait_for_timeout(150)
    db("(() => { const l = window.__db.checklists[0]; l.items.forEach(i => i.done = true); l.completed_at = new Date(Date.now() - 13 * 3600e3).toISOString(); })()")
    pg.evaluate("loadAll().then(render)"); pg.wait_for_timeout(400)
    check('13 horas después de terminarla se reinicia sola', all(not i['done'] for i in db("window.__db.checklists[0].items")))
    db("(() => { const l = window.__db.checklists[0]; l.items.forEach(i => i.done = true); l.completed_at = new Date(Date.now() - 2 * 3600e3).toISOString(); })()")
    pg.evaluate("loadAll().then(render)"); pg.wait_for_timeout(400)
    check('a las 2 horas todavía no se reinicia', all(i['done'] for i in db("window.__db.checklists[0].items")))

    # editar conservando lo marcado
    pg.click('#homeBox .srow:has-text("Maleta")'); pg.wait_for_selector('#sheet .item')
    pg.click('#sheet button:has-text("Editar")'); pg.wait_for_selector('#sheet textarea')
    pg.fill('#sheet textarea', 'Pijamas\nCepillos de dientes\nCargador\nOsito')
    pg.click('#sheet button:has-text("Guardar")'); pg.wait_for_timeout(300)
    its = db("window.__db.checklists[0].items")
    check('al editar se conserva lo marcado y se añade lo nuevo', [i['done'] for i in its] == [True, True, True, False] and its[3]['text'] == 'Osito', str(its))
    check('y deja de estar «terminada»', db("window.__db.checklists[0].completed_at") is None)

    # borrar con deshacer
    pg.click('#sheet button:has-text("Editar")'); pg.wait_for_selector('#sheet textarea')
    pg.click('#sheet button:has-text("Borrar")'); pg.wait_for_timeout(200)
    check('borrar quita la lista y ofrece deshacer', db("state.lists.length") == 0 and pg.is_visible('.toast.undo'))
    pg.click('.toast.undo button'); pg.wait_for_timeout(200)
    check('deshacer la recupera', db("state.lists.length") == 1)

    # número en el icono
    pg.evaluate("loadAll().then(render)"); pg.wait_for_timeout(300)
    n0 = db("state.chores.filter(c => !c.done && c.due && c.due <= ymd(new Date())).length")
    check('el icono coincide con las tareas pendientes de hoy', (db("window.__badge") or 0) == n0, f"{db('window.__badge')} vs {n0}")
    db("(() => { const d = new Date(); const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); const H = window.__db.chores[0] ? window.__db.chores[0].household_id : window.__db.messages[0].household_id; for (let i = 0; i < 2; i++) window.__db.chores.push({ id: 'cb' + i, household_id: H, title: 'Tarea ' + i, place: 'estartit', done: false, due: k, created_at: new Date().toISOString() }); })()")
    pg.evaluate("loadAll().then(render)"); pg.wait_for_timeout(300)
    n = db("state.chores.filter(c => !c.done && c.due && c.due <= ymd(new Date())).length")
    check('al haber más tareas de hoy sube el número', n == n0 + 2 and db("window.__badge") == n, f"{n} vs {db('window.__badge')}")
    check('sin errores de página', not errs, str(errs))
    b.close()
print(('\nTodo correcto' if not fails else f'\n{len(fails)} fallos'))
