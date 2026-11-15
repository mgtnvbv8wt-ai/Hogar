# Pantalla de administración
import os
from playwright.sync_api import sync_playwright
HERE = os.path.dirname(os.path.abspath(__file__))
BASE = os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')
MOCK = open(os.path.join(HERE, 'mock-supabase.js'), encoding='utf-8').read()
OUT = os.path.join(HERE, 'out') + os.sep
fails = []
def check(name, cond, extra=''):
    print(('OK   ' if cond else 'FALLA'), name, '' if cond else extra)
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(service_workers='block', viewport={'width': 390, 'height': 844}, locale='es-ES', timezone_id='Europe/Madrid')
    ctx.route('**/supabase-js*/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('dialog', lambda d: d.accept())
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(300)
    calls = lambda n: pg.evaluate("n => (window.__rpc || []).filter(c => c[0] === n)", n)

    pg.click('#btnSettings'); pg.wait_for_selector('#sheet button:has-text("Administración")')
    check('el administrador ve el botón «Administración»', True)
    pg.click('#sheet button:has-text("Administración")'); pg.wait_for_selector('#sheet h3:has-text("Administración")'); pg.wait_for_timeout(300)
    txt = pg.inner_text('#sheet')
    check('lista los miembros con su correo', 'guillem@example.com' in txt and 'silvia@example.com' in txt)
    check('marca quién eres tú', '(tú)' in txt)
    check('muestra el código de invitación', 'abc123abc123' in txt)
    check('muestra los móviles con avisos y su nombre', 'iPhone · iOS 18' in txt and 'Sin nombre' in txt)
    check('muestra la última copia', 'Última copia' in txt)
    check('no se ofrece quitarse a uno mismo', pg.locator('#sheet .adm-row:has-text("guillem@example.com") button:has-text("Quitar")').count() == 0)
    pg.screenshot(path=OUT + 'admin.png')

    pg.click('#sheet button:has-text("Generar otro")'); pg.wait_for_timeout(300)
    check('generar otro código llama al servidor y lo muestra', len(calls('admin_regenerate_invite')) == 1 and 'nuevo0000000' in pg.inner_text('#sheet'))
    check('y actualiza el código guardado en la app', pg.evaluate("state.household.invite_code") == 'nuevo0000000')
    pg.click('#sheet .adm-row:has-text("silvia@example.com") button:has-text("Quitar")'); pg.wait_for_timeout(300)
    rm = calls('admin_remove_member')
    check('quitar a un miembro lo pide al servidor con su id', len(rm) == 1 and rm[0][1] == {'p_user': 'u2'}, str(rm))
    pg.click('#sheet .adm-row:has-text("Sin nombre") button:has-text("Borrar")'); pg.wait_for_timeout(300)
    dd = calls('admin_delete_device')
    check('borrar un móvil lo pide al servidor', len(dd) == 1 and dd[0][1] == {'p_id': 'd2'}, str(dd))
    pg.click('#sheet button:has-text("Hacer una ahora")'); pg.wait_for_timeout(300)
    check('«Hacer una ahora» pide una copia', len(calls('admin_backup_now')) == 1)

    # quien no es administrador no ve nada
    pg.evaluate("closeSheet(); window.__admin = { is_admin: false }")
    pg.click('#btnSettings'); pg.wait_for_selector('#sheet h3'); pg.wait_for_timeout(400)
    check('quien no es administrador no ve el botón', pg.locator('#sheet button:has-text("Administración")').count() == 0)
    check('sin errores de página', not errs, str(errs))
    b.close()
print(('\nTodo correcto' if not fails else f'\n{len(fails)} fallos'))
