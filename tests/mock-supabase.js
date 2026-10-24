// Supabase simulado en memoria para probar la interfaz sin credenciales reales.
(function () {
  const uid = () => 'id-' + Math.random().toString(36).slice(2, 10);
  const nowIso = () => new Date().toISOString();
  const ME = 'u1', OTHER = 'u2', HID = 'h1';
  const day = (off) => { const d = new Date(); d.setDate(d.getDate() + off); return d; };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const at = (off, h, m) => { const d = day(off); d.setHours(h, m, 0, 0); return d.toISOString(); };

  const db = {
    households: [{ id: HID, name: 'Casa Prueba', invite_code: 'abc12345', created_at: nowIso() }],
    members: [{ user_id: ME, household_id: HID, display_name: 'Ana' }, { user_id: OTHER, household_id: HID, display_name: 'Marc' }],
    events: [
      { id: 'e1', household_id: HID, title: 'Pediatra', starts_at: at(0, 17, 30), ends_at: null, all_day: false, created_by: OTHER, created_at: nowIso(), recur: null, recur_until: null },
      { id: 'e2', household_id: HID, title: 'Natación', starts_at: at(-20, 18, 0), ends_at: at(-20, 19, 0), all_day: false, created_by: ME, created_at: nowIso(), recur: 'weekly', recur_until: null },
      { id: 'e3', household_id: HID, title: 'Cumple abuela', starts_at: at(-400, 0, 0), ends_at: null, all_day: true, created_by: ME, created_at: nowIso(), recur: 'yearly', recur_until: null },
    ],
    messages: [{ id: 'm1', household_id: HID, user_id: OTHER, body: 'Hola', created_at: nowIso() }],
    shopping_items: [
      { id: 's1', household_id: HID, name: 'Leche', done: false, added_by: OTHER, created_at: nowIso(), category: 'otros', place: 'estartit' },
      { id: 's2', household_id: HID, name: 'Tornillos', done: false, added_by: ME, created_at: nowIso(), category: 'otros', place: 'torello' },
    ],
    place_notes: [{ id: 'n1', household_id: HID, place: 'estartit', title: 'Wifi', body: 'Red: CasaMar\nClave: 12345678', position: 0, created_by: ME, created_at: nowIso(), updated_at: nowIso() }],
    chore_log: [{ id: 'l1', household_id: HID, chore_id: 'c1', user_id: ME, place: 'estartit', done_at: nowIso() }, { id: 'l2', household_id: HID, chore_id: 'c2', user_id: OTHER, place: 'estartit', done_at: nowIso() }, { id: 'l3', household_id: HID, chore_id: 'c4', user_id: OTHER, place: 'torello', done_at: nowIso() }],
    shopping_staples: [{ id: 'st1', household_id: HID, name: 'Plátanos', category: 'frutas', place: 'estartit', created_at: nowIso() }],
    chores: [
      { id: 'c1', household_id: HID, title: 'Bajar la basura', done: false, done_by: null, done_at: null, added_by: OTHER, created_at: nowIso(),
        place: 'estartit', assignee: ME, recur: 'weekly', recur_days: [1, 4], due: ymd(day(-1)), last_done_at: null, last_done_by: null },
      { id: 'c2', household_id: HID, title: 'Llamar al fontanero', done: false, done_by: null, done_at: null, added_by: ME, created_at: nowIso(),
        place: 'estartit', assignee: null, recur: null, recur_days: null, due: null, last_done_at: null, last_done_by: null },
      { id: 'c4', household_id: HID, title: 'Cambiar bombilla', done: false, done_by: null, done_at: null, added_by: ME, created_at: nowIso(),
        place: 'torello', assignee: null, recur: null, recur_days: null, due: null, last_done_at: null, last_done_by: null },
    ],
    menu_days: [
      { id: 'md1', household_id: HID, day: ymd(day(0)), meals: [{ label: 'Comida', text: 'Lentejas' }, { label: 'Merienda', text: 'Fruta' }], updated_at: nowIso() },
    ],
    weather_stations: [{ id: 'w1', household_id: HID, place: 'torello', mac: 'AA:BB:CC:DD:EE:FF' }],
    weather_readings: [8, 6, 4, 2, 1].map((h, i) => ({ id: i + 1, household_id: HID, place: 'torello', taken_at: new Date(Date.now() - h * 3600e3).toISOString(), temp_c: 15 + i * 1.5 })),
    push_subscriptions: [],
  };
  window.__weather = { configured: true, stations: [{ place: 'torello', stale: false, reading: {
    place: 'torello', taken_at: new Date(Date.now() - 4 * 60e3).toISOString(), fetched_at: new Date().toISOString(),
    temp_c: 21.4, feels_c: 21.0, humidity: 63, pressure_hpa: 1015.2, wind_kmh: 12.6, gust_kmh: 21, wind_dir: 225,
    rain_rate_mm: 0, rain_today_mm: 3.4, uv: 3.2, solar_wm2: 412, indoor_temp_c: 23.1, indoor_humidity: 50 } }] };
  window.__weatherCalls = 0;
  window.__db = db;

  class Q {
    constructor(t) { this.t = t; this.op = 'select'; this.f = []; this.payload = null; this.one = false; this.maybe = false; this.sel = false; this.lim = null; this.ord = null; this.conflict = null; }
    select() { this.sel = true; return this; }
    insert(p) { this.op = 'insert'; this.payload = p; return this; }
    update(p) { this.op = 'update'; this.payload = p; return this; }
    upsert(p, o) { this.op = 'upsert'; this.payload = p; this.conflict = (o && o.onConflict) || null; return this; }
    delete() { this.op = 'delete'; return this; }
    eq(k, v) { this.f.push(r => r[k] === v); return this; }
    in(k, vs) { this.f.push(r => vs.includes(r[k])); return this; }
    neq(k, v) { this.f.push(r => r[k] !== v); return this; }
    gte(k, v) { this.f.push(r => r[k] >= v); return this; }
    or() { return this; }            // el filtro .or() no se simula: devuelve todo
    order(k, o) { this.ord = [k, !(o && o.ascending === false)]; return this; }
    limit(n) { this.lim = n; return this; }
    single() { this.one = true; return this; }
    maybeSingle() { this.maybe = true; return this; }
    async run() {
      if (window.__offline) return { data: null, error: { message: 'TypeError: Failed to fetch', details: '', hint: '', code: '' }, status: 0 };
      const rows = db[this.t]; if (!rows) return { data: null, error: { message: 'tabla desconocida ' + this.t } };
      const match = r => this.f.every(fn => fn(r));
      const stamp = r => ({ id: uid(), created_at: nowIso(), ...r });
      const defaults = {
        shopping_items: { done: false, added_by: ME, category: 'otros', place: 'estartit' },
        chores: { place: 'estartit', done: false, done_by: null, done_at: null, added_by: ME, assignee: null, recur: null, recur_days: null, due: null, last_done_at: null, last_done_by: null },
        events: { created_by: ME, recur: null, recur_until: null },
        messages: { user_id: ME },
      };
      let out;
      if (this.op === 'select') out = rows.filter(match);
      else if (this.op === 'insert') {
        const list = (Array.isArray(this.payload) ? this.payload : [this.payload]).map(p => stamp({ ...(defaults[this.t] || {}), ...p }));
        rows.push(...list); out = list;
      } else if (this.op === 'upsert') {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload]; out = [];
        for (const p of list) {
          const keys = (this.conflict || 'id').split(',');
          const ex = rows.find(r => keys.every(k => r[k] === p[k]));
          if (ex) { Object.assign(ex, p); out.push(ex); } else { const n = stamp(p); rows.push(n); out.push(n); }
        }
      } else if (this.op === 'update') {
        out = rows.filter(match); out.forEach(r => Object.assign(r, this.payload));
      } else if (this.op === 'delete') {
        out = rows.filter(match); db[this.t] = rows.filter(r => !match(r)); rows.length = 0; rows.push(...db[this.t]); db[this.t] = rows;
      }
      if (this.ord) { const [k, asc] = this.ord; out = [...out].sort((a, b) => (String(a[k]).localeCompare(String(b[k]))) * (asc ? 1 : -1)); }
      if (this.lim) out = out.slice(0, this.lim);
      if (this.one) return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: 'single: ' + out.length } };
      if (this.maybe) return { data: out[0] || null, error: null };
      return { data: this.op === 'delete' || (this.op !== 'select' && !this.sel) ? null : out, error: null };
    }
    then(res, rej) { return this.run().then(res, rej); }
  }

  const session = { user: { id: ME, email: 'ana@test.es' } };
  window.supabase = {
    createClient() {
      return {
        auth: {
          getSession: async () => ({ data: { session: window.__noSession ? null : session } }),
          onAuthStateChange: cb => { setTimeout(() => cb('INITIAL_SESSION', window.__noSession ? null : session), 10); return { data: { subscription: {} } }; },
          signOut: async () => {}, signInWithPassword: async () => ({}), signUp: async () => ({}),
        },
        from: t => new Q(t),
        rpc: async () => ({ data: null, error: null }),
        functions: { invoke: async () => { window.__weatherCalls++; if (window.__weatherFail) return { data: null, error: { message: 'boom' } }; return { data: window.__weather, error: null }; } },
        channel: () => ({ on() { return this; }, subscribe() { return this; } }),
        removeChannel: () => {},
      };
    },
  };
})();
