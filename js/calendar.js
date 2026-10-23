/* ---------- calendario ---------- */
['L','M','X','J','V','S',LANG==='ca'?'G':'D'].forEach(d => $('#dows').append(el('div',{class:'dow',text:d})));
$('#prevM').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth()-1, 1); render(); };
$('#nextM').onclick = () => { state.month = new Date(state.month.getFullYear(), state.month.getMonth()+1, 1); render(); };

/* repeticiones: se calculan al vuelo a partir del evento «serie» */
const REC_LABEL = { daily:tr('Cada día'), weekly:tr('Cada semana'), monthly:tr('Cada mes'), yearly:tr('Cada año') };
function nthStart(e, n) {
  const s = new Date(e.starts_at), H = s.getHours(), M = s.getMinutes();
  if (e.recur === 'daily')  return new Date(s.getFullYear(), s.getMonth(), s.getDate() + n, H, M);
  if (e.recur === 'weekly') return new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7*n, H, M);
  if (e.recur === 'monthly' || e.recur === 'yearly') {
    const first = new Date(s.getFullYear(), s.getMonth() + (e.recur === 'yearly' ? 12*n : n), 1, H, M);
    const last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    first.setDate(Math.min(s.getDate(), last)); return first;
  }
  return s;
}
function occurrences(e, from, to) {          // apariciones con inicio en [from, to)
  const s = new Date(e.starts_at);
  if (!e.recur) return (s >= from && s < to) ? [e] : [];
  const dur = e.ends_at ? new Date(e.ends_at) - s : 0;
  const until = e.recur_until ? new Date(e.recur_until + 'T23:59:59') : null;
  const per = { daily:864e5, weekly:6048e5 }[e.recur];
  let n = per ? Math.floor((from - s) / per) - 1
              : Math.floor(((from.getFullYear()-s.getFullYear())*12 + from.getMonth()-s.getMonth()) / (e.recur === 'yearly' ? 12 : 1)) - 1;
  n = Math.max(0, n);
  const out = [];
  for (let i = 0; i < 800; i++, n++) {
    const st = nthStart(e, n);
    if (st >= to || (until && st > until)) break;
    if (st >= from) out.push({ ...e, starts_at: st.toISOString(), ends_at: e.ends_at ? new Date(st.getTime() + dur).toISOString() : null, _series: e });
  }
  return out;
}
function eventsOn(d) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()), b = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return state.events.flatMap(e => occurrences(e, a, b)).sort((x, y) => x.starts_at.localeCompare(y.starts_at));
}
function upcomingEvents(days) {              // desde hoy; los que no se repiten, todos los futuros
  const a = new Date(); a.setHours(0,0,0,0);
  const horizon = new Date(a.getFullYear(), a.getMonth(), a.getDate() + days);
  return state.events.flatMap(e => e.recur ? occurrences(e, a, horizon) : (new Date(e.starts_at) >= a ? [e] : []))
    .sort((x, y) => x.starts_at.localeCompare(y.starts_at));
}

function renderCal() {
  document.querySelectorAll('#calSeg button').forEach(b => b.classList.toggle('on', b.dataset.m === state.calMode));
  $('#calMonth').hidden = state.calMode !== 'month'; $('#calList').hidden = state.calMode !== 'list';
  const m = state.month, y = m.getFullYear(), mo = m.getMonth();
  $('#monthTitle').textContent = m.toLocaleDateString(LOCALE,{month:'long',year:'numeric'});
  const first = new Date(y, mo, 1);
  const start = new Date(y, mo, 1 - ((first.getDay()+6)%7));
  const days = $('#days'); days.replaceChildren();
  const today = new Date();
  for (let i=0;i<42;i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate()+i);
    const b = el('button',{class:'day'+(d.getMonth()!==mo?' out':'')+(sameDay(d,today)?' today':'')+(sameDay(d,state.sel)?' sel':'')+(eventsOn(d).length?' has':'')},
      el('span',{text:d.getDate()}), el('span',{class:'dot'}));
    b.onclick = () => { state.sel = d; if (d.getMonth()!==mo) state.month = new Date(d.getFullYear(), d.getMonth(), 1); render(); };
    days.append(b);
  }
  $('#dayTitle').textContent = fmtDay(state.sel);
  const list = $('#dayList'); list.replaceChildren();
  const evs = eventsOn(state.sel);
  if (!evs.length) list.append(el('div',{class:'empty',text:tr('Nada planeado este día.')}));
  evs.forEach(e => list.append(evRow(e, false)));
}
$('#addEvDay').onclick = () => eventForm(state.sel);
$('#calSeg').onclick = e => { const b = e.target.closest('button[data-m]'); if (!b) return; state.calMode = b.dataset.m; render(); };

function evRow(e, showDate) {
  const s = new Date(e.starts_at);
  const when = e.all_day ? tr('Todo el día') : fmtTime(s) + (e.ends_at ? '–'+fmtTime(new Date(e.ends_at)) : '');
  return el('div',{class:'ev'},
    el('div',{class:'time', text: showDate ? s.toLocaleDateString(LOCALE,{day:'numeric',month:'short'}) : (e.all_day?tr('Día'):fmtTime(s))}),
    el('div',{class:'body'},
      el('div',{class:'t',text:e.title}),
      el('div',{class:'small muted',text: [showDate?when:(e.all_day?tr('Todo el día'):when), e.location, e.recur ? '🔁 ' + REC_LABEL[e.recur] : null].filter(Boolean).join(' · ')}),
      e.notes ? el('div',{class:'small',text:e.notes}) : null,
      byLine(tr('Añadido por '), e.created_by)),
    el('button',{class:'ghost del','aria-label':tr('Editar'),text:'✎',onclick:()=>eventForm(null, e._series || e)}));
}

/* ---------- eventos (próximos) ---------- */
function renderEvents() {
  const box = $('#evList'); box.replaceChildren();
  const up = upcomingEvents(120);
  if (!up.length) { box.append(emptyState('📅', tr('No hay eventos próximos. ¡Crea el primero!'))); return; }
  const groups = {};
  up.forEach(e => { const k = ymd(new Date(e.starts_at)); (groups[k] ||= []).push(e); });
  Object.keys(groups).sort().forEach(k => {
    box.append(el('div',{class:'group-title',text:fmtDay(keyDate(k))}));
    const c = el('div',{class:'card'}); groups[k].forEach(e => c.append(evRow(e,false))); box.append(c);
  });
}
$('#addEv').onclick = () => eventForm(new Date());

function openSheet(...kids) { const s=$('#sheet'); s.replaceChildren(...kids); $('#modal').hidden=false; }
function closeSheet() { $('#modal').hidden = true; }
$('#modal').addEventListener('click', e => { if (e.target.id==='modal') closeSheet(); });

function eventForm(day, ev=null) {
  const base = ev ? new Date(ev.starts_at) : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 20, 0);
  const end = ev?.ends_at ? new Date(ev.ends_at) : null;
  const local = d => `${ymd(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const title = el('input',{placeholder:tr('Título (p. ej. Cena con los suegros)'),maxlength:'120',value:ev?.title||''});
  const allDay = el('input',{type:'checkbox',style:'width:auto'}); allDay.checked = !!ev?.all_day;
  const start = el('input',{type:'datetime-local',value:local(base)});
  const endI = el('input',{type:'datetime-local',value:end?local(end):''});
  const place = el('input',{placeholder:tr('Lugar (opcional)'),maxlength:'120',value:ev?.location||''});
  const notes = el('textarea',{placeholder:tr('Notas (opcional)'),rows:'2',maxlength:'500'}); notes.value = ev?.notes||'';
  const recur = el('select',{}, el('option',{value:'',text:tr('No se repite')}),
    ...Object.entries(REC_LABEL).map(([k,v]) => el('option',{value:k,text:v})));
  recur.value = ev?.recur || '';
  const until = el('input',{type:'date',value:ev?.recur_until||''});
  const untilWrap = el('div',{}, el('label',{class:'f',text:tr('Repetir hasta (opcional)')}), until);
  const syncRecur = () => { untilWrap.hidden = !recur.value; };
  recur.onchange = syncRecur;
  const err = el('div',{class:'err'});
  const syncType = () => { const t = allDay.checked?'date':'datetime-local'; start.type=t; endI.type=t;
    start.value = allDay.checked ? ymd(base) : local(base); endI.value=''; endI.parentElement.hidden = allDay.checked; };
  const endWrap = el('div',{},el('label',{class:'f',text:tr('Fin (opcional)')}),endI);
  allDay.onchange = syncType;
  const save = el('button',{text:ev?tr('Guardar'):tr('Crear evento'),style:'flex:1'});
  save.onclick = async () => {
    if (!title.value.trim()) { err.textContent=tr('Pon un título.'); return; }
    if (!start.value) { err.textContent=tr('Pon la fecha.'); return; }
    const s = allDay.checked ? new Date(start.value+'T00:00:00') : new Date(start.value);
    const e2 = (!allDay.checked && endI.value) ? new Date(endI.value) : null;
    if (e2 && e2 < s) { err.textContent=tr('El fin es anterior al inicio.'); return; }
    if (recur.value && until.value && until.value < ymd(s)) { err.textContent=tr('«Repetir hasta» es anterior al inicio.'); return; }
    const row = { title:title.value.trim(), location:place.value.trim()||null, notes:notes.value.trim()||null,
      starts_at:s.toISOString(), ends_at:e2?e2.toISOString():null, all_day:allDay.checked,
      recur: recur.value || null, recur_until: recur.value && until.value ? until.value : null };
    save.disabled = true;
    const q = ev ? sb.from('events').update(row).eq('id',ev.id).select().single()
                 : sb.from('events').insert({ ...row, household_id: state.household.id }).select().single();
    const { data, error } = await q;
    if (error) { err.textContent = errMsg(error); save.disabled=false; return; }
    upsert(state.events, data); state.events.sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
    state.sel = s; state.month = new Date(s.getFullYear(), s.getMonth(), 1);
    closeSheet(); render();
  };
  const kids = [el('h3',{text:ev?tr('Editar evento'):tr('Nuevo evento')}), title,
    el('label',{class:'f row'},allDay,tr(' Todo el día')),
    el('label',{class:'f',text:tr('Inicio')}), start, endWrap,
    el('label',{class:'f',text:tr('Repetición')}), recur, untilWrap,
    el('label',{class:'f',text:tr('Lugar')}), place, el('label',{class:'f',text:tr('Notas')}), notes, err,
    el('div',{class:'row',style:'margin-top:12px'},
      el('button',{class:'ghost',text:'Cancelar',onclick:closeSheet}), save)];
  if (ev) kids.push(el('button',{class:'danger',style:'width:100%;margin-top:6px',text:ev.recur?tr('Eliminar toda la serie'):tr('Eliminar evento'),onclick:()=>{ closeSheet();
    deferDelete(tr('Evento eliminado'), 'events', [ev.id],
      () => { state.events = state.events.filter(x=>x.id!==ev.id); render(); },
      () => { state.events.push(ev); state.events.sort((a,b)=>a.starts_at.localeCompare(b.starts_at)); render(); }); }}));
  openSheet(...kids);
  syncType(); if (!allDay.checked) { start.value = local(base); }
  syncRecur();
}
