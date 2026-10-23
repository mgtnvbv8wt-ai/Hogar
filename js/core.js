/* ---------- preferencias (tema y tamaño de letra) ---------- */
const PLACES = [['estartit', "L'Estartit"], ['torello', 'Torelló']];
const PLACE_NAME = Object.fromEntries(PLACES);
const WX_PLACES = PLACES.filter(([k]) => k === 'torello');   // viviendas con estación meteorológica (L'Estartit no tiene)
function loadPlace() { try { const v = localStorage.getItem('hogar-place'); return PLACE_NAME[v] ? v : 'estartit'; } catch (_) { return 'estartit'; } }
function savePlace(v) { try { localStorage.setItem('hogar-place', v); } catch (_) {} }

const state = { user:null, member:null, household:null, members:{}, events:[], messages:[], items:[], chores:[], menu:[], staples:[],
  tab:'home', place:loadPlace(), choreFilter:'all', choreLog:[], replyTo:null, stations:[], weather:null, weatherAt:0, weatherBusy:false, calMode:'month', stapleEdit:false, month:new Date(), sel:new Date(), channel:null, signup:false };

const PREFS_KEY = 'hogar-prefs';
function loadPrefs() { try { return JSON.parse(localStorage.getItem(PREFS_KEY)) || {}; } catch (_) { return {}; } }
function savePrefs(p) { try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (_) {} }
function applyPrefs() {
  const p = loadPrefs(), r = document.documentElement;
  if (p.theme === 'light' || p.theme === 'dark') r.dataset.theme = p.theme; else delete r.dataset.theme;
  r.style.setProperty('--fs', { normal:1, large:1.15, xl:1.3 }[p.size] || 1);
  const dark = p.theme === 'dark' || (p.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = dark ? '#17120f' : '#e05d3f';
}
applyPrefs();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyPrefs);

/* ---------- utilidades ---------- */
const pad = n => String(n).padStart(2,'0');
const ymd = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const sameDay = (a,b) => ymd(a)===ymd(b);
const fmtTime = d => d.toLocaleTimeString(LOCALE,{hour:'2-digit',minute:'2-digit'});
const fmtDay = d => d.toLocaleDateString(LOCALE,{weekday:'long',day:'numeric',month:'long'});
const el = (tag, props={}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k,v] of Object.entries(props)) {
    if (k==='class') e.className=v; else if (k.startsWith('on')) e.addEventListener(k.slice(2),v);
    else if (k==='text') e.textContent=v; else e.setAttribute(k,v);
  }
  kids.flat().forEach(c => c!=null && e.append(c.nodeType?c:document.createTextNode(c)));
  return e;
};
const keyDate = k => new Date(k + 'T00:00:00');
const addDaysYmd = (k, n) => { const d = keyDate(k); d.setDate(d.getDate() + n); return ymd(d); };
const fmtShort = d => d.toLocaleDateString(LOCALE,{day:'numeric',month:'short'});
const MEMBER_COLORS = ['#e05d3f','#3c7dd9','#8a5cc2','#2e9c8a'];
const memberColor = uid => { const ids = Object.keys(state.members).sort(); const i = ids.indexOf(uid); return MEMBER_COLORS[(i < 0 ? 0 : i) % MEMBER_COLORS.length]; };
const who = uid => state.members[uid] || '—';
const byLine = (prefix, uid) => el('div',{class:'small muted'}, el('span',{class:'dotm',style:'background:'+memberColor(uid)}), prefix + who(uid));
const byCreated = (a, b) => (a.created_at || '').localeCompare(b.created_at || '');
const pendingDeletes = new Set();
function flushDeletes() { [...pendingDeletes].forEach(p => p.commit()); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushDeletes(); });
addEventListener('pagehide', flushDeletes);
// Borrado con "Deshacer": se oculta al instante y se borra de verdad a los 5 s
function deferDelete(msg, table, ids, apply, restore) {
  flushDeletes();
  apply();
  const p = { done: false };
  const clear = () => { p.done = true; clearTimeout(p.timer); pendingDeletes.delete(p); t.remove(); };
  p.commit = async () => {
    if (p.done) return; clear();
    const { error } = await sb.from(table).delete().in('id', ids);
    if (error) { toast(errMsg(error)); await loadAll(); render(); }
  };
  const t = el('div',{class:'toast undo'}, el('span',{text:msg}),
    el('button',{type:'button',text:tr('Deshacer'),onclick:()=>{ if (p.done) return; clear(); restore(); }}));
  document.body.append(t);
  p.timer = setTimeout(p.commit, 5000); pendingDeletes.add(p);
}
const emptyState = (icon, text) => el('div',{class:'empty'}, el('div',{class:'ei',text:icon}), el('div',{text}));
function toast(msg){ const t=el('div',{class:'toast',text:msg}); document.body.append(t); setTimeout(()=>t.remove(),2500); }
const errMsg = e => {
  const m = (e && e.message) || String(e);
  if (/Invalid login/i.test(m)) return tr('Email o contraseña incorrectos.');
  if (/already registered/i.test(m)) return tr('Ese email ya tiene cuenta. Prueba a entrar.');
  if (/Email not confirmed/i.test(m)) return tr('Confirma tu email (mira tu correo) y vuelve a entrar.');
  if (/invalid invite code/i.test(m)) return tr('Código de invitación no válido.');
  if (/rate limit/i.test(m)) return tr('Demasiados intentos. Espera unos minutos.');
  if (/household full/i.test(m)) return tr('Este hogar ya está completo.');
  return m;
};
