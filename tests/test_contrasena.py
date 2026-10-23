import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
MOCK=open(os.path.join(HERE, 'mock-supabase.js'),encoding='utf-8').read()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='es-ES')
    ctx.route('**/supabase-js*/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK)); ctx.route('**/sw.js',lambda r:r.abort())
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(300)
    pg.evaluate("window._calls=[]; sb.auth.resetPasswordForEmail=async(e,o)=>{window._calls.push(['reset',e,o]);return {error:null}}; sb.auth.updateUser=async(u)=>{window._calls.push(['upd',u]);return {error:null}}; showOnly('auth')")
    pg.click('#aForgot'); print('sin email ->',pg.inner_text('#aErr'))
    pg.fill('#aEmail','silvia_r6@hotmail.com'); pg.click('#aForgot'); pg.wait_for_timeout(200)
    print('con email ->',pg.inner_text('#aErr')); pg.screenshot(path=OUT+'pw-login.png')
    print(pg.evaluate('window._calls'))
    pg.evaluate("showOnly('app'); passwordForm(true)"); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'pw-sheet.png')
    pg.fill('#sheet input','123'); pg.click('#sheet button >> text=Guardar'); print('corta ->',pg.inner_text('#sheet .err'))
    pg.fill('#sheet input','nuevaClave9'); pg.click('#sheet button >> text=Guardar'); pg.wait_for_timeout(200)
    print(pg.evaluate('window._calls.slice(-1)'), '| toast:', pg.inner_text('.toast'))
    pg.click('#btnSettings'); pg.wait_for_timeout(200); print('ajustes tiene botón:', 'Cambiar contraseña' in pg.inner_text('#sheet'))
    print('ERRORS',errs); b.close()
