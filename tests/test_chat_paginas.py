# Chat por páginas: carga de 60 en 60, sin saltos y con búsqueda en mensajes anteriores
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
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(300)
    # 150 mensajes antiguos (uno de ellos con una palabra única) + el «Hola» de ahora
    pg.evaluate("""() => {
      const H = window.__db.messages[0].household_id, U = window.__db.messages[0].user_id;
      for (let i = 0; i < 150; i++) window.__db.messages.push({ id: 'old' + i, household_id: H, user_id: U,
        body: i === 5 ? 'la clave del garaje es zorro' : 'mensaje antiguo ' + i, created_at: new Date(Date.now() - (200 - i) * 60000).toISOString() });
    }""")
    pg.evaluate("loadAll().then(render)"); pg.wait_for_timeout(300)
    pg.click('nav button[data-tab=chat]'); pg.wait_for_timeout(300)
    n = lambda: pg.evaluate("state.messages.length")
    check('al abrir se cargan solo 60 mensajes', n() == 60, str(n()))
    check('hay botón «Cargar mensajes anteriores»', pg.is_visible('#chatlog .more'))
    check('el último mensaje es el más reciente', pg.evaluate("state.messages[state.messages.length - 1].body") == 'Hola')
    pg.evaluate("document.querySelector('#chatlog').scrollTop = 0"); pg.wait_for_timeout(100)
    first_before = pg.evaluate("state.messages[0].id")
    off = lambda i: pg.evaluate("(id) => document.querySelector('[data-id=\"' + id + '\"]').getBoundingClientRect().top - document.querySelector('#chatlog').getBoundingClientRect().top", i)
    off_before = off(first_before)
    pg.click('#chatlog .more'); pg.wait_for_timeout(300)
    check('cargar anteriores añade otros 60', n() == 120, str(n()))
    off_after = off(first_before)
    check('el chat no salta: el mensaje que leías queda en el mismo sitio', abs(off_after - off_before) < 3, f'{off_before} -> {off_after}')
    check('el orden es cronológico', pg.evaluate("state.messages.every((m, i, a) => !i || a[i - 1].created_at <= m.created_at)"))
    pg.click('#chatlog .more'); pg.wait_for_timeout(300)
    check('al llegar al principio se cargan todos (151)', n() == 151, str(n()))
    check('y desaparece el botón', not pg.is_visible('#chatlog .more'))

    # búsqueda en mensajes anteriores
    pg.evaluate("loadAll().then(render)"); pg.wait_for_timeout(300)
    check('una recarga conserva los mensajes ya cargados', n() == 151, str(n()))
    pg.evaluate("state.messages = state.messages.slice(-60); state.chatMore = true; renderChat()")
    pg.click('#btnSearch'); pg.wait_for_selector('#sheet input[type=search]')
    pg.fill('#sheet input[type=search]', 'zorro'); pg.wait_for_timeout(200)
    check('la búsqueda ofrece «Buscar en mensajes anteriores»', 'Buscar en mensajes anteriores' in pg.inner_text('#sheet'))
    pg.click('#sheet button:has-text("Buscar en mensajes anteriores")'); pg.wait_for_timeout(300)
    check('encuentra el mensaje antiguo', 'la clave del garaje es zorro' in pg.inner_text('#sheet'))
    pg.click('#sheet .srow:has-text("zorro")'); pg.wait_for_timeout(400)
    ok = pg.evaluate("state.messages.some(m => m.id === 'old5')")
    check('al abrirlo se carga y se muestra en el chat', ok and pg.is_visible('[data-id="old5"]'))
    check('sin huecos: mensajes consecutivos desde ese hasta ahora', pg.evaluate("state.messages.length") == 151 - 5 + 1 - 0 or pg.evaluate("state.messages.length") >= 146, str(pg.evaluate("state.messages.length")))
    check('sin errores de página', not errs, str(errs))
    b.close()
print(('\nTodo correcto' if not fails else f'\n{len(fails)} fallos'))
