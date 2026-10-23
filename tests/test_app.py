import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
import json, sys, time
from playwright.sync_api import sync_playwright

BASE = os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')
MOCK = open(os.path.join(HERE, 'mock-supabase.js'), encoding='utf-8').read()
fails, oks = [], []

def check(name, cond, extra=''):
    (oks if cond else fails).append(name)
    print(('OK   ' if cond else 'FALLA'), name, extra if not cond else '')

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale='es-ES', timezone_id='Europe/Madrid')
    ctx.route('**/supabase-js*/**', lambda r: r.fulfill(status=200, content_type='application/javascript', body=MOCK))
    ctx.route('**/sw.js', lambda r: r.abort())
    page = ctx.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.goto(BASE)
    page.wait_for_selector('#app:not([hidden])', timeout=5000)
    page.wait_for_timeout(300)

    # ---- Inicio
    check('arranca en Inicio', page.inner_text('#title') == 'Inicio')
    home = page.inner_text('#homeBox')
    check('saludo con nombre', 'Hola, Ana' in home, home[:80])
    check('evento de hoy visible', 'Pediatra' in home)
    check('tarea atrasada visible en inicio', 'Bajar la basura' in home and 'Atrasada' in home, home)
    check('menu de hoy en inicio', 'Lentejas' in home)
    page.screenshot(path=OUT + 'home.png')

    # ---- Calendario: recurrencia semanal (Natación cada semana) y anual
    page.click('nav button[data-tab=cal]')
    n_has = page.eval_on_selector_all('#days .day.has', 'els=>els.length')
    check('calendario marca días con eventos (semanales)', n_has >= 5, str(n_has))
    ev_dates = page.evaluate("""()=>{const a=new Date();a.setHours(0,0,0,0);
      const e=state.events.find(x=>x.id==='e2'); const o=occurrences(e,a,new Date(a.getFullYear(),a.getMonth(),a.getDate()+30));
      return o.map(x=>new Date(x.starts_at).getDay())}""")
    check('natación semanal siempre el mismo día de semana', len(set(ev_dates)) == 1 and len(ev_dates) in (4, 5), str(ev_dates))
    h = page.evaluate("""()=>{const a=new Date();a.setHours(0,0,0,0);
      const e=state.events.find(x=>x.id==='e2'); return occurrences(e,a,new Date(a.getFullYear(),a.getMonth(),a.getDate()+30)).map(x=>new Date(x.starts_at).getHours())}""")
    check('hora estable (18h) en todas las repeticiones', set(h) == {18}, str(h))
    yr = page.evaluate("""()=>{const e=state.events.find(x=>x.id==='e3'); const a=new Date(2027,0,1), b=new Date(2028,0,1);
      return occurrences(e,a,b).length}""")
    check('evento anual aparece una vez al año', yr == 1, str(yr))
    check('edición de ocurrencia abre la serie', page.evaluate("""()=>{const e=state.events.find(x=>x.id==='e2'); const a=new Date();a.setHours(0,0,0,0);
      const o=occurrences(e,a,new Date(a.getFullYear(),a.getMonth(),a.getDate()+14))[0]; return o._series===e}"""))
    # fin de mes en mensual
    mm = page.evaluate("""()=>{const e={starts_at:new Date(2026,0,31,10,0).toISOString(),ends_at:null,recur:'monthly',recur_until:null};
      return occurrences(e,new Date(2026,1,1),new Date(2026,3,1)).map(x=>new Date(x.starts_at).getDate())}""")
    check('mensual día 31 se ajusta a fin de mes (28, 31)', mm == [28, 31], str(mm))
    until = page.evaluate("""()=>{const e={starts_at:new Date(2026,0,1,10,0).toISOString(),ends_at:null,recur:'daily',recur_until:'2026-01-05'};
      return occurrences(e,new Date(2026,0,1),new Date(2026,2,1)).length}""")
    check('«repetir hasta» corta la serie', until == 5, str(until))

    # modo lista
    page.click('#calSeg button[data-m=list]')
    lst = page.inner_text('#evList')
    check('próximos eventos lista repeticiones', 'Natación' in lst and 'Pediatra' in lst)
    page.screenshot(path=OUT + 'cal-list.png')

    # crear evento recurrente desde el formulario
    page.click('#addEv')
    page.fill('#sheet input[placeholder^="Título"]', 'Yoga')
    page.select_option('#sheet select', 'weekly')
    page.click('#sheet button:has-text("Crear evento")')
    page.wait_for_timeout(200)
    check('evento recurrente creado con recur=weekly', any(e['title'] == 'Yoga' and e['recur'] == 'weekly' for e in page.evaluate('window.__db.events')))

    # ---- Compra
    page.click('nav button[data-tab=shop]')
    check('categoría Despensa/Otros agrupa y muestra Leche', 'Leche' in page.inner_text('#shopList'))
    page.fill('#shopIn', 'Detergente ropa'); page.click('#shopForm button[type=submit]'); page.wait_for_timeout(150)
    page.fill('#shopIn', 'Pollo asado'); page.click('#shopForm button[type=submit]'); page.wait_for_timeout(150)
    page.fill('#shopIn', 'Manzanas'); page.click('#shopForm button[type=submit]'); page.wait_for_timeout(150)
    cats = {i['name']: i['category'] for i in page.evaluate('window.__db.shopping_items')}
    check('autocategoría limpieza', cats.get('Detergente ropa') == 'limpieza', str(cats))
    check('autocategoría carne', cats.get('Pollo asado') == 'carne', str(cats))
    check('autocategoría fruta', cats.get('Manzanas') == 'frutas', str(cats))
    guesses = page.evaluate("""()=>({leche:guessCat('Leche entera'),pan:guessCat('Pan de molde'),agua:guessCat('Agua'),aguacate:guessCat('Aguacates'),
       panal:guessCat('Pañales talla 4'),pasta:guessCat('Pasta de dientes'),pasta2:guessCat('Pasta macarrones')})""")
    check('leche→lácteos, pan→pan, agua→bebidas, aguacate→fruta', guesses['leche'] == 'lacteos' and guesses['pan'] == 'pan' and guesses['agua'] == 'bebidas' and guesses['aguacate'] == 'frutas', str(guesses))
    check('pañales→bebé, pasta de dientes→higiene, pasta→despensa', guesses['panal'] == 'bebe' and guesses['pasta'] == 'higiene' and guesses['pasta2'] == 'despensa', str(guesses))
    txt = page.inner_text('#shopList').lower()
    check('grupos con cabecera de categoría', 'fruta y verdura' in txt and 'carne y pescado' in txt and 'limpieza' in txt, txt)
    # habituales
    check('chip de habitual visible', 'Plátanos' in page.inner_text('#staples'))
    page.click('#staples .chip:has-text("Plátanos")'); page.wait_for_timeout(150)
    names = [i['name'] for i in page.evaluate('window.__db.shopping_items')]
    check('tocar habitual lo añade a la lista', 'Plátanos' in names)
    check('chip queda desactivado cuando ya está en la lista', page.is_disabled('#staples .chip:has-text("Plátanos")'))
    page.screenshot(path=OUT + 'shop.png')
    # editar producto → habitual
    page.click('#shopList .cn:has-text("Leche")'); page.wait_for_selector('#sheet')
    page.check('#sheet input[type=checkbox]'); page.select_option('#sheet select', 'lacteos'); page.click('#sheet button:has-text("Guardar")'); page.wait_for_timeout(200)
    check('marcar como habitual crea la plantilla', any(s['name'] == 'Leche' and s['category'] == 'lacteos' for s in page.evaluate('window.__db.shopping_staples')))

    # ---- Tareas
    page.click('nav button[data-tab=chores]')
    ct = page.inner_text('#choreList')
    check('tarea con responsable y repetición', 'Para Ana' in ct and 'Cada L J' in ct, ct)
    page.screenshot(path=OUT + 'chores.png')
    before = page.evaluate("window.__db.chores.find(c=>c.id==='c1').due")
    page.click('#choreList .item:has-text("Bajar la basura") .chk'); page.wait_for_timeout(200)
    c1 = page.evaluate("window.__db.chores.find(c=>c.id==='c1')")
    check('tarea recurrente no se cierra y avanza la fecha', c1['done'] is False and c1['due'] > before and c1['last_done_by'] == 'u1', str(c1))
    import datetime
    dow = datetime.date.fromisoformat(c1['due']).isoweekday()  # lunes=1, jueves=4
    check('próxima fecha cae en lunes o jueves', dow in (1, 4), c1['due'])
    # abrir formulario completo y crear tarea mensual asignada
    page.fill('#choreIn', 'Pagar comunidad'); page.click('#choreMore'); page.wait_for_selector('#sheet input[placeholder^="Tarea"]')
    check('«Más» precarga el título', page.input_value('#sheet input[placeholder^="Tarea"]') == 'Pagar comunidad')
    page.select_option('#sheet select >> nth=1', 'u2'); page.select_option('#sheet select >> nth=2', 'monthly')
    page.click('#sheet button:has-text("Añadir tarea")'); page.wait_for_timeout(200)
    c3 = page.evaluate("window.__db.chores.find(c=>c.title==='Pagar comunidad')")
    check('tarea mensual asignada a Marc con fecha', c3 and c3['assignee'] == 'u2' and c3['recur'] == 'monthly' and c3['due'], str(c3))
    # tarea normal: marcar y desmarcar
    page.click('#choreList .item:has-text("Llamar al fontanero") .chk'); page.wait_for_timeout(150)
    check('tarea normal se marca como hecha', page.evaluate("window.__db.chores.find(c=>c.id==='c2').done") is True)


    # ---- Viviendas (L'Estartit / Torelló)
    page.click('nav button[data-tab=shop]')
    seg = page.inner_text('#shopSeg')
    check('selector de vivienda en Compra con contadores', "L'Estartit" in seg and 'Torelló' in seg, seg)
    check('Estartit no muestra lo de Torelló', 'Tornillos' not in page.inner_text('#shopList'))
    page.click('#shopSeg button:has-text("Torelló")'); page.wait_for_timeout(100)
    check('Torelló muestra solo lo suyo', 'Tornillos' in page.inner_text('#shopList') and 'Leche' not in page.inner_text('#shopList'))
    check('habituales de Estartit no salen en Torelló', 'Plátanos' not in page.inner_text('#staples'))
    page.fill('#shopIn', 'Cinta aislante'); page.click('#shopForm button[type=submit]'); page.wait_for_timeout(150)
    it = {i['name']: i['place'] for i in page.evaluate('window.__db.shopping_items')}
    check('se añade a la vivienda activa (Torelló)', it.get('Cinta aislante') == 'torello', str(it))
    page.click('nav button[data-tab=chores]')
    check('la vivienda elegida se mantiene en Coses', page.eval_on_selector('#choreSeg button.on', 'e=>e.textContent').startswith('Torelló'))
    ch = page.inner_text('#choreList')
    check('Coses de Torelló solo muestra Cambiar bombilla', 'Cambiar bombilla' in ch and 'Bajar la basura' not in ch, ch)
    page.fill('#choreIn', 'Regar plantas'); page.click('#choreForm button[type=submit]'); page.wait_for_timeout(150)
    check('tarea nueva en Torelló', any(c['title'] == 'Regar plantas' and c['place'] == 'torello' for c in page.evaluate('window.__db.chores')))
    # mover un producto de vivienda
    page.click('nav button[data-tab=shop]')
    page.click('#shopList .cn:has-text("Tornillos")'); page.wait_for_selector('#sheet')
    page.select_option('#sheet select >> nth=1', 'estartit'); page.click('#sheet button:has-text("Guardar")'); page.wait_for_timeout(200)
    check('mover producto a otra vivienda', {i['name']: i['place'] for i in page.evaluate('window.__db.shopping_items')}['Tornillos'] == 'estartit')
    page.click('nav button[data-tab=home]')
    home2 = page.inner_text('#homeBox')
    check('Inicio resume por vivienda', "L'Estartit" in home2 and 'Torelló' in home2, home2[:200])
    page.screenshot(path=OUT + 'home-places.png')
    page.click('nav button[data-tab=chores]'); page.screenshot(path=OUT + 'chores-places.png')

    # ---- Menú
    page.click('nav button[data-tab=menu]')
    page.click('button:has-text("Pegar el menú de todo el mes")'); page.wait_for_selector('#sheet textarea')
    sample = "Lunes 19\nComida: crema de calabaza\nMerienda: fruta\n\nMartes 20 de octubre\n- Comida: macarrones\n- Merienda: yogur\n\n21/10: Comida: pescado con arroz; Merienda: pan con queso\n22/10/2026\nComida: lentejas\nMerienda: galletas\n\n23 - Menú: Festivo"
    page.fill('#sheet textarea', sample); page.dispatch_event('#sheet textarea', 'input')
    prev = page.inner_text('#sheet .preview')
    check('vista previa reconoce 5 días', page.inner_text('#sheet button:has-text("Guardar")') .startswith('Guardar 5'), prev)
    page.screenshot(path=OUT + 'menu-bulk.png')
    page.click('#sheet button:has-text("Guardar 5")'); page.wait_for_timeout(250)
    days = {m['day']: m['meals'] for m in page.evaluate('window.__db.menu_days')}
    check('menú en bloque guardado por día', all(k in days for k in ['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23']), str(list(days)))
    check('etiquetas «Comida»/«Merienda» bien separadas', days.get('2026-10-20') == [{'label': 'Comida', 'text': 'macarrones'}, {'label': 'Merienda', 'text': 'yogur'}], str(days.get('2026-10-20')))
    parsed = page.evaluate("parseMenuText('Lunes 19\\nLentejas\\nFruta\\n\\nviernes 23 de octubre: Comida: sopa', '2026-10')")
    check('línea sin etiqueta → «Menú» y continuación', parsed['days'][0]['meals'] == [{'label': 'Menú', 'text': 'Lentejas\nFruta'}], json.dumps(parsed, ensure_ascii=False))
    check('día con mes explícito', any(d['day'] == '2026-10-23' for d in parsed['days']))
    bad = page.evaluate("parseMenuText('31/02: Comida: x', '2026-10')")
    check('fecha imposible se avisa y no se guarda', bad['days'] == [] and len(bad['warnings']) == 1, json.dumps(bad, ensure_ascii=False))

    # ---- Chat
    page.click('nav button[data-tab=chat]')
    check('chat muestra nombre coloreado de Marc', page.eval_on_selector('#chatlog .who', 'e=>getComputedStyle(e).color') != '')

    # ---- Ajustes: tema, letra, copia
    page.click('nav button[data-tab=home]')
    page.click('#btnSettings'); page.wait_for_selector('#sheet .seg')
    page.click('#sheet .seg button:has-text("Oscuro")')
    check('tema oscuro aplicado', page.evaluate("document.documentElement.dataset.theme") == 'dark')
    page.click('#sheet .seg button:has-text("Muy grande")')
    check('letra muy grande aplicada', page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--fs').trim()") == '1.3')
    page.screenshot(path=OUT + 'settings-dark-xl.png')
    page.click('#sheet button:has-text("Automático")'); page.click('#sheet .seg >> nth=2 >> button:has-text("Normal")')
    check('volver a automático/normal', page.evaluate("document.documentElement.dataset.theme") is None)
    with page.expect_download(timeout=4000) as dl:
        page.click('#sheet button:has-text("Descargar copia")')
    path = dl.value.path()
    bk = json.load(open(path, encoding='utf-8'))
    check('copia de seguridad con todas las tablas', all(k in bk for k in ['eventos', 'mensajes', 'compra', 'habituales', 'tareas', 'menu']) and 'invite_code' not in json.dumps(bk), list(bk))
    page.click('#sheet button:has-text("Cerrar")') if page.is_visible('#sheet button:has-text("Cerrar")') else None

    # ---- navegación desde avisos antiguos
    page.evaluate("openTab('ev')")
    check("alias antiguo 'ev' abre Calendario→Próximos", page.inner_text('#title') == 'Calendario' and page.evaluate('state.calMode') == 'list')

    # capturas finales en claro/oscuro
    page.evaluate("document.documentElement.dataset.theme='light'; openTab('home')"); page.screenshot(path=OUT + 'home-final.png')
    page.evaluate("document.documentElement.dataset.theme='dark'"); page.screenshot(path=OUT + 'home-dark.png')
    page.evaluate("document.documentElement.dataset.theme='dark'; openTab('chores')"); page.screenshot(path=OUT + 'chores-dark.png')

    real_errors = [e for e in errors if 'favicon' not in e.lower()]
    check('sin errores de consola/JS', not real_errors, str(real_errors))
    b.close()

print(f'\n{len(oks)} correctas, {len(fails)} fallos')
sys.exit(1 if fails else 0)
