/* ---------- copia de seguridad ---------- */
async function exportBackup() {
  toast(tr('Preparando copia…'));
  const get = async (t, q) => { const { data, error } = await q; if (error) throw error; return data; };
  try {
    const [eventos, mensajes, compra, habituales, tareas, menu] = await Promise.all([
      get('events', sb.from('events').select('*').order('starts_at')),
      get('messages', sb.from('messages').select('*').order('created_at')),
      get('shopping_items', sb.from('shopping_items').select('*').order('created_at')),
      get('shopping_staples', sb.from('shopping_staples').select('*').order('name')),
      get('chores', sb.from('chores').select('*').order('created_at')),
      get('menu_days', sb.from('menu_days').select('*').order('day')),
    ]);
    const data = { app:'Nuestro Hogar', exportado:new Date().toISOString(), hogar:state.household.name,
      miembros:state.members, eventos, mensajes, compra, habituales, tareas, menu };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
    const file = new File([blob], 'hogar-copia-' + ymd(new Date()) + '.json', { type:'application/json' });
    if (navigator.canShare && navigator.canShare({ files:[file] })) {
      try { await navigator.share({ files:[file], title:tr('Copia de seguridad de Nuestro Hogar') }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    const a = el('a',{href:URL.createObjectURL(blob), download:file.name}); document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast(tr('Copia descargada'));
  } catch (e) { toast(errMsg(e)); }
}
