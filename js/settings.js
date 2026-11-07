function langSeg() {
  const wrap = el('div',{class:'seg'});
  [['es','Castellano'],['ca','Català']].forEach(([v, l]) => wrap.append(el('button',{type:'button',class:v === LANG ? 'on' : '',text:l,onclick:()=>{
    if (v === LANG) return; try { localStorage.setItem('hogar-lang', v); } catch (_) {} location.reload(); }})));
  return wrap;
}
function prefSeg(key, opts) {
  const wrap = el('div',{class:'seg'});
  const paint = () => { const v = loadPrefs()[key] || (key === 'size' ? 'normal' : '');
    wrap.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); };
  opts.forEach(([v, l]) => wrap.append(el('button',{type:'button','data-v':v,text:l,onclick:()=>{
    const p = loadPrefs(); if (v && !(key === 'size' && v === 'normal')) p[key] = v; else delete p[key];
    savePrefs(p); applyPrefs(); paint(); }})));
  paint(); return wrap;
}

/* ---------- ajustes ---------- */
$('#btnSettings').onclick = () => {
  const names = Object.values(state.members).join(LANG === 'ca' ? ' i ' : ' y ');
  const pushNote = el('p',{class:'small muted',style:'margin:0 0 8px',text:tr('Comprobando…')});
  const pushBtn = el('button',{class:'soft',style:'width:100%',hidden:'',text:''});
  const paint = async () => {
    const st = await pushState();
    pushBtn.hidden = !(st==='on' || st==='off');
    pushBtn.disabled = false;
    pushNote.textContent = {
      unsupported:tr('Para recibir avisos, añade esta app a la pantalla de inicio (Compartir → Añadir a pantalla de inicio) y ábrela desde ahí. Requiere iOS 16.4 o superior.'),
      denied:tr('Has bloqueado los avisos. Actívalos en Ajustes del iPhone → Notificaciones → Hogar.'),
      off:tr('Recibirás un aviso cuando tu pareja escriba, añada algo a la compra o cree un evento.'),
      on:tr('Avisos activados: te llegarán los mensajes, la compra y los eventos nuevos de tu pareja.')
    }[st];
    pushBtn.textContent = st==='on' ? tr('Desactivar avisos') : tr('Activar avisos');
    pushBtn.onclick = async () => {
      pushBtn.disabled = true;
      try { st==='on' ? await disablePush() : await enablePush(); }
      catch (e) { toast(errMsg(e)); }
      paint(); paintDevices();
    };
  };
  const devBox = el('div',{});
  const paintDevices = async () => {
    devBox.replaceChildren();
    if (await pushState() !== 'on') return;
    const inp = el('input',{type:'text',maxlength:'40',value:deviceName(),'aria-label':tr('Nombre de este móvil')});
    const mine = (await pushSub()).endpoint;
    devBox.append(
      el('label',{class:'f',text:tr('Nombre de este móvil')}),
      el('div',{style:'display:flex;gap:8px'}, inp, el('button',{class:'soft',text:tr('Guardar'),onclick:async()=>{
        if (!inp.value.trim()) return; setDeviceName(inp.value);
        try { await saveSub(await pushSub()); toast(tr('Nombre guardado')); paintDevices(); } catch (e) { toast(errMsg(e)); } }})));
    const { data } = await sb.from('push_subscriptions').select('id,endpoint,device_name,created_at').order('created_at');
    if (data && data.length) {
      devBox.append(el('label',{class:'f',text:tr('Tus móviles con avisos')}));
      data.forEach(d => devBox.append(el('p',{class:'small',style:'margin:2px 0',
        text:(d.device_name || tr('Sin nombre')) + (d.endpoint === mine ? ' ' + tr('(este)') : '') + ' · ' + new Date(d.created_at).toLocaleDateString(LOCALE,{day:'numeric',month:'short'})})));
    }
  };
  const prefsBox = el('div',{});
  const paintPrefs = async () => {
    prefsBox.replaceChildren();
    if (!pushSupported()) return;
    let prefs;
    try { prefs = await loadNotifPrefs(); } catch (_) { return; }
    const save = async () => { try { await saveNotifPrefs(prefs); } catch (e) { toast(errMsg(e)); } };
    prefsBox.append(el('label',{class:'f',text:tr('Qué avisos quieres recibir')}));
    NOTIF_KINDS.forEach(([k, label]) => {
      const cb = el('input',{type:'checkbox',style:'width:auto'}); cb.checked = prefs[k] !== false;
      cb.onchange = () => { prefs[k] = cb.checked; save(); };
      prefsBox.append(el('label',{class:'f row',style:'margin:6px 0'}, cb, ' ' + tr(label)));
    });
    const q = el('input',{type:'checkbox',style:'width:auto'}); q.checked = prefs.quiet === true;
    const from = el('input',{type:'time',value:prefs.quiet_from || '23:00'}), to = el('input',{type:'time',value:prefs.quiet_to || '07:30'});
    const times = el('div',{class:'row',style:'gap:8px'}, from, el('span',{text:'→',style:'align-self:center'}), to);
    const sync = () => { times.hidden = !q.checked; };
    const upd = () => { prefs.quiet = q.checked; prefs.quiet_from = from.value || '23:00'; prefs.quiet_to = to.value || '07:30'; sync(); save(); };
    q.onchange = upd; from.onchange = upd; to.onchange = upd; sync();
    prefsBox.append(el('label',{class:'f row',style:'margin:10px 0 6px'}, q, ' ' + tr('Silencio por la noche')), times,
      el('p',{class:'small muted',style:'margin:6px 0 0',text:tr('En silencio no suena nada, salvo los recordatorios de eventos. Estos ajustes valen para todos tus móviles.')}));
  };
  paint(); paintDevices(); paintPrefs();
  openSheet(
    el('h3',{text:state.household.name}),
    el('p',{class:'muted',text:tr('En el hogar: ')+names}),
    el('label',{class:'f',text:tr('Código para invitar a tu pareja')}),
    el('div',{class:'code',text:state.household.invite_code}),
    el('button',{class:'soft',style:'width:100%;margin-top:10px',text:tr('Copiar código'),onclick:async()=>{
      try { await navigator.clipboard.writeText(state.household.invite_code); toast(tr('Código copiado')); } catch { toast(tr('Cópialo a mano')); }}}),
    el('hr',{style:'border:0;border-top:1px solid var(--line);margin:18px 0'}),
    el('label',{class:'f',text:'Idioma · Llengua'}), langSeg(),
    el('label',{class:'f',text:'Tema'}), prefSeg('theme', [['', tr('Automático')], ['light', tr('Claro')], ['dark', tr('Oscuro')]]),
    el('label',{class:'f',text:tr('Tamaño de letra')}), prefSeg('size', [['normal', 'Normal'], ['large', tr('Grande')], ['xl', tr('Muy grande')]]),
    el('hr',{style:'border:0;border-top:1px solid var(--line);margin:18px 0'}),
    stationFields(),
    el('hr',{style:'border:0;border-top:1px solid var(--line);margin:18px 0'}),
    el('label',{class:'f',text:tr('Avisos en este móvil')}),
    pushNote, pushBtn, devBox, prefsBox,
    el('hr',{style:'border:0;border-top:1px solid var(--line);margin:18px 0'}),
    el('label',{class:'f',text:tr('Copia de seguridad')}),
    el('p',{class:'small muted',style:'margin:0 0 8px',text:tr('Descarga todos los datos del hogar (eventos, mensajes, compra, tareas y menús) en un archivo.')}),
    el('button',{class:'soft',style:'width:100%',text:tr('Descargar copia de seguridad'),onclick:exportBackup}),
    el('hr',{style:'border:0;border-top:1px solid var(--line);margin:18px 0'}),
    el('button',{class:'soft',style:'width:100%;margin-bottom:8px',text:tr('Cambiar contraseña'),onclick:()=>passwordForm(false)}),
    el('button',{class:'soft',style:'width:100%;margin-bottom:8px',text:tr('Cerrar sesión en todos los dispositivos'),onclick:()=>{
      if (!confirm(tr('¿Cerrar la sesión en todos los dispositivos? Tendréis que volver a entrar con la contraseña.'))) return;
      closeSheet(); signOutHere('global'); }}),
    el('button',{class:'danger',style:'width:100%',text:tr('Cerrar sesión'),onclick:()=>{closeSheet(); signOutHere();}}),
    el('button',{class:'ghost',style:'width:100%;margin-top:6px',text:tr('Cerrar'),onclick:closeSheet}));
};
