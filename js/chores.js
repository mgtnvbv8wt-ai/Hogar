/* ---------- coses de casa ---------- */
const CHORE_REC = { daily:tr('Cada día'), weekly:tr('Cada semana'), monthly:tr('Cada mes') };
const DOW_ORDER = [[1,'L'],[2,'M'],[3,'X'],[4,'J'],[5,'V'],[6,'S'],[0,LANG==='ca'?'G':'D']];   // getDay(): 0 = domingo
function nextDue(c) {
  const today = ymd(new Date());
  const base = (c.due && c.due > today) ? c.due : today;
  if (c.recur === 'daily') return addDaysYmd(base, 1);
  if (c.recur === 'weekly') {
    const days = (c.recur_days && c.recur_days.length) ? c.recur_days : [keyDate(c.due || today).getDay()];
    for (let n = 1; n <= 7; n++) { const k = addDaysYmd(base, n); if (days.includes(keyDate(k).getDay())) return k; }
  }
  if (c.recur === 'monthly') {
    const d = keyDate(base), t = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const last = new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate();
    t.setDate(Math.min(keyDate(c.due || base).getDate(), last)); return ymd(t);
  }
  return null;
}
function dueLabel(k) {
  const today = ymd(new Date());
  if (k < today) return tr('Atrasada · ') + fmtShort(keyDate(k));
  if (k === today) return tr('Hoy');
  if (k === addDaysYmd(today, 1)) return tr('Mañana');
  return fmtShort(keyDate(k));
}
function recurLabel(c) {
  if (!c.recur) return null;
  if (c.recur === 'weekly' && c.recur_days && c.recur_days.length) {
    return tr('Cada ') + DOW_ORDER.filter(([n]) => c.recur_days.includes(n)).map(([,l]) => l).join(' ');
  }
  return CHORE_REC[c.recur];
}
function choreRow(c, showPlace) {
  const today = ymd(new Date());
  const meta = [];
  if (showPlace) meta.push('🏠 ' + PLACE_NAME[c.place]);
  if (c.assignee) meta.push(tr('Para ') + who(c.assignee));
  const rl = recurLabel(c); if (rl) meta.push('🔁 ' + rl);
  if (c.done) meta.push(tr('Hecho por ') + who(c.done_by) + (c.done_at ? ' · ' + fmtShort(new Date(c.done_at)) : ''));
  else if (c.last_done_at) meta.push(tr('Última vez: ') + who(c.last_done_by) + ' · ' + fmtShort(new Date(c.last_done_at)));
  return el('div',{class:'item'+(c.done?' done':''),'data-id':c.id},
    el('button',{class:'chk','aria-label':c.done?tr('Marcar como pendiente'):tr('Marcar como hecha'),text:c.done?'✓':'',onclick:()=>toggleChore(c)}),
    el('div',{class:'cn',style:'cursor:pointer',onclick:()=>choreForm(c)},
      el('div',{class:'ct',text:c.title}),
      !c.done && c.due ? el('span',{class:'badge'+(c.due < today ? ' late' : ''),text:dueLabel(c.due)}) : null,
      meta.length ? el('div',{class:'small muted',text:meta.join(' · ')}) : null,
      c.done || c.last_done_at || c.assignee ? null : byLine(tr('Añadido por '), c.added_by)),
    el('button',{class:'ghost del','aria-label':tr('Borrar'),text:'×',style:'font-size:22px',onclick:()=>delChore(c)}));
}
function renderChoreMeta() {
  $('#choreFilter').replaceChildren(...[['all', tr('Todas')], ['mine', tr('Mías')]].map(([k, l]) =>
    el('button',{type:'button',class:state.choreFilter === k ? 'on' : '',text:l,onclick:()=>{ state.choreFilter = k; renderChores(); }})));
  const counts = {}; state.choreLog.forEach(x => { counts[x.user_id] = (counts[x.user_id] || 0) + 1; });
  const parts = Object.keys(state.members).map(u => who(u) + ' ' + (counts[u] || 0));
  const st = $('#choreStats'); st.hidden = !state.choreLog.length;
  st.textContent = tr('Hechas este mes: ') + parts.join(' · ');
}
function renderChores() {
  const box = $('#choreList'); box.replaceChildren();
  const mineOnly = state.choreFilter === 'mine';
  const here = state.chores.filter(c => c.place === state.place && (!mineOnly || c.assignee === state.user.id));
  const pending = here.filter(c=>!c.done)
    .sort((a,b) => (a.due||'9999').localeCompare(b.due||'9999') || a.created_at.localeCompare(b.created_at));
  const done = here.filter(c=>c.done).sort((a,b)=>(b.done_at||'').localeCompare(a.done_at||''));
  renderChoreMeta();
  if (!here.length) box.append(emptyState('✅', tr('No hay tareas en ') + PLACE_NAME[state.place] + tr('. Añade la primera.')));
  [...pending, ...done].forEach(c => box.append(choreRow(c)));
  $('#clearChores').hidden = !done.length; renderPlaceSeg();
}
async function toggleChore(c) {
  const old = { done:c.done, done_by:c.done_by, done_at:c.done_at, due:c.due, last_done_at:c.last_done_at, last_done_by:c.last_done_by };
  const now = new Date().toISOString();
  let patch;
  if (c.recur && !c.done) {            // las tareas que se repiten no se «cierran»: pasan a su próxima fecha
    patch = { due: nextDue(c), last_done_at: now, last_done_by: state.user.id };
    toast(tr('Hecho ✓ · próxima: ') + dueLabel(patch.due));
  } else {
    const done = !c.done;
    patch = { done, done_by: done ? state.user.id : null, done_at: done ? now : null };
  }
  Object.assign(c, patch); render();
  const { error } = await sb.from('chores').update(patch).eq('id', c.id);
  if (error) { Object.assign(c, old); render(); toast(errMsg(error)); return; }
  // registro para el contador de «hechas este mes»
  try {
    if (patch.done === false) {
      const mine = state.choreLog.filter(x => x.chore_id === c.id && x.user_id === state.user.id).sort((a, b) => b.done_at.localeCompare(a.done_at))[0];
      if (mine) { state.choreLog = state.choreLog.filter(x => x.id !== mine.id); renderChoreMeta(); await sb.from('chore_log').delete().eq('id', mine.id); }
    } else {
      const { data } = await sb.from('chore_log').insert({ household_id: state.household.id, chore_id: c.id, user_id: state.user.id, place: c.place }).select().single();
      if (data) { upsert(state.choreLog, data); renderChoreMeta(); }
    }
  } catch (_) {}
}
function delChore(c) {
  deferDelete(tr('Tarea eliminada'), 'chores', [c.id],
    () => { state.chores = state.chores.filter(x=>x.id!==c.id); render(); },
    () => { state.chores.push(c); state.chores.sort(byCreated); render(); });
}
$('#choreForm').onsubmit = async e => {
  e.preventDefault();
  const title = $('#choreIn').value.trim(); if (!title) return;
  $('#choreIn').value = '';
  const { data, error } = await sb.from('chores').insert({ household_id: state.household.id, title, place: state.place }).select().single();
  if (error) { toast(errMsg(error)); $('#choreIn').value = title; return; }
  upsert(state.chores, data); state.chores.sort((a,b)=>a.created_at.localeCompare(b.created_at)); render();
};
$('#choreMore').onclick = () => { const t = $('#choreIn').value.trim(); $('#choreIn').value = ''; choreForm(null, t); };
$('#clearChores').onclick = async () => {
  const gone = state.chores.filter(c=>c.done && c.place === state.place); if (!gone.length) return;
  const ids = gone.map(c=>c.id);
  deferDelete(tr('Tareas eliminadas'), 'chores', ids,
    () => { state.chores = state.chores.filter(c=>!ids.includes(c.id)); render(); },
    () => { state.chores.push(...gone); state.chores.sort(byCreated); render(); });
};
function choreForm(c, presetTitle = '') {
  const title = el('input',{placeholder:tr('Tarea (p. ej. Bajar la basura)'),maxlength:'200',value:c?.title || presetTitle});
  const assignee = el('select',{}, el('option',{value:'',text:tr('Cualquiera')}),
    ...Object.entries(state.members).map(([id,n]) => el('option',{value:id,text:n})));
  assignee.value = c?.assignee || '';
  const recur = el('select',{}, el('option',{value:'',text:tr('No se repite')}),
    ...Object.entries(CHORE_REC).map(([k,v]) => el('option',{value:k,text:v})));
  recur.value = c?.recur || '';
  const plc = placeSelect(c?.place || state.place);
  const days = new Set(c?.recur_days || []);
  const dayBtns = el('div',{class:'sel-row'}, ...DOW_ORDER.map(([n,l]) => {
    const b = el('button',{type:'button',class:'chip'+(days.has(n)?' sel':''),text:l,style:'min-width:40px'});
    b.onclick = () => { days.has(n) ? days.delete(n) : days.add(n); b.classList.toggle('sel', days.has(n)); };
    return b; }));
  const daysWrap = el('div',{}, el('label',{class:'f',text:tr('Días de la semana (si no eliges, se repite el mismo día)')}), dayBtns);
  const due = el('input',{type:'date',value:c?.due || ''});
  const dueLbl = el('label',{class:'f',text:tr('Fecha')});
  const sync = () => { daysWrap.hidden = recur.value !== 'weekly'; dueLbl.textContent = recur.value ? tr('Próxima vez') : tr('Fecha límite (opcional)'); };
  recur.onchange = sync;
  const err = el('div',{class:'err'});
  const save = el('button',{text:c?tr('Guardar'):tr('Añadir tarea'),style:'flex:1'});
  save.onclick = async () => {
    const t = title.value.trim(); if (!t) { err.textContent = tr('Escribe la tarea.'); return; }
    const row = { title:t, place:plc.value, assignee:assignee.value || null, recur:recur.value || null,
      recur_days: recur.value === 'weekly' && days.size ? [...days].sort() : null, due: due.value || null };
    if (row.recur && !row.due) row.due = ymd(new Date());
    save.disabled = true;
    const q = c ? sb.from('chores').update(row).eq('id', c.id).select().single()
                : sb.from('chores').insert({ ...row, household_id: state.household.id }).select().single();
    const { data, error } = await q;
    if (error) { err.textContent = errMsg(error); save.disabled = false; return; }
    upsert(state.chores, data); state.chores.sort((a,b)=>a.created_at.localeCompare(b.created_at));
    closeSheet(); render();
  };
  const kids = [el('h3',{text:c?tr('Editar tarea'):tr('Nueva tarea')}), title,
    el('label',{class:'f',text:tr('Vivienda')}), plc,
    el('label',{class:'f',text:tr('¿A quién le toca?')}), assignee,
    el('label',{class:'f',text:tr('Repetición')}), recur, daysWrap, dueLbl, due, err,
    el('div',{class:'row',style:'margin-top:12px'}, el('button',{class:'ghost',text:'Cancelar',onclick:closeSheet}), save)];
  if (c) kids.push(el('button',{class:'danger',style:'width:100%;margin-top:6px',text:tr('Eliminar tarea'),onclick:()=>{ closeSheet(); delChore(c); }}));
  openSheet(...kids); sync();
}
