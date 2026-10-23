/* Arranque: este archivo se carga el último, cuando ya existe todo lo demás. */

sb.auth.onAuthStateChange((event, session) => {
  // evitar deadlocks: no hacer llamadas supabase dentro del callback
  setTimeout(() => {
    if (session) { state.user = session.user; const rec = event === 'PASSWORD_RECOVERY'; Promise.resolve(boot()).then(() => { if (rec) { passwordForm(true); history.replaceState(null, '', location.pathname); } }); }
    else { state.user = null; teardown(); showOnly('auth'); }
  }, 0);
});

/* ---------- PWA ---------- */
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(()=>{}));

// estado inicial
sb.auth.getSession().then(({ data }) => { if (!data.session) showOnly('auth'); });
