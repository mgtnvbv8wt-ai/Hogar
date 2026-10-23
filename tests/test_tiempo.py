import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
import sys
from playwright.sync_api import sync_playwright
BASE=os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')
MOCK=open(os.path.join(HERE, 'mock-supabase.js'),encoding='utf-8').read()
fails=[];oks=[]
def check(n,c,x=''):
    (oks if c else fails).append(n); print(('OK   ' if c else 'FALLA'),n,'' if c else x)

def new_page(b, init=''):
    ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,locale='es-ES',timezone_id='Europe/Madrid')
    ctx.route('**/supabase-js*/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK+'\n'+init))
    ctx.route('**/sw.js',lambda r:r.abort())
    pg=ctx.new_page(); errs=[]
    pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('console',lambda m:errs.append(m.text) if m.type=='error' else None)
    pg.goto(BASE); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(400)
    return pg,errs

with sync_playwright() as p:
    b=p.chromium.launch()
    # 1) estación configurada con datos
    pg,errs=new_page(b)
    home=pg.inner_text('#homeBox')
    check('tarjeta «El tiempo» en Inicio', 'el tiempo' in home.lower() and "torelló" in home.lower(), home[:300])
    check('temperatura con coma decimal', '21,4°' in home, home[:300])
    check('humedad, viento con dirección y lluvia', '63 %' in home and '13 km/h SO' in home and '3,4 mm hoy' in home, home[:300])
    check("L'Estartit (sin estación) no aparece en el tiempo", "estartit" not in pg.inner_text('.wx').lower() if pg.query_selector('.wx') else False)
    check('se llamó a la función una vez al arrancar', pg.evaluate('window.__weatherCalls')==1, str(pg.evaluate('window.__weatherCalls')))
    pg.screenshot(path=OUT+'wx-home.png')
    pg.click('.wx'); pg.wait_for_selector('#sheet .kv'); pg.wait_for_timeout(300)
    det=pg.inner_text('#sheet')
    check('detalle con presión, racha y UV', '1.015,2 hPa' in det.replace(' ','').replace('\xa0','') or '1015,2 hPa' in det, det[:400])
    check('detalle con historial de 24 h', pg.query_selector('#sheet svg.spark') is not None and 'Mín' in det, det)
    pg.screenshot(path=OUT+'wx-detail.png')
    pg.click('#sheet button:has-text("Cerrar")')
    # ajustes: guardar MAC de Torelló
    pg.click('#btnSettings'); pg.wait_for_selector('#sheet input[placeholder^="Torelló"]')
    pg.fill('#sheet input[placeholder^="Torelló"]','aa-bb-cc-dd-ee-00')
    pg.click('#sheet .row:has(input[placeholder^="Torelló"]) button'); pg.wait_for_timeout(300)
    st={s['place']:s['mac'] for s in pg.evaluate('window.__db.weather_stations')}
    check('MAC normalizada y guardada para Torelló', st.get('torello')=='AA:BB:CC:DD:EE:00', str(st))
    pg.fill('#sheet input[placeholder^="Torelló"]','12345')
    pg.click('#sheet .row:has(input[placeholder^="Torelló"]) button'); pg.wait_for_timeout(200)
    check('MAC inválida se rechaza', 'MAC no válida' in pg.inner_text('body') and pg.evaluate("window.__db.weather_stations.find(s=>s.place==='torello').mac")=='AA:BB:CC:DD:EE:00')
    pg.fill('#sheet input[placeholder^="Torelló"]','')
    pg.click('#sheet .row:has(input[placeholder^="Torelló"]) button'); pg.wait_for_timeout(200)
    check('vaciar la MAC elimina la estación', not any(s['place']=='torello' for s in pg.evaluate('window.__db.weather_stations')))
    check('sin errores de consola', not [e for e in errs if 'favicon' not in e.lower()], str(errs))
    pg.context.close()

    # 2) faltan claves en el servidor
    pg,errs=new_page(b,"window.__weather={configured:false,reason:'keys',stations:[]};")
    check('aviso cuando faltan las claves', 'Faltan las claves de Ecowitt' in pg.inner_text('#homeBox'), pg.inner_text('#homeBox')[:300])
    pg.context.close()

    # 3) sin estaciones
    pg,errs=new_page(b,"window.__db.weather_stations.length=0;")
    h=pg.inner_text('#homeBox')
    check('sin estaciones: invita a configurar y no llama a la función', 'Configurar estación' in h and pg.evaluate('window.__weatherCalls')==0, h[:300])
    pg.click('#homeBox button:has-text("Configurar estación")'); pg.wait_for_selector('#sheet input[placeholder^="Torelló"]')
    check('el botón abre Ajustes con los campos', True)
    pg.context.close()

    # 4) fallo de la función
    pg,errs=new_page(b,"window.__weatherFail=true;")
    check('fallo de red: mensaje amable, sin romper Inicio', 'No se pudo cargar el tiempo' in pg.inner_text('#homeBox') and 'Hola, Ana' in pg.inner_text('#homeBox'), pg.inner_text('#homeBox')[:300])
    check('fallo: sin errores no controlados', not [e for e in errs if 'favicon' not in e.lower() and 'boom' not in e.lower() and 'Failed' not in e], str(errs))
    pg.context.close()

    # 5) dato antiguo y sin lectura
    pg,errs=new_page(b,"window.__weather.stations[0].reading.taken_at=new Date(Date.now()-5*3600e3).toISOString(); window.__weather.stations[0].stale=true;")
    check('dato de hace horas se marca como no reciente', 'Sin datos recientes' in pg.inner_text('.wx'), pg.inner_text('.wx'))
    pg.context.close()
    pg,errs=new_page(b,"window.__weather.stations[0].reading=null; window.__weather.stations[0].error='Ecowitt: invalid mac';")
    check('error de Ecowitt visible en la tarjeta', 'invalid mac' in pg.inner_text('.wx'), pg.inner_text('.wx'))
    pg.context.close()

    # 6) modo oscuro y letra grande
    pg,errs=new_page(b,"")
    pg.evaluate("document.documentElement.dataset.theme='dark'; document.documentElement.style.setProperty('--fs','1.3')")
    pg.screenshot(path=OUT+'wx-home-dark-xl.png')
    pg.context.close()
    b.close()
print(f'\n{len(oks)} correctas, {len(fails)} fallos'); sys.exit(1 if fails else 0)
