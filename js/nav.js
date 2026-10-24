/* ---------- navegación ---------- */
const TITLES = { home:tr('Inicio'), cal:tr('Calendario'), chat:tr('Chat'), shop:'Compra', chores:'Coses de Casa', menu:'Menú' };
function openTab(t) {
  if (t === 'ev') { t = 'cal'; state.calMode = 'list'; }   // pestaña antigua «Eventos»
  if (!TITLES[t]) return;
  state.tab = t; render();
  $('main').scrollTop = 0;
  if (t === 'home') loadWeather();
  if (t === 'chat') scrollChat();
}
$('#tabs').onclick = e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  openTab(b.dataset.tab);
};
function render() {
  if (!state.household) return;
  $('#title').textContent = TITLES[state.tab];
  document.body.dataset.place = state.place; document.body.dataset.tab = state.tab;
  document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab===state.tab));
  for (const t of Object.keys(TITLES)) $('#view-'+t).hidden = t!==state.tab;
  $('main').style.overflowY = state.tab==='chat' ? 'hidden' : 'auto';
  $('main').style.display = state.tab==='chat' ? 'flex' : 'block';
  $('main').style.flexDirection = 'column';
  renderPlaceSeg(); renderHome(); renderCal(); renderEvents(); renderChat(); renderShop(); renderChores(); renderMenu();
  saveSnapshotSoon();
}
