import os
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out') + os.sep
os.makedirs(OUT, exist_ok=True)
from playwright.sync_api import sync_playwright
MOCK=open(os.path.join(HERE, 'mock-supabase.js'),encoding='utf-8').read()
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2)
    ctx.route('**/supabase-js*/**',lambda r:r.fulfill(status=200,content_type='application/javascript',body=MOCK)); ctx.route('**/sw.js',lambda r:r.abort())
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto(os.environ.get('HOGAR_URL', 'http://localhost:8765/index.html')); pg.wait_for_selector('#app:not([hidden])'); pg.wait_for_timeout(300)
    pg.evaluate("window._del=[]; const o=sb.from.bind(sb); sb.from=(t)=>{const q=o(t); const d=q.delete.bind(q); q.delete=()=>{const r=d(); const i=r.in?r.in.bind(r):null; const e=r.eq?r.eq.bind(r):null; if(i) r.in=(c,v)=>{window._del.push([t,v]); return i(c,v)}; if(e) r.eq=(c,v)=>{window._del.push([t,[v]]); return e(c,v)}; return r}; return q}; 0")
    pg.click('nav button[data-tab=shop]'); pg.wait_for_timeout(200)
    n0=pg.evaluate('state.items.filter(i=>i.place===state.place).length'); print('productos antes:',n0)
    pg.evaluate("delItem(state.items.find(i=>i.place===state.place))"); pg.wait_for_timeout(150)
    print('tras borrar:',pg.evaluate('state.items.filter(i=>i.place===state.place).length'),'| toast:',pg.inner_text('.toast')); pg.screenshot(path=OUT+'undo-toast.png')
    pg.click('.toast button'); pg.wait_for_timeout(200)
    print('tras deshacer:',pg.evaluate('state.items.filter(i=>i.place===state.place).length'),'| llamadas delete:',pg.evaluate('window._del'))
    pg.evaluate("delItem(state.items.find(i=>i.place===state.place))"); pg.wait_for_timeout(5600)
    print('tras 5 s:',pg.evaluate('state.items.filter(i=>i.place===state.place).length'),'| delete:',pg.evaluate('window._del'),'| toasts:',pg.evaluate("document.querySelectorAll('.toast').length"))
    # tarea y flush al ocultar
    pg.click('nav button[data-tab=chores]'); pg.wait_for_timeout(200)
    pg.evaluate("delChore(state.chores.find(c=>c.place===state.place))"); pg.wait_for_timeout(100)
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true}); document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(200)
    print('flush al ocultar:',pg.evaluate('window._del.length'),'| toasts:',pg.evaluate("document.querySelectorAll('.toast').length"))
    print('ERRORS',errs); b.close()
