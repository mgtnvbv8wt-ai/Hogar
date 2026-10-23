/* ---------- viviendas (L'Estartit / Torelló) ---------- */
function renderPlaceSeg() {
  const fill = (sel, list) => {
    $(sel).replaceChildren(...PLACES.map(([k, l]) => {
      const n = list.filter(x => !x.done && x.place === k).length;
      const b = el('button',{class:state.place === k ? 'on' : '', text:l + (n ? ' (' + n + ')' : '')});
      b.onclick = () => { state.place = k; savePlace(k); render(); };
      return b;
    }));
  };
  fill('#shopSeg', state.items); fill('#choreSeg', state.chores);
}
const placeSelect = v => { const s = el('select',{}, ...PLACES.map(([k, l]) => el('option',{value:k,text:l}))); s.value = v; return s; };

/* ---------- compra ---------- */
const CATS = [['frutas',tr('Fruta y verdura')],['carne',tr('Carne y pescado')],['lacteos',tr('Lácteos y huevos')],['pan',tr('Panadería')],
  ['despensa',tr('Despensa')],['bebidas',tr('Bebidas')],['congelados',tr('Congelados')],['limpieza',tr('Limpieza')],
  ['higiene',tr('Higiene y farmacia')],['bebe',tr('Bebé')],['otros',tr('Otros')]];
const CAT_NAME = Object.fromEntries(CATS);
const GUESS = [
  ['bebe', /pa[ñn]al|biber[óo]n|potito|papilla|chupete|beb[ée]|continuaci[óo]n|bolquer|biber[oó]|nad[oó]|llet de continuaci/i],
  ['frutas', /manzana|\bpera|pl[áa]tano|naranja|mandarina|lim[óo]n|fresa|\buvas?\b|mel[óo]n|sand[íi]a|kiwi|aguacate|tomate|lechuga|cebolla|\bajos?\b|patata|zanahoria|pimiento|calabac[ií]n|pepino|br[óo]coli|espinaca|champi[ñn]|fruta|verdura|ensalada|puerro|berenjena|jud[íi]as verdes|coliflor|\bcol\b|rúcula|rucula|nectarina|melocot[óo]n|ciruela|cereza|\bpoma|\bpera|platan|taronja|llimona|maduixa|\braim|\bmelo|sindria|alvocat|tomaquet|enciam|\bceba|pastanaga|pebrot|carbasso|cogombre|broquil|espinac|bolets|fruita|verdura|amanida/i],
  ['carne', /pollo|ternera|cerdo|\bcarne|jam[óo]n|chorizo|salchich|bacon|\bpavo|merluza|salm[óo]n|at[úu]n|pescado|gamba|sepia|bacalao|lomo|hamburguesa|cordero|embutido|fiambre|calamar|mejill[óo]n|dorada|lubina|pollastre|vedella|\bporc|\bcarn\b|pernil|botifarra|salsitxa|\bbaco|gall d.indi|llus|salmo|tonyina|\bpeix|gambes|sipia|bacalla|\bllom|xai|embotit|musclos|orada|llobarro/i],
  ['lacteos', /leche|yogur|queso|huevo|mantequilla|\bnata\b|natillas|k[ée]fir|reques[óo]n|flan|\bllet\b|iogurt|formatge|\bous?\b|mantega|natilles|kefir|mato\b|flam/i],
  ['pan', /\bpan\b|baguette|boller[íi]a|croissant|panecillo|tostadas|barra de pan|\bpa\b|baguet|pastisseria|torrades|barra de pa/i],
  ['congelados', /congelad|helado|pizza|croqueta|nuggets?|empanadilla|congelat|gelat|croquetes?|empanadilla/i],
  ['higiene', /champ[úu]|\bgel\b|jab[óo]n|pasta de dientes|dent[íi]frico|cepillo|papel higi[ée]nico|desodorante|compresa|tamp[óo]n|colonia|ibuprofeno|paracetamol|tirita|algod[óo]n|toallitas|crema (solar|hidratante|de manos|corporal)|maquinilla|afeitar|xampu|\bsabo\b|pasta de dents|raspall|paper higienic|desodorant|compreses|tampons|colonia|ibuprofe|tireta|cotto|tovalloletes|maquineta|afaitar/i],
  ['limpieza', /lej[íi]a|detergente|suavizante|fregasuelos|friegaplatos|lavavajillas|estropajo|bayeta|papel (de )?cocina|bolsas? de basura|limpia|ambientador|fregona|escoba|pastillas (de|para)|quitagrasas|sal lavavajillas|lleixiu|suavitzant|rentaplats|fregall|baieta|paper de cuina|bosses d.escombraries|netejador|escombra|desengreixant/i],
  ['bebidas', /\bagua\b|zumo|refresco|cerveza|\bvino|\bcola\b|coca-cola|caf[ée]|infusi[óo]n|gaseosa|t[óo]nica|\bt[ée]\b|batido|\baigua\b|\bsuc\b|refresc|cervesa|\bvi\b|\bcafe\b|infusio|gasosa|tonica|\bte\b|batut/i],
  ['despensa', /arroz|\bpasta\b|macarron|espagueti|fideo|lentejas|garbanzo|alubia|aceite|\bsal\b|az[úu]car|vinagre|tomate frito|conserva|\blatas?\b|cereales|galleta|\bmiel\b|mermelada|cacao|harina|salsa|especias|frutos secos|almendra|nueces|chocolate|mayonesa|ketchup|pur[ée]|arros|macarrons|espaguetis|fideus|llenties|cigrons|mongetes|\boli\b|sucre|llaunes?|galetes|\bmel\b|melmelada|farina|especies|fruits secs|ametlles|\bnous\b|xocolata|maionesa/i],
];
function guessCat(name) { const plain = name.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); for (const [c, re] of GUESS) if (re.test(name) || re.test(plain)) return c; return 'otros'; }
const catOf = i => CAT_NAME[i.category] ? i.category : 'otros';
const catSelect = withAuto => el('select',{}, withAuto ? el('option',{value:'auto',text:tr('Categoría: automática')}) : null,
  ...CATS.map(([k,v]) => el('option',{value:k,text:v})));
$('#shopCat').replaceWith(Object.assign(catSelect(true), { id:'shopCat', style:'margin-bottom:12px' }));
const stapleOf = (name, place = state.place) => state.staples.find(x => x.place === place && x.name.toLowerCase() === name.trim().toLowerCase());

function itemRow(i) {
  return el('div',{class:'item'+(i.done?' done':''),'data-id':i.id},
    el('button',{class:'chk','aria-label':'Marcar',onclick:()=>toggleItem(i),text:i.done?'✓':''}),
    el('div',{class:'cn',style:'cursor:pointer',onclick:()=>itemForm(i)}, el('div',{class:'ct',text:i.name}), byLine('', i.added_by)),
    el('button',{class:'ghost del','aria-label':tr('Borrar'),text:'×',style:'font-size:22px',onclick:()=>delItem(i)}));
}
function renderShop() {
  const box = $('#shopList'); box.replaceChildren();
  const here = state.items.filter(i => i.place === state.place);
  const pending = here.filter(i=>!i.done), done = here.filter(i=>i.done);
  if (!here.length) box.append(el('div',{class:'card'}, emptyState('🛒', tr('La lista de ') + PLACE_NAME[state.place] + tr(' está vacía.'))));
  for (const [k, label] of CATS) {
    const its = pending.filter(i => catOf(i) === k); if (!its.length) continue;
    box.append(el('div',{class:'group-title',text:label}));
    const c = el('div',{class:'card'}); its.forEach(i => c.append(itemRow(i))); box.append(c);
  }
  if (done.length) {
    box.append(el('div',{class:'group-title',text:tr('Comprado')}));
    const c = el('div',{class:'card'}); done.forEach(i => c.append(itemRow(i))); box.append(c);
  }
  $('#clearDone').hidden = !done.length;
  renderStaples(); renderPlaceSeg();
}
function renderStaples() {
  const box = $('#staples'); box.replaceChildren();
  const staples = state.staples.filter(x => x.place === state.place);
  if (!staples.length) {
    if (state.items.some(i => i.place === state.place)) box.append(el('div',{class:'small muted',style:'margin:0 2px 12px',text:tr('Consejo: toca un producto de la lista y márcalo como «habitual» para añadirlo luego con un toque.')}));
    return;
  }
  const onList = new Set(state.items.filter(i=>!i.done && i.place === state.place).map(i=>i.name.toLowerCase()));
  box.append(el('div',{class:'title-row'}, el('div',{class:'group-title',style:'margin:6px 0',text:tr('Habituales')}),
    el('button',{class:'ghost',text:state.stapleEdit?tr('Listo'):'Editar',onclick:()=>{ state.stapleEdit = !state.stapleEdit; renderStaples(); }})));
  const row = el('div',{class:'chips'});
  staples.forEach(st => {
    const on = onList.has(st.name.toLowerCase());
    const b = el('button',{class:'chip'+(on&&!state.stapleEdit?' on':''),text: state.stapleEdit ? st.name+'  ×' : (on?'✓ ':'+ ')+st.name});
    b.disabled = on && !state.stapleEdit;
    b.onclick = () => state.stapleEdit ? delStaple(st) : addItem(st.name, st.category);
    row.append(b);
  });
  box.append(row);
}
async function addItem(name, category) {
  const { data, error } = await sb.from('shopping_items').insert({ household_id: state.household.id, name, category, place: state.place }).select().single();
  if (error) { toast(errMsg(error)); return false; }
  upsert(state.items, data); state.items.sort((a,b)=>a.created_at.localeCompare(b.created_at)); renderShop(); return true;
}
async function delStaple(st) {
  state.staples = state.staples.filter(x=>x.id!==st.id); renderStaples();
  const { error } = await sb.from('shopping_staples').delete().eq('id', st.id);
  if (error) { toast(errMsg(error)); await loadAll(); renderStaples(); }
}
async function syncStaple(name, category, want, oldName, place) {
  const ex = stapleOf(oldName || name, place);
  if (want && !ex) {
    const { data, error } = await sb.from('shopping_staples').insert({ household_id: state.household.id, name, category, place }).select().single();
    if (error) { toast(errMsg(error)); return; }
    upsert(state.staples, data);
  } else if (want && ex) {
    const { data, error } = await sb.from('shopping_staples').update({ name, category, place }).eq('id', ex.id).select().single();
    if (error) { toast(errMsg(error)); return; }
    upsert(state.staples, data);
  } else if (!want && ex) {
    const { error } = await sb.from('shopping_staples').delete().eq('id', ex.id);
    if (error) { toast(errMsg(error)); return; }
    state.staples = state.staples.filter(x=>x.id!==ex.id);
  }
  state.staples.sort((a,b)=>a.name.localeCompare(b.name));
}
function itemForm(i) {
  const name = el('input',{maxlength:'100',value:i.name});
  const cat = catSelect(false); cat.value = catOf(i);
  const plc = placeSelect(i.place);
  const stap = el('input',{type:'checkbox',style:'width:auto'}); stap.checked = !!stapleOf(i.name, i.place);
  const err = el('div',{class:'err'});
  const save = el('button',{text:tr('Guardar'),style:'flex:1'});
  save.onclick = async () => {
    const nm = name.value.trim(); if (!nm) { err.textContent = tr('Escribe el nombre.'); return; }
    save.disabled = true;
    const { data, error } = await sb.from('shopping_items').update({ name:nm, category:cat.value, place:plc.value }).eq('id', i.id).select().single();
    if (error) { err.textContent = errMsg(error); save.disabled = false; return; }
    upsert(state.items, data);
    await syncStaple(nm, cat.value, stap.checked, plc.value === i.place ? i.name : nm, plc.value);
    closeSheet(); renderShop();
  };
  openSheet(el('h3',{text:tr('Editar producto')}), name,
    el('label',{class:'f',text:tr('Categoría')}), cat,
    el('label',{class:'f',text:tr('Vivienda')}), plc,
    el('label',{class:'f row'}, stap, tr(' Producto habitual (acceso rápido)')), err,
    el('div',{class:'row',style:'margin-top:12px'}, el('button',{class:'ghost',text:'Cancelar',onclick:closeSheet}), save));
}
async function toggleItem(i) {
  i.done = !i.done; renderShop();
  const { error } = await sb.from('shopping_items').update({ done:i.done }).eq('id',i.id);
  if (error) { i.done=!i.done; renderShop(); toast(errMsg(error)); }
}
function delItem(i) {
  deferDelete(tr('Producto eliminado'), 'shopping_items', [i.id],
    () => { state.items = state.items.filter(x => x.id !== i.id); renderShop(); },
    () => { state.items.push(i); state.items.sort(byCreated); renderShop(); });
}
$('#shopForm').onsubmit = async e => {
  e.preventDefault();
  const name = $('#shopIn').value.trim(); if (!name) return;
  const sel = $('#shopCat').value;
  const category = sel === 'auto' ? (stapleOf(name)?.category || guessCat(name)) : sel;
  $('#shopIn').value = ''; $('#shopCat').value = 'auto';
  if (!(await addItem(name, category))) $('#shopIn').value = name;
};
$('#clearDone').onclick = async () => {
  const gone = state.items.filter(i=>i.done && i.place === state.place); if (!gone.length) return;
  const ids = gone.map(i=>i.id);
  deferDelete(tr('Productos eliminados'), 'shopping_items', ids,
    () => { state.items = state.items.filter(i=>!ids.includes(i.id)); render(); },
    () => { state.items.push(...gone); state.items.sort(byCreated); render(); });
};
