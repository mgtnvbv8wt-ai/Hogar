/* ---------- el tiempo (estaciones Ecowitt) ---------- */
async function loadWeather(force) {
  if (!state.household || !state.stations.length || state.weatherBusy) return;
  if (!force && Date.now() - state.weatherAt < 2 * 60 * 1000) return;
  state.weatherBusy = true;
  try {
    const { data, error } = await sb.functions.invoke('weather', { body: {} });
    if (error) throw error;
    state.weather = data; state.weatherAt = Date.now();
  } catch (_) {
    state.weather = { configured: true, stations: [], failed: true }; state.weatherAt = Date.now() - 90 * 1000;   // reintenta en ~30 s
  }
  state.weatherBusy = false;
  if (state.tab === 'home') renderHome();
}
const COMPASS = ['N','NE','E','SE','S','SO','O','NO'];
const compass = d => d == null ? '' : COMPASS[Math.round(d / 45) % 8];
const fnum = (n, d = 1) => n == null ? null : Number(n).toLocaleString(LOCALE, { minimumFractionDigits: d, maximumFractionDigits: d });
function ago(iso) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 2 ? 'ahora' : m < 60 ? tr('hace ') + m + ' min' : m < 1440 ? tr('hace ') + Math.round(m / 60) + ' h' : tr('hace ') + Math.round(m / 1440) + ' d';
}
function renderWeather(box) {
  box.append(el('div',{class:'group-title',text:tr('El tiempo')}));
  if (!state.stations.length) {
    box.append(el('div',{class:'card'}, el('div',{class:'small muted',style:'margin-bottom:8px',text:tr('Conecta tu estación Ecowitt para ver aquí la temperatura, el viento y la lluvia de Torelló.')}),
      el('button',{class:'soft',style:'width:100%',text:tr('Configurar estación'),onclick:()=>$('#btnSettings').click()})));
    return;
  }
  const w = state.weather;
  if (w && w.configured === false) {
    box.append(el('div',{class:'card'}, el('div',{class:'small muted',text:w.reason === 'keys'
      ? tr('Faltan las claves de Ecowitt en el servidor. Cuando se añadan, aparecerá aquí el tiempo.') : tr('No hay estaciones configuradas.')})));
    return;
  }
  WX_PLACES.forEach(([k, label]) => {
    if (!state.stations.some(x => x.place === k)) return;
    const st = w && (w.stations || []).find(x => x.place === k), r = st && st.reading;
    if (!w) { box.append(el('div',{class:'wx'}, el('div',{}, el('div',{class:'where',text:label}), el('div',{class:'muted',text:tr('Cargando…')})))); return; }
    if (!r) {
      box.append(el('div',{class:'wx'}, el('div',{}, el('div',{class:'where',text:label}),
        el('div',{class:'muted',text: w.failed ? tr('No se pudo cargar el tiempo.') : (st && st.error) || tr('Sin datos todavía.')}))));
      return;
    }
    const old = Date.now() - new Date(r.taken_at).getTime() > 3 * 3600e3;
    const stats = [
      r.humidity != null ? '💧 ' + fnum(r.humidity, 0) + ' %' : null,
      r.wind_kmh != null ? '💨 ' + fnum(r.wind_kmh, 0) + ' km/h ' + compass(r.wind_dir) : null,
      r.rain_today_mm != null ? '🌧 ' + fnum(r.rain_today_mm, 1) + tr(' mm hoy') : null,
    ].filter(Boolean);
    box.append(el('button',{class:'wx',onclick:()=>weatherDetail(k, r)},
      el('div',{}, el('div',{class:'where',text:label}),
        el('div',{class:'big',text: r.temp_c != null ? fnum(r.temp_c, 1) + '°' : '—'}),
        el('div',{class:'small muted',style:'margin-top:4px',text: old ? tr('Sin datos recientes · ') + ago(r.taken_at) : ago(r.taken_at) + (st.stale ? tr(' · sin conexión') : '')})),
      el('div',{class:'stats'}, ...stats.map(t => el('div',{text:t})))));
  });
}
function sparkline(points) {                     // [{t: ms, v: número}] → SVG
  if (points.length < 2) return null;
  const W = 300, H = 90, P = 6;
  const t0 = points[0].t, t1 = points[points.length - 1].t || t0 + 1;
  const vs = points.map(p => p.v), lo = Math.min(...vs), hi = Math.max(...vs), span = hi - lo || 1;
  const xy = p => [P + (p.t - t0) / (t1 - t0 || 1) * (W - 2*P), H - P - (p.v - lo) / span * (H - 2*P)];
  const d = points.map((p, i) => { const [x, y] = xy(p); return (i ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1); }).join(' ');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('class', 'spark'); svg.setAttribute('preserveAspectRatio', 'none');
  svg.innerHTML = '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>';
  return svg;
}
async function weatherDetail(place, r) {
  const rows = [
    ['Temperatura', r.temp_c, v => fnum(v, 1) + ' °C'], [tr('Sensación térmica'), r.feels_c, v => fnum(v, 1) + ' °C'],
    [tr('Humedad'), r.humidity, v => fnum(v, 0) + ' %'], [tr('Presión'), r.pressure_hpa, v => fnum(v, 1) + ' hPa'],
    [tr('Viento'), r.wind_kmh, v => fnum(v, 1) + ' km/h ' + compass(r.wind_dir)], [tr('Racha máxima'), r.gust_kmh, v => fnum(v, 1) + ' km/h'],
    [tr('Lluvia hoy'), r.rain_today_mm, v => fnum(v, 1) + ' mm'], [tr('Intensidad de lluvia'), r.rain_rate_mm, v => fnum(v, 1) + ' mm/h'],
    [tr('Índice UV'), r.uv, v => fnum(v, 1)], [tr('Radiación solar'), r.solar_wm2, v => fnum(v, 0) + ' W/m²'],
    [tr('Temperatura interior'), r.indoor_temp_c, v => fnum(v, 1) + ' °C'], [tr('Humedad interior'), r.indoor_humidity, v => fnum(v, 0) + ' %'],
  ].filter(x => x[1] != null);
  const chart = el('div',{}, el('div',{class:'small muted',text:tr('Cargando historial…')}));
  openSheet(el('h3',{text:PLACE_NAME[place]}), el('div',{class:'small muted',style:'margin:-6px 0 8px',text:tr('Actualizado ') + ago(r.taken_at)}),
    ...rows.map(([k, v, f]) => el('div',{class:'kv'}, el('span',{class:'muted',text:k}), el('b',{text:f(v)}))),
    el('label',{class:'f',text:tr('Temperatura, últimas 24 h')}), chart,
    el('button',{class:'ghost',style:'width:100%;margin-top:10px',text:tr('Cerrar'),onclick:closeSheet}));
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const { data } = await sb.from('weather_readings').select('taken_at,temp_c').eq('place', place).gte('taken_at', since).order('taken_at');
  const pts = (data || []).filter(x => x.temp_c != null).map(x => ({ t: new Date(x.taken_at).getTime(), v: Number(x.temp_c) }));
  chart.replaceChildren();
  const svg = sparkline(pts);
  if (svg) {
    const vs = pts.map(p => p.v);
    chart.append(svg, el('div',{class:'small muted',text:tr('Mín ') + fnum(Math.min(...vs), 1) + tr('° · Máx ') + fnum(Math.max(...vs), 1) + '°'}));
  } else chart.append(el('div',{class:'small muted',text:tr('El historial se va completando cada vez que se abre la app.')}));
}
function stationFields() {
  const norm = v => { let x = v.trim().toUpperCase().replace(/[^0-9A-F]/g, ''); return x.length === 12 ? x.match(/../g).join(':') : null; };
  const wrap = el('div',{});
  wrap.append(el('label',{class:'f',text:tr('Estaciones Ecowitt (dirección MAC)')}),
    el('p',{class:'small muted',style:'margin:0 0 6px',text:tr('La MAC aparece en ecowitt.net → Dispositivos (formato AA:BB:CC:DD:EE:FF). Déjala vacía para quitar la estación.')}));
  WX_PLACES.forEach(([k, label]) => {
    const inp = el('input',{placeholder:label + ': AA:BB:CC:DD:EE:FF',value:(state.stations.find(x => x.place === k) || {}).mac || '',autocapitalize:'characters',autocorrect:'off',maxlength:'20'});
    const btn = el('button',{class:'soft',text:tr('Guardar')});
    btn.onclick = async () => {
      const cur = state.stations.find(x => x.place === k);   // se lee al pulsar, por si se guardó antes en esta misma hoja
      const raw = inp.value.trim(), mac = raw ? norm(raw) : null;
      if (raw && !mac) { toast(tr('MAC no válida (12 caracteres hexadecimales)')); return; }
      btn.disabled = true;
      let error;
      if (!raw) {
        if (cur) ({ error } = await sb.from('weather_stations').delete().eq('id', cur.id));
        if (!error) state.stations = state.stations.filter(x => x.place !== k);
      } else {
        const res = await sb.from('weather_stations').upsert({ household_id: state.household.id, place: k, mac }, { onConflict:'household_id,place' }).select().single();
        error = res.error;
        if (!error) { state.stations = state.stations.filter(x => x.place !== k).concat(res.data); inp.value = mac; }
      }
      btn.disabled = false;
      if (error) { toast(errMsg(error)); return; }
      toast(raw ? tr('Estación guardada') : tr('Estación eliminada'));
      state.weather = null; state.weatherAt = 0; renderHome(); loadWeather(true);
    };
    wrap.append(el('div',{class:'row',style:'margin-bottom:8px'}, inp, btn));
  });
  return wrap;
}
