/* ---------- inicio ---------- */
function renderHome() {
  const box = $('#homeBox'); box.replaceChildren();
  const today = new Date(), tk = ymd(today);
  box.append(el('div',{style:'margin:2px 2px 14px'},
    el('h2',{style:'margin:0;font-size:calc(24px * var(--fs));letter-spacing:-.3px',text:tr('Hola, ') + (state.members[state.user.id] || '')}),
    el('div',{class:'muted',text:fmtDay(today)})));
  const split = list => PLACES.map(([k, l]) => l + ' ' + list.filter(x => !x.done && x.place === k).length).join(' · ');
  const tile = (list, label, tab) => el('button',{class:'tile',onclick:()=>openTab(tab)},
    el('span',{class:'n',text:list.filter(x=>!x.done).length}), label, el('div',{class:'small muted',style:'margin-top:2px',text:split(list)}));
  box.append(el('div',{class:'tiles'}, tile(state.items, tr('por comprar'), 'shop'), tile(state.chores, tr('tareas pendientes'), 'chores')));
  renderWeather(box);

  box.append(el('div',{class:'group-title',text:tr('Hoy')}));
  const evs = eventsOn(today), c = el('div',{class:'card'});
  if (evs.length) evs.forEach(e => c.append(evRow(e,false))); else c.append(el('div',{class:'empty',style:'padding:10px',text:tr('Sin eventos hoy.')}));
  box.append(c);

  const mine = state.chores.filter(x => !x.done && (x.assignee === state.user.id || (x.due && x.due <= tk)))
    .sort((a,b) => (a.due||'9999').localeCompare(b.due||'9999')).slice(0, 6);
  if (mine.length) {
    box.append(el('div',{class:'group-title',text:tr('Tareas para hoy')}));
    const cc = el('div',{class:'card'}); mine.forEach(x => cc.append(choreRow(x, true))); box.append(cc);
  }

  const t = menuOf(tk);
  if (t && t.meals.length) {
    box.append(el('div',{class:'group-title',text:tr('Menú de la guardería')}));
    box.append(el('div',{class:'card'}, mealsEl(t)));
  } else if (![0,6].includes(today.getDay())) {
    box.append(el('div',{class:'group-title',text:tr('Menú de la guardería')}));
    box.append(el('div',{class:'card'}, el('div',{class:'empty',style:'padding:10px',text:tr('No hay menú cargado para hoy.')}),
      el('button',{class:'soft',style:'width:100%',text:tr('Cargar el menú'),onclick:()=>openTab('menu')})));
  }

  const next = upcomingEvents(30).filter(e => ymd(new Date(e.starts_at)) > tk).slice(0, 4);
  if (next.length) {
    box.append(el('div',{class:'group-title',text:tr('Próximos eventos')}));
    const cn = el('div',{class:'card'}); next.forEach(e => cn.append(evRow(e,true)));
    cn.append(el('button',{class:'ghost',style:'width:100%;margin-top:6px',text:tr('Ver todos'),onclick:()=>{ state.calMode = 'list'; openTab('cal'); }}));
    box.append(cn);
  }
}
