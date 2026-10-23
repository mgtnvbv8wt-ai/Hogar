/* ---------- acceso ---------- */
function showOnly(id){ for (const x of ['auth','onboard','app']) $('#'+x).hidden = x!==id; }

$('#aSwitch').onclick = () => {
  state.signup = !state.signup;
  $('#aGo').textContent = state.signup ? tr('Crear cuenta') : 'Entrar';
  $('#aSwitch').textContent = state.signup ? tr('Ya tengo cuenta') : tr('Crear cuenta nueva');
  $('#aPass').autocomplete = state.signup ? 'new-password' : 'current-password';
  $('#aPass').placeholder = state.signup ? tr('Contraseña (mín. 8)') : tr('Contraseña');
  if (state.signup) $('#aPass').minLength = 8; else $('#aPass').removeAttribute('minlength');
  $('#aErr').textContent = '';
};
$('#authForm').onsubmit = async e => {
  e.preventDefault();
  const email = $('#aEmail').value.trim(), password = $('#aPass').value;
  $('#aErr').textContent = ''; $('#aGo').disabled = true;
  try {
    if (state.signup) {
      const { data, error } = await sb.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) {
        state.signup = false;
        $('#aGo').textContent = 'Entrar'; $('#aSwitch').textContent = tr('Crear cuenta nueva');
        $('#aErr').style.color = 'var(--ok)';
        $('#aErr').textContent = tr('Cuenta creada. Revisa tu correo para confirmarla y luego entra.');
        $('#aGo').disabled = false; return;
      }
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (err) { $('#aErr').style.color='var(--danger)'; $('#aErr').textContent = errMsg(err); }
  $('#aGo').disabled = false;
};

$('#aForgot').onclick = async () => {
  const email = $('#aEmail').value.trim();
  const err = $('#aErr'); err.style.color = 'var(--danger)';
  if (!email) { err.textContent = tr('Escribe tu email arriba y pulsa de nuevo.'); return; }
  $('#aForgot').disabled = true;
  const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
  $('#aForgot').disabled = false;
  if (error) { err.textContent = errMsg(error); return; }
  err.style.color = 'var(--ok)';
  err.textContent = tr('Te hemos enviado un enlace para crear una contraseña nueva. Mira tu correo (y la carpeta de spam).');
};
function passwordForm(intro) {
  const pw = el('input',{type:'password',placeholder:tr('Nueva contraseña (mín. 8)'),autocomplete:'new-password',minlength:'8'});
  const err = el('div',{class:'err'});
  openSheet(el('h2',{text:tr('Nueva contraseña')}),
    intro ? el('p',{class:'small muted',text:tr('Elige una contraseña nueva para entrar en Nuestro Hogar.')}) : null,
    pw, err,
    el('button',{style:'width:100%;margin-top:10px',text:tr('Guardar'),onclick:async()=>{
      if (pw.value.length < 8) { err.textContent = tr('La contraseña debe tener al menos 8 caracteres.'); return; }
      const { error } = await sb.auth.updateUser({ password: pw.value });
      if (error) { err.textContent = errMsg(error); return; }
      closeSheet(); toast(tr('Contraseña cambiada'));
    }}),
    el('button',{class:'ghost',style:'width:100%;margin-top:6px',text:tr('Cancelar'),onclick:closeSheet}));
  setTimeout(() => pw.focus(), 50);
}

async function signOutHere(scope) {
  try {
    if (pushSupported() && Notification.permission === 'granted') {
      const sub = await Promise.race([pushSub(), new Promise(r => setTimeout(() => r(null), 1500))]);
      if (sub) await Promise.race([sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint), new Promise(r => setTimeout(r, 1500))]);
    }
  } catch (_) {}
  await sb.auth.signOut(scope ? { scope } : undefined);
}
$('#oOut').onclick = () => signOutHere();
async function onboard(fn) {
  const name = $('#oName').value.trim();
  if (!name) { $('#oErr').textContent = tr('Escribe tu nombre.'); return; }
  $('#oErr').textContent = '';
  const { data, error } = await fn(name);
  if (error) { $('#oErr').textContent = errMsg(error); return; }
  if (!data) { $('#oErr').textContent = tr('Código de invitación no válido.'); return; }
  await boot();
}
$('#oCreate').onclick = () => onboard(n => sb.rpc('create_household', { p_name: $('#oHome').value.trim(), p_display_name: n }));
$('#oJoin').onclick = () => onboard(n => sb.rpc('join_household', { p_code: $('#oCode').value, p_display_name: n }));
