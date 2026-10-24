/* ---------- sin cobertura: cola de cambios + copia local de los datos ---------- */
// Los cambios (crear, editar, borrar) que fallan por falta de red se guardan en una cola y se envían al volver.
// También se guarda una copia de los datos para poder abrir la app sin conexión.
const OFFLINE_TABLES = new Set(['events', 'messages', 'shopping_items', 'shopping_staples', 'chores', 'chore_log', 'menu_days']);
const STATE_KEY = { events:'events', messages:'messages', shopping_items:'items', shopping_staples:'staples', chores:'chores', chore_log:'choreLog', menu_days:'menu' };
const QUEUE_KEY = 'hogar-queue', CACHE_KEY = 'hogar-cache';
const netFail = r => !!(r && r.error && (r.status === 0 || isNetErr(r.error)));
const isNetErr = e => !!e && ( /failed to fetch|load failed|networkerror|network request failed|fetch failed|internet connection/i.test(String(e.message || '') + ' ' + String(e.details || '').slice(0, 200)));
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));

let OPS = (() => { try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; } catch (_) { return []; } })();
const saveQueue = () => { try { OPS.length ? localStorage.setItem(QUEUE_KEY, JSON.stringify(OPS)) : localStorage.removeItem(QUEUE_KEY); } catch (_) {} };

const realFrom = sb.from.bind(sb);
function realCall(b) {
  let q = realFrom(b.table);
  q = b.op === 'insert' ? q.insert(b.payload) : b.op === 'update' ? q.update(b.payload)
    : b.op === 'upsert' ? q.upsert(b.payload, b.opts) : q.delete();
  for (const [m, c, v] of b.filters) q = q[m](c, v);
  if (b.wantSel) q = q.select();
  if (b.single) q = q.single();
  return q;
}

// fila «provisional» que se enseña mientras no hay red (el servidor pondrá los mismos valores al recibirla)
function localRow(table, row) {
  const uid = state.user && state.user.id, now = new Date().toISOString();
  const base = {
    shopping_items:   { done:false, added_by:uid, category:'otros', place:'estartit' },
    chores:           { done:false, done_by:null, done_at:null, added_by:uid, assignee:null, recur:null, recur_days:null, due:null, last_done_at:null, last_done_by:null, place:'estartit' },
    messages:         { user_id:uid, reply_to:null },
    events:           { created_by:uid, all_day:false, ends_at:null, notes:null, location:null, recur:null, recur_until:null, remind_min:null },
    shopping_staples: { category:'otros', place:'estartit' },
    chore_log:        { user_id:uid, done_at:now },
    menu_days:        { meals:[], updated_at:now },
  }[table] || {};
  return { created_at: now, ...base, ...row };
}

function enqueue(b) {
  let local = null;
  const rows = b.op === 'insert' || b.op === 'upsert' ? [].concat(b.payload) : [];
  if (b.op === 'insert') {
    b.payload = rows.map(r => ({ id: newId(), ...(b.table === 'chore_log' || b.table === 'menu_days' ? {} : { created_at: new Date().toISOString() }), ...r }));
    local = b.payload.map(r => localRow(b.table, r));
  } else if (b.op === 'upsert') {      // solo menu_days: se conserva el id del día si ya existía
    const list = state.menu || [];
    b.payload = rows.map(r => ({ id: (list.find(x => x.day === r.day) || {}).id || newId(), ...r }));
    local = b.payload.map(r => localRow(b.table, r));
  } else if (b.op === 'update') {
    const list = state[STATE_KEY[b.table]] || [], f = b.filters.find(x => x[0] === 'eq' && x[1] === 'id');
    const cur = f && list.find(x => x.id === f[2]);
    local = cur ? [{ ...cur, ...b.payload }] : [];
  }
  OPS.push({ table: b.table, op: b.op, payload: b.payload, opts: b.opts, filters: b.filters, wantSel: false, single: false });
  saveQueue(); updateNetBar();
  const data = b.wantSel ? (b.single ? (local && local[0]) || null : local) : null;
  return { data, error: null, status: 201, statusText: 'queued', count: null, queued: true };
}

async function runMutation(b) {
  if (!OFFLINE_TABLES.has(b.table)) return realCall(b);
  if (navigator.onLine === false || OPS.length) { const r = enqueue(b); flushQueueSoon(); return r; }
  const res = await realCall(b);
  return netFail(res) ? enqueue(b) : res;
}
function mutBuilder(table, op, payload, opts) {
  const b = { table, op, payload, opts, filters: [], wantSel: false, single: false };
  const api = {
    eq(c, v) { b.filters.push(['eq', c, v]); return api; },
    in(c, v) { b.filters.push(['in', c, v]); return api; },
    select() { b.wantSel = true; return api; },
    single() { b.single = true; return api; },
    then(ok, bad) { return runMutation(b).then(ok, bad); },
  };
  return api;
}
sb.from = table => {
  const q = realFrom(table);
  if (!OFFLINE_TABLES.has(table)) return q;
  return {
    select: (...a) => q.select(...a),
    insert: p => mutBuilder(table, 'insert', p),
    update: p => mutBuilder(table, 'update', p),
    upsert: (p, o) => mutBuilder(table, 'upsert', p, o),
    delete: () => mutBuilder(table, 'delete'),
  };
};

/* ---------- envío de la cola al volver la conexión ---------- */
let flushing = false, flushTimer = null;
function flushQueueSoon(ms = 1500) { clearTimeout(flushTimer); flushTimer = setTimeout(flushQueue, ms); }
async function flushQueue() {
  if (flushing || !OPS.length || navigator.onLine === false || !state.user || state.offlineMode) return;
  flushing = true; let sent = 0, failed = 0;
  try {
    while (OPS.length) {
      const res = await realCall(OPS[0]);
      if (netFail(res)) break;                               // seguimos sin conexión: se reintenta más tarde
      if (res.error && !(OPS[0].op === 'insert' && res.error.code === '23505')) failed++;   // 23505 = ya se había enviado
      OPS.shift(); saveQueue(); sent++;
    }
  } catch (_) {}
  flushing = false; updateNetBar();
  if (failed) toast(tr('Algún cambio no se pudo guardar'));
  if (!OPS.length && sent) { if (!failed) toast(tr('Cambios sincronizados')); await loadAll(); render(); }
  else if (OPS.length && navigator.onLine !== false) flushQueueSoon(15000);
}

/* ---------- aviso de estado ---------- */
function updateNetBar() {
  const bar = document.getElementById('netbar'); if (!bar) return;
  const off = navigator.onLine === false || state.offlineMode;
  const n = OPS.length;
  bar.hidden = !(off || n);
  bar.textContent = off ? tr('Sin conexión') + (n ? ' · ' + n + ' ' + tr('cambios pendientes') : '') : tr('Sincronizando…');
}

/* ---------- copia local de los datos ---------- */
let snapTimer = null;
function saveSnapshotSoon() {
  if (!state.household || !state.user) return;
  clearTimeout(snapTimer);
  snapTimer = setTimeout(() => {
    try {
      const { user, member, household, members, events, messages, items, chores, menu, staples, stations, choreLog } = state;
      localStorage.setItem(CACHE_KEY, JSON.stringify({ user: { id: user.id, email: user.email }, member, household, members, events, messages: messages.slice(-200), items, chores, menu, staples, stations, choreLog, savedAt: Date.now() }));
    } catch (_) {}
  }, 600);
}
function loadSnapshot() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (_) { return null; } }
function clearLocalData() { clearTimeout(snapTimer); OPS = []; try { localStorage.removeItem(CACHE_KEY); localStorage.removeItem(QUEUE_KEY); } catch (_) {} }

// Abre la app con los últimos datos guardados (sin red o sin poder renovar la sesión)
function bootOffline() {
  const c = loadSnapshot(); if (!c || !c.user || !c.household) return false;
  Object.assign(state, { user: c.user, member: c.member, household: c.household, members: c.members || {}, events: c.events || [], messages: c.messages || [],
    items: c.items || [], chores: c.chores || [], menu: c.menu || [], staples: c.staples || [], stations: c.stations || [], choreLog: c.choreLog || [], offlineMode: true });
  showOnly('app'); render(); updateNetBar();
  return true;
}
// al recuperar la red: renovar la sesión (si hace falta), enviar la cola y refrescar
async function backOnline() {
  updateNetBar();
  if (state.offlineMode) {
    const { data } = await sb.auth.getSession().catch(() => ({ data: {} }));
    if (!(data && data.session)) return;           // todavía sin sesión válida: se reintenta más tarde
    state.offlineMode = false; state.user = data.session.user;
    await flushQueue();                            // primero se envían los cambios guardados…
    await boot();                                  // …y luego se carga todo de nuevo
    return;
  }
  flushQueueSoon(300);
  if (!OPS.length && state.household) { await loadAll(); render(); }   // por si se perdió algún cambio en directo
}
addEventListener('online', backOnline);
addEventListener('offline', updateNetBar);
setInterval(() => { if (state.offlineMode && navigator.onLine !== false) backOnline(); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && (OPS.length || state.offlineMode)) backOnline(); });
