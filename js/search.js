/* ---------- búsqueda ---------- */
const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
function openSearch() {
  const q = el('input',{type:'search',placeholder:tr('Buscar en todo…'),autocomplete:'off',maxlength:'60'});
  const out = el('div');
  const row = (icon, title, sub, go) => el('button',{class:'srow',onclick:()=>{ closeSheet(); go(); }},
    el('span',{class:'si',text:icon}), el('span',{class:'st'}, el('strong',{text:title}), sub ? el('span',{class:'small muted',text:sub}) : null));
  const run = () => {
    const t = norm(q.value.trim()); out.replaceChildren();
    if (t.length < 2) { out.append(el('div',{class:'empty',text:tr('Escribe al menos 2 letras.')})); return; }
    const has = (...f) => f.some(x => norm(x).includes(t));
    const groups = [];
    const add = (title, rows) => { if (rows.length) groups.push([title, rows.slice(0, 8)]); };
    add(tr('Compra'), state.items.filter(i => has(i.name)).map(i => row('🛒', i.name,
      PLACE_NAME[i.place] + (i.done ? tr(' · comprado') : ''), () => { state.place = i.place; savePlace(i.place); openTab('shop'); focusRow(i.id); })));
    add(tr('Tareas'), state.chores.filter(c => has(c.title)).map(c => row('✅', c.title,
      PLACE_NAME[c.place] + (c.done ? ' · ✓' : ''), () => { state.place = c.place; savePlace(c.place); state.choreFilter = 'all'; openTab('chores'); focusRow(c.id); })));
    const ups = upcomingEvents(400);
    add(tr('Eventos'), state.events.filter(e => has(e.title, e.location, e.notes)).map(e => {
      const nx = ups.find(x => (x._series || x).id === e.id), d = new Date((nx || e).starts_at);
      return row('📅', e.title, fmtDay(d), () => { state.calMode = 'month'; state.month = new Date(d.getFullYear(), d.getMonth(), 1); state.sel = d; openTab('cal'); });
    }));
    add(tr('Mensajes'), state.messages.filter(m => has(m.body)).slice().reverse().map(m => row('💬', m.body,
      who(m.user_id) + ' · ' + fmtShort(new Date(m.created_at)), () => { openTab('chat'); focusRow(m.id); })));
    add(tr('Menú'), state.menu.filter(m => has(...m.meals.map(x => x.text))).map(m => row('🍽️',
      m.meals.map(x => x.text).join(' · '), fmtDay(keyDate(m.day)), () => openTab('menu'))));
    if (!groups.length) out.append(el('div',{class:'empty',text:tr('Sin resultados.')}));
    groups.forEach(([title, rows]) => { out.append(el('div',{class:'sgroup',text:title})); rows.forEach(r => out.append(r)); });
    if (state.chatMore) out.append(el('button',{class:'ghost',style:'width:100%;margin-top:8px',text:tr('Buscar en mensajes anteriores'),onclick:e => searchOlder(e.currentTarget)}));
  };
  // mensajes más antiguos que los cargados en el chat: se buscan en el servidor
  const searchOlder = async btn => {
    const term = q.value.trim().replace(/[%_\\]/g, '\\$&'), oldest = state.messages[0];
    if (!oldest) return;
    btn.disabled = true;
    const { data, error } = await sb.from('messages').select('*').ilike('body', '%' + term + '%')
      .lt('created_at', oldest.created_at).order('created_at', { ascending:false }).limit(20);
    btn.remove();
    if (error) { out.append(el('div',{class:'empty',text:errMsg(error)})); return; }
    if (!data.length) { out.append(el('div',{class:'empty',text:tr('No hay mensajes anteriores con eso.')})); return; }
    out.append(el('div',{class:'sgroup',text:tr('Mensajes anteriores')}));
    data.forEach(m => out.append(row('💬', m.body, who(m.user_id) + ' · ' + fmtShort(new Date(m.created_at)), async () => {
      // se cargan todos los mensajes desde ese hasta los que ya había, para que el chat no tenga huecos
      const first = state.messages[0];
      const { data: gap, error: e2 } = await sb.from('messages').select('*').gte('created_at', m.created_at)
        .lt('created_at', first ? first.created_at : '9999').order('created_at');
      if (e2) { toast(errMsg(e2)); return; }
      const have = new Set(state.messages.map(x => x.id));
      state.messages = gap.filter(x => !have.has(x.id)).concat(state.messages);
      openTab('chat'); renderChat(); focusRow(m.id);
    })));
  };
  q.addEventListener('input', run); run();
  openSheet(q, out, el('button',{class:'ghost',style:'width:100%;margin-top:8px',text:tr('Cerrar'),onclick:closeSheet}));
  setTimeout(() => q.focus(), 60);
}
$('#btnSearch').onclick = openSearch;
