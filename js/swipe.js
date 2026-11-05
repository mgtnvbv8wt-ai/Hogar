/* ---------- deslizar para marcar (→) o borrar (←) en compra y tareas ---------- */
(function () {
  const LOCK = 12, ACT = 90, MAX = 130;
  const target = row => {
    const id = row.dataset.id; if (!id) return null;
    if (row.closest('#shopList')) { const i = state.items.find(x => x.id === id); return i && { check: () => toggleItem(i), del: () => delItem(i) }; }
    if (row.closest('#choreList') || row.closest('#homeBox')) { const c = state.chores.find(x => x.id === id); return c && { check: () => toggleChore(c), del: () => delChore(c) }; }
    return null;
  };
  let st = null;
  const reset = row => { row.style.transition = 'transform .18s'; row.style.transform = ''; row.style.background = ''; setTimeout(() => { row.style.transition = ''; }, 200); };
  document.addEventListener('touchstart', e => {
    const row = e.target.closest && e.target.closest('.item'); if (!row || e.touches.length !== 1 || e.target.closest('button,input,select,textarea')) { st = null; return; }
    const t = e.touches[0]; st = { row, x: t.clientX, y: t.clientY, dx: 0, lock: false };
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!st) return;
    const t = e.touches[0], dx = t.clientX - st.x, dy = t.clientY - st.y;
    if (!st.lock) {
      if (Math.abs(dy) > LOCK && Math.abs(dy) > Math.abs(dx)) { st = null; return; }     // es un scroll vertical
      if (Math.abs(dx) < LOCK || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      st.lock = true;
    }
    st.dx = Math.max(-MAX, Math.min(MAX, dx));
    st.row.style.transform = 'translateX(' + st.dx + 'px)';
    st.row.style.background = st.dx > 0 ? 'rgba(46,160,67,' + Math.min(.25, Math.abs(st.dx) / 400) + ')' : 'rgba(220,53,69,' + Math.min(.25, Math.abs(st.dx) / 400) + ')';
  }, { passive: true });
  const end = () => {
    if (!st) return;
    const { row, dx, lock } = st; st = null;
    if (!lock) return;
    // evita que el «toque» final abra el formulario del elemento
    const stop = ev => { ev.stopPropagation(); ev.preventDefault(); };
    document.addEventListener('click', stop, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', stop, true), 350);
    const tg = target(row); reset(row);
    if (!tg) return;
    if (dx >= ACT) tg.check(); else if (dx <= -ACT) tg.del();
  };
  document.addEventListener('touchend', end);
  document.addEventListener('touchcancel', () => { if (st && st.lock) reset(st.row); st = null; });
})();
