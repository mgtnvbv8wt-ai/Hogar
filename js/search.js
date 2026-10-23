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
    add(tr('Eventos'), state.events.filter(e => has(e.title, e.place, e.notes)).map(e => {
      const nx = ups.find(x => (x._series || x).id === e.id), d = new Date((nx || e).starts_at);
      return row('📅', e.title, fmtDay(d), () => { state.calMode = 'month'; state.month = new Date(d.getFullYear(), d.getMonth(), 1); state.sel = d; openTab('cal'); });
    }));
    add(tr('Mensajes'), state.messages.filter(m => has(m.body)).slice().reverse().map(m => row('💬', m.body,
      who(m.user_id) + ' · ' + fmtShort(new Date(m.created_at)), () => { openTab('chat'); focusRow(m.id); })));
    add(tr('Menú'), state.menu.filter(m => has(...m.meals.map(x => x.text))).map(m => row('🍽️',
      m.meals.map(x => x.text).join(' · '), fmtDay(keyDate(m.day)), () => openTab('menu'))));
    if (!groups.length) { out.append(el('div',{class:'empty',text:tr('Sin resultados.')})); return; }
    groups.forEach(([title, rows]) => { out.append(el('div',{class:'sgroup',text:title})); rows.forEach(r => out.append(r)); });
  };
  q.addEventListener('input', run); run();
  openSheet(q, out, el('button',{class:'ghost',style:'width:100%;margin-top:8px',text:tr('Cerrar'),onclick:closeSheet}));
  setTimeout(() => q.focus(), 60);
}
$('#btnSearch').onclick = openSearch;
