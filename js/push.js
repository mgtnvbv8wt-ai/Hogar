/* ---------- avisos push ---------- */
const VAPID_PUBLIC = 'BNPXq508qsSfFthyNsN8d9yyEm5sB_8NBRDzKef0Anrxf5JkaA_mFdDXOirshw-12-QAD68uKSt0X_7t_hx8b88';
const b64 = s => { const r = atob((s + '='.repeat((4 - s.length % 4) % 4)).replace(/-/g,'+').replace(/_/g,'/')); return Uint8Array.from(r, c => c.charCodeAt(0)); };
const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
async function pushSub() { const reg = await navigator.serviceWorker.ready; return reg.pushManager.getSubscription(); }
async function pushState() {
  if (!pushSupported()) return 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  return (Notification.permission === 'granted' && await pushSub()) ? 'on' : 'off';
}
async function saveSub(sub) {
  const j = sub.toJSON();
  const { error } = await sb.rpc('save_push_subscription', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth });
  if (error) throw error;
}
async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error(tr('Permiso denegado'));
  const reg = await navigator.serviceWorker.ready;
  const sub = (await reg.pushManager.getSubscription()) ||
    await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(VAPID_PUBLIC) });
  await saveSub(sub);
}
async function disablePush() {
  const sub = await pushSub(); if (!sub) return;
  await sb.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
  await sub.unsubscribe();
}
// mantener este dispositivo asociado al usuario actual
async function refreshPush() {
  try { if (await pushState() === 'on') await saveSub(await pushSub()); } catch (_) {}
}
if ('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message', e => {
  const t = e.data && e.data.tab;
  if (t) openTab(t);
});
