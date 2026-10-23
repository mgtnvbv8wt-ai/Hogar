/* ---------- arranque ---------- */
async function boot() {
  const { data: me, error } = await sb.from('members').select('*').eq('user_id', state.user.id).maybeSingle();
  if (error) { toast(errMsg(error)); return; }
  if (!me) { showOnly('onboard'); return; }
  state.member = me;
  const [{ data: h }, { data: ms }] = await Promise.all([
    sb.from('households').select('*').eq('id', me.household_id).single(),
    sb.from('members').select('user_id,display_name'),
  ]);
  state.household = h;
  state.members = Object.fromEntries((ms||[]).map(m => [m.user_id, m.display_name]));
  showOnly('app');
  const wanted = new URLSearchParams(location.search).get('tab');
  if (wanted) openTab(wanted);
  await loadAll();
  subscribe();
  render();
  refreshPush();
  loadWeather(true);
}
async function loadAll() {
  const since = new Date(Date.now() - 60*86400e3).toISOString();
  const [ev, ms, it, ch, mn, st, wst, lg] = await Promise.all([
    sb.from('events').select('*').or('starts_at.gte.' + since + ',recur.not.is.null').order('starts_at'),
    sb.from('messages').select('*').order('created_at', { ascending:false }).limit(200),
    sb.from('shopping_items').select('*').order('created_at'),
    sb.from('chores').select('*').order('created_at'),
    sb.from('menu_days').select('*').gte('day', ymd(new Date(Date.now() - 45*86400e3))).order('day'),
    sb.from('shopping_staples').select('*').order('name'),
    sb.from('weather_stations').select('*'),
    sb.from('chore_log').select('*').gte('done_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
  ]);
  state.events = ev.data || [];
  state.messages = (ms.data || []).reverse();
  state.items = it.data || [];
  state.chores = ch.data || [];
  state.menu = mn.data || [];
  state.staples = st.data || [];
  state.stations = wst.data || [];
  state.choreLog = lg.data || [];
}
function teardown() {
  if (state.channel) { sb.removeChannel(state.channel); state.channel = null; }
  Object.assign(state, { member:null, household:null, events:[], messages:[], items:[], chores:[], menu:[], staples:[], stations:[], choreLog:[], replyTo:null, weather:null, weatherAt:0 });
}

/* ---------- tiempo real ---------- */
function upsert(list, row) { const i = list.findIndex(x => x.id===row.id); if (i>=0) list[i]=row; else list.push(row); }
function subscribe() {
  if (state.channel) sb.removeChannel(state.channel);
  const hid = state.household.id;
  const f = `household_id=eq.${hid}`;
  const ch = sb.channel('hogar-'+hid);
  for (const [table, key, sort] of [['events','events',(a,b)=>a.starts_at.localeCompare(b.starts_at)],
                                    ['messages','messages',(a,b)=>a.created_at.localeCompare(b.created_at)],
                                    ['shopping_items','items',(a,b)=>a.created_at.localeCompare(b.created_at)],
                                    ['chores','chores',(a,b)=>a.created_at.localeCompare(b.created_at)],
                                    ['menu_days','menu',(a,b)=>a.day.localeCompare(b.day)],
                                    ['shopping_staples','staples',(a,b)=>a.name.localeCompare(b.name)],
                                    ['chore_log','choreLog',(a,b)=>a.done_at.localeCompare(b.done_at)]]) {
    ch.on('postgres_changes', { event:'*', schema:'public', table, filter:f }, p => {
      if (p.eventType==='DELETE') state[key] = state[key].filter(x => x.id !== p.old.id);
      else { upsert(state[key], p.new); state[key].sort(sort); }
      render();
    });
  }
  ch.subscribe();
  state.channel = ch;
  // al volver a la app, refrescar por si el socket se durmió
  if (!state.visHooked) {
    state.visHooked = true;
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState==='visible' && state.household) { await loadAll(); render(); loadWeather(); }
    });
    setInterval(() => { if (state.tab === 'home' && document.visibilityState === 'visible') loadWeather(); }, 5 * 60 * 1000);
  }
}
