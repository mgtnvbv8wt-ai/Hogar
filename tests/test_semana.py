# Vista de semana del calendario
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
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(300)
    pg.evaluate("""() => { const d = new Date(); d.setHours(10, 0, 0, 0);
      window.__db.events.push({ id: 'ew1', household_id: window.__db.events[0] ? window.__db.events[0].household_id : window.__db.messages[0].household_id, title: 'Dentista semana',
        starts_at: d.toISOString(), all_day: false, created_by: 'u1', created_at: new Date().toISOString() }); }""")
    pg.evaluate("loadAll().then(render)"); pg.wait_for_timeout(300)
    pg.click('nav button[data-tab=cal]'); pg.wait_for_timeout(200)
    check('el selector tiene «Semana»', 'Semana' in pg.inner_text('#calSeg'))
    pg.click('#calSeg button[data-m=week]'); pg.wait_for_timeout(300)
    check('se muestra la vista de semana y no la de mes', pg.is_visible('#calWeek') and not pg.is_visible('#calMonth'))
    check('hay 7 días', pg.locator('#weekDays .wday').count() == 7)
    check('el primer día es lunes', 'lunes' in pg.locator('#weekDays .wday').first.inner_text().lower())
    check('hoy está marcado', pg.locator('#weekDays .wday.today').count() == 1)
    check('el evento de hoy sale en su día', 'Dentista semana' in pg.locator('#weekDays .wday.today').inner_text())
    t0 = pg.inner_text('#weekTitle')
    pg.click('#nextW'); pg.wait_for_timeout(250)
    t1 = pg.inner_text('#weekTitle')
    check('«siguiente» avanza una semana', t1 != t0 and pg.locator('#weekDays .wday.today').count() == 0, f'{t0} -> {t1}')
    check('en otra semana no sale el evento de hoy', 'Dentista semana' not in pg.inner_text('#weekDays'))
    pg.click('#prevW'); pg.click('#prevW'); pg.wait_for_timeout(250)
    check('«anterior» retrocede', pg.inner_text('#weekTitle') not in (t0, t1))
    pg.click('#nextW'); pg.wait_for_timeout(250)
    check('volver a la semana actual', pg.inner_text('#weekTitle') == t0)
    pg.screenshot(path=OUT + 'semana.png')
    pg.locator('#weekDays .wday').nth(2).locator('.wh button').click(); pg.wait_for_selector('#sheet input'); pg.wait_for_timeout(150)
    check('«+» abre el formulario de evento', pg.is_visible('#sheet h3'))
    pg.evaluate("closeSheet()")
    pg.click('#calSeg button[data-m=month]'); pg.wait_for_timeout(250)
    check('el mes sigue funcionando', pg.is_visible('#calMonth') and not pg.is_visible('#calWeek'))
    check('sin errores de página', not errs, str(errs))
    b.close()
print(('\nTodo correcto' if not fails else f'\n{len(fails)} fallos'))
