/* ---------- AngIA: asistente de la casa (Gemini, vía la función «angia») ---------- */
const ANGIA_KEEP = 40;                                    // mensajes que se recuerdan en este móvil
const ANGIA_HINTS = ['¿Qué falta por comprar?', '¿Qué tenemos esta semana?', '¿Qué hay de menú en la guardería hoy?', 'Idea de cena rápida', 'Añade leche y pan a la compra'];
const angiaKey = () => 'hogar-angia-' + (state.user ? state.user.id : '');
function angiaLoad() { try { return JSON.parse(localStorage.getItem(angiaKey())) || []; } catch (_) { return []; } }
function angiaSave() { try { localStorage.setItem(angiaKey(), JSON.stringify(state.angia.slice(-ANGIA_KEEP))); } catch (_) {} }
function angiaMsgs() { if (!state.angia) state.angia = angiaLoad(); return state.angia; }

// texto → nodos: **negrita** y viñetas «* », sin HTML (todo con textContent)
function angiaText(text) {
  const out = [];
  text.split('\n').forEach((line, i, arr) => {
    line = line.replace(/^\s*[*-]\s+/, '• ');
    line.split(/(\*\*[^*]+\*\*)/).forEach(part => {
      if (/^\*\*[^*]+\*\*$/.test(part)) out.push(el('b', { text: part.slice(2, -2) })); else if (part) out.push(document.createTextNode(part.replace(/\*/g, '')));
    });
    if (i < arr.length - 1) out.push(document.createElement('br'));
  });
  return out;
}

function renderAngia() {
  const log = $('#angialog'); if (!log) return;
  const msgs = angiaMsgs(), atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.replaceChildren();
  if (!msgs.length && !state.angiaBusy) {
    log.append(emptyState('✨', tr('Hola, soc AngIA. Pregúntame lo que quieras sobre la casa, la compra, las tareas o el menú, o cualquier duda del día a día.')));
    log.append(el('div', { class: 'angia-hints' }, ANGIA_HINTS.map(h => el('button', { class: 'soft', text: tr(h), onclick: () => askAngia(tr(h)) }))));
  }
  msgs.forEach(m => {
    const mine = m.role === 'user';
    log.append(el('div', { class: 'msg' + (mine ? ' mine' : ' ai') },
      mine ? null : el('span', { class: 'who', text: 'AngIA' }),
      mine ? m.text : angiaText(m.text)));
  });
  if (state.angiaBusy) log.append(el('div', { class: 'msg ai', 'aria-label': tr('AngIA está escribiendo') }, el('span', { class: 'who', text: 'AngIA' }), el('span', { class: 'typing' }, el('i'), el('i'), el('i'))));
  if (msgs.length && !state.angiaBusy) log.append(el('button', { class: 'ghost clear', text: tr('Borrar conversación'), onclick: () => { state.angia = []; angiaSave(); renderAngia(); } }));
  if (atBottom || state.angiaBusy) scrollAngia();
}
function scrollAngia() { requestAnimationFrame(() => { const l = $('#angialog'); if (l) l.scrollTop = l.scrollHeight; }); }

function angiaError(code) {
  return { limit: 'Has llegado al límite de preguntas de hoy. Mañana podrás seguir.', not_configured: 'AngIA aún no está activada.', busy: 'AngIA está muy ocupada ahora. Inténtalo en un minuto.',
    auth: 'Vuelve a iniciar sesión.', empty_reply: 'No he sabido qué responder. ¿Puedes reformularlo?' }[code] || 'No he podido responder ahora. Inténtalo de nuevo.';
}
async function askAngia(text) {
  text = (text || '').trim(); if (!text || state.angiaBusy) return;
  if (navigator.onLine === false || state.offlineMode) { toast(tr('Sin conexión. Inténtalo cuando tengas cobertura.')); return; }
  const msgs = angiaMsgs(), history = msgs.slice(-10).map(m => ({ role: m.role, text: m.text }));
  msgs.push({ role: 'user', text }); state.angiaBusy = true; angiaSave(); renderAngia();
  let reply;
  try {
    const { data, error } = await sb.functions.invoke('angia', { body: { message: text, history, place: state.place } });
    let code = data && data.error;
    if (error && !code) { try { const j = await error.context.json(); code = j && j.error; } catch (_) {} code = code || 'upstream'; }
    reply = (data && data.reply) || tr(angiaError(code));
    if (data && data.done && data.done.length) loadAll().then(render).catch(() => {});   // lo que ha añadido aparece ya en su pestaña
  } catch (_) { reply = tr(angiaError('upstream')); }
  state.angiaBusy = false;
  msgs.push({ role: 'model', text: reply }); angiaSave();
  if (state.tab === 'angia') renderAngia();
}
$('#angiaForm').onsubmit = e => { e.preventDefault(); const i = $('#angiaIn'), v = i.value; i.value = ''; askAngia(v); };

/* memoria compartida: datos que AngIA recuerda para toda la familia (tabla angia_memory) */
async function openMemory() {
  const body = el('div');
  const paint = async () => {
    const { data, error } = await sb.from('angia_memory').select('*').order('created_at');
    if (error) { toast(errMsg(error)); return; }
    const input = el('input', { placeholder: tr('Ej.: Sílvia es alérgica a la penicilina'), maxlength: '300', autocomplete: 'off' });
    const add = async () => {
      const text = input.value.trim(); if (!text) return;
      const r = await sb.from('angia_memory').insert({ household_id: state.household.id, text });
      if (r.error) { toast(errMsg(r.error)); return; }
      paint();
    };
    body.replaceChildren(
      el('h3', { text: tr('Memoria de AngIA') }),
      el('p', { class: 'small muted', text: tr('Lo que AngIA recuerda para toda la familia. Puedes decirle «recuerda que…» en la conversación o escribirlo aquí. No guardes contraseñas ni datos bancarios.') }),
      ...(data.length ? data.map(m => el('div', { class: 'adm-row' }, el('div', { class: 'cn' }, m.text),
        el('button', { class: 'ghost danger', text: tr('Borrar'), onclick: async () => { const r = await sb.from('angia_memory').delete().eq('id', m.id); if (r.error) toast(errMsg(r.error)); else paint(); } })))
        : [el('div', { class: 'small muted', text: tr('Aún no recuerda nada.') })]),
      el('div', { class: 'row', style: 'margin-top:12px' }, input, el('button', { text: tr('Guardar'), onclick: add })),
      el('button', { class: 'ghost', style: 'width:100%;margin-top:10px', text: tr('Cerrar'), onclick: closeSheet }));
  };
  openSheet(body); await paint();
}
$('#angiaMem').onclick = openMemory;
