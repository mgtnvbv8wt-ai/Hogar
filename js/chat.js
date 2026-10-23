/* ---------- chat ---------- */
function renderChat() {
  const log = $('#chatlog'); const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
  log.replaceChildren();
  if (!state.messages.length) log.append(emptyState('💬', tr('Aún no hay mensajes. Saluda 👋')));
  state.messages.forEach(m => {
    const mine = m.user_id === state.user.id;
    const orig = m.reply_to ? state.messages.find(x => x.id === m.reply_to) : null;
    log.append(el('div',{class:'msg'+(mine?' mine':''),'data-id':m.id,onclick:()=>setReply(m)},
      mine ? null : el('span',{class:'who',style:'opacity:1;color:'+memberColor(m.user_id),text:who(m.user_id)}),
      m.reply_to ? el('span',{class:'quote',onclick:ev=>{ ev.stopPropagation(); if (orig) focusRow(orig.id); }},
        orig ? who(orig.user_id) + ': ' + orig.body : tr('Mensaje anterior')) : null,
      m.body, el('span',{class:'at',text:fmtTime(new Date(m.created_at))})));
  });
  if (atBottom) scrollChat();
}
function setReply(m) { state.replyTo = (state.replyTo && state.replyTo.id === m.id) ? null : m; updateReplyBar(); if (state.replyTo) $('#chatIn').focus(); }
function updateReplyBar() {
  const r = state.replyTo; $('#replyBar').hidden = !r;
  if (r) $('#replyQ').textContent = tr('Respondiendo a ') + who(r.user_id) + ': ' + r.body;
}
$('#replyX').onclick = () => { state.replyTo = null; updateReplyBar(); };
function focusRow(id) {
  setTimeout(() => { const n = document.querySelector('[data-id="' + id + '"]'); if (!n) return;
    n.scrollIntoView({ block:'center', behavior:'smooth' }); n.classList.remove('flash'); void n.offsetWidth; n.classList.add('flash'); }, 80);
}
function scrollChat() { requestAnimationFrame(()=>{ const l=$('#chatlog'); l.scrollTop=l.scrollHeight; }); }
$('#chatForm').onsubmit = async e => {
  e.preventDefault();
  const body = $('#chatIn').value.trim(); if (!body) return;
  $('#chatIn').value = '';
  const reply_to = state.replyTo ? state.replyTo.id : null;
  const { data, error } = await sb.from('messages').insert({ household_id: state.household.id, body, ...(reply_to ? { reply_to } : {}) }).select().single();
  if (error) { toast(errMsg(error)); $('#chatIn').value = body; return; }
  state.replyTo = null; updateReplyBar();
  upsert(state.messages, data); renderChat(); scrollChat();
};
