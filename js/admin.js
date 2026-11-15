/* ---------- administración (solo quien entró primero en el hogar) ---------- */
// Las funciones admin_* del servidor comprueban quién es el administrador; aquí solo se muestra la pantalla.
const fmtDT = s => s ? new Date(s).toLocaleString(LOCALE, { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }) : '—';

async function adminButtonFor(box) {
  box.replaceChildren();
  try {
    const { data, error } = await sb.rpc('admin_overview');
    if (error || !data || !data.is_admin) return;
    box.append(el('button',{class:'soft',style:'width:100%;margin-bottom:8px',text:tr('Administración'),onclick:openAdmin}));
  } catch (_) {}
}

async function openAdmin() {
  const body = el('div');
  const rpc = async (name, args) => {
    const { data, error } = await sb.rpc(name, args);
    if (error) { toast(errMsg(error)); return { error }; }
    return { data };
  };
  const paint = async () => {
    const { data: o, error } = await rpc('admin_overview');
    if (error || !o || !o.is_admin) { closeSheet(); return; }
    const nameOf = uid => (o.members.find(m => m.user_id === uid) || {}).display_name || '—';
    body.replaceChildren(
      el('h3',{text:tr('Administración')}),

      el('label',{class:'f',text:tr('Miembros')}),
      ...o.members.map(m => el('div',{class:'adm-row'},
        el('div',{class:'cn'}, el('div',{class:'ct',text:m.display_name + (m.user_id === state.user.id ? ' ' + tr('(tú)') : '')}),
          el('div',{class:'small muted',text:m.email}),
          el('div',{class:'small muted',text:tr('Último acceso: ') + fmtDT(m.last_sign_in) + ' · ' + m.devices + ' ' + tr('móviles con avisos')})),
        m.user_id === state.user.id ? null : el('button',{class:'ghost danger',text:tr('Quitar'),onclick:async()=>{
          if (!confirm(tr('¿Quitar a ') + m.display_name + tr(' del hogar? Dejará de ver los datos.'))) return;
          const r = await rpc('admin_remove_member', { p_user: m.user_id }); if (!r.error) { toast(tr('Miembro quitado')); paint(); } }}))),

      el('label',{class:'f',text:tr('Código de invitación')}),
      el('div',{class:'adm-row'}, el('div',{class:'code',style:'margin:0',text:o.invite_code}),
        el('button',{class:'ghost',text:tr('Generar otro'),onclick:async()=>{
          if (!confirm(tr('¿Generar un código nuevo? El anterior dejará de valer.'))) return;
          const r = await rpc('admin_regenerate_invite');
          if (!r.error) { state.household.invite_code = r.data; toast(tr('Código nuevo creado')); paint(); } }})),

      el('label',{class:'f',text:tr('Móviles con avisos')}),
      ...(o.devices.length ? o.devices.map(d => el('div',{class:'adm-row'},
        el('div',{class:'cn'}, el('div',{class:'ct',text:d.name || tr('Sin nombre')}), el('div',{class:'small muted',text:nameOf(d.user_id) + ' · ' + fmtDT(d.created)})),
        el('button',{class:'ghost danger',text:tr('Borrar'),onclick:async()=>{
          if (!confirm(tr('¿Borrar este móvil de la lista de avisos? Dejará de recibirlos hasta que los vuelva a activar.'))) return;
          const r = await rpc('admin_delete_device', { p_id: d.id }); if (!r.error) paint(); }})))
        : [el('div',{class:'small muted',text:tr('Ninguno todavía.')})]),

      el('label',{class:'f',text:tr('Copias de seguridad automáticas')}),
      el('div',{class:'adm-row'}, el('div',{class:'cn small muted',text:tr('Última copia: ') + fmtDT(o.last_backup)}),
        el('button',{class:'ghost',text:tr('Hacer una ahora'),onclick:async(e)=>{
          e.currentTarget.disabled = true; const r = await rpc('admin_backup_now'); if (!r.error) { toast(tr('Copia hecha')); paint(); } }})),

      el('p',{class:'small muted',style:'margin:14px 0 0',text:tr('Las contraseñas no se pueden ver: están cifradas. Para crear o bloquear cuentas, usa el panel de Supabase.')}),
      el('button',{style:'width:100%;margin-top:12px',text:tr('Cerrar'),onclick:closeSheet}));
  };
  openSheet(body); await paint();
}
