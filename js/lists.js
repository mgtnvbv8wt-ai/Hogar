/* ---------- listas reutilizables (maleta, guardería…) ---------- */
// Una lista es una plantilla de elementos que se marcan al preparar algo. Al marcar el último, 12 horas
// después se desmarca sola, lista para la próxima vez. «Reiniciar» la desmarca a mano.
const LIST_RESET_MS = 12 * 3600e3;
const listCount = l => { const it = l.items || []; return [it.filter(x => x.done).length, it.length]; };
const resetting = new Set();

function resetStaleLists() {
  state.lists.forEach(l => {
    if (!l.completed_at || Date.now() - new Date(l.completed_at).getTime() < LIST_RESET_MS || resetting.has(l.id)) return;
    resetting.add(l.id);
    saveList(l, { items: l.items.map(x => ({ ...x, done: false })), completed_at: null }, true).finally(() => resetting.delete(l.id));
  });
}
async function saveList(l, patch, silent) {
  Object.assign(l, patch);
  const { error } = await sb.from('checklists').update(patch).eq('id', l.id);
  if (error) { toast(errMsg(error)); await loadAll(); }
  if (!silent) render();
}

function renderLists(box) {
  resetStaleLists();
  box.append(el('div',{class:'group-title',text:tr('Listas')}));
  const c = el('div',{class:'card'});
  state.lists.forEach(l => {
    const [d, n] = listCount(l);
    c.append(el('button',{class:'srow',onclick:()=>openList(l.id)},
      el('span',{class:'si',text:n && d === n ? '✅' : '📋'}),
      el('span',{class:'st'}, el('strong',{text:l.title}), el('span',{class:'small muted',text:n ? d + '/' + n : tr('Vacía')}))));
  });
  if (!state.lists.length) c.append(el('div',{class:'empty',style:'padding:10px',text:tr('Crea listas para lo que repetís: la maleta, la mochila de la guardería…')}));
  c.append(el('button',{class:'ghost',style:'width:100%;margin-top:6px',text:tr('Nueva lista'),onclick:()=>listForm(null)}));
  box.append(c);
}

function openList(id) {
  const body = el('div');
  const paint = () => {
    const l = state.lists.find(x => x.id === id);
    if (!l) { closeSheet(); return; }
    const [d, n] = listCount(l);
    body.replaceChildren(
      el('h3',{text:l.title}),
      el('div',{class:'small muted',style:'margin:-4px 0 8px',text:n ? (d === n ? tr('¡Todo listo! 🎉') : d + ' / ' + n) : tr('Vacía')}),
      ...l.items.map((x, i) => el('div',{class:'item'+(x.done?' done':'')},
        el('button',{class:'chk','aria-label':tr('Marcar'),text:x.done?'✓':'',onclick:async()=>{
          const items = l.items.map((y, j) => j === i ? { ...y, done: !y.done } : y);
          const all = items.length > 0 && items.every(y => y.done);
          const p = saveList(l, { items, completed_at: all ? new Date().toISOString() : null }, true);
          paint(); await p;
        }}),
        el('div',{class:'cn'}, el('div',{class:'ct',text:x.text})))),
      el('div',{class:'row',style:'margin-top:12px'},
        el('button',{class:'ghost',text:tr('Reiniciar'),onclick:async()=>{
          const p = saveList(l, { items: l.items.map(x => ({ ...x, done: false })), completed_at: null }, true); paint(); await p; }}),
        el('button',{class:'ghost',text:tr('Editar'),onclick:()=>listForm(l)}),
        el('button',{text:tr('Cerrar'),onclick:()=>{ closeSheet(); render(); }})));
  };
  paint(); openSheet(body);
}

function listForm(l) {
  const title = el('input',{maxlength:'80',placeholder:tr('Nombre de la lista'),value:l ? l.title : ''});
  const area = el('textarea',{rows:'8',placeholder:tr('Un elemento por línea'),maxlength:'3000'}); area.value = l ? l.items.map(x => x.text).join('\n') : '';
  const err = el('div',{class:'err'});
  const save = el('button',{text:tr('Guardar'),style:'flex:1'});
  save.onclick = async () => {
    const t = title.value.trim(); if (!t) { err.textContent = tr('Escribe el nombre.'); return; }
    const texts = area.value.split('\n').map(s => s.trim().slice(0, 80)).filter(Boolean);
    if (texts.length > 60) { err.textContent = tr('Máximo 60 elementos.'); return; }
    const old = new Map((l ? l.items : []).map(x => [x.text, x.done]));
    const items = texts.map(text => ({ text, done: !!old.get(text) }));
    const completed_at = items.length && items.every(x => x.done) ? (l && l.completed_at) || new Date().toISOString() : null;
    save.disabled = true;
    if (l) { await saveList(l, { title: t, items, completed_at }, true); closeSheet(); render(); openList(l.id); return; }
    const { data, error } = await sb.from('checklists').insert({ household_id: state.household.id, title: t, items }).select().single();
    if (error) { err.textContent = errMsg(error); save.disabled = false; return; }
    upsert(state.lists, data); closeSheet(); render(); openList(data.id);
  };
  const del = l ? el('button',{class:'ghost danger',text:tr('Borrar'),onclick:()=>{
    closeSheet();
    deferDelete(tr('Lista borrada'), 'checklists', [l.id], () => { state.lists = state.lists.filter(x => x.id !== l.id); render(); },
      () => { state.lists.push(l); state.lists.sort(byCreated); render(); });
  }}) : null;
  openSheet(el('h3',{text:l ? tr('Editar lista') : tr('Nueva lista')}), title, el('label',{class:'f',text:tr('Elementos')}), area, err,
    el('div',{class:'row',style:'margin-top:12px'}, del, el('button',{class:'ghost',text:tr('Cancelar'),onclick:()=>{ closeSheet(); if (l) openList(l.id); }}), save));
}
