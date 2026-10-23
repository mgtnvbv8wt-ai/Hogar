/* ---------- menu de la guarderia ---------- */
const menuOf = k => state.menu.find(m => m.day === k);
const mealsEl = m => el('div',{}, ...m.meals.map(x => el('div',{class:'meal'},
  el('div',{class:'ml',text:tr(x.label || 'Menú')}), el('div',{class:'mt',text:x.text}))));
function dayCard(m, label) {
  return el('div',{class:'card'}, el('div',{class:'menu-day'},
    el('div',{}, label ? el('h4',{text:label}) : null, mealsEl(m)),
    el('button',{class:'ghost del','aria-label':tr('Editar'),text:'✎',onclick:()=>menuForm(m.day)})));
}
function renderMenu() {
  const box = $('#menuBox'); box.replaceChildren();
  const today = new Date(), tk = ymd(today);
  const t = menuOf(tk);
  box.append(el('div',{class:'group-title',text:tr('Hoy · ') + fmtDay(today)}));
  if (t && t.meals.length) box.append(dayCard(t));
  else box.append(el('div',{class:'card'}, el('div',{class:'empty',text:[0,6].includes(today.getDay()) ? tr('Fin de semana: no hay menú de guardería.') : tr('No hay menú cargado para hoy.')})));
  const wd = k => keyDate(k).toLocaleDateString(LOCALE,{weekday:'long',day:'numeric',month:'long'});
  const up = state.menu.filter(m => m.day > tk && m.meals.length).sort((a,b)=>a.day.localeCompare(b.day));
  if (up.length) { box.append(el('div',{class:'group-title',text:tr('Próximos días')})); up.forEach(m => box.append(dayCard(m, wd(m.day)))); }
  const past = state.menu.filter(m => m.day < tk && m.meals.length).sort((a,b)=>b.day.localeCompare(a.day));
  if (past.length) {
    const d = el('details',{class:'past'}, el('summary',{text:tr('Días anteriores (') + past.length + ')'}));
    past.forEach(m => d.append(dayCard(m, wd(m.day))));
    box.append(d);
  }
  box.append(el('button',{class:'soft',style:'width:100%;margin-top:6px',text:tr('+ Añadir o corregir un día'),onclick:()=>menuForm(null)}));
  box.append(el('button',{class:'soft',style:'width:100%;margin-top:8px',text:tr('Pegar el menú de todo el mes'),onclick:menuBulk}));
}

/* --- carga del menú en bloque: se pega el texto y se ve una vista previa antes de guardar --- */
const MONTHS = { gener:1,febrer:2,'març':3,marc:3,maig:5,juny:6,juliol:7,agost:8,setembre:9,novembre:11,desembre:12, enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12 };
const WEEKDAY = '(?:dilluns|dimarts|dimecres|dijous|divendres|dissabte|diumenge|lunes|martes|mi[ée]rcoles|jueves|viernes|s[áa]bado|domingo)';
function parseMenuText(text, ym) {                       // ym = 'YYYY-MM' por defecto
  const [dy, dm] = ym.split('-').map(Number);
  const days = [], warnings = [];
  let cur = null;
  const mkKey = (y, m, d) => {
    const dt = new Date(y, m - 1, d);
    if (m < 1 || m > 12 || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return ymd(dt);
  };
  const monthNum = n => MONTHS[n.toLowerCase().normalize('NFC')] || null;
  const dayHeader = line => {
    let m;
    if ((m = line.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\b[:.\-–]?\s*(.*)$/))) return [mkKey(+m[1], +m[2], +m[3]), m[4]];
    if ((m = line.match(new RegExp('^(?:' + WEEKDAY + ')?[\\s,.]*(\\d{1,2})[\\/.\\-](\\d{1,2})(?:[\\/.\\-](\\d{2,4}))?\\b[:.\\-–]?\\s*(.*)$', 'i')))) {
      const y = m[3] ? (+m[3] < 100 ? 2000 + +m[3] : +m[3]) : dy; return [mkKey(y, +m[2], +m[1]), m[4]];
    }
    if ((m = line.match(new RegExp('^' + WEEKDAY + '\\.?,?\\s+(?:d[ií]a\\s+)?(\\d{1,2})(?:\\s+(?:de|d[\'’])\\s*([a-zá-ú]+))?(?![a-zá-ú0-9])[:.\\-–]?\\s*(.*)$', 'i')))) {
      const mo = m[2] ? monthNum(m[2]) : dm; return [mo ? mkKey(dy, mo, +m[1]) : null, m[3]];
    }
    if ((m = line.match(/^(\d{1,2})\s+(?:de|d['’])\s*([a-zá-ú]+)(?:\s+(?:de|d['’])\s*(\d{4}))?(?![a-zá-ú0-9])[:.\-–]?\s*(.*)$/i))) {
      const mo = monthNum(m[2]); return [mo ? mkKey(m[3] ? +m[3] : dy, mo, +m[1]) : null, m[4]];
    }
    if ((m = line.match(/^(\d{1,2})\s*[:.)\-–]\s*(.*)$/))) return [mkKey(dy, dm, +m[1]), m[2]];
    return null;
  };
  const addMeal = txt => {
    txt = txt.replace(/^[-•*·]\s*/, '').trim(); if (!txt) return;
    const m = txt.match(/^([^:]{2,24}):\s*(.+)$/);
    if (m) cur.meals.push({ label: m[1].trim().replace(/^./, c => c.toUpperCase()), text: m[2].trim() });
    else if (cur.meals.length) cur.meals[cur.meals.length - 1].text += '\n' + txt;
    else cur.meals.push({ label: 'Menú', text: txt });
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim(); if (!line) continue;
    const h = dayHeader(line);
    if (h) {
      if (!h[0]) { warnings.push(tr('No entiendo la fecha: «') + line.slice(0, 40) + '»'); cur = null; continue; }
      cur = days.find(d => d.day === h[0]); if (!cur) { cur = { day: h[0], meals: [] }; days.push(cur); }
      if (h[1]) addMeal(h[1]);
    } else if (cur) addMeal(line);
    else warnings.push(tr('Línea sin día, ignorada: «') + line.slice(0, 40) + '»');
  }
  return { days: days.filter(d => d.meals.length).sort((a, b) => a.day.localeCompare(b.day)), warnings };
}
function menuBulk() {
  const ym = el('input',{type:'month',value:ymd(new Date()).slice(0,7)});
  const ta = el('textarea',{rows:'9',placeholder:tr("Lunes 20\nComida: lentejas con verduras\nMerienda: fruta y pan\n\nMartes 21\nComida: pasta con tomate\nMerienda: yogur\n\n(también vale «21/10: Comida: …» o «21 de octubre»)")});
  const prev = el('div',{});
  const err = el('div',{class:'err'});
  const save = el('button',{text:tr('Guardar'),style:'flex:1'}); save.disabled = true;
  let parsed = { days: [] };
  const refresh = () => {
    parsed = parseMenuText(ta.value, ym.value || ymd(new Date()).slice(0,7));
    prev.replaceChildren();
    if (ta.value.trim()) {
      const box = el('div',{class:'preview'});
      if (!parsed.days.length) box.append(el('div',{class:'small muted',text:tr('Todavía no reconozco ningún día. Empieza cada día con su fecha (p. ej. «Lunes 20»).')}));
      parsed.days.forEach(d => box.append(el('div',{class:'pd'},
        el('strong',{text:keyDate(d.day).toLocaleDateString(LOCALE,{weekday:'short',day:'numeric',month:'short'}) + (menuOf(d.day) ? tr('  (sustituye al actual)') : '')}),
        ...d.meals.map(m => el('div',{class:'small',text:tr(m.label) + ': ' + m.text})))));
      parsed.warnings.slice(0, 5).forEach(w => box.append(el('div',{class:'small',style:'color:var(--danger)',text:w})));
      prev.append(box);
    }
    save.disabled = !parsed.days.length;
    save.textContent = parsed.days.length ? tr('Guardar ') + parsed.days.length + (parsed.days.length === 1 ? tr(' día') : tr(' días')) : tr('Guardar');
  };
  ta.oninput = refresh; ym.onchange = refresh;
  save.onclick = async () => {
    if (!parsed.days.length) return;
    save.disabled = true;
    const rows = parsed.days.map(d => ({ household_id: state.household.id, day: d.day, meals: d.meals, updated_at: new Date().toISOString() }));
    const { data, error } = await sb.from('menu_days').upsert(rows, { onConflict:'household_id,day' }).select();
    if (error) { err.textContent = errMsg(error); save.disabled = false; return; }
    const keys = new Set((data || []).map(r => r.day));
    state.menu = state.menu.filter(m => !keys.has(m.day)).concat(data || []).sort((a,b)=>a.day.localeCompare(b.day));
    closeSheet(); render(); toast(tr('Menú guardado: ') + rows.length + (rows.length === 1 ? tr(' día') : tr(' días')));
  };
  openSheet(el('h3',{text:tr('Pegar el menú')}),
    el('p',{class:'small muted',style:'margin:0 0 8px',text:tr('Pega el texto del menú. Cada día empieza con su fecha y debajo las comidas («Comida: …», «Merienda: …»).')}),
    el('label',{class:'f',text:tr('Mes (para días sin mes, como «Lunes 20»)')}), ym, el('label',{class:'f',text:tr('Texto del menú')}), ta, prev, err,
    el('div',{class:'row',style:'margin-top:12px'}, el('button',{class:'ghost',text:'Cancelar',onclick:closeSheet}), save));
}
function menuForm(key) {
  const ex = key ? menuOf(key) : null;
  const date = el('input',{type:'date',value:key || ymd(new Date())});
  if (ex) date.disabled = true;
  const rows = el('div',{});
  const addRow = (label='', text='') => {
    const l = el('input',{placeholder:tr('Comida (p. ej. Comida, Merienda)'),maxlength:'40',value:label});
    const x = el('textarea',{placeholder:tr('Qué comen'),rows:'2',maxlength:'400'}); x.value = text;
    const r = el('div',{class:'mrow'}, l, el('button',{class:'ghost',text:'×','aria-label':tr('Quitar'),style:'font-size:22px',onclick:()=>r.remove()}), x);
    r._get = () => ({ label:l.value.trim(), text:x.value.trim() });
    rows.append(r);
  };
  if (ex && ex.meals.length) ex.meals.forEach(m => addRow(tr(m.label), m.text)); else { addRow(tr('Comida')); addRow(tr('Merienda')); }
  const err = el('div',{class:'err'});
  const save = el('button',{text:tr('Guardar'),style:'flex:1'});
  save.onclick = async () => {
    const meals = [...rows.children].map(r => r._get()).filter(m => m.text);
    if (!date.value) { err.textContent = tr('Elige el día.'); return; }
    if (!meals.length) { err.textContent = tr('Escribe al menos una comida.'); return; }
    save.disabled = true;
    const { data, error } = await sb.from('menu_days')
      .upsert({ household_id: state.household.id, day: date.value, meals, updated_at: new Date().toISOString() }, { onConflict:'household_id,day' })
      .select().single();
    if (error) { err.textContent = errMsg(error); save.disabled = false; return; }
    state.menu = state.menu.filter(m => m.day !== data.day && m.id !== data.id); state.menu.push(data);
    state.menu.sort((a,b)=>a.day.localeCompare(b.day));
    closeSheet(); renderMenu();
  };
  const kids = [el('h3',{text:ex ? 'Editar menú' : tr('Añadir menú de un día')}), el('label',{class:'f',text:tr('Día')}), date, rows,
    el('button',{class:'ghost',style:'margin-top:6px',text:tr('+ Añadir comida'),onclick:()=>addRow()}), err,
    el('div',{class:'row',style:'margin-top:12px'}, el('button',{class:'ghost',text:'Cancelar',onclick:closeSheet}), save)];
  if (ex) kids.push(el('button',{class:'danger',style:'width:100%;margin-top:6px',text:tr('Eliminar este día'),onclick:()=>{ closeSheet();
    deferDelete(tr('Menú eliminado'), 'menu_days', [ex.id],
      () => { state.menu = state.menu.filter(m => m.id !== ex.id); renderMenu(); },
      () => { state.menu.push(ex); renderMenu(); }); }}));
  openSheet(...kids);
}
